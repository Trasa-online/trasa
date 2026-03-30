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
  restaurant: "bg-orange-500/20 text-orange-400",
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

const MATCH_THRESHOLD = 5; // minimum likes to show match banner
const MATCH_THRESHOLD_REPEAT = 11; // re-show banner after dismissal
const CATEGORY_DIVERSITY = 2; // minimum different categories

// ─── SwipeCard ────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  place: MockPlace;
  onLike: () => void;
  onSkip: () => void;
  onTap: () => void;
  isTop: boolean;
  offset: number; // 0 = top, 1 = second, 2 = third
}


const SwipeCard = ({ place, onLike, onSkip, onTap, isTop, offset }: SwipeCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(place.photo_url ? [place.photo_url] : []);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const GRADIENT_BG = ["from-slate-700 to-slate-900", "from-stone-700 to-stone-900", "from-zinc-700 to-zinc-900"];

  // Prefetch Google Places photos when card is top or next-in-line
  useEffect(() => {
    if (offset > 1 || !GOOGLE_MAPS_API_KEY) return;
    supabase.functions
      .invoke("google-places-proxy", {
        body: { placeName: place.place_name, latitude: place.latitude, longitude: place.longitude },
      })
      .then(({ data }) => {
        const refs: string[] = (data?.result?.photos ?? [])
          .slice(0, 5)
          .map((p: { photo_reference: string }) =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
          );
        if (refs.length > 0) setPhotoUrls(refs);
      })
      .catch(() => {});
  }, [offset, place.place_name, place.latitude, place.longitude]);

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
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white/90 text-sm font-medium">{place.rating}</span>
          </div>
          {place.price_level && (
            <span className="text-white/60 text-sm">{PRICE_DOTS(place.price_level)}</span>
          )}
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-white/50" />
            <span className="text-white/60 text-xs truncate">{place.address.split(",")[0]}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-white/75 text-sm leading-snug">{place.description}</p>

        {/* Vibe tags + info button row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex gap-1.5 flex-wrap">
            {place.vibe_tags.map((tag) => (
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

// ─── Match Modal ──────────────────────────────────────────────────────────────

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🔭", shopping: "🛍️", experience: "🎪",
};

interface MatchModalProps {
  likedPlaces: MockPlace[];
  userInitials: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

const MatchModal = ({ likedPlaces, onConfirm, onDismiss }: MatchModalProps) => {
  const orbs = likedPlaces.slice(0, 3);
  const extra = likedPlaces.length - 3;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-safe-6 pb-6 flex flex-col items-center gap-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">

        {/* Orbs row */}
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

        {/* Place names */}
        <div className="flex flex-col items-center gap-1 w-full">
          {orbs.map((p) => (
            <p key={p.id} className="text-sm font-medium text-foreground">{p.place_name}</p>
          ))}
          {extra > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">i {extra} więcej</p>
          )}
        </div>

        {/* Headline */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-foreground">Bingo!</p>
          <p className="text-sm text-muted-foreground">Mamy dla Ciebie trasę.</p>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-orange-500/25"
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
              <div key={i} className="h-2 w-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
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
                <span key={name} className="text-xs bg-orange-500/10 text-orange-600 px-2.5 py-1 rounded-full font-medium">
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
            : "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
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

const PlaceSwiper = ({ city, date, startingLocation = "", initialLikedPlaceNames = [], initialSkippedPlaceNames = [], searchQuery = "", showAddPlace: showAddPlaceProp = false, onAddPlaceClose }: PlaceSwiperProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userInitials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const [allPlaces, setAllPlaces] = useState<MockPlace[]>([]);
  const [queue, setQueue] = useState<MockPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPlaces, setLikedPlaces] = useState<MockPlace[]>([]);
  const [skippedPlaces, setSkippedPlaces] = useState<MockPlace[]>([]);
  const [history, setHistory] = useState<{ place: MockPlace; wasLiked: boolean }[]>([]);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [matchedRoutes, setMatchedRoutes] = useState<MatchedRoute[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const showAddPlace = showAddPlaceProp;
  const setShowAddPlace = (v: boolean) => { if (!v) onAddPlaceClose?.(); };

  useEffect(() => {
    setLoading(true);
    (supabase as any)
      .from("places")
      .select("*")
      .ilike("city", city)
      .eq("is_active", true)
      .then(({ data }: { data: MockPlace[] | null }) => {
        if (data?.length) {
          setAllPlaces(data);
          const likedSet = new Set(initialLikedPlaceNames.map(n => n.toLowerCase()));
          const skippedSet = new Set(initialSkippedPlaceNames.map(n => n.toLowerCase()));
          const liked = data.filter(p => likedSet.has(p.place_name.toLowerCase()));
          const skipped = data.filter(p => skippedSet.has(p.place_name.toLowerCase()));
          const remaining = data.filter(p => !likedSet.has(p.place_name.toLowerCase()) && !skippedSet.has(p.place_name.toLowerCase()));
          if (liked.length) setLikedPlaces(liked);
          if (skipped.length) setSkippedPlaces(skipped);
          setQueue([...remaining].sort(() => Math.random() - 0.5));
        }
        setLoading(false);
      });
  }, [city]);

  const isSearching = searchQuery.trim().length >= 2;
  const displayQueue = isSearching
    ? allPlaces.filter(p => p.place_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : queue;

  // Check match condition
  useEffect(() => {
    const uniqueCategories = new Set(likedPlaces.map((p) => p.category)).size;
    if (bannerDismissed) {
      // Re-show after user liked enough extra places
      if (likedPlaces.length >= MATCH_THRESHOLD_REPEAT && uniqueCategories >= CATEGORY_DIVERSITY) {
        setBannerDismissed(false);
        setShowBanner(true);
      }
      return;
    }
    if (likedPlaces.length >= MATCH_THRESHOLD && uniqueCategories >= CATEGORY_DIVERSITY) {
      setShowBanner(true);
    }
  }, [likedPlaces, bannerDismissed]);

  const saveReaction = (place: MockPlace, reaction: "liked" | "skipped") => {
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

  const handleLike = () => {
    const top = displayQueue[0];
    if (!top) return;
    setHistory(prev => [...prev, { place: top, wasLiked: true }]);
    setLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "liked");
  };

  const handleSkip = () => {
    const top = displayQueue[0];
    if (!top) return;
    setHistory(prev => [...prev, { place: top, wasLiked: false }]);
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
    if (last.wasLiked) {
      setLikedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    } else {
      setSkippedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    }
    deleteReaction(last.place.id);
    setShowBanner(false);
  };

  const handleTap = (place: MockPlace) => {
    setDetailPlace(place);
    setDetailOpen(true);
  };

  const handleProceed = () => {
    navigate("/create", {
      state: {
        city,
        date: date.toISOString(),
        startingLocation: startingLocation || undefined,
        likedPlaceNames: likedPlaces.map((p) => p.place_name),
        skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
        likedPlacesData: likedPlaces.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
      },
    });
  };

  const handleBannerDismiss = () => {
    setShowBanner(false);
    setBannerDismissed(true);
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
        likedPlaceNames: likedPlaces.map(p => p.place_name),
        skippedPlaceNames: skippedPlaces.map(p => p.place_name),
        likedPlacesData: likedPlaces.map(p => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude })),
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
              className="h-2 w-2 rounded-full bg-orange-500 animate-bounce"
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

      {/* Match modal */}
      {showBanner && (
        <MatchModal
          likedPlaces={likedPlaces}
          userInitials={userInitials}
          onConfirm={handleProceed}
          onDismiss={handleBannerDismiss}
        />
      )}

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
          onClick={handleLike}
          className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-90 transition-transform"
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
      {likedPlaces.length > 0 && !showAddPlace && (
        <button
          onClick={handleProceed}
          className="pb-3 text-center text-xs text-muted-foreground active:opacity-70 transition-opacity shrink-0"
        >
          {likedPlaces.length} {likedPlaces.length === 1 ? "wybrane" : "wybranych"} ·{" "}
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
