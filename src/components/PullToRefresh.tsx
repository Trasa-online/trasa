import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

// Reuzywalny pull-to-refresh oparty o touch events (dziala w natywnym WebView
// iOS, gdzie natywny PTR przegladarki nie obejmuje wewnetrznych scrolli).
// Uzycie: owija scrollowalny kontener; onRefresh wywolywany po pociagnieciu w dol
// powyzej progu, gdy scroll jest na samej gorze.
//
// OD 2026-09-24 (prosba Nat) dziala TEZ W DRUGA STRONE: pociagniecie W GORE na samym
// DOLE listy odswieza tak samo. Powod jest praktyczny - w feedzie Eksploracji karta
// zajmuje caly ekran, wiec zeby odswiezyc "z gory" trzeba bylo najpierw przewinac cala
// liste z powrotem. Kto doszedl do konca, ten wlasnie chce zobaczyc, czy jest cos nowego.
const THRESHOLD = 70;
const MAX = 110;

export function PullToRefresh({
  onRefresh,
  className,
  children,
  onScroll,
  scrollRef,
  pullUp = true,
}: {
  onRefresh: () => Promise<void> | void;
  className?: string;
  children: ReactNode;
  /** Pozycja scrolla wewnetrznego kontenera (scroller jest tutaj, nie u rodzica). */
  onScroll?: (scrollTop: number) => void;
  /** Wystawia scrollowany element na zewnatrz - scroller jest TUTAJ, wiec bez tego
   *  rodzic nie ma czego podac np. do `useScrollRestore`. */
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** Odswiezanie takze pociagnieciem W GORE na koncu listy. Domyslnie wlaczone. */
  pullUp?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef) return;
    scrollRef.current = ref.current;
    return () => { scrollRef.current = null; };
  }, [scrollRef]);
  const startY = useRef<number | null>(null);
  const startX = useRef<number>(0);
  // Z KTOREGO konca wystartowal gest: "top" = mozliwy pull w dol, "bottom" = pull w gore.
  // Ustalane na touchstart, bo w trakcie gestu scrollTop juz sie zmienia.
  const edge = useRef<"top" | "bottom" | null>(null);
  // Kierunek gestu ustalany RAZ na gest: "v" pionowy (pull), "h" poziomy (scroll w
  // bok np. w "Najnowsze trasy" - wtedy NIE odpalamy pull), null = jeszcze nieznany.
  const lockDir = useRef<"v" | "h" | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Znak pociagniecia: 1 = od gory (spacer nad trescia), -1 = od dolu (spacer pod trescia).
  const [dirSign, setDirSign] = useState<1 | -1>(1);

  const atTop = () => (ref.current?.scrollTop ?? 0) <= 0;
  const atBottom = () => {
    const el = ref.current;
    if (!el) return false;
    // Zapas 2 px na subpiksele; lista krotsza niz ekran NIE liczy sie jako "koniec" -
    // inaczej na ekranie bez scrolla kazde machniecie w gore odswiezaloby widok.
    if (el.scrollHeight - el.clientHeight < 24) return false;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    lockDir.current = null;
    startX.current = e.touches[0].clientX;
    edge.current = atTop() ? "top" : pullUp && atBottom() ? "bottom" : null;
    startY.current = edge.current ? e.touches[0].clientY : null;
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
    if (edge.current === "top" && dy > 0 && atTop()) {
      setDirSign(1);
      setPull(Math.min(MAX, dy * 0.5)); // opor (resistance)
    } else if (edge.current === "bottom" && dy < 0 && atBottom()) {
      setDirSign(-1);
      setPull(Math.min(MAX, -dy * 0.5));
    } else {
      setPull(0);
    }
  };

  const onTouchEnd = async () => {
    if (startY.current === null) { setPull(0); return; }
    const reached = pull >= THRESHOLD;
    startY.current = null;
    lockDir.current = null;
    edge.current = null;
    if (reached && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  const settling = startY.current === null;
  const spinner = (
    <Loader2
      className={`h-5 w-5 text-primary ${dirSign === 1 ? "mb-2" : "mt-2"} ${refreshing ? "animate-spin" : ""}`}
      style={{
        opacity: Math.min(1, pull / THRESHOLD),
        transform: refreshing ? undefined : `rotate(${Math.round(pull * 3)}deg)`,
      }}
    />
  );

  return (
    <div
      ref={ref}
      // min-h-0: scroller jest flex-childem (flex-1) - bez tego rosnie do wysokosci
      // contentu i overflow-y:auto sie NIE wlacza (na native iOS = brak scrolla).
      // Glowny scroller ekranu - tapniecie w gorna belke przewija wlasnie ten element
      // (patrz src/lib/scrollTop.ts).
      data-scroll-main
      className={`min-h-0 ${className ?? ""}`}
      style={{ overflowY: "auto" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onScroll={onScroll ? (e) => onScroll((e.target as HTMLDivElement).scrollTop) : undefined}
    >
      <div
        className="flex items-end justify-center overflow-hidden shrink-0"
        style={{ height: dirSign === 1 ? pull : 0, transition: settling ? "height 0.2s ease" : "none" }}
      >
        {dirSign === 1 && pull > 0 && spinner}
      </div>
      {children}
      {/* Ten sam wskaznik pod trescia - dla pociagniecia od dolu. ⚠️ Element istnieje ZAWSZE
          (o zerowej wysokosci), bo dokladany dopiero w trakcie gestu zmienialby wysokosc
          zawartosci w chwili, gdy scroller stoi na samym koncu - i lista skakalaby pod palcem. */}
      <div
        className="flex items-start justify-center overflow-hidden shrink-0"
        style={{ height: dirSign === -1 ? pull : 0, transition: settling ? "height 0.2s ease" : "none" }}
      >
        {dirSign === -1 && pull > 0 && spinner}
      </div>
    </div>
  );
}
