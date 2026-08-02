// Zamockowane trasy pod fake door test. NIE dotykaja bazy - czysty frontend.
// Zdjecia: picsum (deterministyczny seed = stabilny obraz, zawsze sie laduje).
// Docelowo podmienimy na realne trasy z Supabase (is_shared = true).

export type MockPlace = {
  name: string;
  category: string;
  note: string;
};

export type MockRoute = {
  id: string;
  title: string;
  city: string;
  author: string;
  duration: string;
  tags: string[];
  intro: string;
  places: MockPlace[];
};

// Stabilny obraz z picsum po seedzie (nazwa = seed).
export const routeCover = (id: string) => `https://picsum.photos/seed/trasa-${id}/900/675`;
export const placeThumb = (id: string, i: number) => `https://picsum.photos/seed/trasa-${id}-${i}/240/240`;

export const CITIES = ["Warszawa", "Kraków", "Trójmiasto", "Wrocław"] as const;

export const MOCK_ROUTES: MockRoute[] = [
  {
    id: "praga-sztuka-winyl",
    title: "Praga inaczej: sztuka, wódka i winyl",
    city: "Warszawa",
    author: "Kaśka",
    duration: "1 dzień",
    tags: ["sztuka", "klimat", "wieczór"],
    intro:
      "Prawa strona Wisły w wersji dla ciekawych. Zaczynamy od podwórek z muralami, kończymy przy winylach i nalewce. Zero turystycznej szmiry, same miejsca do których wracam.",
    places: [
      { name: "Koneser - dziedziniec", category: "Miejsce", note: "Wejdź od bramy, poczuj starą wytwórnię wódki. Rano pusto, idealnie na kawę." },
      { name: "Muzeum Neonów", category: "Muzeum", note: "Mały, ale robi robotę. Najlepsze światło przed zamknięciem." },
      { name: "Syreni Śpiew", category: "Bar", note: "Nalewki własnej roboty. Zapytaj barmana o tę z pigwy." },
      { name: "Side One", category: "Sklep", note: "Winyle i kawa. Można grzebać godzinami, nikt nie pogania." },
      { name: "W Oparach Absurdu", category: "Bar", note: "Na koniec wieczoru. Klimat starej Pragi bez pozy." },
    ],
  },
  {
    id: "sniadaniowa-petla-srodmiescie",
    title: "Śniadaniowa pętla po Śródmieściu",
    city: "Warszawa",
    author: "Michał",
    duration: "pół dnia",
    tags: ["śniadanie", "kawa", "spacer"],
    intro:
      "Sobota bez planu, za to z apetytem. Trzy śniadania w jednej okolicy - bo od jednego się nie umiera. Krótkie dystanse, dużo kawy, zero pośpiechu.",
    places: [
      { name: "Charlotte Plac Zbawiciela", category: "Kawiarnia", note: "Croissant i lampka wina o poranku. Tak, o poranku." },
      { name: "Beze mnie", category: "Kawiarnia", note: "Najlepsze bezy w mieście. Weź na wynos, zjesz w parku." },
      { name: "Park Ujazdowski", category: "Park", note: "Przerwa między śniadaniami. Ławka nad stawem." },
      { name: "Koszyki - hala", category: "Restauracja", note: "Drugie śniadanie. Wybór na każdy głód." },
    ],
  },
  {
    id: "zielona-warszawa-lazienki",
    title: "Zielona Warszawa: Łazienki i okolice",
    city: "Warszawa",
    author: "Ola",
    duration: "1 dzień",
    tags: ["natura", "rodzinnie", "spacer"],
    intro:
      "Dzień na wolniej. Pawie, wiewiórki, woda i trochę pałacowego przepychu. Trasa spokojna, dobra na kaca albo na randkę.",
    places: [
      { name: "Łazienki Królewskie", category: "Park", note: "Wejdź od strony Agrykoli, mniej ludzi. Pałac na Wodzie obowiązkowo." },
      { name: "Pomnik Chopina", category: "Punkt widokowy", note: "W niedzielę latem koncerty za darmo. Przyjdź wcześniej po miejsce." },
      { name: "Belweder - ogród", category: "Miejsce", note: "Cichy zakątek tuż obok, prawie nikt tam nie zagląda." },
      { name: "Trakt Królewski", category: "Spacer", note: "Zejdź w stronę centrum, mijasz ambasady i stare kamienice." },
    ],
  },
  {
    id: "wieczor-na-powislu",
    title: "Wieczór na Powiślu",
    city: "Warszawa",
    author: "Bartek",
    duration: "wieczór",
    tags: ["wieczór", "nad wodą", "znajomi"],
    intro:
      "Kiedy słońce schodzi za most, Powiśle robi się najlepsze. Od bulwarów po knajpę bez szyldu. Weź kogoś ze sobą, to trasa do gadania.",
    places: [
      { name: "Bulwary Wiślane", category: "Punkt widokowy", note: "Start o zachodzie. Usiądź na schodach przy pomniku syrenki." },
      { name: "BarKa", category: "Bar", note: "Knajpa na wodzie. Wejdź wcześnie, bo zapełnia się błyskawicznie." },
      { name: "Elektrownia Powiśle", category: "Miejsce", note: "Nawet jak nie kupujesz, warto wejść dla samej przestrzeni." },
      { name: "Warszawa Powiśle", category: "Bar", note: "Dawny kasownik biletów, teraz kultowy bar. Klasyk na koniec." },
    ],
  },
  {
    id: "kawowa-mapa-mokotowa",
    title: "Kawowa mapa Mokotowa",
    city: "Warszawa",
    author: "Zofia",
    duration: "pół dnia",
    tags: ["kawa", "specialty", "spokój"],
    intro:
      "Dla tych, co traktują kawę poważnie. Cztery palarnie i kawiarnie, w których wiedzą co robią. Bierz na czczo, wracaj naładowany.",
    places: [
      { name: "Coffeedesk Mokotów", category: "Kawiarnia", note: "Filtr dnia zawsze inny. Zapytaj skąd ziarno." },
      { name: "Stor", category: "Kawiarnia", note: "Minimalizm i świetne flat white. Miejsce na laptopa." },
      { name: "Forum Mokotów", category: "Miejsce", note: "Przerwa na spacer między kawami, ładna zieleń." },
      { name: "Relaks", category: "Kawiarnia", note: "Kultowa, mała, zawsze pełna. Sernik godny grzechu." },
    ],
  },
  {
    id: "kazimierz-od-zmierzchu",
    title: "Kazimierz od zmierzchu do świtu",
    city: "Kraków",
    author: "Tomek",
    duration: "wieczór",
    tags: ["wieczór", "klimat", "muzyka"],
    intro:
      "Kazimierz nocą to osobny organizm. Zaczynasz od zapiekanki, kończysz przy jazzie w piwnicy. Trasa dla nocnych marków.",
    places: [
      { name: "Plac Nowy - okrąglak", category: "Restauracja", note: "Legendarna zapiekanka. Podstawa przed wieczorem." },
      { name: "Alchemia", category: "Bar", note: "Świece, drewno, muzyka na żywo. Serce kazimierskiej nocy." },
      { name: "Hevre", category: "Bar", note: "Dawna synagoga, dziś knajpa. Wnętrze robi wrażenie." },
      { name: "Piec Art", category: "Klub", note: "Jazz w piwnicy. Sprawdź kto gra, często wchodzisz za darmo." },
    ],
  },
  {
    id: "krakow-dla-lasuchow",
    title: "Kraków dla łasuchów",
    city: "Kraków",
    author: "Nina",
    duration: "1 dzień",
    tags: ["jedzenie", "słodko", "spacer"],
    intro:
      "Trasa, po której trzeba poluzować pasek. Od obwarzanka po najlepsze lody w mieście. Idealna na leniwą niedzielę we dwoje.",
    places: [
      { name: "Rynek Główny - obwarzanki", category: "Miejsce", note: "Kup od babci z wózka, nie z sieciówki. Poczujesz różnicę." },
      { name: "Cukiernia Vanilla", category: "Kawiarnia", note: "Tarta cytrynowa poza konkurencją. Przyjdź na otwarcie." },
      { name: "Good Lood", category: "Restauracja", note: "Lody rzemieślnicze, smaki co dzień inne. Kolejka szybko idzie." },
      { name: "Bulwary Wiślane", category: "Punkt widokowy", note: "Zejdź z lodami nad rzekę, widok na Wawel gratis." },
    ],
  },
  {
    id: "gdansk-starowka-port",
    title: "Gdańsk: starówka i port",
    city: "Trójmiasto",
    author: "Paweł",
    duration: "1 dzień",
    tags: ["historia", "nad wodą", "spacer"],
    intro:
      "Od Długiego Targu po dźwigi stoczni. Gdańsk łączy bursztyn z surowym portem i to jest w nim najlepsze. Dużo chodzenia, weź wygodne buty.",
    places: [
      { name: "Długi Targ", category: "Miejsce", note: "Rano, zanim wjadą wycieczki. Fontanna Neptuna dla siebie." },
      { name: "Żuraw nad Motławą", category: "Muzeum", note: "Najstarszy dźwig portowy Europy. Wejdź do środka." },
      { name: "Wyspa Spichrzów", category: "Punkt widokowy", note: "Nowa promenada, świetna na kawę z widokiem na starówkę." },
      { name: "ECS - dach", category: "Punkt widokowy", note: "Taras widokowy za darmo. Panorama stoczni jak na dłoni." },
    ],
  },
  {
    id: "sopot-w-jeden-dzien",
    title: "Sopot w jeden dzień",
    city: "Trójmiasto",
    author: "Ela",
    duration: "1 dzień",
    tags: ["plaża", "relaks", "molo"],
    intro:
      "Kurort w pigułce. Molo, plaża, monciak i zachód nad zatoką. Trasa bez wysiłku, sama przyjemność. Latem przyjdź wcześnie po miejsce na piasku.",
    places: [
      { name: "Molo w Sopocie", category: "Punkt widokowy", note: "Przejdź na koniec, popatrz na Gdynię i Hel. Rano taniej." },
      { name: "Krzywy Domek", category: "Miejsce", note: "Monciak w pełnej krasie. Dobre na szybkie zdjęcie i lody." },
      { name: "Plaża Sopot", category: "Park", note: "Rozłóż się bliżej Kamiennego Potoku, mniej tłoczno." },
      { name: "Bar Przystań", category: "Restauracja", note: "Ryba prosto z kutra, na koniec dnia. Zachód gratis." },
    ],
  },
  {
    id: "wroclaw-krasnale-kraft",
    title: "Wrocław: krasnale i kraft",
    city: "Wrocław",
    author: "Grześ",
    duration: "1 dzień",
    tags: ["spacer", "piwo", "rodzinnie"],
    intro:
      "Trasa z przymrużeniem oka. Szukasz krasnali, po drodze wpadasz na dobre piwo i wyspy nad Odrą. Działa i z dziećmi, i ze znajomymi.",
    places: [
      { name: "Rynek - Ratusz", category: "Miejsce", note: "Zacznij od krasnala przy pręgierzu. Reszta sama się znajdzie." },
      { name: "Ostrów Tumski", category: "Punkt widokowy", note: "Najstarsza część miasta. O zmierzchu latarnik zapala gazowe lampy." },
      { name: "Kontynuacja Cafe", category: "Bar", note: "Lokalny kraft z beczki. Załoga podpowie co pod twój gust." },
      { name: "Wyspa Słodowa", category: "Park", note: "Zielony luz nad wodą. Weekendem gra tu pół miasta." },
    ],
  },
];

export const routeById = (id: string) => MOCK_ROUTES.find((r) => r.id === id);
