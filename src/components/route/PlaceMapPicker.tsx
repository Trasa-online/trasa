// Dodawanie miejsca Z MAPY (2026-09-08, zgloszenie z testow; redesign 2026-09-10).
//
// Po co, skoro jest wyszukiwarka: wpisywanie nazwy zaklada, ze user PAMIETA, jak sie nazywa.
// Czesto jest odwrotnie - wie, GDZIE cos bylo ("ta kawiarnia przy rynku, z lewej"), ale nazwy
// nie zna wcale. Mapa odwraca pytanie: user pokazuje punkt i sam go nazywa.
//
// Wzorzec pinezki na srodku (jak w aplikacjach przewozowych), a NIE tapniecie w punkt:
// na telefonie trafienie palcem w maly obiekt jest niepewne, a przesuwanie mapy pod stalym
// celownikiem daje pelna kontrole i dziala jedna reka.
//
// Redesign 2026-09-10 (prosba Nat): ZERO Google w tym widoku. Znikly i lista "W tym miejscu",
// i podpowiedzi wyszukiwarki - pole u gory sluzy do wpisania WLASNEJ nazwy. Miejsce powstaje
// ze wspolrzednych spod pinezki i tego, co user napisal. Przy okazji ten ekran przestal
// generowac platne zapytania do Google przy kazdym przesunieciu mapy.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Loader2, LocateFixed, Minus, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { getCityCenter } from "@/lib/cities";
import { getCachedCoords, requestLocation } from "@/hooks/useGeolocation";
import { haptics } from "@/hooks/useHaptics";
import type { PlaceForList } from "@/lib/placeLists";

type LatLng = { lat: number; lng: number };

// Domyslny srodek, gdy nie znamy ani miasta, ani polozenia - centrum Warszawy.
const FALLBACK_CENTER: LatLng = { lat: 52.2297, lng: 21.0122 };

/** Sledzi srodek mapy - to on jest wspolrzednymi dodawanego miejsca. */
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
  const [locating, setLocating] = useState(false);
  const [name, setName] = useState("");
  /** Wspolrzedne spod pinezki - aktualizowane, gdy mapa przestanie sie ruszac. */
  const [pos, setPos] = useState<LatLng | null>(null);

  const onSettle = useCallback((p: LatLng) => setPos(p), []);

  const locateMe = useCallback(async () => {
    setLocating(true);
    const coords = getCachedCoords() ?? (await requestLocation(true));
    setLocating(false);
    if (!coords || !map) return;
    map.panTo({ lat: coords.lat, lng: coords.lng });
    map.setZoom(17);
  }, [map]);

  const add = () => {
    const label = name.trim();
    if (!label) return;
    haptics.light();
    onPick({
      place_name: label,
      // Kategorii nie zgadujemy - nikt jej tu nie podal. "other" to uczciwe "nie wiem",
      // a nie falszywa etykieta na wizytowce.
      category: "other",
      address: null,
      city: city ?? null,
      latitude: pos?.lat ?? null,
      longitude: pos?.lng ?? null,
      photo_url: null,
      place_id: null,
      google_place_id: null,
      rating: null,
    });
    onClose();
  };

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
        <CenterWatcher onSettle={onSettle} />
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

      {/* Pole u gory: WLASNA nazwa miejsca. "+" budzi sie, gdy jest co dodac. */}
      <div className="absolute top-3 left-3 right-3 z-20">
        <div className="flex items-center gap-2 rounded-2xl bg-white shadow-lg pl-4 pr-2 h-14">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={t("map_picker.name_placeholder")}
            className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          {name.trim() ? (
            <button onClick={add} aria-label={t("map_picker.add", { place: name.trim() })}
              className="shrink-0 h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition-transform">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </button>
          ) : null}
        </div>
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
