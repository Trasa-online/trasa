import { useState, useRef, useCallback } from "react";
import { Check, X, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanPin } from "./DayPinList";

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", bar: "🍺", viewpoint: "🌅",
  museum: "🏛️", park: "🌿", shopping: "🛍️", gallery: "🖼️",
  monument: "🏰", nightlife: "🌙", church: "⛪", walk: "🚶",
  market: "🏪", transport: "🚉",
};

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", bar: "Bar",
  viewpoint: "Widok", museum: "Muzeum", park: "Park",
  shopping: "Zakupy", gallery: "Galeria", monument: "Zabytek",
  nightlife: "Nocne życie", church: "Kościół", walk: "Spacer",
  market: "Targ", transport: "Transport",
};

interface FlatPin extends PlanPin {
  _dayNumber: number;
  _originalIdx: number;
}

interface PlaceSwiperProps {
  days: { day_number: number; pins: PlanPin[] }[];
  totalDays: number;
  onFinish: (keptDays: { day_number: number; pins: PlanPin[] }[]) => void;
}

const SWIPE_THRESHOLD = 80;
const ROTATION_FACTOR = 0.12;

export default function PlaceSwiper({ days, totalDays, onFinish }: PlaceSwiperProps) {
  // Flatten all pins preserving day info
  const allPins: FlatPin[] = days.flatMap(d =>
    d.pins.map((p, i) => ({ ...p, _dayNumber: d.day_number, _originalIdx: i }))
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"left" | "right" | null>(null);

  const startXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const done = currentIdx >= allPins.length;

  const advance = useCallback((keep: boolean) => {
    setFlyDirection(keep ? "right" : "left");
    if (keep) {
      setKept(prev => new Set([...prev, currentIdx]));
    } else {
      setRemoved(prev => new Set([...prev, currentIdx]));
    }
    setTimeout(() => {
      setCurrentIdx(i => i + 1);
      setDragX(0);
      setFlyDirection(null);
    }, 280);
  }, [currentIdx]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragX(e.clientX - startXRef.current);
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      advance(dragX > 0);
    } else {
      setDragX(0);
    }
  }, [isDragging, dragX, advance]);

  const handleFinish = () => {
    // Reconstruct days with only kept pins
    const keptDays = days.map(d => ({
      day_number: d.day_number,
      pins: d.pins.filter((_, i) => {
        const flatIdx = allPins.findIndex(p => p._dayNumber === d.day_number && p._originalIdx === i);
        return flatIdx === -1 || !removed.has(flatIdx);
      }),
    })).filter(d => d.pins.length > 0);
    onFinish(keptDays);
  };

  // Summary screen
  if (done) {
    const keptCount = allPins.length - removed.size;
    return (
      <div className="px-5 py-6 flex flex-col items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">Plan gotowy!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Wybrałeś/aś <span className="font-semibold text-foreground">{keptCount}</span> z {allPins.length} miejsc
          </p>
        </div>
        <button
          onClick={handleFinish}
          className="w-full py-3.5 rounded-xl bg-foreground text-background text-sm font-semibold"
        >
          Zapisz mój plan →
        </button>
        <button
          onClick={() => { setCurrentIdx(0); setKept(new Set()); setRemoved(new Set()); }}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Zacznij od nowa
        </button>
      </div>
    );
  }

  const current = allPins[currentIdx];
  const next = allPins[currentIdx + 1];
  const nextNext = allPins[currentIdx + 2];

  const rotation = dragX * ROTATION_FACTOR;
  const isGoingRight = dragX > SWIPE_THRESHOLD / 2;
  const isGoingLeft = dragX < -SWIPE_THRESHOLD / 2;

  const flyTransform = flyDirection === "right"
    ? "translateX(120%) rotate(20deg)"
    : flyDirection === "left"
    ? "translateX(-120%) rotate(-20deg)"
    : null;

  return (
    <div className="px-5 py-4">
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {currentIdx + 1} z {allPins.length} miejsc
          {totalDays > 1 && (
            <span className="ml-2 text-orange-500 font-medium">
              · Dzień {current._dayNumber}
            </span>
          )}
        </p>
        <div className="flex gap-1">
          {allPins.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i < currentIdx
                  ? removed.has(i) ? "bg-muted w-1" : "bg-emerald-500 w-2"
                  : i === currentIdx ? "bg-orange-500 w-3" : "bg-muted w-1"
              )}
            />
          ))}
        </div>
      </div>

      {/* Card stack */}
      <div className="relative h-72 select-none">
        {/* 3rd card (background) */}
        {nextNext && (
          <div
            className="absolute inset-x-0 top-3 rounded-2xl bg-card border border-border/50 h-64 pointer-events-none"
            style={{ transform: "scale(0.92)", opacity: 0.5 }}
          />
        )}
        {/* 2nd card */}
        {next && (
          <div
            className="absolute inset-x-0 top-1.5 rounded-2xl bg-card border border-border/50 h-64 pointer-events-none"
            style={{ transform: "scale(0.96)", opacity: 0.75 }}
          />
        )}
        {/* Top card — draggable */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-x-0 top-0 h-64 rounded-2xl bg-card border border-border/50 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
          style={{
            transform: flyTransform ?? `translateX(${dragX}px) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.28s ease",
            zIndex: 10,
          }}
        >
          {/* Photo or gradient background */}
          <div className="absolute inset-0">
            {current.photoUrl ? (
              <img src={current.photoUrl} alt={current.place_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-500/10 via-background to-violet-500/10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>

          {/* Keep overlay */}
          <div
            className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center transition-opacity rounded-2xl"
            style={{ opacity: isGoingRight ? Math.min((dragX - SWIPE_THRESHOLD / 2) / 60, 1) : 0 }}
          >
            <div className="border-4 border-emerald-400 rounded-xl px-4 py-2 rotate-[-15deg]">
              <p className="text-emerald-400 font-black text-2xl tracking-wider">ZOSTAJE</p>
            </div>
          </div>
          {/* Remove overlay */}
          <div
            className="absolute inset-0 bg-red-500/30 flex items-center justify-center transition-opacity rounded-2xl"
            style={{ opacity: isGoingLeft ? Math.min((-dragX - SWIPE_THRESHOLD / 2) / 60, 1) : 0 }}
          >
            <div className="border-4 border-red-400 rounded-xl px-4 py-2 rotate-[15deg]">
              <p className="text-red-400 font-black text-2xl tracking-wider">POMIJAM</p>
            </div>
          </div>

          {/* Category badge — top left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="text-sm">{CATEGORY_ICONS[current.category] ?? "📍"}</span>
            <span className="text-white text-xs font-medium">
              {CATEGORY_LABELS[current.category] ?? current.category}
            </span>
          </div>

          {/* Time — top right */}
          {current.suggested_time && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
              <Clock className="h-3 w-3 text-white/80" />
              <span className="text-white text-xs">{current.suggested_time}</span>
            </div>
          )}

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white font-bold text-lg leading-tight">{current.place_name}</p>
            {current.address && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-white/60 shrink-0" />
                <p className="text-white/70 text-xs truncate">{current.address}</p>
              </div>
            )}
            {current.description && (
              <p className="text-white/80 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                {current.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 mt-4">
        <button
          onClick={() => advance(false)}
          disabled={!!flyDirection}
          className="h-14 w-14 rounded-full border-2 border-red-400/50 bg-card flex items-center justify-center active:scale-90 transition-transform shadow-sm"
        >
          <X className="h-6 w-6 text-red-400" />
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Przeciągnij lub<br />użyj przycisków
        </p>
        <button
          onClick={() => advance(true)}
          disabled={!!flyDirection}
          className="h-14 w-14 rounded-full border-2 border-emerald-400/50 bg-card flex items-center justify-center active:scale-90 transition-transform shadow-sm"
        >
          <Check className="h-6 w-6 text-emerald-400" />
        </button>
      </div>
    </div>
  );
}
