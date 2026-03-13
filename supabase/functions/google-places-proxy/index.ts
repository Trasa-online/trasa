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
  if (ta.length === 0 || tb.length === 0) return true; // can't validate, allow
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
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { placeName, latitude, longitude } = body;

    // Step 1: Find place_id
    const findRes = await fetch(
      `${BASE}/place/findplacefromtext/json?input=${encodeURIComponent(placeName)}&inputtype=textquery&locationbias=point:${latitude},${longitude}&fields=place_id&key=${apiKey}`
    );
    const findData = await findRes.json();
    let placeId = findData.candidates?.[0]?.place_id;

    // Step 2: Fallback nearby search
    if (!placeId) {
      const nearbyRes = await fetch(
        `${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=100&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`
      );
      const nearbyData = await nearbyRes.json();
      placeId = nearbyData.results?.[0]?.place_id;
    }

    if (!placeId) {
      return new Response(JSON.stringify({ error: "Place not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Place details (reviews_sort=newest for latest reviews)
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry&reviews_sort=newest&language=pl&key=${apiKey}`
    );
    const detailData = await detailRes.json();

    const result = detailData.result;
    if (result) {
      // Validate: found place must be within 3 km of the AI-provided coordinates
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

      // Validate: found place name should share at least one token with the requested name
      if (!namesSimilar(placeName, result.name ?? "")) {
        console.warn(`Name mismatch: requested "${placeName}", got "${result.name}" — rejecting`);
        return new Response(JSON.stringify({ error: "Place name mismatch" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
