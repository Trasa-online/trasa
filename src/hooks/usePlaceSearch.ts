import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { TRIP_COUNTRIES, countryIso } from "@/lib/tripCountries";
import { useDistanceReference } from "@/lib/distanceReference";

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
  /** Dystans od punktu odniesienia w METRACH. Podpowiedzi Google dostaja go od Google
   *  (parametr `origin`), nasze zrodla liczymy sami. Sluzy WYLACZNIE do sortowania. */
  distance_m?: number | null;
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

// ⚠️ Te cztery liczby to CENA wyszukiwarki, nie kosmetyka.
// Nasze zrodla (katalog, moje miejsca) sa darmowe, wiec startuja od 2 znakow i szybko.
// Google pytamy pozniej i rzadziej: podpowiedzi w sesji sa darmowe TYLKO wtedy, gdy user
// cos wybierze - sesja porzucona bez wyboru jest liczona PO ZAPYTANIU (2,83 $/1000).
// Dlatego dluzsze okno (500 ms zamiast 400) i 4 znaki zamiast 3: mniej rund na jedno
// szukanie, a przy 10 tys. userow porzucone sesje sa najwieksza pozycja rachunku.
const MIN_CHARS_LOCAL = 2;
const MIN_CHARS_GOOGLE = 4;
const ENOUGH_LOCAL_HITS = 4;
const DEBOUNCE_MS = 500;
// „User jest w tej samej okolicy, co planowany zasieg". Hojnie, bo metropolia potrafi miec
// 40 km w poprzek (Trojmiasto), a przy planowaniu innego kraju i tak nie ma to znaczenia.
const SAME_AREA_KM = 75;

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
  // PUNKT ODNIESIENIA dla „najblizej najpierw".
  //
  // ⚠️ To NIE zawsze jest lokalizacja usera. Kto siedzi w Warszawie i planuje wyjazd do Paryza,
  // ten chce paryskich wynikow poukladanych wzgledem PARYZA - sortowanie od Warszawy daloby
  // kolejnosc przypadkowa (wszystko ~1500 km). Dlatego GPS usera wygrywa tylko wtedy, gdy user
  // jest w okolicy tego, co planuje, albo gdy zasiegu w ogole nie znamy. W praktyce to
  // najczestszy przypadek - miejsca dodaje sie bedac na miejscu.
  // ⚠️ HOOK, nie `getReference()`: punkt GPS potrafi dojechac PO pierwszym renderze
  // (cichy odczyt pozycji przy starcie), a czyste wywolanie nie zamawia przerysowania -
  // wyszukiwarka zostalaby wtedy na starym punkcie odniesienia do konca zycia ekranu.
  const gpsRef = useDistanceReference();
  const gpsCoords = gpsRef?.source === "gps" ? gpsRef.coords : null;
  const originRef = gpsCoords && (!center || distKm(gpsCoords, center) <= SAME_AREA_KM) ? gpsCoords : center;
  const originKey = originRef ? `${originRef.lat.toFixed(3)},${originRef.lng.toFixed(3)}` : "";
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
        // 1. MOJE WLASNE miejsca (z moich planow) + nasz katalog. Oba zero kosztu, jedno
        // okraglenie sieci. ⚠️ Wlasne miejsca ida PIERWSZE i BEZ filtra zasiegu: skoro user
        // sam je kiedys dodal, to wie, czego szuka - a najczestszy przypadek to "dodaj
        // kawiarnie, ktora mam juz w innym planie".
        const [{ data: mine }, { data: ownRows }] = await Promise.all([
          (supabase as any).rpc("search_place_catalog", { p_query: q, p_city: city, p_limit: 8 }),
          (supabase as any).rpc("search_my_places", { p_query: q, p_limit: 6 }),
        ]);
        if (!alive) return;
        const own: PlaceSearchItem[] = ((ownRows as any[]) ?? []).map((r) => ({
          place_name: r.place_name, address: r.address ?? null,
          latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: r.category ?? null, photo_url: null,
          place_id: null, google_place_id: r.google_place_id ?? null, rating: null,
          source: "catalog" as const,
        }));
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
        if (own.length + local.length < ENOUGH_LOCAL_HITS && q.length >= MIN_CHARS_GOOGLE) {
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
              // Google policzy dystans od TEGO punktu i odda go przy kazdej podpowiedzi.
              ...(originRef ? { originLat: originRef.lat, originLng: originRef.lng } : {}),
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
            distance_m: typeof r.distance_m === "number" ? r.distance_m : null,
          }));
        } else {
          setBlocked(false);
        }

        // Dedup: to samo miejsce z naszego katalogu i z Google (po google_place_id, potem nazwie).
        const seen = new Set<string>();
        const merged: PlaceSearchItem[] = [];
        for (const r of [...own, ...local, ...fromGoogle]) {
          const k = (r.google_place_id ?? `${r.place_name}|${r.address ?? ""}`).toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
        // NAJBLIZSZE NAJPIERW - realny dystans rosnaco (zgloszenie Nat 2026-09-24:
        // „przy tej samej nazwie apka pokazuje najdalsze zamiast najblizszych").
        // ⛔ Do 24.09 bylo tu tylko przelozenie na dwa kubelki: „w promieniu 20 km" i „reszta",
        // a WEWNATRZ kubelka zostawala kolejnosc zrodel. Dwa lokale tej samej sieci w tym samym
        // miescie trafialy do jednego kubelka i wygrywal ten, ktorego Google oddal pierwszy.
        // Teraz sortujemy calosc po odleglosci: podpowiedzi Google maja ja od Google (`origin`),
        // nasze zrodla liczymy haversinem. Bez dystansu = na koniec, bo o takim wyniku nie wiemy
        // nic (a nie dlatego, ze jest daleko).
        const km = (r: PlaceSearchItem): number => {
          if (typeof r.distance_m === "number") return r.distance_m / 1000;
          if (!originRef || r.latitude == null || r.longitude == null) return Number.POSITIVE_INFINITY;
          return distKm(originRef, { lat: r.latitude, lng: r.longitude });
        };
        // Bez punktu odniesienia zostaje stara zasada: najpierw to, co w zasiegu.
        const near = (r: PlaceSearchItem) => !center || r.latitude == null || r.longitude == null
          || distKm(center, { lat: r.latitude, lng: r.longitude }) <= scopeKm;
        const sorted = originRef
          ? [...merged].sort((a, b) => km(a) - km(b))
          : [...merged.filter(near), ...merged.filter((r) => !near(r))];
        setResults(sorted.slice(0, 8));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, countriesKey, center, scopeKm, enabled, originKey]);

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
