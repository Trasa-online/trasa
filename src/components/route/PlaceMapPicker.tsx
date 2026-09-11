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
// 2026-09-10: ZERO Google - user sam nazywal punkt. 2026-09-11 (KRYTYCZNE z testow): miejsce
// nazwane z palca nie mialo adresu i nie dalo sie zapisac (pins.address NOT NULL), a nawet gdy
// sie zapisze, tworzy wizytowke "zero", ktora nie laczy sie z niczym. Decyzja Nat: miejsca
// z mapy MUSZA byc dopasowane do Google - ale tanio.
//
// Pierwsze podejscie (rozpoznawanie po kazdym postoju pinezki, Nearby 30 m) odrzucone tego
// samego dnia: pytalo Google przy kazdym przyblizeniu i wyciagalo lokale, o ktore nikt nie
// pytal (fryzjer 20 m od celu). Mapa NIE jest skanerem - jest wskaznikiem. Zapytanie idzie
// WYLACZNIE za jawna intencja usera, po jednym na akcje:
//  1. Tapniecie w ETYKIETE lokalu na podkladzie: Maps JS daje placeId za darmo, my dociagamy
//     tylko nazwe/adres/wspolrzedne (Place Details, pola podstawowe, cache 7 dni w proxy)
//     i pokazujemy ten JEDEN lokal do potwierdzenia. Zero dwuznacznosci co do promienia.
//  2. "+" z wpisana nazwa: JEDNO Text Search nakierowane na pinezke (bias 3 km), kandydaci
//     posortowani od najblizszych pinezce, a na koncu zawsze "dodaj jako wlasne miejsce".
// Przesuwanie i przyblizanie mapy nie kosztuje nic. Pinezka na srodku zostaje: to ona
// nakierowuje wyszukiwanie po nazwie i daje wspolrzedne miejscu recznemu (adres = "", nie null).

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Loader2, LocateFixed, Minus, Plus, X, ChevronRight, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { getCityCenter } from "@/lib/cities";
import { getCachedCoords, requestLocation } from "@/hooks/useGeolocation";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { categoryFromGoogleTypes, categoryIconSrc } from "@/lib/placeCategoryIcon";
import { haversineKm } from "@/lib/distance";
import type { PlaceForList } from "@/lib/placeLists";

type LatLng = { lat: number; lng: number };

// Domyslny srodek, gdy nie znamy ani miasta, ani polozenia - centrum Warszawy.
const FALLBACK_CENTER: LatLng = { lat: 52.2297, lng: 21.0122 };

/** Sledzi srodek mapy (wspolrzedne miejsca recznego i nakierowanie wyszukiwania po nazwie)
 *  oraz tapniecia w etykiety lokali na podkladzie. */
function CenterWatcher({ onSettle, onPoi }: { onSettle: (pos: LatLng) => void; onPoi: (placeId: string, at: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const ls = [
      // Etykieta lokalu z podkladu: placeId za darmo. e.stop() gasi domyslne okienko Google.
      map.addListener("click", (e: any) => {
        if (!e?.placeId || !e.latLng) return;
        e.stop?.();
        haptics.light();
        const at = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        map.panTo(at);
        onPoi(String(e.placeId), at);
      }),
      map.addListener("idle", () => {
        const c = map.getCenter();
        if (c) onSettle({ lat: c.lat(), lng: c.lng() });
      }),
    ];
    return () => ls.forEach((l) => l.remove());
  }, [map, onSettle, onPoi]);
  return null;
}

type GoogleHit = { name: string; address?: string; full_address?: string; place_id: string | null; types?: string[]; latitude: number | null; longitude: number | null };

function toPlace(r: GoogleHit, city: string | null | undefined): PlaceForList {
  return {
    place_name: r.name,
    category: categoryFromGoogleTypes(r.types) ?? "other",
    // Adres NIGDY nie moze byc null - pins.address jest NOT NULL (awaria z testow 2026-09-11).
    address: r.full_address ?? r.address ?? "",
    city: city ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    photo_url: null,
    place_id: null,
    google_place_id: r.place_id ?? null,
    rating: null,
  };
}

// Kontrolki zoomu: pionowy stos po prawej, POD polem nazwy. Dol ekranu zostaje dla karty
// z rozpoznanym miejscem (wczesniej stala tam i zaslaniala guziki).
function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute right-3 top-[76px] z-10 flex flex-col gap-1.5">
      {[["+", 1], ["-", -1]].map(([label, delta]) => (
        <button
          key={label as string}
          onPointerDown={(e) => { e.stopPropagation(); map?.setZoom((map.getZoom() ?? 15) + (delta as number)); }}
          aria-label={label === "+" ? "Zoom in" : "Zoom out"}
          className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
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
  /** Kandydaci do potwierdzenia: z tapniecia w lokal (jeden) albo z "+" po nazwie (do trzech). */
  const [candidates, setCandidates] = useState<PlaceForList[] | null>(null);
  /** Trwa zapytanie do Google (dopasowanie nazwy albo odczyt tapnietego lokalu). */
  const [matching, setMatching] = useState(false);
  const posRef = useRef<LatLng | null>(null);

  const onSettle = useCallback((p: LatLng) => { posRef.current = p; setPos(p); }, []);

  const pick = (p: PlaceForList) => { haptics.light(); onPick(p); onClose(); };

  // Tapniecie w etykiete lokalu: JEDNO zapytanie o pola podstawowe tego konkretnego placeId.
  // Wynik to dokladnie ten lokal, ktory user wskazal palcem - bez zgadywania po promieniu.
  const onPoi = useCallback(async (placeId: string, at: LatLng) => {
    setMatching(true);
    setCandidates(null);
    try {
      const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "placeid", place_id: placeId } });
      const r = (data as any)?.result as GoogleHit | null | undefined;
      if (r?.name) {
        setCandidates([toPlace({ ...r, latitude: r.latitude ?? at.lat, longitude: r.longitude ?? at.lng }, city)]);
      } else {
        // Limit dzienny / blad: nie udajemy, ze nic sie nie stalo - user moze wpisac nazwe.
        setCandidates([]);
      }
    } catch { setCandidates([]); }
    finally { setMatching(false); }
  }, [city]);

  // Reczne miejsce (bez dopasowania Google) - adres pusty, NIE null.
  const addManual = () => {
    const label = name.trim();
    if (!label) return;
    pick({
      place_name: label,
      // Kategorii nie zgadujemy - nikt jej tu nie podal. "other" to uczciwe "nie wiem".
      category: "other", address: "", city: city ?? null,
      latitude: pos?.lat ?? null, longitude: pos?.lng ?? null,
      photo_url: null, place_id: null, google_place_id: null, rating: null,
    });
  };

  // "+": JEDNO zapytanie Text Search po nazwie, nakierowane na pinezke. Kandydaci do wyboru;
  // brak wynikow / limit / blad -> od razu miejsce reczne (nikt nie utknie na tym ekranie).
  const add = async () => {
    const label = name.trim();
    if (!label || matching) return;
    haptics.light();
    setMatching(true);
    try {
      const { data } = await supabase.functions.invoke("google-places-proxy", {
        body: { action: "textsearch", query: label, latitude: pos?.lat, longitude: pos?.lng },
      });
      const at = posRef.current;
      // Od najblizszych pinezce: bias Google to sugestia, nie filtr - bez sortowania na gore
      // potrafil trafic lokal o tej samej nazwie z drugiego konca kraju.
      const hits = (((data as any)?.results ?? []) as GoogleHit[]).filter((r) => r.name)
        .sort((a, b) => {
          if (!at || a.latitude == null || b.latitude == null) return 0;
          return haversineKm(at, { lat: a.latitude, lng: a.longitude! }) - haversineKm(at, { lat: b.latitude, lng: b.longitude! });
        })
        .slice(0, 3);
      if (!hits.length) { addManual(); return; }
      setCandidates(hits.map((h) => toPlace(h, city)));
    } catch { addManual(); }
    finally { setMatching(false); }
  };

  const locateMe = useCallback(async () => {
    setLocating(true);
    const coords = getCachedCoords() ?? (await requestLocation(true));
    setLocating(false);
    if (!coords || !map) return;
    map.panTo({ lat: coords.lat, lng: coords.lng });
    map.setZoom(17);
  }, [map]);

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
        <CenterWatcher onSettle={onSettle} onPoi={onPoi} />
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
            onChange={(e) => { setName(e.target.value); setCandidates(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
            placeholder={t("map_picker.name_placeholder")}
            className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          {name.trim() ? (
            <button onClick={() => void add()} disabled={matching} aria-label={t("map_picker.add", { place: name.trim() })}
              className="shrink-0 h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-70">
              {matching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5 stroke-[2.5]" />}
            </button>
          ) : null}
        </div>
      </div>

      {/* Karta pod pinezka: lokal z tapniecia albo kandydaci dla wpisanej nazwy. Tapniecie
          w wiersz = dodanie DOPASOWANEGO miejsca (google_place_id, adres, kategoria) - to laczy
          je z wizytowka i innymi wyjazdami. Wiersz "wlasne miejsce" tylko gdy jest wpisana nazwa. */}
      <div className="absolute left-3 right-3 z-20" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        {matching ? (
          <div className="rounded-2xl bg-white shadow-lg px-4 py-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{t("map_picker.reading")}
          </div>
        ) : candidates && candidates.length > 0 ? (
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
            <p className="px-4 pt-3 pb-1.5 text-[12px] font-semibold text-muted-foreground">{t("map_picker.did_you_mean")}</p>
            {candidates.map((c, i) => <PlaceRow key={`${c.google_place_id ?? c.place_name}-${i}`} place={c} onPick={() => pick(c)} />)}
            {name.trim() ? (
              <button onClick={addManual} className="w-full flex items-center gap-3 px-4 py-3 border-t border-border/40 text-left active:bg-muted/50 transition-colors">
                <span className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center shrink-0"><PenLine className="h-4 w-4 text-foreground" /></span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground truncate">{t("map_picker.add_manual", { place: name.trim() })}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ) : null}
          </div>
        ) : candidates && candidates.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-lg px-4 py-3 text-[13px] text-muted-foreground">{t("map_picker.poi_failed")}</div>
        ) : null}
      </div>

      <button
        onClick={() => void locateMe()}
        aria-label={t("map_picker.locate")}
        className="absolute right-3 top-[176px] z-10 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-90 transition-transform"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4 text-foreground" />}
      </button>
    </div>
  );
}

function PlaceRow({ place, onPick }: { place: PlaceForList; onPick: () => void }) {
  return (
    <button onClick={onPick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-muted/50 transition-colors">
      <span className="h-9 w-9 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
        <img src={categoryIconSrc(place.category)} alt="" className="h-5 w-5" draggable={false} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-foreground truncate">{place.place_name}</span>
        {place.address ? <span className="block text-[12px] text-muted-foreground truncate">{place.address}</span> : null}
      </span>
      <Plus className="h-4 w-4 text-primary shrink-0" />
    </button>
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
