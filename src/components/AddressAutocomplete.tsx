import { useState, useRef, useEffect, memo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: Coordinates, fullAddress?: string, placeName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface Suggestion {
  name: string;
  full_address?: string;
  place_formatted?: string;
  mapbox_id: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Memoized address autocomplete with debounced input handling.
 * Uses local state for immediate UI feedback, syncs to parent only on selection.
 */
const AddressAutocomplete = memo(function AddressAutocomplete({
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

  // Sync from parent only when value genuinely changes externally (e.g., switching pins)
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
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(searchQuery)}&access_token=${MAPBOX_ACCESS_TOKEN}&language=pl&limit=8`
      );
      const data = await response.json();
      
      if (data.features) {
        const mapped = data.features.map((feature: any) => ({
          name: feature.properties.name || feature.properties.full_address,
          full_address: feature.properties.full_address,
          place_formatted: feature.properties.place_formatted,
          mapbox_id: feature.properties.mapbox_id,
          coordinates: feature.geometry?.coordinates ? {
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
          } : undefined,
        }));
        setSuggestions(mapped);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isTypingRef.current = true;
    setLocalQuery(newValue);

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API call (300ms for suggestions)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
      isTypingRef.current = false;
    }, 300);
  }, [fetchSuggestions]);

  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    // Check if there's a distinct place name (POI name like restaurant, attraction)
    const isPlaceName = suggestion.name && 
      suggestion.name !== suggestion.full_address && 
      suggestion.name !== suggestion.place_formatted;
    
    // Build full address that includes the place name if it exists
    const baseAddress = suggestion.full_address || suggestion.place_formatted || suggestion.name;
    const fullAddressWithName = isPlaceName && baseAddress && !baseAddress.startsWith(suggestion.name)
      ? `${suggestion.name}, ${baseAddress}`
      : baseAddress;
    
    // Display value is the combined address
    const displayValue = fullAddressWithName;
    
    setLocalQuery(displayValue);
    lastExternalValueRef.current = displayValue;
    isTypingRef.current = false;
    
    // Pass: displayValue (combined), coordinates, fullAddressWithName (for address field), suggestion.name (for place_name)
    onChange(displayValue, suggestion.coordinates, fullAddressWithName, isPlaceName ? suggestion.name : undefined);
    setIsOpen(false);
    setSuggestions([]);
  }, [onChange]);

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
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.mapbox_id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                "border-b border-border last:border-b-0"
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium">{suggestion.name}</div>
              {(suggestion.full_address || suggestion.place_formatted) && (
                <div className="text-xs text-muted-foreground truncate">
                  {suggestion.full_address || suggestion.place_formatted}
                </div>
              )}
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

export default AddressAutocomplete;
