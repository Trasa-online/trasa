import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Loader2, X, RefreshCw, ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtDrpd-lKHh11bxtjshs2o6eHl5sDdVImnsW8t1OhU";

interface QuickPin {
  latitude: number;
  longitude: number;
  address: string;
  place_name: string;
  image_url?: string;
}

const QuickCapture = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [pins, setPins] = useState<QuickPin[]>([]);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingRoute, setSavingRoute] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    place_name: string;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Auto-detect location on mount
  useEffect(() => {
    if (user) {
      detectLocation();
    }
  }, [user]);

  const detectLocation = async () => {
    setGettingLocation(true);
    setLocationError(null);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Reverse geocode to get address
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=pl`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const place = data.features[0];
        setLocation({
          latitude: lat,
          longitude: lng,
          address: place.place_name,
          place_name: place.text || place.place_name.split(',')[0]
        });
      } else {
        setLocation({
          latitude: lat,
          longitude: lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          place_name: "Nowe miejsce"
        });
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error: any) {
      console.error('Location error:', error);
      setLocationError(
        error.code === 1 
          ? "Brak uprawnień do lokalizacji. Włącz lokalizację w ustawieniach przeglądarki."
          : "Nie można pobrać lokalizacji. Spróbuj ponownie."
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImage(true);

    try {
      const compressedBlob = await compressImage(file, 1920, 1920, 0.8);
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg"
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("route-images")
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      toast({ title: "Zdjęcie dodane!" });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        variant: "destructive",
        title: "Błąd przesyłania zdjęcia",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSavePin = () => {
    if (!location) {
      toast({
        variant: "destructive",
        title: "Lokalizacja jest wymagana",
      });
      return;
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }

    const newPin: QuickPin = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      place_name: location.place_name,
      image_url: imageUrl || undefined
    };

    setPins(prev => [...prev, newPin]);
    setImageUrl(null);
    setLocation(null);
    
    toast({
      title: "Miejsce dodane! ⚡",
      description: `${newPin.place_name} - miejsce ${pins.length + 1}`,
    });

    // Auto-detect next location
    detectLocation();
  };

  const handleFinishRoute = async () => {
    if (!user) return;
    
    if (pins.length === 0) {
      toast({
        variant: "destructive",
        title: "Dodaj przynajmniej jedno miejsce",
      });
      return;
    }

    setSavingRoute(true);

    try {
      // Create route with default title
      const defaultTitle = `Trasa ${new Date().toLocaleDateString('pl-PL')}`;
      
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          user_id: user.id,
          title: defaultTitle,
          description: "",
          status: "draft",
          trip_type: "completed"
        })
        .select()
        .single();

      if (routeError) throw routeError;

      // Insert all pins
      const pinsToInsert = pins.map((pin, index) => ({
        route_id: route.id,
        place_name: pin.place_name,
        address: pin.address,
        latitude: pin.latitude,
        longitude: pin.longitude,
        image_url: pin.image_url || null,
        images: pin.image_url ? [pin.image_url] : [],
        pin_order: index,
        description: "",
        rating: null,
        tags: [],
        is_transport: false,
        original_creator_id: user.id,
      }));

      const { error: pinsError } = await supabase
        .from("pins")
        .insert(pinsToInsert);

      if (pinsError) throw pinsError;

      toast({
        title: "Trasa utworzona! 🎉",
        description: `Dodano ${pins.length} miejsc`,
      });

      // Navigate to edit route (step 3 - summary)
      navigate(`/edit/${route.id}`);
    } catch (error) {
      console.error('Error creating route:', error);
      toast({
        variant: "destructive",
        title: "Błąd podczas tworzenia trasy",
      });
    } finally {
      setSavingRoute(false);
    }
  };

  const removePin = (index: number) => {
    setPins(prev => prev.filter((_, i) => i !== index));
    toast({ title: "Miejsce usunięte" });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="font-semibold">Szybkie dodawanie</h1>
          </div>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 space-y-6 pb-32">
        {/* Location Section */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            Lokalizacja
          </Label>
          
          {gettingLocation ? (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Wykrywanie lokalizacji...</span>
            </div>
          ) : locationError ? (
            <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 space-y-3">
              <p className="text-sm text-destructive">{locationError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectLocation}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Spróbuj ponownie
              </Button>
            </div>
          ) : location ? (
            <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20 space-y-2">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{location.place_name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{location.address}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={detectLocation}
                className="mt-1 h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Wykryj ponownie
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={detectLocation}
              className="w-full h-14 text-base"
            >
              <MapPin className="h-5 w-5 mr-2" />
              Wykryj moją lokalizację
            </Button>
          )}
        </div>

        {/* Photo Section */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Camera className="h-4 w-4 text-primary" />
            Zdjęcie (opcjonalne)
          </Label>
          
          {uploadingImage ? (
            <div className="aspect-video bg-muted/50 rounded-xl border border-border flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Przesyłanie...</p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-primary/20">
              <img 
                src={imageUrl} 
                alt="Dodane zdjęcie" 
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setImageUrl(null)}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="aspect-video bg-muted/30 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center justify-center gap-2">
                <Camera className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Dotknij aby dodać zdjęcie</span>
                <span className="text-xs text-muted-foreground/60">Lub pomiń ten krok</span>
              </div>
            </label>
          )}
        </div>

        {/* Added pins list */}
        {pins.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Dodane miejsca ({pins.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {pins.map((pin, index) => (
                <div
                  key={index}
                  className="relative group"
                >
                  <div className={cn(
                    "w-16 h-16 rounded-xl border-2 overflow-hidden",
                    "bg-muted flex items-center justify-center",
                    pin.image_url ? "border-primary/30" : "border-border"
                  )}>
                    {pin.image_url ? (
                      <img 
                        src={pin.image_url} 
                        alt={pin.place_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removePin(index)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="text-xs text-center mt-1 truncate w-16">{pin.place_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Fixed bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border space-y-3">
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleSavePin}
            disabled={!location || gettingLocation}
            className="flex-1 h-12 text-base font-semibold"
          >
            <MapPin className="h-5 w-5 mr-2" />
            Zapisz miejsce
          </Button>
        </div>
        
        {pins.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleFinishRoute}
            disabled={savingRoute}
            className="w-full h-12 text-base"
          >
            {savingRoute ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              <>
                Zakończ trasę ({pins.length} miejsc)
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuickCapture;
