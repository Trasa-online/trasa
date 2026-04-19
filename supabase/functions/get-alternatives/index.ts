import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://trasa.travel", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173"];

const categoryToPlaceType: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  museum: "museum",
  park: "park",
  viewpoint: "tourist_attraction",
  shopping: "shopping_mall",
  nightlife: "night_club",
  monument: "tourist_attraction",
  church: "church",
  market: "market",
  bar: "bar",
  gallery: "art_gallery",
  walk: "park",
};

const CACHE_TTL_HOURS = 168; // 7 days

serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { place_name, category, city, latitude, longitude } = await req.json();

    if (!place_name || !city) {
      return new Response(
        JSON.stringify({ error: "place_name and city required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const placeType = categoryToPlaceType[category] ?? "tourist_attraction";
    const query = `${placeType === "tourist_attraction" ? category : placeType} ${city}`;
    const cacheKey = `alternatives|${query}`.toLowerCase().trim();

    // Cache check
    const { data: cached } = await sb
      .from("place_details_cache")
      .select("data, cached_at")
      .eq("cache_key", cacheKey)
      .single();

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 3_600_000;
      if (ageHours < CACHE_TTL_HOURS) {
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
    }

    const locationBias = (latitude && longitude)
      ? `&location=${latitude},${longitude}&radius=1500`
      : "";

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}${locationBias}&language=pl&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ alternatives: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const results = (data.results ?? []) as any[];

    const alternatives = results
      .filter((r: any) => r.name.toLowerCase() !== place_name.toLowerCase())
      .slice(0, 3)
      .map((r: any) => ({
        place_name: r.name,
        address: r.formatted_address ?? "",
        description: r.types?.slice(0, 2).join(", ") ?? "",
        suggested_time: "",
        duration_minutes: 60,
        category: category,
        latitude: r.geometry?.location?.lat ?? 0,
        longitude: r.geometry?.location?.lng ?? 0,
        place_id: r.place_id ?? null,
        walking_time_from_prev: null,
        distance_from_prev: null,
      }));

    const responseBody = { alternatives };

    // Write to cache (fire and forget)
    sb.from("place_details_cache")
      .upsert({ cache_key: cacheKey, data: responseBody, cached_at: new Date().toISOString() })
      .then(() => {});

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-alternatives error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
