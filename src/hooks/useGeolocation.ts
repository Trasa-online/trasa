import { useState, useEffect } from "react";
import { isNative } from "@/lib/platform";
import type { LatLng } from "@/lib/distance";

// Geolokalizacja uzytkownika - dual-platform (Capacitor na native, navigator.geolocation
// na web). Wynik trzymany w module-level cache i wspoldzielony przez wszystkie komponenty
// (jedno zapytanie na sesje). NIC nie zapisujemy na serwer - lokalizacja zyje tylko w pamieci.
//
// Zgoda w kontekscie: o lokalizacje prosimy dopiero przy akcji, ktora jej potrzebuje (chip
// "Pokaz dystans", checklist odwiedzonych) - wtedy requestLocation() odpala systemowy prompt.
// Flaga `trasa_geo_primed_v1` zapobiega ponownemu pytaniu.

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

let cachedCoords: LatLng | null = null;
let currentStatus: GeoStatus = "idle";
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((l) => l());

// Persystencja coords w localStorage - przetrwa restart natywki, zeby nie pytac ponownie o GPS
// (apka "rozumie raz" gdzie user jest). force=true i tak odswiezy swieza pozycje gdy trzeba.
const COORDS_KEY = "trasa_geo_coords_v1";
try {
  const raw = localStorage.getItem(COORDS_KEY);
  if (raw) {
    const p = JSON.parse(raw);
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) cachedCoords = p;
  }
} catch { /* ignore */ }
function persistCoords() {
  try { if (cachedCoords) localStorage.setItem(COORDS_KEY, JSON.stringify(cachedCoords)); } catch { /* ignore */ }
}

// v2: bump zeby userzy zablokowani na v1 (zamkneli primer "Nie teraz" zanim plugin
// dzialal) dostali ponowne pytanie raz, juz z dzialajaca geolokalizacja.
const PRIMED_KEY = "trasa_geo_primed_v2";
export const geoWasPrimed = (): boolean => {
  try { return !!localStorage.getItem(PRIMED_KEY); } catch { return false; }
};
export const markGeoPrimed = () => {
  try { localStorage.setItem(PRIMED_KEY, "1"); } catch { /* ignore */ }
};

// Odpala realne zapytanie o lokalizacje (systemowy prompt przy pierwszym razie).
// Bezpieczne do wielokrotnego wolania - jak juz mamy coords, zwraca je od razu.
// force=true pomija cache i pobiera SWIEZA pozycje (np. do trafnego on-site przy wejsciu
// w destynacje - user mogl sie przemiescic).
export async function requestLocation(force = false): Promise<LatLng | null> {
  if (!force && cachedCoords) return cachedCoords;
  currentStatus = "requesting"; notifyAll();
  try {
    if (isNative) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
        currentStatus = "denied"; notifyAll(); return null;
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      currentStatus = "granted"; notifyAll(); persistCoords();
      return cachedCoords;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      currentStatus = "unavailable"; notifyAll(); return null;
    }
    return await new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          currentStatus = "granted"; notifyAll(); persistCoords(); resolve(cachedCoords);
        },
        () => { currentStatus = "denied"; notifyAll(); resolve(null); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });
  } catch {
    currentStatus = "unavailable"; notifyAll(); return null;
  }
}

// Aktualne coords z cache (bez promptowania) - null gdy nie mamy jeszcze zgody/pozycji.
export function getCachedCoords(): LatLng | null {
  return cachedCoords;
}

// Hook: zwraca wspoldzielone coords + status + funkcje do realnego zapytania.
export function useGeolocation() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { coords: cachedCoords, status: currentStatus, request: requestLocation };
}
