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

// Ile tagów pokazać przed rozwinięciem "Pokaż więcej".
export const ROUTE_TAGS_VISIBLE = 6;
export const PLACE_TAGS_VISIBLE = 5;
