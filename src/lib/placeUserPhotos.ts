// Zdjecia miejsca ze zdjec userow z tras (2026-07-29): zamiast Google Photos okladki
// miejsc pochodza z galerii przypisanej do pinow (pins.user_photo_urls). Wszystkie
// trasy sa publiczne - brak filtra prywatnosci.
import { supabase } from "@/integrations/supabase/client";
import { fetchPlacePhotosForKeys, pinCoverKeys } from "@/lib/placePhotoSocial";
import { resolveStored } from "@/components/PlacePhoto";

interface FetchPlaceUserPhotosOpts {
  placeDbId?: string | null;
  googlePlaceId?: string | null;
  placeName?: string | null;
  city?: string | null;
}

// Pobiera unikalne URL-e zdjec userow przypisanych do miejsca. DWA zrodla:
//
//  1. `pins` - zdjecia dodane w wyjezdzie (dopasowanie po place_id albo place_name),
//  2. `place_photos` - zdjecia dodane na wizytowce miejsca ORAZ przy pozycji na liscie.
//
// Drugie zrodlo doszlo 2026-09-04. Wczesniej funkcja pytala wylacznie o `pins`, wiec zdjecie
// dodane do miejsca w LISCIE trafialo do place_photos (i widac je bylo w sekcji "Od
// uzytkownikow"), ale okladka wizytowki dalej pokazywala ikone kategorii - miejsce wygladalo
// na puste mimo realnego zdjecia (zgloszenie Nat).
export async function fetchPlaceUserPhotos(opts: FetchPlaceUserPhotosOpts): Promise<string[]> {
  const { placeDbId, googlePlaceId, placeName } = opts;

  // Buduj filtr dynamicznie - tylko z warunkow ktore mamy.
  const orParts: string[] = [];
  if (placeDbId) orParts.push(`place_id.eq.${placeDbId}`);
  if (googlePlaceId && googlePlaceId !== placeDbId) orParts.push(`place_id.eq.${googlePlaceId}`);
  // Wartosc w `or=(...)` MUSI byc w cudzyslowie: nazwa z przecinkiem, nawiasem albo "&"
  // rozbijala filtr PostgREST, zapytanie wracalo z bledem i funkcja konczyla sie pusta lista -
  // czyli miejsce bez zdjec (np. "good good - coffeebar & concept store Wrocław").
  if (placeName) orParts.push(`place_name.eq."${placeName.replace(/["\\]/g, "")}"`);
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

    // Galeria miejsca: zdjecia z wizytowki i z pozycji na listach. Klucz jest globalny
    // (gpid: albo nm:), wiec sprawdzamy oba warianty - patrz pinCoverKeys.
    let galleryUrls: string[] = [];
    try {
      const keys = pinCoverKeys({ google_place_id: googlePlaceId ?? null, place_name: placeName ?? null });
      const byKey = await fetchPlacePhotosForKeys(keys);
      galleryUrls = keys.flatMap((k) => byKey.get(k) ?? []);
    } catch (e) {
      console.warn("[placeUserPhotos] place_photos:", e instanceof Error ? e.message : e);
    }

    return Array.from(new Set([...urls, ...galleryUrls]));
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

/**
 * Zdjecia, ktore WIERSZ pokazuje u siebie: pozycja listy (discovery_items) albo przystanek
 * wyjazdu (pins). Kolejnosc jak w PlacePhoto - okladka wiersza, potem reszta.
 *
 * Po co: wizytowka otwierana tapnieciem w wiersz dostawala sam `photo_url`, a zdjecia
 * z `images` / `user_photo_urls` zostawaly w wierszu. Wygladalo to tak, jakby zdjecia
 * "nie ladowaly sie" - user widzial je na liscie i nie widzial po kliknieciu (zgloszenie Nat
 * 2026-09-09). Regula jest prosta: co widac na wierszu, to widac po jego otwarciu.
 */
export function rowOwnPhotos(row: {
  image_url?: string | null;
  photo_url?: string | null;
  images?: string[] | null;
  user_photo_urls?: string[] | null;
}): string[] {
  const raw = [
    row.image_url, row.photo_url,
    ...(Array.isArray(row.images) ? row.images : []),
    ...(Array.isArray(row.user_photo_urls) ? row.user_photo_urls : []),
  ];
  const out: string[] = [];
  for (const u of raw) {
    const v = resolveStored(u) ?? u;
    if (typeof v === "string" && (v.startsWith("http") || v.startsWith("/")) && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Scalenie wizytowki z wiersza z PELNYM rekordem miejsca dociagnietym w tle
 * (`fetchEnrichedPlace`). Zdjecia wiersza nie moga przy tym zniknac: `enrichWithBusinessProfile`
 * celowo kasuje okladke z Google-backfillu, wiec podmiana potrafila zostawic pusty kadr tam,
 * gdzie chwile wczesniej bylo zdjecie.
 *
 * Wyjatek: LOKAL Z WLASNYMI ZDJECIAMI. Tam galeria nalezy do lokalu i zdjec userow do niej
 * nie dokladamy - maja osobna sekcje "Od użytkowników" (patrz CLAUDE.md).
 */
export function mergeRowPhotosIntoDetail<T extends { photo_url?: string; galleryPhotos?: string[]; businessHasOwnPhoto?: boolean }>(
  fresh: T,
  rowPhotos: string[],
): T {
  if (!rowPhotos.length || fresh.businessHasOwnPhoto) return fresh;
  const gallery = [...rowPhotos, ...(fresh.galleryPhotos ?? [])];
  return {
    ...fresh,
    photo_url: fresh.photo_url || rowPhotos[0],
    galleryPhotos: Array.from(new Set(gallery)).filter((u) => u !== (fresh.photo_url || rowPhotos[0])),
  };
}
