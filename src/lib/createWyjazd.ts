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

// Czy URL zdjecia jest ZE ZRODLA WLASNEGO (nie Google). Legalne okladki: zdjecia userow
// (bucket route-images) i wlasne zdjecia B2B (business-photos). ZAKAZ Google Places jako
// okladka - odrzucamy cache Google (place-photos-cache), proxy zdjec (/api/place-photo)
// i bezposrednie hosty Google.
function isOwnPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  return !/place-photos-cache|\/api\/place-photo|maps\.googleapis|places\.googleapis|googleusercontent/i.test(url);
}

// Wybor okladki miniatury (list_cover_url) WYLACZNIE ze zdjec wlasnych/userow (bez Google).
// Priorytet: zdjecie wlasne przekazane wprost z pinu. Fallback: zdjecie tego samego miejsca
// z innego pinu (np. inny user wgral zdjecie z trasy / lokal B2B). Gdy nie ma zadnego wlasnego
// zdjecia -> null; trasa dostanie okladke dopiero po wgraniu zdjec usera w ReviewSummary
// (ensureListCover). Google Places NIE jest zrodlem okladek (reguła "ZERO Google").
async function pickCoverPhoto(places: WyjazdPlaceInput[]): Promise<string | null> {
  const direct = places.find((p) => isOwnPhoto(p.photo_url))?.photo_url;
  if (direct) return direct;
  const names = [...new Set(places.map((p) => p.place_name).filter(Boolean))];
  if (!names.length) return null;
  try {
    // Zdjecia tych samych miejsc z innych pinow - bierzemy tylko wlasne/userow (isOwnPhoto).
    const { data: pinRows } = await (supabase as any).from("pins").select("photo_url")
      .in("place_name", names).not("photo_url", "is", null).limit(30);
    const own = (pinRows ?? []).map((r: any) => r.photo_url).find((u: string) => isOwnPhoto(u));
    if (own) return own as string;
  } catch (e) {
    console.warn("[createWyjazd] pickCoverPhoto failed:", (e as any)?.message ?? e);
  }
  return null;
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
  // Odrzuc miejsca bez nazwy - place_name jest NOT NULL w pins, a jeden bledny rekord
  // wywalal CALY batch insert (0 pinow, cicha PUSTA trasa mimo "sukcesu"). Lepiej pominac
  // zly rekord niz stworzyc pusta trase.
  places = places.filter((p) => p.place_name && String(p.place_name).trim());
  if (!places.length) {
    console.error("[createWyjazd] brak poprawnych miejsc (place_name) - nie tworze pustej trasy");
    return null;
  }
  // list_cover_url = miniatura w eksploracji. Feed (DiscoveryFeed) wymaga
  // list_cover_url NOT NULL, inaczej trasa jest niewidoczna. Zasilamy ja od razu
  // pierwszym dostepnym zdjeciem miejsca, zeby swiezo utworzona trasa trafila do
  // eksploracji bez koniecznosci recznego ustawiania okladki w ReviewSummary.
  const firstPhoto = await pickCoverPhoto(places);
  const { data: route, error } = await (supabase as any)
    .from("routes")
    .insert({
      user_id: userId,
      title: title || city || "Wyjazd",
      city: city || null,
      trip_type: "planning",
      status: "draft",
      day_number: 1,
      // Trasa SOLO powstaje jako PRYWATNY draft (is_shared=false). Publikacja do eksploracji =
      // swiadomy krok "Zapisz trase" w ReviewSummary (finishEditing ustawia is_shared=true).
      // Dzieki temu praca w toku NIE jest publiczna zanim user ja skonczy (2026-08-10).
      // Zgodne z RLS (wlasciciel czyta swoje niezaleznie od is_shared), StartWyjazd "Robocze"
      // (pyta o is_shared=false) i DEFAULT kolumny (false).
      // WYJATEK: trasa GRUPOWA zostaje is_shared=true - inaczej zaproszeni czlonkowie (nie-wlasciciele)
      // nie przeczytaja jej przez RLS (routes SELECT = status='published' OR user_id OR is_shared;
      // brak polityki czlonkostwa grupy). Docelowo: polityka group_session_members -> wtedy tez false.
      is_shared: !!opts?.groupSessionId,
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
    if (pinsErr) {
      // KRYTYCZNE: piny sie nie wstawily -> trasa bylaby PUSTA a mimo to publiczna (is_shared).
      // Usun osierocona trase i zglos blad (confirm() pokaze toast), zamiast zostawic pusta
      // trase w feedzie. (bug 2026-08-10: pusta trasa opublikowana w eksploracji)
      console.error("[createWyjazd] pins insert failed - usuwam osierocona pusta trase:", pinsErr.message);
      await (supabase as any).from("routes").delete().eq("id", route.id);
      return null;
    }
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
  places = dedupePlaces(places).filter((p) => p.place_name && String(p.place_name).trim());
  // SAFETY: pusta lista miejsc = prawie zawsze race/blad stanu (np. draft nie doladowal sie).
  // NIE kasuj wszystkich pinow do zera (delete+reinsert ponizej) - to prowadzilo do pustej
  // trasy. Aktualizuj tylko meta i zwroc bez ruszania pinow.
  if (!places.length) {
    console.warn("[updateWyjazd] pusta lista miejsc - pomijam podmiane pinow (ochrona przed pusta trasa)");
    await (supabase as any).from("routes").update({
      title: title || city || "Wyjazd",
      city: city || null,
      start_date: dates?.start_date ?? null,
      end_date: dates?.end_date ?? null,
    }).eq("id", routeId);
    return routeId;
  }
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
  // Pelne piny PRZED delete - do zachowania zdjec ORAZ do ROLLBACKU gdy reinsert padnie.
  const { data: existingPins } = await (supabase as any)
    .from("pins").select("route_id, place_name, address, description, category, latitude, longitude, place_id, suggested_time, pin_order, photo_url, images, user_photo_urls, image_url, photo_cached_at, original_creator_id")
    .eq("route_id", routeId);
  rememberPhotos(existingPins);
  const { data: backupPins } = await (supabase as any)
    .from("pin_photo_backup").select("place_id, place_name, images, user_photo_urls, image_url, photo_url")
    .eq("route_id", routeId);
  rememberPhotos(backupPins); // fallback (nie nadpisuje - live ma priorytet przez has-check)
  const photosFor = (p: WyjazdPlaceInput) =>
    (p.place_id && photoByKey.get(`id:${p.place_id}`)) || photoByKey.get(`nm:${normKey(p.place_name)}`) || null;

  // Podmiana pinow z zachowaniem zdjec usera. Wiersze buduje JS (merge zdjec ze starych/backupu),
  // a ATOMOWA podmiana (delete+insert) idzie przez RPC replace_route_pins - jedna transakcja.
  // Gdy insert padnie (np. constraint), CALA operacja sie wycofuje -> stare piny nietkniete.
  // (prewencja krytycznego buga 2026-08-13: delete przechodzil, reinsert padal -> UTRATA miejsc)
  const rows = places.map((p, idx) => {
    const old = photosFor(p);
    return {
      place_name: p.place_name,
      address: p.address ?? "",                 // NOT NULL
      description: p.description ?? null,
      category: p.category || "other",
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      place_id: p.place_id ?? null,
      suggested_time: null,
      pin_order: idx,
      photo_url: p.photo_url ?? old?.photo_url ?? null,
      images: old?.images ?? [],                // NOT NULL (default [])
      user_photo_urls: old?.user_photo_urls ?? [], // NOT NULL (default [])
      image_url: old?.image_url ?? null,
      photo_cached_at: old?.photo_cached_at ?? null,
      original_creator_id: (old as any)?.original_creator_id ?? null,
    };
  });
  const { error: rpcErr } = await (supabase as any).rpc("replace_route_pins", { p_route_id: routeId, p_pins: rows });
  if (rpcErr) {
    // Transakcja RPC wycofana - piny sprzed edycji ZOSTAJA nietkniete. Sygnal bledu -> confirm()
    // pokaze toast "Nie udalo sie zapisac zmian".
    console.error("[updateWyjazd] replace_route_pins failed (piny nietkniete):", rpcErr.message);
    return null;
  }
  return routeId;
}
