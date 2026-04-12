import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BASE = "https://maps.googleapis.com/maps/api";
const REFERER = "https://trasa.travel/";

/** Exact token match — no substring tricks */
function nameMatches(requested: string, found: string): boolean {
  const tok = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const a = tok(requested);
  const b = new Set(tok(found));
  if (a.length === 0 || b.size === 0) return false;
  return a.some(t => b.has(t));
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();

    if (body.action === "citysearch") {
      const res = await fetch(`${BASE}/place/autocomplete/json?input=${encodeURIComponent(body.query)}&types=(cities)&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const data = await res.json();
      const results = ((data.predictions ?? []) as any[]).slice(0, 5).map((p: any) => ({
        name: p.structured_formatting?.main_text ?? p.description,
        full_address: p.description,
      }));
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "textsearch") {
      const res = await fetch(`${BASE}/place/textsearch/json?query=${encodeURIComponent(body.query)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
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

    let resolvedPlaceId: string | undefined = knownPlaceId || undefined;

    // ── 1. Stored Place ID → skip search ─────────────────────────────
    if (!resolvedPlaceId && hasCoords) {
      // ── 2. Nearby 100m + name check ───────────────────────────────
      for (const radius of [100, 300]) {
        const r = await fetch(`${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
        const d = await r.json();
        const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
        if (match) { resolvedPlaceId = match.place_id; break; }
      }
    }

    if (!resolvedPlaceId) {
      // ── 3. Text search by name + city (with name validation) ──────
      const query = city ? `${placeName} ${city}` : placeName;
      const r = await fetch(`${BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const d = await r.json();
      const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
      if (match) resolvedPlaceId = match.place_id;
    }

    if (!resolvedPlaceId) {
      console.log(`No match found for "${placeName}" — returning 404`);
      return new Response(JSON.stringify({ error: "Place not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Fetch details ─────────────────────────────────────────────────
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${resolvedPlaceId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary&reviews_sort=newest&language=pl&key=${apiKey}`,
      { headers: { Referer: REFERER } }
    );
    const detailData = await detailRes.json();

    if (detailData.result) {
      if (detailData.result.photos?.length > 3) detailData.result.photos = detailData.result.photos.slice(0, 3);

      // Enrich photos with full URL so clients don't need an API key
      if (detailData.result.photos?.length && apiKey) {
        detailData.result.photos = detailData.result.photos.map((p: any) => ({
          ...p,
          photo_url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(p.photo_reference)}&key=${apiKey}`,
        }));
      }

      // Auto-save Place ID for future fast-path
      if (placeDbId && !knownPlaceId) {
        sb.from("places").update({ google_place_id: resolvedPlaceId }).eq("id", placeDbId).then(() => {});
      }
    }

    return new Response(JSON.stringify(detailData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("google-places-proxy error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
