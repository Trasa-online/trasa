import { supabase } from "@/integrations/supabase/client";

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
  const { data: route, error } = await (supabase as any)
    .from("routes")
    .insert({
      user_id: userId,
      title: title || city || "Wyjazd",
      city: city || null,
      trip_type: "planning",
      status: "draft",
      day_number: 1,
      is_shared: false,
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
  // Podmiana pinow: usun stare, wstaw nowe w aktualnej kolejnosci.
  await (supabase as any).from("pins").delete().eq("route_id", routeId);
  const rows = places.map((p, idx) => ({
    route_id: routeId,
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
  }));
  if (rows.length) {
    const { error: pinsErr } = await (supabase as any).from("pins").insert(rows);
    if (pinsErr) console.warn("[updateWyjazd] pins insert failed:", pinsErr.message);
  }
  return routeId;
}
