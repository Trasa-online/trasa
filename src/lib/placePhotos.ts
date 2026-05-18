import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/platform";

// On native (Capacitor), relative URLs resolve to capacitor://localhost which
// doesn't have our Vercel Edge Functions. Use absolute production URL.
const API_BASE = isNative ? "https://trasa.travel" : "";

// =====================================================================
// Legacy proxy URL (fallback dla miejsc bez scache'owanego zdjęcia)
// =====================================================================

/**
 * Returns a URL routed through our Edge proxy (/api/place-photo).
 * Supports both Old Places API (CmRaAAAA... format) and New Places API (AU_... format).
 * For AU_ references, placeId is required to build the correct v1 photo name.
 *
 * UWAGA: To jest legacy path — woła Google za każdym razem ($0.007/wywołanie).
 * Preferuj `pin.photo_url` / `place.photo_url` z bazy + `ensurePhotoCached()` dla
 * pierwszego pobrania.
 */
export function getPhotoUrl(photoReference: string, maxWidth = 800, placeId?: string): string | null {
  if (!photoReference) return null;
  const ref = encodeURIComponent(photoReference);
  const base = `${API_BASE}/api/place-photo?ref=${ref}&w=${maxWidth}`;
  if (photoReference.startsWith("AU_") && placeId) {
    return `${base}&place_id=${encodeURIComponent(placeId)}`;
  }
  return base;
}

// =====================================================================
// Supabase Storage cache (persistent, $0 per render)
// =====================================================================

const STORAGE_MARKER = "/storage/v1/object/public/place-photos-cache/";

/**
 * Czy URL pochodzi z naszego cache w Supabase Storage?
 */
export function isCachedPhotoUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(STORAGE_MARKER);
}

/**
 * Zamienia URL cache'owanego zdjęcia (zawsze 800px) na wariant 400px
 * (thumbnail). Jeśli URL nie jest z cache, zwraca oryginał.
 */
export function getCachedPhotoVariant(
  url: string | null | undefined,
  size: "small" | "large",
): string | null {
  if (!url) return null;
  if (!isCachedPhotoUrl(url)) return url;
  if (size === "small") return url.replace("_800.jpg", "_400.jpg");
  return url;
}

/**
 * Zapewnia że zdjęcie dla danego pinu/miejsca jest scache'owane w Supabase Storage.
 *
 * - Jeśli `currentPhotoUrl` jest już z cache → zwraca go natychmiast (zero kosztów)
 * - Jeśli null lub Google proxy URL → wywołuje edge function `cache-place-photo`,
 *   która pobiera z Google raz, wrzuca do Storage, aktualizuje DB i zwraca trwały URL
 *
 * Bezpieczne do wołania wielokrotnie dla tego samego target (idempotentne).
 *
 * @returns URL 800px (lub null jeśli nie ma zdjęcia w Google)
 */
export async function ensurePhotoCached(
  target: {
    table: "pins" | "places";
    id: string;
    place_name: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    place_id?: string | null;
  },
  currentPhotoUrl: string | null | undefined,
): Promise<string | null> {
  if (isCachedPhotoUrl(currentPhotoUrl)) return currentPhotoUrl!;

  try {
    const { data, error } = await supabase.functions.invoke("cache-place-photo", {
      body: {
        place_name: target.place_name,
        city: target.city ?? undefined,
        latitude: target.latitude ?? undefined,
        longitude: target.longitude ?? undefined,
        place_id: target.place_id ?? undefined,
        target_table: target.table,
        target_id: target.id,
      },
    });
    if (error) {
      console.warn("[ensurePhotoCached] edge function error:", error.message);
      return currentPhotoUrl ?? null;
    }
    return (data as any)?.photo_url ?? currentPhotoUrl ?? null;
  } catch (err) {
    console.warn("[ensurePhotoCached] exception:", err);
    return currentPhotoUrl ?? null;
  }
}
