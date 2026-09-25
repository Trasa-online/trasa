import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

/**
 * PAGER ZAKLADEK jak w Instagramie (prosba Nat 2026-09-26): Eksploracja <-> Miejsca <-> Profil
 * stoja OBOK SIEBIE i przy przesuwaniu palcem widac od razu tresc sasiedniej zakladki.
 *
 * Zastapil `useTabSwipe` (ekran za palcem + wjazd nowego po puszczeniu), ktory pokazywal pusty
 * pas zamiast sasiada, bo sasiad montowal sie dopiero po nawigacji.
 *
 * Jak to dziala:
 *  - trzy trasy (/eksploruj, /miejsca, /moj-profil) to jedna TRASA-UKLAD w App.tsx, wiec ten
 *    komponent NIE odmontowuje sie przy przejsciu miedzy nimi - stan zakladek (scroll, filtry,
 *    zaladowane dane) przezywa przelaczanie, jak w natywnej apce,
 *  - przesuwanie to NATYWNY poziomy scroll ze snapem (`snap-x snap-mandatory`, `snap-always`):
 *    ped, gumka i blokada osi robi WebKit, a nie nasz JS - i dlatego to jest plynne,
 *  - adres trasy dopasowujemy PO zatrzymaniu (`replace`), a zmiana adresu z zewnatrz (dolny
 *    pasek, link, powiadomienie) przestawia pager bez animacji, jak tapniecie zakladki w IG,
 *  - w trakcie ruchu panele dostaja zaokraglone rogi, a miedzy nimi widac odstep (wzor z IG).
 *
 * ⚠️ Montujemy aktywny panel ORAZ jego sasiadow - inaczej przy przesuwaniu nie byloby czego
 * pokazac. Panel raz zamontowany zostaje (powrot jest natychmiastowy).
 * ⚠️ Nieaktywne panele maja `data-tab-panel="inactive"`: `scrollMainToTop` i podobne helpery,
 * ktore szukaja scrollera w DOM, musza je pomijac - sa na ekranie w sensie layoutu.
 * ⚠️ Zagniezdzone zakladki profilu (Plany | Kolekcje) blokuja pager `touch-action: pan-y`,
 * dopoki nie stoja na „Plany" - patrz TravelerProfile.
 */
export const TAB_ORDER = ["/eksploruj", "/miejsca", "/moj-profil"] as const;

const Explore = lazy(() => import("@/pages/Explore"));
const Miejsca = lazy(() => import("@/pages/Miejsca"));
const TravelerProfile = lazy(() => import("@/pages/TravelerProfile"));
const PANELS = [Explore, Miejsca, TravelerProfile];
const GAP = 8;

export const tabIndexOf = (path: string) => TAB_ORDER.findIndex((p) => path === p || path.startsWith(`${p}/`));

export default function TabsPager() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const idx = Math.max(0, tabIndexOf(pathname));
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([idx - 1, idx, idx + 1].filter((i) => i >= 0 && i < PANELS.length)));
  const [moving, setMoving] = useState(false);
  // Otwarta wyszukiwarka (Eksploracja, Miejsca, Profil) to osobny tryb z wlasna strzalka
  // „wstecz" i schowanym dolnym paskiem. Na ten czas pager stoi - inaczej mozna by odjechac
  // na inna zakladke, zostawiajac szukanie otwarte w tle i pasek schowany. Sygnal to ten sam
  // event, ktorym ekrany chowaja dolny pasek.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setLocked(!!(e as CustomEvent).detail);
    window.addEventListener("trasa:hide-bottomnav", h);
    return () => window.removeEventListener("trasa:hide-bottomnav", h);
  }, []);
  // Zmiana zakladki zawsze zdejmuje blokade (ekran, ktory ja nalozyl, jest juz w tle).
  useEffect(() => { setLocked(false); }, [idx]);
  const programmatic = useRef(false);
  const settleTimer = useRef<number | null>(null);

  const step = () => (ref.current?.clientWidth ?? window.innerWidth) + GAP;

  // Aktywny + sasiedzi zawsze zamontowani.
  useEffect(() => {
    setMounted((prev) => {
      const need = [idx - 1, idx, idx + 1].filter((i) => i >= 0 && i < PANELS.length && !prev.has(i));
      if (!need.length) return prev;
      const next = new Set(prev); need.forEach((i) => next.add(i)); return next;
    });
  }, [idx]);

  // Adres zmienil sie z zewnatrz (dolny pasek, link) -> przestaw pager bez animacji. Gdy zmiana
  // przyszla z przesuniecia palcem, pager juz tam stoi i nic sie nie dzieje.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = idx * step();
    if (Math.abs(el.scrollLeft - target) < 2) return;
    programmatic.current = true;
    el.scrollTo({ left: target, behavior: "auto" });
    window.setTimeout(() => { programmatic.current = false; }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMoving(false);
    const i = Math.round(el.scrollLeft / step());
    if (i !== idx && TAB_ORDER[i]) {
      haptics.selection();
      navigate(TAB_ORDER[i], { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, navigate]);

  const onScroll = () => {
    if (programmatic.current) return;
    if (!moving) setMoving(true);
    // `scrollend` nie wszedzie jest dostepny - zatrzymanie wykrywamy cisza w zdarzeniach.
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 90);
  };
  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  return (
    <div
      ref={ref}
      data-tabs-pager
      onScroll={onScroll}
      className={cn(
        "flex-1 min-h-0 flex overflow-y-hidden snap-x snap-mandatory overscroll-x-contain scrollbar-none bg-[#E9E6E1]",
        locked ? "overflow-x-hidden" : "overflow-x-auto",
      )}
      style={{ gap: GAP, WebkitOverflowScrolling: "touch", touchAction: locked ? "pan-y" : undefined }}
    >
      {PANELS.map((Panel, i) => (
        <section
          key={TAB_ORDER[i]}
          data-tab-panel={i === idx ? "active" : "inactive"}
          aria-hidden={i !== idx}
          className={cn(
            "relative w-full shrink-0 snap-start snap-always flex flex-col min-h-0 bg-background",
            // Zaokraglenie TYLKO w ruchu: w spoczynku panel wypelnia ekran krawedz w krawedz.
            moving && "rounded-[28px] overflow-hidden",
          )}
        >
          {mounted.has(i) && (
            <Suspense fallback={<div className="flex-1" />}>
              <Panel />
            </Suspense>
          )}
        </section>
      ))}
    </div>
  );
}
