import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, Minus, LocateFixed, Loader2 } from "lucide-react";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { getCityCenter } from "@/lib/cities";
import { getCachedCoords, requestLocation } from "@/hooks/useGeolocation";

const MAX_DISTANCE_KM = 40;

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

interface Suggestion {
  name: string;
  full_address: string;
  placeId: string;
}

export interface StartingLocation {
  name: string;
  latitude: number;
  longitude: number;
}

interface StartingLocationPickerProps {
  city: string;
  // Zwracamy obiekt z lat/lng (nie tylko nazwe) zeby RouteMap mogla pokazac
  // pin startu i edge function planowania trasy moglo bazowac na wspolrzednych.
  onConfirm: (location: StartingLocation) => void;
  onSkip: () => void;
}

const ZoomControls = () => {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-3 z-10 flex flex-col gap-1">
      <button
        onPointerDown={(e) => { e.stopPropagation(); map?.setZoom((map.getZoom() ?? 13) + 1); }}
        className="w-9 h-9 bg-white rounded-lg shadow-md flex items-center justify-center text-foreground active:bg-accent"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onPointerDown={(e) => { e.stopPropagation(); map?.setZoom((map.getZoom() ?? 13) - 1); }}
        className="w-9 h-9 bg-white rounded-lg shadow-md flex items-center justify-center text-foreground active:bg-accent"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
};

// Pans the map programmatically when a pin is set
const MapPanner = ({ pos }: { pos: { lat: number; lng: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (map && pos) {
      map.panTo(pos);
      map.setZoom(15);
    }
  }, [map, pos]);
  return null;
};

const MapWithSearch = ({ city, onConfirm, onSkip }: StartingLocationPickerProps) => {
  const center = getCityCenter(city) ?? { lat: 52.2297, lng: 21.0122 };

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const autocompleteRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  useEffect(() => {
    if (places && !autocompleteRef.current) {
      autocompleteRef.current = new places.AutocompleteService();
    }
  }, [places]);

  useEffect(() => {
    if (geocoding && !geocoderRef.current) {
      geocoderRef.current = new geocoding.Geocoder();
    }
  }, [geocoding]);

  const fetchSuggestions = useCallback((value: string) => {
    if (!autocompleteRef.current || value.length < 2) {
      setSuggestions([]);
      return;
    }
    autocompleteRef.current.getPlacePredictions(
      { input: `${value} ${city}`, language: "pl" },
      (predictions: any[], status: string) => {
        if (status === "OK" && predictions?.length) {
          setSuggestions(
            predictions.slice(0, 5).map((p) => ({
              name: p.structured_formatting?.main_text || p.description.split(",")[0],
              full_address: p.description,
              placeId: p.place_id,
            }))
          );
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, [city]);

  const reverseGeocode = useCallback((pos: { lat: number; lng: number }) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode(
      { location: pos, language: "pl" },
      (results: any[], status: string) => {
        if (status === "OK" && results?.[0]) {
          const comps: any[] = results[0].address_components ?? [];
          const get = (type: string) => comps.find((c: any) => c.types.includes(type))?.long_name;
          const streetNum = get("street_number");
          const route = get("route");
          const neighborhood = get("neighborhood") ?? get("sublocality_level_1") ?? get("sublocality");
          const poi = get("point_of_interest") ?? get("establishment");
          const name = poi ?? neighborhood ?? (route ? (streetNum ? `${route} ${streetNum}` : route) : null) ?? results[0].formatted_address.split(",")[0];
          setQuery(name);
          setSelected({ name, lat: pos.lat, lng: pos.lng });
        }
      }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (s: Suggestion) => {
    setQuery(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
    setLocationError(null);
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ placeId: s.placeId }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          const pos = { lat: loc.lat(), lng: loc.lng() };
          if (!isWithinCity(pos)) {
            setQuery("");
            setLocationError(`To miejsce jest poza ${city}. Wybierz coś w obrębie miasta.`);
            return;
          }
          setMarkerPos(pos);
          setSelected({ name: s.name, lat: pos.lat, lng: pos.lng });
        }
      });
    }
  };

  const isWithinCity = useCallback((pos: { lat: number; lng: number }) => {
    return haversineKm(center, pos) <= MAX_DISTANCE_KM;
  }, [center]);

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setMarkerPos(null);
    setLocationError(null);
  };

  const handleMapClick = useCallback((e: any) => {
    const lat = e.detail?.latLng?.lat;
    const lng = e.detail?.latLng?.lng;
    if (lat == null || lng == null) return;
    const pos = { lat, lng };
    setLocationError(null);
    if (!isWithinCity(pos)) {
      setLocationError(`To miejsce jest poza ${city}. Zaznacz punkt w obrębie miasta.`);
      return;
    }
    setMarkerPos(pos);
    reverseGeocode(pos);
  }, [reverseGeocode, isWithinCity, city]);

  // Ustaw pin z pozycji GPS (gdy w obrebie miasta). Wykorzystuje juz pobrana geolokalizacje
  // zamiast wymagac od usera recznego wskazania punktu na mapie.
  const applyGpsPos = useCallback((pos: { lat: number; lng: number }, silent: boolean) => {
    if (!isWithinCity(pos)) {
      if (!silent) setLocationError(`Jesteś poza ${city}. Wskaż punkt startu w obrębie miasta.`);
      return;
    }
    setLocationError(null);
    setMarkerPos(pos);
    // Od razu enable "Dalej" (fallback name); reverseGeocode dopisze nazwe ulicy gdy gotowy.
    setQuery("Twoja lokalizacja");
    setSelected({ name: "Twoja lokalizacja", lat: pos.lat, lng: pos.lng });
    reverseGeocode(pos);
  }, [isWithinCity, reverseGeocode, city]);

  // Auto-prefill: jesli mamy juz zgode i swiezy GPS w obrebie miasta, ustaw pin od razu.
  useEffect(() => {
    const cached = getCachedCoords();
    if (cached) applyGpsPos({ lat: cached.lat, lng: cached.lng }, true);
    // tylko raz na montaz pickera dla danego miasta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reczne "Moja lokalizacja" - pobiera GPS (z promptem jesli trzeba) i ustawia pin.
  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    const coords = getCachedCoords() ?? (await requestLocation(true));
    setLocating(false);
    if (!coords) {
      setLocationError("Nie udało się pobrać Twojej lokalizacji.");
      return;
    }
    applyGpsPos({ lat: coords.lat, lng: coords.lng }, false);
  }, [applyGpsPos]);

  return (
    <div className="flex flex-col h-full">
      {/* Header text */}
      <div className="px-5 pt-6 pb-4 space-y-1">
        <p className="text-3xl font-black leading-tight">
          Skąd chcesz<br />zacząć?
        </p>
        <p className="text-sm text-muted-foreground">
          Dobierzemy miejsca blisko Twojej okolicy.
        </p>
      </div>

      {/* Map + search overlay */}
      <div className="flex-1 relative mx-4 rounded-2xl overflow-hidden">
        <Map
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="starting-location"
          style={{ width: "100%", height: "100%", cursor: "crosshair" }}
          onClick={handleMapClick}
        >
          {markerPos && (
            <AdvancedMarker position={markerPos}>
              <div className="w-5 h-5 bg-primary rounded-full border-2 border-white shadow-lg" />
            </AdvancedMarker>
          )}
          <MapPanner pos={markerPos} />
          <ZoomControls />
        </Map>

        {/* Moja lokalizacja - wykorzystaj pobrany GPS jako punkt startu */}
        <button
          onClick={locateMe}
          disabled={locating}
          className="absolute bottom-4 left-3 z-10 h-11 pl-3 pr-4 bg-white rounded-full shadow-md flex items-center gap-2 text-sm font-semibold text-foreground active:scale-95 transition-transform disabled:opacity-60"
          aria-label="Użyj mojej lokalizacji"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin text-orange-600" /> : <LocateFixed className="h-4 w-4 text-orange-600" />}
          Moja lokalizacja
        </button>

        {/* Search input overlay */}
        <div className="absolute top-3 left-3 right-3 z-10">
          <div className="relative">
            <div className="flex items-center bg-white rounded-2xl shadow-lg px-3 h-11 gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={query}
                onChange={handleChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Hotel, ulica, dzielnica…"
                className="flex-1 text-base bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {query.length > 0 && (
                <button onClick={handleClear} className="shrink-0 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {locationError && (
              <div className="mt-1 bg-white rounded-2xl shadow-lg px-4 py-3 text-sm text-red-500 font-medium">
                {locationError}
              </div>
            )}

            {!locationError && showSuggestions && suggestions.length > 0 && (
              <div className="mt-1 bg-white rounded-2xl shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                    className="w-full px-4 py-3 text-left text-sm border-b border-border/30 last:border-0 active:bg-accent"
                  >
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.full_address}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-safe-4 pb-6 pt-4 space-y-3">
        <Button
          size="lg"
          disabled={!selected}
          onClick={() => selected && onConfirm({ name: selected.name, latitude: selected.lat, longitude: selected.lng })}
          className="w-full rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20 disabled:opacity-40"
        >
          Dalej
        </Button>
        <button
          onClick={onSkip}
          className="w-full text-sm text-muted-foreground py-2 active:opacity-60 transition-opacity"
        >
          Pomiń
        </button>
      </div>
    </div>
  );
};

const StartingLocationPicker = (props: StartingLocationPickerProps) => (
  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
    <MapWithSearch {...props} />
  </APIProvider>
);

export default StartingLocationPicker;
