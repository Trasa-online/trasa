import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { haptics } from "@/hooks/useHaptics";
import { isNative } from "@/lib/platform";

// Gest natywny: przeciagniecie od LEWEJ KRAWEDZI ekranu w prawo = cofniecie (jak w iOS).
// W WKWebView (Capacitor) systemowy gest wstecz nie istnieje dla tras SPA, wiec robimy go sami.
//
// Zasady (zeby nie gryzl sie z reszta gestow w apce):
// - start MUSI byc w strefie krawedzi (24 px) - poziome gesty w tresci (karty miejsc, karuzele,
//   zakladki na useSwipeNav) zaczynaja sie dalej i sa nietkniete,
// - ruch musi byc wyraznie poziomy i w PRAWO (kierunek "wracam"),
// - gdy otwarty jest modal (arkusz/dialog Radix ustawia pointer-events:none na body), gest jest
//   ignorowany - tam cofa sie gestem w dol albo krzyzykiem,
// - gdy nie ma historii W APLIKACJI (history.state.idx === 0, np. wejscie z deep-linka lub pusha)
//   nie robimy NIC. Zaden ekran zapasowy - user nie prosil o nawigacje, tylko o cofniecie.
const EDGE_PX = 24;      // strefa startu przy lewej krawedzi
const MIN_DX = 70;       // dystans, po ktorym uznajemy gest za cofniecie
const MAX_DURATION = 800; // ms - powyzej to raczej przeciaganie czegos, nie gest nawigacyjny

export function useEdgeSwipeBack(enabled = isNative) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; t: number } | null = null;

    const modalOpen = () =>
      document.body.style.pointerEvents === "none" ||
      !!document.querySelector('[data-state="open"][role="dialog"], [data-vaul-drawer]');

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      if (modalOpen()) return;
      const el = e.target as Element | null;
      if (el?.closest?.("[data-no-swipe]")) return;
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.t > MAX_DURATION) return;
      if (dx < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const idx = (window.history.state as { idx?: number } | null)?.idx;
      if (typeof idx !== "number" || idx <= 0) return; // nie ma dokad wracac
      haptics.light();
      navigate(-1);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", () => { start = null; }, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled, navigate]);
}
