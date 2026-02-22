const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE = "https://maps.googleapis.com/maps/api";

Deno.serve(async (req) => {
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
    const { placeName, latitude, longitude } = await req.json();

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
