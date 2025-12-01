import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: Coordinates) => void;
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

const AddressAutocomplete = ({
  value,
  onChange,
  placeholder = "Wpisz adres",
  disabled = false,
  className,
}: AddressAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(searchQuery)}&access_token=${MAPBOX_ACCESS_TOKEN}&language=pl&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        const mapped = data.features.map((feature: any) => ({
          name: feature.properties.name || feature.properties.full_address,
          full_address: feature.properties.full_address,
          place_formatted: feature.properties.place_formatted,
          mapbox_id: feature.id,
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const address = suggestion.full_address || suggestion.place_formatted || suggestion.name;
    setQuery(address);
    onChange(address, suggestion.coordinates);
    setIsOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
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
};

export default AddressAutocomplete;
