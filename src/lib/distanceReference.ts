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

// "Czy juz pytalismy o lokalizacje" - GLOBALNIE i TRWALE (localStorage). Raz ustalona lokalizacja
// wystarcza dla kazdego miasta - user nie chce byc pytany w kolko przy kazdym przegladaniu
// (Warszawa/Gdansk/Gdynia) ani po restarcie natywki. Param `city` zostawiony dla zgodnosci API,
// ale flaga jest globalna (nie per-miasto). User moze pozniej wlaczyc dystans recznie.
const ASKED_KEY = "trasa_loc_asked_global_v1";
export const wasAskedForCity = (_city?: string): boolean => {
  try { return localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; }
};
export const markAskedForCity = (_city?: string) => {
  try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }
};

// Persystencja refu GPS (fizyczna lokalizacja usera) w localStorage - przetrwa restart natywki,
// zeby apka "zrozumiala raz" gdzie user jest. Refy "start" (punkt z mapy, per-miasto) NIE sa
// persystowane (sa efemeryczne i zwiazane z konkretnym miastem).
const REF_KEY = "trasa_distance_ref_v1";
function persistGpsRef() {
  try {
    if (currentRef?.source === "gps") {
      localStorage.setItem(REF_KEY, JSON.stringify({ coords: currentRef.coords, label: currentRef.label }));
    }
  } catch { /* ignore */ }
}
function clearPersistedRef() {
  try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
}
// Rehydracja przy starcie modulu (tylko ref GPS) - dzieki temu po restarcie apka pamieta
// lokalizacje usera i nie pyta ponownie.
try {
  const raw = localStorage.getItem(REF_KEY);
  if (raw) {
    const p = JSON.parse(raw);
    if (p?.coords && Number.isFinite(p.coords.lat) && Number.isFinite(p.coords.lng)) {
      currentRef = { coords: p.coords, label: p.label ?? "Ciebie", source: "gps" };
    }
  }
} catch { /* ignore */ }

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
  persistGpsRef();
  return true;
}

// Wymus GPS jako odniesienie z konkretnych coords (po potwierdzeniu "na pewno jestem").
export function forceGpsReference(coords: LatLng) {
  currentRef = { coords, label: "Ciebie", source: "gps" };
  notifyAll();
  persistGpsRef();
}

// Walidujacy GPS dla jawnego "Tak, jestem na miejscu" - PROMPTUJE o lokalizacje i sprawdza,
// czy user faktycznie jest w pobliżu miasta docelowego (double-check przed ustawieniem chipu
// "od Ciebie"). on-site -> ustawia ref. offsite -> NIE ustawia, zwraca dystans do potwierdzenia.
export async function resolveGpsForCity(
  city: string,
): Promise<{ status: "onsite" | "offsite" | "no-gps"; km?: number; coords?: LatLng }> {
  const coords = await requestLocation(true);
  if (!coords) return { status: "no-gps" };
  const center = getCityCenter(city);
  if (!center) {
    // Nieznane centrum miasta - nie mamy jak walidowac, ufamy userowi.
    forceGpsReference(coords);
    return { status: "onsite", coords };
  }
  const km = haversineKm(coords, center);
  if (km <= ONSITE_THRESHOLD_KM) {
    forceGpsReference(coords);
    return { status: "onsite", km, coords };
  }
  return { status: "offsite", km, coords };
}

export function clearReference() {
  currentRef = null;
  notifyAll();
  clearPersistedRef();
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
    persistGpsRef();
    return "onsite";
  }
  return "offsite";
}

// Ustaw kontekst miasta. Gdy zmienia sie na inne miasto - czysci TYLKO ref "start" (punkt z mapy,
// zwiazany z konkretnym miastem). Ref GPS to fizyczna lokalizacja usera - wazna dla kazdego miasta,
// NIE czyscimy (inaczej apka pytalaby o lokalizacje przy kazdej zmianie Warszawa/Gdansk/Gdynia).
export function ensureCityContext(city: string) {
  if (!city) return;
  if (currentCity && city.toLowerCase() !== currentCity.toLowerCase()) {
    if (currentRef?.source === "start") {
      currentRef = null;
      notifyAll();
    }
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
