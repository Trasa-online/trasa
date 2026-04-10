import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];

const BASE = "https://maps.googleapis.com/maps/api";

/** Haversine distance in km between two lat/lng points */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns true if the two names share at least one exact token (len > 2) */
function namesSimilar(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2);
  const ta = tokenize(a);
  const tb = new Set(tokenize(b));
  if (ta.length === 0 || tb.size === 0) return true;
  return ta.some(t => tb.has(t));
}

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // City autocomplete (returns cities/regions only)
    if (body.action === "citysearch") {
      const { query } = body;
      const res = await fetch(
        `${BASE}/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${apiKey}&language=pl`
      );
      const data = await res.json();
      const results = ((data.predictions ?? []) as any[]).slice(0, 5).map((p: any) => ({
        name: p.structured_formatting?.main_text ?? p.description,
        full_address: p.description,
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text search for autocomplete (no coordinates needed)
    if (body.action === "textsearch") {
      const { query } = body;
      const res = await fetch(
        `${BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pl`
      );
      const data = await res.json();
      const results = ((data.results ?? []) as any[]).slice(0, 6).map((r: any) => ({
        name: r.name ?? "",
        full_address: r.formatted_address ?? "",
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
        types: r.types ?? [],
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { placeName, latitude, longitude, city, googlePlaceId: bodyPlaceId, placeDbId } = body;
    const hasCoords = latitude && longitude && latitude !== 0 && longitude !== 0;

    // ─── Supabase client (for cache + auto-saving place_id) ───────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // ─── Fast path: known Google Place ID ────────────────────────────
    // If the caller already knows the Place ID (stored in places.google_place_id),
    // skip the unreliable text-search step entirely.
    let placeId: string | undefined = bodyPlaceId || undefined;

    if (!placeId) {
      // ─── Cache layer ──────────────────────────────────────────────
      const roundedLat = hasCoords ? Number(latitude).toFixed(4) : "0";
      const roundedLng = hasCoords ? Number(longitude).toFixed(4) : "0";
      const cacheKey = `${placeName.toLowerCase().trim()}|${roundedLat}|${roundedLng}`;

      const { data: cached } = await sb
        .from("place_details_cache")
        .select("response, expires_at, place_id")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`Cache HIT for "${placeName}" (key: ${cacheKey})`);
        // Opportunistically persist place_id back to places table if not yet saved
        if (cached.place_id && placeDbId) {
          sb.from("places").update({ google_place_id: cached.place_id }).eq("id", placeDbId)
            .then(() => {});
        }
        return new Response(JSON.stringify(cached.response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (cached) {
        await sb.from("place_details_cache").delete().eq("cache_key", cacheKey);
      }

      // Step 1: Find place_id by text search
      const searchQuery = city ? `${placeName} ${city}` : placeName;
      const locationBias = hasCoords ? `&locationbias=point:${latitude},${longitude}` : "";
      const findRes = await fetch(
        `${BASE}/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery${locationBias}&fields=place_id&key=${apiKey}`
      );
      const findData = await findRes.json();
      placeId = findData.candidates?.[0]?.place_id;

      // Step 2: Fallback — nearby search or text search
      if (!placeId) {
        if (hasCoords) {
          const nearbyRes = await fetch(
            `${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=100&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`
          );
          const nearbyData = await nearbyRes.json();
          placeId = nearbyData.results?.[0]?.place_id;
        } else {
          const textRes = await fetch(
            `${BASE}/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}&language=pl`
          );
          const textData = await textRes.json();
          placeId = textData.results?.[0]?.place_id;
        }
      }
    }

    if (!placeId) {
      return new Response(JSON.stringify({ error: "Place not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Place details
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary&reviews_sort=newest&language=pl&key=${apiKey}`
    );
    const detailData = await detailRes.json();

    const result = detailData.result;
    if (result) {
      if (result.photos?.length > 3) {
        result.photos = result.photos.slice(0, 3);
      }

      // Skip name/distance validation when we were given the Place ID directly
      if (!bodyPlaceId) {
        if (hasCoords) {
          const foundLat = result.geometry?.location?.lat;
          const foundLng = result.geometry?.location?.lng;
          if (foundLat !== undefined && foundLng !== undefined) {
            const dist = distanceKm(latitude, longitude, foundLat, foundLng);
            if (dist > 3) {
              console.warn(`Place "${result.name}" found ${dist.toFixed(1)} km away — rejecting`);
              return new Response(JSON.stringify({ error: "Place not found near provided coordinates" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }

        if (!namesSimilar(placeName, result.name ?? "")) {
          console.warn(`Name mismatch: requested "${placeName}", got "${result.name}" — rejecting`);
          return new Response(JSON.stringify({ error: "Place name mismatch" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Save to cache (fire and forget)
      const roundedLat2 = hasCoords ? Number(latitude).toFixed(4) : "0";
      const roundedLng2 = hasCoords ? Number(longitude).toFixed(4) : "0";
      const cacheKey2 = `${placeName.toLowerCase().trim()}|${roundedLat2}|${roundedLng2}`;
      sb.from("place_details_cache").insert({
        cache_key: cacheKey2,
        place_id: placeId,
        response: detailData,
      }).then(({ error }) => {
        if (error) console.error("Cache insert error:", error);
      });

      // Auto-save google_place_id back to places table for future fast-path lookups
      if (placeDbId) {
        sb.from("places").update({ google_place_id: placeId }).eq("id", placeDbId)
          .then(({ error }) => {
            if (error) console.error("places update error:", error);
            else console.log(`Saved google_place_id for "${placeName}": ${placeId}`);
          });
      }
    }

    return new Response(JSON.stringify(detailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("google-places-proxy error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
