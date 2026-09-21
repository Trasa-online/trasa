// Gwiazdki („wyroznienia") przy miejscach PLANU PER UCZESTNIK (2026-09-21, migracja
// `20260921_pin_stars`). Lustro `collectionStars.ts`: jeden wiersz na (plan, user, miejsce),
// klucz miejsca = znormalizowana nazwa (`place_note_key`).
// `pins.is_top` znaczy odtad „gwiazdka WLASCICIELA" i utrzymuje je trigger - klient (takze
// wlasciciel) pisze WYLACZNIE tutaj. Do 21.09 uczestnik przelaczal `pins.is_top` wprost
// i jego gwiazdka ladowala na profilu autora planu (zgloszenie Nat).
import { supabase } from "@/integrations/supabase/client";

export type TripStar = { user_id: string; place_name: string };

export const tripStarsKey = (routeId: string | null | undefined) => ["trip-stars", routeId ?? ""];

export const tripStarKey = (name: string | null | undefined) => String(name ?? "").trim().toLowerCase();

export async function fetchTripStars(routeId: string): Promise<TripStar[]> {
  const { data, error } = await (supabase as any)
    .from("pin_stars").select("user_id, place_name").eq("route_id", routeId);
  if (error) { console.warn("[tripStars] fetch:", error.message); return []; }
  return (data ?? []) as TripStar[];
}

export async function setTripStar(routeId: string, userId: string, placeName: string, on: boolean): Promise<boolean> {
  if (on) {
    // Indeks unikalny jest FUNKCYJNY (place_note_key), wiec `upsert(onConflict)` nie ma czego
    // wskazac - duplikat (23505) traktujemy jak sukces: gwiazdka juz stoi.
    const { error } = await (supabase as any).from("pin_stars")
      .insert({ route_id: routeId, user_id: userId, place_name: placeName });
    if (error && error.code !== "23505") { console.warn("[tripStars] set:", error.message); return false; }
    return true;
  }
  const safe = placeName.replace(/[\\%_]/g, (m: string) => "\\" + m);
  const { error } = await (supabase as any).from("pin_stars")
    .delete().eq("route_id", routeId).eq("user_id", userId).ilike("place_name", safe);
  if (error) { console.warn("[tripStars] unset:", error.message); return false; }
  return true;
}
