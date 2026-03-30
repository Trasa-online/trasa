import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Kraków":   { lat: 50.0617, lng: 19.9373 },
  "Gdańsk":   { lat: 54.3520, lng: 18.6466 },
  "Warszawa": { lat: 52.2297, lng: 21.0122 },
  "Wrocław":  { lat: 51.1079, lng: 17.0385 },
  "Poznań":   { lat: 52.4064, lng: 16.9252 },
  "Zakopane": { lat: 49.2992, lng: 19.9496 },
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

const MapWithSearch = ({ city, onConfirm, onSkip }: StartingLocationPickerProps) => {
  const center = CITY_CENTERS[city] ?? { lat: 50.0617, lng: 19.9373 };

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
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
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ placeId: s.placeId }, (results: any[], status: string) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          const pos = { lat: loc.lat(), lng: loc.lng() };
          setMarkerPos(pos);
          setSelected({ name: s.name, lat: pos.lat, lng: pos.lng });
        }
      });
    }
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setMarkerPos(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header text */}
      <div className="px-5 pt-6 pb-4 space-y-1">
        <p className="text-3xl font-black leading-tight">
          Skąd wyruszasz<br />w {city}?
        </p>
        <p className="text-sm text-muted-foreground">
          Dobierzemy miejsca blisko Twojej okolicy.
        </p>
      </div>

      {/* Map + search overlay */}
      <div className="flex-1 relative mx-4 rounded-2xl overflow-hidden">
        <Map
          defaultCenter={center}
          center={markerPos ?? center}
          defaultZoom={13}
          zoom={markerPos ? 15 : 13}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="starting-location"
          style={{ width: "100%", height: "100%" }}
        >
          {markerPos && (
            <AdvancedMarker position={markerPos}>
              <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg" />
            </AdvancedMarker>
          )}
        </Map>

        {/* Search input overlay */}
        <div className="absolute top-3 left-3 right-3 z-10">
          <div className="relative">
            <div className="flex items-center bg-white rounded-xl shadow-lg px-3 h-11 gap-2">
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

            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-1 bg-white rounded-xl shadow-lg overflow-hidden">
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
          className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20 disabled:opacity-40"
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
