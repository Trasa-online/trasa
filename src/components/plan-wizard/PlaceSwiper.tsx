import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Heart, MapPin, Star, ArrowRight, ChevronUp, RotateCcw } from "lucide-react";
import AddCustomPlacePanel from "./AddCustomPlacePanel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import PlaceSwiperDetail from "./PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { useAuth } from "@/hooks/useAuth";

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
  restaurant: "bg-orange-600/20 text-orange-400",
  cafe: "bg-amber-500/20 text-amber-400",
  museum: "bg-violet-500/20 text-violet-400",
  park: "bg-emerald-500/20 text-emerald-400",
  bar: "bg-blue-500/20 text-blue-400",
  club: "bg-pink-500/20 text-pink-400",
  monument: "bg-stone-500/20 text-stone-400",
  gallery: "bg-purple-500/20 text-purple-400",
  market: "bg-yellow-500/20 text-yellow-400",
  viewpoint: "bg-sky-500/20 text-sky-400",
  shopping: "bg-rose-500/20 text-rose-400",
  experience: "bg-teal-500/20 text-teal-400",
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_DOTS = (level?: number) =>
  level ? "·".repeat(level) + "·".repeat(4 - level).replace(/·/g, "○") : null;

// ─── SwipeCard ────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  place: MockPlace;
  city: string;
  onLike: () => void;
  onSkip: () => void;
  onTap: () => void;
  isTop: boolean;
  offset: number; // 0 = top, 1 = second, 2 = third
}


const SwipeCard = ({ place, city, onLike, onSkip, onTap, isTop, offset }: SwipeCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(place.photo_url ? [place.photo_url] : []);
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

  // Prefetch Google Places photos + enrich missing card data when card is top or next-in-line
  useEffect(() => {
    if (offset > 1 || !GOOGLE_MAPS_API_KEY) return;
    supabase.functions
      .invoke("google-places-proxy", {
        body: { placeName: place.place_name, latitude: place.latitude, longitude: place.longitude, city },
      })
      .then(({ data }) => {
        const refs: string[] = (data?.result?.photos ?? [])
          .slice(0, 5)
          .map((p: { photo_reference: string }) =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
          );
        if (refs.length > 0) setPhotoUrls(refs);
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
      onLike();
    } else if (dragX < -80) {
      onSkip();
    }
  };

  const rotation = isTop ? dragX * 0.08 : 0;
  const likeOpacity = isTop ? Math.min(dragX / 80, 1) : 0;
  const skipOpacity = isTop ? Math.min(-dragX / 80, 1) : 0;

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
        "absolute inset-0 rounded-3xl overflow-hidden shadow-2xl select-none",
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

      {/* Like / Skip indicators */}
      {isTop && (
        <>
          <div
            className="absolute top-8 left-6 rotate-[-20deg] border-4 border-emerald-400 rounded-xl px-3 py-1"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-emerald-400 font-black text-2xl tracking-widest">CHCĘ</span>
          </div>
          <div
            className="absolute top-8 right-6 rotate-[20deg] border-4 border-red-400 rounded-xl px-3 py-1"
            style={{ opacity: skipOpacity }}
          >
            <span className="text-red-400 font-black text-2xl tracking-widest">SKIP</span>
          </div>
        </>
      )}

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
        {/* Category */}
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", CATEGORY_COLORS[place.category])}>
          {CATEGORY_LABELS[place.category]}
        </span>

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
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onTap(); }}
              className="shrink-0 h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
            >
              <ChevronUp className="h-5 w-5 text-black" />
            </button>
          )}
        </div>
      </div>
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
              className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
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
  startingLocation?: string;
  initialLikedPlaceNames?: string[];
  initialSkippedPlaceNames?: string[];
  searchQuery?: string;
  showAddPlace?: boolean;
  onAddPlaceClose?: () => void;
}

// Category groups for diversity balancing
const FOOD_CATEGORIES = new Set<string>(["restaurant", "cafe", "bar"]);
const CULTURE_CATEGORIES = new Set<string>(["museum", "gallery", "monument"]);
const CATEGORY_GROUPS: Set<string>[] = [FOOD_CATEGORIES, CULTURE_CATEGORIES];

function getGroupForCategory(cat: string): Set<string> | null {
  return CATEGORY_GROUPS.find(g => g.has(cat)) ?? null;
}

const DIVERSITY_THRESHOLD = 2; // after 2 consecutive likes from same group, deprioritize

const PlaceSwiper = ({ city, date, startingLocation = "", initialLikedPlaceNames = [], initialSkippedPlaceNames = [], searchQuery = "", showAddPlace: showAddPlaceProp = false, onAddPlaceClose }: PlaceSwiperProps) => {
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
  // Track consecutive likes per category group
  const [recentLikedGroups, setRecentLikedGroups] = useState<(Set<string> | null)[]>([]);
  const showAddPlace = showAddPlaceProp;
  const setShowAddPlace = (v: boolean) => { if (!v) onAddPlaceClose?.(); };

  useEffect(() => {
    setLoading(true);
    const fetchPlaces = async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("*")
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
      }

      const likedSet = new Set(initialLikedPlaceNames.map(n => n.toLowerCase()));
      const skippedSet = new Set(initialSkippedPlaceNames.map(n => n.toLowerCase()));
      const liked = data.filter((p: MockPlace) => likedSet.has(p.place_name.toLowerCase()));
      const skipped = data.filter((p: MockPlace) => skippedSet.has(p.place_name.toLowerCase()));

      // Filter out places user already rated (unless they come from explicit return state)
      const hasReturnState = initialLikedPlaceNames.length > 0 || initialSkippedPlaceNames.length > 0;
      const remaining = data.filter((p: MockPlace) => {
        if (likedSet.has(p.place_name.toLowerCase()) || skippedSet.has(p.place_name.toLowerCase())) return false;
        if (!hasReturnState && ratedPlaceIds.has(p.id)) return false;
        return true;
      });

      setAllPlaces(data);
      if (liked.length) setLikedPlaces(liked);
      if (skipped.length) setSkippedPlaces(skipped);
      setQueue([...remaining].sort(() => Math.random() - 0.5));
      setLoading(false);
    };
    fetchPlaces();
  }, [city, user]);

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

  const saveReaction = (place: MockPlace, reaction: "liked" | "skipped" | "super_liked") => {
    if (!user) return;
    (supabase as any)
      .from("user_place_reactions")
      .upsert({
        user_id: user.id,
        place_id: place.id,
        place_name: place.place_name,
        city: place.city,
        category: place.category,
        photo_url: place.photo_url ?? null,
        reaction,
      }, { onConflict: "user_id,place_id" })
      .then(() => {});
  };

  const deleteReaction = (placeId: string) => {
    if (!user) return;
    (supabase as any)
      .from("user_place_reactions")
      .delete()
      .match({ user_id: user.id, place_id: placeId })
      .then(() => {});
  };

  const trackAndRebalance = (place: MockPlace) => {
    const group = getGroupForCategory(place.category);
    const updated = [...recentLikedGroups, group];
    setRecentLikedGroups(updated);
    rebalanceQueue(updated);
  };

  const handleLike = () => {
    const top = displayQueue[0];
    if (!top) return;
    setHistory(prev => [...prev, { place: top, reaction: "liked" }]);
    setLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "liked");
    trackAndRebalance(top);
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

  const handleSuperLike = () => {
    const top = displayQueue[0];
    if (!top) return;
    setHistory(prev => [...prev, { place: top, reaction: "super_liked" }]);
    setSuperLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "super_liked");
    trackAndRebalance(top);
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
    deleteReaction(last.place.id);
  };

  const handleTap = (place: MockPlace) => {
    setDetailPlace(place);
    setDetailOpen(true);
  };

  const handleProceed = () => {
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    navigate("/create", {
      state: {
        city,
        date: date.toISOString(),
        startingLocation: startingLocation || undefined,
        likedPlaceNames: allLiked.map((p) => p.place_name),
        skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
        likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
        superLikedPlaceNames: superLikedPlaces.map((p) => p.place_name),
      },
    });
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

      {/* Progress */}
      <div className="flex items-center justify-between px-5 pb-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {city} · {format(date, "d MMM")}
        </span>
        <span className="text-xs text-muted-foreground">
          {likedPlaces.length > 0 ? `${likedPlaces.length} wybranych` : ""}
        </span>
      </div>

      {/* Card stack / Add custom place panel */}
      <div className="relative mx-4" style={{ flex: "1 1 0", minHeight: 0, maxHeight: "min(680px, 78dvh)" }}>
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
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Brak wyników dla tego miasta</p>
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
                      onLike={handleLike}
                      onSkip={handleSkip}
                      onTap={() => handleTap(place)}
                      isTop={offset === 0}
                      offset={offset}
                    />
                  );
                });
            })()}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 py-5 shrink-0">
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="h-12 w-12 rounded-full border border-border/60 bg-card flex items-center justify-center active:scale-90 transition-transform disabled:opacity-25"
        >
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          onClick={handleSkip}
          className="h-14 w-14 rounded-full border border-border/60 bg-card flex items-center justify-center active:scale-90 transition-transform"
        >
          <X className="h-6 w-6 text-muted-foreground" />
        </button>

        <button
          onClick={handleSuperLike}
          className="h-14 w-14 rounded-full border-2 border-yellow-400 bg-card flex items-center justify-center shadow-sm active:scale-90 transition-transform"
        >
          <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
        </button>

        <button
          onClick={handleLike}
          className="h-16 w-16 rounded-full bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30 active:scale-90 transition-transform"
        >
          <Heart className="h-7 w-7 text-white fill-white" />
        </button>

        <button
          onClick={() => displayQueue[0] && handleTap(displayQueue[0])}
          className="h-14 w-14 rounded-full border border-border/60 bg-card flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Small text proceed link */}
      {(likedPlaces.length + superLikedPlaces.length > 0) && !showAddPlace && (
        <button
          onClick={handleProceed}
          className="pb-3 text-center text-xs text-muted-foreground active:opacity-70 transition-opacity shrink-0"
        >
          {likedPlaces.length + superLikedPlaces.length} {(likedPlaces.length + superLikedPlaces.length) === 1 ? "wybrane" : "wybranych"} ·{" "}
          <span className="text-foreground font-medium">Zaplanuj trasę</span>
        </button>
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
