import { useNavigate } from "react-router-dom";
import { Zap, Edit, Check, MapPin, Camera, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface CreateModeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DraftRoute {
  id: string;
  title: string;
  pin_count: number;
}

interface DetectedLocation {
  latitude: number;
  longitude: number;
  place_name: string;
  address: string;
}

interface QuickPin {
  place_name: string;
  address: string;
  latitude: number;
  longitude: number;
  image_url?: string;
}

type DrawerMode = 'select' | 'quick-capture';

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

export const CreateModeDrawer = ({ open, onOpenChange }: CreateModeDrawerProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Mode state
  const [mode, setMode] = useState<DrawerMode>('select');
  const [selectedMode, setSelectedMode] = useState<'quick' | 'detailed' | null>(null);
  
  // Quick capture state
  const [drafts, setDrafts] = useState<DraftRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [customRouteTitle, setCustomRouteTitle] = useState<string>('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [pins, setPins] = useState<QuickPin[]>([]);
  const [location, setLocation] = useState<DetectedLocation | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate default title based on date
  const defaultTitle = `Trasa ${new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;

  // Fetch user's draft routes
  const fetchDrafts = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('routes')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (data) {
      // Get pin counts for each draft
      const draftsWithCounts = await Promise.all(
        data.map(async (route) => {
          const { count } = await supabase
            .from('pins')
            .select('*', { count: 'exact', head: true })
            .eq('route_id', route.id);
          return { ...route, pin_count: count || 0 };
        })
      );
      setDrafts(draftsWithCounts);
    }
  };

  // Detect current location using GPS + reverse geocoding
  const detectLocation = async () => {
    setDetectingLocation(true);
    setLocationError(null);
    setShowManualInput(false);
    
    if (!navigator.geolocation) {
      setLocationError("Geolokalizacja nie jest wspierana");
      setDetectingLocation(false);
      setShowManualInput(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode to get place name
          const response = await fetch(
            `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${longitude}&latitude=${latitude}&access_token=${MAPBOX_TOKEN}&language=pl`
          );
          const data = await response.json();
          
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            setLocation({
              latitude,
              longitude,
              place_name: feature.properties.name || feature.properties.full_address?.split(',')[0] || 'Nieznane miejsce',
              address: feature.properties.full_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            });
          } else {
            setLocation({
              latitude,
              longitude,
              place_name: 'Twoja lokalizacja',
              address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            });
          }
        } catch {
          setLocation({
            latitude,
            longitude,
            place_name: 'Twoja lokalizacja',
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          });
        }
        
        setDetectingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(
          error.code === 1 ? "Brak zgody na lokalizację" :
          error.code === 2 ? "Lokalizacja niedostępna" :
          "Nie udało się wykryć lokalizacji"
        );
        setDetectingLocation(false);
        setShowManualInput(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.8);
      const fileName = `${user.id}/${Date.now()}-quick.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('route-images')
        .upload(fileName, compressed, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('route-images')
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Błąd przesyłania",
        description: "Nie udało się przesłać zdjęcia",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle manual address selection
  const handleManualAddressSelect = (
    displayValue: string, 
    coordinates?: { latitude: number; longitude: number }, 
    fullAddress?: string, 
    placeName?: string
  ) => {
    if (coordinates) {
      setLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        place_name: placeName || displayValue.split(',')[0] || displayValue,
        address: fullAddress || displayValue
      });
      setShowManualInput(false);
      setLocationError(null);
    }
  };

  // Save pin to database
  const handleSavePin = async () => {
    if (!location || !user) return;
    
    setSaving(true);
    try {
      let routeId = selectedRouteId;
      
      // Create new route if needed
      if (!routeId || routeId === 'new') {
        const routeTitle = customRouteTitle.trim() || defaultTitle;
        const { data: newRoute, error: routeError } = await supabase
          .from('routes')
          .insert({
            user_id: user.id,
            title: routeTitle,
            status: 'draft'
          })
          .select()
          .single();
        
        if (routeError) throw routeError;
        routeId = newRoute.id;
        setSelectedRouteId(routeId);
        
        // Add to drafts list
        setDrafts(prev => [{ id: routeId!, title: routeTitle, pin_count: 0 }, ...prev]);
      }
      
      // Add pin to database
      const { error: pinError } = await supabase
        .from('pins')
        .insert({
          route_id: routeId,
          place_name: location.place_name,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          image_url: imageUrl,
          pin_order: pins.length
        });
      
      if (pinError) throw pinError;
      
      // Update local state
      setPins(prev => [...prev, { ...location, image_url: imageUrl || undefined }]);
      
      // Update draft pin count
      setDrafts(prev => prev.map(d => 
        d.id === routeId ? { ...d, pin_count: d.pin_count + 1 } : d
      ));
      
      toast({
        title: "Miejsce dodane! ⚡",
        description: `${location.place_name} zapisane na trasie`
      });
      
      // Close drawer and navigate to feed
      handleClose();
      navigate('/feed');
      
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Błąd zapisywania",
        description: "Nie udało się zapisać miejsca",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Finish and navigate to route editor
  const handleFinish = () => {
    if (selectedRouteId && selectedRouteId !== 'new') {
      navigate(`/edit/${selectedRouteId}`);
    } else if (pins.length > 0) {
      // Find the route we just created
      navigate(`/edit/${selectedRouteId}`);
    } else {
      navigate('/create');
    }
    handleClose();
  };

  // Handle mode selection (quick mode goes directly to quick-capture)
  const handleQuickModeSelect = () => {
    setMode('quick-capture');
    fetchDrafts();
    detectLocation();
  };

  const handleDetailedContinue = () => {
    navigate("/create");
    onOpenChange(false);
    resetState();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(resetState, 300);
  };

  const resetState = () => {
    setMode('select');
    setSelectedMode(null);
    setSelectedRouteId(null);
    setCustomRouteTitle('');
    setShowTitleInput(false);
    setPins([]);
    setLocation(null);
    setLocationError(null);
    setImageUrl(null);
    setShowManualInput(false);
    setDrafts([]);
  };

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      setTimeout(resetState, 300);
    }
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh]">
        {mode === 'select' ? (
          // MODE SELECTION VIEW
          <>
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="text-xl">Jak chcesz tworzyć trasę?</DrawerTitle>
              <DrawerDescription>
                Wybierz tryb dodawania miejsc do trasy
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-4">
              {/* Quick Capture Mode - clicks immediately go to quick-capture */}
              <button
                type="button"
                onClick={handleQuickModeSelect}
                className={cn(
                  "w-full p-5 rounded-xl border-2 transition-all text-left",
                  "border-border hover:border-primary/50 hover:shadow-sm hover:bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl">⚡</div>
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Szybki tryb</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Dodawaj miejsca w 10 sekund podczas wycieczki. Lokalizacja i zdjęcie - gotowe!
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Zap className="h-3 w-3" />
                      <span>Idealny podczas podróży</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Detailed Mode */}
              <button
                type="button"
                onClick={() => setSelectedMode('detailed')}
                className={cn(
                  "w-full p-5 rounded-xl border-2 transition-all text-left",
                  selectedMode === 'detailed'
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                    : "border-border hover:border-primary/50 hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl">✍️</div>
                  <div className="flex-1">
                    <div className="font-semibold text-base mb-1">Szczegółowy tryb</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pełna kontrola. Dodawaj opisy, oceny, kategorie i notatki od razu.
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Edit className="h-3 w-3" />
                      <span>Idealny po podróży</span>
                    </div>
                  </div>
                  {selectedMode === 'detailed' && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>

              {/* Helpful hint */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  💡 <strong>Wskazówka:</strong> Nie martw się! Niezależnie od wybranego trybu, zawsze możesz dodać szczegóły później.
                </p>
              </div>

              {/* Continue button - only for detailed mode */}
              {selectedMode === 'detailed' && (
                <Button
                  onClick={handleDetailedContinue}
                  className="w-full h-12 text-base font-semibold"
                >
                  Kontynuuj
                </Button>
              )}
            </div>
          </>
        ) : (
          // QUICK CAPTURE VIEW
          <>
            <DrawerHeader className="text-left pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <DrawerTitle className="text-xl">Szybkie dodawanie</DrawerTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setMode('select')}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* Route selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">TRASA</label>
                <Select 
                  value={selectedRouteId || 'new'} 
                  onValueChange={(value) => {
                    setSelectedRouteId(value);
                    setShowTitleInput(value === 'new');
                    if (value !== 'new') {
                      setCustomRouteTitle('');
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz lub utwórz trasę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <span className="flex items-center gap-2">
                        <span className="text-primary">+</span> Nowa trasa ({defaultTitle})
                      </span>
                    </SelectItem>
                    {drafts.map(draft => (
                      <SelectItem key={draft.id} value={draft.id}>
                        <span className="flex items-center gap-2">
                          {draft.title}
                          <span className="text-xs text-muted-foreground">
                            ({draft.pin_count} {draft.pin_count === 1 ? 'miejsce' : 'miejsc'})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Optional title input for new route */}
                {(selectedRouteId === 'new' || !selectedRouteId) && (
                  <div className="space-y-1.5">
                    {!showTitleInput ? (
                      <button
                        type="button"
                        onClick={() => setShowTitleInput(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Nadaj własną nazwę trasie
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customRouteTitle}
                          onChange={(e) => setCustomRouteTitle(e.target.value)}
                          placeholder={defaultTitle}
                          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            setShowTitleInput(false);
                            setCustomRouteTitle('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  LOKALIZACJA
                </label>
                
                {detectingLocation ? (
                  <div className="p-4 border rounded-xl bg-muted/30 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">Wykrywanie lokalizacji...</span>
                  </div>
                ) : location ? (
                  <div className="p-4 border rounded-xl bg-primary/5 border-primary/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium truncate">{location.place_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={detectLocation}
                        className="h-8 px-2 text-xs flex-shrink-0"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Odśwież
                      </Button>
                    </div>
                  </div>
                ) : locationError ? (
                  <div className="p-4 border rounded-xl border-destructive/30 bg-destructive/5">
                    <p className="text-sm text-destructive mb-2">{locationError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={detectLocation}
                      className="text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Spróbuj ponownie
                    </Button>
                  </div>
                ) : null}

                {/* Manual input toggle/field */}
                {showManualInput || (!location && !detectingLocation) ? (
                  <div className="mt-2">
                    <AddressAutocomplete
                      value=""
                      onChange={(address, lat, lng) => handleManualAddressSelect(address, lat, lng)}
                      placeholder="Wpisz adres ręcznie..."
                    />
                  </div>
                ) : location && (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Wpisz adres ręcznie
                  </button>
                )}
              </div>

              {/* Photo section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" />
                  ZDJĘCIE (opcjonalne)
                </label>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {imageUrl ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border">
                    <img 
                      src={imageUrl} 
                      alt="Zdjęcie miejsca" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => setImageUrl(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8" />
                        <span className="text-sm">Dotknij aby dodać zdjęcie</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Added pins preview */}
              {pins.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    DODANE MIEJSCA ({pins.length})
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {pins.map((pin, index) => (
                      <div
                        key={index}
                        className="flex-shrink-0 w-16 h-16 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden"
                      >
                        {pin.image_url ? (
                          <img 
                            src={pin.image_url} 
                            alt={pin.place_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            <MapPin className="h-5 w-5 text-primary" />
                            <span className="text-xs font-medium">{index + 1}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSavePin}
                  disabled={!location || saving}
                  className="flex-1 h-12"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Zapisz miejsce
                </Button>
                
                {pins.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleFinish}
                    className="h-12"
                  >
                    Zakończ →
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
