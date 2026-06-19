// "Trójmiasto" to meta-miasto: po normalizacji danych (migracja 20260620_trojmiasto_subcities)
// miejsca maja realne city = Gdańsk / Gdynia / Sopot. Gdy user wybierze "Trójmiasto",
// rozwijamy je na trzy sub-miasta do filtra `.in("city", expandCity(city))`.
export const TROJMIASTO_SUBCITIES = ["Gdańsk", "Gdynia", "Sopot"] as const;

export function expandCity(city: string): string[] {
  return city === "Trójmiasto" ? [...TROJMIASTO_SUBCITIES] : [city];
}
