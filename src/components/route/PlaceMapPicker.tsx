// Dodawanie miejsca Z MAPY (2026-09-08, zgloszenie z testow).
//
// Po co, skoro jest wyszukiwarka: wpisywanie nazwy zaklada, ze user ja PAMIETA. Czesto jest
// odwrotnie - wie, GDZIE cos bylo ("ta kawiarnia przy rynku, z lewej"), ale nie jak sie
// nazywalo. Mapa odwraca pytanie: user pokazuje punkt, a my mowimy, co tam jest.
//
// Wzorzec pinezki na srodku (jak w aplikacjach przewozowych), a NIE tapniecie w punkt:
// na telefonie trafienie palcem w maly obiekt jest niepewne, a przesuwanie mapy pod stalym
// celownikiem daje pelna kontrole i dziala jedna reka.

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
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import type { PlaceForList } from "@/lib/placeLists";

type NearbyPlace = {
  name: string; address: string; place_id: string | null; types: string[];
  rating: number | null; latitude: number | null; longitude: number | null;
};

type LatLng = { lat: number; lng: number };

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

function PickerBody({ city, center, onPick, onClose }: {
  city?: string | null;
  center?: LatLng | null;
  onPick: (place: PlaceForList) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("route");
  const map = useMap();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  // Ostatni pobrany punkt - zeby drobne przesuniecia nie generowaly platnych zapytan.
  const lastFetched = useRef<LatLng | null>(null);

  const fetchNearby = useCallback(async (pos: LatLng) => {
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
      setPlaces((((data as any)?.results ?? []) as NearbyPlace[]).filter((p) => p.name));
    } catch (e) {
      console.warn("[PlaceMapPicker] nearby:", e instanceof Error ? e.message : e);
    } finally {
      setLoading(false);
    }
  }, []);

  const locateMe = useCallback(async () => {
    setLocating(true);
    const coords = getCachedCoords() ?? (await requestLocation(true));
    setLocating(false);
    if (!coords || !map) return;
    map.panTo({ lat: coords.lat, lng: coords.lng });
    map.setZoom(17);
  }, [map]);

  const pick = (p: NearbyPlace) => {
    haptics.light();
    onPick({
      place_name: p.name,
      category: categoryFromGoogleTypes(p.types ?? []),
      address: p.address || null,
      city: city ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
      photo_url: null,
      place_id: null,
      google_place_id: p.place_id,
      rating: p.rating,
    });
    onClose();
  };

  return (
    <>
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

        <button
          onClick={locateMe}
          aria-label={t("map_picker.locate")}
          className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4 text-foreground" />}
        </button>
      </div>

      {/* Miejsca pod pinezka */}
      <div className="shrink-0 max-h-[42dvh] overflow-y-auto border-t border-border/60 bg-background">
        <p className="px-5 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("map_picker.nearby")}
        </p>
        {loading && places.length === 0 && (
          <div className="py-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline text-muted-foreground" /></div>
        )}
        {!loading && places.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("map_picker.empty")}</p>
        )}
        <div className="pb-[max(16px,env(safe-area-inset-bottom))]">
          {places.map((p) => (
            <button
              key={`${p.place_id ?? p.name}`}
              onClick={() => pick(p)}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left active:bg-secondary/60 transition-colors"
            >
              <span className="h-10 w-10 shrink-0 rounded-xl bg-[#fcede3] flex items-center justify-center overflow-hidden">
                <img src={categoryIconSrc(categoryFromGoogleTypes(p.types ?? []))} alt="" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground truncate">{p.name}</span>
                {p.address && <span className="block text-xs text-muted-foreground truncate">{p.address}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
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

export default function PlaceMapPicker({ open, onClose, city, center, onPick }: {
  open: boolean;
  onClose: () => void;
  city?: string | null;
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
            <PickerBody city={city} center={center} onPick={onPick} onClose={onClose} />
          </APIProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
