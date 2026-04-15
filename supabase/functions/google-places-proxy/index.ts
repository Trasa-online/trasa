import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BASE = "https://maps.googleapis.com/maps/api";
const REFERER = "https://trasa.travel/";
const CACHE_TTL_HOURS = 168; // 7 days

function nameMatches(requested: string, found: string): boolean {
  const tok = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const a = tok(requested);
  const b = new Set(tok(found));
  if (a.length === 0 || b.size === 0) return false;
  return a.some(t => b.has(t));
}

function cacheKey(placeName: string, city?: string): string {
  return `${placeName}|${city ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Missing API key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();

    // ── Non-detail actions (no cache needed) ─────────────────────────────────

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

    // ── Place details (main path — with 7-day cache) ──────────────────────────

    const { placeName, latitude, longitude, city, googlePlaceId: knownPlaceId, placeDbId } = body;
    const hasCoords = latitude && longitude && Math.abs(latitude) > 0.001 && Math.abs(longitude) > 0.001;
    const key = cacheKey(placeName, city);

    // 1. Cache check
    const { data: cached } = await sb
      .from("place_details_cache")
      .select("data, cached_at")
      .eq("cache_key", key)
      .single();

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 3_600_000;
      if (ageHours < CACHE_TTL_HOURS) {
        // Cache HIT — return immediately, $0 Google cost
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
      // Cache stale — continue to fetch fresh data
    }

    // 2. Resolve place_id
    let resolvedPlaceId: string | undefined = knownPlaceId || undefined;

    if (!resolvedPlaceId && hasCoords) {
      for (const radius of [100, 300]) {
        const r = await fetch(`${BASE}/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&keyword=${encodeURIComponent(placeName)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
        const d = await r.json();
        const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
        if (match) { resolvedPlaceId = match.place_id; break; }
      }
    }

    if (!resolvedPlaceId) {
      const query = city ? `${placeName} ${city}` : placeName;
      const r = await fetch(`${BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=pl`, { headers: { Referer: REFERER } });
      const d = await r.json();
      const match = (d.results ?? []).find((p: any) => nameMatches(placeName, p.name ?? ""));
      if (match) resolvedPlaceId = match.place_id;
    }

    if (!resolvedPlaceId) {
      return new Response(JSON.stringify({ error: "Place not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Fetch place details from Google
    const detailRes = await fetch(
      `${BASE}/place/details/json?place_id=${resolvedPlaceId}&fields=name,rating,user_ratings_total,price_level,types,formatted_address,photos,reviews,geometry,opening_hours,editorial_summary,place_id&reviews_sort=newest&language=pl&key=${apiKey}`,
      { headers: { Referer: REFERER } }
    );
    const detailData = await detailRes.json();

    if (detailData.result) {
      if (detailData.result.photos?.length > 3) {
        detailData.result.photos = detailData.result.photos.slice(0, 3);
      }

      // Strip API key from photo URLs — client uses /api/place-photo proxy instead
      // photo_reference stays in the response; PlaceSwiperDetail calls getPhotoUrl(ref)
      if (detailData.result.photos) {
        detailData.result.photos = detailData.result.photos.map((p: any) => ({
          photo_reference: p.photo_reference,
          width: p.width,
          height: p.height,
          // photo_url intentionally omitted — use /api/place-photo proxy on client
        }));
      }

      // Auto-save Place ID for future fast-path
      if (placeDbId && !knownPlaceId) {
        sb.from("places").update({ google_place_id: resolvedPlaceId }).eq("id", placeDbId).then(() => {});
      }
    }

    // 4. Store in cache (upsert — overwrite if stale)
    sb.from("place_details_cache")
      .upsert({ cache_key: key, data: detailData, cached_at: new Date().toISOString() })
      .then(() => {});

    return new Response(JSON.stringify(detailData), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });

  } catch (error) {
    console.error("google-places-proxy error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
