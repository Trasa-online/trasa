import { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Link, MapPin, Loader2, Plus } from "lucide-react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { MockPlace, PlaceCategory } from "./PlaceSwiper";

interface AddedPlace {
  place_name: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  photo_url: string;
}

interface AddCustomPlacePanelProps {
  city: string;
  onAdd: (place: AddedPlace) => void;
  onCancel: () => void;
}

const isGoogleMapsUrl = (s: string) =>
  /maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl/.test(s);

const isSocialUrl = (s: string) =>
  /instagram\.com|tiktok\.com/.test(s);

const GOOGLE_CATEGORY_MAP: Record<string, PlaceCategory> = {
  restaurant: "restaurant", food: "restaurant", meal_delivery: "restaurant", meal_takeaway: "restaurant",
  cafe: "cafe", bakery: "cafe",
  museum: "museum", art_gallery: "gallery", movie_theater: "experience",
  park: "park", amusement_park: "experience", zoo: "experience", aquarium: "experience",
  bar: "bar", night_club: "club",
  church: "monument", tourist_attraction: "monument", point_of_interest: "monument",
  shopping_mall: "shopping", store: "shopping",
};

const detectCategory = (types: string[]): PlaceCategory => {
  for (const t of types) if (GOOGLE_CATEGORY_MAP[t]) return GOOGLE_CATEGORY_MAP[t];
  return "experience";
};

// ─── Inner (needs Maps context) ───────────────────────────────────────────────

const Inner = ({ city, onAdd, onCancel }: AddCustomPlacePanelProps) => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"text" | "googlemaps" | "social">("text");
  const [status, setStatus] = useState<"idle" | "loading" | "preview" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<AddedPlace | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const autocompleteRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  useEffect(() => {
    if (places && !autocompleteRef.current)
      autocompleteRef.current = new places.AutocompleteService();
  }, [places]);

  useEffect(() => {
    if (geocoding && !geocoderRef.current)
      geocoderRef.current = new geocoding.Geocoder();
  }, [geocoding]);

  const fetchSuggestions = useCallback((value: string) => {
    if (!autocompleteRef.current || value.length < 2) { setSuggestions([]); return; }
    autocompleteRef.current.getPlacePredictions(
      { input: `${value} ${city}`, language: "pl" },
      (predictions: any[], status: string) => {
        if (status === "OK" && predictions?.length) {
          setSuggestions(predictions.slice(0, 5));
          setShowSuggestions(true);
        } else setSuggestions([]);
      }
    );
  }, [city]);

  const resolveByPlaceId = useCallback((placeId: string, name?: string) => {
    if (!geocoderRef.current) return;
    setStatus("loading");
    setShowSuggestions(false);
    geocoderRef.current.geocode({ placeId, language: "pl" }, (results: any[], s: string) => {
      if (s !== "OK" || !results?.[0]) { setStatus("error"); setErrorMsg("Nie udało się znaleźć tego miejsca."); return; }
      const r = results[0];
      const loc = r.geometry.location;
      const types: string[] = r.types ?? [];
      setPreview({
        place_name: name ?? r.address_components?.[0]?.long_name ?? r.formatted_address.split(",")[0],
        category: detectCategory(types),
        address: r.formatted_address,
        latitude: loc.lat(),
        longitude: loc.lng(),
        description: "",
        photo_url: "",
      });
      setStatus("preview");
    });
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setPreview(null);
    setStatus("idle");
    setErrorMsg("");

    const trimmed = val.trim();
    if (isGoogleMapsUrl(trimmed)) {
      setMode("googlemaps");
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (isSocialUrl(trimmed)) {
      setMode("social");
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      setMode("text");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(trimmed), 300);
    }
  };

  const handleAnalyzeUrl = async () => {
    const trimmed = query.trim();
    setStatus("loading");
    setErrorMsg("");

    if (isGoogleMapsUrl(trimmed)) {
      // Extract place name from URL path and search
      try {
        const match = trimmed.match(/\/place\/([^/@]+)/);
        const placeName = match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
        if (placeName && autocompleteRef.current) {
          autocompleteRef.current.getPlacePredictions(
            { input: `${placeName} ${city}`, language: "pl" },
            (predictions: any[], s: string) => {
              if (s === "OK" && predictions?.length) {
                const p = predictions[0];
                resolveByPlaceId(p.place_id, p.structured_formatting?.main_text);
              } else {
                setStatus("error");
                setErrorMsg("Nie udało się dopasować miejsca z tego linku.");
              }
            }
          );
        } else {
          setStatus("error");
          setErrorMsg("Nie udało się odczytać miejsca z tego linku Google Maps.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Nieprawidłowy link.");
      }
      return;
    }

    if (isSocialUrl(trimmed)) {
      try {
        const { data, error } = await supabase.functions.invoke("extract-creator-place", {
          body: { url: trimmed, city },
        });
        if (error || !data?.places?.length) {
          setStatus("error");
          setErrorMsg("Nie udało się odczytać miejsca z tego linku. Spróbuj wpisać nazwę ręcznie.");
          return;
        }
        const extracted = data.places[0] as { place_name: string };
        if (autocompleteRef.current) {
          autocompleteRef.current.getPlacePredictions(
            { input: `${extracted.place_name} ${city}`, language: "pl" },
            (predictions: any[], s: string) => {
              if (s === "OK" && predictions?.length) {
                const p = predictions[0];
                resolveByPlaceId(p.place_id, extracted.place_name);
              } else {
                // Fallback: use extracted name directly without geocoding
                setPreview({ place_name: extracted.place_name, category: "experience", address: city, latitude: 0, longitude: 0, description: "", photo_url: "" });
                setStatus("preview");
              }
            }
          );
        }
      } catch {
        setStatus("error");
        setErrorMsg("Wystąpił błąd. Spróbuj wpisać nazwę ręcznie.");
      }
    }
  };

  const handleSuggestionSelect = (prediction: any) => {
    const name = prediction.structured_formatting?.main_text ?? prediction.description.split(",")[0];
    setQuery(name);
    resolveByPlaceId(prediction.place_id, name);
  };

  const inputIcon = mode === "text" ? <Search className="h-4 w-4 text-muted-foreground shrink-0" /> : <Link className="h-4 w-4 text-muted-foreground shrink-0" />;

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">Dodaj swoje miejsce</p>
        <button onClick={onCancel} className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:opacity-60">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <div className="flex items-center bg-muted/60 rounded-xl px-3 h-12 gap-2">
          {inputIcon}
          <input
            autoFocus
            type="text"
            value={query}
            onChange={handleTextChange}
            placeholder="Nazwa miejsca lub wklej link…"
            className="flex-1 text-base bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query.length > 0 && (
            <button onClick={() => { setQuery(""); setPreview(null); setSuggestions([]); setStatus("idle"); setMode("text"); }} className="shrink-0 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && status === "idle" && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-20">
            {suggestions.map((p) => (
              <button
                key={p.place_id}
                onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(p); }}
                className="w-full px-4 py-3 text-left text-sm border-b border-border/30 last:border-0 active:bg-accent flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.structured_formatting?.main_text}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.structured_formatting?.secondary_text}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Analyze URL button */}
      {(mode === "googlemaps" || mode === "social") && status === "idle" && query.trim().length > 0 && (
        <button
          onClick={handleAnalyzeUrl}
          className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-semibold active:opacity-80 transition-opacity"
        >
          Analizuj link
        </button>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{mode === "social" ? "Analizuję link…" : "Szukam miejsca…"}</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* Preview */}
      {status === "preview" && preview && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base leading-tight">{preview.place_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview.address || city}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onAdd(preview)}
            className="w-full h-12 rounded-full bg-orange-500 text-white text-base font-semibold shadow-lg shadow-orange-500/20 active:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Dodaj do trasy
          </button>

          <button
            onClick={() => { setPreview(null); setStatus("idle"); setQuery(""); setMode("text"); }}
            className="text-sm text-muted-foreground text-center active:opacity-60"
          >
            Szukaj innego miejsca
          </button>
        </div>
      )}

      {/* Hint */}
      {status === "idle" && !query && (
        <div className="flex-1 flex flex-col justify-center gap-3">
          {[
            { icon: "🔍", text: "Wpisz nazwę miejsca, hotelu lub ulicy" },
            { icon: "📍", text: "Wklej link Google Maps" },
            { icon: "📱", text: "Wklej link z Instagrama lub TikToka" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="text-base">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Public export (wraps with APIProvider) ───────────────────────────────────

const AddCustomPlacePanel = (props: AddCustomPlacePanelProps) => (
  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
    <Inner {...props} />
  </APIProvider>
);

export default AddCustomPlacePanel;
