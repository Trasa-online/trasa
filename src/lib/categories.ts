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

// i18n-ignore-start: kanoniczne etykiety PL to FALLBACK dla i18n - patrz mainCategoryLabel / subcategoryLabelLocalized
export const MAIN_CATEGORIES: MainCategory[] = [
  {
    id: 'food',
    label: 'Jedzenie & Napoje',
    emoji: '🍽️',
    hint: 'Restauracje · Kawiarnie · Bary',
    subcategories: [
      { id: 'restaurant', label: 'Restauracja', emoji: '🍴' },
      { id: 'cafe',       label: 'Kawiarnia',   emoji: '☕' },
      { id: 'bakery',     label: 'Piekarnia',   emoji: '🥐' },
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
      { id: 'vintage_store', label: 'Vintage store',  emoji: '🕰️' },
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
// i18n-ignore-end
];

// ── Reguly wyboru kategorii przez lokal (decyzja Nat 2026-09-14) ─────────────
// Lokal wybiera 1-2 ROWNORZEDNE kategorie glowne (bez "dodatkowej", bez hierarchii)
// i 1-3 podkategorie LACZNIE, po minimum jednej do KAZDEJ wybranej glownej.
// Limit dwoch pilnuje panel, nie baza - wyjatki z trzema tozsamosciami dodawane sa recznie.

export const MAX_MAIN_CATEGORIES = 2;
export const MAX_SUBCATEGORIES = 3;

export interface CategorySelection {
  mains: string[];
  subs: string[];
}

/** Puste `errors` = wybor da sie zapisac. Kolejnosc bledow = kolejnosc pokazywania w panelu. */
export const validateCategorySelection = ({ mains, subs }: CategorySelection): string[] => {
  const errors: string[] = [];
  const known = new Set(MAIN_CATEGORIES.map(c => c.id));

  if (mains.length === 0) errors.push("no_main");
  if (mains.length > MAX_MAIN_CATEGORIES) errors.push("too_many_mains");
  if (mains.some(m => !known.has(m))) errors.push("unknown_main");
  if (new Set(mains).size !== mains.length) errors.push("duplicate_main");

  if (subs.length === 0) errors.push("no_sub");
  if (subs.length > MAX_SUBCATEGORIES) errors.push("too_many_subs");
  if (new Set(subs).size !== subs.length) errors.push("duplicate_sub");

  // Kazda podkategoria musi nalezec do JEDNEJ z wybranych glownych...
  const orphan = subs.filter(sub => {
    const parent = getMainCategoryFor(sub);
    return !parent || !mains.includes(parent.id);
  });
  if (orphan.length) errors.push("orphan_sub");

  // ...i kazda wybrana glowna musi miec przynajmniej jedna podkategorie.
  const covered = new Set(subs.map(sub => getMainCategoryFor(sub)?.id).filter(Boolean) as string[]);
  if (mains.some(m => !covered.has(m))) errors.push("main_without_sub");

  return errors;
};

/** Kategorie glowne wynikajace z wybranych podkategorii - zrodlo prawdy przy zapisie. */
export const mainsFromSubs = (subs: string[]): string[] => {
  const out: string[] = [];
  for (const sub of subs) {
    const id = getMainCategoryFor(sub)?.id;
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
};

/**
 * Odczyt tolerancyjny na oba ksztalty danych. Dopoki main_category i secondary_category
 * nie znikna z bazy, wiersz moze miec jedno albo drugie - call site nie powinien o tym wiedziec.
 */
export const readMainCategories = (row: {
  main_categories?: string[] | null;
  main_category?: string | null;
  secondary_category?: string | null;
} | null | undefined): string[] => {
  if (!row) return [];
  if (row.main_categories?.length) return row.main_categories.filter(Boolean);
  const legacy = [row.main_category, row.secondary_category].filter(Boolean) as string[];
  return [...new Set(legacy)];
};

/**
 * Wartosc z bazy -> ID podkategorii. `business_profiles.subcategories` trzyma historycznie
 * MIESZANKE: gdzieniegdzie id ("cafe"), gdzieniegdzie polska ETYKIETE ("Kawiarnia") - zaleznie
 * od tego, w ktorym roku i ktorym ekranem lokal byl zakladany. Panel czyta i zapisuje wylacznie
 * id, wiec przy wczytaniu normalizujemy; wartosci nierozpoznanej NIE wyrzucamy (null = zostaw
 * ja w spokoju, zamiast po cichu skasowac komus kategorie).
 */
export const normalizeSubcategoryId = (value: string | null | undefined): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const main of MAIN_CATEGORIES) {
    for (const sub of main.subcategories) {
      if (sub.id.toLowerCase() === lower) return sub.id;
      if (sub.label.toLowerCase() === lower) return sub.id;
    }
  }
  return null;
};

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

// Emoji podkategorii (np. 'cafe' -> '☕') - do ikonki kategorii na wizytówce.
export const subcategoryEmoji = (subcategoryId: string): string | undefined => {
  for (const cat of MAIN_CATEGORIES) {
    const sub = cat.subcategories.find(s => s.id === subcategoryId);
    if (sub) return sub.emoji;
  }
  return undefined;
};

// Kategoria główna zawierająca daną podkategorię (np. 'cafe' -> {id:'food', label:'Jedzenie & Napoje'}).
export const parentMainOfSub = (subcategoryId: string): MainCategory | undefined =>
  MAIN_CATEGORIES.find(cat => cat.subcategories.some(s => s.id === subcategoryId));

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

// Liczba mnoga podkategorii - naglowki grup na widoku wyjazdu ("Restauracje", "Kawiarnie").
// Do 2026-09-06 byly zaszyte po polsku z komentarzem "UI jest polskie". UI juz polskie nie jest,
// wiec formy mieszkaja w plikach tlumaczen (ns `categories`, klucz `plural.<id>`), a fallbackiem
// zostaje etykieta pojedyncza.
export const subcategoryPluralLabel = (subcategoryId: string): string =>
  i18n.t(`plural.${subcategoryId}`, { ns: "categories", defaultValue: subcategoryLabelLocalized(subcategoryId) });

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
  // Piekarnia lapie tez cukiernie - w bazie zyja obie formy, a dla goscia to ta sama polka.
  bakery: ["bakery", "pastry", "patisserie", "dessert"],
  // Sklepy vintage i z drugiej reki. Google nie ma typu "vintage", wiec lapiemy
  // warianty, ktore realnie wpadaja do bazy. CELOWO bez generycznego "store"/"shopping" -
  // to by wciagnelo do filtra kazdy sklep.
  vintage_store: ["vintage_store", "antique_store", "thrift_store", "second_hand_store"],
  theater: ["theater", "performing_arts_theater", "movie_theater"],
  live_music: ["live_music", "night_club", "concert_hall"],
  cinema: ["cinema", "movie_theater"],
  nightclub: ["nightclub", "night_club", "club", "nightlife"],
};

export const getDbCategoriesFor = (subcategoryId: string): string[] => {
  return SUBCATEGORY_DB_ALIASES[subcategoryId] ?? [subcategoryId];
};

// ── Etykieta kategorii MIEJSCA (jedno wejscie dla calej apki) ────────────────
// Zgloszenie Nat 2026-09-24: na karcie w zakladce Miejsca zamiast nazwy kategorii
// staly surowe klucze ("categories.church"). Przyczyna byla wszedzie ta sama: kazdy
// ekran tlumaczyl kategorie WLASNYM kluczem we WLASNEJ przestrzeni (`plan:categories.*`,
// `myplan:categories.*`, `home:categories.*`), a te listy powstaly przy roznych okazjach
// i zadna nie zna wszystkich wartosci, ktore realnie siedza w bazie. `places.category` ma
// dzis m.in. church, landmark, nature, bakery, book_store, clothing_store, boutique i
// "other" - a `plan:categories` zna dwanascie. Brak klucza + brak fallbacku = i18next
// oddaje sam klucz, czyli user widzi kod.
//
// Dlatego etykieta ma JEDNO zrodlo: przestrzen `categories` (`sub.*` / `main.*`), ta sama,
// z ktorej korzysta panel lokalu. ⛔ Nie dopisuj kategorii do `plan`/`home`/`myplan` -
// dopisz `sub.<id>` w `src/locales/{pl,en}/categories.json`.
//
// ⚠️ Fallback NIGDY nie jest kluczem ani surowa wartoscia z bazy: nieznana kategoria
// czyta sie jako "Miejsce" / "Place". Lepiej powiedziec mniej niz pokazac kod.

// Wartosci, ktore w bazie znacza to samo, co nasza podkategoria. Wpisy PO POLSKU sa
// historyczne (stare importy zapisywaly ETYKIETE zamiast identyfikatora) - zostaja, bo
// takich wierszy nie da sie poprawic wstecz w 100 %.
const PLACE_CATEGORY_ALIASES: Record<string, string> = {
  // i18n-ignore-start: klucze dopasowania wartosci z bazy, nie copy
  shop: "store",
  shopping: "store",
  nightlife: "nightclub",
  night_club: "nightclub",
  // ⛔ `walk` i `nature` NIE sa tu aliasowane na "park" - maja wlasne etykiety ("Spacer",
  // "Natura"). Alias zmienialby to, co user czyta, a nie tylko to, co filtrujemy.
  garden: "park",
  beach: "park",
  library: "bookshop",
  tourist_attraction: "experience",
  amusement_park: "experience",
  zoo: "experience",
  aquarium: "experience",
  movie_theater: "cinema",
  performing_arts_theater: "theater",
  concert_hall: "live_music",
  pastry: "bakery",
  patisserie: "bakery",
  dessert: "bakery",
  liquor_store: "wine_shop",
  antique_store: "vintage_store",
  thrift_store: "vintage_store",
  second_hand_store: "vintage_store",
  kawiarnia: "cafe",
  restauracja: "restaurant",
  piekarnia: "bakery",
  muzeum: "museum",
  zabytek: "monument",
  galeria: "gallery",
  park: "park",
  targ: "market",
  sklep: "store",
  klub: "nightclub",
  bar: "bar",
  // i18n-ignore-end
};

/** Etykieta kategorii miejsca wg aktywnego jezyka. Nieznana wartosc -> "Miejsce"/"Place". */
export const placeCategoryLabel = (value: string | null | undefined): string => {
  const fallback = () => i18n.t("other", { ns: "categories" });
  if (!value) return fallback();
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "other" || raw === "place") return fallback();
  const id = PLACE_CATEGORY_ALIASES[raw] ?? raw;
  // ⚠️ NAJPIERW podkategoria, potem kategoria glowna. `nature` i `shopping` sa jednym
  // i drugim naraz, a na karcie miejsca chcemy waskiej etykiety ("Natura", "Sklep"),
  // nie nazwy calej polki ("Natura & Widoki", "Zakupy").
  const canon = getSubcategoryLabel(id);
  const label = i18n.t(`sub.${id}`, { ns: "categories", defaultValue: canon ?? "" });
  if (label) return label;
  // Kategoria GLOWNA (food / culture / ...) tez bywa zapisana w `category`.
  if (MAIN_CATEGORIES.some((m) => m.id === id)) return mainCategoryLabel(id);
  return fallback();
};
