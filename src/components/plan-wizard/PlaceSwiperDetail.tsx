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
import { MapPin, Navigation } from "lucide-react";
import { useDistanceReference } from "@/lib/distanceReference";
import { haversineKm, formatDistance } from "@/lib/distance";
import { Drawer as VaulDrawer } from "vaul";
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
  geometry?: { location?: { lat?: number; lng?: number } };
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
  const distanceRef = useDistanceReference();

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
            // Authorytatywny place_id z bazy - inaczej proxy rozwiazuje miejsce przez
            // luzne dopasowanie nazwy (nearbysearch/textsearch) i dla lokalu o popularnej
            // nazwie (np. "Wanderlust coffee place") potrafi trafic w INNY pobliski lokal
            // -> zly adres/mapa/recenzje. Karta swipe juz przekazuje ten id; detal musi tez.
            googlePlaceId: (place as { google_place_id?: string }).google_place_id ?? null,
            placeDbId: place.id,
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
  // Chip dystansu "X od {label}" - od wspolnego punktu odniesienia (GPS / punkt startowy).
  // Premium biznesy czesto maja NULL places.latitude/longitude - fallback na geometrie z
  // Google detail (proxy zwraca geometry), zeby chip dzialal tez dla wizytowek biznesowych.
  const placeLat = place?.latitude ?? detail?.geometry?.location?.lat ?? null;
  const placeLng = place?.longitude ?? detail?.geometry?.location?.lng ?? null;
  const distanceLabel = distanceRef && placeLat != null && placeLng != null
    ? formatDistance(haversineKm(distanceRef.coords, { lat: placeLat, lng: placeLng }))
    : null;

  const headerSlot = (
    <div className="flex items-center gap-2">
      {distanceLabel && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-semibold">
          <Navigation className="h-3.5 w-3.5" />
          {distanceLabel} od&nbsp;{distanceRef!.label}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(mapsUrl, "_blank", "noopener,noreferrer");
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-semibold active:scale-95 transition-transform"
      >
        <MapPin className="h-3.5 w-3.5" />
        Maps
      </button>
    </div>
  );

  if (!place) return null;

  const businessData = fromMockPlace(place, detail, businessPosts);

  return (
    <VaulDrawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <VaulDrawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-[#FEFEFE] overflow-hidden outline-none focus:outline-none"
          style={{ height: "min(96dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem))" }}
        >
          <VaulDrawer.Title className="sr-only">{place.place_name}</VaulDrawer.Title>
          {/* Uchwyt drag-to-dismiss - nad hero, pol-przezroczysty (hero ma wlasny X). */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-1.5 w-10 rounded-full bg-white/70 pointer-events-none" />
          {/* Scroll wrapper - vaul inicjuje drag-to-dismiss tylko gdy scroll jest na gorze,
              wiec native scroll do recenzji/galerii dziala normalnie (bez buga z iOS WebView).
              Wyjscie: drag w dol, tap w tlo (overlay), Esc, albo Hero X. */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
          <PremiumBusinessCard
            data={businessData}
            mode="detail"
            detailPhotos={displayPhotos}
            detailLoading={loading}
            onClose={() => onOpenChange(false)}
            header={headerSlot}
            hideReviews
            startingLocation={distanceRef ? { name: distanceRef.label, latitude: distanceRef.coords.lat, longitude: distanceRef.coords.lng } : undefined}
          />
        </div>

        {/* Like / Skip CTA - fixed bottom poza PremiumBusinessCard */}
        {(onLike || onSkip) && (
          <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-black/5 bg-[#FEFEFE]">
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm shadow-sm active:scale-[0.97] transition-transform"
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
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
};

export default PlaceSwiperDetail;
