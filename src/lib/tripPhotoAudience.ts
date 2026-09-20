import { supabase } from "@/integrations/supabase/client";

// KTO WIDZI ZDJECIE W WYJEZDZIE: wszyscy albo tylko znajomi autora (prosba Nat 2026-09-17).
//
// ⚠️ Zdjecia galerii wyjazdu zyja w DWOCH miejscach i to nie jest przypadek:
//   * PUBLICZNE  -> `routes.review_photos` (text[] na trasie, jak dotad),
//   * DLA ZNAJOMYCH -> `route_friend_photos` (osobne WIERSZE).
// Powod jest twardy: RLS filtruje WIERSZE, nie elementy tablicy. Zdjecie zostawione w tablicy
// byloby czytelne dla kazdego, kto moze przeczytac trase - bramka bylaby pozorna. Dzieki temu
// podzialowi `review_photos` jest z definicji tablica zdjec publicznych, wiec okladka hero,
// strona linku i podsumowanie nie moga przypadkiem pokazac czegos prywatnego.
//
// Zdjecia przy MIEJSCU (`pin_photos`) sa juz wierszami, wiec tam wystarczy kolumna `visibility`.
// Przelaczanie obu rodzajow idzie przez JEDNO wejscie (`set_trip_photo_audience`), zeby galeria
// nie musiala wiedziec, z ktorego zrodla pochodzi zdjecie.

export type PhotoAudience = "public" | "friends";

export interface FriendPhoto {
  id: string;
  route_id: string;
  user_id: string | null;
  url: string;
  sort_order: number;
}

/** Klucz pliku w buckecie. Ten sam plik bywa zapisany raz przez api.spontaway.com, a raz przez
 *  <ref>.supabase.co (dwie domeny tego samego Storage), wiec porownanie calych adresow gubi
 *  trafienia. Odpowiednik `trip_photo_key()` w SQL - zmieniasz jedno, zmien drugie. */
export const photoStorageKey = (url: string): string =>
  String(url ?? "").replace(/\?.*$/, "").replace(/^.*\/route-images\//, "");

/** Zdjecia wyjazdu widoczne tylko dla znajomych. RLS sam decyduje, czy wolajacy je dostanie -
 *  obcy dostaje pusta liste, nie blad. */
export async function fetchFriendPhotos(routeId: string): Promise<FriendPhoto[]> {
  const { data, error } = await (supabase as any)
    .from("route_friend_photos")
    .select("id, route_id, user_id, url, sort_order")
    .eq("route_id", routeId)
    .order("sort_order", { ascending: true });
  if (error) { console.warn("[tripPhotoAudience] fetch:", error.message); return []; }
  return (data ?? []) as FriendPhoto[];
}

/** Przelacza widocznosc zdjecia. Oddaje stan PO zmianie albo null przy bledzie.
 *  Uprawnienia pilnuje baza: zdjecie przy miejscu flaguje jego autor albo wlasciciel wyjazdu,
 *  zdjecie galerii - tylko wlasciciel (tablica `review_photos` jest owner-only). */
export async function setTripPhotoAudience(
  routeId: string, url: string, friendsOnly: boolean,
): Promise<PhotoAudience | null> {
  const { data, error } = await (supabase as any).rpc("set_trip_photo_audience", {
    p_route: routeId, p_url: url, p_friends: friendsOnly,
  });
  if (error) { console.error("[tripPhotoAudience] set:", error.message); return null; }
  return (data as PhotoAudience) ?? null;
}
