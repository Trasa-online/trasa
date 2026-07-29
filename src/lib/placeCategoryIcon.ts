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
};

const FALLBACK_ICON = "/Ikona__Landmark.svg";

export function categoryIconSrc(category?: string | null): string {
  if (!category) return FALLBACK_ICON;
  return CATEGORY_ICON_MAP[category.toLowerCase().trim()] ?? FALLBACK_ICON;
}
