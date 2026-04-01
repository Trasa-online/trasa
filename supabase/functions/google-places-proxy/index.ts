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

/** Returns true if the two names share at least one meaningful token (len > 2) */
function namesSimilar(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2);
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return true;
  return ta.some(t => tb.some(t2 => t2.includes(t) || t.includes(t2)));
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

    // ─── Cache photo action ─────────────────────────────────────────────
    if (body.action === "cache-photo") {
      const { photo_reference, maxwidth = 800 } = body;
      if (!photo_reference) {
        return new Response(JSON.stringify({ error: "Missing photo_reference" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Check cache first
      const { data: cached } = await sb
        .from("place_photo_cache")
        .select("public_url")
        .eq("photo_reference", photo_reference)
        .maybeSingle();

      if (cached?.public_url) {
        return new Response(JSON.stringify({ public_url: cached.public_url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download from Google
      const googleUrl = `${BASE}/place/photo?maxwidth=${maxwidth}&photo_reference=${photo_reference}&key=${apiKey}`;
      const photoRes = await fetch(googleUrl, { redirect: "follow" });
      if (!photoRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch photo from Google" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentType = photoRes.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("png") ? "png" : "jpg";
      const photoBytes = new Uint8Array(await photoRes.arrayBuffer());

      // Upload to Supabase Storage
      const storagePath = `photos/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await sb.storage
        .from("place-photos")
        .upload(storagePath, photoBytes, { contentType, upsert: false });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        return new Response(JSON.stringify({ error: "Storage upload failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: publicUrlData } = sb.storage
        .from("place-photos")
        .getPublicUrl(storagePath);

      const publicUrl = publicUrlData.publicUrl;

      // Save to cache table
      await sb.from("place_photo_cache").insert({
        photo_reference,
        storage_path: storagePath,
        public_url: publicUrl,
      });

      return new Response(JSON.stringify({ public_url: publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { placeName, latitude, longitude, city } = body;
    const hasCoords = latitude && longitude && latitude !== 0 && longitude !== 0;

    // ─── Cache layer ──────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Deterministic cache key: placeName (lowered) + coords rounded to 4 decimals
    const roundedLat = hasCoords ? Number(latitude).toFixed(4) : "0";
    const roundedLng = hasCoords ? Number(longitude).toFixed(4) : "0";
    const cacheKey = `${placeName.toLowerCase().trim()}|${roundedLat}|${roundedLng}`;

    // Check cache first
    const { data: cached } = await sb
      .from("place_details_cache")
      .select("response, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log(`Cache HIT for "${placeName}" (key: ${cacheKey})`);
      return new Response(JSON.stringify(cached.response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache miss or expired — call Google API
    if (cached) {
      // Delete expired entry
      await sb.from("place_details_cache").delete().eq("cache_key", cacheKey);
    }

    // Step 1: Find place_id
    const searchQuery = city ? `${placeName} ${city}` : placeName;
    const locationBias = hasCoords ? `&locationbias=point:${latitude},${longitude}` : "";
    const findRes = await fetch(
      `${BASE}/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery${locationBias}&fields=place_id&key=${apiKey}`
    );
    const findData = await findRes.json();
    let placeId = findData.candidates?.[0]?.place_id;

    // Step 2: Fallback — nearby search (only when coords available) or text search
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

    if (!placeId) {
      return new Response(JSON.stringify({ error: "Place not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Place details (reviews_sort=newest for latest reviews)
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary&reviews_sort=newest&language=pl&key=${apiKey}`
    );
    const detailData = await detailRes.json();

    const result = detailData.result;
    if (result) {
      // Limit photos to 3
      if (result.photos?.length > 3) {
        result.photos = result.photos.slice(0, 3);
      }
      // Distance validation only when we have valid coords
      if (hasCoords) {
        const foundLat = result.geometry?.location?.lat;
        const foundLng = result.geometry?.location?.lng;
        if (foundLat !== undefined && foundLng !== undefined) {
          const dist = distanceKm(latitude, longitude, foundLat, foundLng);
          if (dist > 3) {
            console.warn(`Place "${result.name}" found ${dist.toFixed(1)} km away from requested coords — rejecting`);
            return new Response(JSON.stringify({ error: "Place not found near provided coordinates" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Validate: found place name should share at least one token with the requested name
      if (!namesSimilar(placeName, result.name ?? "")) {
        console.warn(`Name mismatch: requested "${placeName}", got "${result.name}" — rejecting`);
        return new Response(JSON.stringify({ error: "Place name mismatch" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save to cache (don't await — fire and forget)
      sb.from("place_details_cache").insert({
        cache_key: cacheKey,
        place_id: placeId,
        response: detailData,
      }).then(({ error }) => {
        if (error) console.error("Cache insert error:", error);
        else console.log(`Cache STORED for "${placeName}" (key: ${cacheKey})`);
      });
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
