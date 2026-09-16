import { supabase } from "@/integrations/supabase/client";

// ILE OSOB WYROZNILO LOKAL gwiazdka "topki" (prosba Nat 2026-09-16, wizytowki premium).
//
// Gwiazdka zyje w `pins.is_top` (wyjazdy) i `discovery_items.is_top` (kolekcje), a RLS nie
// pozwoliloby zwyklemu userowi policzyc cudzych wierszy - stad waski SECDEF RPC
// `place_star_count` (migracja 20260916i), ktory oddaje SAMA LICZBE, bez tozsamosci.
//
// ⛔ Licznik obejmuje WYLACZNIE tresc publiczna (wyjazdy opublikowane, kolekcje publiczne).
// Bywa przez to MNIEJSZY niz suma gwiazdek, ktora wlasciciel widzi u siebie na profilu -
// i tak ma byc: gwiazdka w prywatnym szkicu jest prywatna.

export const placeStarsKey = (placeName: string | null | undefined) =>
  ["place-stars", (placeName ?? "").trim().toLowerCase()] as const;

export async function fetchPlaceStarCount(placeName: string): Promise<number> {
  const name = placeName?.trim();
  if (!name) return 0;
  const { data, error } = await (supabase as any).rpc("place_star_count", { p_name: name });
  if (error) { console.warn("[placeStars] count:", error.message); return 0; }
  return Number(data ?? 0) || 0;
}
