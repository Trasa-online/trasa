import { useState, useEffect } from "react";
import { isNative } from "@/lib/platform";
import type { LatLng } from "@/lib/distance";

// Geolokalizacja uzytkownika - dual-platform (Capacitor na native, navigator.geolocation
// na web). Wynik trzymany w module-level cache i wspoldzielony przez wszystkie komponenty
// (jedno zapytanie na sesje). NIC nie zapisujemy na serwer - lokalizacja zyje tylko w pamieci.
//
// Zgoda w kontekscie: najpierw pokazujemy LocationPrimer ("po co"), dopiero potem wolamy
// requestLocation() ktore odpala systemowy prompt. Flaga `trasa_geo_primed_v1` zapobiega
// ponownemu pytaniu.

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

let cachedCoords: LatLng | null = null;
let currentStatus: GeoStatus = "idle";
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((l) => l());

const PRIMED_KEY = "trasa_geo_primed_v1";
export const geoWasPrimed = (): boolean => {
  try { return !!localStorage.getItem(PRIMED_KEY); } catch { return false; }
};
export const markGeoPrimed = () => {
  try { localStorage.setItem(PRIMED_KEY, "1"); } catch { /* ignore */ }
};

// Odpala realne zapytanie o lokalizacje (systemowy prompt przy pierwszym razie).
// Bezpieczne do wielokrotnego wolania - jak juz mamy coords, zwraca je od razu.
export async function requestLocation(): Promise<LatLng | null> {
  if (cachedCoords) return cachedCoords;
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
      currentStatus = "granted"; notifyAll();
      return cachedCoords;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      currentStatus = "unavailable"; notifyAll(); return null;
    }
    return await new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cachedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          currentStatus = "granted"; notifyAll(); resolve(cachedCoords);
        },
        () => { currentStatus = "denied"; notifyAll(); resolve(null); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });
  } catch {
    currentStatus = "unavailable"; notifyAll(); return null;
  }
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
