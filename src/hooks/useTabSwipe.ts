import { useEffect, useLayoutEffect, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { haptics } from "@/hooks/useHaptics";
import { canStartSwipe } from "@/hooks/useSwipeNav";

/**
 * PRZESUWANIE MIEDZY ZAKLADKAMI Eksploracja <-> Miejsca <-> Profil (prosba Nat 2026-09-25):
 * user ma czuc, ze przesuwa sie z jednego ekranu na drugi, a nie laduje w innym widoku.
 *
 * Wariant wybrany przez Nat: EKRAN IDZIE ZA PALCEM, a po puszczeniu nastepny WJEZDZA Z BOKU.
 * Swiadomie NIE pelny pager (trzy ekrany zamontowane obok siebie): kazda trasa ma wlasny
 * AppLayout, a Miejsca maja zamrozony sizing karty 9:16 - trzymanie wszystkich zakladek
 * w pamieci wymagaloby przebudowy nawigacji i kosztowaloby baterie.
 *
 * Jak to dziala:
 *  - gest lapiemy na <main> AppLayoutu (natywne listenery, `touchmove` NIEpasywny - po
 *    rozpoznaniu ruchu w bok gasimy pionowy scroll, inaczej feed jechalby razem z palcem),
 *  - transform piszemy prosto w styl elementu (bez setState co klatke),
 *  - po przekroczeniu progu ekran wyjezdza, a kierunek wjazdu nastepnego zapisujemy w PAMIECI
 *    MODULU - nowa trasa montuje NOWY AppLayout i dopiero on odgrywa wjazd (`useTabEnter`).
 *
 * Kolizje (nie usuwaj):
 *  - lewa krawedz (24 px) nalezy do cofania gestem (`useEdgeSwipeBack`),
 *  - otwarty arkusz / dialog - gest nalezy do niego,
 *  - `data-no-swipe` i poziome scrollery (pigulki, karuzele) - jak w `useSwipeNav`,
 *  - ZAGNIEZDZONE ZAKLADKI (profil: Plany | Kolekcje): kontener z `data-tab-pager` mowi
 *    atrybutami `data-pager-start` / `data-pager-end`, czy stoi na skraju. Dopoki nie stoi,
 *    gest w danym kierunku nalezy do wewnetrznych zakladek (wybor Nat: jak w Instagramie).
 */
export const TAB_ORDER = ["/eksploruj", "/miejsca", "/moj-profil"] as const;

// Kierunek, z ktorego ma wjechac NASTEPNY ekran. Zyje miedzy odmontowaniem jednego AppLayoutu
// a zamontowaniem kolejnego, wiec musi siedziec poza Reactem.
let pendingEnter: { path: string; from: "left" | "right"; full: boolean } | null = null;
let lastTabPath: string | null = null;

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const EDGE_PX = 24;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const tabIndex = (path: string) => TAB_ORDER.findIndex((p) => path === p || path.startsWith(`${p}/`));

const modalOpen = () =>
  document.body.style.pointerEvents === "none" ||
  !!document.querySelector('[data-state="open"][role="dialog"], [data-vaul-drawer]');

/** Czy wewnetrzne zakladki chca ten gest dla siebie (dx > 0 = palec w prawo = poprzednia). */
function innerPagerTakes(target: Element | null, dx: number): boolean {
  const pager = target?.closest?.("[data-tab-pager]") as HTMLElement | null;
  if (!pager) return false;
  return dx > 0 ? pager.dataset.pagerStart !== "true" : pager.dataset.pagerEnd !== "true";
}

export function useTabSwipe(mainRef: RefObject<HTMLElement>, pathname: string) {
  const navigate = useNavigate();
  const idx = tabIndex(pathname);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || idx < 0) return;

    let start: { x: number; y: number; t: number; target: Element | null } | null = null;
    let lock: "h" | "v" | null = null;
    let target: string | null = null;
    let moved = false;
    let leaving = false;

    const setX = (x: number, animate: boolean) => {
      el.style.transition = animate ? `transform 220ms ${EASE}` : "none";
      el.style.transform = x ? `translateX(${x}px)` : "";
    };

    const onStart = (e: TouchEvent) => {
      start = null; lock = null; target = null; moved = false;
      if (leaving || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE_PX || modalOpen()) return;
      if (!canStartSwipe(e.target as Element, el)) return;
      start = { x: t.clientX, y: t.clientY, t: Date.now(), target: e.target as Element };
    };

    const onMove = (e: TouchEvent) => {
      if (!start || lock === "v") return;
      if (e.touches.length > 1) { start = null; setX(0, true); return; }
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (lock === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        // Wyrazna przewaga poziomu - lekko ukosny ruch przy przewijaniu feedu to nadal pion.
        if (Math.abs(dx) < Math.abs(dy) * 1.3 || innerPagerTakes(start.target, dx)) { lock = "v"; return; }
        lock = "h";
        const next = idx + (dx < 0 ? 1 : -1);
        target = TAB_ORDER[next] ?? null;
      }
      e.preventDefault();
      moved = true;
      // Brak sasiada w tym kierunku = opor (ekran drga, ale nie ucieka) - jak w natywnym pagerze.
      const wantsNext = dx < 0;
      const exists = TAB_ORDER[idx + (wantsNext ? 1 : -1)] !== undefined;
      setX(exists ? dx : dx / 4, false);
    };

    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s || lock !== "h") return;
      const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x;
      const next = TAB_ORDER[idx + (dx < 0 ? 1 : -1)];
      const velocity = Math.abs(dx) / Math.max(1, Date.now() - s.t);
      const width = el.getBoundingClientRect().width || window.innerWidth;
      if (!next || !(Math.abs(dx) > width * 0.28 || (velocity > 0.45 && Math.abs(dx) > 40))) {
        setX(0, true);
        return;
      }
      leaving = true;
      haptics.selection();
      const out = dx < 0 ? -width : width;
      if (reducedMotion()) { navigate(next, { replace: true }); return; }
      setX(out, true);
      // Nowy ekran wjezdza z przeciwnej strony niz wyjechal stary.
      pendingEnter = { path: next, from: dx < 0 ? "right" : "left", full: true };
      window.setTimeout(() => navigate(next, { replace: true }), 190);
    };

    const onCancel = () => { if (lock === "h") setX(0, true); start = null; lock = null; };

    // Przeciagniecie w bok zakonczone nad kafelkiem nie moze go jeszcze otworzyc.
    const onClickCapture = (e: MouseEvent) => {
      if (!moved) return;
      moved = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      el.removeEventListener("click", onClickCapture, true);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [mainRef, idx, navigate]);
}

/**
 * Wjazd ekranu zakladki. Po gescie - pelny przejazd z boku (kontynuacja ruchu palca). Po
 * tapnieciu w dolny pasek - ten sam kierunek, ale krotszy (30 % + wygaszenie): stary ekran
 * znika wtedy od razu, wiec pelny przejazd przez pusty ekran wygladalby jak mrugniecie.
 * Kierunek wynika z kolejnosci zakladek, wiec pasek i gest opowiadaja te sama geografie.
 */
export function useTabEnter(mainRef: RefObject<HTMLElement>, pathname: string) {
  useLayoutEffect(() => {
    const el = mainRef.current;
    const idx = tabIndex(pathname);
    if (idx < 0) { lastTabPath = null; return; }
    const prev = lastTabPath;
    lastTabPath = TAB_ORDER[idx];
    let enter = pendingEnter && pendingEnter.path === TAB_ORDER[idx] ? pendingEnter : null;
    pendingEnter = null;
    if (!enter && prev && prev !== TAB_ORDER[idx]) {
      const prevIdx = tabIndex(prev);
      enter = { path: TAB_ORDER[idx], from: prevIdx < idx ? "right" : "left", full: false };
    }
    if (!el || !enter || reducedMotion() || typeof el.animate !== "function") return;
    const sign = enter.from === "right" ? 1 : -1;
    const frames = enter.full
      ? [{ transform: `translateX(${sign * 100}%)` }, { transform: "translateX(0)" }]
      : [{ transform: `translateX(${sign * 30}%)`, opacity: 0.35 }, { transform: "translateX(0)", opacity: 1 }];
    // WAAPI bez `fill` - po animacji transform znika calkiem, wiec elementy `fixed` w ekranie
    // znowu licza sie od viewportu, a nie od przesunietego <main>.
    el.animate(frames, { duration: enter.full ? 280 : 240, easing: EASE });
  }, [mainRef, pathname]);
}
