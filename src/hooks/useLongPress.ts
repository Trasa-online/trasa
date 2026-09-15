import { useCallback, useRef } from "react";
import { haptics } from "@/hooks/useHaptics";

// Przytrzymanie palcem = wejscie w tryb zaznaczania (2026-09-10).
//
// Wspolny prymityw, a nie kopiowany kod per ekran - tak samo jak useDragToDismiss
// i useSwipeNav (patrz CLAUDE.md, "Gesty natywne").
//
// Dwie rzeczy, ktore latwo tu zepsuc i ktore ten hook zalatwia:
//  - PRZEWIJANIE. Palec, ktory rusza w bok albo w gore, przewija liste, a nie zaznacza.
//    Ruch powyzej progu (10 px) kasuje odliczanie.
//  - MENU SYSTEMOWE. WKWebView na dlugie przytrzymanie pokazuje wlasne menu ("Kopiuj",
//    "Wyszukaj"). Blokujemy contextmenu na elemencie z gestem.
//
// Haptyka na starcie zaznaczenia jest czescia komunikatu: to jedyny sygnal, ze
// przytrzymanie w ogole cos zrobilo, zanim user zdazy podniesc palec.
//
// KONTROLKI WEWNATRZ obszaru z gestem musza sie wypisac atrybutem `data-no-longpress`.
// Bez tego tapniecie w guzik otwierajacy menu konczylo sie wejsciem w tryb zaznaczania:
// menu przejmowalo wskaznik, `pointerup` nie wracal do wiersza, odliczanie dochodzilo do
// konca i tryb zaznaczania chowal cala belke akcji razem z wlasnie otwartym menu
// (zlapane na tescie 2026-09-10).

const MOVE_TOLERANCE = 10;   // px - powyzej tego traktujemy gest jako przewijanie
const HOLD_MS = 420;         // krocej = przypadkowe wejscia przy zwyklym tapnieciu

export function useLongPress(onLongPress: (() => void) | undefined, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** Ustawiane, gdy gest wystrzelil - pozwala zjesc `click`, ktory przyjdzie po puszczeniu. */
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    origin.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled || !onLongPress) return;
    if ((e.target as HTMLElement | null)?.closest?.("[data-no-longpress]")) return;
    origin.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
    timer.current = setTimeout(() => {
      timer.current = null;
      fired.current = true;
      haptics.medium();
      onLongPress();
    }, HOLD_MS);
  }, [enabled, onLongPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const o = origin.current;
    if (!o || !timer.current) return;
    if (Math.abs(e.clientX - o.x) > MOVE_TOLERANCE || Math.abs(e.clientY - o.y) > MOVE_TOLERANCE) clear();
  }, [clear]);

  return {
    /** Czy ostatni gest byl przytrzymaniem - do zjedzenia nastepujacego po nim `click`. */
    didFire: () => fired.current,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => { if (enabled && onLongPress) e.preventDefault(); },
    },
  };
}
