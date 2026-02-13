import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Loader2, X, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";
import { reverseGeocode } from "@/lib/googleMaps";

interface QuickAddPinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinAdd: (pin: {
    latitude: number;
    longitude: number;
    address: string;
    place_name: string;
    image_url?: string;
  }) => void;
  userId: string;
}

export const QuickAddPinSheet = ({ 
  open, 
  onOpenChange, 
  onPinAdd,
  userId 
}: QuickAddPinSheetProps) => {
  const { toast } = useToast();
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    place_name: string;
  } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Auto-detect location when sheet opens
  useEffect(() => {
    if (open && !location) {
      detectLocation();
    }
  }, [open]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setLocation(null);
      setImageUrl(null);
    }
  }, [open]);

  const detectLocation = async () => {
    setGettingLocation(true);
    
    try {
      // Get GPS coordinates
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Reverse geocode to get address using Google Maps
      const result = await reverseGeocode(lat, lng);

      if (result) {
        setLocation({
          latitude: lat,
          longitude: lng,
          address: result.fullAddress,
          place_name: result.placeName || result.fullAddress.split(',')[0]
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
    } catch (error) {
      console.error('Location error:', error);
      toast({
        variant: "destructive",
        title: "Nie można pobrać lokalizacji",
        description: "Upewnij się, że masz włączoną lokalizację w przeglądarce",
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      // Compress and upload image
      const compressedBlob = await compressImage(file, 1920, 1920, 0.8);
      const fileName = `${userId}/${Date.now()}.jpg`;

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
      
      // Haptic feedback
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

  const handleSave = () => {
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

    onPinAdd({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      place_name: location.place_name,
      image_url: imageUrl || undefined
    });

    // Reset and close
    setLocation(null);
    setImageUrl(null);
    onOpenChange(false);

    toast({
      title: "Miejsce dodane! ⚡",
      description: "Możesz dodać szczegóły później"
    });
  };

  const handleCancel = () => {
    setLocation(null);
    setImageUrl(null);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            Dodaj miejsce
          </SheetTitle>
          <SheetDescription>
            Szybkie dodawanie - lokalizacja i zdjęcie (opcjonalnie)
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Location */}
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
            ) : location ? (
              <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20 space-y-2">
                <p className="font-medium text-foreground">{location.place_name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{location.address}</p>
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

          {/* Photo */}
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
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 h-12"
          >
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!location || gettingLocation}
            className="flex-1 h-12 text-base font-semibold"
          >
            Zapisz miejsce
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
