import { useState, useEffect } from "react";
import { X, Star, MapPin, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { supabase } from "@/integrations/supabase/client";

interface PlaceDetail {
  name: string;
  rating: number;
  user_ratings_total: number;
  price_level?: number;
  types: string[];
  formatted_address: string;
  photos: { photo_reference: string }[];
  reviews: {
    author_name: string;
    profile_photo_url: string;
    rating: number;
    relative_time_description: string;
    text: string;
  }[];
  geometry: { location: { lat: number; lng: number } };
}

interface PlaceDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
}

const categoryLabels: Record<string, string> = {
  restaurant: "Restauracja",
  cafe: "Kawiarnia",
  museum: "Muzeum",
  park: "Park",
  bar: "Bar",
  bakery: "Piekarnia",
  church: "Kościół",
  art_gallery: "Galeria",
  tourist_attraction: "Atrakcja",
  shopping_mall: "Centrum handlowe",
  lodging: "Hotel",
};

const getPriceLabel = (level?: number) => {
  if (!level) return null;
  const labels = ["", "Tanie", "Umiarkowane", "Drogie", "Bardzo drogie"];
  const symbols = ["", "zł", "zł zł", "zł zł zł", "zł zł zł zł"];
  return { label: labels[level] || "", symbol: symbols[level] || "" };
};

const getPhotoUrl = (ref: string, maxWidth = 400) =>
  `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${ref}&key=${GOOGLE_MAPS_API_KEY}`;

const PlaceDetailDrawer = ({
  open,
  onOpenChange,
  placeName,
  address,
  latitude,
  longitude,
}: PlaceDetailDrawerProps) => {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setError(false);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(false);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "google-places-proxy",
          { body: { placeName, latitude, longitude } }
        );

        if (fnError || !data?.result) {
          console.error("Place details proxy error:", fnError || data?.error);
          setError(true);
        } else {
          setDetail(data.result);
        }
      } catch (err) {
        console.error("Place details fetch error:", err);
        setError(true);
      }

      setLoading(false);
    };

    fetchDetails();
  }, [open, placeName, latitude, longitude]);

  const mainType = detail?.types?.find((t) => categoryLabels[t]);
  const price = getPriceLabel(detail?.price_level);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 overflow-hidden">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ładowanie informacji...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <MapPin className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center">
              Nie udało się pobrać szczegółów dla "{placeName}"
            </p>
            <button
              onClick={() => onOpenChange(false)}
              className="text-sm text-foreground underline"
            >
              Zamknij
            </button>
          </div>
        )}

        {detail && !loading && (
          <div className="h-full overflow-y-auto">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-sm border border-border"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-5 pt-6 space-y-5">
              {/* Header */}
              <div>
                <h2 className="text-xl font-bold text-foreground pr-8">
                  {detail.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                  {detail.rating && (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      {detail.rating}
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-muted-foreground font-normal">
                        ({detail.user_ratings_total?.toLocaleString("pl")})
                      </span>
                    </span>
                  )}
                  {price && (
                    <>
                      <span>·</span>
                      <span>{price.symbol}</span>
                    </>
                  )}
                  {mainType && (
                    <>
                      <span>·</span>
                      <span>{categoryLabels[mainType]}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Photos */}
              {detail.photos && detail.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Zdjęcia</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                    {detail.photos.slice(0, 6).map((photo, i) => (
                      <img
                        key={i}
                        src={getPhotoUrl(photo.photo_reference)}
                        alt={`${detail.name} ${i + 1}`}
                        className="h-40 w-56 rounded-xl object-cover flex-shrink-0 snap-start"
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              {detail.reviews && detail.reviews.length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-foreground mb-3">Opinie</h3>
                  <div className="space-y-4">
                    {detail.reviews.slice(0, 3).map((review, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={review.profile_photo_url}
                            alt={review.author_name}
                            className="h-8 w-8 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {review.author_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Opinia z{" "}
                              <span className="font-semibold text-foreground">G</span>{" "}
                              <span className="text-blue-600 font-medium">Google</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{review.rating}/5</span>
                          <span className="text-xs text-muted-foreground">
                            · {review.relative_time_description}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-4">
                          {review.text}
                          {review.text && review.text.length > 150 && (
                            <span className="text-blue-600 font-medium cursor-pointer">...Więcej</span>
                          )}
                        </p>
                        {i < Math.min(detail.reviews.length, 3) - 1 && (
                          <div className="pt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Map */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Miejsce na mapie
                </h3>
                <div className="rounded-xl overflow-hidden border border-border h-48">
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=600x300&scale=2&markers=color:black|${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`}
                    alt="Mapa"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {detail.formatted_address}
                </p>
              </div>

              <div className="h-6" />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PlaceDetailDrawer;
