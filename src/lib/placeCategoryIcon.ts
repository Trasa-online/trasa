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

  viewpoint: "/Ikona__Punkt%20widokowy.svg",

  store: "/Ikona__Zakupy.svg",
  boutique: "/Ikona__Zakupy.svg",
  shopping: "/Ikona__Zakupy.svg",
  clothing_store: "/Ikona__Zakupy.svg",
  concept_store: "/Ikona__Zakupy.svg",
  wine_shop: "/Ikona__Zakupy.svg",
  liquor_store: "/Ikona__Zakupy.svg",
  bookshop: "/Ikona__Zakupy.svg",
  book_store: "/Ikona__Zakupy.svg",
  market: "/Ikona__Zakupy.svg",

  // Kategorie GLOWNE (MAIN_CATEGORIES z categories.ts) - reprezentatywna ikona.
  food: "/Ikona__Restauracja-18.svg",
  culture: "/Ikona__Landmark.svg",
  attractions: "/Ikona__Landmark.svg",
  nature: "/Ikona__Natura.svg",
  shopping: "/Ikona__Zakupy.svg",
  entertainment: "/Ikona__Sztuka.svg",

  // Dodatkowe typy Google Places.
  beach: "/Ikona__Natura.svg",
  library: "/Ikona__Sztuka.svg",

  // Polskie ETYKIETY kategorii (uzywane m.in. w GroupSession, danych z labelami PL).
  kawiarnia: "/Ikona__Kawiarnia.svg",
  restauracja: "/Ikona__Restauracja-18.svg",
  "śniadania": "/Ikona__Kawiarnia.svg",
  muzeum: "/Ikona__Landmark.svg",
  zabytek: "/Ikona__Landmark.svg",
  galeria: "/Ikona__Sztuka.svg",
  rozrywka: "/Ikona__Sztuka.svg",
  zakupy: "/Ikona__Zakupy.svg",
  natura: "/Ikona__Natura.svg",
  "punkt widokowy": "/Ikona__Punkt%20widokowy.svg",
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
  restaurant: "restaurant", food: "restaurant", meal_takeaway: "restaurant", meal_delivery: "restaurant",
  cafe: "cafe", coffee_shop: "cafe", breakfast_restaurant: "cafe",
  bar: "bar", pub: "bar", wine_bar: "bar", night_club: "nightclub",
  bakery: "bakery",
  museum: "museum",
  art_gallery: "gallery",
  tourist_attraction: "landmark", point_of_interest: "landmark", landmark: "landmark", historical_landmark: "monument",
  church: "church", place_of_worship: "church", hindu_temple: "church", mosque: "church", synagogue: "church",
  park: "park", national_park: "park", garden: "park", campground: "nature", hiking_area: "nature", beach: "beach",
  movie_theater: "movie_theater", performing_arts_theater: "theater", concert_hall: "concert_hall",
  shopping_mall: "shopping", store: "store", clothing_store: "clothing_store", department_store: "shopping",
  supermarket: "shopping", market: "market", book_store: "book_store", liquor_store: "liquor_store",
  library: "library",
  amusement_park: "attractions", zoo: "attractions", aquarium: "attractions", stadium: "attractions", spa: "attractions",
};

export function categoryFromGoogleTypes(types?: string[] | null): string | null {
  if (!Array.isArray(types)) return null;
  for (const t of types) {
    const key = GOOGLE_TYPE_TO_CATEGORY[String(t).toLowerCase().trim()];
    if (key) return key;
  }
  return null;
}
