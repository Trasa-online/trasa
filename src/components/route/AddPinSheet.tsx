import { useState, useCallback } from "react";
import { Search, Loader2, MapPin, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import type { PlanPin } from "./DayPinList";

interface AddPinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinAdd: (pin: PlanPin) => void;
  cityContext: string;
}

interface SearchResult {
  name: string;
  formatted_address: string;
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
}

const typeToCategory: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  museum: "museum",
  park: "park",
  bar: "bar",
  bakery: "cafe",
  church: "church",
  art_gallery: "gallery",
  tourist_attraction: "viewpoint",
  shopping_mall: "shopping",
  night_club: "nightlife",
};

const AddPinSheet = ({ open, onOpenChange, onPinAdd, cityContext }: AddPinSheetProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const fullQuery = cityContext
        ? `${searchQuery} ${cityContext}`
        : searchQuery;

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(fullQuery)}&key=${GOOGLE_MAPS_API_KEY}&language=pl`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results) {
        setResults(data.results.slice(0, 6));
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Place search error:", err);
      setResults([]);
    }
    setSearching(false);
  }, [cityContext]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => searchPlaces(value), 400);
    setDebounceTimer(timer);
  };

  const handleSelectPlace = (result: SearchResult) => {
    const detectedCategory = result.types?.find(t => typeToCategory[t]);

    const pin: PlanPin = {
      place_name: result.name,
      address: result.formatted_address,
      description: "",
      suggested_time: "00:00",
      category: detectedCategory ? typeToCategory[detectedCategory] : "viewpoint",
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      day_number: 0, // will be set by parent
    };

    onPinAdd(pin);
    setQuery("");
    setResults([]);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => {
      if (!v) {
        setQuery("");
        setResults([]);
      }
      onOpenChange(v);
    }}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="text-left pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Dodaj punkt
          </SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={cityContext ? `Szukaj w ${cityContext}...` : "Szukaj miejsca..."}
            autoFocus
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Brak wyników dla "{query}"
            </div>
          )}

          {!searching && results.map((result) => (
            <button
              key={result.place_id}
              onClick={() => handleSelectPlace(result)}
              className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {result.name}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {result.formatted_address}
                </p>
                {result.rating && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ⭐ {result.rating}
                  </p>
                )}
              </div>
            </button>
          ))}

          {!searching && query.length < 2 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Wpisz nazwę miejsca, aby wyszukać
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddPinSheet;
