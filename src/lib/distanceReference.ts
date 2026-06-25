import { useState, useEffect } from "react";
import { type LatLng, haversineKm } from "@/lib/distance";
import { requestLocation, getCachedCoords } from "@/hooks/useGeolocation";
import { getCityCenter } from "@/lib/cities";

// Prog "jestes na miejscu": GPS w promieniu od centrum miasta docelowego.
const ONSITE_THRESHOLD_KM = 35;

// Wspolny "punkt odniesienia" dla dystansu i sortowania, niezalezny od tego CZY to GPS
// (jestes na miejscu) czy punkt startowy z mapy (planujesz z wyprzedzeniem). Jeden wybrany
// punkt na kontekst miasta. Chip pokazuje "X od {label}" (od Ciebie / od startu), sort
// "od najblizszego" liczy od ref.coords.
//
// Module-level store + listeners (wzorzec jak useGeolocation). Per-miasto: zmiana miasta
// czysci ref (inne miasto = inny punkt odniesienia).

export type DistanceRef = { coords: LatLng; label: string; source: "gps" | "start" } | null;

let currentRef: DistanceRef = null;
let currentCity: string | null = null;
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((l) => l());

// "Czy juz pytalismy dla tego miasta" - sessionStorage (nie permanentne; nowa sesja =
// pytamy znowu, bo user moze byc juz na miejscu).
const askedKey = (city: string) => `trasa_loc_asked_${(city || "").toLowerCase()}`;
export const wasAskedForCity = (city: string): boolean => {
  try { return sessionStorage.getItem(askedKey(city)) === "1"; } catch { return false; }
};
export const markAskedForCity = (city: string) => {
  try { sessionStorage.setItem(askedKey(city), "1"); } catch { /* ignore */ }
};

export function getReference(): DistanceRef {
  return currentRef;
}

// Ustaw punkt startowy (z mapy miasta docelowego) jako odniesienie.
export function setStartReference(coords: LatLng) {
  currentRef = { coords, label: "startu", source: "start" };
  notifyAll();
}

// Sprobuj ustawic GPS jako odniesienie (systemowy prompt). Zwraca true gdy sie udalo.
export async function setGpsReference(): Promise<boolean> {
  const coords = await requestLocation();
  if (!coords) return false;
  currentRef = { coords, label: "Ciebie", source: "gps" };
  notifyAll();
  return true;
}

export function clearReference() {
  currentRef = null;
  notifyAll();
}

// Walidacja "czy user jest w miescie docelowym" przez GPS. NIE promptuje - uzywa GPS tylko
// gdy mamy juz zgode (coords w cache, np. z onboardingu). Gdy on-site - ustawia GPS jako
// punkt odniesienia automatycznie. Zwraca:
//   "onsite"  - mamy GPS i jestesmy blisko centrum miasta (ref ustawiony na "od Ciebie"),
//   "offsite" - mamy GPS ale daleko (user planuje z innego miejsca),
//   "no-gps"  - brak zgody/pozycji lub nieznane miasto (pokaz jawny sheet).
export async function tryResolveOnSite(city: string): Promise<"onsite" | "offsite" | "no-gps"> {
  const center = getCityCenter(city);
  if (!center) return "no-gps";
  if (!getCachedCoords()) return "no-gps"; // brak zgody - nie promptujemy tutaj
  // Mamy zgode - odswiez pozycje (user mogl sie przemiescic od onboardingu).
  const coords = (await requestLocation(true)) ?? getCachedCoords();
  if (!coords) return "no-gps";
  if (haversineKm(coords, center) <= ONSITE_THRESHOLD_KM) {
    currentRef = { coords, label: "Ciebie", source: "gps" };
    notifyAll();
    return "onsite";
  }
  return "offsite";
}

// Ustaw kontekst miasta; gdy zmienia sie na inne miasto - czysci ref (inny punkt odniesienia).
export function ensureCityContext(city: string) {
  if (!city) return;
  if (currentCity && city.toLowerCase() !== currentCity.toLowerCase()) {
    currentRef = null;
    notifyAll();
  }
  currentCity = city;
}

export function useDistanceReference(): DistanceRef {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return currentRef;
}
