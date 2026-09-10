import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";

// Wynik wyszukiwarki Google Places (proxy) - ksztalt zgodny z PlaceForList (bez opcjonalnych pol).
export interface PlaceSearchItem {
  place_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  photo_url: string | null;
  place_id: string | null;
  google_place_id: string | null;
  rating: number | null;
}

// Haversine (km) - opcjonalny filtr "w obrebie" (center + scopeKm).
const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// Wspoldzielona wyszukiwarka Google Places (textsearch przez proxy, debounce 350ms, >=2 znaki).
//
// Zasieg (2026-09-10): `countries` to nowe zrodlo prawdy - wyjazd opisuja kraje, nie miasto.
// Kazdy kraj to OSOBNE zapytanie ("ramen Japonia", "ramen Korea Poludniowa"), bo Google nie
// rozumie listy krajow w jednej frazie - zwrocilby smiec albo nic. Limit trzech krajow trzyma
// koszt w ryzach; przy wiecej i tak liczy sie to, co user wpisal, a nie pelna lista.
// `city` zostaje dla starych wyjazdow (bez krajow), `center` + `scopeKm` dla zawezenia miejskiego.
export function usePlaceSearch(
  query: string,
  opts?: { city?: string | null; countries?: string[] | null; center?: { lat: number; lng: number } | null; scopeKm?: number; enabled?: boolean },
) {
  const city = opts?.city ?? null;
  // Stabilny klucz zaleznosci - tablica z propsa ma nowa referencje przy kazdym renderze,
  // a bez tego efekt strzelalby do Google w kolko.
  const countriesKey = (opts?.countries ?? []).join("|");
  const center = opts?.center ?? null;
  const scopeKm = opts?.scopeKm ?? 20;
  const enabled = opts?.enabled ?? true;
  const searchMode = query.trim().length >= 2;
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled || !searchMode) { setResults([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const countries = countriesKey ? countriesKey.split("|").slice(0, 3) : [];
        const scopes = countries.length ? countries : [city ?? ""];
        const responses = await Promise.all(scopes.map((scope) =>
          supabase.functions.invoke("google-places-proxy", {
            body: { action: "textsearch", query: `${query} ${scope}`.trim() },
          })));
        if (!alive) return;
        setBlocked(responses.some((r) => !!(r.data as any)?.quota_exceeded));
        // Scalanie wynikow z kilku krajow: dedup po nazwie+adresie, kolejnosc zapytan
        // (czyli kolejnosc krajow wybranych przez usera) rozstrzyga remisy.
        const seen = new Set<string>();
        const all = responses.flatMap((r) => ((r.data as any)?.results ?? []) as any[])
          .filter((r) => {
            const k = `${String(r.name ?? "").toLowerCase()}|${String(r.full_address ?? "").toLowerCase()}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        // Filtr promieniem ma sens tylko przy zasiegu MIEJSKIM. Przy krajach centroida
        // trasy lezy gdzies w polowie drogi i wycinalaby poprawne wyniki.
        const scoped = center && !countries.length
          ? all.filter((r) => r.latitude == null || r.longitude == null || distKm(center, { lat: r.latitude, lng: r.longitude }) <= scopeKm)
          : all;
        setResults(scoped.slice(0, 6).map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null, google_place_id: null, rating: null,
        })));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, countriesKey, center, scopeKm, enabled]);

  return { results, searching, blocked, searchMode };
}
