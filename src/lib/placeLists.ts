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

// Usun miejsce z listy (po nazwie).
export async function removePlaceFromList(listId: string, placeName: string): Promise<void> {
  await (supabase as any).from("discovery_items").delete().eq("collection_id", listId).ilike("place_name", placeName);
}

// Utworz nowa liste danej kategorii z pierwszym miejscem. Wszystkie listy publiczne (moderacja pending).
export async function createListWithPlace(
  userId: string, title: string, listStatus: ListStatus, city: string | null, place: PlaceForList, author?: ListAuthor,
): Promise<string | null> {
  const { data: col, error } = await (supabase as any)
    .from("discovery_collections")
    .insert({
      user_id: userId,
      title: title || (listStatus === "visited" ? "Odwiedzone miejsca" : "Do odwiedzenia"),
      city: city || null,
      kind: "ranking",
      list_status: listStatus,
      is_public: true,
      moderation_status: "pending",
      author_name: author?.name ?? "Użytkownik",
      author_avatar: author?.avatar ?? null,
    })
    .select("id")
    .single();
  if (error || !col) { console.error("[placeLists] create list failed:", error?.message ?? error); return null; }
  await addPlaceToList(col.id, place);
  return col.id as string;
}

// #4: znajdz albo utworz domyslna liste "Odwiedzone miejsca" (visited) usera.
export async function ensureVisitedList(userId: string, city: string | null, author?: ListAuthor): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("discovery_collections")
    .select("id").eq("user_id", userId).eq("kind", "ranking").eq("list_status", "visited")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: col } = await (supabase as any).from("discovery_collections").insert({
    user_id: userId, title: "Odwiedzone miejsca", city: city || null, kind: "ranking",
    list_status: "visited", is_public: true, moderation_status: "pending",
    author_name: author?.name ?? "Użytkownik", author_avatar: author?.avatar ?? null,
  }).select("id").single();
  return col?.id ?? null;
}

// #4: przenies miejsca (po nazwie) z list 'do odwiedzenia' usera do domyslnej listy 'Odwiedzone'.
// Wolane po publikacji trasy zlozonej z miejsc z wishlisty.
export async function moveToVisited(userId: string, placeNames: string[], city: string | null, author?: ListAuthor): Promise<void> {
  const names = new Set(placeNames.map(skey));
  if (!names.size) return;
  // Pozycje w listach 'do odwiedzenia' usera pasujace po nazwie.
  const { data: lists } = await (supabase as any)
    .from("discovery_collections").select("id").eq("user_id", userId).eq("kind", "ranking").eq("list_status", "to_visit");
  const listIds = (lists ?? []).map((l: any) => l.id);
  if (!listIds.length) return;
  const { data: items } = await (supabase as any)
    .from("discovery_items")
    .select("id, collection_id, place_name, category, address, latitude, longitude, place_id, google_place_id, rating, photo_url, short_desc")
    .in("collection_id", listIds);
  const matching = (items ?? []).filter((it: any) => names.has(skey(it.place_name)));
  if (!matching.length) return;
  const visitedListId = await ensureVisitedList(userId, city, author);
  if (!visitedListId) return;
  for (const it of matching) {
    const added = await addPlaceToList(visitedListId, {
      place_name: it.place_name, category: it.category, address: it.address, description: it.short_desc,
      latitude: it.latitude, longitude: it.longitude, place_id: it.place_id,
      google_place_id: it.google_place_id, rating: it.rating, photo_url: it.photo_url,
    });
    // Usun z listy 'do odwiedzenia' niezaleznie (added=false gdy juz byl w odwiedzonych).
    void added;
    await (supabase as any).from("discovery_items").delete().eq("id", it.id);
  }
}
