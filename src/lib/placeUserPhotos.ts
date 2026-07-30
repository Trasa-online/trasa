// Zdjecia miejsca ze zdjec userow z tras (2026-07-29): zamiast Google Photos okladki
// miejsc pochodza z galerii przypisanej do pinow (pins.user_photo_urls). Wszystkie
// trasy sa publiczne - brak filtra prywatnosci.
import { supabase } from "@/integrations/supabase/client";

interface FetchPlaceUserPhotosOpts {
  placeDbId?: string | null;
  googlePlaceId?: string | null;
  placeName?: string | null;
  city?: string | null;
}

// Pobiera unikalne URL-e zdjec userow przypisanych do miejsca. Dopasowanie po
// pins.place_id (UUID miejsca z bazy lub google_place_id) albo pins.place_name.
export async function fetchPlaceUserPhotos(opts: FetchPlaceUserPhotosOpts): Promise<string[]> {
  const { placeDbId, googlePlaceId, placeName } = opts;

  // Buduj filtr dynamicznie - tylko z warunkow ktore mamy.
  const orParts: string[] = [];
  if (placeDbId) orParts.push(`place_id.eq.${placeDbId}`);
  if (googlePlaceId && googlePlaceId !== placeDbId) orParts.push(`place_id.eq.${googlePlaceId}`);
  if (placeName) orParts.push(`place_name.eq.${placeName}`);
  if (orParts.length === 0) return [];

  try {
    // Zdjecia usera z miejsca dwoma kanalami: user_photo_urls (aktywny wyjazd) + images
    // (edytor trasy). Oba to zdjecia usera dla tego miejsca. Cast na any (kolumny nie w typach).
    const { data, error } = await (supabase as any)
      .from("pins")
      .select("user_photo_urls, images")
      .or(orParts.join(","));

    if (error) {
      console.warn("[placeUserPhotos] query error:", error.message);
      return [];
    }

    const urls = (data ?? [])
      .flatMap((row: { user_photo_urls?: string[] | null; images?: string[] | null }) => [...(row.user_photo_urls ?? []), ...(row.images ?? [])])
      .filter((u: unknown): u is string => typeof u === "string" && u.length > 0);

    return Array.from(new Set(urls));
  } catch (err) {
    console.warn("[placeUserPhotos] unexpected error:", err);
    return [];
  }
}

// Losowy element tablicy. Math.random() OK w kodzie aplikacji (nie workflow script).
export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
