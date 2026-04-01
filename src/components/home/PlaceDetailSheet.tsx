import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, MapPin, ExternalLink, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCachedPhotoUrl } from "@/lib/placePhotos";

interface Pin {
  id: string;
  place_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  suggested_time?: string | null;
}

interface PlaceDetailSheetProps {
  pin: Pin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlaceDetailSheet = ({ pin, open, onOpenChange }: PlaceDetailSheetProps) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);

  const [cachedPhotoUrl, setCachedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!pin.latitude || !pin.longitude) return;
    setLoading(true);
    setDetails(null);
    setCachedPhotoUrl(null);
    supabase.functions.invoke("google-places-proxy", {
      body: { placeName: pin.place_name, latitude: pin.latitude, longitude: pin.longitude },
    }).then(async ({ data, error }) => {
      if (!error && data?.result) {
        setDetails(data.result);
        // Cache first photo
        const ref = data.result.photos?.[0]?.photo_reference;
        if (ref) {
          const url = await getCachedPhotoUrl(ref, 600);
          if (url) setCachedPhotoUrl(url);
        }
      }
      setLoading(false);
    });
  }, [open, pin.id]);


  const mapsUrl = pin.latitude && pin.longitude
    ? `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(pin.place_name)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl overflow-y-auto" style={{ maxHeight: "85vh" }}>
        <SheetHeader className="pb-3">
          <SheetTitle className="text-left">{pin.place_name}</SheetTitle>
          {pin.address && (
            <p className="text-sm text-muted-foreground text-left leading-snug">{pin.address}</p>
          )}
          {pin.suggested_time && (
            <p className="text-xs text-muted-foreground text-left">{pin.suggested_time}</p>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && details && (
          <div className="space-y-5 pb-6">
            {/* Photos */}
            {details.photos?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-6 px-6 pb-1 snap-x">
                {details.photos.slice(0, 6).map((photo: any, i: number) => (
                  <img
                    key={i}
                    src={photoUrl(photo.photo_reference)}
                    alt={pin.place_name}
                    className="h-44 w-64 object-cover rounded-2xl flex-shrink-0 snap-start"
                  />
                ))}
              </div>
            )}

            {/* Rating */}
            {details.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-sm">{details.rating}</span>
                {details.user_ratings_total && (
                  <span className="text-xs text-muted-foreground">
                    ({details.user_ratings_total.toLocaleString()} opinii)
                  </span>
                )}
              </div>
            )}

            {/* Opening hours */}
            {details.opening_hours ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn("text-sm font-semibold", details.opening_hours.open_now ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                    {details.opening_hours.open_now ? "Otwarte teraz" : "Zamknięte"}
                  </span>
                </div>
                {details.opening_hours.weekday_text?.length > 0 && (
                  <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                    {(details.opening_hours.weekday_text as string[]).map((line, i) => {
                      const [day, ...rest] = line.split(": ");
                      return (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground w-24 flex-shrink-0">{day}</span>
                          <span className="text-foreground/80">{rest.join(": ")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl px-3 py-2.5">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Brak potwierdzonych godzin otwarcia — sprawdź w Google</span>
              </div>
            )}

            {/* Reviews */}
            {details.reviews?.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Ostatnie opinie
                </p>
                {details.reviews.slice(0, 3).map((review: any, i: number) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{review.author_name}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: review.rating ?? 0 }).map((_, j) => (
                          <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Map link */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Otwórz w Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}

        {/* No coordinates fallback */}
        {!loading && !details && (
          <div className="pb-6 space-y-3">
            {pin.latitude && pin.longitude && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nie udało się pobrać szczegółów.
              </p>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Szukaj w Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PlaceDetailSheet;
