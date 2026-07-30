// Kraje + miasta dostepne przy TWORZENIU wyjazdu (ComposeWyjazd). W przeciwienstwie do
// COUNTRIES z CityPicker (PL-only, reszta "wkrotce" w eksploracji), tutaj WSZYSTKIE kraje
// sa odblokowane - userzy sami buduja baze tras dla Europy i Azji (miejsca dociagane z
// Google przez proxy, wiec dzialaja niezaleznie od naszej bazy `places`).
// Miasta = najwazniejsze/turystyczne per kraj (lista skrocona, nie wyczerpujaca).

export type TripCountry = { name: string; region: "Polska" | "Europa" | "Azja"; cities: string[] };

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
  { name: "Irlandia", region: "Europa", cities: ["Dublin", "Cork", "Galway"] },
  { name: "Islandia", region: "Europa", cities: ["Reykjavik"] },
  { name: "Turcja", region: "Europa", cities: ["Stambuł", "Antalya", "Kapadocja", "Izmir"] },

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
];

export const TRIP_REGIONS: TripCountry["region"][] = ["Polska", "Europa", "Azja"];

// Kraj zawierajacy dane miasto (do odtworzenia selektora kraju z zapisanego miasta).
export function countryForCity(city: string | null | undefined): string {
  if (!city) return "Polska";
  return TRIP_COUNTRIES.find((c) => c.cities.includes(city))?.name ?? "Polska";
}

export function citiesForCountry(country: string): string[] {
  return TRIP_COUNTRIES.find((c) => c.name === country)?.cities ?? TRIP_COUNTRIES[0].cities;
}
