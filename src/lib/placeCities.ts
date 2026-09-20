import { supabase } from "@/integrations/supabase/client";
import { TRIP_COUNTRIES } from "@/lib/tripCountries";

// Kraje i miasta DOSTEPNE w wyszukiwarce zakladki "Miejsca" (prosba Nat 2026-09-15).
//
// Lista bierze sie z BAZY, nie z `TRIP_COUNTRIES`: ten drugi zna 90 krajow i setki miast,
// a wizytowki mamy realnie w kilkunastu. Pokazanie pustych miast zamienialoby wybor
// w zgadywanke ("czemu Bergen nic nie ma?"). TRIP_COUNTRIES sluzy tu wylacznie do
// PRZYPISANIA miasta do kraju.
//
// Miasto spoza `TRIP_COUNTRIES` dostaje `country: null` i laduje w grupie "Pozostałe" -
// lepsze to niz wypadniecie z listy, bo takie miejsca istnieja i da sie po nich szukac.

export type PlaceCity = { city: string; country: string | null; count: number };

export const placeCitiesKey = ["place-cities"] as const;

// Miasto -> kraj. "Trójmiasto" to meta-miasto (patrz cities.ts) i w TRIP_COUNTRIES jest,
// ale gdyby wypadlo - i tak trafi do Polski przez ten sam wpis.
const CITY_COUNTRY: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of TRIP_COUNTRIES) for (const city of c.cities) m.set(city.toLowerCase(), c.name);
  return m;
})();

export async function fetchPlaceCities(): Promise<PlaceCity[]> {
  // Same nazwy miast dla aktywnych wizytowek - okolo tysiaca krotkich napisow, wiec liczymy
  // je po stronie klienta zamiast dokladac RPC tylko po `group by`.
  const { data, error } = await (supabase as any).from("places").select("city").eq("is_active", true);
  if (error) { console.warn("[placeCities] fetch:", error.message); return []; }
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { city: string | null }[]) {
    const city = (r.city ?? "").trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count, country: CITY_COUNTRY.get(city.toLowerCase()) ?? null }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "pl"));
}

/** Kraje z liczba wizytowek, od najliczniejszego. `null` (nieznany kraj) zawsze na koncu. */
export function countriesOf(cities: PlaceCity[]): { country: string | null; count: number }[] {
  const m = new Map<string | null, number>();
  for (const c of cities) m.set(c.country, (m.get(c.country) ?? 0) + c.count);
  return [...m.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => (a.country === null ? 1 : b.country === null ? -1 : 0) || b.count - a.count);
}
