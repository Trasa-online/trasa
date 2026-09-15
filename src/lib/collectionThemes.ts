import i18n from "@/i18n";
// Motywy zestawien (kuratorskich list miejsc). Zamkniete: user wybiera TYLKO z tej
// listy, nie tworzy wlasnych kategorii. Zapisujemy `id` do discovery_collections.category.
// Kolejnosc = kolejnosc wyswietlania w grid wyboru (krok 1 tworzenia zestawienia).

// kind rozdziela dwie formy zestawienia (user wybiera je jako pierwszy krok tworzenia):
//  - "route" = PLAN (kolejnosc miejsc + mapa ma znaczenie). W UI nazywany "Plan".
//  - "list"  = zwykla lista polecanych punktow (bez kolejnosci/planu). W UI "Lista".
// Uwaga: forma jest wyliczana z motywu (ponizej), wiec podzial motywow miedzy Plan/Liste
// = przypisanie `kind` do motywu. Zmiana `kind` motywu zmienia tez jak wyswietlaja sie
// istniejace zestawienia tej kategorii (numeracja + reorder + "Plan na mapie").
export type CollectionKind = "route" | "list";

export interface CollectionTheme {
  id: string;
  emoji: string;
  gradient: string;  // tailwind gradient (from-... to-...) dla kafla motywu - stonowany
  badge: string;     // klasy badge'a motywu (tlo + tekst) dopasowane do koloru motywu
  kind: CollectionKind; // Plan (route) vs Lista miejsc
}

// Podzial motywow miedzy dwie formy (user wybiera Plan/Liste, potem widzi TYLKO motywy tej formy):
//  - Plan (kind: "route")  = okazje/dni ktore planuje sie w kolejnosci (itinerarz + mapa).
//  - Lista (kind: "list")  = "best-of" kolekcje miejsc danego typu (bez kolejnosci).
// Chcesz przeniesc motyw miedzy Plan a Liste -> zmien jego `kind` tutaj (nic wiecej).
export const COLLECTION_THEMES: CollectionTheme[] = [
  { id: "perfect-day", emoji: "🌟", gradient: "from-amber-50 to-orange-100", badge: "bg-amber-100 text-amber-800", kind: "route" },
  { id: "date", emoji: "💕", gradient: "from-rose-50 to-pink-100", badge: "bg-rose-100 text-rose-700", kind: "route" },
  { id: "friends", emoji: "🎉", gradient: "from-violet-50 to-purple-100", badge: "bg-violet-100 text-violet-700", kind: "route" },
  { id: "family", emoji: "👨‍👩‍👧", gradient: "from-sky-50 to-blue-100", badge: "bg-sky-100 text-sky-700", kind: "route" },
  { id: "rainy", emoji: "🌧️", gradient: "from-slate-50 to-sky-100", badge: "bg-slate-200 text-slate-700", kind: "route" },
  { id: "foodie", emoji: "🍜", gradient: "from-orange-50 to-amber-100", badge: "bg-orange-100 text-orange-700", kind: "list" },
  { id: "nightlife", emoji: "🌙", gradient: "from-indigo-50 to-violet-100", badge: "bg-indigo-100 text-indigo-700", kind: "list" },
  { id: "culture", emoji: "🎭", gradient: "from-fuchsia-50 to-purple-100", badge: "bg-fuchsia-100 text-fuchsia-700", kind: "list" },
  { id: "budget", emoji: "💸", gradient: "from-emerald-50 to-green-100", badge: "bg-emerald-100 text-emerald-700", kind: "list" },
  { id: "outdoor", emoji: "🌳", gradient: "from-teal-50 to-emerald-100", badge: "bg-teal-100 text-teal-700", kind: "list" },
];

const THEME_MAP = new Map(COLLECTION_THEMES.map((t) => [t.id, t]));

// Nazwa i podpowiedz motywu zyja w plikach tlumaczen (ns `ranking`, klucz = id motywu).
// W bazie i tak trzymamy `id`, wiec etykieta jest czysta warstwa prezentacji - inaczej
// niz przy tagach miejsc, gdzie do bazy trafia sam napis.
export const themeLabel = (id: string): string => i18n.t(`themes.${id}.label`, { ns: "ranking" });
export const themeHint  = (id: string): string => i18n.t(`themes.${id}.hint`,  { ns: "ranking" });

export function getTheme(id: string | null | undefined): CollectionTheme | null {
  if (!id) return null;
  return THEME_MAP.get(id) ?? null;
}

// Krotka etykieta z emoji do badge'a (np. "🌟 Perfekcyjny dzień"). Null gdy brak/nieznany.
export function themeBadgeLabel(id: string | null | undefined): string | null {
  const t = getTheme(id);
  return t ? `${t.emoji} ${themeLabel(t.id)}` : null;
}

// Forma zestawienia wg motywu: Plan (route) vs Lista. Domyslnie "list" (bezpieczny fallback).
export function collectionKind(category: string | null | undefined): CollectionKind {
  return getTheme(category)?.kind ?? "list";
}
export const isRouteCollection = (category: string | null | undefined): boolean =>
  collectionKind(category) === "route";
