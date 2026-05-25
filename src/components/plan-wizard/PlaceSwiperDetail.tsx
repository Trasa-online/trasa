import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Star, MapPin, Loader2, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl, isCachedPhotoUrl, ensurePhotoCached } from "@/lib/placePhotos";
import type { MockPlace } from "./PlaceSwiper";
import { formatDistanceToNow, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import posthog from "posthog-js";

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

const Stars = ({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={cn(
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          n <= Math.round(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground/30"
        )}
      />
    ))}
  </div>
);

const postTitle = (description: string | null): string => {
  if (!description) return "Nowy wpis";
  const firstLine = description.split("\n")[0].trim();
  return firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
};

// ─── Fullscreen photo viewer ──────────────────────────────────────────────────

const FullscreenPhotos = ({
  photos,
  startIndex,
  onClose,
}: {
  photos: string[];
  startIndex: number;
  onClose: () => void;
}) => {
  const [idx, setIdx] = useState(startIndex);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (photos.length === 0) return null;

  // Stop ANY click/touch z FullscreenPhotos przed propagacja na underlying
  // Sheet/<a> w title row (np. Maps pill). Wczesniej iOS po kliknięciu next
  // wyswietlal komunikat "Open in Maps app" - zapewne ghost click po 300ms
  // delay trafial w underlying anchor. preventDefault rowniez blokuje native
  // browser behavior (anchor navigation).
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };

  // Portal do <body> izolujemy renderowanie od DOM Sheet/sheet portal Radix-a.
  // Dzieki temu z-index niczego nie zaslania, plus event capturing zaczyna sie
  // od naszego rootu, bez podpinania sie pod hierarchie sheet contentu.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none"
      onClick={stop}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={(e) => {
        e.stopPropagation();
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) {
          if (dx < 0) setIdx((n) => Math.min(photos.length - 1, n + 1));
          else setIdx((n) => Math.max(0, n - 1));
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => { stop(e); onClose(); }}
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/25 transition-colors"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        aria-label="Zamknij"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { stop(e); setIdx((n) => Math.max(0, n - 1)); }}
            disabled={idx === 0}
            className="absolute left-3 z-10 h-12 w-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/25 disabled:opacity-30 transition-colors"
            aria-label="Poprzednie zdjęcie"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            type="button"
            onClick={(e) => { stop(e); setIdx((n) => Math.min(photos.length - 1, n + 1)); }}
            disabled={idx === photos.length - 1}
            className="absolute right-3 z-10 h-12 w-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:bg-white/25 disabled:opacity-30 transition-colors"
            aria-label="Następne zdjęcie"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      <img
        src={photos[idx]}
        alt=""
        draggable={false}
        className="max-w-full max-h-full object-contain pointer-events-none"
      />

      {photos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { stop(e); setIdx(i); }}
              className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40")}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};

// ─── Hero photo (16:9) ────────────────────────────────────────────────────────

const Hero = ({
  photos,
  activeIdx,
  setActiveIdx,
  placeName,
  onClose,
  onExpand,
  loading,
}: {
  photos: string[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  placeName: string;
  onClose: () => void;
  onExpand: (idx: number) => void;
  loading: boolean;
}) => {
  const hasPhoto = photos.length > 0;
  const swipeStartX = useRef<number | null>(null);

  return (
    <div
      className="relative shrink-0 bg-muted overflow-hidden w-full aspect-[16/9] rounded-t-3xl"
      onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (swipeStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - swipeStartX.current;
        swipeStartX.current = null;
        if (Math.abs(dx) > 40 && photos.length > 1) {
          if (dx < 0) setActiveIdx(Math.min(photos.length - 1, activeIdx + 1));
          else setActiveIdx(Math.max(0, activeIdx - 1));
        }
      }}
    >
      {/* Drag handle */}
      <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-center z-30 pointer-events-none">
        <div className="w-10 h-[5px] rounded-full bg-white/60" />
      </div>

      {/* Close button - top LEFT */}
      <button
        onClick={onClose}
        className="absolute top-3 left-3 z-30 h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60 transition-colors"
        aria-label="Zamknij"
      >
        <X className="h-4 w-4 text-white" />
      </button>

      {hasPhoto ? (
        <>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute inset-0 w-full h-full"
            aria-label="Powiększ zdjęcie"
          >
            <img
              src={photos[activeIdx]}
              alt={placeName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </button>

          {/* Expand icon */}
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute bottom-3 right-3 z-20 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60 transition-colors"
            aria-label="Pełny ekran"
          >
            <Maximize2 className="h-3.5 w-3.5 text-white" />
          </button>

          {/* Prev/Next arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, activeIdx - 1)); }}
                disabled={activeIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all"
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(photos.length - 1, activeIdx + 1)); }}
                disabled={activeIdx === photos.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all"
                aria-label="Następne zdjęcie"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
            </>
          )}

          {/* Photo dots */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-none">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={cn("h-1.5 rounded-full transition-all", i === activeIdx ? "w-4 bg-white" : "w-1.5 bg-white/60")}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-3">
          {loading ? (
            <>
              <Loader2 className="h-7 w-7 text-muted-foreground/40 animate-spin" />
              <p className="text-xs text-muted-foreground/50">Wczytywanie zdjęć…</p>
            </>
          ) : (
            <p className="text-xl font-black text-foreground px-5 text-center">{placeName}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaceSwiperDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: MockPlace | null;
  city?: string;
  onLike?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
  skipGoogleFetch?: boolean;
}

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
  const [activePhoto, setActivePhoto] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [businessPosts, setBusinessPosts] = useState<BusinessPost[]>([]);
  const [fullscreen, setFullscreen] = useState<{ photos: string[]; idx: number } | null>(null);

  useEffect(() => {
    if (!open || !place) {
      setDetail(null);
      setActivePhoto(0);
      setPhotos([]);
      setBusinessPosts([]);
      setFullscreen(null);
      return;
    }

    setLoading(true);

    // Track view event for real places (UUID, not mock)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(place.id)) {
      posthog.capture("place_viewed", { place_id: place.id });
    }

    const fetchAll = async () => {
      // Business with own photos → use their media, skip Google photos
      if (skipGoogleFetch || place.businessHasOwnPhoto) {
        setDetail(null);
        setPhotos([place.photo_url, ...(place.galleryPhotos ?? [])].filter(Boolean) as string[]);
        if (place.businessLogoUrl !== undefined) {
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

      const alreadyCached = isCachedPhotoUrl(place.photo_url);
      // Gdy gallery_urls jest wypelniona (z scripts/backfill-place-galleries.ts),
      // nie nakladamy juz Google photos na hero - byloby to dublowanie tych samych
      // obrazow. Dalej fetchujemy Google bo metadata (rating, recenzje) sa uzyteczne.
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
            if (!alreadyCached && !hasGallery) {
              const urls = (data.result.photos ?? [])
                .slice(0, 3)
                .map((p: any) => p.photo_url ?? getPhotoUrl(p.photo_reference, 800))
                .filter((u: any): u is string => typeof u === "string" && (u.startsWith("http") || u.startsWith("/api/")));
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
  }, [open, place]);

  const handleLike = () => { onLike?.(); onOpenChange(false); };
  const handleSkip = () => { onSkip?.(); onOpenChange(false); };

  const validUrl = (url?: string | null) =>
    !!url && (url.startsWith("http") || url.startsWith("/")) &&
    !url.includes("staticmap") && !url.includes("maps/api/staticmap");

  const googleAndCover = [
    ...photos.filter(validUrl),
    ...(!photos.length && validUrl(place?.photo_url) ? [place!.photo_url!] : []),
  ];
  const displayPhotos = [
    ...googleAndCover,
    ...(place?.galleryPhotos ?? []).filter(validUrl).filter(u => !googleAndCover.includes(u)),
  ];

  const totalRatings = detail?.user_ratings_total;
  const rating = detail?.rating ?? place?.rating;
  const address = detail?.formatted_address ?? place?.address ?? "";
  // Trim trailing city/country from formatted_address for compactness
  const shortAddress = address.split(",").slice(0, 2).join(",").trim();

  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.place_name} ${place.address ?? ""}`)}`
    : "#";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[92dvh] rounded-t-3xl p-0 overflow-hidden flex flex-col [&>button]:hidden bg-background"
        >
          {!place ? null : (
            <>
              {/* ── HERO PHOTO (16:9, fixed) ── */}
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.35 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 60 || info.velocity.y > 300) onOpenChange(false);
                }}
                className="shrink-0"
                style={{ touchAction: "pan-y" }}
              >
                <Hero
                  photos={displayPhotos}
                  activeIdx={activePhoto}
                  setActiveIdx={setActivePhoto}
                  placeName={place.place_name}
                  onClose={() => onOpenChange(false)}
                  onExpand={(i) => setFullscreen({ photos: displayPhotos, idx: i })}
                  loading={loading}
                />
              </motion.div>

              {/* ── SCROLLABLE CONTENT ── */}
              <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="px-5 pt-4 pb-6 space-y-4">

                  {/* Title row + Maps pill */}
                  <div className="flex items-start gap-3">
                    <h2 className="flex-1 text-2xl font-black tracking-tight leading-tight">
                      {place.place_name}
                    </h2>
                    {/* Maps button - <button> not <a> by design. Ghost-click na iOS w fullscreen
                        photo viewer (chevron-right) trafial w underlying <a href> i otwieral Maps.
                        Button ma `type=button` bez default action - ghost click jest no-op. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (fullscreen) return;
                        window.open(mapsUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="shrink-0 mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card text-foreground text-xs font-semibold active:scale-95 transition-transform"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Maps
                    </button>
                  </div>

                  {/* Rating + count */}
                  {rating ? (
                    <div className="flex items-center gap-1.5">
                      <Stars rating={rating} />
                      <span className="text-sm font-bold">{rating}</span>
                      {totalRatings && (
                        <span className="text-sm text-muted-foreground">({totalRatings.toLocaleString("pl")})</span>
                      )}
                    </div>
                  ) : null}

                  {/* City + address */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {place.city && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/60 bg-card text-xs font-semibold text-foreground">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {place.city}
                      </span>
                    )}
                    {shortAddress && (
                      <span className="text-xs text-muted-foreground">{shortAddress}</span>
                    )}
                    {(detail?.price_level ?? place.price_level) && (
                      <span className="text-xs text-muted-foreground">
                        {getPriceSymbol(detail?.price_level ?? place.price_level)}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {place.description && (
                    <p className="text-sm text-foreground/85 leading-relaxed">{place.description}</p>
                  )}

                  {/* Promo CTA badge (active business event) */}
                  {place.businessEventTitle && (
                    <div className="rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] px-4 py-3 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-orange-500/20 text-center leading-tight">
                      {place.businessEventTitle}
                    </div>
                  )}

                  {/* Tagi - biznes (custom z dashboardu) > Google vibe_tags */}
                  {(() => {
                    const tagList = place.businessTags?.length ? place.businessTags : (place.vibe_tags ?? []);
                    if (tagList.length === 0) return null;
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {tagList.map((tag) => (
                          <span key={tag} className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Aktualnosci - 1:1 z BusinessCardPreview detail (grid 1-2 kol, daty relative) */}
                  {place.businessLogoUrl !== undefined && businessPosts.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-lg font-black tracking-tight">Aktualności</h3>
                      <div className="space-y-3">
                        {businessPosts.map((post) => {
                          const date = parseISO(post.created_at);
                          const dateLabel = isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: pl }) : "";
                          const photos = post.photo_urls.filter(validUrl);
                          const gridPhotos = photos.slice(0, 2);
                          return (
                            <div key={post.id} className="rounded-2xl border border-border/40 bg-card p-3 space-y-2">
                              {post.description && (
                                <p className="text-sm leading-relaxed text-foreground">{post.description}</p>
                              )}
                              {gridPhotos.length > 0 && (
                                <div className={`grid gap-1.5 ${gridPhotos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                                  {gridPhotos.map((url, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setFullscreen({ photos, idx })}
                                      className="block w-full aspect-square rounded-xl overflow-hidden bg-muted active:opacity-95 transition-opacity"
                                      aria-label="Powiększ zdjęcie"
                                    >
                                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {dateLabel && (
                                <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Loading skeleton */}
                  {loading && !detail && (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="aspect-[16/9] bg-muted rounded-2xl" />
                    </div>
                  )}

                  {/* Google Reviews */}
                  {detail?.reviews && detail.reviews.length > 0 && (
                    <div className="pt-2">
                      <h3 className="text-lg font-black tracking-tight mb-3">Opinie</h3>
                      <div className="space-y-4">
                        {detail.reviews.slice(0, 3).map((review, i) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={review.profile_photo_url}
                                alt={review.author_name}
                                className="h-8 w-8 rounded-full object-cover shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{review.author_name}</p>
                                <div className="flex items-center gap-1.5">
                                  <Stars rating={review.rating} size="sm" />
                                  <span className="text-xs text-muted-foreground">· {review.relative_time_description}</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 pl-10">{review.text}</p>
                          </div>
                        ))}
                      </div>
                      {detail.place_id && (
                        <a
                          href={`https://www.google.com/maps/place/?q=place_id:${detail.place_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-border text-sm text-foreground"
                        >
                          <span className="font-black text-[#4285F4]">G</span>
                          Więcej opinii na Google
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── LIKE / SKIP ── (ujednolicone z guzikami na SwipeCard) */}
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
            </>
          )}
        </SheetContent>
      </Sheet>

      {fullscreen && (
        <FullscreenPhotos
          photos={fullscreen.photos}
          startIndex={fullscreen.idx}
          onClose={() => setFullscreen(null)}
        />
      )}
    </>
  );
};

export default PlaceSwiperDetail;
