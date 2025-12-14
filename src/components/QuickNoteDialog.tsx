import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, LocateFixed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
      // Create draft route
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

      // Create pin with address
      const { error: pinError } = await supabase
        .from("pins")
        .insert({
          route_id: route.id,
          place_name: address,
          address: address,
          pin_order: 0,
          latitude: coordinates?.lat || null,
          longitude: coordinates?.lng || null,
        });

      if (pinError) throw pinError;

      toast({
        title: "Zapisano",
        description: "Notatka została dodana do wersji roboczych",
      });

      onOpenChange(false);
      setAddress("");
      setCoordinates(null);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Szybka notatka
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Adres lub lokalizacja"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={loading || !address.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Zapisz jako wersję roboczą
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
