import type { LatLng } from "@/lib/distance";

// "Trójmiasto" to meta-miasto: po normalizacji danych (migracja 20260620_trojmiasto_subcities)
// miejsca maja realne city = Gdańsk / Gdynia / Sopot. Gdy user wybierze "Trójmiasto",
// rozwijamy je na trzy sub-miasta do filtra `.in("city", expandCity(city))`.
export const TROJMIASTO_SUBCITIES = ["Gdańsk", "Gdynia", "Sopot"] as const;

export function expandCity(city: string): string[] {
  return city === "Trójmiasto" ? [...TROJMIASTO_SUBCITIES] : [city];
}

// Centra miast - do centrowania mapy (punkt startowy) ORAZ walidacji on-site (czy GPS usera
// jest w pobliżu miasta docelowego). MUSI zawierac kazde miasto z pickera, w tym sub-miasta
// Trojmiasta (inaczej mapa/limit leciał na zły fallback).
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

// Centrum miasta (lub pierwszego sub-miasta) - null gdy nieznane.
export function getCityCenter(city: string): LatLng | null {
  if (!city) return null;
  return CITY_CENTERS[city] ?? CITY_CENTERS[expandCity(city)[0]] ?? null;
}
