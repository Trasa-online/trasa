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
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const GOOGLE_BASE = "https://maps.googleapis.com/maps/api";
const GOOGLE_NEW_API = "https://places.googleapis.com/v1";
const REFERER = "https://spontaway.com/";
const BUCKET = "place-photos-cache";

// Dzienny limit wywolan platnego Google API (bezpiecznik kosztowy). Env-configurable.
const GOOGLE_DAILY_CALL_LIMIT = Number(Deno.env.get("GOOGLE_DAILY_CALL_LIMIT") ?? "2500");

// Atomowo rezerwuje n wywolan Google na dzis. false => limit przekroczony (NIE wolaj Google).
// Fail-open: gdy RPC niedostepny/blad -> przepuszczamy (nie blokujemy legalnego ruchu).
async function consumeGoogleQuota(sb: ReturnType<typeof createClient>, n: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("try_consume_google_quota", { p_n: n, p_limit: GOOGLE_DAILY_CALL_LIMIT });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

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
      target_table, // 'pins' | 'places' | 'discovery_items' (opcjonalne)
      target_id, // UUID (opcjonalne - gdy brak, tylko cache do Storage + zwrot URL)
    } = body as {
      place_name?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      place_id?: string;
      target_table?: "pins" | "places" | "discovery_items";
      target_id?: string;
    };

    // target_table/target_id sa OPCJONALNE. Gdy podane -> aktualizujemy wiersz (persist,
    // idempotencja). Gdy brak (np. cache przy dodawaniu miejsca do listy PRZED zapisem) ->
    // tylko cache do Storage + zwrot URL; klient sam zapisze URL przy publikacji.
    const ALLOWED_TABLES = ["pins", "places", "discovery_items"];
    const hasTarget = !!target_table && !!target_id;
    if (!place_name) {
      return jsonResponse({ error: "Missing required field: place_name" }, 400);
    }
    if (target_table && !ALLOWED_TABLES.includes(target_table)) {
      return jsonResponse({ error: "target_table must be 'pins', 'places' or 'discovery_items'" }, 400);
    }

    const STORAGE_MARKER = "/storage/v1/object/public/place-photos-cache/";

    // 1. Already cached? (idempotency) - tylko gdy mamy target do sprawdzenia.
    if (hasTarget) {
      const { data: record } = await sb
        .from(target_table!)
        .select("photo_url, photo_cached_at")
        .eq("id", target_id!)
        .single();

      if (record?.photo_url && record.photo_url.includes(STORAGE_MARKER)) {
        return jsonResponse({
          photo_url: record.photo_url,
          cached: true,
          skipped: true,
        });
      }
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
      // Pliki istnieją — tylko zaktualizuj DB (gdy target) i zwróć URL bez wywołań Google
      const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(fileKey800);
      const photoUrl = publicData.publicUrl;
      if (hasTarget) {
        await sb
          .from(target_table!)
          .update({ photo_url: photoUrl, photo_cached_at: new Date().toISOString() })
          .eq("id", target_id!);
      }
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

    // 5. Quota guard (bezpiecznik kosztowy) + pobierz TYLKO 800px z Google (1 wywolanie).
    //    400px generujemy lokalnie z 800px (resize) - ZERO dodatkowego kosztu Google.
    //    Wczesniej pobieralismy 800 i 400 osobno = 2 wywolania Google na miejsce.
    const allowed = await consumeGoogleQuota(sb, 1);
    if (!allowed) {
      return jsonResponse({ photo_url: null, cached: false, reason: "quota_exceeded" });
    }

    const res800 = await fetch(buildPhotoUrl(800), { redirect: "follow", headers: { Referer: REFERER } });
    if (!res800.ok) {
      return jsonResponse({ error: "Google Photos fetch failed", status_800: res800.status }, 502);
    }

    const contentType800 = res800.headers.get("content-type") || "image/jpeg";
    const buf800src = new Uint8Array(await res800.arrayBuffer());
    const buf800: Uint8Array = buf800src;

    // 400px = lokalny resize 800px. Fallback: te same bajty co 800 (gdy decode/resize zawiedzie).
    let buf400: Uint8Array = buf800src;
    let contentType400 = contentType800;
    try {
      const img = await Image.decode(buf800src);
      const resized = img.resize(400, Image.RESIZE_AUTO);
      buf400 = await resized.encodeJPEG(80);
      contentType400 = "image/jpeg";
    } catch (e) {
      console.warn("[cache-place-photo] resize 400 failed, fallback to 800 bytes:", (e as Error).message);
    }

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

    // 8. UPDATE target_table z stałym URL (tylko gdy podano target - inaczej klient
    //    zapisze URL sam, np. discovery_items przy publikacji listy).
    if (hasTarget) {
      const { error: updateError } = await sb
        .from(target_table!)
        .update({
          photo_url: photoUrl,
          photo_cached_at: new Date().toISOString(),
        })
        .eq("id", target_id!);

      if (updateError) {
        return jsonResponse(
          { error: "DB update failed", details: updateError.message },
          500,
        );
      }
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
