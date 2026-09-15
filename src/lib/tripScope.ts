// Zasieg wyjazdu/listy: KRAJE (2026-09-10), z fallbackiem na stare `city`.
//
// Do 10 wrzesnia wyjazd mial dokladnie jedno miasto i to ono wyznaczalo, czego szuka
// wyszukiwarka miejsc. Realne wyjazdy tak nie wygladaja - "Toskania", "roadtrip po
// Portugalii", weekend Gdansk + Sopot. Od teraz tworzenie pyta o KRAJ (albo kilka),
// a `city` zostaje wylacznie jako dane historyczne ~19 tys. istniejacych wierszy.
//
// Kazde miejsce w kodzie, ktore chce wiedziec "gdzie to jest", pyta o to TUTAJ - dzieki
// temu stare wyjazdy (kraje puste, miasto ustawione) dzialaja bez zmian.

import { countryForCity } from "@/lib/tripCountries";

export type ScopeRow = { countries?: string[] | null; city?: string | null };

/** Kraje wyjazdu/listy. Stary wiersz bez `countries` -> kraj odtworzony z miasta. */
export function scopeCountries(row: ScopeRow | null | undefined): string[] {
  const list = (row?.countries ?? []).filter((c) => typeof c === "string" && c.trim());
  if (list.length) return list;
  return row?.city ? [countryForCity(row.city)] : [];
}

/** Podpis zasiegu na karcie/naglowku: "Polska", "Polska · Czechy", "Polska +2". */
export function scopeLabel(row: ScopeRow | null | undefined, max = 2): string {
  const cs = scopeCountries(row);
  if (!cs.length) return row?.city ?? "";
  if (cs.length <= max) return cs.join(" · ");
  return `${cs.slice(0, max).join(" · ")} +${cs.length - max}`;
}

/** Kontekst dla wyszukiwarki Google: kraje, a gdy ich brak - miasto (stary wyjazd). */
export function searchScope(row: ScopeRow | null | undefined): { countries: string[]; city: string | null } {
  const cs = scopeCountries(row);
  return { countries: cs, city: row?.city ?? null };
}
