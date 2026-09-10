// Dodawanie miejsca Z MAPY (2026-09-08, zgloszenie z testow; redesign 2026-09-10).
//
// Po co, skoro jest wyszukiwarka: wpisywanie nazwy zaklada, ze user ja PAMIETA. Czesto jest
// odwrotnie - wie, GDZIE cos bylo ("ta kawiarnia przy rynku, z lewej"), ale nie jak sie
// nazywalo. Mapa odwraca pytanie: user pokazuje punkt, a my mowimy, co tam jest.
//
// Wzorzec pinezki na srodku (jak w aplikacjach przewozowych), a NIE tapniecie w punkt:
// na telefonie trafienie palcem w maly obiekt jest niepewne, a przesuwanie mapy pod stalym
// celownikiem daje pelna kontrole i dziala jedna reka.
//
// Redesign 2026-09-10 (prosba Nat): lista "W tym miejscu" pod mapa zniknela - zjadala pol
// ekranu na cos, z czego user i tak wybieral pierwsza pozycje. Zostaje JEDNO pole u gory,
// ktore jest naraz wynikiem celownika i wyszukiwarka:
//   - przesuwasz mape  -> w polu pojawia sie miejsce spod pinezki,
//   - wpisujesz nazwe  -> pole podpowiada wyniki, tapniecie ustawia cel i przesuwa mape.
// Gdy cel jest ustawiony, po prawej stronie pola wyrasta "+", ktore dodaje miejsce.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Loader2, LocateFixed, Minus, Plus, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { getCityCenter } from "@/lib/cities";
import { getCachedCoords, requestLocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import type { PlaceForList } from "@/lib/placeLists";

type NearbyPlace = {
  name: string; address: string; place_id: string | null; types: string[];
  rating: number | null; latitude: number | null; longitude: number | null;
};

type LatLng = { lat: number; lng: number };

/** Cel do dodania. Kategoria jest juz ROZSTRZYGNIETA - wynik "nearby" niesie surowe typy
 *  Google, wynik wyszukiwarki nasza kategorie, wiec mapowanie robimy w miejscu powstania. */
type Target = {
  name: string; address: string; category: string; place_id: string | null;
  rating: number | null; latitude: number | null; longitude: number | null;
};

// Domyslny srodek, gdy nie znamy ani miasta, ani polozenia - centrum Warszawy.
const FALLBACK_CENTER: LatLng = { lat: 52.2297, lng: 21.0122 };

/** Sledzi srodek mapy. Miejsca pobieramy dopiero, gdy user PRZESTANIE przesuwac. */
function CenterWatcher({ onSettle }: { onSettle: (pos: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onSettle({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [map, onSettle]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
      {[["+", 1], ["-", -1]].map(([label, delta]) => (
        <button
          key={label as string}
          onPointerDown={(e) => { e.stopPropagation(); map?.setZoom((map.getZoom() ?? 15) + (delta as number)); }}
          aria-label={label === "+" ? "Zoom in" : "Zoom out"}
          className="h-9 w-9 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
        >
          {label === "+" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}

function PickerBody({ city, countries, center, onPick, onClose }: {
  city?: string | null;
  countries?: string[] | null;
  center?: LatLng | null;
  onPick: (place: PlaceForList) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("route");
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Cel: miejsce, ktore trafi do trasy po tapnieciu "+". Zrodlo: pinezka albo wyszukiwarka. */
  const [target, setTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState("");
  /** Czy pole jest w trybie pisania. W tym trybie pinezka NIE nadpisuje tresci pola. */
  const [typing, setTyping] = useState(false);
  // Ostatni pobrany punkt - zeby drobne przesuniecia nie generowaly platnych zapytan.
  const lastFetched = useRef<LatLng | null>(null);
  // Wlasne przesuniecie mapy (po wyborze z wyszukiwarki) nie moze nadpisac celu tym,
  // co akurat lezy pod pinezka - inaczej wybor z listy natychmiast sam sie kasowal.
  const suppressSettle = useRef(false);

  const { results, searching } = usePlaceSearch(query, { countries: countries ?? undefined, city, enabled: typing });

  const fetchNearby = useCallback(async (pos: LatLng) => {
    if (suppressSettle.current) { suppressSettle.current = false; return; }
    const prev = lastFetched.current;
    // ~4 miejsca po przecinku to ok. 11 m. Ponizej tego nic sie realnie nie zmienia,
    // a kazde zapytanie do Google kosztuje.
    if (prev && Math.abs(prev.lat - pos.lat) < 0.0004 && Math.abs(prev.lng - pos.lng) < 0.0004) return;
    lastFetched.current = pos;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("google-places-proxy", {
        body: { action: "nearby", latitude: pos.lat, longitude: pos.lng },
      });
      const raw = (((data as any)?.results ?? []) as NearbyPlace[]).find((p) => p.name);
      const hit: Target | null = raw ? {
        name: raw.name, address: raw.address ?? "", category: categoryFromGoogleTypes(raw.types ?? []),
        place_id: raw.place_id, rating: raw.rating, latitude: raw.latitude, longitude: raw.longitude,
      } : null;
      // Pisanie ma pierwszenstwo: user, ktory wlasnie wpisuje nazwe, nie chce, zeby pole
      // podmienialo mu sie pod palcami przy kazdym drgnieciu mapy.
      setTarget((prev2) => (typing ? prev2 : hit));
    } catch (e) {
      console.warn("[PlaceMapPicker] nearby:", e instanceof Error ? e.message : e);
    } finally {
      setLoading(false);
    }
  }, [typing]);

  const locateMe = useCallback(async () => {
    setLocating(true);
    const coords = getCachedCoords() ?? (await requestLocation(true));
    setLocating(false);
    if (!coords || !map) return;
    map.panTo({ lat: coords.lat, lng: coords.lng });
    map.setZoom(17);
  }, [map]);

  /** Wybor z podpowiedzi: ustaw cel, przesun mape na miejsce, zamknij liste. */
  const chooseResult = (r: { place_name: string; address: string | null; latitude: number | null; longitude: number | null; category: string | null }) => {
    haptics.light();
    setTarget({
      name: r.place_name, address: r.address ?? "", category: r.category || "other",
      place_id: null, rating: null, latitude: r.latitude, longitude: r.longitude,
    });
    setTyping(false);
    setQuery("");
    if (map && r.latitude != null && r.longitude != null) {
      suppressSettle.current = true;
      map.panTo({ lat: r.latitude, lng: r.longitude });
      map.setZoom(17);
    }
  };

  const add = () => {
    if (!target) return;
    haptics.light();
    onPick({
      place_name: target.name,
      category: target.category,
      address: target.address || null,
      city: city ?? null,
      latitude: target.latitude,
      longitude: target.longitude,
      photo_url: null,
      place_id: null,
      google_place_id: target.place_id,
      rating: target.rating,
    });
    onClose();
  };

  const fieldIcon = useMemo(() => {
    if (typing || !target) return <Search className="h-4 w-4 text-muted-foreground" />;
    return (
      <span className="h-7 w-7 rounded-lg bg-[#fcede3] flex items-center justify-center overflow-hidden">
        <img src={categoryIconSrc(target.category)} alt="" className="h-4 w-4" />
      </span>
    );
  }, [typing, target]);

  return (
    <div className="relative flex-1 min-h-0">
      <Map
        defaultCenter={FALLBACK_CENTER}
        defaultZoom={16}
        gestureHandling="greedy"
        disableDefaultUI
        mapId="place-map-picker"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Kontrolki i nasluch musza byc DZIECMI <Map> - useMap() bierze instancje
            z kontekstu, ktory zaklada dopiero sama mapa. */}
        <CenterWatcher onSettle={fetchNearby} />
        <ZoomControls />
        <InitialCenter city={city} center={center} />
      </Map>

      {/* Pinezka celownika: NIE jest znacznikiem na mapie, tylko stalym punktem ekranu -
          to mapa jezdzi pod nia. Dzieki temu wybor dziala jedna reka i nie wymaga
          precyzyjnego tapniecia w maly obiekt. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="-mt-5 flex flex-col items-center">
          <div className="h-8 w-8 rounded-full bg-primary border-[3px] border-white shadow-lg" />
          <div className="h-3 w-[3px] bg-primary/70 -mt-0.5 rounded-full" />
        </div>
      </div>

      {/* Pole u gory mapy: naraz wynik celownika i wyszukiwarka. */}
      <div className="absolute top-3 left-3 right-3 z-20">
        <div className="flex items-center gap-2 rounded-2xl bg-white shadow-lg pl-3 pr-2 h-14">
          <span className="shrink-0 flex items-center justify-center">{fieldIcon}</span>
          {typing ? (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => { if (!query.trim()) setTyping(false); }}
              placeholder={t("map_picker.search_placeholder")}
              className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
            />
          ) : (
            <button
              onClick={() => setTyping(true)}
              className="flex-1 min-w-0 h-full text-left active:opacity-70 transition-opacity"
            >
              {target ? (
                <>
                  <span className="block text-[15px] font-semibold text-foreground truncate">{target.name}</span>
                  {target.address && <span className="block text-[12px] text-muted-foreground truncate">{target.address}</span>}
                </>
              ) : (
                <span className="block text-[15px] text-muted-foreground truncate">
                  {loading ? t("map_picker.reading") : t("map_picker.search_placeholder")}
                </span>
              )}
            </button>
          )}
          {typing ? (
            query ? (
              <button onClick={() => { setQuery(""); setTyping(false); }} aria-label={t("common:buttons.close")}
                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null
          ) : target ? (
            /* "+" pojawia sie DOPIERO gdy jest co dodac - inaczej byloby martwym guzikiem. */
            <button onClick={add} aria-label={t("map_picker.add", { place: target.name })}
              className="shrink-0 h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition-transform">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </button>
          ) : loading ? (
            <Loader2 className="shrink-0 h-4 w-4 mr-2 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {/* Podpowiedzi wyszukiwarki - nad mapa, tuz pod polem. */}
        {typing && query.trim().length >= 2 && (
          <div className="mt-2 rounded-2xl bg-white shadow-lg overflow-hidden max-h-[46dvh] overflow-y-auto">
            {searching && results.length === 0 && (
              <div className="py-5 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></div>
            )}
            {!searching && results.length === 0 && (
              <p className="px-4 py-5 text-center text-sm text-muted-foreground">{t("map_picker.empty")}</p>
            )}
            {results.map((r, i) => (
              <button
                key={`${r.place_name}-${i}`}
                onClick={() => chooseResult(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-secondary/60 transition-colors"
              >
                <span className="h-10 w-10 shrink-0 rounded-xl bg-[#fcede3] flex items-center justify-center overflow-hidden">
                  <img src={categoryIconSrc(r.category ?? "other")} alt="" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground truncate">{r.place_name}</span>
                  {r.address && <span className="block text-xs text-muted-foreground truncate">{r.address}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={locateMe}
        aria-label={t("map_picker.locate")}
        className="absolute bottom-3 left-3 z-10 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4 text-foreground" />}
      </button>
    </div>
  );
}

/**
 * Centruje mape PO zaladowaniu - defaultCenter dziala tylko przy montazu.
 *
 * Kolejnosc zrodel jest istotna (blad znaleziony na zrzucie 2026-09-08: wyjazd do Sofii
 * otwieral mape w WARSZAWIE). Najpierw wspolrzedne miejsc JUZ w tej trasie/liscie - to
 * jedyne zrodlo, ktore dziala dla KAZDEGO miasta na swiecie. Dopiero potem slownik miast,
 * ktory zawiera wylacznie miasta polskie, a na koncu GPS. Bez `center` wyjazd zagraniczny
 * zawsze ladowal na fallbacku.
 */
function InitialCenter({ city, center }: { city?: string | null; center?: LatLng | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || done.current) return;
    done.current = true;
    const cached = getCachedCoords();
    const cityCenter = city ? getCityCenter(city) : null;
    const target = center ?? cityCenter ?? (cached ? { lat: cached.lat, lng: cached.lng } : null);
    if (target) { map.setCenter(target); map.setZoom(16); }
  }, [map, city, center]);
  return null;
}

export default function PlaceMapPicker({ open, onClose, city, countries, center, onPick }: {
  open: boolean;
  onClose: () => void;
  city?: string | null;
  /** Kraje wyjazdu/listy - zasieg wyszukiwarki w polu nad mapa. */
  countries?: string[] | null;
  /** Srodek z miejsc juz obecnych w trasie/liscie - dziala dla miast spoza slownika. */
  center?: LatLng | null;
  onPick: (place: PlaceForList) => void;
}) {
  const { t } = useTranslation("route");
  if (!GOOGLE_MAPS_API_KEY) return null;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        disableDragToDismiss
        className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-background border-0"
        style={{ height: "92dvh" }}
      >
        <SheetTitle className="sr-only">{t("map_picker.title")}</SheetTitle>
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 shrink-0">
          <button onClick={onClose} aria-label={t("common:buttons.close")}
            className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center active:scale-90 transition-transform">
            <X className="h-5 w-5 text-foreground" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[16px] font-bold leading-tight truncate">{t("map_picker.title")}</p>
            <p className="text-xs text-muted-foreground">{t("map_picker.hint")}</p>
          </div>
          <span className="h-9 w-9 shrink-0" aria-hidden />
        </div>
        {/* data-no-drag / data-no-swipe: przesuwanie mapy nie moze zamykac arkusza ani
            przelaczac zakladek (regula gestow z CLAUDE.md). */}
        <div data-no-drag data-no-swipe className="flex-1 min-h-0 flex flex-col">
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <PickerBody city={city} countries={countries} center={center} onPick={onPick} onClose={onClose} />
          </APIProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
