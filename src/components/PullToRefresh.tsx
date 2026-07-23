import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

// Reuzywalny pull-to-refresh oparty o touch events (dziala w natywnym WebView
// iOS, gdzie natywny PTR przegladarki nie obejmuje wewnetrznych scrolli).
// Uzycie: owija scrollowalny kontener; onRefresh wywolywany po pociagnieciu w dol
// powyzej progu, gdy scroll jest na samej gorze.
const THRESHOLD = 70;
const MAX = 110;

export function PullToRefresh({
  onRefresh,
  className,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const startX = useRef<number>(0);
  // Kierunek gestu ustalany RAZ na gest: "v" pionowy (pull), "h" poziomy (scroll w
  // bok np. w "Najnowsze trasy" - wtedy NIE odpalamy pull), null = jeszcze nieznany.
  const lockDir = useRef<"v" | "h" | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    lockDir.current = null;
    startX.current = e.touches[0].clientX;
    startY.current = (ref.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    const dx = e.touches[0].clientX - startX.current;
    // Ustal kierunek gdy ruch przekroczy maly prog; potem zablokuj na caly gest.
    if (lockDir.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockDir.current = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
      } else {
        return;
      }
    }
    if (lockDir.current !== "v") { setPull(0); return; } // gest poziomy -> nie ruszamy
    if (dy > 0 && (ref.current?.scrollTop ?? 0) <= 0) {
      setPull(Math.min(MAX, dy * 0.5)); // opor (resistance)
    } else {
      setPull(0);
    }
  };

  const onTouchEnd = async () => {
    if (startY.current === null) { setPull(0); return; }
    const reached = pull >= THRESHOLD;
    startY.current = null;
    lockDir.current = null;
    if (reached && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  const settling = startY.current === null;

  return (
    <div
      ref={ref}
      // min-h-0: scroller jest flex-childem (flex-1) - bez tego rosnie do wysokosci
      // contentu i overflow-y:auto sie NIE wlacza (na native iOS = brak scrolla).
      className={`min-h-0 ${className ?? ""}`}
      style={{ overflowY: "auto" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-end justify-center overflow-hidden shrink-0"
        style={{ height: pull, transition: settling ? "height 0.2s ease" : "none" }}
      >
        {pull > 0 && (
          <Loader2
            className={`h-5 w-5 text-primary mb-2 ${refreshing ? "animate-spin" : ""}`}
            style={{
              opacity: Math.min(1, pull / THRESHOLD),
              transform: refreshing ? undefined : `rotate(${Math.round(pull * 3)}deg)`,
            }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
