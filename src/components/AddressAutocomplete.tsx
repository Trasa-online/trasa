import { useState, useRef, useEffect, memo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY, detectPlaceType, type PlaceCategory } from "@/lib/googleMaps";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (
    value: string,
    coordinates?: Coordinates,
    fullAddress?: string,
    placeName?: string,
    placeType?: PlaceCategory,
    placeId?: string
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface Suggestion {
  name: string;
  full_address: string;
  placeId: string;
  placeType: PlaceCategory;
}

const PLACE_TYPE_ICONS: Record<PlaceCategory, string> = {
  transport: '🚆',
  accommodation: '🏨',
  attraction: '🎭',
  food: '🍽️',
  shopping: '🛍️',
  other: '📍',
};

/**
 * Inner component that uses the Google Maps Places JS library.
 * Must be rendered inside an APIProvider.
 */
const AddressAutocompleteInner = memo(function AddressAutocompleteInner({
  value,
  onChange,
  placeholder = "Wpisz adres",
  disabled = false,
  className,
}: AddressAutocompleteProps) {
  const [localQuery, setLocalQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const isTypingRef = useRef(false);
  const lastExternalValueRef = useRef(value);

  // Load the Places library via the Maps JS API
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Initialize services when libraries are loaded
  useEffect(() => {
    if (places && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new places.AutocompleteService();
    }
  }, [places]);

  useEffect(() => {
    if (geocoding && !geocoderRef.current) {
      geocoderRef.current = new geocoding.Geocoder();
    }
  }, [geocoding]);

  // Sync from parent only when value genuinely changes externally
  useEffect(() => {
    if (!isTypingRef.current && value !== lastExternalValueRef.current) {
      setLocalQuery(value);
      lastExternalValueRef.current = value;
    }
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!autocompleteServiceRef.current || !searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const request: google.maps.places.AutocompletionRequest = {
        input: searchQuery,
        language: "pl",
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions &&
            predictions.length > 0
          ) {
            const mapped: Suggestion[] = predictions.slice(0, 8).map((p) => ({
              name: p.structured_formatting?.main_text || p.description.split(",")[0],
              full_address: p.description,
              placeId: p.place_id,
              placeType: detectPlaceType(p.types || []),
            }));
            setSuggestions(mapped);
            setIsOpen(true);
          } else {
            setSuggestions([]);
          }
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      isTypingRef.current = true;
      setLocalQuery(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
        isTypingRef.current = false;
      }, 300);
    },
    [fetchSuggestions]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      // Use Geocoder to get coordinates from placeId
      if (geocoderRef.current && suggestion.placeId) {
        geocoderRef.current.geocode(
          { placeId: suggestion.placeId },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
              const location = results[0].geometry.location;
              const coords: Coordinates = {
                latitude: location.lat(),
                longitude: location.lng(),
              };

              const isPlaceName =
                suggestion.name && suggestion.name !== suggestion.full_address;
              const fullAddressWithName =
                isPlaceName && !suggestion.full_address.startsWith(suggestion.name)
                  ? `${suggestion.name}, ${suggestion.full_address}`
                  : suggestion.full_address;

              const displayValue = fullAddressWithName;

              setLocalQuery(displayValue);
              lastExternalValueRef.current = displayValue;
              isTypingRef.current = false;

              onChange(
                displayValue,
                coords,
                fullAddressWithName,
                isPlaceName ? suggestion.name : undefined,
                suggestion.placeType,
                suggestion.placeId
              );
            }
          }
        );
      }

      setIsOpen(false);
      setSuggestions([]);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  }, [suggestions.length]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={localQuery}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.placeId}-${index}`}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                "border-b border-border last:border-b-0"
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center gap-2">
                <span className="text-base flex-shrink-0">
                  {PLACE_TYPE_ICONS[suggestion.placeType]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{suggestion.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.full_address}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});

/**
 * Outer wrapper that provides the Google Maps API context.
 */
const AddressAutocomplete = memo(function AddressAutocomplete(
  props: AddressAutocompleteProps
) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <AddressAutocompleteInner {...props} />
    </APIProvider>
  );
});

export default AddressAutocomplete;
