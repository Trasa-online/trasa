// =====================================================================
// cache-place-photo — Edge Function (Supabase / Deno)
// =====================================================================
// Pobiera zdjęcie z Google Places API raz, zapisuje do Supabase Storage
// w dwóch rozmiarach (400px + 800px) i aktualizuje target_table.photo_url
// stałym URL-em Storage.
//
// Kolejne wywołania dla tego samego place'a są idempotentne — zwracają
// istniejący URL bez ponownego pobierania z Google.
//
// Feature flag PHOTO_CACHE_ENABLED=false wyłącza function (zwraca null).
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GOOGLE_BASE = "https://maps.googleapis.com/maps/api";
const GOOGLE_NEW_API = "https://places.googleapis.com/v1";
const REFERER = "https://trasa.travel/";
const BUCKET = "place-photos-cache";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Kill switch
  if (Deno.env.get("PHOTO_CACHE_ENABLED") === "false") {
    return jsonResponse({ photo_url: null, cached: false, reason: "disabled" });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) return jsonResponse({ error: "Missing GOOGLE_MAPS_API_KEY" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const {
      place_name,
      city,
      latitude,
      longitude,
      place_id, // Google place_id (opcjonalne)
      target_table, // 'pins' | 'places'
      target_id, // UUID
    } = body as {
      place_name?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      place_id?: string;
      target_table?: "pins" | "places";
      target_id?: string;
    };

    if (!place_name || !target_table || !target_id) {
      return jsonResponse(
        { error: "Missing required fields: place_name, target_table, target_id" },
        400,
      );
    }
    if (target_table !== "pins" && target_table !== "places") {
      return jsonResponse({ error: "target_table must be 'pins' or 'places'" }, 400);
    }

    // 1. Already cached? (idempotency)
    const { data: record } = await sb
      .from(target_table)
      .select("photo_url, photo_cached_at")
      .eq("id", target_id)
      .single();

    const STORAGE_MARKER = "/storage/v1/object/public/place-photos-cache/";
    if (record?.photo_url && record.photo_url.includes(STORAGE_MARKER)) {
      return jsonResponse({
        photo_url: record.photo_url,
        cached: true,
        skipped: true,
      });
    }

    // 2. Stabilny klucz pliku
    const fileKeyBase = place_id
      ? `gpid_${place_id}`
      : `hash_${(await sha256Hex(`${place_name.toLowerCase()}|${(city || "").toLowerCase()}`)).slice(0, 32)}`;
    const fileKey800 = `${fileKeyBase}_800.jpg`;
    const fileKey400 = `${fileKeyBase}_400.jpg`;

    // 2b. Czy pliki już są w Storage? (cache współdzielony między rekordami z tym samym place_id)
    const { data: existingFiles } = await sb.storage
      .from(BUCKET)
      .list("", { search: fileKeyBase });
    const has800 = existingFiles?.some((f) => f.name === fileKey800);
    const has400 = existingFiles?.some((f) => f.name === fileKey400);

    if (has800 && has400) {
      // Pliki istnieją — tylko zaktualizuj DB i zwróć URL bez wywołań Google
      const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(fileKey800);
      const photoUrl = publicData.publicUrl;
      await sb
        .from(target_table)
        .update({ photo_url: photoUrl, photo_cached_at: new Date().toISOString() })
        .eq("id", target_id);
      return jsonResponse({
        photo_url: photoUrl,
        photo_url_small: photoUrl.replace("_800.jpg", "_400.jpg"),
        cached: true,
        reused_existing: true,
        file_key: fileKeyBase,
      });
    }

    // 3. Re-use google-places-proxy (ma 7-dniowy cache w DB)
    const proxyRes = await fetch(`${supabaseUrl}/functions/v1/google-places-proxy`, {
      method: "POST",
      headers: {
        "Authorization": req.headers.get("Authorization")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeName: place_name,
        latitude,
        longitude,
        city,
        googlePlaceId: place_id,
      }),
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text().catch(() => "");
      return jsonResponse(
        { error: "google-places-proxy failed", status: proxyRes.status, details: errText },
        502,
      );
    }

    const proxyData = await proxyRes.json();
    const photoRef = proxyData?.result?.photos?.[0]?.photo_reference;
    const resolvedPlaceId = proxyData?.result?.place_id;

    if (!photoRef) {
      return jsonResponse({
        photo_url: null,
        cached: false,
        reason: "no_photo_in_google",
      });
    }

    // 4. URL-e do Google Photos w dwóch rozmiarach
    const isNewApi = typeof photoRef === "string" && photoRef.startsWith("AU_");
    const buildPhotoUrl = (width: number) => {
      if (isNewApi && resolvedPlaceId) {
        return `${GOOGLE_NEW_API}/places/${resolvedPlaceId}/photos/${photoRef}/media?maxWidthPx=${width}&key=${apiKey}`;
      }
      return `${GOOGLE_BASE}/place/photo?maxwidth=${width}&photoreference=${photoRef}&key=${apiKey}`;
    };

    // 5. Pobierz oba rozmiary równolegle
    const [res800, res400] = await Promise.all([
      fetch(buildPhotoUrl(800), { redirect: "follow", headers: { Referer: REFERER } }),
      fetch(buildPhotoUrl(400), { redirect: "follow", headers: { Referer: REFERER } }),
    ]);

    if (!res800.ok || !res400.ok) {
      return jsonResponse(
        {
          error: "Google Photos fetch failed",
          status_800: res800.status,
          status_400: res400.status,
        },
        502,
      );
    }

    const contentType800 = res800.headers.get("content-type") || "image/jpeg";
    const contentType400 = res400.headers.get("content-type") || "image/jpeg";
    const buf800 = await res800.arrayBuffer();
    const buf400 = await res400.arrayBuffer();

    // 6. Upload obu wersji do Storage (upsert — overwrite jeśli istnieją)
    const [up800, up400] = await Promise.all([
      sb.storage.from(BUCKET).upload(fileKey800, buf800, {
        cacheControl: "31536000",
        contentType: contentType800,
        upsert: true,
      }),
      sb.storage.from(BUCKET).upload(fileKey400, buf400, {
        cacheControl: "31536000",
        contentType: contentType400,
        upsert: true,
      }),
    ]);

    if (up800.error || up400.error) {
      return jsonResponse(
        {
          error: "Storage upload failed",
          details: { up800: up800.error?.message, up400: up400.error?.message },
        },
        500,
      );
    }

    // 7. Public URL dla 800 (klient zamieni "_800" → "_400" dla thumbnaili)
    const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(fileKey800);
    const photoUrl = publicData.publicUrl;

    // 8. UPDATE target_table z stałym URL
    const { error: updateError } = await sb
      .from(target_table)
      .update({
        photo_url: photoUrl,
        photo_cached_at: new Date().toISOString(),
      })
      .eq("id", target_id);

    if (updateError) {
      return jsonResponse(
        { error: "DB update failed", details: updateError.message },
        500,
      );
    }

    return jsonResponse({
      photo_url: photoUrl,
      photo_url_small: photoUrl.replace("_800.jpg", "_400.jpg"),
      cached: true,
      file_key: fileKeyBase,
    });
  } catch (err) {
    console.error("[cache-place-photo] error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
