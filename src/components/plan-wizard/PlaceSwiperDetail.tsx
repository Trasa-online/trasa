import { useState, useEffect, useRef } from "react";
import { X, Star, MapPin, Loader2, Heart, Users } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getPhotoUrl } from "@/lib/placePhotos";
import type { MockPlace } from "./PlaceSwiper";
import { MOCK_MODE, MOCK_PLACE_DETAIL } from "@/lib/mockPlaces";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessPost {
  id: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
}

interface PlaceDetail {
  place_id?: string;
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPriceSymbol = (level?: number) => {
  if (!level) return null;
  return "zł".repeat(level) + "○".repeat(4 - level);
};

// ─── Stars ────────────────────────────────────────────────────────────────────

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={cn(
          "h-3 w-3",
          n <= Math.round(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground/30"
        )}
      />
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaceSwiperDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: MockPlace | null;
  city?: string;
  onLike?: () => void;
  onSkip?: () => void;
}

const PlaceSwiperDetail = ({
  open,
  onOpenChange,
  place,
  city,
  onLike,
  onSkip,
}: PlaceSwiperDetailProps) => {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [businessPosts, setBusinessPosts] = useState<BusinessPost[]>([]);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !place) {
      setDetail(null);
      setUsageCount(null);
      setActivePhoto(0);
      setPhotos([]);
      setBusinessPosts([]);
      return;
    }

    setLoading(true);

    const fetchAll = async () => {
      // ── Mock mode: skip Google Places API entirely ──
      if (MOCK_MODE) {
        setDetail({ ...MOCK_PLACE_DETAIL, name: place.place_name } as any);
        setPhotos([place.photo_url].filter(Boolean) as string[]);
        setUsageCount(0);
        // Fetch real posts even in mock mode (place_id is real UUID only for non-mock places)
        if (place.businessLogoUrl !== undefined && !place.id.startsWith("mock-")) {
          const { data } = await (supabase as any)
            .from("business_posts")
            .select("id, description, photo_urls, created_at")
            .eq("place_id", place.id)
            .order("created_at", { ascending: false })
            .limit(10);
          if (data) setBusinessPosts(data);
        }
        setLoading(false);
        return;
      }

      // 1. Google Places details
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
            const urls = (data.result.photos ?? [])
              .slice(0, 3)
              .map((p: any) => getPhotoUrl(p.photo_reference, 800))
              .filter(Boolean) as string[];
            if (urls.length > 0) setPhotos(urls);
          }
        })
        .catch(() => {});

      // 2. Usage count from pins table
      const usagePromise = supabase
        .from("pins")
        .select("id", { count: "exact", head: true })
        .ilike("place_name", `%${place.place_name}%`)
        .then(({ count }) => { setUsageCount(count ?? 0); }, () => setUsageCount(0));

      // 3. Business posts (if this is a business card)
      const postsPromise = place.businessLogoUrl !== undefined
        ? (supabase as any)
            .from("business_posts")
            .select("id, description, photo_urls, created_at")
            .eq("place_id", place.id)
            .order("created_at", { ascending: false })
            .limit(10)
            .then(({ data }: { data: BusinessPost[] | null }) => { if (data) setBusinessPosts(data); })
        : Promise.resolve();

      await Promise.allSettled([placesPromise, usagePromise, postsPromise]);
      setLoading(false);
    };

    fetchAll();
  }, [open, place]);

  const handleLike = () => {
    onLike();
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const displayPhotos = photos.length > 0 ? photos : (place?.photo_url ? [place.photo_url] : []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-3xl p-0 overflow-hidden flex flex-col [&>button]:hidden"
      >
        {/* Close pill */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-10 h-1 bg-foreground/20 rounded-full" />

        {!place ? null : (
          <>
            {/* Photo carousel */}
            <div
              className="relative h-64 bg-muted shrink-0 overflow-hidden"
              style={{ touchAction: "pan-y" }}
              onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (swipeStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - swipeStartX.current;
                swipeStartX.current = null;
                if (Math.abs(dx) > 40 && displayPhotos.length > 1) {
                  if (dx < 0) setActivePhoto(n => Math.min(displayPhotos.length - 1, n + 1));
                  else setActivePhoto(n => Math.max(0, n - 1));
                }
              }}
            >
              {displayPhotos.length > 0 ? (
                <>
                  <img
                    src={displayPhotos[activePhoto]}
                    alt={place.place_name}
                    className="w-full h-full object-cover"
                    onError={() => {
                      if (activePhoto < displayPhotos.length - 1)
                        setActivePhoto((n) => n + 1);
                    }}
                  />
                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  {/* Photo dots */}
                  {displayPhotos.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {displayPhotos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActivePhoto(i)}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            i === activePhoto
                              ? "w-4 bg-white"
                              : "w-1.5 bg-white/50"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* Tap areas to navigate */}
                  <button
                    className="absolute left-0 inset-y-0 w-1/3"
                    onClick={() => setActivePhoto((n) => Math.max(0, n - 1))}
                  />
                  <button
                    className="absolute right-0 inset-y-0 w-1/3"
                    onClick={() => setActivePhoto((n) => Math.min(displayPhotos.length - 1, n + 1))}
                  />
                </>
              ) : loading ? (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
              )}

              {/* Close button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-white" />
              </button>
              {/* Google Maps link */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.place_name} ${place.address ?? ""}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 left-4 h-8 px-3 rounded-full bg-black/40 flex items-center gap-1.5 text-white text-xs font-medium"
              >
                <MapPin className="h-3.5 w-3.5" />
                Google Maps
              </a>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pt-4 pb-32 space-y-6">
                {/* Name + meta */}
                <div>
                  <h2 className="text-2xl font-black text-foreground leading-tight">
                    {place.place_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {(detail?.rating ?? place.rating) && (
                      <div className="flex items-center gap-1.5">
                        <Stars rating={detail?.rating ?? place.rating} />
                        <span className="text-sm font-semibold">
                          {detail?.rating ?? place.rating}
                        </span>
                        {detail?.user_ratings_total && (
                          <span className="text-xs text-muted-foreground">
                            ({detail.user_ratings_total.toLocaleString("pl")} opinii)
                          </span>
                        )}
                      </div>
                    )}
                    {(detail?.price_level ?? place.price_level) && (
                      <span className="text-xs text-muted-foreground">
                        · {getPriceSymbol(detail?.price_level ?? place.price_level)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {detail?.formatted_address ?? place.address}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-foreground/80 leading-relaxed -mt-2">
                  {place.description}
                </p>

                {/* Vibe tags */}
                <div className="flex gap-1.5 flex-wrap -mt-2">
                  {(place.vibe_tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Business owner section */}
                {place.businessLogoUrl !== undefined && (
                  <div className="space-y-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                    {/* Owner header */}
                    <div className="flex items-center gap-2.5">
                      {place.businessLogoUrl ? (
                        <img src={place.businessLogoUrl} className="w-8 h-8 rounded-full object-cover border border-border/40 shrink-0" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full shrink-0"
                          style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight truncate">{place.place_name}</p>
                        <p className="text-[11px] text-amber-700 font-medium">Zweryfikowana wizytówka ✦</p>
                      </div>
                    </div>

                    {/* Current event */}
                    {place.businessEventTitle && (
                      <div className="rounded-xl bg-amber-500/15 border border-amber-300/40 px-3 py-2.5 space-y-0.5">
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-300">🎉 Aktualne wydarzenie</p>
                        <p className="text-sm text-amber-800 dark:text-amber-200 leading-snug">{place.businessEventTitle}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Business posts feed */}
                {place.businessLogoUrl !== undefined && businessPosts.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-foreground">Od właściciela</p>
                    {businessPosts.map(post => (
                      <div key={post.id} className="border border-border/50 rounded-2xl p-3 space-y-2.5">
                        {post.description && (
                          <p className="text-sm leading-relaxed text-foreground/90">{post.description}</p>
                        )}
                        {post.photo_urls.length > 0 && (
                          <div className={`grid gap-1.5 ${post.photo_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                            {post.photo_urls.map((url, idx) => (
                              <img key={idx} src={url} className="w-full rounded-xl object-cover aspect-square" />
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: pl })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Usage stat — only show when at least 1 route used it */}
                {usageCount !== null && usageCount > 0 && (
                  <div className="flex items-center gap-2.5 py-3 px-4 bg-muted/50 rounded-2xl">
                    <div className="h-9 w-9 rounded-full bg-orange-600/15 flex items-center justify-center shrink-0">
                      <Users className="h-4.5 w-4.5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {`${usageCount} ${usageCount === 1 ? "trasa" : usageCount < 5 ? "trasy" : "tras"} w TRASA`}
                      </p>
                      <p className="text-xs text-muted-foreground">tyle razy dodano to miejsce do planów</p>
                    </div>
                  </div>
                )}

                {/* Loading skeleton */}
                {loading && !detail && (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-32 bg-muted rounded-xl" />
                  </div>
                )}

                {/* Google Reviews */}
                {detail?.reviews && detail.reviews.length > 0 && (
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-3">
                      Opinie
                    </h3>
                    <div className="space-y-4">
                      {detail.reviews.slice(0, 3).map((review, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={review.profile_photo_url}
                              alt={review.author_name}
                              className="h-8 w-8 rounded-full object-cover shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {review.author_name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <Stars rating={review.rating} />
                                <span className="text-xs text-muted-foreground">
                                  · {review.relative_time_description}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 pl-10">
                            {review.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    {detail.place_id && (
                      <a
                        href={`https://www.google.com/maps/place/?q=place_id:${detail.place_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm text-foreground"
                      >
                        <span className="font-black text-[#4285F4]">G</span>
                        Więcej opinii na Google
                      </a>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Sticky like/skip */}
            <div className="absolute bottom-0 left-0 right-0 pb-safe-6 pb-6 pt-4 px-6 bg-gradient-to-t from-background via-background to-transparent">
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm active:scale-[0.97] transition-transform"
                >
                  <X className="h-4 w-4" />
                  Pomiń
                </button>
                <button
                  onClick={handleLike}
                  className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-600/30 active:scale-[0.97] transition-transform"
                >
                  <Heart className="h-4 w-4 fill-white" />
                  Chcę tu być
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PlaceSwiperDetail;
