import { supabase } from "@/integrations/supabase/client";

// Dedup miejsc po znormalizowanym kluczu (place_id albo place_name). Zabezpiecza przed
// duplikatami pinow w trasie niezaleznie od tego, ile razy user wraca do etapu dodawania.
function dedupePlaces(places: WyjazdPlaceInput[]): WyjazdPlaceInput[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    const k = String(p.place_id || p.place_name || "").toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Tryb uproszczony: tworzenie prostego wyjazdu (routes) z podanego zestawu miejsc (pins),
// BEZ planowania/AI/timeline. Reuzywa ten sam substrat co reszta appki. Zwraca id nowego
// wyjazdu albo null (gdy insert routes zawiedzie).

export interface WyjazdPlaceInput {
  place_name: string;
  category?: string | null;
  address?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  place_id?: string | null;
}

export async function createWyjazdFromPlaces(
  userId: string,
  city: string | null,
  title: string,
  places: WyjazdPlaceInput[],
  dates?: { start_date?: string | null; end_date?: string | null },
  opts?: { groupSessionId?: string | null; newForUsers?: string[] },
): Promise<string | null> {
  places = dedupePlaces(places);
  // list_cover_url = miniatura w eksploracji. Feed (DiscoveryFeed) wymaga
  // list_cover_url NOT NULL, inaczej trasa jest niewidoczna. Zasilamy ja od razu
  // pierwszym dostepnym zdjeciem miejsca, zeby swiezo utworzona trasa trafila do
  // eksploracji bez koniecznosci recznego ustawiania okladki w ReviewSummary.
  // (Gdy zaden pin nie ma zdjecia -> null; ensureListCover/manualny pick uzupelni pozniej.)
  const firstPhoto = places.find((p) => p.photo_url)?.photo_url ?? null;
  const { data: route, error } = await (supabase as any)
    .from("routes")
    .insert({
      user_id: userId,
      title: title || city || "Wyjazd",
      city: city || null,
      trip_type: "planning",
      status: "draft",
      day_number: 1,
      // Wszystkie nowe trasy sa PUBLICZNE by default (2026-07-30) - trafiaja do eksploracji.
      is_shared: true,
      list_cover_url: firstPhoto,
      start_date: dates?.start_date ?? null,
      end_date: dates?.end_date ?? null,
      // Wyjazd grupowy: wiaze wpis z sesja (widoczny u pozostalych czlonkow przez
      // group_session_members join w dzienniku) + oznacza im "Nowa trasa!" badge.
      group_session_id: opts?.groupSessionId ?? null,
      new_for_users: opts?.newForUsers ?? null,
    })
    .select("id")
    .single();
  if (error || !route) {
    console.error("[createWyjazd] route insert failed:", error?.message ?? error);
    return null;
  }
  const rows = places.map((p, idx) => ({
    route_id: route.id,
    place_name: p.place_name,
    address: p.address ?? null,
    description: p.description ?? null,
    category: p.category || "other",
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    place_id: p.place_id ?? null,
    suggested_time: null,
    photo_url: p.photo_url ?? null,
    pin_order: idx,
    original_creator_id: userId,
  }));
  if (rows.length) {
    const { error: pinsErr } = await (supabase as any).from("pins").insert(rows);
    if (pinsErr) console.warn("[createWyjazd] pins insert failed:", pinsErr.message);
  }
  return route.id as string;
}

// Aktualizacja ISTNIEJACEJ trasy roboczej (edycja szkicu z ekranu wyboru bazy) - NIE tworzy
// duplikatu. Nadpisuje meta (tytul/miasto/daty) i podmienia wszystkie piny (kolejnosc = pin_order).
export async function updateWyjazdPlaces(
  routeId: string,
  city: string | null,
  title: string,
  places: WyjazdPlaceInput[],
  dates?: { start_date?: string | null; end_date?: string | null },
): Promise<string | null> {
  places = dedupePlaces(places);
  const { error: updErr } = await (supabase as any)
    .from("routes")
    .update({
      title: title || city || "Wyjazd",
      city: city || null,
      start_date: dates?.start_date ?? null,
      end_date: dates?.end_date ?? null,
    })
    .eq("id", routeId);
  if (updErr) {
    console.error("[updateWyjazd] route update failed:", updErr.message);
    return null;
  }
  // KRYTYCZNE: zachowaj ZDJECIA USEROW przez delete+reinsert. Piny trzymaja zdjecia w
  // images / user_photo_urls / image_url / photo_url - to ZRODLO zdjec miejsc w eksploracji.
  // Bez tego edycja trasy kasowala wszystkie zdjecia przypisane do miejsc (bug 2026-08).
  // 1) Czytamy istniejace piny (zdjecia) PRZED delete. 2) Fallback: pin_photo_backup (trigger
  //    kopiuje przy kazdym delete) - ratuje gdy live piny juz byly wyczyszczone.
  const normKey = (s: string | null | undefined) => String(s ?? "").toLowerCase().trim();
  const photoByKey = new Map<string, any>();
  const rememberPhotos = (rowsIn: any[]) => {
    for (const ep of rowsIn ?? []) {
      const hasPhotos = (ep.images?.length) || (ep.user_photo_urls?.length) || ep.image_url || ep.photo_url;
      if (!hasPhotos) continue;
      if (ep.place_id) { if (!photoByKey.has(`id:${ep.place_id}`)) photoByKey.set(`id:${ep.place_id}`, ep); }
      const nk = `nm:${normKey(ep.place_name)}`;
      if (!photoByKey.has(nk)) photoByKey.set(nk, ep);
    }
  };
  const { data: existingPins } = await (supabase as any)
    .from("pins").select("place_id, place_name, images, user_photo_urls, image_url, photo_url, photo_cached_at")
    .eq("route_id", routeId);
  rememberPhotos(existingPins);
  const { data: backupPins } = await (supabase as any)
    .from("pin_photo_backup").select("place_id, place_name, images, user_photo_urls, image_url, photo_url")
    .eq("route_id", routeId);
  rememberPhotos(backupPins); // fallback (nie nadpisuje - live ma priorytet przez has-check)
  const photosFor = (p: WyjazdPlaceInput) =>
    (p.place_id && photoByKey.get(`id:${p.place_id}`)) || photoByKey.get(`nm:${normKey(p.place_name)}`) || null;

  // Podmiana pinow: usun stare, wstaw nowe w aktualnej kolejnosci.
  // KRYTYCZNE: gdy delete zawiedzie (RLS/blad), NIE wstawiaj - inaczej piny sie DUBLUJA.
  const { error: delErr } = await (supabase as any).from("pins").delete().eq("route_id", routeId);
  if (delErr) {
    console.error("[updateWyjazd] pins delete failed (abort, zeby nie dublowac):", delErr.message);
    return null;
  }
  const rows = places.map((p, idx) => {
    const old = photosFor(p);
    return {
      route_id: routeId,
      place_name: p.place_name,
      address: p.address ?? null,
      description: p.description ?? null,
      category: p.category || "other",
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      place_id: p.place_id ?? null,
      suggested_time: null,
      pin_order: idx,
      // Zdjecia usera zachowane z istniejacego pinu / backupu tego samego miejsca.
      photo_url: p.photo_url ?? old?.photo_url ?? null,
      images: old?.images ?? null,
      user_photo_urls: old?.user_photo_urls ?? null,
      image_url: old?.image_url ?? null,
      photo_cached_at: old?.photo_cached_at ?? null,
    };
  });
  if (rows.length) {
    const { error: pinsErr } = await (supabase as any).from("pins").insert(rows);
    if (pinsErr) console.warn("[updateWyjazd] pins insert failed:", pinsErr.message);
  }
  return routeId;
}
