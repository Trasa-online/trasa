// Motywy zestawien (kuratorskich list miejsc). Zamkniete: user wybiera TYLKO z tej
// listy, nie tworzy wlasnych kategorii. Zapisujemy `id` do discovery_collections.category.
// Kolejnosc = kolejnosc wyswietlania w grid wyboru (krok 1 tworzenia zestawienia).

export interface CollectionTheme {
  id: string;
  label: string;
  emoji: string;
  hint: string;      // krotka podpowiedz pod kaflem
  gradient: string;  // tailwind gradient (from-... to-...) dla kafla motywu
}

export const COLLECTION_THEMES: CollectionTheme[] = [
  { id: "perfect-day", label: "Perfekcyjny dzień",     emoji: "🌟", hint: "Twój idealny plan na cały dzień",             gradient: "from-amber-100 to-orange-200" },
  { id: "date",        label: "Randka",                emoji: "💕", hint: "Miejsca na romantyczne wyjście",              gradient: "from-rose-100 to-pink-200" },
  { id: "friends",     label: "Ze znajomymi",          emoji: "🎉", hint: "Wspólne wyjścia z ekipą",                     gradient: "from-violet-100 to-purple-200" },
  { id: "family",      label: "Z dzieckiem",           emoji: "👨‍👩‍👧", hint: "Rodzinnie, przyjaźnie dzieciom",              gradient: "from-sky-100 to-blue-200" },
  { id: "budget",      label: "Budżetowo",             emoji: "💸", hint: "Fajnie i tanio",                              gradient: "from-emerald-100 to-green-200" },
  { id: "foodie",      label: "Lokalne smaki",         emoji: "🍜", hint: "Gdzie zjeść jak lokals",                      gradient: "from-orange-100 to-amber-200" },
  { id: "nightlife",   label: "Nocne życie",           emoji: "🌙", hint: "Bary, kluby, po zmroku",                      gradient: "from-indigo-100 to-violet-200" },
  { id: "culture",     label: "Kultura i sztuka",      emoji: "🎭", hint: "Muzea, galerie, zabytki",                     gradient: "from-fuchsia-100 to-purple-200" },
  { id: "outdoor",     label: "Aktywnie",              emoji: "🌳", hint: "Na świeżym powietrzu",                        gradient: "from-teal-100 to-emerald-200" },
  { id: "rainy",       label: "Na deszczowy dzień",    emoji: "🌧️", hint: "Gdy pada, a nie chcesz siedzieć w domu",     gradient: "from-slate-100 to-sky-200" },
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
