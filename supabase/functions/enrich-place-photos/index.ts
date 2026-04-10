/**
 * enrich-place-photos
 *
 * Fetches Google Places photos for all active places in a city
 * that have no photo_url, and saves the direct photo URL to the DB.
 *
 * POST body: { city: string, limit?: number }
 * Returns: { updated: number, skipped: number, errors: string[] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BASE = "https://maps.googleapis.com/maps/api";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing GOOGLE_MAPS_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const city: string = body.city ?? "";
  const limit: number = Math.min(body.limit ?? 50, 100);

  if (!city) {
    return new Response(JSON.stringify({ error: "city is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch places without a real photo URL (null, empty, or picsum)
  const { data: places, error: fetchErr } = await sb
    .from("places")
    .select("id, place_name, latitude, longitude")
    .ilike("city", city)
    .eq("is_active", true)
    .or("photo_url.is.null,photo_url.eq.,photo_url.ilike.%picsum%")
    .limit(limit);

  if (fetchErr || !places?.length) {
    return new Response(JSON.stringify({ updated: 0, skipped: 0, errors: [fetchErr?.message ?? "no places found"] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const place of places) {
    try {
      const hasCoords = place.latitude && place.longitude && place.latitude !== 0 && place.longitude !== 0;
      const searchQuery = `${place.place_name} ${city}`;
      const locationBias = hasCoords ? `&locationbias=point:${place.latitude},${place.longitude}` : "";

      // Step 1: find place_id
      const findRes = await fetch(
        `${BASE}/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery${locationBias}&fields=place_id&key=${apiKey}`
      );
      const findData = await findRes.json();
      let placeId = findData.candidates?.[0]?.place_id;

      if (!placeId && hasCoords) {
        const nearbyRes = await fetch(
          `${BASE}/place/nearbysearch/json?location=${place.latitude},${place.longitude}&radius=150&keyword=${encodeURIComponent(place.place_name)}&key=${apiKey}&language=pl`
        );
        const nearbyData = await nearbyRes.json();
        placeId = nearbyData.results?.[0]?.place_id;
      }

      if (!placeId) { skipped++; continue; }

      // Step 2: get photo reference
      const detailRes = await fetch(
        `${BASE}/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`
      );
      const detailData = await detailRes.json();
      const photoRef = detailData.result?.photos?.[0]?.photo_reference;

      if (!photoRef) { skipped++; continue; }

      // Step 3: resolve photo reference to a real CDN URL (follow the redirect)
      const photoApiUrl = `${BASE}/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
      const photoRes = await fetch(photoApiUrl, { redirect: "follow" });
      const finalUrl = photoRes.url; // after redirect this is a CDN URL without the API key

      if (!finalUrl || finalUrl.includes("maps.googleapis.com/maps/api/place/photo")) {
        // redirect didn't resolve to CDN — store the proxy URL directly
        const proxyUrl = photoApiUrl;
        await sb.from("places").update({ photo_url: proxyUrl }).eq("id", place.id);
      } else {
        await sb.from("places").update({ photo_url: finalUrl }).eq("id", place.id);
      }
      updated++;

      // Small delay to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 150));
    } catch (e: any) {
      errors.push(`${place.place_name}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({ updated, skipped, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
