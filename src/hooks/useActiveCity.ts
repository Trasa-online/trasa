import { useState, useCallback } from "react";
import { ALL_CITIES } from "@/components/home/CitySelect";

const KEY = "trasa_active_city";

// Wspoldzielone (persystowane) miasto dla zakladek agregujacych (Wyjazdy, Zapisane).
// Domyslnie "all" (Wszystkie) - nie chowamy tresci z innych miast dopoki user sam nie
// zawezi. Jedna zakladka jest aktywna na raz, wiec odczyt z localStorage na mount wystarcza.
export function useActiveCity(): [string, (city: string) => void] {
  const [city, setCityState] = useState<string>(() => {
    try { return localStorage.getItem(KEY) || ALL_CITIES; } catch { return ALL_CITIES; }
  });
  const setCity = useCallback((c: string) => {
    setCityState(c);
    try { localStorage.setItem(KEY, c); } catch { /* noop */ }
  }, []);
  return [city, setCity];
}
