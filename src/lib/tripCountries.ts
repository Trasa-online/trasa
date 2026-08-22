// Kraje + miasta dostepne przy TWORZENIU wyjazdu (ComposeWyjazd). W przeciwienstwie do
// COUNTRIES z CityPicker (PL-only, reszta "wkrotce" w eksploracji), tutaj WSZYSTKIE kraje
// sa odblokowane - userzy sami buduja baze tras na calym swiecie (miejsca dociagane z
// Google przez proxy, wiec dzialaja niezaleznie od naszej bazy `places`).
// Miasta = najwazniejsze/turystyczne per kraj (lista skrocona, nie wyczerpujaca).

export type TripCountry = { name: string; region: "Polska" | "Europa" | "Azja" | "Ameryka Północna" | "Ameryka Południowa" | "Afryka" | "Oceania"; cities: string[] };

export const TRIP_COUNTRIES: TripCountry[] = [
  { name: "Polska", region: "Polska", cities: ["Warszawa", "Kraków", "Gdańsk", "Sopot", "Gdynia", "Trójmiasto", "Wrocław", "Poznań", "Łódź", "Olsztyn", "Katowice", "Lublin", "Toruń", "Szczecin", "Zakopane"] },

  // ── Europa ──────────────────────────────────────────────────────────────
  { name: "Niemcy", region: "Europa", cities: ["Berlin", "Monachium", "Hamburg", "Kolonia", "Frankfurt", "Drezno"] },
  { name: "Francja", region: "Europa", cities: ["Paryż", "Lyon", "Marsylia", "Nicea", "Bordeaux", "Strasburg"] },
  { name: "Hiszpania", region: "Europa", cities: ["Barcelona", "Madryt", "Sewilla", "Walencja", "Malaga", "Grenada"] },
  { name: "Włochy", region: "Europa", cities: ["Rzym", "Mediolan", "Florencja", "Wenecja", "Neapol", "Bolonia"] },
  { name: "Wielka Brytania", region: "Europa", cities: ["Londyn", "Manchester", "Edynburg", "Liverpool", "Glasgow"] },
  { name: "Holandia", region: "Europa", cities: ["Amsterdam", "Rotterdam", "Haga", "Utrecht"] },
  { name: "Czechy", region: "Europa", cities: ["Praga", "Brno", "Karlowe Wary"] },
  { name: "Austria", region: "Europa", cities: ["Wiedeń", "Salzburg", "Innsbruck", "Graz"] },
  { name: "Portugalia", region: "Europa", cities: ["Lizbona", "Porto", "Faro"] },
  { name: "Grecja", region: "Europa", cities: ["Ateny", "Saloniki", "Kreta", "Santorini", "Rodos"] },
  { name: "Chorwacja", region: "Europa", cities: ["Zagrzeb", "Split", "Dubrownik", "Zadar"] },
  { name: "Węgry", region: "Europa", cities: ["Budapeszt", "Debreczyn"] },
  { name: "Belgia", region: "Europa", cities: ["Bruksela", "Brugia", "Antwerpia", "Gandawa"] },
  { name: "Szwajcaria", region: "Europa", cities: ["Zurych", "Genewa", "Lucerna", "Berno"] },
  { name: "Szwecja", region: "Europa", cities: ["Sztokholm", "Göteborg", "Malmö"] },
  { name: "Norwegia", region: "Europa", cities: ["Oslo", "Bergen", "Tromsø"] },
  { name: "Dania", region: "Europa", cities: ["Kopenhaga", "Aarhus"] },
  { name: "Litwa", region: "Europa", cities: ["Wilno", "Kowno", "Kłajpeda"] },
  { name: "Łotwa", region: "Europa", cities: ["Ryga", "Jurmała"] },
  { name: "Estonia", region: "Europa", cities: ["Tallinn", "Tartu", "Parnawa"] },
  { name: "Irlandia", region: "Europa", cities: ["Dublin", "Cork", "Galway"] },
  { name: "Islandia", region: "Europa", cities: ["Reykjavik"] },
  { name: "Turcja", region: "Europa", cities: ["Stambuł", "Antalya", "Kapadocja", "Izmir"] },
  { name: "Finlandia", region: "Europa", cities: ["Helsinki", "Rovaniemi", "Turku", "Tampere"] },
  { name: "Słowacja", region: "Europa", cities: ["Bratysława", "Koszyce", "Wysokie Tatry"] },
  { name: "Słowenia", region: "Europa", cities: ["Lublana", "Bled", "Piran"] },
  { name: "Rumunia", region: "Europa", cities: ["Bukareszt", "Braszów", "Kluż-Napoka", "Sybin"] },
  { name: "Bułgaria", region: "Europa", cities: ["Sofia", "Płowdiw", "Warna", "Burgas"] },
  { name: "Serbia", region: "Europa", cities: ["Belgrad", "Nowy Sad"] },
  { name: "Ukraina", region: "Europa", cities: ["Kijów", "Lwów", "Odessa"] },
  { name: "Cypr", region: "Europa", cities: ["Nikozja", "Limassol", "Pafos", "Ajia Napa"] },
  { name: "Malta", region: "Europa", cities: ["Valletta", "Sliema", "St. Julian's"] },
  { name: "Luksemburg", region: "Europa", cities: ["Luksemburg"] },
  { name: "Monako", region: "Europa", cities: ["Monako"] },
  { name: "Albania", region: "Europa", cities: ["Tirana", "Saranda", "Ksamil"] },
  { name: "Czarnogóra", region: "Europa", cities: ["Podgorica", "Kotor", "Budva"] },
  { name: "Bośnia i Hercegowina", region: "Europa", cities: ["Sarajewo", "Mostar"] },
  { name: "Macedonia Północna", region: "Europa", cities: ["Skopje", "Ochryda"] },

  // ── Azja ────────────────────────────────────────────────────────────────
  { name: "Japonia", region: "Azja", cities: ["Tokio", "Kioto", "Osaka", "Hiroszima", "Sapporo"] },
  { name: "Tajlandia", region: "Azja", cities: ["Bangkok", "Phuket", "Chiang Mai", "Krabi", "Pattaya"] },
  { name: "Wietnam", region: "Azja", cities: ["Hanoi", "Ho Chi Minh", "Da Nang", "Hoi An"] },
  { name: "Indonezja", region: "Azja", cities: ["Bali", "Dżakarta", "Yogyakarta"] },
  { name: "Zjednoczone Emiraty Arabskie", region: "Azja", cities: ["Dubaj", "Abu Zabi"] },
  { name: "Chiny", region: "Azja", cities: ["Pekin", "Szanghaj", "Hongkong", "Xi'an"] },
  { name: "Korea Południowa", region: "Azja", cities: ["Seul", "Busan", "Jeju"] },
  { name: "Indie", region: "Azja", cities: ["Delhi", "Bombaj", "Goa", "Jaipur"] },
  { name: "Singapur", region: "Azja", cities: ["Singapur"] },
  { name: "Malezja", region: "Azja", cities: ["Kuala Lumpur", "Penang", "Langkawi"] },
  { name: "Filipiny", region: "Azja", cities: ["Manila", "Cebu", "Palawan", "Boracay"] },
  { name: "Sri Lanka", region: "Azja", cities: ["Kolombo", "Kandy", "Galle"] },
  { name: "Gruzja", region: "Azja", cities: ["Tbilisi", "Batumi"] },
  { name: "Kambodża", region: "Azja", cities: ["Phnom Penh", "Siem Reap"] },
  { name: "Nepal", region: "Azja", cities: ["Katmandu", "Pokhara"] },
  { name: "Izrael", region: "Azja", cities: ["Tel Awiw", "Jerozolima", "Hajfa"] },
  { name: "Jordania", region: "Azja", cities: ["Amman", "Akaba", "Petra"] },
  { name: "Katar", region: "Azja", cities: ["Doha"] },
  { name: "Oman", region: "Azja", cities: ["Maskat", "Salala"] },
  { name: "Armenia", region: "Azja", cities: ["Erywań"] },
  { name: "Azerbejdżan", region: "Azja", cities: ["Baku"] },
  { name: "Kazachstan", region: "Azja", cities: ["Astana", "Ałmaty"] },
  { name: "Malediwy", region: "Azja", cities: ["Male"] },
  { name: "Mongolia", region: "Azja", cities: ["Ułan Bator"] },

  // ── Ameryka Północna ────────────────────────────────────────────────────
  { name: "Stany Zjednoczone", region: "Ameryka Północna", cities: ["Nowy Jork", "Los Angeles", "San Francisco", "Las Vegas", "Miami", "Chicago", "Waszyngton", "Boston"] },
  { name: "Kanada", region: "Ameryka Północna", cities: ["Toronto", "Vancouver", "Montreal", "Quebec", "Ottawa"] },
  { name: "Meksyk", region: "Ameryka Północna", cities: ["Meksyk", "Cancún", "Guadalajara", "Tulum", "Playa del Carmen"] },
  { name: "Kuba", region: "Ameryka Północna", cities: ["Hawana", "Varadero", "Trinidad"] },
  { name: "Kostaryka", region: "Ameryka Północna", cities: ["San José", "Tamarindo"] },
  { name: "Panama", region: "Ameryka Północna", cities: ["Panama"] },
  { name: "Dominikana", region: "Ameryka Północna", cities: ["Santo Domingo", "Punta Cana"] },

  // ── Ameryka Południowa ──────────────────────────────────────────────────
  { name: "Brazylia", region: "Ameryka Południowa", cities: ["Rio de Janeiro", "São Paulo", "Salvador", "Foz do Iguaçu"] },
  { name: "Argentyna", region: "Ameryka Południowa", cities: ["Buenos Aires", "Mendoza", "Bariloche", "Ushuaia"] },
  { name: "Peru", region: "Ameryka Południowa", cities: ["Lima", "Cusco", "Arequipa"] },
  { name: "Chile", region: "Ameryka Południowa", cities: ["Santiago", "Valparaíso", "San Pedro de Atacama"] },
  { name: "Kolumbia", region: "Ameryka Południowa", cities: ["Bogota", "Medellín", "Cartagena"] },
  { name: "Ekwador", region: "Ameryka Południowa", cities: ["Quito", "Guayaquil"] },
  { name: "Boliwia", region: "Ameryka Południowa", cities: ["La Paz", "Uyuni"] },
  { name: "Urugwaj", region: "Ameryka Południowa", cities: ["Montevideo", "Punta del Este"] },

  // ── Afryka ──────────────────────────────────────────────────────────────
  { name: "Egipt", region: "Afryka", cities: ["Kair", "Hurghada", "Sharm el-Sheikh", "Luksor"] },
  { name: "Maroko", region: "Afryka", cities: ["Marrakesz", "Casablanca", "Fez", "Agadir"] },
  { name: "Tunezja", region: "Afryka", cities: ["Tunis", "Susa", "Dżerba"] },
  { name: "Republika Południowej Afryki", region: "Afryka", cities: ["Kapsztad", "Johannesburg", "Durban"] },
  { name: "Kenia", region: "Afryka", cities: ["Nairobi", "Mombasa"] },
  { name: "Tanzania", region: "Afryka", cities: ["Zanzibar", "Dar es Salaam", "Arusza"] },
  { name: "Mauritius", region: "Afryka", cities: ["Port Louis"] },
  { name: "Seszele", region: "Afryka", cities: ["Victoria"] },
  { name: "Namibia", region: "Afryka", cities: ["Windhuk", "Swakopmund"] },

  // ── Oceania ─────────────────────────────────────────────────────────────
  { name: "Australia", region: "Oceania", cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Cairns"] },
  { name: "Nowa Zelandia", region: "Oceania", cities: ["Auckland", "Wellington", "Queenstown", "Christchurch"] },
  { name: "Fidżi", region: "Oceania", cities: ["Suva", "Nadi"] },
];

export const TRIP_REGIONS: TripCountry["region"][] = ["Polska", "Europa", "Azja", "Ameryka Północna", "Ameryka Południowa", "Afryka", "Oceania"];

// Kraj zawierajacy dane miasto (do odtworzenia selektora kraju z zapisanego miasta).
export function countryForCity(city: string | null | undefined): string {
  if (!city) return "Polska";
  return TRIP_COUNTRIES.find((c) => c.cities.includes(city))?.name ?? "Polska";
}

export function citiesForCountry(country: string): string[] {
  return TRIP_COUNTRIES.find((c) => c.name === country)?.cities ?? TRIP_COUNTRIES[0].cities;
}
