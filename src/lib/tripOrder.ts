import { supabase } from "@/integrations/supabase/client";

// Wlasny uklad okladek na profilu (prosba Nat 2026-09-11): kolejnosc opublikowanych wyjazdow,
// ktora user ustawia przytrzymaniem i przeciagnieciem kafelka na siatce Wspomnien.
//
// Tabela `profile_trip_order` = jedna tablica id na usera (migracja 20260911i). Kolejnosc jest
// czescia WIZERUNKU profilu, wiec ta sama funkcja porzadkuje wlasny profil i profil publiczny.
//
// Wyjazd spoza tablicy (swiezo opublikowany, zanim user cokolwiek przestawil) idzie NA POCZATEK
// w kolejnosci wejsciowej (najnowsze pierwsze) - user widzi go od razu, a przy nastepnym
// przestawieniu zapisuje sie caly uklad razem z nim. Id wyjazdu, ktorego juz nie ma, jest
// po prostu pomijane; tablicy nie trzeba czyscic przy usuwaniu.

export const tripOrderKey = (userId: string | undefined) => ["profile-trip-order", userId] as const;

export async function fetchTripOrder(userId: string): Promise<string[]> {
  // (supabase as any): types.ts nie zna jeszcze tabeli (regen typow = osobny projekt, CLAUDE.md).
  const { data, error } = await (supabase as any)
    .from("profile_trip_order").select("route_ids").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.route_ids) ? (data.route_ids as string[]) : [];
}

export async function saveTripOrder(userId: string, routeIds: string[]): Promise<void> {
  const { error } = await (supabase as any)
    .from("profile_trip_order")
    .upsert({ user_id: userId, route_ids: routeIds, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Uklada karty wyjazdow wedlug zapisanej kolejnosci; nieznane (nowe) na poczatku, bez zmiany ich porzadku. */
export function applyTripOrder<T extends { id: string }>(trips: readonly T[], order: readonly string[] | undefined): T[] {
  if (!order || order.length === 0 || trips.length === 0) return trips.slice();
  const pos = new Map<string, number>();
  order.forEach((id, i) => { if (!pos.has(id)) pos.set(id, i); });
  const fresh: T[] = [];
  const known: T[] = [];
  for (const tr of trips) (pos.has(tr.id) ? known : fresh).push(tr);
  known.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return [...fresh, ...known];
}
