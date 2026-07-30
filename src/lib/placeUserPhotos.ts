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
    // routes!inner(status) + neq draft: zdjecie zasila okladke miejsca DOPIERO po stworzeniu
    // trasy (status draft->published przy "Zapisz trase"), nie od razu przy tworzeniu.
    const { data, error } = await (supabase as any)
      .from("pins")
      .select("user_photo_urls, images, routes!inner(status)")
      .or(orParts.join(","))
      .neq("routes.status", "draft");

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

// Batch: dla listy NAZW miejsc zwraca mape place_name -> pierwsze zdjecie usera (images lub
// user_photo_urls). Jednym zapytaniem - do okladek w wynikach wyszukiwarki / propozycji.
export async function fetchUserPhotosByNames(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = Array.from(new Set(names.filter((n): n is string => typeof n === "string" && n.length > 0)));
  if (uniq.length === 0) return map;
  try {
    const { data, error } = await (supabase as any)
      .from("pins")
      .select("place_name, images, user_photo_urls, routes!inner(status)")
      .in("place_name", uniq)
      .neq("routes.status", "draft");
    if (error) { console.warn("[placeUserPhotos] byNames error:", error.message); return map; }
    for (const row of (data ?? []) as { place_name: string; images?: string[] | null; user_photo_urls?: string[] | null }[]) {
      if (!row.place_name || map.has(row.place_name)) continue;
      const url = (row.images ?? []).find(Boolean) || (row.user_photo_urls ?? []).find(Boolean);
      if (typeof url === "string" && url) map.set(row.place_name, url);
    }
  } catch (err) {
    console.warn("[placeUserPhotos] byNames unexpected:", err);
  }
  return map;
}

// Losowy element tablicy. Math.random() OK w kodzie aplikacji (nie workflow script).
export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
