import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Heart, MapPin, Star, Sparkles, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import PlaceSwiperDetail from "./PlaceSwiperDetail";
import { supabase } from "@/integrations/supabase/client";

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

const MATCH_THRESHOLD = 3; // minimum likes to show match banner
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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const GRADIENT_BG = ["from-slate-700 to-slate-900", "from-stone-700 to-stone-900", "from-zinc-700 to-zinc-900"];

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
      onTap();
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
        {!place.photo_url || imgFailed ? (
          <div className={cn("w-full h-full bg-gradient-to-br", GRADIENT_BG[offset % 3])} />
        ) : (
          <img
            src={place.photo_url}
            alt={place.place_name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
            draggable={false}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
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
              className="shrink-0 flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white/80 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors"
            >
              <Info className="h-3 w-3" />
              więcej
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Match Banner ─────────────────────────────────────────────────────────────

interface MatchBannerProps {
  likedCount: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

const MatchBanner = ({ likedCount, onConfirm, onDismiss }: MatchBannerProps) => (
  <div className="mx-4 mb-3 rounded-2xl bg-card border border-border/60 p-3.5 animate-in slide-in-from-top-2 duration-300">
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">
          Gotowe! Ułożyć z tego trasę?
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {likedCount} wybranych miejsc · @trasa dopasuje plan
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground px-2 py-1"
        >
          Więcej
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-[0.97] transition-transform"
        >
          Tak
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  </div>
);

// ─── Done state ───────────────────────────────────────────────────────────────

const EmptyState = ({
  likedPlaces,
  onProceed,
  city,
  date,
}: {
  likedPlaces: MockPlace[];
  onProceed: () => void;
  city: string;
  date: Date;
}) => (
  <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
    <div className="text-5xl">🗺️</div>
    <div>
      <p className="font-bold text-lg">Przejrzałeś wszystkie miejsca</p>
      <p className="text-muted-foreground text-sm mt-1">
        {likedPlaces.length > 0
          ? `Wybrałeś ${likedPlaces.length} miejsc — ułóżmy z nich plan!`
          : "Nie wybrałeś żadnego miejsca — może zacznijmy od nowa?"}
      </p>
    </div>
    {likedPlaces.length > 0 ? (
      <button
        onClick={onProceed}
        className="bg-orange-500 text-white font-bold rounded-full px-8 py-3.5 shadow-lg shadow-orange-500/30 active:scale-[0.97] transition-transform"
      >
        Ułóż plan z {likedPlaces.length} miejsc
      </button>
    ) : (
      <button
        onClick={() => window.location.reload()}
        className="border border-border rounded-full px-6 py-3 text-sm text-muted-foreground"
      >
        Zacznij od nowa
      </button>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaceSwiperProps {
  city: string;
  date: Date;
}

const PlaceSwiper = ({ city, date }: PlaceSwiperProps) => {
  const navigate = useNavigate();

  const [queue, setQueue] = useState<MockPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPlaces, setLikedPlaces] = useState<MockPlace[]>([]);
  const [skippedPlaces, setSkippedPlaces] = useState<MockPlace[]>([]);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    (supabase as any)
      .from("places")
      .select("*")
      .ilike("city", city)
      .eq("is_active", true)
      .then(({ data }: { data: MockPlace[] | null }) => {
        if (data?.length) {
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          setQueue(shuffled);
        }
        setLoading(false);
      });
  }, [city]);

  // Check match condition
  useEffect(() => {
    if (bannerDismissed) return;
    const uniqueCategories = new Set(likedPlaces.map((p) => p.category)).size;
    if (likedPlaces.length >= MATCH_THRESHOLD && uniqueCategories >= CATEGORY_DIVERSITY) {
      setShowBanner(true);
    }
  }, [likedPlaces, bannerDismissed]);

  const handleLike = () => {
    const [top, ...rest] = queue;
    setLikedPlaces((prev) => [...prev, top]);
    setQueue(rest);
  };

  const handleSkip = () => {
    const [top] = queue;
    if (top) setSkippedPlaces((prev) => [...prev, top]);
    setQueue((prev) => prev.slice(1));
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
        likedPlaceNames: likedPlaces.map((p) => p.place_name),
        skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
      },
    });
  };

  const handleBannerDismiss = () => {
    setShowBanner(false);
    setBannerDismissed(true);
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
        onProceed={handleProceed}
        city={city}
        date={date}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Match banner */}
      {showBanner && (
        <MatchBanner
          likedCount={likedPlaces.length}
          onConfirm={handleProceed}
          onDismiss={handleBannerDismiss}
        />
      )}

      {/* Progress */}
      <div className="flex items-center justify-between px-5 pb-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {city} · {format(date, "d MMM")}
        </span>
        <div className="flex items-center gap-1.5">
          {likedPlaces.length > 0 && (
            <span className="text-xs font-medium text-orange-500">
              {likedPlaces.length} wybranych
            </span>
          )}
        </div>
      </div>

      {/* Card stack */}
      <div className="relative mx-4 overflow-hidden" style={{ flex: "1 1 0", minHeight: 0 }}>
        {queue
          .slice(0, 3)
          .reverse()
          .map((place, reversedIdx) => {
            const offset = 2 - reversedIdx; // 0 = top, 1 = second, 2 = third
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
          })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4 py-5 shrink-0">
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
          onClick={() => queue[0] && handleTap(queue[0])}
          className="h-14 w-14 rounded-full border border-border/60 bg-card flex items-center justify-center active:scale-90 transition-transform"
        >
          <Info className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Skip to plan link */}
      {likedPlaces.length > 0 && (
        <button
          onClick={handleProceed}
          className="pb-safe-4 pb-4 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Pomiń · Zaplanuj z {likedPlaces.length} wybranych
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
