import { supabase } from "@/integrations/supabase/client";

// Operacje na LISTACH MIEJSC usera (discovery_collections, kind='ranking').
// Kazda lista ma kategorie list_status: 'visited' (odwiedzone) | 'to_visit' (do odwiedzenia).
// Zapis miejsca ze swipera/trasy/wizytowki trafia do listy jednej z tych kategorii.

export type ListStatus = "visited" | "to_visit";

export interface PlaceForList {
  place_name: string;
  category: string | null;
  address: string | null;
  description?: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  place_id: string | null;
  google_place_id?: string | null;
  rating?: number | null;
}

export interface UserList {
  id: string;
  title: string;
  city: string | null;
  list_status: ListStatus;
  count: number;
  cover: string | null;
  place_names: string[];
}

export interface ListAuthor { name: string; avatar: string | null }

const skey = (s: string) => String(s ?? "").trim().toLowerCase();

// Wszystkie listy usera (obie kategorie) + liczba pozycji + okladka + nazwy miejsc.
export async function fetchUserLists(userId: string): Promise<UserList[]> {
  const { data: cols } = await (supabase as any)
    .from("discovery_collections")
    .select("id, title, city, list_status, list_cover_url, cover_url")
    .eq("user_id", userId)
    .eq("kind", "ranking")
    .order("updated_at", { ascending: false });
  const rows = (cols ?? []) as any[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: items } = await (supabase as any)
    .from("discovery_items")
    .select("collection_id, place_name, photo_url, order_index")
    .in("collection_id", ids)
    .order("order_index", { ascending: true });
  const byList: Record<string, any[]> = {};
  for (const it of items ?? []) (byList[it.collection_id] ??= []).push(it);
  return rows.map((r) => {
    const its = byList[r.id] ?? [];
    return {
      id: r.id,
      title: r.title,
      city: r.city,
      list_status: (r.list_status === "visited" ? "visited" : "to_visit") as ListStatus,
      count: its.length,
      cover: r.list_cover_url ?? r.cover_url ?? its.find((i: any) => i.photo_url)?.photo_url ?? null,
      place_names: its.map((i: any) => i.place_name),
    };
  });
}

export function listHasPlace(list: UserList, placeName: string): boolean {
  return list.place_names.some((n) => skey(n) === skey(placeName));
}

// Zbior znormalizowanych nazw WSZYSTKICH miejsc zapisanych przez usera (w dowolnej liscie).
// Do wskazania stanu "zapisane" na ikonie bookmark (karta/wiersz trasy/wizytowka).
export async function fetchSavedPlaceNames(userId: string): Promise<Set<string>> {
  const { data: cols } = await (supabase as any)
    .from("discovery_collections").select("id").eq("user_id", userId).eq("kind", "ranking");
  const ids = (cols ?? []).map((c: any) => c.id);
  if (!ids.length) return new Set();
  const { data: items } = await (supabase as any)
    .from("discovery_items").select("place_name").in("collection_id", ids);
  return new Set((items ?? []).map((i: any) => skey(i.place_name)).filter(Boolean));
}

export const normalizePlaceName = skey;

export interface SavedPlace {
  id: string;              // discovery_items.id (do usuniecia)
  collection_id: string;
  place_name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  google_place_id: string | null;
  rating: number | null;
  photo_url: string | null;
  short_desc: string | null;
  city: string | null;     // z listy (per-miasto)
}

// Plaska lista PRYWATNYCH zapisanych miejsc usera - agregat pozycji ze WSZYSTKICH list to_visit.
// Do segmentu Zapisane→Miejsca (user mysli "pojedyncze miejsca", nie listy). Dedup po nazwie.
export async function fetchSavedPlaces(userId: string): Promise<SavedPlace[]> {
  const { data: cols } = await (supabase as any)
    .from("discovery_collections")
    .select("id, city").eq("user_id", userId).eq("kind", "ranking").eq("list_status", "to_visit");
  const rows = (cols ?? []) as any[];
  if (!rows.length) return [];
  const cityByList: Record<string, string | null> = {};
  for (const c of rows) cityByList[c.id] = c.city ?? null;
  const { data: items } = await (supabase as any)
    .from("discovery_items")
    .select("id, collection_id, place_name, category, address, latitude, longitude, place_id, google_place_id, rating, photo_url, short_desc, order_index")
    .in("collection_id", rows.map((r) => r.id))
    .order("order_index", { ascending: false });
  const seen = new Set<string>();
  const out: SavedPlace[] = [];
  for (const it of (items ?? []) as any[]) {
    const k = skey(it.place_name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: it.id, collection_id: it.collection_id, place_name: it.place_name, category: it.category,
      address: it.address, latitude: it.latitude, longitude: it.longitude, place_id: it.place_id,
      google_place_id: it.google_place_id, rating: it.rating, photo_url: it.photo_url,
      short_desc: it.short_desc, city: cityByList[it.collection_id] ?? null,
    });
  }
  return out;
}

// Usun zapisane miejsce po id pozycji (discovery_items.id).
export async function removeSavedPlaceById(itemId: string): Promise<void> {
  await (supabase as any).from("discovery_items").delete().eq("id", itemId);
}

// Dodaj miejsce do listy (discovery_items). Dedup po nazwie. Zwraca false gdy juz bylo.
export async function addPlaceToList(listId: string, place: PlaceForList): Promise<boolean> {
  const { data: existing } = await (supabase as any)
    .from("discovery_items").select("order_index, place_name").eq("collection_id", listId);
  const rows = (existing ?? []) as any[];
  if (rows.some((r) => skey(r.place_name) === skey(place.place_name))) return false;
  const maxOrder = rows.reduce((m: number, r: any) => Math.max(m, r.order_index ?? -1), -1);
  const { error } = await (supabase as any).from("discovery_items").insert({
    collection_id: listId,
    place_name: place.place_name,
    category: place.category,
    address: place.address,
    short_desc: place.description ?? "",
    latitude: place.latitude,
    longitude: place.longitude,
    place_id: place.place_id,
    google_place_id: place.google_place_id ?? null,
    rating: place.rating ?? null,
    photo_url: place.photo_url,
    order_index: maxOrder + 1,
  });
  if (error) throw error;
  await (supabase as any).from("discovery_collections").update({ updated_at: new Date().toISOString() }).eq("id", listId);
  return true;
}

// Usun miejsce z listy (po nazwie). Escape %/_ - inaczej nazwa typu "Cafe 100%" traktowana jako
// wzorzec LIKE i moze skasowac WIECEJ pozycji (silent data loss).
export async function removePlaceFromList(listId: string, placeName: string): Promise<void> {
  const safe = String(placeName ?? "").replace(/[\\%_]/g, (m) => "\\" + m);
  await (supabase as any).from("discovery_items").delete().eq("collection_id", listId).ilike("place_name", safe);
}

// Utworz nowa liste danej kategorii z pierwszym miejscem.
// Widocznosc z INTENCJI: visited = publiczna polecajka (moderacja pending); to_visit = PRYWATNA
// wishlista "Do zobaczenia" (is_public=false + approved -> poza kolejka moderacji, nigdy publiczna).
export async function createListWithPlace(
  userId: string, title: string, listStatus: ListStatus, city: string | null, place: PlaceForList, author?: ListAuthor,
  isPublicOverride?: boolean,
): Promise<string | null> {
  const isRecommend = listStatus === "visited";
  // Kuratorska lista (visited) jest ZAWSZE publiczna (decyzja 2026-08-24: brak opcji "prywatna",
  // rozwoj bazy discovery). to_visit (wishlista "Do zobaczenia") zostaje prywatna; isPublicOverride
  // respektowany tylko dla to_visit (w praktyce zawsze false).
  const isPublic = isRecommend ? true : !!isPublicOverride;
  const { data: col, error } = await (supabase as any)
    .from("discovery_collections")
    .insert({
      user_id: userId,
      title: title || (isRecommend ? "Odwiedzone miejsca" : "Do zobaczenia"),
      city: city || null,
      kind: "ranking",
      list_status: listStatus,
      is_public: isPublic,
      moderation_status: isPublic ? "pending" : "approved",
      author_name: author?.name ?? "Użytkownik",
      author_avatar: author?.avatar ?? null,
    })
    .select("id")
    .single();
  if (error || !col) { console.error("[placeLists] create list failed:", error?.message ?? error); return null; }
  await addPlaceToList(col.id, place);
  return col.id as string;
}

// Utworz kuratorska liste (polecajke) z wybranych ZAPISANYCH miejsc jednym insertem.
// is_public NIEZALEZNE od list_status: Publiczna = is_public true + moderacja pending;
// Prywatna = is_public false + approved (kuratorska prywatna lista, owner-only przez RLS).
// Oba warianty to list_status='visited' (kuratorska lista, nie wishlista to_visit).
export async function createListFromSavedPlaces(
  userId: string,
  opts: { title: string; isPublic: boolean; places: PlaceForList[]; author?: ListAuthor },
): Promise<string | null> {
  const { title, isPublic, places, author } = opts;
  const { data: col, error } = await (supabase as any)
    .from("discovery_collections")
    .insert({
      user_id: userId,
      title: title.trim() || "Nowa lista",
      city: null,
      kind: "ranking",
      list_status: "visited",
      is_public: isPublic,
      moderation_status: isPublic ? "pending" : "approved",
      author_name: author?.name ?? "Użytkownik",
      author_avatar: author?.avatar ?? null,
      cover_url: null,
      list_cover_url: null,
    })
    .select("id")
    .single();
  if (error || !col) { console.error("[placeLists] createListFromSavedPlaces failed:", error?.message ?? error); return null; }
  const listId = col.id as string;
  // Batch insert pozycji (dedup po nazwie, kolejnosc = kolejnosc zaznaczenia).
  const seen = new Set<string>();
  const rows = places
    .filter((p) => { const k = skey(p.place_name); if (!k || seen.has(k)) return false; seen.add(k); return true; })
    .map((p, i) => ({
      collection_id: listId, place_name: p.place_name, category: p.category, address: p.address,
      short_desc: p.description ?? "", latitude: p.latitude, longitude: p.longitude, place_id: p.place_id,
      google_place_id: p.google_place_id ?? null, rating: p.rating ?? null, photo_url: p.photo_url, order_index: i,
    }));
  if (rows.length) {
    const { error: itemsErr } = await (supabase as any).from("discovery_items").insert(rows);
    if (itemsErr) {
      // Nie zostawiaj pustej (osieroconej) listy - skasuj kolekcje i zglos blad callerowi.
      console.error("[placeLists] createListFromSavedPlaces items failed:", itemsErr.message);
      await (supabase as any).from("discovery_collections").delete().eq("id", listId);
      return null;
    }
  }
  // Publiczna -> powiadom admina do moderacji (best-effort, nie blokuj flow).
  if (isPublic) {
    supabase.functions.invoke("notify-admin-content", {
      body: { type: "ranking", title: title.trim(), city: null, collection_id: listId, author: author?.name ?? "Użytkownik" },
    }).catch((e) => console.warn("[placeLists] notify-admin-content failed:", e));
  }
  return listId;
}

// Prywatna wishlista "Do zobaczenia" (to_visit, is_public=false) usera - PER MIASTO.
// Per-miasto, bo podpowiedzi przy tworzeniu trasy (ComposeWyjazd #5) filtrują po mieście listy.
// Zapisane→Miejsca agreguje je płasko, więc user i tak widzi jeden schowek "Miejsca".
export async function ensureToVisitList(userId: string, city: string | null, author?: ListAuthor): Promise<string | null> {
  const base = (supabase as any)
    .from("discovery_collections")
    .select("id").eq("user_id", userId).eq("kind", "ranking").eq("list_status", "to_visit");
  const scoped = city ? base.eq("city", city) : base.is("city", null);
  const { data } = await scoped.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: col } = await (supabase as any).from("discovery_collections").insert({
    user_id: userId, title: "Do zobaczenia", city: city || null, kind: "ranking",
    list_status: "to_visit", is_public: false, moderation_status: "approved",
    author_name: author?.name ?? "Użytkownik", author_avatar: author?.avatar ?? null,
  }).select("id").single();
  return col?.id ?? null;
}

// Zapis 1-tap: dodaj miejsce do prywatnej "Do zobaczenia" (tworzy listę per-miasto gdy brak).
// Dedup po nazwie w addPlaceToList. Zwraca listId + czy faktycznie dodano (false gdy już było).
export async function quickSavePlace(
  userId: string, place: PlaceForList, city: string | null, author?: ListAuthor,
): Promise<{ listId: string | null; added: boolean }> {
  const listId = await ensureToVisitList(userId, city, author);
  if (!listId) return { listId: null, added: false };
  const added = await addPlaceToList(listId, place);
  return { listId, added };
}

// (Usunięto ensureVisitedList + moveToVisited: retirowany cykl "#4" auto-move do-odwiedzenia
// -> Odwiedzone. Po rozdzieleniu intencji visited=publiczna polecajka, prywatna wishlista NIE
// może auto-trafiać do publicznej listy. Odwiedzenie miejsca != chęć polecenia. Polecanie =
// świadomy bookmark "Dodaj do polecajki" w SavePlaceSheet.)
