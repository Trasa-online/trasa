import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";

/**
 * Gest natywny: przeciagniecie panelu (bottom sheet / drawer) w dol zamyka go.
 *
 * Uzycie w panelu recznie skladanym (fixed overlay + panel przy dolnej krawedzi):
 *   const { dragProps } = useDragToDismiss({ onDismiss: () => setOpen(false) });
 *   <div {...dragProps} className="... rounded-t-3xl">
 * Gdy panel ma wlasny inline style, scal go PO stylu z hooka:
 *   <div {...dragProps} style={{ ...dragProps.style, maxHeight: "82dvh" }}>
 *
 * Bottom sheety oparte o <SheetContent side="bottom"> maja ten gest wbudowany
 * (patrz src/components/ui/sheet.tsx) - tam nic nie trzeba dodawac.
 *
 * Zasady zeby gest nie gryzl sie ze scrollem i innymi gestami:
 * - startuje tylko gdy najblizszy scrollowalny rodzic jest na samej gorze (scrollTop <= 0),
 * - odpada gdy ruch jest poziomy (karuzele zdjec, pigulki zakladek) albo w gore,
 * - element z atrybutem data-no-drag (np. mapa, slider) blokuje gest w swoim poddrzewie.
 */
interface DragToDismissOptions {
  onDismiss: () => void;
  /** Wylacza gest (np. panel pelnoekranowy z wlasna obsluga). Domyslnie wlaczony. */
  enabled?: boolean;
  /** Dystans w px, po ktorym puszczenie palca zamyka panel. */
  threshold?: number;
}

const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

/** Czy gest moze wystartowac: brak data-no-drag po drodze + scroll na gorze. */
function canStartDrag(target: Element | null, root: Element): boolean {
  let el: Element | null = target;
  while (el && el !== root.parentElement) {
    if (el instanceof HTMLElement) {
      if (el.dataset.noDrag !== undefined) return false;
      const style = window.getComputedStyle(el);
      const scrollable = SCROLLABLE_OVERFLOW.has(style.overflowY) && el.scrollHeight - el.clientHeight > 2;
      if (scrollable) return el.scrollTop <= 0;
    }
    if (el === root) break;
    el = el.parentElement;
  }
  return true;
}

export function useDragToDismiss({ onDismiss, enabled = true, threshold = 96 }: DragToDismissOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Domykanie wlasna animacja: panel zjezdza w dol, dopiero potem unmount.
  const [closing, setClosing] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const engaged = useRef(false);
  const aborted = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  const onTouchStart = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    engaged.current = false;
    // Panel otwarty ponownie zanim domkniecie sie posprzatalo -> wroc na pozycje.
    if (closing) { timers.current.forEach(window.clearTimeout); timers.current = []; setClosing(false); setOffset(0); }
    if (!enabled || e.touches.length !== 1) { aborted.current = true; return; }
    aborted.current = !canStartDrag(e.target as Element, e.currentTarget);
    if (aborted.current) return;
    const touch = e.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, [enabled, closing]);

  const onTouchMove = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (aborted.current || !start.current) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (!engaged.current) {
      // Kierunek rozstrzygamy raz: w dol = zamykanie, w bok/w gore = oddajemy gest tresci.
      if (dy > 6 && dy > Math.abs(dx)) { engaged.current = true; setDragging(true); }
      else if (Math.abs(dx) > 8 || dy < -6) { aborted.current = true; return; }
      else return;
    }
    setOffset(Math.max(0, dy));
  }, []);

  const finish = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    const s = start.current;
    const wasEngaged = engaged.current;
    start.current = null;
    engaged.current = false;
    aborted.current = false;
    setDragging(false);
    if (!wasEngaged || !s) { setOffset(0); return; }

    const dy = (e.changedTouches[0]?.clientY ?? s.y) - s.y;
    const velocity = dy / Math.max(1, Date.now() - s.t); // px/ms
    const shouldClose = dy > threshold || (velocity > 0.5 && dy > 40);
    if (!shouldClose) { setOffset(0); return; }

    // Domykamy WLASNA animacja (panel zjezdza do dolu), dopiero potem unmount. Wazne:
    // `closing` wylacza CSS-owa animacje wyjscia (Radix `slide-out-to-bottom`) - inaczej
    // animacja nadpisalaby nasz transform, panel wracalby na chwile pod palec i dopiero
    // zjezdzal. Reset stanu jest opozniony (panel jest juz odmontowany), zeby przy ponownym
    // otwarciu arkusz nie startowal z pozycji "za ekranem".
    setClosing(true);
    setOffset(e.currentTarget.getBoundingClientRect().height + 48);
    timers.current.push(window.setTimeout(() => { onDismiss(); }, 190));
    timers.current.push(window.setTimeout(() => { setClosing(false); setOffset(0); }, 260));
  }, [onDismiss, threshold]);

  const style: CSSProperties = {
    transform: offset ? `translateY(${offset}px)` : undefined,
    transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
    // CSS-owe animacje (wejscie/wyjscie) maja w kaskadzie pierwszenstwo nad inline transform,
    // wiec na czas gestu i domykania je wylaczamy - inaczej panel "nie klei sie" do palca.
    animation: dragging || closing ? "none" : undefined,
    overscrollBehavior: "contain",
  };

  return {
    dragProps: { onTouchStart, onTouchMove, onTouchEnd: finish, onTouchCancel: finish, style },
    dragging,
    offset,
  };
}
