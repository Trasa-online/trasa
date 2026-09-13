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
// Kolejnosc zrodel (przebudowa 2026-09-13 - ta sama, co w route/AddPlaceSheet; zgloszenie Nat:
// "BADI cafe" w liscie z Warszawy dawal cukiernie z Kudowy-Zdroju):
//  1. MIASTO najpierw: "<fraza> <miasto>" + nakierowanie na `center` (Google szuka nazwy
//     w poblizu). Wczesniej zasieg krajowy WYPIERAL miasto ("BADI cafe Polska") i Google
//     oddawal przypadkowe lokale z calego kraju.
//  2. KRAJE tylko gdy sa potrzebne: brak miasta, wyjazd po kilku krajach albo miasto oddalo
//     mniej niz dwa wyniki. Kazdy kraj to OSOBNE, platne zapytanie (Google nie rozumie listy
//     krajow w jednej frazie), wiec nie dokladamy ich "na wszelki wypadek". Limit dwoch.
//  3. Bliskie `center` (scopeKm) ida na gore, dalekie na dol - KOLEJNOSC, nie odsiew: twardy
//     filtr konczyl sie pusta lista, gdy srodek byl zly albo nieznany.
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
        const q = query.trim();
        const ask = (scope: string, bias?: { lat: number; lng: number } | null) =>
          supabase.functions.invoke("google-places-proxy", {
            body: { action: "textsearch", query: `${q} ${scope}`.trim(), ...(bias ? { latitude: bias.lat, longitude: bias.lng } : {}) },
          });
        const responses: any[] = [];
        let cityHits = 0;
        if (city) {
          const r = await ask(city, center);
          responses.push(r);
          cityHits = (((r.data as any)?.results ?? []) as any[]).length;
        }
        if (!alive) return;
        const countries = countriesKey ? countriesKey.split("|").slice(0, 2) : [];
        if (countries.length && (!city || countries.length > 1 || cityHits < 2)) {
          responses.push(...(await Promise.all(countries.map((scope) => ask(scope)))));
        } else if (!city && !countries.length) {
          responses.push(await ask("", center));
        }
        if (!alive) return;
        setBlocked(responses.some((r) => !!(r.data as any)?.quota_exceeded));
        // Scalanie wynikow: dedup po nazwie+adresie, kolejnosc zapytan (miasto, potem kraje
        // w kolejnosci wybranej przez usera) rozstrzyga remisy.
        const seen = new Set<string>();
        const all = responses.flatMap((r) => ((r.data as any)?.results ?? []) as any[])
          .filter((r) => {
            const k = `${String(r.name ?? "").toLowerCase()}|${String(r.full_address ?? "").toLowerCase()}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        const near = (r: any) => !center || r.latitude == null || r.longitude == null
          || distKm(center, { lat: r.latitude, lng: r.longitude }) <= scopeKm;
        const ordered = [...all.filter(near), ...all.filter((r) => !near(r))];
        setResults(ordered.slice(0, 6).map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null,
          // Identyfikator Google jedzie dalej - po nim zapis laczy miejsce z rekordem `places`
          // i wizytowka biznesowa (tak samo, jak w route/AddPlaceSheet).
          google_place_id: r.place_id ?? null, rating: null,
        })));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, countriesKey, center, scopeKm, enabled]);

  return { results, searching, blocked, searchMode };
}
