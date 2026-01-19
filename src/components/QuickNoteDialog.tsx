import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, LocateFixed, Search, Plus, ArrowLeft, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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
  const [step, setStep] = useState<"route" | "address">("route");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showNewRouteInput, setShowNewRouteInput] = useState(false);
  const [newRouteTitle, setNewRouteTitle] = useState("");
  const [showMapSelector, setShowMapSelector] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Initialize/update map when coordinates change
  useEffect(() => {
    if (!coordinates || !mapContainerRef.current || step !== "address") return;

    if (!mapRef.current) {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [coordinates.lng, coordinates.lat],
        zoom: 15,
      });
    } else {
      mapRef.current.setCenter([coordinates.lng, coordinates.lat]);
    }

    // Update marker
    if (markerRef.current) {
      markerRef.current.remove();
    }
    markerRef.current = new mapboxgl.Marker({ color: "#ef4444" })
      .setLngLat([coordinates.lng, coordinates.lat])
      .addTo(mapRef.current);

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [coordinates, step]);

  // Cleanup map on dialog close
  useEffect(() => {
    if (!open && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [open]);

  // Handle pin selection from InteractiveRouteMap
  const handleMapPinAdd = (pinData: { latitude: number; longitude: number; place_name: string; address: string }) => {
    setCoordinates({ lat: pinData.latitude, lng: pinData.longitude });
    setAddress(pinData.address || pinData.place_name || `${pinData.latitude.toFixed(6)}, ${pinData.longitude.toFixed(6)}`);
    setShowMapSelector(false);
  };

  // Fetch user's draft routes
  const { data: draftRoutes } = useQuery({
    queryKey: ["draft-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, title, pins(id, image_url)")
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
      setStep("route");
      setAddress("");
      setCoordinates(null);
      setSelectedRouteId(null);
      setSearchQuery("");
      setSuggestions([]);
      setShowNewRouteInput(false);
      setNewRouteTitle("");
      setShowMapSelector(false);
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

  const handleRouteSelect = (routeId: string) => {
    if (routeId === "new") {
      setSelectedRouteId("new");
      setShowNewRouteInput(true);
    } else {
      setSelectedRouteId(routeId);
      setShowNewRouteInput(false);
    }
  };

  const handleContinueToAddress = () => {
    if (!selectedRouteId) {
      toast({
        variant: "destructive",
        title: "Wybierz trasę",
        description: "Musisz wybrać trasę lub utworzyć nową",
      });
      return;
    }

    if (selectedRouteId === "new" && !newRouteTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Podaj nazwę trasy",
        description: "Nazwa nowej trasy jest wymagana",
      });
      return;
    }

    setStep("address");
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
            title: newRouteTitle.trim(),
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
          .eq("route_id", routeId!)
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
          route_id: routeId!,
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

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "address") {
      setStep("route");
    } else {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0 m-0 rounded-none border-none sm:max-w-none sm:rounded-none inset-0 translate-x-0 translate-y-0 left-0 top-0 [&>button]:hidden">
        <div className="relative w-full h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-background border-b border-border p-4 z-10 flex-shrink-0">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="p-1 hover:bg-muted rounded-md transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="font-semibold">
                  {step === "route" ? "Gdzie chcesz dodać pina?" : "Szybka notatka"}
                </h2>
              </div>
            </div>
          </div>

          {/* Step 1: Route Selection */}
          {step === "route" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-lg mx-auto space-y-4">
                {/* Create new route tile */}
                <button
                  type="button"
                  onClick={() => handleRouteSelect("new")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    selectedRouteId === "new"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Utwórz nową trasę</p>
                    <p className="text-xs text-muted-foreground">Rozpocznij nową wersję roboczą</p>
                  </div>
                  {selectedRouteId === "new" && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>

                {/* New route title input */}
                {showNewRouteInput && selectedRouteId === "new" && (
                  <div className="pl-4 border-l-2 border-primary/30 ml-4">
                    <Input
                      placeholder="Nazwa nowej trasy..."
                      value={newRouteTitle}
                      onChange={(e) => setNewRouteTitle(e.target.value)}
                      className="h-10"
                      autoFocus
                    />
                  </div>
                )}

                {/* Divider */}
                {draftRoutes && draftRoutes.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">lub wybierz istniejącą</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Existing draft routes */}
                <div className="space-y-2">
                  {draftRoutes?.map((route) => {
                    const thumbnailImage = route.pins?.find((pin: any) => pin.image_url)?.image_url;
                    const pinCount = route.pins?.length || 0;
                    
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => handleRouteSelect(route.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          selectedRouteId === route.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative flex-shrink-0">
                          {thumbnailImage ? (
                            <img
                              src={thumbnailImage}
                              alt={route.title}
                              className="w-12 h-12 object-cover rounded-lg ring-1 ring-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-muted via-muted/80 to-muted/50 ring-1 ring-border/50 flex items-center justify-center">
                              <MapPin className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          {/* Pin count badge */}
                          <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[9px] font-bold">{pinCount}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{route.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {pinCount} {pinCount === 1 ? "pinezka" : pinCount < 5 ? "pinezki" : "pinezek"}
                          </p>
                        </div>

                        {selectedRouteId === route.id && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Address Input */}
          {step === "address" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-lg mx-auto space-y-4">
                <Label className="text-sm font-medium">Adres</Label>
                
                {/* Search input with map selector */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Wpisz adres lub nazwę miejsca..."
                      className="pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      // Open fullscreen map for manual selection
                      setShowMapSelector(true);
                    }}
                    title="Wybierz na mapie"
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div className="bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.properties?.mapbox_id || index}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
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
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                    <p className="text-xs font-medium text-primary mb-1">Wybrana lokalizacja:</p>
                    <p className="text-sm">{address}</p>
                  </div>
                )}

                {/* Map preview when coordinates exist */}
                {coordinates && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <div ref={mapContainerRef} className="h-40 w-full" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom action area - fixed at bottom */}
          <div className="flex-shrink-0 bg-background border-t border-border p-4 pb-8">
            <div className="max-w-lg mx-auto space-y-3">
              {step === "route" ? (
                <Button
                  className="w-full h-12 text-base"
                  onClick={handleContinueToAddress}
                  disabled={!selectedRouteId || (selectedRouteId === "new" && !newRouteTitle.trim())}
                >
                  Kontynuuj
                </Button>
              ) : (
                <>
                  {/* Get location button - positioned for thumb access */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base"
                    onClick={handleGetLocation}
                    disabled={locating}
                  >
                    {locating ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <LocateFixed className="h-5 w-5 mr-2" />
                    )}
                    Pobierz moją lokalizację
                  </Button>

                  <Button
                    className="w-full h-12 text-base"
                    onClick={handleSave}
                    disabled={loading || !address.trim()}
                  >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Zapisz pinezkę
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen Map Selector */}
        {showMapSelector && (
          <div className="absolute inset-0 z-50 bg-background flex flex-col">
            <div className="bg-background border-b border-border p-4 flex items-center gap-3">
              <button 
                onClick={() => setShowMapSelector(false)} 
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="font-semibold">Wybierz lokalizację na mapie</h2>
            </div>
            <div className="flex-1">
              <InteractiveRouteMap
                pins={[]}
                className="h-full rounded-none border-0"
                onPinAdd={handleMapPinAdd}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
