// Predefiniowane pule tagów dla TRAS i MIEJSC (sugestie-chipy, klik = dodaj).
// EDYTUJ TU, żeby zmienić dostępne tagi - to jedyne źródło prawdy.
// Zapisywane: tagi trasy -> routes.tags; tagi miejsca -> pins.tags.
// Reguła: predefiniowana pula (bez wolnego tekstu usera), spójna i filtrowalna.

// Tagi CAŁEJ TRASY - opisują charakter całego wyjazdu. Widoczne na karcie w eksploracji.
export const ROUTE_TAGS = [
  "Weekend",
  "Na jeden dzień",
  "Romantycznie",
  "Z dziećmi",
  "Budżetowo",
  "Kultura i sztuka",
  "Dla foodie",
  "Nocne życie",
  "Natura i spacery",
  "Instagramowe",
  "Mniej znane miejsca",
  "Dla znajomych",
];

// Tagi POJEDYNCZEGO MIEJSCA (przystanku) - alternatywa dla pisania notki.
// Uwaga: to pula GENERYCZNA (fallback). Preferuj `placeTagsForCategory(category)` (#5) - tagi
// zalezne od kategorii miejsca (zabytek NIE dostaje "tanio zjesz").
export const PLACE_TAGS = [
  "Must-see",
  "Dobra kawa",
  "Tanio zjesz",
  "Klimatyczne wnętrza",
  "Ładny widok",
  "Na szybko",
  "Warto poczekać",
  "Przyjazne dla psów",
  "Roślinne / wege",
  "Na wieczór",
];

// #5: Tagi miejsca ZALEZNE OD KATEGORII - inne dla zabytku, inne dla kawiarni. Pule per grupa.
const TAGS_FOOD = ["Dobra kawa", "Tanio zjesz", "Klimatyczne wnętrza", "Na wieczór", "Dobre na randkę", "Roślinne / wege", "Na szybko", "Warto poczekać"];
const TAGS_CULTURE = ["Must-see", "Dla miłośników historii", "Instagramowe", "Klimatyczne", "Za darmo", "Dla dzieci", "Warto poczekać"];
const TAGS_NATURE = ["Ładny widok", "Na spacer", "Przyjazne dla psów", "Cicho i spokojnie", "Na piknik", "Aktywnie", "Instagramowe"];
const TAGS_SHOPPING = ["Lokalne marki", "Concept store", "Na prezent", "Vintage", "Klimatyczne wnętrza", "Instagramowe"];
const TAGS_NIGHTLIFE = ["Na wieczór", "Nocne życie", "Muzyka na żywo", "Dobre drinki", "Na taniec", "Dla znajomych"];
const TAGS_GENERIC = ["Must-see", "Warto zobaczyć", "Instagramowe", "Klimatyczne", "Mniej znane", "Dla znajomych"];

// Mapowanie surowej kategorii miejsca (places.category / subkategoria / typ Google) -> pula tagow.
const CATEGORY_TAG_GROUP: Record<string, string[]> = {
  restaurant: TAGS_FOOD, cafe: TAGS_FOOD, bar: TAGS_FOOD, bakery: TAGS_FOOD, pastry: TAGS_FOOD,
  patisserie: TAGS_FOOD, dessert: TAGS_FOOD, food: TAGS_FOOD,
  museum: TAGS_CULTURE, monument: TAGS_CULTURE, gallery: TAGS_CULTURE, landmark: TAGS_CULTURE,
  church: TAGS_CULTURE, art: TAGS_CULTURE, theater: TAGS_CULTURE, performing_arts_theater: TAGS_CULTURE,
  cinema: TAGS_CULTURE, movie_theater: TAGS_CULTURE, culture: TAGS_CULTURE, experience: TAGS_CULTURE,
  park: TAGS_NATURE, walk: TAGS_NATURE, garden: TAGS_NATURE, nature: TAGS_NATURE, viewpoint: TAGS_NATURE,
  store: TAGS_SHOPPING, boutique: TAGS_SHOPPING, shopping: TAGS_SHOPPING, clothing_store: TAGS_SHOPPING,
  concept_store: TAGS_SHOPPING, wine_shop: TAGS_SHOPPING, liquor_store: TAGS_SHOPPING, bookshop: TAGS_SHOPPING, market: TAGS_SHOPPING,
  club: TAGS_NIGHTLIFE, nightclub: TAGS_NIGHTLIFE, night_club: TAGS_NIGHTLIFE, nightlife: TAGS_NIGHTLIFE,
  live_music: TAGS_NIGHTLIFE, concert_hall: TAGS_NIGHTLIFE,
};

// Zwraca pule tagow dopasowana do kategorii miejsca. Nieznana/pusta -> pula generyczna.
export function placeTagsForCategory(category?: string | null): string[] {
  if (!category) return TAGS_GENERIC;
  return CATEGORY_TAG_GROUP[category.toLowerCase().trim()] ?? TAGS_GENERIC;
}

// Ile tagów pokazać przed rozwinięciem "Pokaż więcej".
export const ROUTE_TAGS_VISIBLE = 6;
export const PLACE_TAGS_VISIBLE = 5;
