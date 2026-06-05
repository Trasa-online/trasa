// PlaceSwiperDetail: bottom-sheet drawer otwierany po tap karty w PlaceSwiper.
// Renderuje wizytowke biznesowa (Premium content) z full set sekcji.
//
// Po refactor (commit a1494d2 / Phase 4): cala logika UI renderowania sekcji jest
// w `<PremiumBusinessCard mode='detail'/>`. Ten plik trzyma tylko:
// - Sheet wrapper z drag-to-dismiss
// - Data fetching useEffect (Google Places detail + business_posts)
// - Like/Skip CTA fixed bottom (tylko gdy props onLike/onSkip podane)
// - Maps button w header slot

import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl, isCachedPhotoUrl, ensurePhotoCached } from "@/lib/placePhotos";
import { type MockPlace } from "./PlaceSwiper";
import posthog from "posthog-js";
import PremiumBusinessCard from "@/components/business/PremiumBusinessCard";
import { fromMockPlace } from "@/components/business/premiumBusinessAdapters";
import type { BusinessPost, GoogleReview } from "@/components/business/premiumBusiness.types";

interface PlaceDetail {
  place_id?: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  price_level?: number;
  types: string[];
  formatted_address: string;
  photos: { photo_reference: string }[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  reviews: GoogleReview[];
}

interface PlaceSwiperDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: MockPlace | null;
  city?: string;
  onLike?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
  skipGoogleFetch?: boolean;
}

const validUrl = (url?: string | null) =>
  !!url && (url.startsWith("http") || url.startsWith("/")) &&
  !url.includes("staticmap") && !url.includes("maps/api/staticmap");

const PlaceSwiperDetail = ({
  open,
  onOpenChange,
  place,
  city,
  onLike,
  onSkip,
  skipGoogleFetch = false,
}: PlaceSwiperDetailProps) => {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [businessPosts, setBusinessPosts] = useState<BusinessPost[]>([]);

  useEffect(() => {
    if (!open || !place) {
      setDetail(null);
      setPhotos([]);
      setBusinessPosts([]);
      return;
    }

    setLoading(true);

    // Track view event for real places (UUID, not mock)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(place.id)) {
      posthog.capture("place_viewed", { place_id: place.id });
    }

    const fetchAll = async () => {
      // Business with own photos → use their photos (don't override with Google),
      // ale NADAL fetchujemy Google detail dla reviews, formatted_address, rating,
      // user_ratings_total.
      const hasBizPhotos = place.businessHasOwnPhoto || skipGoogleFetch;
      if (hasBizPhotos) {
        setPhotos([place.photo_url, ...(place.galleryPhotos ?? [])].filter(Boolean) as string[]);
      }

      const alreadyCached = isCachedPhotoUrl(place.photo_url);
      const hasGallery = (place.galleryPhotos ?? []).length > 0;
      const placesPromise = supabase.functions
        .invoke("google-places-proxy", {
          body: {
            placeName: place.place_name,
            latitude: place.latitude,
            longitude: place.longitude,
            city: city ?? place.city,
          },
        })
        .then(({ data }) => {
          if (data?.result) {
            setDetail(data.result);
            // Nie nadpisuj photos Google'em gdy biznes ma juz wlasne zdjecia.
            if (!alreadyCached && !hasGallery && !hasBizPhotos) {
              const urls = (data.result.photos ?? [])
                .slice(0, 3)
                .map((p: { photo_url?: string; photo_reference?: string }) => p.photo_url ?? getPhotoUrl(p.photo_reference ?? "", 800))
                .filter((u: string | undefined): u is string => typeof u === "string" && (u.startsWith("http") || u.startsWith("/api/")));
              if (urls.length > 0) setPhotos(urls);
              ensurePhotoCached(
                {
                  table: "places",
                  id: place.id,
                  place_name: place.place_name,
                  city: city ?? place.city,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  place_id: data.result.place_id,
                },
                place.photo_url ?? null,
              ).catch(() => {});
            }
          }
        })
        .catch(() => {});

      const postsPromise = place.businessLogoUrl !== undefined
        ? (supabase as any)
            .from("business_posts")
            .select("id, description, photo_urls, created_at")
            .eq("place_id", place.id)
            .order("created_at", { ascending: false })
            .limit(10)
            .then(({ data }: { data: BusinessPost[] | null }) => { if (data) setBusinessPosts(data); })
        : Promise.resolve();

      await Promise.allSettled([placesPromise, postsPromise]);
      setLoading(false);
    };

    fetchAll();
  }, [open, place, city, skipGoogleFetch]);

  const handleLike = () => { onLike?.(); onOpenChange(false); };
  const handleSkip = () => { onSkip?.(); onOpenChange(false); };

  // Calculate photos to display (biz cover + Google + biz gallery dedup)
  const googleAndCover = [
    ...photos.filter(validUrl),
    ...(!photos.length && validUrl(place?.photo_url) ? [place!.photo_url!] : []),
  ];
  const displayPhotos = [
    ...googleAndCover,
    ...(place?.galleryPhotos ?? []).filter(validUrl).filter(u => !googleAndCover.includes(u)),
  ];

  // Maps button - renderowany w header slot PremiumBusinessCard (Maps button obok nazwy)
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.place_name} ${place.address ?? ""}`)}`
    : "#";
  const mapsButton = (
    <div className="flex justify-end -mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(mapsUrl, "_blank", "noopener,noreferrer");
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card text-foreground text-xs font-semibold active:scale-95 transition-transform"
      >
        <MapPin className="h-3.5 w-3.5" />
        Maps
      </button>
    </div>
  );

  if (!place) return null;

  const businessData = fromMockPlace(place, detail, businessPosts);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[96dvh] rounded-t-3xl p-0 overflow-hidden flex flex-col [&>button]:hidden bg-background"
      >
        {/* Scrollable wrapper - motion.div drag-to-dismiss wyrzucone bo blokowal native scroll
            na iOS WebView. Sheet ma close button (Hero X) + tap-outside-to-close + Esc. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <PremiumBusinessCard
            data={businessData}
            mode="detail"
            detailPhotos={displayPhotos}
            detailLoading={loading}
            onClose={() => onOpenChange(false)}
            header={mapsButton}
          />
        </div>

        {/* Like / Skip CTA - fixed bottom poza PremiumBusinessCard */}
        {(onLike || onSkip) && (
          <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/10 bg-background">
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-3 rounded-full bg-white text-foreground font-bold text-sm shadow-xl border border-border/40 active:scale-[0.97] transition-transform"
              >
                Odrzuć
              </button>
              <button
                onClick={handleLike}
                className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-xl shadow-primary/30 active:scale-[0.97] transition-transform"
              >
                Dodaj
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PlaceSwiperDetail;
