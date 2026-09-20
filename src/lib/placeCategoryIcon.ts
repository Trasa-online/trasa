// Ikona kategorii miejsca (empty-state gdy brak zdjecia usera).
// Pliki w /public: Ikona__*.svg (kolor #ef9d78). Uzywane na tle #fcede3.
// Klucze = wartosci places.category / subcategory (patrz categories.ts:
// MAIN_CATEGORIES + SUBCATEGORY_DB_ALIASES). Case-insensitive.

const CATEGORY_ICON_MAP: Record<string, string> = {
  restaurant: "/Ikona__Restauracja-18.svg",

  cafe: "/Ikona__Kawiarnia.svg",

  bar: "/Ikona__Bar.svg",
  club: "/Ikona__Bar.svg",
  nightclub: "/Ikona__Bar.svg",
  night_club: "/Ikona__Bar.svg",
  nightlife: "/Ikona__Bar.svg",
  live_music: "/Ikona__Bar.svg",
  concert_hall: "/Ikona__Bar.svg",

  bakery: "/Ikona__Piekarnia.svg",

  pastry: "/Ikona__Cukiernia.svg",
  patisserie: "/Ikona__Cukiernia.svg",
  dessert: "/Ikona__Cukiernia.svg",

  museum: "/Ikona__Landmark.svg",
  monument: "/Ikona__Landmark.svg",
  church: "/Ikona__Landmark.svg",
  landmark: "/Ikona__Landmark.svg",

  gallery: "/Ikona__Sztuka.svg",
  art: "/Ikona__Sztuka.svg",
  theater: "/Ikona__Sztuka.svg",
  performing_arts_theater: "/Ikona__Sztuka.svg",
  cinema: "/Ikona__Sztuka.svg",
  movie_theater: "/Ikona__Sztuka.svg",

  park: "/Ikona__Natura.svg",
  walk: "/Ikona__Natura.svg",
  garden: "/Ikona__Natura.svg",
  nature: "/Ikona__Natura.svg",

  viewpoint: "/Ikona__Punkt_widokowy.svg",

  experience: "/Ikona__Sztuka.svg",

  store: "/Ikona__Zakupy.svg",
  boutique: "/Ikona__Zakupy.svg",
  shopping: "/Ikona__Zakupy.svg",
  clothing_store: "/Ikona__Zakupy.svg",
  concept_store: "/Ikona__Zakupy.svg",
  wine_shop: "/Ikona__Zakupy.svg",
  vintage_store: "/Ikona__Zakupy.svg",
  antique_store: "/Ikona__Zakupy.svg",
  thrift_store: "/Ikona__Zakupy.svg",
  second_hand_store: "/Ikona__Zakupy.svg",
  liquor_store: "/Ikona__Zakupy.svg",
  bookshop: "/Ikona__Zakupy.svg",
  book_store: "/Ikona__Zakupy.svg",
  market: "/Ikona__Zakupy.svg",

  // Kategorie GLOWNE (MAIN_CATEGORIES z categories.ts) - reprezentatywna ikona.
  // UWAGA: "nature" i "shopping" sa JEDNOCZESNIE typem z Google i id kategorii glownej,
  // wiec siedza wyzej w tej mapie (przy park/walk i przy store/boutique) i nie powtarzamy
  // ich tutaj - powtorzenie dawalo TS1117 (duplikat klucza w literale).
  food: "/Ikona__Restauracja-18.svg",
  culture: "/Ikona__Landmark.svg",
  attractions: "/Ikona__Landmark.svg",
  entertainment: "/Ikona__Sztuka.svg",

  // Dodatkowe typy Google Places.
  beach: "/Ikona__Natura.svg",
  library: "/Ikona__Sztuka.svg",

  // Polskie ETYKIETY kategorii (uzywane m.in. w GroupSession, danych z labelami PL).
  kawiarnia: "/Ikona__Kawiarnia.svg",
  restauracja: "/Ikona__Restauracja-18.svg",
  "śniadania": "/Ikona__Kawiarnia.svg",   // i18n-ignore: klucz dopasowania kategorii, nie copy
  muzeum: "/Ikona__Landmark.svg",
  zabytek: "/Ikona__Landmark.svg",
  galeria: "/Ikona__Sztuka.svg",
  rozrywka: "/Ikona__Sztuka.svg",
  zakupy: "/Ikona__Zakupy.svg",
  natura: "/Ikona__Natura.svg",
  "punkt widokowy": "/Ikona__Punkt_widokowy.svg",
  piekarnia: "/Ikona__Piekarnia.svg",
  cukiernia: "/Ikona__Cukiernia.svg",
  sztuka: "/Ikona__Sztuka.svg",
};

const FALLBACK_ICON = "/Ikona__Landmark.svg";

export function categoryIconSrc(category?: string | null): string {
  if (!category) return FALLBACK_ICON;
  return CATEGORY_ICON_MAP[category.toLowerCase().trim()] ?? FALLBACK_ICON;
}

// Mapowanie TYPOW Google Places (r.types z textsearch/details) na NASZA kategorie
// (klucz z CATEGORY_ICON_MAP). Wyniki wyszukiwarki nie maja naszej kategorii - bez tego
// KAZDE wyszukane miejsce dostaje ikone fallback (Landmark). Iterujemy po types w kolejnosci
// (Google zwraca od najbardziej szczegolowego), pierwszy trafiony wygrywa.
const GOOGLE_TYPE_TO_CATEGORY: Record<string, string> = {
  // ⚠️ Wyjscie tej mapy MUSI byc identyfikatorem PODKATEGORII z MAIN_CATEGORIES
  // (categories.ts). Dopoki tak nie bylo, filtr musial nadrabiac SUBCATEGORY_DB_ALIASES:
  // normalizator produkowal wartosci ("shopping", "attractions", "clothing_store"),
  // ktorych slownik filtrow nie zna. Dokladajac tu nowy typ Google, celuj w podkategorie.

  // Jedzenie & Napoje
  restaurant: "restaurant", food: "restaurant", meal_takeaway: "restaurant", meal_delivery: "restaurant",
  cafe: "cafe", coffee_shop: "cafe", breakfast_restaurant: "cafe",
  bakery: "bakery", pastry_shop: "bakery", dessert_shop: "bakery",
  bar: "bar", pub: "bar", wine_bar: "bar",

  // Kultura & Historia
  museum: "museum",
  art_gallery: "gallery",
  tourist_attraction: "monument", point_of_interest: "monument",
  landmark: "monument", historical_landmark: "monument",
  church: "monument", place_of_worship: "monument", hindu_temple: "monument",
  mosque: "monument", synagogue: "monument",
  // TODO slownik: biblioteka nie ma wlasnej podkategorii - trafia do "museum", zeby zostac
  // w Kulturze zamiast wpasc miedzy sklepy.
  library: "museum",

  // Atrakcje
  amusement_park: "experience", zoo: "experience", aquarium: "experience",
  stadium: "experience", spa: "experience",
  market: "market",

  // Natura & Widoki
  park: "park", national_park: "park", garden: "park",
  campground: "park", hiking_area: "park",
  // TODO slownik: plaza nie ma wlasnej podkategorii - trafia do "park" (zostaje w Naturze).
  beach: "park",

  // Zakupy
  shopping_mall: "store", store: "store", department_store: "store", supermarket: "store",
  clothing_store: "boutique", shoe_store: "boutique",
  book_store: "bookshop",
  liquor_store: "wine_shop",
  thrift_store: "vintage_store", second_hand_store: "vintage_store", antique_store: "vintage_store",

  // Rozrywka
  movie_theater: "cinema",
  performing_arts_theater: "theater",
  concert_hall: "live_music",
  night_club: "nightclub",
};

// ⚠️ Google (legacy Places API) oddaje `types` ALFABETYCZNIE, nie „najwazniejszy pierwszy".
// Sklep z butami przychodzi jako ['establishment','food','point_of_interest','shoe_store','store']
// (Aplug Lodz, zgloszenie Nat 2026-09-20) - pierwsze trafienie w mapie to `food`, czyli
// „Restauracja". Dlatego typy OGOLNE, ktore Google dokleja do polowy miejsc, przegrywaja
// z kazdym typem konkretnym i licza sie dopiero, gdy nic innego nie pasuje.
const GENERIC_GOOGLE_TYPES = new Set(["food", "point_of_interest", "establishment", "store", "tourist_attraction"]);

export function categoryFromGoogleTypes(types?: string[] | null): string | null {
  if (!Array.isArray(types)) return null;
  let generic: string | null = null;
  for (const t of types) {
    const norm = String(t).toLowerCase().trim();
    const key = GOOGLE_TYPE_TO_CATEGORY[norm];
    if (!key) continue;
    if (GENERIC_GOOGLE_TYPES.has(norm)) { generic ??= key; continue; }
    return key;
  }
  return generic;
}

// Heurystyka: zgadnij kategorie z NAZWY miejsca (klucz z CATEGORY_ICON_MAP) - fallback dla
// miejsc bez zapisanej kategorii (dodane z Google przed backfillem -> inaczej ikona/chip
// leca na Landmark/"Miejsce"). Best-effort; brak dopasowania = null (zostaje generyczny stan).
const NAME_CATEGORY_HINTS: [RegExp, string][] = [
  [/ramen|sushi|udon|ramenown|restaurac|restaurant|bistro|kuchni|burger|pizz|tapas|grill|kebab|thai|wietnam|indyj|makaron|noodle|jad[łl]odajni|obiad|street\s?food/i, "restaurant"],
  [/kaw(a|ia|ka)|coffee|caf[eé]|espresso|roaster|roastery|latte/i, "cafe"],
  [/\bbar\b|\bpub\b|drink|koktajl|cocktail|winiar|\bwine\b|piwn|browar|nalewa|whisky/i, "bar"],
  [/klub\b|\bclub\b|nightclub|disco/i, "club"],
  [/piekarni|bakery|bu[łl]eczk|chleb/i, "bakery"],
  [/cukierni|p[ąa]czk|deser|\blody\b|ice\s?cream|gelat|s[łl]odko|donut|pastry/i, "pastry"],
  [/muzeum|museum/i, "museum"],
  [/galeri|gallery|sztuk|\bart\b/i, "gallery"],
  [/\bkino\b|cinema|teatr|theat/i, "theater"],
  [/\bpark\b|ogr[óo]d|garden|plaż|beach|\blas\b|skwer|bulwar|natur/i, "park"],
  [/pa[łl]ac|zamek|katedr|ko[śs]ci[óo][łl]|bazylik|pomnik|monument|ratusz|kamienic|zabytek/i, "monument"],
  [/sklep|store|shop|butik|boutique|market|\btarg\b|zakupy|concept/i, "store"],
  [/punkt\s?widokow|viewpoint|taras\s?widokow/i, "viewpoint"],
];
export function inferCategoryFromName(name?: string | null): string | null {
  if (!name) return null;
  for (const [re, cat] of NAME_CATEGORY_HINTS) if (re.test(name)) return cat;
  return null;
}
