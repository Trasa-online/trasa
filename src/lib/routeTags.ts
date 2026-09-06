import i18n from "@/i18n";
// Predefiniowane pule tagów dla MIEJSC (sugestie-chipy, klik = dodaj).
// EDYTUJ TU, żeby zmienić dostępne tagi - to jedyne źródło prawdy.
// Zapisywane: tagi miejsca -> pins.tags (tagi całej trasy wycofane 2026-08-31).
// Reguła: predefiniowana pula (bez wolnego tekstu usera), spójna i filtrowalna.

// Tagi CAŁEJ TRASY WYCOFANE (2026-08-31, decyzja Nat: widok wyjazdu ma być czysty).
// Pula ROUTE_TAGS + edytor w podsumowaniu usunięte; kolumna routes.tags zostaje w bazie,
// ale nic jej już nie zapisuje ani nie wyświetla. Zostają tagi POJEDYNCZYCH MIEJSC (pins.tags).

// UWAGA (2026-09-06): pule trzymaja ID, a w pins.tags zapisujemy ID, nie polska etykiete.
// Wczesniej tag dodany przez polskiego usera zostawal polski na zawsze - takze dla kogos,
// kto oglada ten sam wyjazd po angielsku. Etykiety zyja w TAG_LABELS, a `localizeTag`
// tlumaczy je przy renderze. Ta sama zasada co przy werdyktach (nizej), tylko szersza.

export type TagLabel = { pl: string; en: string };

// i18n-ignore-start: tabela etykiet jest KOMPLETNA w obu jezykach (jak slownik landingu) -
// polski w kolumnie `pl` to nie jest brak tlumaczenia. Dopisujac tag, dopisz OBIE wersje.
const TAG_LABELS: Record<string, TagLabel> = {
  must_see:        { pl: "Must-see",              en: "Must-see" },
  good_coffee:     { pl: "Dobra kawa",            en: "Great coffee" },
  cheap_eats:      { pl: "Tanio zjesz",           en: "Cheap eats" },
  cosy_interior:   { pl: "Klimatyczne wnętrza",   en: "Cosy interior" },
  nice_view:       { pl: "Ładny widok",           en: "Great view" },
  quick_bite:      { pl: "Na szybko",             en: "Quick bite" },
  worth_the_wait:  { pl: "Warto poczekać",        en: "Worth the wait" },
  dog_friendly:    { pl: "Przyjazne dla psów",    en: "Dog-friendly" },
  plant_based:     { pl: "Roślinne / wege",       en: "Plant-based" },
  evening:         { pl: "Na wieczór",            en: "Good in the evening" },
  date_spot:       { pl: "Dobre na randkę",       en: "Good for a date" },
  history_lovers:  { pl: "Dla miłośników historii", en: "For history lovers" },
  instagrammable:  { pl: "Instagramowe",          en: "Instagrammable" },
  atmospheric:     { pl: "Klimatyczne",           en: "Atmospheric" },
  free:            { pl: "Za darmo",              en: "Free" },
  kid_friendly:    { pl: "Dla dzieci",            en: "Good with kids" },
  good_walk:       { pl: "Na spacer",             en: "Good for a walk" },
  quiet:           { pl: "Cicho i spokojnie",     en: "Quiet and calm" },
  picnic:          { pl: "Na piknik",             en: "Good for a picnic" },
  active:          { pl: "Aktywnie",              en: "Active" },
  local_brands:    { pl: "Lokalne marki",         en: "Local brands" },
  concept_store:   { pl: "Concept store",         en: "Concept store" },
  gift:            { pl: "Na prezent",            en: "Good for a gift" },
  vintage:         { pl: "Vintage",               en: "Vintage" },
  nightlife:       { pl: "Nocne życie",           en: "Nightlife" },
  live_music:      { pl: "Muzyka na żywo",        en: "Live music" },
  good_drinks:     { pl: "Dobre drinki",          en: "Good drinks" },
  dancing:         { pl: "Na taniec",             en: "Good for dancing" },
  with_friends:    { pl: "Dla znajomych",         en: "With friends" },
  worth_a_look:    { pl: "Warto zobaczyć",        en: "Worth a look" },
  lesser_known:    { pl: "Mniej znane",           en: "Off the beaten path" },
};
// i18n-ignore-end

// Tagi POJEDYNCZEGO MIEJSCA (przystanku) - alternatywa dla pisania notki.
// Uwaga: to pula GENERYCZNA (fallback). Preferuj `placeTagsForCategory(category)` - tagi
// zalezne od kategorii miejsca (zabytek NIE dostaje "tanio zjesz").
export const PLACE_TAGS = [
  "must_see", "good_coffee", "cheap_eats", "cosy_interior", "nice_view",
  "quick_bite", "worth_the_wait", "dog_friendly", "plant_based", "evening",
];

// Tagi miejsca ZALEZNE OD KATEGORII - inne dla zabytku, inne dla kawiarni. Pule per grupa.
const TAGS_FOOD = ["good_coffee", "cheap_eats", "cosy_interior", "evening", "date_spot", "plant_based", "quick_bite", "worth_the_wait"];
const TAGS_CULTURE = ["must_see", "history_lovers", "instagrammable", "atmospheric", "free", "kid_friendly", "worth_the_wait"];
const TAGS_NATURE = ["nice_view", "good_walk", "dog_friendly", "quiet", "picnic", "active", "instagrammable"];
const TAGS_SHOPPING = ["local_brands", "concept_store", "gift", "vintage", "cosy_interior", "instagrammable"];
const TAGS_NIGHTLIFE = ["evening", "nightlife", "live_music", "good_drinks", "dancing", "with_friends"];
const TAGS_GENERIC = ["must_see", "worth_a_look", "instagrammable", "atmospheric", "lesser_known", "with_friends"];

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

// Zwraca pule tagow (ID) dopasowana do kategorii miejsca. Nieznana/pusta -> pula generyczna.
export function placeTagsForCategory(category?: string | null): string[] {
  if (!category) return TAGS_GENERIC;
  return CATEGORY_TAG_GROUP[category.toLowerCase().trim()] ?? TAGS_GENERIC;
}

// Ile tagów pokazać przed rozwinięciem "Pokaż więcej".
export const PLACE_TAGS_VISIBLE = 5;

// Werdykt o miejscu - tagi "czy warto", wybierane JEDNYM tapnieciem pod notkami w widoku wyjazdu
// (prosba Nat 2026-08-30). Trafiaja do pins.tags, tak jak reszta tagow miejsca, wiec widac je
// pozniej we wspomnieniu i w eksploracji.
export type VerdictTag = { id: string; pl: string; en: string };

// i18n-ignore-start: jak wyzej - komplet PL + EN, nie brak tlumaczenia.
export const PLACE_VERDICT_TAGS: VerdictTag[] = [
  { id: "must_visit",   pl: "Musisz odwiedzić!", en: "Must visit!" },
  { id: "worth_seeing", pl: "Przy okazji",       en: "Worth seeing" },
  { id: "stop_by",      pl: "Warto wpaść",       en: "stop by" },
];

// Wartosci zapisane ZANIM tagi dostaly stabilne id - w bazie siedza jako polskie napisy.
// Mapujemy je na id, zeby stare wyjazdy nadal czytalo sie poprawnie w obu jezykach.
// Werdykty: do 2026-09-01. Tagi z pul: do 2026-09-06. Dwa werdykty (Warto odwiedzić / Nie warto
// odwiedzać) zostaly wycofane z puli: nie da sie ich juz wybrac, ale tam gdzie sa - zostaja czytelne.
const LEGACY_VERDICTS: Record<string, VerdictTag> = {
  "Musisz odwiedzić!":   PLACE_VERDICT_TAGS[0],
  "Przy okazji":         PLACE_VERDICT_TAGS[1],
  "Warto wpaść":         PLACE_VERDICT_TAGS[2],
  "Warto odwiedzić":     { id: "worth_visiting", pl: "Warto odwiedzić",     en: "Worth visiting" },
  "Nie warto odwiedzać": { id: "not_worth",      pl: "Nie warto odwiedzać", en: "Not worth it" },
};
// i18n-ignore-end

const VERDICT_BY_ID: Record<string, VerdictTag> = Object.fromEntries(
  [...PLACE_VERDICT_TAGS, ...Object.values(LEGACY_VERDICTS)].map((v) => [v.id, v]),
);

// Stare polskie etykiety tagow z pul -> id. Budowane z TAG_LABELS, wiec nie ma osobnej listy
// do utrzymania: kazda etykieta, ktora kiedys trafila do bazy, wciaz trafia na swoje id.
const LEGACY_TAG_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(TAG_LABELS).map(([id, l]) => [l.pl, id]),
);

/**
 * Kanoniczne id wartosci z pins.tags. Stara polska etykieta i nowe id daja to samo id, wiec
 * porownania ("czy ten tag jest juz wybrany") dzialaja na wyjazdach sprzed migracji.
 * Wolny tekst usera nie ma id - wraca sam do siebie.
 */
export function tagId(tag: string): string {
  return verdictOf(tag)?.id ?? LEGACY_TAG_IDS[tag] ?? tag;
}

/** Werdykt dla wartosci z pins.tags - przyjmuje i nowe id, i stara polska etykiete. */
export function verdictOf(tag: string): VerdictTag | null {
  return VERDICT_BY_ID[tag] ?? LEGACY_VERDICTS[tag] ?? null;
}

/**
 * Etykieta taga do wyswietlenia. Rozumie trzy postacie wartosci z pins.tags: id werdyktu,
 * id taga z puli oraz stara polska etykiete (jedno i drugie). Wolny tekst usera - tag wpisany
 * recznie - oddajemy bez zmian, bo nie mamy skad wziac tlumaczenia.
 * Bez podanego `lang` bierzemy jezyk z instancji i18n, zeby miejsca renderujace tagi nie musialy
 * go przekazywac (i nie musialy siegac po hook `t`, ktory bywa juz zajety lokalna zmienna).
 */
export function localizeTag(tag: string, lang?: string): string {
  const en = String(lang ?? i18n.language ?? "pl").toLowerCase().startsWith("en");
  const v = verdictOf(tag);
  if (v) return en ? v.en : v.pl;
  const label = TAG_LABELS[tag] ?? TAG_LABELS[LEGACY_TAG_IDS[tag]];
  if (label) return en ? label.en : label.pl;
  return tag;
}
