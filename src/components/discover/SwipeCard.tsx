import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreatorPlace {
  id: string;
  place_name: string;
  category: string | null;
  description: string | null;
  instagram_reel_url: string | null;
  creator_handle: string;
  photo_url: string | null;
}

interface SwipeCardProps {
  place: CreatorPlace;
  onSwipe: (action: "like" | "skip") => void;
  active: boolean;
  stackIndex: number; // 0 = top, 1 = behind, 2 = further behind
}

const SWIPE_THRESHOLD = 100;

const CATEGORY_COLORS: Record<string, string> = {
  bar: "from-purple-900 to-purple-700",
  restaurant: "from-orange-800 to-orange-600",
  cafe: "from-amber-900 to-amber-700",
  viewpoint: "from-blue-900 to-blue-700",
  museum: "from-emerald-900 to-emerald-700",
  park: "from-green-900 to-green-700",
};

export default function SwipeCard({ place, onSwipe, active, stackIndex }: SwipeCardProps) {
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    startX.current = e.clientX;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || startX.current === null) return;
    setDx(e.clientX - startX.current);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      const dir = dx > 0 ? "right" : "left";
      setFlying(dir);
      setTimeout(() => {
        onSwipe(dir === "right" ? "like" : "skip");
        setDx(0);
        setFlying(null);
      }, 260);
    } else {
      setDx(0);
    }
    startX.current = null;
  };

  const rotate = flying
    ? flying === "right" ? 25 : -25
    : dx * 0.06;

  const translateX = flying
    ? flying === "right" ? "120vw" : "-120vw"
    : `${dx}px`;

  const likeOpacity = Math.min(Math.max(dx / SWIPE_THRESHOLD, 0), 1);
  const skipOpacity = Math.min(Math.max(-dx / SWIPE_THRESHOLD, 0), 1);

  const gradientClass = place.category && CATEGORY_COLORS[place.category]
    ? CATEGORY_COLORS[place.category]
    : "from-zinc-900 to-zinc-700";

  const scaleMap = [1, 0.95, 0.90];
  const yOffsetMap = [0, 12, 22];
  const scale = scaleMap[stackIndex] ?? 0.88;
  const yOffset = yOffsetMap[stackIndex] ?? 30;

  return (
    <div
      className="absolute inset-0 select-none cursor-grab active:cursor-grabbing touch-none"
      style={{
        zIndex: 10 - stackIndex,
        transform: active
          ? `translateX(${translateX}) rotate(${rotate}deg)`
          : `scale(${scale}) translateY(${yOffset}px)`,
        transition: flying || !active ? "transform 0.25s ease" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="h-full w-full rounded-3xl overflow-hidden shadow-2xl">
        {/* Background */}
        {place.photo_url ? (
          <img
            src={place.photo_url}
            alt={place.place_name}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br", gradientClass)} />
        )}

        {/* Dark overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Like overlay */}
        <div
          className="absolute inset-0 bg-green-500/30 rounded-3xl flex items-start justify-start p-6"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-300 font-black text-3xl border-4 border-green-300 rounded-xl px-3 py-1 rotate-[-12deg]">
            TAK!
          </span>
        </div>

        {/* Skip overlay */}
        <div
          className="absolute inset-0 bg-red-500/30 rounded-3xl flex items-start justify-end p-6"
          style={{ opacity: skipOpacity }}
        >
          <span className="text-red-300 font-black text-3xl border-4 border-red-300 rounded-xl px-3 py-1 rotate-[12deg]">
            NIE
          </span>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
          <p className="text-white font-black text-2xl leading-tight">{place.place_name}</p>
          <p className="text-white/70 text-sm">
            {[place.category, place.creator_handle].filter(Boolean).join(" · ")}
          </p>
          {place.description && (
            <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{place.description}</p>
          )}
          {place.instagram_reel_url && (
            <a
              href={place.instagram_reel_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-xs font-medium hover:bg-white/30 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Zobacz reel
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
