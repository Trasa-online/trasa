import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { TRIP_COUNTRIES, countryIso } from "@/lib/tripCountries";

// Wynik wyszukiwarki miejsc - ksztalt zgodny z PlaceForList (bez opcjonalnych pol).
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
  /** Skad wynik: nasz katalog (zero kosztu) czy podpowiedz Google (wymaga `resolve`). */
  source?: "catalog" | "google";
}

// WSPOLNA WYSZUKIWARKA MIEJSC. Przebudowa 2026-09-22 (ciecie kosztow Google).
//
// Bylo: kazde nacisniecie klawisza (debounce 350 ms) strzelalo PLATNYM Text Searchem - i to
// od jednego do TRZECH razy naraz (fraza + miasto, fraza + kraj, fraza + drugi kraj), bo Google
// nie rozumie listy krajow w jednym zapytaniu. Jedno "dodaje kawiarnie" kosztowalo 4-8 wywolan
// po 32 $/1000. Przy 10 tys. userow to setki tysiecy zlotych rocznie.
//
// Jest, w kolejnosci:
//   1. NASZ KATALOG (`search_place_catalog`) - 1000+ miejsc, zero kosztu, odpowiedz natychmiast.
//   2. GOOGLE AUTOCOMPLETE W SESJI - podpowiedzi przy pisaniu sa DARMOWE, gdy sesje zamyka
//      jedno Place Details (SKU "Autocomplete Session Usage"). Pytamy dopiero od 3 znakow
//      i tylko gdy nasz katalog nie wystarczyl.
//   3. `resolve(item)` przy WYBORZE - jedno platne zapytanie po adres i wspolrzedne, i tylko
//      dla miejsca, ktore user naprawde wybral. Zamyka sesje, czyli uwalnia calosc pisania.
//
// ⛔ Nie wracaj do Text Search przy pisaniu. Jesli podpowiedzi sa slabe, popraw nakierowanie
// (`center`, `radius`) albo nasz katalog - to sa darmowe dzwignie.

const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Token sesji Autocomplete. Zyje przez CALE pisanie i ginie przy wyborze - dlatego jest
 *  w ref, a nie w stanie (zmiana nie ma prawa wywolac renderu). */
function newSessionToken(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Kraj miasta albo null. ⛔ NIE uzywaj `countryForCity` z tripCountries - ono dla nieznanego
 *  miasta zwraca "Polska", a tutaj potrzebna jest uczciwa odpowiedz "nie wiem". */
const countryOfCity = (c?: string | null): string | null =>
  (c ? TRIP_COUNTRIES.find((x) => x.cities.some((n) => n.toLowerCase() === c.toLowerCase()))?.name ?? null : null);

const MIN_CHARS_LOCAL = 2;
const MIN_CHARS_GOOGLE = 3;
const ENOUGH_LOCAL_HITS = 4;
const DEBOUNCE_MS = 400;

export function usePlaceSearch(
  query: string,
  opts?: { city?: string | null; countries?: string[] | null; center?: { lat: number; lng: number } | null; scopeKm?: number; enabled?: boolean },
) {
  const city = opts?.city ?? null;
  // Stabilny klucz zaleznosci - tablica z propsa ma nowa referencje przy kazdym renderze.
  const countriesKey = (opts?.countries ?? []).join("|");
  const center = opts?.center ?? null;
  const scopeKm = opts?.scopeKm ?? 20;
  const enabled = opts?.enabled ?? true;
  const searchMode = query.trim().length >= MIN_CHARS_LOCAL;
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const session = useRef<string>(newSessionToken());

  useEffect(() => {
    if (!enabled || !searchMode) { setResults([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const q = query.trim();
      try {
        // 1. Nasz katalog.
        const { data: mine } = await (supabase as any).rpc("search_place_catalog", { p_query: q, p_city: city, p_limit: 8 });
        if (!alive) return;
        // ⚠️ ZASIEG. Nasz katalog jest dzis prawie wylacznie polski, wiec bez tego filtra plan
        // do PARYZA dostawal w podpowiedziach Muzeum Sopotu i Muzeum Warszawy (zlapane renderem
        // w WebKit). Miejsce z katalogu wchodzi tylko wtedy, gdy pasuje do miasta albo kraju
        // wyjazdu; jesli zasiegu nie znamy, przepuszczamy wszystko.
        const scopeCountries = (opts?.countries ?? []).filter(Boolean);
        const cityCountry = countryOfCity(city);
        const inScope = (row: any): boolean => {
          if (!city && !scopeCountries.length) return true;
          const rc = String(row.city ?? "");
          if (city && rc.toLowerCase() === city.toLowerCase()) return true;
          const rowCountry = countryOfCity(rc);
          if (scopeCountries.length) return !!rowCountry && scopeCountries.includes(rowCountry);
          return !!cityCountry && rowCountry === cityCountry;
        };
        const local: PlaceSearchItem[] = ((mine as any[]) ?? []).filter(inScope).map((r) => ({
          place_name: r.place_name, address: r.address ?? null,
          latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: r.category ?? null, photo_url: r.photo_url ?? null,
          place_id: null, google_place_id: r.google_place_id ?? null, rating: null,
          source: "catalog" as const,
        }));

        // 2. Google tylko gdy trzeba.
        let fromGoogle: PlaceSearchItem[] = [];
        if (local.length < ENOUGH_LOCAL_HITS && q.length >= MIN_CHARS_GOOGLE) {
          // Bez wspolrzednych srodka nakierowujemy Google SLOWEM: "muzeum Paryz" trafia
          // w Luwr, samo "muzeum" - w cokolwiek na swiecie. Nic to nie kosztuje.
          const input = center || !city ? q : `${q} ${city}`;
          // Zasieg krajowy: `components=country:xx` w Autocomplete. Bez tego plan do Francji
          // dostawal w podpowiedziach polskie muzea (Google nakierowuje po lokalizacji
          // wolajacego). Bierzemy kraj wyjazdu, a gdy go nie ma - kraj miasta.
          const iso = countryIso(scopeCountries[0] ?? cityCountry);
          const { data } = await supabase.functions.invoke("google-places-proxy", {
            body: {
              action: "autocomplete", query: input, sessionToken: session.current,
              ...(iso && scopeCountries.length <= 1 ? { country: iso } : {}),
              ...(center ? { latitude: center.lat, longitude: center.lng, radius: Math.round(scopeKm * 1000) } : {}),
            },
          });
          if (!alive) return;
          setBlocked(!!(data as any)?.quota_exceeded);
          fromGoogle = (((data as any)?.results ?? []) as any[]).map((r) => ({
            place_name: r.name ?? "",
            // Adres pelny przyjdzie dopiero przy wyborze - tu mamy drugi wiersz podpowiedzi
            // (ulica, miasto), ktory dla usera znaczy dokladnie to samo.
            address: r.secondary || null,
            latitude: null, longitude: null,
            category: categoryFromGoogleTypes(r.types), photo_url: null,
            place_id: null, google_place_id: r.place_id ?? null, rating: null,
            source: "google" as const,
          }));
        } else {
          setBlocked(false);
        }

        // Dedup: to samo miejsce z naszego katalogu i z Google (po google_place_id, potem nazwie).
        const seen = new Set<string>();
        const merged: PlaceSearchItem[] = [];
        for (const r of [...local, ...fromGoogle]) {
          const k = (r.google_place_id ?? `${r.place_name}|${r.address ?? ""}`).toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
        // Blisko srodka najpierw - KOLEJNOSC, nie odsiew (twardy filtr konczyl sie pusta lista,
        // gdy srodek byl zly albo nieznany). Wyniki bez wspolrzednych (Google) nie spadaja na dol.
        const near = (r: PlaceSearchItem) => !center || r.latitude == null || r.longitude == null
          || distKm(center, { lat: r.latitude, lng: r.longitude }) <= scopeKm;
        setResults([...merged.filter(near), ...merged.filter((r) => !near(r))].slice(0, 8));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, countriesKey, center, scopeKm, enabled]);

  /** Dociaga adres i wspolrzedne WYBRANEGO miejsca (jedno platne zapytanie) i zamyka sesje.
   *  Wynik z naszego katalogu wraca bez zadnego zapytania. */
  const resolve = useCallback(async (item: PlaceSearchItem): Promise<PlaceSearchItem> => {
    if (item.source !== "google" || !item.google_place_id) return item;
    try {
      const { data } = await supabase.functions.invoke("google-places-proxy", {
        body: { action: "placeid", place_id: item.google_place_id, sessionToken: session.current },
      });
      const r = (data as any)?.result;
      session.current = newSessionToken();   // sesja zamknieta - nastepne pisanie zaczyna nowa
      if (!r) return item;
      return {
        ...item,
        place_name: r.name || item.place_name,
        address: r.full_address ?? item.address,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        category: item.category ?? categoryFromGoogleTypes(r.types),
        google_place_id: r.place_id ?? item.google_place_id,
      };
    } catch {
      return item;
    }
  }, []);

  return { results, searching, blocked, searchMode, resolve };
}
