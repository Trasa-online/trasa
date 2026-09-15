// Wlasciciel z KILKOMA lokalami (2026-09-15).
//
// Baza pozwalala na to od poczatku (`owner_user_id` nigdy nie byl unikalny), ale aplikacja
// zakladala jeden lokal na konto: redirect po zalogowaniu czytal wizytowke przez
// `.maybeSingle()`, a to przy DWOCH wierszach zwraca blad, nie wiersz - wlasciciel dwoch
// lokali nie trafial do panelu w ogole. Tutaj mieszka cala logika "ktory lokal otworzyc".
import { supabase } from "@/integrations/supabase/client";

export interface OwnedVenue {
  id: string;
  place_id: string | null;
  business_name: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  is_draft: boolean | null;
  is_active: boolean | null;
  moderation_status: string | null;
  plan: string | null;
  created_at: string;
}

const LAST_VENUE_KEY = "spontaway_biz_last_venue";

/** Klucz w adresie panelu: `place_id`, gdy jest, inaczej id wizytowki (tak samo jak /biznes/:id). */
export const venueKey = (v: Pick<OwnedVenue, "id" | "place_id">) => v.place_id ?? v.id;

export async function fetchMyVenues(): Promise<OwnedVenue[]> {
  const { data, error } = await (supabase as any).rpc("my_business_profiles");
  if (error) { console.warn("[businessVenues] my_business_profiles:", error.message); return []; }
  return (data ?? []) as OwnedVenue[];
}

export function rememberVenue(key: string) {
  try { localStorage.setItem(LAST_VENUE_KEY, key); } catch { /* prywatne okno */ }
}

export function lastVenue(): string | null {
  try { return localStorage.getItem(LAST_VENUE_KEY); } catch { return null; }
}

/**
 * Ktory lokal otworzyc po zalogowaniu:
 * 1. ten, w ktorym wlasciciel byl ostatnio (o ile nadal do niego nalezy),
 * 2. pierwszy NIE-szkic - szkic to lokal, ktorego nikt jeszcze nie dokonczyl,
 * 3. cokolwiek, byle nie pusty ekran.
 */
export function pickVenue(venues: OwnedVenue[]): OwnedVenue | null {
  if (venues.length === 0) return null;
  const last = lastVenue();
  const remembered = last ? venues.find((v) => venueKey(v) === last) : null;
  if (remembered) return remembered;
  return venues.find((v) => !v.is_draft) ?? venues[0];
}

/** Dolozenie kolejnego lokalu. Zwraca id nowej wizytowki. */
export async function createVenue(name: string, phone?: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("create_additional_business", {
    p_name: name,
    p_phone: phone || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
