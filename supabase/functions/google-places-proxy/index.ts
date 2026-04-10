import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://trasa.lovable.app", "http://localhost:8080"];
const BASE = "https://maps.googleapis.com/maps/api";

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

    // City autocomplete
    if (body.action === "citysearch") {
      const res = await fetch(
        `${BASE}/place/autocomplete/json?input=${encodeURIComponent(body.query)}&types=(cities)&key=${apiKey}&language=pl`
      );
      const data = await res.json();
      const results = ((data.predictions ?? []) as any[]).slice(0, 5).map((p: any) => ({
        name: p.structured_formatting?.main_text ?? p.description,
        full_address: p.description,
      }));
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Text search for pin autocomplete
    if (body.action === "textsearch") {
      const res = await fetch(
        `${BASE}/place/textsearch/json?query=${encodeURIComponent(body.query)}&key=${apiKey}&language=pl`
      );
      const data = await res.json();
      const results = ((data.results ?? []) as any[]).slice(0, 6).map((r: any) => ({
        name: r.name ?? "",
        full_address: r.formatted_address ?? "",
        latitude: r.geometry?.location?.lat,
        longitude: r.geometry?.location?.lng,
        types: r.types ?? [],
      }));
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { placeName, latitude, longitude, city, googlePlaceId: knownPlaceId, placeDbId } = body;
    const hasCoords = latitude && longitude && Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Known Place ID → skip search entirely ──────────────────────
    let resolvedPlaceId: string | undefined = knownPlaceId || undefined;

    if (!resolvedPlaceId && hasCoords) {
      // ── 2. Nearby search within 50 m (most accurate when coords are good) ──
      const nearbyRes = await fetch(
        `${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=50&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`
      );
      const nearbyData = await nearbyRes.json();
      if (nearbyData.results?.length > 0) {
        resolvedPlaceId = nearbyData.results[0].place_id;
      }
    }

    if (!resolvedPlaceId && hasCoords) {
      // ── 3. Wider nearby search 200 m ──────────────────────────────────
      const nearbyRes2 = await fetch(
        `${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=200&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`
      );
      const nearbyData2 = await nearbyRes2.json();
      if (nearbyData2.results?.length > 0) {
        resolvedPlaceId = nearbyData2.results[0].place_id;
      }
    }

    if (!resolvedPlaceId) {
      // ── 4. Text search fallback (least reliable, last resort) ─────────
      const query = city ? `${placeName} ${city}` : placeName;
      const textRes = await fetch(
        `${BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pl`
      );
      const textData = await textRes.json();
      resolvedPlaceId = textData.results?.[0]?.place_id;
    }

    if (!resolvedPlaceId) {
      return new Response(JSON.stringify({ error: "Place not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch place details ───────────────────────────────────────────
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${resolvedPlaceId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary&reviews_sort=newest&language=pl&key=${apiKey}`
    );
    const detailData = await detailRes.json();

    if (detailData.result) {
      if (detailData.result.photos?.length > 3) {
        detailData.result.photos = detailData.result.photos.slice(0, 3);
      }

      // Save google_place_id to DB so next request uses fast path
      if (placeDbId && !knownPlaceId) {
        sb.from("places")
          .update({ google_place_id: resolvedPlaceId })
          .eq("id", placeDbId)
          .then(() => {});
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
