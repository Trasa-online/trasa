export interface Subcategory {
  id: string;
  label: string;
  emoji: string;
}

export interface MainCategory {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  subcategories: Subcategory[];
}

export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 'food',
    label: 'Jedzenie & Napoje',
    emoji: '🍽️',
    hint: 'Restauracje · Kawiarnie · Bary',
    subcategories: [
      { id: 'restaurant', label: 'Restauracja', emoji: '🍴' },
      { id: 'cafe',       label: 'Kawiarnia',   emoji: '☕' },
      { id: 'bar',        label: 'Bar / Pub',   emoji: '🍺' },
    ],
  },
  {
    id: 'culture',
    label: 'Kultura & Historia',
    emoji: '🏛️',
    hint: 'Muzea · Zabytki · Galerie',
    subcategories: [
      { id: 'museum',   label: 'Muzeum',   emoji: '🏛️' },
      { id: 'monument', label: 'Zabytek',  emoji: '🏰' },
      { id: 'gallery',  label: 'Galeria',  emoji: '🖼️' },
    ],
  },
  {
    id: 'attractions',
    label: 'Atrakcje',
    emoji: '✨',
    hint: 'Doświadczenia · Targi · Kluby',
    subcategories: [
      { id: 'experience', label: 'Doświadczenie', emoji: '🎭' },
      { id: 'market',     label: 'Targ',          emoji: '🏪' },
      { id: 'club',       label: 'Klub',          emoji: '🎵' },
    ],
  },
  {
    id: 'nature',
    label: 'Natura & Widoki',
    emoji: '🌿',
    hint: 'Parki · Punkty widokowe',
    subcategories: [
      { id: 'park',      label: 'Park',             emoji: '🌳' },
      { id: 'viewpoint', label: 'Punkt widokowy',   emoji: '🌅' },
    ],
  },
  {
    id: 'shopping',
    label: 'Zakupy',
    emoji: '🛍️',
    hint: 'Sklepy · Concept store · Wino',
    subcategories: [
      { id: 'store',         label: 'Sklep',          emoji: '🛍️' },
      { id: 'boutique',      label: 'Butik',          emoji: '👗' },
      { id: 'concept_store', label: 'Concept store',  emoji: '🛒' },
      { id: 'wine_shop',     label: 'Sklep z winami', emoji: '🍷' },
      { id: 'bookshop',      label: 'Księgarnia',     emoji: '📚' },
    ],
  },
  {
    id: 'entertainment',
    label: 'Rozrywka',
    emoji: '🎭',
    hint: 'Teatr · Live music · Kluby',
    subcategories: [
      { id: 'theater',    label: 'Teatr',      emoji: '🎭' },
      { id: 'live_music', label: 'Live music', emoji: '🎸' },
      { id: 'cinema',     label: 'Kino',       emoji: '🎬' },
      { id: 'nightclub',  label: 'Klub nocny', emoji: '🪩' },
    ],
  },
];

export const getSubcategoryIds = (mainCategoryId: string): string[] => {
  const cat = MAIN_CATEGORIES.find(c => c.id === mainCategoryId);
  return cat ? cat.subcategories.map(s => s.id) : [];
};

export const getMainCategoryFor = (subcategoryId: string): MainCategory | undefined =>
  MAIN_CATEGORIES.find(c => c.subcategories.some(s => s.id === subcategoryId));

export const getSubcategoryLabel = (subcategoryId: string): string | undefined => {
  for (const cat of MAIN_CATEGORIES) {
    const sub = cat.subcategories.find(s => s.id === subcategoryId);
    if (sub) return sub.label;
  }
  return undefined;
};

// ── i18n-aware etykiety do WYSWIETLANIA ─────────────────────────────────────
// Kanoniczne `.label` (PL) sluza jako identyfikatory (zapis do DB, porownania) -
// tych NIE tlumaczymy. Ponizsze helpery tlumacza tylko to, co widzi user.
// Import i18n jest bezpieczny: i18n/index.ts nie importuje tego pliku (brak cyklu).
import i18n from "@/i18n";

/** Etykieta kategorii glownej wg aktywnego jezyka (fallback: kanoniczny PL label / id). */
export const mainCategoryLabel = (id: string | null | undefined): string => {
  if (!id) return "";
  const raw = MAIN_CATEGORIES.find(c => c.id === id)?.label ?? id;
  return i18n.t(`main.${id}`, { ns: "categories", defaultValue: raw });
};

/** Etykieta podkategorii wg aktywnego jezyka (fallback: kanoniczny PL label / surowa wartosc DB). */
export const subcategoryLabelLocalized = (subcategoryId: string): string => {
  const raw = getSubcategoryLabel(subcategoryId) ?? subcategoryId;
  return i18n.t(`sub.${subcategoryId}`, { ns: "categories", defaultValue: raw });
};

// DB ma historycznie kilka wartosci `places.category` dla tego samego konceptu
// (np. "club" z AddCustomPlacePanel vs "nightlife" z AI generation). Mapowanie
// 1:N - subcategory ID z UI -> wszystkie wartosci DB ktore znacza to samo.
// Uzywane w PlaceSwiper filter, zeby user widzial WSZYSTKIE miejsca pasujace
// do wybranej podkategorii niezaleznie od tego jak zostala wpisana do bazy.
const SUBCATEGORY_DB_ALIASES: Record<string, string[]> = {
  club: ["club", "nightlife"],
  // "experience" w UI mapuje sie na rozne typy atrakcji w DB. AddCustomPlacePanel
  // pisze "experience" dla movie_theater/amusement_park/zoo/aquarium, ale AI-generated
  // miejsca uzywaja konkretnych typow. Lapiemy szeroko, zeby filtr "Doswiadczenie"
  // pokazywal cokolwiek pasujacego do tego konceptu.
  experience: ["experience", "tourist_attraction", "attraction", "amusement", "zoo", "aquarium", "theater", "movie_theater"],
  // "monument" w UI obejmuje historyczne zabytki - DB tez moze miec "church" (kosciol)
  // i "tourist_attraction" jako zabytki turystyczne.
  monument: ["monument", "church", "tourist_attraction"],
  // "shopping" w UI - DB ma tez "market" jako blisko-zwiazany koncept, ale to osobna
  // podkategoria. Zostawiamy bez aliasa.
  // "park" obejmuje tez "walk" (spacer) - czesto te same miejsca opisywane inaczej.
  park: ["park", "walk"],
  // Nowe podkategorie (Zakupy / Rozrywka) - mapowanie na typy Google Places w DB.
  store: ["store", "shopping"],
  boutique: ["boutique", "clothing_store", "shopping"],
  concept_store: ["concept_store", "store", "shopping"],
  wine_shop: ["wine_shop", "liquor_store"],
  bookshop: ["bookshop", "book_store", "library"],
  theater: ["theater", "performing_arts_theater", "movie_theater"],
  live_music: ["live_music", "night_club", "concert_hall"],
  cinema: ["cinema", "movie_theater"],
  nightclub: ["nightclub", "night_club", "club", "nightlife"],
};

export const getDbCategoriesFor = (subcategoryId: string): string[] => {
  return SUBCATEGORY_DB_ALIASES[subcategoryId] ?? [subcategoryId];
};
