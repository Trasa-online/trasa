import { supabase } from "@/integrations/supabase/client";
import { fetchPlacePhotosForKeys, pickPlaceCover, pinCoverKeys } from "@/lib/placePhotoSocial";

// Wyroznione miejsca usera (prosba Nat 2026-09-13): wszystkie gwiazdki "topki", ktore user
// postawil - w planach (`pin_stars`) i kolekcjach (`discovery_item_stars`), takze cudzych,
// w ktorych uczestniczy. Licznik na profilu + arkusz z lista miejsc; tap w miejsce prowadzi
// do planu/kolekcji, z ktorej pochodzi. ⛔ NIE licz z `pins.is_top` / `discovery_items.is_top`:
// obie kolumny znacza dzis „gwiazdka WLASCICIELA" i trzyma je trigger.
export type StarredPlace = {
  id: string;
  place_name: string;
  category: string | null;
  photo: string | null;
  google_place_id: string | null;
  /** Miasto i kraje BIORA SIE ZE ZRODLA (wyjazdu / kolekcji) - pin i pozycja kolekcji same
   *  nie niosa kraju, a wyjazd "Lodzki citybreak" i tak opisuje wszystkie swoje miejsca.
   *  Pozycja kolekcji ma wlasne `city`, wiec przy niej wygrywa ono. Sluza filtrom w arkuszu. */
  city: string | null;
  countries: string[];
  /** Skad gwiazdka - PIERWSZE zrodlo (tap w wiersz prowadzi tutaj). */
  source: { kind: "trip" | "list"; id: string; title: string };
  /** Wszystkie plany/kolekcje, w ktorych user wyroznil TO miejsce (patrz `dedupeStarred`). */
  sources: { kind: "trip" | "list"; id: string; title: string }[];
};

const firstOf = (v: unknown): string | null => (Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null);

export const starredPlacesKey = (userId: string | null | undefined) => ["starred-places", userId ?? null] as const;

// JEDNO miejsce = JEDEN wiersz (prosba Nat 2026-09-21): ta sama kawiarnia wyrozniona w planie
// i w dwoch kolekcjach stala na profilu trzy razy. Tozsamosc miejsca = znormalizowana nazwa,
// ta sama regula co `place_note_key` przy notkach, zdjeciach i gwiazdkach (sieciowka o tej
// samej nazwie w dwoch miastach to swiadome uproszczenie). Zrodla sie SUMUJA (`sources`),
// tap w wiersz prowadzi do pierwszego; zdjecie, miasto i kraje uzupelniane z kolejnych.
function dedupeStarred(rows: StarredPlace[]): StarredPlace[] {
  const byKey = new Map<string, StarredPlace>();
  for (const r of rows) {
    const key = r.place_name.trim().toLowerCase();
    if (!key) continue;
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, { ...r, sources: [r.source] }); continue; }
    if (!cur.sources.some((sx) => sx.kind === r.source.kind && sx.id === r.source.id)) cur.sources.push(r.source);
    cur.photo = cur.photo ?? r.photo;
    cur.google_place_id = cur.google_place_id ?? r.google_place_id;
    cur.category = cur.category ?? r.category;
    cur.city = cur.city ?? r.city;
    for (const c of r.countries) if (!cur.countries.includes(c)) cur.countries.push(c);
  }
  return [...byKey.values()];
}

export async function fetchStarredPlaces(userId: string): Promise<StarredPlace[]> {
  const [pinStarsRes, itemsRes] = await Promise.all([
    // Gwiazdki w PLANACH sa PER UCZESTNIK (2026-09-21, `pin_stars`) - liczymy wszystkie MOJE,
    // takze w cudzych planach, w ktorych uczestnicze. `pins.is_top` to od tej daty tylko
    // gwiazdka wlasciciela (do 21.09 gwiazdka uczestnika wpadala na profil autora planu).
    (supabase as any).from("pin_stars")
      .select("place_name, route_id, routes!inner(id, title, user_id, created_at, city, countries)")
      .eq("user_id", userId),
    // Gwiazdki w kolekcjach sa PER UCZESTNIK (2026-09-20, `discovery_item_stars`) - liczymy
    // wszystkie MOJE, takze w cudzych kolekcjach, ktore wspoltworze. `is_top` na pozycji
    // to od tej daty tylko gwiazdka wlasciciela.
    (supabase as any).from("discovery_item_stars")
      .select("place_name, collection_id, discovery_collections!inner(id, title, user_id, updated_at, city, countries)")
      .eq("user_id", userId),
  ]);
  const pinStarRows = (pinStarsRes.data ?? []) as any[];
  const routeIds = Array.from(new Set(pinStarRows.map((r) => r.route_id)));
  const { data: pinRows } = routeIds.length
    ? await (supabase as any).from("pins")
        .select("id, place_name, category, photo_url, image_url, images, user_photo_urls, place_id, route_id")
        .in("route_id", routeIds)
    : { data: [] as any[] };
  const starRows = (itemsRes.data ?? []) as any[];
  const colIds = Array.from(new Set(starRows.map((r) => r.collection_id)));
  const { data: itemRows } = colIds.length
    ? await (supabase as any).from("discovery_items")
        .select("id, place_name, category, photo_url, google_place_id, city, collection_id")
        .in("collection_id", colIds)
    : { data: [] as any[] };
  const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();
  const pinByKey = new Map<string, any>();
  for (const pn of (pinRows ?? []) as any[]) {
    const key = `${pn.route_id}|${norm(pn.place_name)}`;
    if (!pinByKey.has(key)) pinByKey.set(key, pn);
  }
  const starredPins = pinStarRows
    .map((r) => { const pn = pinByKey.get(`${r.route_id}|${norm(r.place_name)}`); return pn ? { ...pn, routes: r.routes } : null; })
    .filter(Boolean) as any[];
  const itemByKey = new Map<string, any>();
  for (const it of (itemRows ?? []) as any[]) itemByKey.set(`${it.collection_id}|${norm(it.place_name)}`, it);
  const starredItems = starRows
    .map((r) => { const it = itemByKey.get(`${r.collection_id}|${norm(r.place_name)}`); return it ? { ...it, discovery_collections: r.discovery_collections } : null; })
    .filter(Boolean) as any[];
  const trips: StarredPlace[] = starredPins.map((p) => ({
    id: `pin:${p.id}`, place_name: p.place_name ?? "", category: p.category ?? null,
    photo: p.image_url || firstOf(p.images) || firstOf(p.user_photo_urls) || p.photo_url || null,
    // Piny trzymaja w place_id identyfikator Google (nie UUID naszej bazy) - patrz SavePlaceSheet.
    google_place_id: typeof p.place_id === "string" && !/^[0-9a-f-]{36}$/i.test(p.place_id) ? p.place_id : null,
    city: p.routes?.city ?? null,
    countries: Array.isArray(p.routes?.countries) ? p.routes.countries.filter(Boolean) : [],
    source: { kind: "trip", id: p.route_id, title: p.routes?.title ?? "" },
    sources: [],
  }));
  const lists: StarredPlace[] = starredItems.map((it) => ({
    id: `item:${it.id}`, place_name: it.place_name ?? "", category: it.category ?? null,
    photo: it.photo_url ?? null, google_place_id: it.google_place_id ?? null,
    city: it.city ?? it.discovery_collections?.city ?? null,
    countries: Array.isArray(it.discovery_collections?.countries) ? it.discovery_collections.countries.filter(Boolean) : [],
    source: { kind: "list", id: it.collection_id, title: it.discovery_collections?.title ?? "" },
    sources: [],
  }));
  const all = dedupeStarred([...trips, ...lists]);
  // Miejsce bez wlasnego zdjecia: zdjecie spolecznosci (place_photos) - ten sam most, co na
  // kafelkach list i w wizytowce.
  const bare = all.filter((p) => !p.photo);
  if (bare.length) {
    const keys = Array.from(new Set(bare.flatMap((p) => pinCoverKeys({ google_place_id: p.google_place_id, place_name: p.place_name })))).filter(Boolean);
    const map = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
    for (const p of bare) p.photo = pickPlaceCover(map, pinCoverKeys({ google_place_id: p.google_place_id, place_name: p.place_name }));
  }
  return all;
}
