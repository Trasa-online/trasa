import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, ArrowRight, ChevronUp, RotateCcw, CheckCircle2, Navigation } from "lucide-react";
import AddCustomPlacePanel from "./AddCustomPlacePanel";
import { useGeolocation, geoWasPrimed } from "@/hooks/useGeolocation";
import { haversineKm as haversineKmDist, formatDistance } from "@/lib/distance";
import LocationPrimer from "@/components/LocationPrimer";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { format } from "date-fns";
import PlaceSwiperDetail from "./PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl, isCachedPhotoUrl, ensurePhotoCached } from "@/lib/placePhotos";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useHaptics } from "@/hooks/useHaptics";
import { getSubcategoryIds, getMainCategoryFor, getDbCategoriesFor, MAIN_CATEGORIES } from "@/lib/categories";
import { addLike as saveExploreLike, clearGroup as clearExploreGroup } from "@/lib/exploreLikes";
import { expandCity } from "@/lib/cities";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockPlace {
  id: string;
  place_name: string;
  category: PlaceCategory;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  price_level?: 1 | 2 | 3 | 4;
  photo_url: string;
  vibe_tags: string[];
  description: string;
  // Business profile fields (optional)
  businessPlan?: 'zero' | 'basic' | 'premium';
  businessLogoUrl?: string;
  businessEventTitle?: string;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  galleryPhotos?: string[]; // extra photos shown in carousel (swipe card + detail)
  businessSubcategories?: string[]; // subcategories from business_profiles (for custom filtering)
  businessTags?: string[]; // custom tags z business_profiles.tags - prio nad vibe_tags w UI
  businessMainCategory?: string; // main_category id (np. "food") z MAIN_CATEGORIES - dla badge na karcie
  businessMenuImageUrls?: string[]; // zdjecia menu (food) lub cennika (culture/attractions) - max 6 sztuk
  // Godziny otwarcia ustawione przez wlasciciela lokalu (priorytet nad Google weekday_text)
  // Shape: { mon: { open: "09:00", close: "22:00" } | { closed: true }, ... }
  businessOpeningHours?: Record<string, { open: string; close: string } | { closed: true }>;
  coverVideoUrl?: string; // business cover video (premium)
  businessHasOwnPhoto?: boolean; // true when business uploaded cover image/video or gallery - skip Google photos
  businessEventDescription?: string;
  businessDescription?: string;
  businessIsVerified?: boolean;
  // Customizacja kolorow z dashboardu lokalu (1:1 z BusinessCardPreview)
  businessColorBadge?: string;     // kolor badge kategorii
  businessColorCardBg?: string;    // kolor gradient overlay
  businessColorButton?: string;    // kolor primary CTA "Dodaj"
  businessColorPromo?: string;     // kolor badge promocji/aktualnosci (puste = gradient pomaranczowy)
}

export type PlaceCategory =
  | "restaurant" | "cafe" | "bar" | "club"
  | "museum" | "monument" | "gallery"
  | "experience" | "market" | "shopping"
  | "park" | "viewpoint";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: "Restauracja",
  cafe:       "Kawiarnia",
  bar:        "Bar",
  club:       "Klub",
  museum:     "Muzeum",
  monument:   "Zabytek",
  gallery:    "Galeria",
  experience: "Doświadczenie",
  market:     "Targ",
  shopping:   "Sklep",
  park:       "Park",
  viewpoint:  "Widok",
};

// Helper - kontrast czarny/bialy dla custom hex koloru. Skopiowany z BusinessDashboard.tsx
// (ZAMROZONY plik, nie ma shared lib do importu).
export function getHexContrast(hex: string): string {
  if (!hex || hex.length < 7) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

const MAIN_CATEGORY_COLORS: Record<string, string> = {
  food:        "bg-orange-500/80 text-white",
  culture:     "bg-violet-600/80 text-white",
  attractions: "bg-teal-600/80 text-white",
  nature:      "bg-emerald-600/80 text-white",
};

const getCategoryColor = (cat: PlaceCategory): string => {
  const main = getMainCategoryFor(cat);
  return main ? (MAIN_CATEGORY_COLORS[main.id] ?? "bg-slate-500/80 text-white") : "bg-slate-500/80 text-white";
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_DOTS = (level?: number) =>
  level ? "·".repeat(level) + "·".repeat(4 - level).replace(/·/g, "○") : null;

const BINGO_MIN_CATEGORIES = 4;       // show bingo when liked from ≥4 different categories
const BINGO_REPEAT_CATEGORIES = 6;    // re-show banner after dismissal (≥6 categories)

// ─── Bingo banner ─────────────────────────────────────────────────────────────

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", bar: "🍺",
  nightlife: "🎶", monument: "🏰", walk: "🚶", park: "🌿",
  shopping: "🛍️", church: "⛪", gallery: "🖼️", market: "🏪",
  viewpoint: "🌅", experience: "🎭", club: "🎵",
};

const MatchModal = ({ likedPlaces, onConfirm, onDismiss }: {
  likedPlaces: MockPlace[];
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const orbs = likedPlaces.slice(0, 3);
  const extra = likedPlaces.length - 3;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-safe-6 pb-6 flex flex-col items-center gap-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-center gap-3">
          {orbs.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-400/20 to-amber-400/20 border border-orange-300/30 flex items-center justify-center text-2xl shadow-sm">
                {CATEGORY_EMOJI_MAP[p.category] ?? "📍"}
              </div>
            </div>
          ))}
          {extra > 0 && (
            <div className="h-14 w-14 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground">+{extra}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 w-full">
          {orbs.map((p) => (
            <p key={p.id} className="text-sm font-medium text-foreground">{p.place_name}</p>
          ))}
          {extra > 0 && <p className="text-xs text-muted-foreground mt-0.5">i {extra} więcej</p>}
        </div>
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-foreground">Bingo!</p>
          <p className="text-sm text-muted-foreground">Mamy dla Ciebie trasę.</p>
        </div>
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
          >
            Sprawdzam trasę
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
          >
            Wróć do przeglądania
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Guest upsell modal ───────────────────────────────────────────────────────

const UPSELL_BENEFITS = [
  { emoji: "🗺️", text: "Zapisz trasę i wróć do niej kiedy chcesz" },
  { emoji: "👫", text: "Planuj wyjazdy razem ze znajomymi" },
  { emoji: "📍", text: "Dodawaj własne miejsca do trasy" },
  { emoji: "📒", text: "Prowadź dziennik podróży ze zdjęciami" },
];

const GuestUpsellModal = ({ onSignUp, onDismiss }: { onSignUp: () => void; onDismiss: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-2xl font-black text-foreground">Trasa gotowa! 🎉</p>
        <p className="text-sm text-muted-foreground">Załóż konto żeby ją zobaczyć i zapisać.</p>
      </div>
      <div className="flex flex-col gap-3">
        {UPSELL_BENEFITS.map(b => (
          <div key={b.text} className="flex items-center gap-3">
            <span className="text-xl shrink-0">{b.emoji}</span>
            <p className="text-sm font-medium text-foreground">{b.text}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onSignUp}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
        >
          Zakładam konto - to darmowe
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
        >
          Wróć do przeglądania
        </button>
      </div>
    </div>
  </div>
);

// ─── SwipeCard ────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  place: MockPlace;
  city: string;
  onLike: (photoUrl?: string) => void;
  onSkip: () => void;
  onTap: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onPhotoFetched?: (placeId: string, photoUrl: string) => void;
  isTop: boolean;
  offset: number; // 0 = top, 1 = second, 2 = third
  skipGoogleFetch?: boolean;
}


export const SwipeCard = ({ place, city, onLike, onSkip, onTap, onUndo, canUndo, onPhotoFetched, isTop, offset, skipGoogleFetch = false }: SwipeCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    [place.photo_url, ...(place.galleryPhotos ?? [])]
      .filter((u): u is string => !!u && (u.startsWith("http") || u.startsWith("/api/")) && !u.includes("picsum") && !u.includes("lorem"))
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [googleRating, setGoogleRating] = useState<number | null>(null);
  const [googleRatingCount, setGoogleRatingCount] = useState<number | null>(null);
  const [googleAddress, setGoogleAddress] = useState<string | null>(null);
  const [googleDescription, setGoogleDescription] = useState<string | null>(null);
  const [googleTags, setGoogleTags] = useState<string[] | null>(null);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const GRADIENT_BG = ["from-slate-700 to-slate-900", "from-stone-700 to-stone-900", "from-zinc-700 to-zinc-900"];

  // Prefetch Google Places data only for the TOP card and only once per card
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (offset !== 0 || skipGoogleFetch || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    // Jeśli place.photo_url jest już scache'owany w Storage → odpal cache-place-photo
    // tylko by upewnić się że jest spójny (idempotentne), nie wywołujemy Google
    const alreadyCached = isCachedPhotoUrl(place.photo_url);
    // Gdy mamy galerie (places.gallery_urls z backfillu), nie nadpisujemy photoUrls
    // pojedynczym URL-em z Google - to dropowaloby gallery. Galeria ma cover + extras.
    const hasGallery = (place.galleryPhotos ?? []).length > 0;

    supabase.functions
      .invoke("google-places-proxy", {
        body: {
          placeName: place.place_name,
          latitude: place.latitude,
          longitude: place.longitude,
          city,
          googlePlaceId: (place as any).google_place_id ?? null,
          placeDbId: place.id,
        },
      })
      .then(({ data, error }) => {
        if (error) { console.error("[PlaceSwiper] proxy error:", error); return; }
        // Prefer full photo_url returned by proxy (no client key needed)
        const photo = data?.result?.photos?.[0];
        const resolvedPlaceId: string | undefined = data?.result?.place_id ?? undefined;
        const url = photo?.photo_url ?? (photo?.photo_reference ? getPhotoUrl(photo.photo_reference, 800, resolvedPlaceId) : null);
        if (!url && !alreadyCached) console.warn("[PlaceSwiper] no photo returned for:", place.place_name, data);
        // Nie nadpisuj jeśli mamy już cache'owany URL ani galerie (oba bardziej wiarygodne)
        if (url && !alreadyCached && !hasGallery) {
          setPhotoUrls([url]);
          setImgFailed(false);
          onPhotoFetched?.(place.id, url);
        }
        // Background: trigger cache-place-photo żeby kolejne wyświetlenia szły z Storage (zero kosztów Google)
        if (!alreadyCached) {
          ensurePhotoCached(
            {
              table: "places",
              id: place.id,
              place_name: place.place_name,
              city,
              latitude: place.latitude,
              longitude: place.longitude,
              place_id: resolvedPlaceId,
            },
            place.photo_url ?? null,
          ).catch(() => {});
        }
        if (!place.rating && data?.result?.rating) setGoogleRating(data.result.rating);
        if (data?.result?.user_ratings_total) setGoogleRatingCount(data.result.user_ratings_total);
        if (!place.address && data?.result?.formatted_address) setGoogleAddress(data.result.formatted_address);
        if (!place.description) {
          const summary = data?.result?.editorial_summary?.overview;
          if (summary) setGoogleDescription(summary);
        }
        if (!place.vibe_tags?.length) {
          const TYPES_MAP: Record<string, string> = {
            bakery: "piekarnia", cafe: "kawa", bar: "bar", restaurant: "restauracja",
            tourist_attraction: "atrakcja", museum: "muzeum", park: "park",
            art_gallery: "galeria", night_club: "nocne życie", spa: "spa",
            shopping_mall: "zakupy", store: "sklep", church: "kościół",
            beach: "plaża", lodging: "nocleg", gym: "sport", library: "biblioteka",
          };
          const tags = (data?.result?.types ?? [])
            .map((t: string) => TYPES_MAP[t])
            .filter(Boolean)
            .slice(0, 3) as string[];
          if (tags.length) setGoogleTags(tags);
        }
      })
      .catch((err) => { console.error("[PlaceSwiper] google-places-proxy error:", err); });
  }, [offset]);

  const displayRating = place.rating || googleRating;
  const displayAddress = place.address || googleAddress;
  const displayDescription = place.description || googleDescription;
  // Chip dystansu "X od Ciebie" - tylko gdy mamy zgode na lokalizacje (coords) i miejsce
  // ma wspolrzedne. Brak zgody/coords => chip ukryty (graceful).
  const { coords: userCoords } = useGeolocation();
  const distanceLabel = userCoords && place.latitude && place.longitude
    ? formatDistance(haversineKmDist(userCoords, { lat: place.latitude, lng: place.longitude }))
    : null;
  // Priorytet: tagi z business_profiles.tags (ustawione przez wlasciciela) > Google vibe_tags > fallback do typow z proxy
  const displayTags = place.businessTags?.length
    ? place.businessTags
    : (place.vibe_tags?.length ? place.vibe_tags : (googleTags ?? []));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setDragging(true);
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isTop || !pointerStart.current || !dragging) return;
    const dx = e.clientX - pointerStart.current.x;
    setDragX(dx);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isTop || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dt = Date.now() - pointerStart.current.t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setDragging(false);
    setDragX(0);
    pointerStart.current = null;

    if (dist < 12 && dt < 350) {
      // Tap left half → prev photo, right half → next photo
      if (photoUrls.length > 1) {
        const cardRect = cardRef.current?.getBoundingClientRect();
        const tapX = e.clientX;
        const centerX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2;
        if (tapX < centerX) {
          setPhotoIdx(n => Math.max(0, n - 1));
        } else {
          setPhotoIdx(n => Math.min(photoUrls.length - 1, n + 1));
        }
      }
      return;
    }
    if (dragX > 80) {
      onLike(photoUrls[photoIdx] || undefined);
    } else if (dragX < -80) {
      onSkip();
    }
  };

  const rotation = isTop ? dragX * 0.08 : 0;

  const stackScale = 1 - offset * 0.04;
  const stackY = offset * 10;

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: isTop
          ? `translateX(${dragX}px) rotate(${rotation}deg)`
          : `scale(${stackScale}) translateY(${stackY}px)`,
        transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 10 - offset,
        touchAction: "none",
      }}
      className={cn(
        "absolute inset-0 rounded-3xl overflow-hidden shadow-md select-none",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      )}
    >
      {/* Photo / Video */}
      <div className="absolute inset-0">
        {place.coverVideoUrl && !videoFailed ? (
          <video
            src={place.coverVideoUrl}
            className="w-full h-full object-cover"
            autoPlay={isTop}
            loop
            muted
            playsInline
            onError={() => setVideoFailed(true)}
            style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
          />
        ) : photoUrls.length === 0 || imgFailed ? (
          <div className={cn("w-full h-full bg-gradient-to-br", GRADIENT_BG[offset % 3])} />
        ) : (
          <img
            src={photoUrls[photoIdx]}
            alt={place.place_name}
            className="w-full h-full object-cover"
            onError={() => {
              if (photoIdx < photoUrls.length - 1) setPhotoIdx(n => n + 1);
              else setImgFailed(true);
            }}
            draggable={false}
          />
        )}
        {/* Gradient overlay - biz custom kolor lub default czarny */}
        {place.businessColorCardBg ? (
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${place.businessColorCardBg}ee, ${place.businessColorCardBg}66 40%, transparent)` }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        )}
        {/* Photo progress bar - przeniesione pod badge kategorii (top-4 zajete przez badge).
            Instagram-style cienki bar pelnej szerokosci na top-14 (pod badge ktore ma top-4 + ~32px). */}
        {isTop && !place.coverVideoUrl && photoUrls.length > 1 && (
          <div className="absolute top-14 left-4 right-4 flex gap-1 z-10">
            {photoUrls.map((_, i) => (
              <div key={i} className={cn("flex-1 h-0.5 rounded-full transition-all", i === photoIdx ? "bg-white" : "bg-white/30")} />
            ))}
          </div>
        )}
      </div>



      {/* Category badge - top-left absolute, 1:1 z BusinessCardPreview na dashboardzie.
          Biz: label kategorii glownej z business_profiles.main_category + colorBadge custom.
          Non-biz: label podkategorii (places.category) + default Tailwind color z mapy. */}
      {(() => {
        const bizMainLabel = place.businessMainCategory
          ? MAIN_CATEGORIES.find(c => c.id === place.businessMainCategory)?.label
          : null;
        const subLabel = CATEGORY_LABELS[place.category];
        const label = bizMainLabel ?? subLabel;
        if (!label) return null;
        if (place.businessColorBadge) {
          return (
            <span
              className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm z-10"
              style={{ background: place.businessColorBadge, color: getHexContrast(place.businessColorBadge) }}
            >
              {label}
            </span>
          );
        }
        return (
          <span className={cn("absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm z-10", getCategoryColor(place.category))}>
            {label}
          </span>
        );
      })()}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pt-5 pb-[76px] space-y-2">

        {/* Business logo - 1:1 z BusinessCardPreview (10x10, bez handle, jako osobny element nad nazwa) */}
        {place.businessLogoUrl !== undefined && place.businessLogoUrl && (
          <div className="h-10 w-10 rounded-full overflow-hidden border border-white/30 shadow-md bg-white/10">
            <img src={place.businessLogoUrl} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Name */}
        <h2 className="text-2xl font-black text-white leading-tight">{place.place_name}</h2>

        {/* Meta row */}
        <div className="flex items-center gap-3">
          {displayRating ? (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-white/90 text-sm font-medium">{displayRating}</span>
              {googleRatingCount ? (
                <span className="text-white/60 text-sm">({googleRatingCount.toLocaleString("pl")})</span>
              ) : null}
            </div>
          ) : null}
          {place.price_level && (
            <span className="text-white/60 text-sm">{PRICE_DOTS(place.price_level)}</span>
          )}
          {displayAddress && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-white/50" />
              <span className="text-white/60 text-xs truncate">{displayAddress.split(",")[0]}</span>
            </div>
          )}
          {distanceLabel && (
            <div className="flex items-center gap-1 bg-white/15 rounded-full px-2 py-0.5 shrink-0">
              <Navigation className="h-3 w-3 text-white/80" />
              <span className="text-white/90 text-[11px] font-medium">{distanceLabel} od&nbsp;Ciebie</span>
            </div>
          )}
        </div>

        {/* Description */}
        {displayDescription && <p className="text-white/75 text-sm leading-snug">{displayDescription}</p>}

        {/* Business event pill - 1:1 z BusinessCardPreview na dashboardzie */}
        {place.businessEventTitle && (
          <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-2.5 py-0.5 text-white font-semibold text-xs">
            {place.businessEventTitle}
          </div>
        )}

        {/* Vibe tags + info button row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex gap-1.5 flex-wrap">
            {displayTags.map((tag) => (
              <span key={tag} className="text-[11px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
          {isTop && (
            <div className="flex items-center gap-2 shrink-0">
              {onUndo && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  disabled={!canUndo}
                  className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-md active:scale-90 transition-transform disabled:opacity-30"
                >
                  <RotateCcw className="h-4 w-4 text-black" />
                </button>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onTap(); }}
                aria-label="Rozwiń wizytówkę"
                className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <ChevronUp className="h-5 w-5 text-black" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons inside card - only on top card */}
      {isTop && (
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex gap-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            className="flex-1 py-3 rounded-full bg-white text-foreground font-bold text-sm shadow-xl active:scale-[0.97] transition-transform"
          >
            Odrzuć
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            style={place.businessColorButton
              ? { background: place.businessColorButton, color: getHexContrast(place.businessColorButton) }
              : undefined
            }
            className={cn(
              "flex-1 py-3 rounded-full font-bold text-sm shadow-xl active:scale-[0.97] transition-transform",
              place.businessColorButton ? "" : "bg-primary text-white shadow-primary/30"
            )}
          >
            Dodaj
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Done state ───────────────────────────────────────────────────────────────

const PERSONALITY_LABELS: Record<string, { label: string; emoji: string }> = {
  kulturalny:  { label: "Kulturalny",   emoji: "🎭" },
  historyczny: { label: "Historyczny",  emoji: "🏰" },
  kawiarniany: { label: "Kawiarniany",  emoji: "☕" },
  nocny:       { label: "Nocny",        emoji: "🌙" },
  aktywny:     { label: "Aktywny",      emoji: "🏃" },
  zakupowy:    { label: "Zakupowy",     emoji: "🛍️" },
  mix:         { label: "Zrównoważony", emoji: "✨" },
};

interface RouteExamplePin {
  place_name: string;
  category: string;
  suggested_time: string;
  duration_minutes: number;
  walking_time_from_prev: string | null;
  note?: string | null;
}

interface RouteExample {
  id: string;
  title: string;
  personality_type: string;
  description: string | null;
  pins: RouteExamplePin[];
}

interface MatchedRoute extends RouteExample {
  score: number;
  matchedNames: string[];
}

const EmptyState = ({
  likedPlaces,
  matchedRoutes,
  onProceed,
  onPickRoute,
  loadingExamples,
  hasCategoryFilter,
  hasSwipedAny,
  onResetToday,
  resetting,
  onGoToMatches,
  reviewedTitle,
}: {
  likedPlaces: MockPlace[];
  matchedRoutes: MatchedRoute[];
  onProceed: () => void;
  onPickRoute: (route: RouteExample) => void;
  loadingExamples: boolean;
  hasCategoryFilter?: boolean;
  hasSwipedAny?: boolean;
  onResetToday: () => void;
  resetting: boolean;
  onGoToMatches?: () => void;
  reviewedTitle: string;
}) => {
  if (likedPlaces.length === 0) {
    // Empty from start (filter restrictive, no places match) vs swiped-through-all
    const emptyFromStart = hasCategoryFilter && !hasSwipedAny;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="text-5xl">{emptyFromStart ? "🔍" : "🗺️"}</div>
        <div>
          <p className="font-bold text-lg">
            {emptyFromStart ? "Brak miejsc w tych kategoriach" : "Przejrzałeś wszystkie miejsca"}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {emptyFromStart
              ? "Spróbuj wybrać inne kategorie albo zmień miasto."
              : "Nie wybrałeś żadnego miejsca - może zacznijmy od nowa?"}
          </p>
        </div>
        <button
          onClick={() => {
            // window.location.reload() w Capacitor WebView nie czyscil user_place_reactions
            // ani exploreLikes - po reloadzie te same miejsca byly excludowane z queue.
            // Reset wykonuje DELETE z DB + clearGroup localStorage + re-fetch swipera.
            if (emptyFromStart) {
              // emptyFromStart = filter restrictive, reload nie pomoze - tu po prostu reload OK
              window.location.reload();
            } else {
              onResetToday();
            }
          }}
          disabled={resetting}
          className="border border-border rounded-full px-6 py-3 text-sm text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
        >
          {resetting ? "Resetuje..." : emptyFromStart ? "Zmień filtry" : "Zacznij od nowa"}
        </button>
      </div>
    );
  }

  // Brak dopasowanych tras wzorcowych - wycentrowany komunikat o przejrzeniu
  // kategorii/wszystkich miejsc + przejscie do zakladki Dopasowania (gdzie user
  // uklada plan). W exploreMode (brak onGoToMatches) fallback do onProceed.
  if (matchedRoutes.length === 0 && !loadingExamples) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
        <div className="h-16 w-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-orange-600" strokeWidth={2.2} />
        </div>
        <div className="space-y-1.5">
          <p className="text-2xl font-black text-foreground leading-tight">{reviewedTitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px]">
            Przejdź do zakładki dopasowań i&nbsp;stwórz swój plan.
          </p>
        </div>
        <button
          onClick={() => (onGoToMatches ? onGoToMatches() : onProceed())}
          className="px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
        >
          {onGoToMatches ? "Przechodzę do dopasowań" : `Ułóż plan z ${likedPlaces.length} miejsc`}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-safe-6 pb-6">
      {/* Header */}
      <div className="pt-6 pb-4 text-center">
        <p className="text-2xl font-black text-foreground">Gotowe!</p>
        <p className="text-sm text-muted-foreground mt-1">
          {loadingExamples ? "Szukam tras pasujących do Twoich wyborów…" : "Znalazłam trasy pasujące do Twoich wyborów"}
        </p>
      </div>

      {loadingExamples && (
        <div className="flex justify-center py-8">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Matched route cards */}
      {!loadingExamples && matchedRoutes.map((route) => {
        const meta = PERSONALITY_LABELS[route.personality_type] ?? { label: route.personality_type, emoji: "📍" };
        return (
          <div key={route.id} className="mb-3 rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full text-foreground">
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {route.score} wspólnych miejsc
                  </span>
                </div>
                <p className="font-bold text-foreground mt-1.5">{route.title}</p>
              </div>
            </div>

            {/* Matched place pills */}
            <div className="flex flex-wrap gap-1.5">
              {route.matchedNames.map(name => (
                <span key={name} className="text-xs bg-primary/10 text-orange-600 px-2.5 py-1 rounded-full font-medium">
                  {name}
                </span>
              ))}
              {route.pins.length - route.matchedNames.length > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  +{route.pins.length - route.matchedNames.length} innych
                </span>
              )}
            </div>

            <button
              onClick={() => onPickRoute(route)}
              className="w-full py-3 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              Wybierz tę trasę
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Fallback: plan from scratch */}
      <button
        onClick={onProceed}
        className={cn(
          "w-full py-3.5 rounded-full text-sm font-semibold active:scale-[0.97] transition-transform",
          matchedRoutes.length > 0
            ? "border border-border text-muted-foreground bg-card mt-1"
            : "bg-primary text-white shadow-lg shadow-primary/25"
        )}
      >
        {matchedRoutes.length > 0
          ? `Zaplanuj od zera z ${likedPlaces.length} miejsc`
          : `Ułóż plan z ${likedPlaces.length} miejsc`}
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaceSwiperProps {
  city: string;
  date: Date;
  numDays?: number;
  // String = legacy (tylko nazwa). Object = nowy format z lat/lng - pin startu na mapie + AI edge function.
  startingLocation?: string | { name: string; latitude: number; longitude: number };
  /** Category to show (batch of 20). Accepts single id or multiple ids (multi-select). When set, onBatchComplete fires when queue is exhausted. */
  categoryFilter?: string | string[];
  // Filtry diety - keys: vegan, vegetarian, gluten_free, lactose_free.
  // Match po vibe_tags (places) i business_profiles.tags - case insensitive, polskie + angielskie synonimy.
  dietFilters?: string[];
  // Sortowanie po dystansie od startingLocation (rosnaco). Bez efektu jesli startingLocation nie ma lat/lng.
  sortByNearest?: boolean;
  initialLikedPlaceNames?: string[];
  initialSkippedPlaceNames?: string[];
  searchQuery?: string;
  showAddPlace?: boolean;
  onAddPlaceClose?: () => void;
  /** Called with accumulated liked place names when the category batch (20 places) runs out. */
  onBatchComplete?: (likedNames: string[]) => void;
  exploreMode?: boolean;
  groupSessionId?: string;
  onGroupFinished?: () => void;
  /** When set, PlaceSwiper loads exactly these place IDs in this order (group round mode). */
  roundPlaceIds?: string[];
  /** Called when the user finishes swiping all round places (instead of showing the default empty state). */
  onRoundComplete?: () => void;
  /** Called when user taps "suggest adding a place" in the empty search state. */
  onSuggestPlace?: () => void;
  /** Called whenever the array of liked places changes - used by parent (PlanWizard)
   *  to render Dopasowania tab with current liked items without lifting all swiper state. */
  onLikedPlacesChange?: (places: MockPlace[]) => void;
  /** Gdy ustawione, bottom CTA "Przejdz do dopasowan" wywoluje to zamiast nawigowac
   *  do /create. PlanWizard przelacza wtedy tabke na "matches" gdzie user wybiera
   *  miejsca do trasy. Bez tej props CTA wciaz wywoluje handleProceed (legacy). */
  onSwitchToMatches?: () => void;
}

// Category groups for diversity balancing
const FOOD_CATEGORIES = new Set<string>(["restaurant", "cafe", "bar"]);
const CULTURE_CATEGORIES = new Set<string>(["museum", "gallery", "monument"]);
const CATEGORY_GROUPS: Set<string>[] = [FOOD_CATEGORIES, CULTURE_CATEGORIES];

function getGroupForCategory(cat: string): Set<string> | null {
  return CATEGORY_GROUPS.find(g => g.has(cat)) ?? null;
}

const DIVERSITY_THRESHOLD = 2; // after 2 consecutive likes from same group, deprioritize

// Maps raw DB row (with nested business_profiles) to MockPlace fields.
// Merges three photo sources into galleryPhotos:
//   1. business_profiles.gallery_urls  (zdjęcia od właściciela lokalu)
//   2. places.gallery_urls             (kurowane / scache'owane z Google przez scripts/backfill-place-galleries.ts)
// Cover photo (place.photo_url) jest osobno - nie powtarzamy go w galerii.
// Haversine - dystans w km miedzy dwoma punktami lat/lng (kopia z StartingLocationPicker).
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Slowa kluczowe dla filtrow diety - sprawdzane w vibe_tags (places) i business_profiles.tags.
// Case-insensitive substring match - lapie '"wegańska kuchnia"', '"vegan"', '"weganskie dania"' itp.
const DIET_KEYWORDS: Record<string, string[]> = {
  vegan: ["vegan", "wegan", "wegań", "wegańsk", "weganski", "weganskie"],
  vegetarian: ["vegetarian", "wegetar", "weget", "jarski", "jarskie", "jarska", "wegetarianskie", "wegetariańsk"],
  gluten_free: ["gluten free", "gluten-free", "bez glutenu", "bezglutenowe", "glutenfree", "gluten_free"],
  lactose_free: ["lactose free", "lactose-free", "bez laktozy", "bezlaktozowe", "laktozy", "lactose_free"],
};

function matchesDiet(place: MockPlace, diets: string[]): boolean {
  if (diets.length === 0) return true;
  const tags = [
    ...(place.vibe_tags ?? []),
    ...((place as any).businessTags ?? []),
    ...((place as any).businessSubcategories ?? []),
    place.description ?? "",
  ].filter(Boolean).map((t) => String(t).toLowerCase());
  // OR logic miedzy wybranymi dietami - place pasuje jesli ma jakikolwiek z keywords.
  return diets.some((d) => {
    const keywords = DIET_KEYWORDS[d] ?? [];
    return keywords.some((kw) => tags.some((t) => t.includes(kw.toLowerCase())));
  });
}

// Score wazony pojedynczego miejsca: rating Google (null/0 -> 3.5 neutralne) +
// lekki jitter dla wariancji miedzy sesjami. Liczony RAZ per miejsce (w interleave),
// zeby sortowanie bylo stabilne.
function placeBaseScore(p: MockPlace): number {
  const rating = typeof p.rating === "number" && p.rating > 0 ? p.rating : 3.5;
  return rating;
}

// Przeplot kategorii (weighted round-robin): zadne dwie sasiednie karty nie sa z tej
// samej kategorii (chyba ze zostala juz tylko jedna kategoria), a w obrebie kategorii
// najlepiej oceniane miejsca pojawiaja sie wczesniej. Rozwiazuje "4-5 restauracji pod rzad".
// `prevCat` pozwala uniknac powtorki kategorii na styku dwoch grup (biznesy -> reszta).
function interleaveByCategory(places: MockPlace[], prevCat: string | null = null): MockPlace[] {
  // Pre-score raz per miejsce (rating + stabilny jitter) -> stabilna kolejnosc w buckecie.
  const scored = places.map((p) => ({
    p,
    cat: p.category || "_",
    score: placeBaseScore(p) + Math.random() * 0.5,
  }));
  const buckets = new Map<string, typeof scored>();
  for (const s of scored) {
    if (!buckets.has(s.cat)) buckets.set(s.cat, []);
    buckets.get(s.cat)!.push(s);
  }
  for (const arr of buckets.values()) arr.sort((a, b) => b.score - a.score);

  const result: MockPlace[] = [];
  let lastCat = prevCat;
  while (true) {
    const nonEmpty = [...buckets.values()].filter((a) => a.length > 0);
    if (nonEmpty.length === 0) break;
    // Najwyzszy score glowy, ale pomijajac ostatnio uzyta kategorie (jesli jest alternatywa).
    nonEmpty.sort((a, b) => b[0].score - a[0].score);
    const pick = nonEmpty.find((a) => a[0].cat !== lastCat) ?? nonEmpty[0];
    const item = pick.shift()!;
    result.push(item.p);
    lastCat = item.cat;
  }
  return result;
}

// Biznesy z wizytowka (business_profiles) zawsze pierwsze w kolejce swipera (priorytet B2B),
// a w obrebie KAZDEJ grupy (biznesy / reszta) przeplot kategorii + ranking wazony zamiast
// czystego shuffle. Wykrywanie po `businessPlan` ktore enrichWithBusinessProfile ustawia
// tylko gdy nested bp istnieje.
function partitionBusinessFirst(places: MockPlace[]): MockPlace[] {
  const biz: MockPlace[] = [];
  const rest: MockPlace[] = [];
  for (const p of places) {
    if ((p as any).businessPlan) biz.push(p);
    else rest.push(p);
  }
  const bizOrdered = interleaveByCategory(biz);
  const lastBizCat = bizOrdered.length ? (bizOrdered[bizOrdered.length - 1].category || "_") : null;
  const restOrdered = interleaveByCategory(rest, lastBizCat);
  return [...bizOrdered, ...restOrdered];
}

function enrichWithBusinessProfile(p: any): MockPlace {
  const placeGallery: string[] = Array.isArray(p.gallery_urls) ? p.gallery_urls.filter(Boolean) : [];

  const bp = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
  if (!bp) {
    return { ...p, galleryPhotos: placeGallery } as MockPlace;
  }
  // Per decyzja produktowa (CLAUDE.md): wszystkie aktywne biznesy traktujemy jak
  // premium - logo, eventy, cover image, dane kontaktowe widoczne dla kazdego
  // powiazanego biz profile. DB column `plan` jest legacy z czasow planow zero/basic/premium
  // i jest ignorowane na froncie. Wszystkim wyswietlamy pelna premium wizytowke.
  const plan: 'zero' | 'basic' | 'premium' = 'premium';
  const bizGallery: string[] = Array.isArray(bp.gallery_urls) ? bp.gallery_urls.filter(Boolean) : [];
  // Logika galerii: jesli biznes wgral wlasne zdjecia (cover_image, cover_video, gallery_urls)
  // -> uzywamy TYLKO biznesowych. Biznes wybral jak chce sie prezentowac, nie nadpisujemy
  // kurowanymi Google Photos z places.gallery_urls (backfill).
  // Jesli biznes NIE ma zadnych wlasnych zdjec -> uzywamy placeGallery (Google backfill)
  // jako fallback zeby wizytowka miala chociaz placeholder.
  const hasBizPhotos = !!(bp.cover_image_url || bp.cover_video_url || bizGallery.length > 0);
  const mergedGallery = hasBizPhotos ? bizGallery : placeGallery;
  return {
    ...p,
    businessPlan: plan,
    // Override pozycji pinu geokodowanym adresem biznesu (gdy ustawiony) - inaczej pin
    // na mapie trasy bralby stare/NULL places.latitude/longitude i ladowal w zlym miejscu.
    latitude: bp.latitude ?? p.latitude,
    longitude: bp.longitude ?? p.longitude,
    // Override photo z biz cover gdy biznes ma swoje zdjecie
    photo_url: bp.cover_image_url || p.photo_url,
    // Show business section (logo, events, CTA) dla wszystkich biz
    businessLogoUrl: bp.logo_url ?? '',
    businessEventTitle: bp.event_title ?? undefined,
    businessPhone: bp.phone ?? null,
    businessWebsite: bp.website ?? null,
    galleryPhotos: mergedGallery,
    businessSubcategories: bp.subcategories ?? [],
    businessTags: Array.isArray(bp.tags) ? bp.tags.filter(Boolean) : [],
    businessMainCategory: bp.main_category ?? undefined,
    businessMenuImageUrls: Array.isArray(bp.menu_image_urls) ? bp.menu_image_urls.filter(Boolean) : [],
    businessOpeningHours: bp.opening_hours && typeof bp.opening_hours === "object" && Object.keys(bp.opening_hours).length > 0
      ? bp.opening_hours
      : undefined,
    coverVideoUrl: bp.cover_video_url ?? undefined,
    businessEventDescription: bp.event_description ?? undefined,
    businessDescription: bp.description ?? undefined,
    businessIsVerified: !!bp.is_verified,
    businessColorBadge: bp.color_badge ?? undefined,
    businessColorCardBg: bp.color_card_bg ?? undefined,
    businessColorButton: bp.color_button ?? undefined,
    businessColorPromo: bp.color_promo ?? undefined,
    // Pomijaj Google Photos tylko gdy biznes ma WŁASNE zdjęcia (cover/video/własna galeria).
    // places.gallery_urls (kurowane z Google) NIE liczy się jako "własne zdjęcia biznesu".
    businessHasOwnPhoto: !!(
      bp.cover_image_url || bp.cover_video_url || (bizGallery.length > 0)
    ),
  } as MockPlace;
}

const PlaceSwiper = ({ city, date, numDays = 1, startingLocation = "", categoryFilter, dietFilters, sortByNearest, initialLikedPlaceNames = [], initialSkippedPlaceNames = [], searchQuery = "", showAddPlace: showAddPlaceProp = false, onAddPlaceClose, onBatchComplete, exploreMode = false, groupSessionId, onGroupFinished, roundPlaceIds, onRoundComplete, onSuggestPlace, onLikedPlacesChange, onSwitchToMatches }: PlaceSwiperProps) => {
  // Normalize categoryFilter to a stable array (single id, multiple ids, or none).
  const categoryFilters: string[] = Array.isArray(categoryFilter)
    ? categoryFilter.filter(Boolean)
    : (categoryFilter ? [categoryFilter] : []);
  const categoryFilterKey = categoryFilters.join(",");
  const dietFilterKey = (dietFilters ?? []).join(",");
  const hasCategoryFilter = categoryFilters.length > 0;
  // Naglowek empty state po przejrzeniu wszystkich miejsc: "{kategoria} przejrzana!"
  // (1 kategoria) / "Wybrane kategorie przejrzane!" (kilka) / "Wszystkie miejsca
  // przejrzane!" (brak filtra).
  const reviewedTitle = (() => {
    if (categoryFilters.length === 0) return "Wszystkie miejsca przejrzane!";
    if (categoryFilters.length > 1) return "Wybrane kategorie przejrzane!";
    const id = categoryFilters[0];
    const main = MAIN_CATEGORIES.find(c => c.id === id);
    const sub = MAIN_CATEGORIES.flatMap(c => c.subcategories).find(s => s.id === id);
    const label = main?.label ?? sub?.label ?? (CATEGORY_LABELS as Record<string, string>)[id];
    return label ? `${label} przejrzana!` : "Wszystkie miejsca przejrzane!";
  })();
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const haptics = useHaptics();

  const [allPlaces, setAllPlaces] = useState<MockPlace[]>([]);
  const [queue, setQueue] = useState<MockPlace[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumping refreshNonce trigeruje re-fetch w useEffect (np. po "Zacznij od nowa")
  // - czyscimy DB reactions z dziennej + localStorage exploreLikes i fetchujemy queue na nowo.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [likedPlaces, setLikedPlaces] = useState<MockPlace[]>([]);
  const [skippedPlaces, setSkippedPlaces] = useState<MockPlace[]>([]);
  const [superLikedPlaces, setSuperLikedPlaces] = useState<MockPlace[]>([]);
  const [history, setHistory] = useState<{ place: MockPlace; reaction: "liked" | "skipped" | "super_liked" }[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [matchedRoutes, setMatchedRoutes] = useState<MatchedRoute[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [bannerDismissCount, setBannerDismissCount] = useState(0);
  // Track consecutive likes per category group
  const [recentLikedGroups, setRecentLikedGroups] = useState<(Set<string> | null)[]>([]);
  // Zgoda na lokalizacje "w kontekscie" - primer pokazany raz po zaladowaniu miejsc,
  // jesli jeszcze nie pytalismy i nie mamy coords. Chip dystansu pojawia sie po zgodzie.
  const { coords: geoCoords } = useGeolocation();
  const [locationPrimerOpen, setLocationPrimerOpen] = useState(false);
  const showAddPlace = showAddPlaceProp;
  const setShowAddPlace = (v: boolean) => { if (!v) onAddPlaceClose?.(); };

  // Primer lokalizacji: po zaladowaniu miejsc, raz, jesli nie pytalismy i brak coords.
  // Nie w trybie rundy grupowej (roundPlaceIds) - tam swiper jest czescia sesji.
  useEffect(() => {
    if (loading || roundPlaceIds?.length || geoCoords || geoWasPrimed()) return;
    setLocationPrimerOpen(true);
  }, [loading, roundPlaceIds, geoCoords]);

  useEffect(() => {
    setLoading(true);
    // Safety net: if the fetch hangs for any reason, drop the loader after 12s
    const safetyTimeout = setTimeout(() => {
      console.warn("[PlaceSwiper] fetch safety timeout fired, forcing loading=false", { city, categoryFilter });
      setLoading(false);
    }, 12000);

    const fetchPlaces = async () => {
      try {

      // ── Group round mode: load exactly the round's place IDs in order ──
      if (roundPlaceIds?.length) {
        const { data, error } = await (supabase as any)
          .from("places")
          .select("*, business_profiles(plan, logo_url, cover_image_url, cover_video_url, event_title, event_description, gallery_urls, phone, website, main_category, subcategories, tags, description, is_verified, color_badge, color_card_bg, color_button, color_promo, menu_image_urls, opening_hours, latitude, longitude)")
          .in("id", roundPlaceIds);

        if (error) console.error("[PlaceSwiper] round fetch error:", error);
        if (!data?.length) { setLoading(false); return; }

        // Preserve server-defined order
        const orderMap: Record<string, number> = {};
        roundPlaceIds.forEach((id, i) => { orderMap[id] = i; });
        const ordered = [...data]
          .sort((a: any, b: any) => orderMap[a.id] - orderMap[b.id])
          .map(enrichWithBusinessProfile);

        setAllPlaces(ordered);
        setQueue(ordered);
        setLoading(false);
        return;
      }

      // ── Normal mode ──────────────────────────────────────────────────────
      const { data, error: placesError } = await (supabase as any)
        .from("places")
        .select("*, business_profiles(plan, logo_url, cover_image_url, cover_video_url, event_title, event_description, gallery_urls, phone, website, main_category, subcategories, tags, description, is_verified, color_badge, color_card_bg, color_button, color_promo, menu_image_urls, opening_hours, latitude, longitude)")
        .in("city", expandCity(city))
        .eq("is_active", true);

      if (placesError) console.error("[PlaceSwiper] places fetch error:", placesError);
      console.log("[PlaceSwiper] fetched places:", { count: data?.length ?? 0, city, categoryFilter });
      if (!data?.length) { setLoading(false); return; }

      // Fetch already-rated place IDs for this user+city z DZISIAJ. Reset codzienny
      // = polubienia/odrzuty z wczoraj i wcześniej nie ukrywają miejsc dziś. User
      // każdy nowy dzień zaczyna z czystą talia. Reactions w DB persyst dla taste profile,
      // ale UI filter polega tylko na today (gte start of today UTC).
      let ratedPlaceIds = new Set<string>();
      if (user) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: reactions } = await (supabase as any)
          .from("user_place_reactions")
          .select("place_id")
          .eq("user_id", user.id)
          .in("city", expandCity(city))
          .gte("created_at", todayStart.toISOString());
        if (reactions?.length) {
          ratedPlaceIds = new Set(reactions.map((r: { place_id: string }) => r.place_id));
        }
        // Also filter out places already swiped in the group session
        if (groupSessionId) {
          const { data: groupReactions } = await (supabase as any)
            .from("group_session_reactions")
            .select("place_id")
            .eq("session_id", groupSessionId)
            .eq("user_id", user.id);
          if (groupReactions?.length) {
            for (const r of groupReactions) ratedPlaceIds.add(r.place_id);
          }
        }
      }

      const enriched = (data as any[]).map(enrichWithBusinessProfile);
      const likedSet = new Set(initialLikedPlaceNames.map(n => n.toLowerCase()));
      const skippedSet = new Set(initialSkippedPlaceNames.map(n => n.toLowerCase()));
      const liked = enriched.filter((p) => likedSet.has(p.place_name.toLowerCase()));
      const skipped = enriched.filter((p) => skippedSet.has(p.place_name.toLowerCase()));

      const hasReturnState = initialLikedPlaceNames.length > 0 || initialSkippedPlaceNames.length > 0;
      const activeDiets = dietFilters ?? [];
      const remaining = enriched.filter((p) => {
        if (likedSet.has(p.place_name.toLowerCase()) || skippedSet.has(p.place_name.toLowerCase())) return false;
        // Filtr diety - applikowany do wszystkich miejsc (zarowno batch jak normal mode)
        if (!matchesDiet(p, activeDiets)) return false;
        // For category-filtered batch mode (user explicitly picked a category) — show all matching
        // places regardless of past ratings. Otherwise, hide already-rated on the first batch.
        if (hasCategoryFilter) return true;
        if (!hasReturnState && ratedPlaceIds.has(p.id)) return false;
        return true;
      });

      // Sort by distance od startingLocation (jesli sortByNearest + startingLocation ma lat/lng).
      // Override losowy kolejnosci - user chcial 'od najblizszej do najdalszej' = strict distance.
      const startCoords = typeof startingLocation === "object" && startingLocation
        ? { lat: startingLocation.latitude, lng: startingLocation.longitude }
        : null;
      const applyNearestSort = (arr: MockPlace[]) => {
        if (!sortByNearest || !startCoords) return arr;
        return [...arr].sort((a, b) => {
          const da = a.latitude && a.longitude ? haversineKm(startCoords, { lat: a.latitude, lng: a.longitude }) : Infinity;
          const db = b.latitude && b.longitude ? haversineKm(startCoords, { lat: b.latitude, lng: b.longitude }) : Infinity;
          return da - db;
        });
      };

      setAllPlaces(enriched);
      if (liked.length) setLikedPlaces(liked);
      if (skipped.length) setSkippedPlaces(skipped);

      // Batch mode: one or many categories OR'd together, max 20 places
      if (hasCategoryFilter) {
        const standardSubIds = new Set<string>();
        const customSubIds = new Set<string>();
        for (const f of categoryFilters) {
          const subIds = getSubcategoryIds(f);
          const isStandard = subIds.length > 0 || MAIN_CATEGORIES.some(c =>
            c.id === f || c.subcategories.some(s => s.id === f)
          );
          if (isStandard) {
            if (subIds.length > 0) subIds.forEach(id => standardSubIds.add(id));
            else standardSubIds.add(f);
          } else {
            customSubIds.add(f);
          }
        }
        // Expand standardSubIds przez aliasy DB - subcategory "club" pasuje do
        // p.category="club" ORAZ "nightlife" (historyczny mix w bazie).
        const dbCategorySet = new Set<string>();
        standardSubIds.forEach(subId => {
          getDbCategoriesFor(subId).forEach(dbCat => dbCategorySet.add(dbCat));
        });
        const filtered = remaining.filter(p => {
          if (dbCategorySet.has(p.category)) return true;
          const bizSubs = (p as any).businessSubcategories as string[] | undefined;
          if (bizSubs && bizSubs.some(s => customSubIds.has(s))) return true;
          return false;
        });
        const pool = applyNearestSort(partitionBusinessFirst(filtered)).slice(0, 20);
        console.log("[PlaceSwiper] batch pool:", { categoryFilters, standardSubIds: [...standardSubIds], dbCategorySet: [...dbCategorySet], customSubIds: [...customSubIds], poolSize: pool.length, remainingTotal: remaining.length });
        setQueue(pool);
      } else {
        setQueue(applyNearestSort(partitionBusinessFirst(remaining)));
      }
      setLoading(false);
      } catch (err) {
        console.error("[PlaceSwiper] fetchPlaces threw:", err);
        setLoading(false);
      }
    };
    fetchPlaces().finally(() => clearTimeout(safetyTimeout));
  }, [city, user, roundPlaceIds, categoryFilterKey, dietFilterKey, sortByNearest, refreshNonce]);

  // Reorder queue when a category group has been liked too many times consecutively
  const rebalanceQueue = (newRecentGroups: (Set<string> | null)[]) => {
    // Count consecutive recent likes from the same group (last N)
    const lastN = newRecentGroups.slice(-DIVERSITY_THRESHOLD);
    if (lastN.length < DIVERSITY_THRESHOLD) return;

    const lastGroup = lastN[lastN.length - 1];
    if (!lastGroup) return;

    // Check if all last N are from the same group
    const allSame = lastN.every(g => g === lastGroup);
    if (!allSame) return;

    // Deprioritize: move cards from this group to the back of the queue
    setQueue(prev => {
      const fromGroup: MockPlace[] = [];
      const others: MockPlace[] = [];
      for (const p of prev) {
        if (lastGroup.has(p.category)) {
          fromGroup.push(p);
        } else {
          others.push(p);
        }
      }
      // Only rebalance if there are non-group cards to show
      if (others.length === 0) return prev;
      return [...others, ...fromGroup];
    });
  };

  const isSearching = searchQuery.trim().length >= 2;
  const displayQueue = isSearching
    ? allPlaces.filter(p => p.place_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : queue;

  const photoUrlOverrides = useRef<Record<string, string>>({});

  const saveReaction = (place: MockPlace, reaction: "liked" | "skipped" | "super_liked", overridePhotoUrl?: string) => {
    if (!user) return;
    const photoUrl = overridePhotoUrl ?? photoUrlOverrides.current[place.id] ?? place.photo_url ?? null;
    if (!groupSessionId) {
      (supabase as any)
        .from("user_place_reactions")
        .upsert({
          user_id: user.id,
          place_id: place.id,
          place_name: place.place_name,
          city: place.city,
          category: place.category,
          photo_url: photoUrl,
          reaction,
        }, { onConflict: "user_id,place_id" })
        .then(() => {});
    }
    if (groupSessionId) {
      (supabase as any)
        .from("group_session_reactions")
        .upsert({
          session_id: groupSessionId,
          user_id: user.id,
          place_name: place.place_name,
          place_id: place.id,
          photo_url: photoUrl,
          category: place.category,
          reaction,
        }, { onConflict: "session_id,user_id,place_name" })
        .then(() => {});
    }
  };

  const deleteReaction = (place: MockPlace) => {
    if (!user) return;
    if (!groupSessionId) {
      (supabase as any)
        .from("user_place_reactions")
        .delete()
        .match({ user_id: user.id, place_id: place.id })
        .then(() => {});
    }
    if (groupSessionId) {
      (supabase as any)
        .from("group_session_reactions")
        .delete()
        .match({ session_id: groupSessionId, user_id: user.id, place_name: place.place_name })
        .then(() => {});
    }
  };

  const trackAndRebalance = (place: MockPlace) => {
    const group = getGroupForCategory(place.category);
    const updated = [...recentLikedGroups, group];
    setRecentLikedGroups(updated);
    rebalanceQueue(updated);
  };

  const handleLike = (overridePhotoUrl?: string, placeOverride?: MockPlace) => {
    const top = placeOverride ?? displayQueue[0];
    if (!top) return;
    haptics.medium();
    setHistory(prev => [...prev, { place: top, reaction: "liked" }]);
    setLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "liked", overridePhotoUrl);
    trackAndRebalance(top);
    // Persist do localStorage history zawsze (poza group session i round mode) -
    // uzywane przez Eksploruj 'Polubione' tab i 'Zaplanuj solo' reuse prompt.
    // Wczesniej zapis byl tylko w exploreMode (HomeSwipe), wiec lajki z planu konkretnej
    // trasy (PlanWizard step 4) nie ladowaly w Eksploruj. Group/round to wspolne sesje
    // gdzie polubione miejsca maja inny model (sync miedzy uczestnikami).
    if (!groupSessionId && !roundPlaceIds?.length) {
      saveExploreLike(city, {
        place_name: top.place_name,
        category: top.category,
        latitude: top.latitude,
        longitude: top.longitude,
        photo_url: overridePhotoUrl ?? top.photo_url ?? null,
        address: top.address ?? null,
        rating: top.rating ?? null,
        description: top.description ?? null,
      });
    }
    // Track add_to_route for real (non-mock) places
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(top.id)) {
      posthog.capture("place_added_to_route", { place_id: top.id });
    }
  };

  const handleSkip = () => {
    const top = displayQueue[0];
    if (!top) return;
    haptics.light();
    setHistory(prev => [...prev, { place: top, reaction: "skipped" }]);
    setSkippedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "skipped");
  };


  const handleUndo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(prev => prev.slice(0, -1));
    setQueue(prev => [last.place, ...prev]);
    setAllPlaces(prev => [last.place, ...prev]);
    if (last.reaction === "liked") {
      setLikedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    } else if (last.reaction === "super_liked") {
      setSuperLikedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    } else if (last.reaction === "skipped") {
      setSkippedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    }
    deleteReaction(last.place);
  };

  const handleTap = (place: MockPlace) => {
    setDetailPlace(place);
    setDetailOpen(true);
  };

  // "Zacznij od nowa" w EmptyState - prawdziwy reset zamiast window.location.reload()
  // (ktore nie czyscilo DB reactions ani localStorage). Czysci CALA historie reactions
  // dla tego miasta (NIE tylko dziennie - app filtruje tylko reactions z dzisiaj,
  // ale jesli user mial wczorajsze reactions na te same miejsca, te tez excludowaly).
  // Plus exploreLikes localStorage + history state + re-fetch queue.
  const handleResetToday = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      if (user) {
        // Usuwamy WSZYSTKIE reactions w tym miescie zeby user dostal pelny pool na nowo.
        // Reactions na taste profile sa tracked osobno (place_features_user, etc).
        const { error: delError } = await (supabase as any)
          .from("user_place_reactions")
          .delete()
          .eq("user_id", user.id)
          .in("city", expandCity(city));
        if (delError) throw delError;
      }
      // Wyczysc explore likes localStorage dla tego miasta + dziennej grupy
      const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      clearExploreGroup(todayStr, city);
      // Reset local state - history, queue, liked itp.
      setHistory([]);
      setLikedPlaces([]);
      setSkippedPlaces([]);
      setSuperLikedPlaces([]);
      setQueue([]);
      // Trigger re-fetch przez bumping nonce - useEffect odpali fetchPlaces od nowa
      setRefreshNonce(n => n + 1);
    } catch (err) {
      console.error("[PlaceSwiper] reset today failed:", err);
      toast.error("Nie udało się zresetować, spróbuj ponownie");
    } finally {
      setResetting(false);
    }
  };

  const handleProceed = () => {
    // Zapisywanie trasy wymaga prawdziwego konta - anon user dostaje AuthDrawer.
    // Po linkIdentity / updateUser anon zachowuje user_id, wiec polubione miejsca
    // sa propagowane dalej (CreateRoute czyta state z navigate).
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    const routeState = {
      city,
      date: date.toISOString(),
      numDays,
      startingLocation: startingLocation || undefined,
      likedPlaceNames: allLiked.map((p) => p.place_name),
      skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
      likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
      superLikedPlaceNames: superLikedPlaces.map((p) => p.place_name),
    };
    if (!user || isAnonymous) {
      // Zachowaj pelny route state zeby po upgrade konta wrocic do /create z preloadem -
      // bez startingLocation/likedPlacesData/numDays CreateRoute padal lub cofal usera
      // do step wyboru startu zamiast od razu generowac trase.
      try {
        localStorage.setItem("trasa_guest_plan", JSON.stringify(routeState));
      } catch { /* unavailable */ }
      openAuthDrawer({ mode: "register", hint: "save_route" });
      return;
    }
    navigate("/create", { state: routeState });
  };

  // Notify parent when round is complete (must be in effect, not render)
  useEffect(() => {
    if (queue.length === 0 && !loading && onRoundComplete) {
      onRoundComplete();
    }
  }, [queue.length, loading]);

  // Expose liked places to parent (PlanWizard Dopasowania tab) - rerenders na zmianie referencji array
  useEffect(() => {
    onLikedPlacesChange?.([...likedPlaces, ...superLikedPlaces]);
  }, [likedPlaces, superLikedPlaces]);

  // Bingo modal DISABLED globally - userka wycofala go z solo parowania (i wczesniej
  // z exploreMode). Hook zostawiony jako stub na wypadek powrotu - po prostu nic nie
  // robi. Zmienne setShowBanner / bannerDismissCount nadal istnieja zeby nie ruszac
  // pozostalej logiki, ale showBanner pozostaje false.
  void BINGO_MIN_CATEGORIES; void BINGO_REPEAT_CATEGORIES; void setShowBanner; void bannerDismissCount;

  const handleBannerDismiss = () => {
    setShowBanner(false);
    setBannerDismissCount(c => c + 1);
  };

  // Fetch + match route_examples when queue runs out
  useEffect(() => {
    if (queue.length > 0 || loading || likedPlaces.length === 0) return;
    setLoadingExamples(true);
    (supabase as any)
      .from("route_examples")
      .select("id, title, personality_type, description, pins")
      .in("city", expandCity(city))
      .eq("is_approved", true)
      .then(({ data }: { data: RouteExample[] | null }) => {
        if (!data?.length) { setLoadingExamples(false); return; }
        const likedNames = likedPlaces.map(p => p.place_name.toLowerCase().trim());
        const scored: MatchedRoute[] = data
          .map(r => {
            const matched = r.pins.filter(p =>
              likedNames.includes(p.place_name.toLowerCase().trim())
            );
            return { ...r, score: matched.length, matchedNames: matched.map(p => p.place_name) };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setMatchedRoutes(scored);
        setLoadingExamples(false);
      });
  }, [queue.length, loading, likedPlaces, city]);

  const buildPlan = (route: RouteExample) => ({
    city,
    days: [{
      day_number: 1,
      pins: route.pins.map(p => ({
        place_name: p.place_name,
        address: "",
        description: p.note ?? "",
        suggested_time: p.suggested_time,
        duration_minutes: p.duration_minutes,
        category: p.category,
        latitude: 0,
        longitude: 0,
        day_number: 1,
        walking_time_from_prev: p.walking_time_from_prev ?? null,
      })),
    }],
  });

  const handlePickRoute = (route: RouteExample) => {
    const selectedIndex = matchedRoutes.findIndex(r => r.id === route.id);
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    navigate("/create", {
      state: {
        city,
        date: date.toISOString(),
        numDays,
        startingLocation: startingLocation || undefined,
        fromTemplate: true,
        initialPlan: buildPlan(route),
        matchedRoutes: matchedRoutes.map(r => ({
          id: r.id,
          title: r.title,
          personality_type: r.personality_type,
          pins: r.pins,
        })),
        selectedRouteIndex: selectedIndex,
        likedPlaceNames: allLiked.map(p => p.place_name),
        skippedPlaceNames: skippedPlaces.map(p => p.place_name),
        likedPlacesData: allLiked.map(p => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
        superLikedPlaceNames: superLikedPlaces.map(p => p.place_name),
      },
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // All cards swiped
  if (queue.length === 0) {
    // Batch mode: category exhausted → go back to category picker
    if (onBatchComplete) {
      // Distinguish: empty from start (no places in category) vs exhausted after swiping
      const nothingToShow = history.length === 0 && likedPlaces.length === 0;
      return (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
            <div className="text-5xl">{nothingToShow ? "🤔" : "✅"}</div>
            <div>
              <p className="font-bold text-lg">
                {nothingToShow ? "Brak miejsc w tej kategorii" : "Kategoria wyczerpana!"}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {nothingToShow
                  ? `Nie mamy jeszcze miejsc z tej kategorii w ${city}. Spróbuj innej kategorii.`
                  : likedPlaces.length > 0
                  ? `Wybrałeś ${likedPlaces.length} miejsc. Wybierz kolejną kategorię lub zakończ.`
                  : "Nie wybrałeś żadnego miejsca z tej kategorii. Spróbuj innej."}
              </p>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => onBatchComplete([...likedPlaces, ...superLikedPlaces].map(p => p.place_name))}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Wybierz kolejną kategorię →
              </button>
              {likedPlaces.length > 0 && (
                <button
                  onClick={handleProceed}
                  className="w-full py-3.5 rounded-full border border-border text-sm font-semibold active:scale-[0.97] transition-transform"
                >
                  Zaplanuj trasę z {likedPlaces.length} miejsc
                </button>
              )}
            </div>
          </div>
          {showUpsell && (
            <GuestUpsellModal
              onSignUp={() => {
                const allLiked = [...likedPlaces, ...superLikedPlaces];
                // Pelny route state - bez tego po loginie user ladowal na StartingLocationPicker
                // (step:3) zamiast od razu na widok generowania trasy.
                localStorage.setItem("trasa_guest_plan", JSON.stringify({
                  city,
                  date: date.toISOString(),
                  numDays,
                  startingLocation: startingLocation || undefined,
                  likedPlaceNames: allLiked.map(p => p.place_name),
                  skippedPlaceNames: skippedPlaces.map(p => p.place_name),
                  likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
                  superLikedPlaceNames: superLikedPlaces.map(p => p.place_name),
                }));
                navigate("/auth?return=plan");
              }}
              onDismiss={() => setShowUpsell(false)}
            />
          )}
        </>
      );
    }

    // Round mode: onRoundComplete is called via useEffect above; just render nothing
    if (onRoundComplete) {
      return null;
    }
    if (groupSessionId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
          <div className="text-5xl">🎉</div>
          <div>
            <p className="font-bold text-lg">Oceniłeś wszystkie miejsca!</p>
            <p className="text-muted-foreground text-sm mt-1">
              Polubiłeś {likedPlaces.length + superLikedPlaces.length} miejsc.
              Sprawdź co dopasowaliście z grupą!
            </p>
          </div>
          <button
            onClick={onGroupFinished}
            className="py-3 px-8 rounded-full bg-primary text-white font-semibold text-sm active:scale-95 transition-transform"
          >
            Zobacz dopasowania
          </button>
        </div>
      );
    }
    return (
      <EmptyState
        likedPlaces={likedPlaces}
        matchedRoutes={matchedRoutes}
        onProceed={handleProceed}
        onPickRoute={handlePickRoute}
        loadingExamples={loadingExamples}
        hasCategoryFilter={hasCategoryFilter}
        hasSwipedAny={history.length > 0}
        onResetToday={handleResetToday}
        resetting={resetting}
        onGoToMatches={onSwitchToMatches}
        reviewedTitle={reviewedTitle}
      />
    );
  }

  return (
    // exploreMode (HomeSwipe) renderuje sie WEWNATRZ AppLayout ktore ma fixed BottomNav.
    // PlanWizard (/plan) ma TopBar + progress row + bottom CTA "Zaplanuj trase".
    // Karta nizej uzywa explicit dvh-based maxHeight (NIE flex-1 + 100% % wrappera),
    // bo iOS WebView w standalone Capacitor czasem reportuje % od parent nieprawidlowo
    // gdy parent ma flex-1 min-h-0 - tu uzywamy dvh jako stabilny base i odejmujemy
    // env(safe-area) + chrome height jawnie.
    <div className="flex flex-col flex-1 min-h-0">

      {/* Zgoda na lokalizacje "w kontekscie" (chip dystansu) */}
      <LocationPrimer open={locationPrimerOpen} onClose={() => setLocationPrimerOpen(false)} />

      {/* Bingo banner */}
      {showBanner && (
        <MatchModal
          likedPlaces={likedPlaces}
          onConfirm={handleProceed}
          onDismiss={handleBannerDismiss}
        />
      )}

      {/* Guest upsell */}
      {showUpsell && (
        <GuestUpsellModal
          onSignUp={() => {
            const allLiked = [...likedPlaces, ...superLikedPlaces];
            localStorage.setItem("trasa_guest_plan", JSON.stringify({
              city,
              date: date.toISOString(),
              likedPlaceNames: allLiked.map(p => p.place_name),
            }));
            navigate("/auth?return=plan");
          }}
          onDismiss={() => setShowUpsell(false)}
        />
      )}

      {/* Progress. Hidden in exploreMode (HomeSwipe) - miasto juz jest w chip filter,
          a wybranych count nie ma sensu bez bottom CTA. */}
      <div className={cn("flex items-center justify-between px-5 pt-1 pb-3 shrink-0", exploreMode && "hidden")}>
        <span className="text-xs text-muted-foreground">
          {roundPlaceIds?.length
            ? `Miejsce ${roundPlaceIds.length - queue.length}/${roundPlaceIds.length}`
            : `${city} · ${format(date, "d MMM")}`}
        </span>
        <span className="text-xs text-muted-foreground">
          {(likedPlaces.length + superLikedPlaces.length) > 0 ? `${likedPlaces.length + superLikedPlaces.length} wybranych` : ""}
        </span>
      </div>

      {/* Card stack / Add custom place panel. STRICT 9:16 + top-aligned (items-start).
          Karta przylega do gornej krawedzi dostepnej przestrzeni (po malej pt) zamiast
          byc centrowana - dzieki temu nie ma duzego pustego paska nad karta. Empty
          space ladnie chowa sie pod BottomNav / CTA.
          width = min(maxAbsolute, 100vw - margins, calc fromHeight 9:16):
          Chrome subtraction (w dvh calc dla wysokosci, z ktorej liczone jest width):
          - exploreMode: env(top) + 70 (pt-safe+sticky header) + 94 (BottomNav) + 32 gap
            = 100dvh - env(top) - 196
          - solo: env(top) + 64 TopBar + env(bottom) + 72 CTA + 32 gap
            = 100dvh - env(top) - env(bottom) - 168 */}
      {showAddPlace ? (
        // AddCustomPlacePanel renderuje sie OBOK aspect-9:16 (nie wewnatrz) -
        // full width z paddingiem, dla bardziej oczywistego widoku dodawania miejsca.
        <div className="flex-1 min-h-0 w-full">
          <AddCustomPlacePanel
            city={city}
            onCancel={() => setShowAddPlace(false)}
            onAdd={(added) => {
              const customPlace: MockPlace = {
                id: `custom-${Date.now()}`,
                place_name: added.place_name,
                category: added.category,
                city,
                address: added.address,
                latitude: added.latitude,
                longitude: added.longitude,
                rating: 0,
                photo_url: added.photo_url,
                vibe_tags: [],
                description: added.description,
              };
              setLikedPlaces((prev) => [...prev, customPlace]);
              setShowAddPlace(false);
            }}
          />
        </div>
      ) : isSearching ? (
        // Search mode: list view zamiast 9:16 karty. Klawiatura zostaje na ekranie,
        // user widzi liste wynikow i tapuje zeby otworzyc detail (PlaceSwiperDetail).
        // Tam jest standardowy Dodaj/Odrzuc CTA - flow nieprzerwany.
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
          {displayQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Brak wyników dla „{searchQuery.trim()}"</p>
              {onSuggestPlace && (
                <button
                  onClick={onSuggestPlace}
                  className="text-sm font-semibold text-orange-600 underline underline-offset-2"
                >
                  Zaproponuj dodanie miejsca
                </button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {displayQueue.slice(0, 50).map((place) => (
                <li key={place.id}>
                  <button
                    onClick={() => handleTap(place)}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl bg-card border border-border/40 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center text-2xl">
                      {place.photo_url ? (
                        <img src={place.photo_url} alt={place.place_name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span>{CATEGORY_EMOJI_MAP[place.category] ?? "📍"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground line-clamp-1">{place.place_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {CATEGORY_LABELS[place.category] ?? place.category}{place.address ? ` · ${place.address}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex items-start justify-center w-full pt-2">
        <div
          className="relative aspect-[9/16]"
          style={{
            width: exploreMode
              ? "min(420px, calc(100vw - 48px), calc((100dvh - env(safe-area-inset-top, 0px) - 200px) * 9 / 16))"
              : "min(420px, calc(100vw - 48px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 242px) * 9 / 16))",
          }}
        >
          <>
            {(() => {
              const cardSlice = displayQueue.slice(0, 3);
              return cardSlice
                .slice()
                .reverse()
                .map((place, reversedIdx) => {
                  const offset = cardSlice.length - 1 - reversedIdx;
                  return (
                    <SwipeCard
                      key={place.id}
                      place={place}
                      city={city}
                      onLike={(photoUrl) => handleLike(photoUrl)}
                      onSkip={handleSkip}
                      onTap={() => handleTap(place)}
                      onUndo={handleUndo}
                      canUndo={history.length > 0}
                      onPhotoFetched={(id, url) => { photoUrlOverrides.current[id] = url; }}
                      isTop={offset === 0}
                      offset={offset}
                    />
                  );
                });
            })()}
          </>
        </div>
        </div>
      )}


      {/* Proceed CTA. Ukryty calkowicie w exploreMode (HomeSwipe = wolna eksploracja).
          Polubione miejsca laduja w exploreLikes localStorage; uzytkownik moze stworzyc
          trase rece przez + -> Zaplanuj solo (dialog "Wykorzystac polubione z dzis?").
          W PlanWizard solo (onSwitchToMatches przekazane) CTA przelacza do tabki
          Dopasowania, NIE nawiguje od razu do /create - user wybiera tam ktore
          miejsca wezmie do trasy. Bez prop'a (legacy fallback) wywoluje handleProceed. */}
      {!exploreMode && !groupSessionId && (likedPlaces.length + superLikedPlaces.length > 0) && !showAddPlace && (
        <div className="px-4 pb-safe-4 pt-2 shrink-0 flex gap-2">
          <button
            onClick={() => { if (onSwitchToMatches) onSwitchToMatches(); else handleProceed(); }}
            className="flex-1 py-3 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            {onSwitchToMatches ? "Przejdź do dopasowań" : `Zaplanuj trasę · ${likedPlaces.length + superLikedPlaces.length} ${(likedPlaces.length + superLikedPlaces.length) === 1 ? "miejsce" : "miejsc"}`}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail sheet */}
      <PlaceSwiperDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        place={detailPlace}
        onLike={() => { handleLike(undefined, detailPlace ?? undefined); }}
        onSkip={() => { handleSkip(); }}
      />
    </div>
  );
};

export default PlaceSwiper;
