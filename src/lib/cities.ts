import type { LatLng } from "@/lib/distance";

// "Trójmiasto" to meta-miasto: po normalizacji danych (migracja 20260620_trojmiasto_subcities)
// miejsca maja realne city = Gdansk / Gdynia / Sopot. Gdy user wybierze meta-miasto,
// rozwijamy je na trzy sub-miasta do filtra `.in("city", expandCity(city))`.
export const TROJMIASTO_SUBCITIES = ["Gdańsk", "Gdynia", "Sopot"] as const;   // i18n-ignore: wartosci dopasowywane do places.city w bazie

export function expandCity(city: string): string[] {
  return city === "Trójmiasto" ? [...TROJMIASTO_SUBCITIES] : [city];   // i18n-ignore: porownanie z wartoscia z bazy
}

// Centra miast - do centrowania mapy (punkt startowy) ORAZ walidacji on-site (czy GPS usera
// jest w pobliżu miasta docelowego). MUSI zawierac kazde miasto z pickera, w tym sub-miasta
// Trojmiasta (inaczej mapa/limit leciał na zły fallback).
// i18n-ignore-start: klucze = nazwy miast dopasowywane do places.city w bazie, nie copy
export const CITY_CENTERS: Record<string, LatLng> = {
  "Kraków":    { lat: 50.0617, lng: 19.9373 },
  "Warszawa":  { lat: 52.2297, lng: 21.0122 },
  "Wrocław":   { lat: 51.1079, lng: 17.0385 },
  "Poznań":    { lat: 52.4064, lng: 16.9252 },
  "Zakopane":  { lat: 49.2992, lng: 19.9496 },
  "Łódź":      { lat: 51.7592, lng: 19.4560 },
  "Trójmiasto":{ lat: 54.3520, lng: 18.6466 },
  "Gdańsk":    { lat: 54.3520, lng: 18.6466 },
  "Sopot":     { lat: 54.4418, lng: 18.5601 },
  "Gdynia":    { lat: 54.5189, lng: 18.5305 },
  "Budapeszt": { lat: 47.4979, lng: 19.0402 },
  "Valletta":  { lat: 35.8997, lng: 14.5147 },
};
// i18n-ignore-end

// Centrum miasta (lub pierwszego sub-miasta) - null gdy nieznane.
export function getCityCenter(city: string): LatLng | null {
  if (!city) return null;
  return CITY_CENTERS[city] ?? CITY_CENTERS[expandCity(city)[0]] ?? null;
}

// Dopelniacz nazwy miasta ("Wyjazd do <tu>") - do ladnych, odmienionych nazw tras.
// Mapa recznie dla znanych miast; heurystyka dla nieznanych (zenskie -a -> -y), inaczej mianownik.
// i18n-ignore-start: odmiana polskich nazw miast (dopelniacz) - POLSKA gramatyka,
// uzywana wylacznie w polskiej galezi; angielski nie odmienia nazw miast.
const CITY_GENITIVE: Record<string, string> = {
  "Warszawa": "Warszawy",
  "Kraków": "Krakowa",
  "Gdańsk": "Gdańska",
  "Sopot": "Sopotu",
  "Gdynia": "Gdyni",
  "Trójmiasto": "Trójmiasta",
  "Wrocław": "Wrocławia",
  "Olsztyn": "Olsztyna",
  "Łódź": "Łodzi",
  "Poznań": "Poznania",
  "Zakopane": "Zakopanego",
  "Katowice": "Katowic",
  "Lublin": "Lublina",
  "Szczecin": "Szczecina",
  "Bydgoszcz": "Bydgoszczy",
  "Toruń": "Torunia",
  // Zagraniczne
  "Berlin": "Berlina",
  "Rzym": "Rzymu",
  "Budapeszt": "Budapesztu",
  "Barcelona": "Barcelony",
  "Lizbona": "Lizbony",
  "Valletta": "Valletty",
  "Tokio": "Tokio",
  "Paryż": "Paryża",
  "Londyn": "Londynu",
  "Praga": "Pragi",
  "Wiedeń": "Wiednia",
  "Amsterdam": "Amsterdamu",
  "Madryt": "Madrytu",
  "Mediolan": "Mediolanu",
};
// i18n-ignore-end

export function cityGenitive(city: string | null | undefined): string {
  const c = (city ?? "").trim();
  if (!c) return c;
  if (CITY_GENITIVE[c]) return CITY_GENITIVE[c];
  // Heurystyka: zakonczone spolgloska + "a" -> "y" (Barcelona->Barcelony). Inaczej mianownik.
  if (/[bcdfghjklmnprstwz]a$/i.test(c)) return c.slice(0, -1) + "y";
  return c;
}
