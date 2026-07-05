// Motywy zestawien (kuratorskich list miejsc). Zamkniete: user wybiera TYLKO z tej
// listy, nie tworzy wlasnych kategorii. Zapisujemy `id` do discovery_collections.category.
// Kolejnosc = kolejnosc wyswietlania w grid wyboru (krok 1 tworzenia zestawienia).

export interface CollectionTheme {
  id: string;
  label: string;
  emoji: string;
  hint: string; // krotka podpowiedz pod kaflem
}

export const COLLECTION_THEMES: CollectionTheme[] = [
  { id: "perfect-day", label: "Perfekcyjny dzień",     emoji: "🌟", hint: "Twój idealny plan na cały dzień" },
  { id: "date",        label: "Randka",                emoji: "💕", hint: "Miejsca na romantyczne wyjście" },
  { id: "friends",     label: "Ze znajomymi",          emoji: "🎉", hint: "Wspólne wyjścia z ekipą" },
  { id: "family",      label: "Z dzieckiem",           emoji: "👨‍👩‍👧", hint: "Rodzinnie, przyjaźnie dzieciom" },
  { id: "budget",      label: "Budżetowo",             emoji: "💸", hint: "Fajnie i tanio" },
  { id: "foodie",      label: "Lokalne smaki",         emoji: "🍜", hint: "Gdzie zjeść jak lokals" },
  { id: "nightlife",   label: "Nocne życie",           emoji: "🌙", hint: "Bary, kluby, po zmroku" },
  { id: "culture",     label: "Kultura i sztuka",      emoji: "🎭", hint: "Muzea, galerie, zabytki" },
  { id: "outdoor",     label: "Aktywnie",              emoji: "🌳", hint: "Na świeżym powietrzu" },
  { id: "rainy",       label: "Na deszczowy dzień",    emoji: "🌧️", hint: "Gdy pada, a nie chcesz siedzieć w domu" },
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
