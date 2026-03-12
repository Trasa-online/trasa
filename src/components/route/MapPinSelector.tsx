import { useState, useRef, useEffect } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import InteractiveRouteMap from '@/components/InteractiveRouteMap';
import { forwardGeocode } from '@/lib/googleMaps';

interface Pin {
  latitude?: number;
  longitude?: number;
  place_name?: string;
  address?: string;
  pin_order?: number;
}

interface NewPinData {
  latitude: number;
  longitude: number;
  place_name: string;
  address: string;
}

interface MapPinSelectorProps {
  existingPins: Pin[];
  onPinSelect: (pinData: NewPinData) => void;
}

const MapPinSelector = ({ existingPins, onPinSelect }: MapPinSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const mapRef = useRef<{ flyTo: (lng: number, lat: number) => void } | null>(null);

  const handlePinAdd = (pinData: NewPinData) => {
    onPinSelect(pinData);
    setIsOpen(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  // Search for addresses
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await forwardGeocode(searchQuery);
        setSuggestions(results || []);
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleSuggestionSelect = (suggestion: any) => {
    const coords = suggestion.coordinates;
    const placeName = suggestion.name || '';
    const fullAddress = suggestion.full_address || placeName;

    if (coords) {
      // Select this as the pin
      handlePinAdd({
        latitude: coords.latitude,
        longitude: coords.longitude,
        place_name: placeName,
        address: fullAddress,
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex-shrink-0 w-10 h-10 rounded-md border border-input bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
        title="Wybierz na mapie"
      >
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSearchQuery('');
          setSuggestions([]);
        }
      }}>
        <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-none">
          <div className="relative w-full h-full">
            {/* Header with search */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
              <div className="max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Wybierz lokalizację</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    Anuluj
                  </button>
                </div>
                
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Wpisz adres lub nazwę miejsca..."
                    className="pl-10"
                  />
                </div>

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div className="bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.coordinates?.latitude}-${suggestion.coordinates?.longitude}-${index}`}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <p className="font-medium text-sm truncate">
                          {suggestion.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {suggestion.full_address}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Wpisz adres powyżej lub kliknij na mapie
                </p>
              </div>
            </div>

            {/* Fullscreen Map */}
            <InteractiveRouteMap
              pins={existingPins}
              className="w-full h-full rounded-none border-none"
              onPinAdd={handlePinAdd}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapPinSelector;
