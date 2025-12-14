import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, LocateFixed, Search, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import InteractiveRouteMap from "@/components/InteractiveRouteMap";

interface QuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

export const QuickNoteDialog = ({ open, onOpenChange }: QuickNoteDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch user's draft routes
  const { data: draftRoutes } = useQuery({
    queryKey: ["draft-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, title, pins(id)")
        .eq("user_id", user!.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAddress("");
      setCoordinates(null);
      setSelectedRouteId("new");
      setSearchQuery("");
      setSuggestions([]);
    }
  }, [open]);

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
      try {
        const response = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(searchQuery)}&access_token=${MAPBOX_TOKEN}&language=pl&types=address,place,locality,neighborhood,street,poi`
        );
        const data = await response.json();
        setSuggestions(data.features || []);
      } catch (error) {
        console.error("Search error:", error);
        setSuggestions([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Twoja przeglądarka nie obsługuje geolokalizacji",
      });
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&language=pl`
          );
          const data = await response.json();

          if (data.features && data.features.length > 0) {
            const place = data.features[0];
            setAddress(place.place_name || `${latitude}, ${longitude}`);
          } else {
            setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast({
          variant: "destructive",
          title: "Błąd lokalizacji",
          description: error.message || "Nie udało się pobrać lokalizacji",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSuggestionSelect = (suggestion: any) => {
    const coords = suggestion.geometry?.coordinates;
    const placeName = suggestion.properties?.name || "";
    const fullAddress = suggestion.properties?.full_address || suggestion.properties?.place_formatted || placeName;

    if (coords) {
      setCoordinates({ lat: coords[1], lng: coords[0] });
      setAddress(fullAddress);
      setSearchQuery("");
      setSuggestions([]);
    }
  };

  const handleMapPinAdd = (pinData: { latitude: number; longitude: number; place_name: string; address: string }) => {
    setCoordinates({ lat: pinData.latitude, lng: pinData.longitude });
    setAddress(pinData.address || pinData.place_name);
  };

  const handleSave = async () => {
    if (!user || !address.trim()) {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Podaj adres",
      });
      return;
    }

    setLoading(true);

    try {
      let routeId = selectedRouteId;
      let pinOrder = 0;

      if (selectedRouteId === "new") {
        // Create new draft route
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({
            user_id: user.id,
            title: "Szybka notatka",
            status: "draft",
            trip_type: "ongoing",
          })
          .select()
          .single();

        if (routeError) throw routeError;
        routeId = route.id;
      } else {
        // Get next pin order for existing route
        const { data: existingPins } = await supabase
          .from("pins")
          .select("pin_order")
          .eq("route_id", routeId)
          .order("pin_order", { ascending: false })
          .limit(1);

        if (existingPins && existingPins.length > 0) {
          pinOrder = existingPins[0].pin_order + 1;
        }
      }

      // Create pin with address
      const { error: pinError } = await supabase
        .from("pins")
        .insert({
          route_id: routeId,
          place_name: address,
          address: address,
          pin_order: pinOrder,
          latitude: coordinates?.lat || null,
          longitude: coordinates?.lng || null,
        });

      if (pinError) throw pinError;

      toast({
        title: "Zapisano",
        description: selectedRouteId === "new" 
          ? "Notatka została dodana do nowej wersji roboczej"
          : "Pinezka została dodana do trasy",
      });

      onOpenChange(false);
      navigate("/my-routes");
    } catch (error) {
      console.error("Error saving quick note:", error);
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się zapisać notatki",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-none sm:max-w-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="bg-background border-b border-border p-4 z-10">
            <div className="max-w-lg mx-auto space-y-3">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Szybka notatka
                </DialogTitle>
              </DialogHeader>

              {/* Get location button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGetLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4 mr-2" />
                )}
                Pobierz moją lokalizację
              </Button>

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
                <div className="bg-background border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.properties?.mapbox_id || index}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <p className="font-medium text-sm truncate">
                        {suggestion.properties?.name || suggestion.properties?.place_formatted}
                      </p>
                      {suggestion.properties?.full_address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {suggestion.properties.full_address}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected address display */}
              {address && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm font-medium">Wybrana lokalizacja:</p>
                  <p className="text-sm text-muted-foreground truncate">{address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <InteractiveRouteMap
              pins={coordinates ? [{ latitude: coordinates.lat, longitude: coordinates.lng, place_name: address, address, pin_order: 0 }] : []}
              className="w-full h-full rounded-none border-none"
              onPinAdd={handleMapPinAdd}
            />
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground">
              Kliknij na mapie aby wybrać lokalizację
            </p>
          </div>

          {/* Bottom panel with route selection and save */}
          <div className="bg-background border-t border-border p-4 z-10">
            <div className="max-w-lg mx-auto space-y-4">
              {/* Route selection */}
              <div className="space-y-2">
                <Label>Dodaj do trasy:</Label>
                <RadioGroup value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new-route" />
                    <Label htmlFor="new-route" className="font-normal flex items-center gap-2 cursor-pointer">
                      <Plus className="h-4 w-4" />
                      Utwórz nową trasę
                    </Label>
                  </div>
                  {draftRoutes?.map((route) => (
                    <div key={route.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={route.id} id={route.id} />
                      <Label htmlFor={route.id} className="font-normal cursor-pointer">
                        {route.title} ({route.pins?.length || 0} pinezek)
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={loading || !address.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Zapisz
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
