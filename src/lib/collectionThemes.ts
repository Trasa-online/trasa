// Motywy zestawien (kuratorskich list miejsc). Zamkniete: user wybiera TYLKO z tej
// listy, nie tworzy wlasnych kategorii. Zapisujemy `id` do discovery_collections.category.
// Kolejnosc = kolejnosc wyswietlania w grid wyboru (krok 1 tworzenia zestawienia).

// kind rozdziela dwie formy zestawienia:
//  - "route" = trasa/plan dnia (kolejnosc miejsc + mapa ma znaczenie). Motywy z "dzień" w nazwie.
//  - "list"  = zwykla lista polecanych punktow (bez kolejnosci/planu).
export type CollectionKind = "route" | "list";

export interface CollectionTheme {
  id: string;
  label: string;
  emoji: string;
  hint: string;      // krotka podpowiedz pod kaflem
  gradient: string;  // tailwind gradient (from-... to-...) dla kafla motywu - stonowany
  badge: string;     // klasy badge'a motywu (tlo + tekst) dopasowane do koloru motywu
  kind: CollectionKind; // trasa (plan) vs lista miejsc
}

export const COLLECTION_THEMES: CollectionTheme[] = [
  { id: "perfect-day", label: "Perfekcyjny dzień",     emoji: "🌟", hint: "Twój idealny plan na cały dzień",             gradient: "from-amber-50 to-orange-100",   badge: "bg-amber-100 text-amber-800",   kind: "route" },
  { id: "date",        label: "Randka",                emoji: "💕", hint: "Miejsca na romantyczne wyjście",              gradient: "from-rose-50 to-pink-100",      badge: "bg-rose-100 text-rose-700",     kind: "list" },
  { id: "friends",     label: "Ze znajomymi",          emoji: "🎉", hint: "Wspólne wyjścia z ekipą",                     gradient: "from-violet-50 to-purple-100",  badge: "bg-violet-100 text-violet-700", kind: "list" },
  { id: "family",      label: "Z dzieckiem",           emoji: "👨‍👩‍👧", hint: "Rodzinnie, przyjaźnie dzieciom",              gradient: "from-sky-50 to-blue-100",       badge: "bg-sky-100 text-sky-700",       kind: "list" },
  { id: "budget",      label: "Budżetowo",             emoji: "💸", hint: "Fajnie i tanio",                              gradient: "from-emerald-50 to-green-100",  badge: "bg-emerald-100 text-emerald-700", kind: "list" },
  { id: "foodie",      label: "Lokalne smaki",         emoji: "🍜", hint: "Gdzie zjeść jak lokals",                      gradient: "from-orange-50 to-amber-100",   badge: "bg-orange-100 text-orange-700", kind: "list" },
  { id: "nightlife",   label: "Nocne życie",           emoji: "🌙", hint: "Bary, kluby, po zmroku",                      gradient: "from-indigo-50 to-violet-100",  badge: "bg-indigo-100 text-indigo-700", kind: "list" },
  { id: "culture",     label: "Kultura i sztuka",      emoji: "🎭", hint: "Muzea, galerie, zabytki",                     gradient: "from-fuchsia-50 to-purple-100", badge: "bg-fuchsia-100 text-fuchsia-700", kind: "list" },
  { id: "outdoor",     label: "Aktywnie",              emoji: "🌳", hint: "Na świeżym powietrzu",                        gradient: "from-teal-50 to-emerald-100",   badge: "bg-teal-100 text-teal-700",     kind: "list" },
  { id: "rainy",       label: "Na deszczowy dzień",    emoji: "🌧️", hint: "Gdy pada, a nie chcesz siedzieć w domu",     gradient: "from-slate-50 to-sky-100",      badge: "bg-slate-200 text-slate-700",   kind: "route" },
];

const THEME_MAP = new Map(COLLECTION_THEMES.map((t) => [t.id, t]));

export function getTheme(id: string | null | undefined): CollectionTheme | null {
  if (!id) return null;
  return THEME_MAP.get(id) ?? null;
}

// Krotka etykieta z emoji do badge'a (np. "🌟 Perfekcyjny dzień"). Null gdy brak/nieznany.
export function themeBadgeLabel(id: string | null | undefined): string | null {
  const t = getTheme(id);
  return t ? `${t.emoji} ${t.label}` : null;
}

// Forma zestawienia wg motywu: trasa (plan) vs lista. Domyslnie "list" (bezpieczny fallback).
export function collectionKind(category: string | null | undefined): CollectionKind {
  return getTheme(category)?.kind ?? "list";
}
export const isRouteCollection = (category: string | null | undefined): boolean =>
  collectionKind(category) === "route";
