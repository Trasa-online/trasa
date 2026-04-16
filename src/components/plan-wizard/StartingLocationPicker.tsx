import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Search, X, Plus, Minus } from "lucide-react";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

const MAX_DISTANCE_KM = 40;

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Kraków":    { lat: 50.0617, lng: 19.9373 },
  "Warszawa":  { lat: 52.2297, lng: 21.0122 },
  "Wrocław":   { lat: 51.1079, lng: 17.0385 },
  "Poznań":    { lat: 52.4064, lng: 16.9252 },
  "Zakopane":  { lat: 49.2992, lng: 19.9496 },
  "Łódź":      { lat: 51.7592, lng: 19.4560 },
  "Trójmiasto":{ lat: 54.3520, lng: 18.6466 },
  "Budapeszt": { lat: 47.4979, lng: 19.0402 },
  "Valletta":  { lat: 35.8997, lng: 14.5147 },
};

interface Suggestion {
  name: string;
  full_address: string;
  placeId: string;
}

interface StartingLocationPickerProps {
  city: string;
  onConfirm: (location: string) => void;
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
  const center = CITY_CENTERS[city] ?? { lat: 50.0617, lng: 19.9373 };

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
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
          onClick={() => selected && onConfirm(selected.name)}
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
