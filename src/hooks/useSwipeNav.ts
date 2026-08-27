import { useCallback, useRef, type TouchEvent as ReactTouchEvent } from "react";
import { haptics } from "@/hooks/useHaptics";

/**
 * Gest natywny: przeciagniecie w lewo/prawo przelacza zakladke, krok albo zdjecie.
 *
 * Uzycie:
 *   const swipe = useSwipeNav({ onLeft: nextTab, onRight: prevTab });
 *   <div {...swipe}>...</div>
 * Konwencja iOS: przeciagniecie w LEWO idzie DALEJ (nastepna zakladka/zdjecie),
 * w PRAWO wraca. Kolejnosc zakladek = kolejnosc na pigulkach.
 *
 * Zabezpieczenia przed kolizja z innymi gestami:
 * - gest odpada gdy ruch jest bardziej pionowy niz poziomy (zwykly scroll listy),
 * - poddrzewo z atrybutem data-no-swipe jest wylaczone (mapa, karuzela zdjec, karta swipera),
 * - kontener scrollowany poziomo (pigulki, karuzele) przejmuje gest dla siebie,
 * - multi-touch (pinch/zoom) przerywa gest.
 */
interface SwipeNavOptions {
  /** Przeciagniecie w lewo (palec -> lewo), czyli "dalej". */
  onLeft?: () => void;
  /** Przeciagniecie w prawo, czyli "wstecz". */
  onRight?: () => void;
  enabled?: boolean;
  /** Minimalny dystans w px. Domyslnie 55 (wygodne kciukiem, odporne na drgania). */
  threshold?: number;
  /** Haptyczny "tick" przy przelaczeniu. Domyslnie wlaczony. */
  haptic?: boolean;
}

/** Czy gest moze wystartowac: brak data-no-swipe i brak poziomego scrolla po drodze. */
function canStartSwipe(target: Element | null, root: Element): boolean {
  let el: Element | null = target;
  while (el && el !== root.parentElement) {
    if (el instanceof HTMLElement) {
      if (el.dataset.noSwipe !== undefined) return false;
      const style = window.getComputedStyle(el);
      const scrollsX = (style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth - el.clientWidth > 2;
      if (scrollsX) return false;
    }
    if (el === root) break;
    el = el.parentElement;
  }
  return true;
}

export function useSwipeNav({ onLeft, onRight, enabled = true, threshold = 55, haptic = true }: SwipeNavOptions) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const aborted = useRef(false);

  const onTouchStart = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (!enabled || e.touches.length !== 1) { aborted.current = true; return; }
    aborted.current = !canStartSwipe(e.target as Element, e.currentTarget);
    if (aborted.current) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [enabled]);

  const onTouchMove = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (e.touches.length > 1) aborted.current = true; // pinch -> nie nawigujemy
  }, []);

  const onTouchEnd = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    const wasAborted = aborted.current;
    aborted.current = false;
    if (wasAborted || !s) return;

    const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x;
    const dy = (e.changedTouches[0]?.clientY ?? s.y) - s.y;
    // Poziom musi wyraznie wygrac z pionem, inaczej to scroll tresci.
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const handler = dx < 0 ? onLeft : onRight;
    if (!handler) return;
    if (haptic) haptics.selection();
    handler();
  }, [onLeft, onRight, threshold, haptic]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
