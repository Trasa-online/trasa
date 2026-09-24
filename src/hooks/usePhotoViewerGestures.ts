import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { haptics } from "@/hooks/useHaptics";

/**
 * Gesty pelnoekranowego podgladu zdjecia (galeria wyjazdu, zdjecia przy miejscu, kolekcja).
 *
 * - w BOK = poprzednie / nastepne zdjecie (jak dotad, przez `useSwipeNav`),
 * - w DOL = ZAMKNIECIE podgladu (prosba Nat 2026-09-24). Zdjecie idzie ZA PALCEM i po drodze
 *   gasnie tlo - tak samo, jak zamyka sie arkusz (`useDragToDismiss`). Sam prog bez ruchu
 *   zdjecia dawalby wrazenie, ze gest "nie lapie".
 *
 * Dlaczego OSOBNY hook, a nie zlozenie tamtych dwoch: oba zwracaja wlasne `onTouch*`, wiec
 * przy rozlozeniu obu na jednym elemencie drugi zestaw po cichu nadpisuje pierwszy (JSX to
 * zwykly obiekt propsow). Kierunek rozstrzygamy tu RAZ na gest i dopiero on decyduje, ktora
 * z dwoch rzeczy sie dzieje.
 *
 * ⚠️ `onClickCapture` zjada klikniecie po gescie: podglad zamyka sie tapnieciem w tlo, wiec
 * bez tego przeciagniecie zakonczone powrotem na miejsce i tak by go zamknelo.
 */
interface PhotoViewerGestureOptions {
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** Dystans w px do zamkniecia. */
  threshold?: number;
}

export function usePhotoViewerGestures({ onClose, onNext, onPrev, threshold = 110 }: PhotoViewerGestureOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const dir = useRef<"v" | "h" | null>(null);
  const moved = useRef(false);
  const aborted = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  const onTouchStart = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    dir.current = null;
    moved.current = false;
    if (e.touches.length !== 1 || closing) { aborted.current = true; return; }
    aborted.current = false;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, [closing]);

  const onTouchMove = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (aborted.current || !start.current) return;
    if (e.touches.length > 1) { aborted.current = true; setDragging(false); setOffset(0); return; } // pinch/zoom oddajemy zdjeciu
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
    if (dir.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      dir.current = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
      if (dir.current === "v") setDragging(true);
    }
    // W GORE nie zamykamy (to nie jest gest zamkniecia), ale pozwalamy zdjeciu drgnac
    // symbolicznie - inaczej pociagniecie w gore wyglada jak zawieszony ekran.
    if (dir.current === "v") setOffset(dy > 0 ? dy : dy / 5);
  }, []);

  const finish = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    const s = start.current;
    const d = dir.current;
    start.current = null;
    dir.current = null;
    const wasAborted = aborted.current;
    aborted.current = false;
    setDragging(false);
    if (wasAborted || !s) { setOffset(0); return; }

    const last = e.changedTouches[0];
    const dx = (last?.clientX ?? s.x) - s.x;
    const dy = (last?.clientY ?? s.y) - s.y;

    if (d === "h") {
      setOffset(0);
      if (Math.abs(dx) < 55) return;
      const handler = dx < 0 ? onNext : onPrev;
      if (!handler) return;
      haptics.selection();
      handler();
      return;
    }
    if (d !== "v") { setOffset(0); return; }

    const velocity = dy / Math.max(1, Date.now() - s.t); // px/ms
    if (!(dy > threshold || (velocity > 0.5 && dy > 40))) { setOffset(0); return; }
    // Domykamy wlasna animacja: zdjecie zjezdza poza ekran, dopiero potem unmount.
    setClosing(true);
    haptics.light();
    setOffset(window.innerHeight);
    timers.current.push(window.setTimeout(() => onClose(), 190));
    timers.current.push(window.setTimeout(() => { setClosing(false); setOffset(0); }, 260));
  }, [onClose, onNext, onPrev, threshold]);

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!moved.current) return;
    moved.current = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // Tlo gasnie proporcjonalnie do przesuniecia - to ono niesie informacje "puszczasz i zamykam".
  const fade = Math.min(1, Math.max(0, Math.abs(offset) / (threshold * 2.4)));
  const style: CSSProperties = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), background-color 220ms",
    animation: dragging || closing ? "none" : undefined,
    backgroundColor: `rgba(0,0,0,${(1 - fade * 0.85).toFixed(3)})`,
    touchAction: "none",
  };

  return { bind: { onTouchStart, onTouchMove, onTouchEnd: finish, onTouchCancel: finish, onClickCapture, style }, dragging, offset };
}
