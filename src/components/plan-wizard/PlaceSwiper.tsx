import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, ArrowRight, ChevronUp, RotateCcw } from "lucide-react";
import AddCustomPlacePanel from "./AddCustomPlacePanel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import PlaceSwiperDetail from "./PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl } from "@/lib/placePhotos";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_MODE, getMockPlaces } from "@/lib/mockPlaces";

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
  galleryPhotos?: string[]; // extra photos shown in carousel (swipe card + detail)
}

export type PlaceCategory =
  | "restaurant"
  | "cafe"
  | "museum"
  | "park"
  | "bar"
  | "club"
  | "monument"
  | "gallery"
  | "market"
  | "viewpoint"
  | "shopping"
  | "experience";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: "Restauracja",
  cafe: "Kawiarnia",
  museum: "Muzeum",
  park: "Park",
  bar: "Bar",
  club: "Klub",
  monument: "Zabytek",
  gallery: "Galeria",
  market: "Targ",
  viewpoint: "Widok",
  shopping: "Zakupy",
  experience: "Rozrywka",
};

const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  restaurant: "bg-orange-600/80 text-white",
  cafe: "bg-amber-500/80 text-white",
  museum: "bg-violet-600/80 text-white",
  park: "bg-emerald-600/80 text-white",
  bar: "bg-blue-600/80 text-white",
  club: "bg-pink-600/80 text-white",
  monument: "bg-stone-600/80 text-white",
  gallery: "bg-purple-600/80 text-white",
  market: "bg-yellow-600/80 text-white",
  viewpoint: "bg-sky-600/80 text-white",
  shopping: "bg-rose-600/80 text-white",
  experience: "bg-teal-600/80 text-white",
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_DOTS = (level?: number) =>
  level ? "·".repeat(level) + "·".repeat(4 - level).replace(/·/g, "○") : null;

const MATCH_THRESHOLD = 5;        // minimum likes to show bingo banner
const MATCH_THRESHOLD_REPEAT = 11; // re-show banner after dismissal
const CATEGORY_DIVERSITY = 2;     // minimum different categories

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
            className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/25"
          >
            Sprawdzam trasę
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
          >
            Wróć do przeglądania
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    [place.photo_url, ...(place.galleryPhotos ?? [])]
      .filter((u): u is string => !!u && (u.startsWith("http") || u.startsWith("/api/")) && !u.includes("picsum") && !u.includes("lorem"))
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [googleRating, setGoogleRating] = useState<number | null>(null);
  const [googleAddress, setGoogleAddress] = useState<string | null>(null);
  const [googleDescription, setGoogleDescription] = useState<string | null>(null);
  const [googleTags, setGoogleTags] = useState<string[] | null>(null);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const GRADIENT_BG = ["from-slate-700 to-slate-900", "from-stone-700 to-stone-900", "from-zinc-700 to-zinc-900"];

  // Prefetch Google Places data + cache 1 photo when card is top or next-in-line
  useEffect(() => {
    if (offset > 1 || skipGoogleFetch) return;
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
      .then(({ data }) => {
        // Prefer full photo_url returned by proxy (no client key needed)
        const photo = data?.result?.photos?.[0];
        const url = photo?.photo_url ?? (photo?.photo_reference ? getPhotoUrl(photo.photo_reference, 800) : null);
        if (url) {
          setPhotoUrls([url]);
          setImgFailed(false);
          onPhotoFetched?.(place.id, url);
        }
        if (!place.rating && data?.result?.rating) setGoogleRating(data.result.rating);
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
      .catch(() => {});
  }, [offset, place.place_name, place.latitude, place.longitude]);

  const displayRating = place.rating || googleRating;
  const displayAddress = place.address || googleAddress;
  const displayDescription = place.description || googleDescription;
  const displayTags = place.vibe_tags?.length ? place.vibe_tags : (googleTags ?? []);

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
      {/* Photo */}
      <div className="absolute inset-0">
        {photoUrls.length === 0 || imgFailed ? (
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
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        {/* Photo dots */}
        {isTop && photoUrls.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {photoUrls.map((_, i) => (
              <div key={i} className={cn("h-1 rounded-full transition-all", i === photoIdx ? "w-4 bg-white" : "w-1.5 bg-white/50")} />
            ))}
          </div>
        )}
      </div>



      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pt-5 pb-[76px] space-y-2">
        {/* Category (hidden for business cards — replaced by logo row) */}
        {place.businessLogoUrl === undefined && (
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", CATEGORY_COLORS[place.category])}>
            {CATEGORY_LABELS[place.category]}
          </span>
        )}

        {/* Business logo row */}
        {place.businessLogoUrl !== undefined && (
          <div className="flex items-center gap-2">
            {place.businessLogoUrl ? (
              <img src={place.businessLogoUrl} className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            )}
            <span className="text-white/70 text-xs">{CATEGORY_LABELS[place.category]} · @trasa</span>
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
        </div>

        {/* Description */}
        {displayDescription && <p className="text-white/75 text-sm leading-snug">{displayDescription}</p>}

        {/* Business event pill */}
        {place.businessEventTitle && (
          <div className="inline-flex items-center gap-1.5 bg-amber-500/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-semibold">
            🎉 {place.businessEventTitle}
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
              {place.businessPlan !== 'zero' && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onTap(); }}
                  className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                >
                  <ChevronUp className="h-5 w-5 text-black" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons inside card — only on top card */}
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
            className="flex-1 py-3 rounded-full bg-orange-600 text-white font-bold text-sm shadow-xl shadow-orange-600/30 active:scale-[0.97] transition-transform"
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
}: {
  likedPlaces: MockPlace[];
  matchedRoutes: MatchedRoute[];
  onProceed: () => void;
  onPickRoute: (route: RouteExample) => void;
  loadingExamples: boolean;
}) => {
  if (likedPlaces.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="text-5xl">🗺️</div>
        <div>
          <p className="font-bold text-lg">Przejrzałeś wszystkie miejsca</p>
          <p className="text-muted-foreground text-sm mt-1">Nie wybrałeś żadnego miejsca — może zacznijmy od nowa?</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="border border-border rounded-full px-6 py-3 text-sm text-muted-foreground"
        >
          Zacznij od nowa
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
          {matchedRoutes.length > 0
            ? "Znalazłam trasy pasujące do Twoich wyborów"
            : "Zaplanujmy trasę z Twoich miejsc"}
        </p>
      </div>

      {loadingExamples && (
        <div className="flex justify-center py-8">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
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
                <span key={name} className="text-xs bg-orange-600/10 text-orange-600 px-2.5 py-1 rounded-full font-medium">
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
              className="w-full py-3 rounded-2xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
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
          "w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-transform",
          matchedRoutes.length > 0
            ? "border border-border text-muted-foreground bg-card mt-1"
            : "bg-orange-600 text-white shadow-lg shadow-orange-600/25"
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
  startingLocation?: string;
  initialLikedPlaceNames?: string[];
  initialSkippedPlaceNames?: string[];
  searchQuery?: string;
  showAddPlace?: boolean;
  onAddPlaceClose?: () => void;
  exploreMode?: boolean;
  groupSessionId?: string;
  onGroupFinished?: () => void;
  /** When set, PlaceSwiper loads exactly these place IDs in this order (group round mode). */
  roundPlaceIds?: string[];
  /** Called when the user finishes swiping all round places (instead of showing the default empty state). */
  onRoundComplete?: () => void;
  /** Called when user taps "suggest adding a place" in the empty search state. */
  onSuggestPlace?: () => void;
}

// Category groups for diversity balancing
const FOOD_CATEGORIES = new Set<string>(["restaurant", "cafe", "bar"]);
const CULTURE_CATEGORIES = new Set<string>(["museum", "gallery", "monument"]);
const CATEGORY_GROUPS: Set<string>[] = [FOOD_CATEGORIES, CULTURE_CATEGORIES];

function getGroupForCategory(cat: string): Set<string> | null {
  return CATEGORY_GROUPS.find(g => g.has(cat)) ?? null;
}

const DIVERSITY_THRESHOLD = 2; // after 2 consecutive likes from same group, deprioritize

// Maps raw DB row (with nested business_profiles) to MockPlace fields
function enrichWithBusinessProfile(p: any): MockPlace {
  const bp = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
  if (!bp) return p as MockPlace;
  const plan: 'zero' | 'basic' | 'premium' = bp.plan ?? 'zero';
  return {
    ...p,
    businessPlan: plan,
    // basic+: override photo with business cover if set
    photo_url: (plan === 'basic' || plan === 'premium') && bp.cover_image_url ? bp.cover_image_url : p.photo_url,
    // premium only: logo row + event pill + gallery
    businessLogoUrl: plan === 'premium' ? (bp.logo_url ?? '') : undefined,
    businessEventTitle: plan === 'premium' ? (bp.event_title ?? undefined) : undefined,
    galleryPhotos: plan === 'premium' ? (bp.gallery_urls ?? []) : [],
  } as MockPlace;
}

const PlaceSwiper = ({ city, date, numDays = 1, startingLocation = "", initialLikedPlaceNames = [], initialSkippedPlaceNames = [], searchQuery = "", showAddPlace: showAddPlaceProp = false, onAddPlaceClose, exploreMode = false, groupSessionId, onGroupFinished, roundPlaceIds, onRoundComplete, onSuggestPlace }: PlaceSwiperProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allPlaces, setAllPlaces] = useState<MockPlace[]>([]);
  const [queue, setQueue] = useState<MockPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPlaces, setLikedPlaces] = useState<MockPlace[]>([]);
  const [skippedPlaces, setSkippedPlaces] = useState<MockPlace[]>([]);
  const [superLikedPlaces, setSuperLikedPlaces] = useState<MockPlace[]>([]);
  const [history, setHistory] = useState<{ place: MockPlace; reaction: "liked" | "skipped" | "super_liked" }[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [matchedRoutes, setMatchedRoutes] = useState<MatchedRoute[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissCount, setBannerDismissCount] = useState(0);
  // Track consecutive likes per category group
  const [recentLikedGroups, setRecentLikedGroups] = useState<(Set<string> | null)[]>([]);
  const showAddPlace = showAddPlaceProp;
  const setShowAddPlace = (v: boolean) => { if (!v) onAddPlaceClose?.(); };

  useEffect(() => {
    setLoading(true);
    const fetchPlaces = async () => {

      // ── Mock mode: use local data, zero API/DB cost ──────────────────────
      if (MOCK_MODE) {
        const mocks = getMockPlaces(city);
        // In group sessions, show 10 places per round; solo = all
        const limit = groupSessionId ? 10 : mocks.length;
        const shuffled = [...mocks.slice(0, limit)].sort(() => Math.random() - 0.5);
        setAllPlaces(shuffled);
        setQueue(shuffled);
        setLoading(false);
        return;
      }

      // ── Group round mode: load exactly the round's place IDs in order ──
      if (roundPlaceIds?.length) {
        const { data } = await (supabase as any)
          .from("places")
          .select("*, business_profiles(plan, logo_url, cover_image_url, event_title, gallery_urls)")
          .in("id", roundPlaceIds);

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
      const { data } = await (supabase as any)
        .from("places")
        .select("*, business_profiles(plan, logo_url, cover_image_url, event_title, gallery_urls)")
        .ilike("city", city)
        .eq("is_active", true);

      if (!data?.length) { setLoading(false); return; }

      // Fetch already-rated place IDs for this user+city
      let ratedPlaceIds = new Set<string>();
      if (user) {
        const { data: reactions } = await (supabase as any)
          .from("user_place_reactions")
          .select("place_id")
          .eq("user_id", user.id)
          .ilike("city", city);
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
      const remaining = enriched.filter((p) => {
        if (likedSet.has(p.place_name.toLowerCase()) || skippedSet.has(p.place_name.toLowerCase())) return false;
        if (!hasReturnState && ratedPlaceIds.has(p.id)) return false;
        return true;
      });

      setAllPlaces(enriched);
      if (liked.length) setLikedPlaces(liked);
      if (skipped.length) setSkippedPlaces(skipped);
      setQueue([...remaining].sort(() => Math.random() - 0.5));
      setLoading(false);
    };
    fetchPlaces();
  }, [city, user, roundPlaceIds]);

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

  const handleLike = (overridePhotoUrl?: string) => {
    const top = displayQueue[0];
    if (!top) return;
    setHistory(prev => [...prev, { place: top, reaction: "liked" }]);
    setLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "liked", overridePhotoUrl);
    trackAndRebalance(top);
    // Track add_to_route for real (non-mock) places
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(top.id)) {
      (supabase as any).from("place_events").insert({ place_id: top.id, event_type: "add_to_route", user_id: user?.id ?? null });
    }
  };

  const handleSkip = () => {
    const top = displayQueue[0];
    if (!top) return;
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
    if (place.businessPlan === 'zero') return; // zero-plan: no detail
    setDetailPlace(place);
    setDetailOpen(true);
  };

  const handleProceed = () => {
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    navigate("/create", {
      state: {
        city,
        date: date.toISOString(),
        numDays,
        startingLocation: startingLocation || undefined,
        likedPlaceNames: allLiked.map((p) => p.place_name),
        skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
        likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
        superLikedPlaceNames: superLikedPlaces.map((p) => p.place_name),
      },
    });
  };

  // Notify parent when round is complete (must be in effect, not render)
  useEffect(() => {
    if (queue.length === 0 && !loading && onRoundComplete) {
      onRoundComplete();
    }
  }, [queue.length, loading]);

  // Show bingo banner when threshold reached
  useEffect(() => {
    if (groupSessionId) return; // not in group mode
    const uniqueCategories = new Set(likedPlaces.map((p) => p.category)).size;
    if (bannerDismissCount >= 2) return; // never show again after two dismissals
    if (bannerDismissCount === 0 && likedPlaces.length >= MATCH_THRESHOLD && uniqueCategories >= CATEGORY_DIVERSITY) {
      setShowBanner(true);
    } else if (bannerDismissCount === 1 && likedPlaces.length >= MATCH_THRESHOLD_REPEAT && uniqueCategories >= CATEGORY_DIVERSITY) {
      setShowBanner(true);
    }
  }, [likedPlaces, bannerDismissCount, groupSessionId]);

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
      .ilike("city", city)
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
              className="h-2 w-2 rounded-full bg-orange-600 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // All cards swiped
  if (queue.length === 0) {
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
            className="py-3 px-8 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-95 transition-transform"
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
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Bingo banner */}
      {showBanner && (
        <MatchModal
          likedPlaces={likedPlaces}
          onConfirm={handleProceed}
          onDismiss={handleBannerDismiss}
        />
      )}

      {/* Progress */}
      <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
        <span className="text-xs text-muted-foreground">
          {roundPlaceIds?.length
            ? `Miejsce ${roundPlaceIds.length - queue.length}/${roundPlaceIds.length}`
            : `${city} · ${format(date, "d MMM")}`}
        </span>
        <span className="text-xs text-muted-foreground">
          {(likedPlaces.length + superLikedPlaces.length) > 0 ? `${likedPlaces.length + superLikedPlaces.length} wybranych` : ""}
        </span>
      </div>

      {/* Card stack / Add custom place panel */}
      <div className="relative mx-4 mb-4" style={{ flex: "1 1 0", minHeight: 0, maxHeight: "min(680px, 78dvh)" }}>
        {showAddPlace ? (
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
        ) : (
          <>
            {isSearching && displayQueue.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
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
            )}
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
        )}
      </div>


      {/* Proceed CTA */}
      {!groupSessionId && (likedPlaces.length + superLikedPlaces.length > 0) && !showAddPlace && (
        <div className="px-4 pb-3 shrink-0 flex gap-2">
          {exploreMode && (
            <button
              onClick={() => navigate("/historia", { state: { fromCity: city } })}
              className="flex-1 py-3 rounded-2xl border border-border/60 bg-card text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              Zakończ
            </button>
          )}
          <button
            onClick={handleProceed}
            className="flex-[2] py-3 rounded-2xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            Zaplanuj trasę · {likedPlaces.length + superLikedPlaces.length} {(likedPlaces.length + superLikedPlaces.length) === 1 ? "miejsce" : "miejsc"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail sheet */}
      <PlaceSwiperDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        place={detailPlace}
        onLike={() => { handleLike(); }}
        onSkip={() => { handleSkip(); }}
      />
    </div>
  );
};

export default PlaceSwiper;
