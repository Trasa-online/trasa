// Kraj + miasto rodzime usera ("skąd jesteś?" w onboardingu / ProfileSetup).
// Uzywane do logiki "lokals poleca!" w Eksploruj: gdy home_city autora trasy == miasto trasy,
// pokazujemy badge "lokals poleca!" z jego profilowym i nazwa.
export interface OriginCountry {
  name: string;
  flag: string;
  cities: string[];
}

export const ORIGIN_COUNTRIES: OriginCountry[] = [
  { name: "Polska", flag: "🇵🇱", cities: ["Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Sopot", "Gdynia", "Trójmiasto", "Szczecin", "Lublin", "Katowice", "Bydgoszcz", "Białystok", "Toruń", "Rzeszów", "Olsztyn"] },
  { name: "Niemcy", flag: "🇩🇪", cities: ["Berlin", "Monachium", "Hamburg", "Kolonia"] },
  { name: "Czechy", flag: "🇨🇿", cities: ["Praga", "Brno", "Ostrawa"] },
  { name: "Wielka Brytania", flag: "🇬🇧", cities: ["Londyn", "Manchester", "Edynburg"] },
  { name: "Ukraina", flag: "🇺🇦", cities: ["Kijów", "Lwów", "Odessa"] },
  { name: "Węgry", flag: "🇭🇺", cities: ["Budapeszt"] },
  { name: "Hiszpania", flag: "🇪🇸", cities: ["Barcelona", "Madryt"] },
  { name: "Włochy", flag: "🇮🇹", cities: ["Rzym", "Mediolan"] },
  { name: "Portugalia", flag: "🇵🇹", cities: ["Lizbona", "Porto"] },
];

export function citiesForCountry(country: string): string[] {
  return ORIGIN_COUNTRIES.find((c) => c.name === country)?.cities ?? [];
}
