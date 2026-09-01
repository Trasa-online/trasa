import i18n from "@/i18n";
// Predefiniowane pule tagów dla TRAS i MIEJSC (sugestie-chipy, klik = dodaj).
// EDYTUJ TU, żeby zmienić dostępne tagi - to jedyne źródło prawdy.
// Zapisywane: tagi miejsca -> pins.tags (tagi całej trasy wycofane 2026-08-31).
// Reguła: predefiniowana pula (bez wolnego tekstu usera), spójna i filtrowalna.

// Tagi CAŁEJ TRASY WYCOFANE (2026-08-31, decyzja Nat: widok wyjazdu ma być czysty).
// Pula ROUTE_TAGS + edytor w podsumowaniu usunięte; kolumna routes.tags zostaje w bazie,
// ale nic jej już nie zapisuje ani nie wyświetla. Zostają tagi POJEDYNCZYCH MIEJSC (pins.tags).

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
export const PLACE_TAGS_VISIBLE = 5;

// Werdykt o miejscu - tagi "czy warto", wybierane JEDNYM tapnieciem pod notkami w widoku wyjazdu
// (prosba Nat 2026-08-30). Trafiaja do pins.tags, tak jak reszta tagow miejsca, wiec widac je
// pozniej we wspomnieniu i w eksploracji.
//
// UWAGA (2026-09-01): w pins.tags zapisujemy teraz `id`, a NIE polska etykiete. Dzieki temu ten
// sam werdykt czyta sie po polsku i po angielsku - wczesniej tag zapisany przez polskiego usera
// zostawal polski na zawsze, takze dla anglojezycznego ogladajacego.
export type VerdictTag = { id: string; pl: string; en: string };

export const PLACE_VERDICT_TAGS: VerdictTag[] = [
  { id: "must_visit",   pl: "Musisz odwiedzić!", en: "Must visit!" },
  { id: "worth_seeing", pl: "Przy okazji",       en: "Worth seeing" },
  { id: "stop_by",      pl: "Warto wpaść",       en: "stop by" },
];

// Werdykty zapisane ZANIM tagi dostaly stabilne id (do 2026-09-01) - w bazie siedza jako polskie
// napisy. Mapujemy je, zeby stare wyjazdy nadal czytalo sie poprawnie w obu jezykach. Dwa ostatnie
// zostaly wycofane z puli: nie da sie ich juz wybrac, ale tam gdzie sa - zostaja czytelne.
const LEGACY_VERDICTS: Record<string, VerdictTag> = {
  "Musisz odwiedzić!":   PLACE_VERDICT_TAGS[0],
  "Przy okazji":         PLACE_VERDICT_TAGS[1],
  "Warto wpaść":         PLACE_VERDICT_TAGS[2],
  "Warto odwiedzić":     { id: "worth_visiting", pl: "Warto odwiedzić",     en: "Worth visiting" },
  "Nie warto odwiedzać": { id: "not_worth",      pl: "Nie warto odwiedzać", en: "Not worth it" },
};

const VERDICT_BY_ID: Record<string, VerdictTag> = Object.fromEntries(
  [...PLACE_VERDICT_TAGS, ...Object.values(LEGACY_VERDICTS)].map((v) => [v.id, v]),
);

/** Werdykt dla wartosci z pins.tags - przyjmuje i nowe id, i stara polska etykiete. */
export function verdictOf(tag: string): VerdictTag | null {
  return VERDICT_BY_ID[tag] ?? LEGACY_VERDICTS[tag] ?? null;
}

/**
 * Etykieta taga do wyswietlenia. Werdykty tlumaczymy, pozostale tagi (pule tematyczne) oddajemy
 * bez zmian - to wolny tekst z puli, ktory na razie istnieje tylko po polsku.
 * Bez podanego `lang` bierzemy jezyk z instancji i18n, zeby miejsca renderujace tagi nie musialy
 * go przekazywac (i nie musialy siegac po hook `t`, ktory bywa juz zajety lokalna zmienna).
 */
export function localizeTag(tag: string, lang?: string): string {
  const v = verdictOf(tag);
  if (!v) return tag;
  const l = lang ?? i18n.language ?? "pl";
  return String(l).toLowerCase().startsWith("en") ? v.en : v.pl;
}
