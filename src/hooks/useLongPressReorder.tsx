import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { haptics } from "@/hooks/useHaptics";

// "Przytrzymaj i przestaw" - zmiana kolejnosci kafelkow palcem (prosba Nat 2026-09-11).
//
// Wspolny prymityw, jak useLongPress / useSwipeNav (CLAUDE.md, "Gesty natywne"). Hook nie
// wie nic o tresci kafelka: dostaje liste id, oddaje handlery na opakowanie kazdego kafelka
// i ZYWA kolejnosc podczas przeciagania; po puszczeniu wola onReorder z nowa kolejnoscia.
//
// Jak to dziala i dlaczego wlasnie tak:
//  - START = przytrzymanie (420 ms) bez ruchu. Palec, ktory rusza wczesniej, przewija liste
//    jak zawsze - tak samo jak w useLongPress.
//  - PO STARCIE trzeba odebrac przegladarce przewijanie. `touch-action` nie da sie zmienic
//    w trakcie gestu, a Reactowe onTouchMove jest pasywne, wiec na czas przeciagania wisi
//    na dokumencie NIEpasywny `touchmove` z preventDefault (tak samo robi dnd-kit).
//  - "DUCH" kafelka to klon DOM w portalu (position: fixed) - kafelek w siatce zostaje
//    na miejscu, przygaszony, i wyznacza slot. Zaden kafelek w siatce nie dostaje transformu
//    na stale: WebKit nie maluje drugiej kolumny CSS multicol, gdy w srodku sa warstwy
//    kompozytowane (zlapane w ExploreGrid), a mozaika profilu to wlasnie multicol.
//  - Sasiedzi przesuwaja sie animacja FLIP przez Web Animations API (krotki transform, po
//    ktorym warstwa znika) - stad plynne "rozsuwanie" bez recznego sprzatania stylow.
//  - Wspolrzedne kafelkow trzymamy w ukladzie STRONY (z doliczonym scrollem), wiec
//    autoprzewijanie przy krawedzi ekranu nie uniewaznia pomiarow.
//  - `click`, ktory przychodzi po puszczeniu palca, jest zjadany (na kontenerze - po drag
//    and drop klik laduje na wspolnym przodku kafelka startowego i koncowego, nie na
//    kafelku). `touchend` jest zatrzymywany, zeby useSwipeNav na rodzicu nie wzial
//    przeciagniecia w bok za zmiane zakladki.
//
// Kontrolki w kafelku, ktore nie maja startowac gestu, dostaja `data-no-longpress`.

const HOLD_MS = 420;
const MOVE_TOLERANCE = 10;   // px - wiecej przed uplywem czasu = to byl scroll, nie przytrzymanie
const EDGE_PX = 80;          // strefa autoprzewijania przy gornej/dolnej krawedzi widoku
const EDGE_MAX_SPEED = 16;   // px na klatke przy samej krawedzi
const FLIP_MS = 180;
const SETTLE_MS = 160;

/** Klasa na opakowanie kafelka: bez menu systemowego i bez natywnego "podnoszenia" obrazka. */
export const REORDER_ITEM_CLASS = "select-none [-webkit-touch-callout:none] [-webkit-user-drag:none]";

type PageRect = { left: number; top: number; width: number; height: number };

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Najblizszy przodek, ktory przewija w pionie; brak = przewija okno. */
function findScroller(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const s = window.getComputedStyle(node);
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 2) return node;
    node = node.parentElement;
  }
  return null;
}

export function useLongPressReorder<T extends string>({ ids, onReorder, enabled = true }: {
  /** Kolejnosc "z zewnatrz" (z bazy). Hook synchronizuje sie z nia, gdy nic nie jest przeciagane. */
  ids: T[];
  /** Wolane po puszczeniu, tylko gdy kolejnosc sie zmienila. */
  onReorder: (next: T[]) => void;
  enabled?: boolean;
}) {
  const [order, setOrder] = useState<T[]>(ids);
  const [active, setActive] = useState<T | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const activeRef = useRef<T | null>(null);
  const els = useRef(new Map<T, HTMLElement>());
  const rects = useRef(new Map<T, PageRect>());
  const containerRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ghostBase = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });
  const startOrder = useRef<T[]>([]);
  const raf = useRef<number | null>(null);
  /** Ostatnie przestawienie - blokada ping-ponga w mozaice, gdzie po przestawieniu pod palcem
   *  moze wyladowac inny kafelek niz slot przeciaganego. */
  const lastMove = useRef<{ from: number; to: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number; id: T } | null>(null);
  const suppressClickUntil = useRef(0);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Kolejnosc z zewnatrz (nowo opublikowany wyjazd, odswiezenie) - przyjmujemy, gdy palec
  // nie trzyma kafelka; w trakcie gestu zrodlem prawdy jest hook.
  const idsKey = ids.join("|");
  useEffect(() => {
    if (activeRef.current) return;
    setOrder((prev) => (prev.join("|") === idsKey ? prev : ids));
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTop = () => (scrollerRef.current ? scrollerRef.current.scrollTop : window.scrollY);

  const measure = useCallback(() => {
    const st = scrollTop();
    const next = new Map<T, PageRect>();
    els.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next.set(id, { left: r.left, top: r.top + st, width: r.width, height: r.height });
    });
    return next;
  }, []);

  const clearPress = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    pressOrigin.current = null;
  }, []);

  // Po kazdej zmianie kolejnosci w trakcie gestu: zmierz nowe pozycje i "dojedz" sasiadow
  // z poprzednich miejsc (FLIP). Ruch jest w ukladzie strony, wiec scroll go nie psuje.
  useLayoutEffect(() => {
    const act = activeRef.current;
    if (!act) return;
    const prev = rects.current;
    const next = measure();
    next.forEach((r, id) => {
      if (id === act) return;
      const p = prev.get(id);
      if (!p) return;
      const dx = p.left - r.left;
      const dy = p.top - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const el = els.current.get(id);
      if (!el || typeof el.animate !== "function") return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: FLIP_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    });
    rects.current = next;
  }, [order, measure]);

  // Duch: klon kafelka wstawiony do portalu, gdy gest wystartuje.
  useLayoutEffect(() => {
    const act = activeRef.current;
    const host = ghostRef.current;
    if (!act || !host) return;
    const el = els.current.get(act);
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.opacity = "1"; // oryginal jest juz przygaszony - duch ma byc pelny
    clone.removeAttribute("data-reorder-item"); // klon nie jest kafelkiem (selektory, testy)
    host.replaceChildren(clone);
  }, [active]);

  const stopLoop = () => { if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; } };

  const tick = useCallback(() => {
    raf.current = null;
    const act = activeRef.current;
    if (!act) return;
    const { x, y } = pointer.current;

    // Autoprzewijanie przy krawedzi widoku (albo przewijanego rodzica).
    const sc = scrollerRef.current;
    const viewTop = sc ? sc.getBoundingClientRect().top : 0;
    const viewBottom = sc ? sc.getBoundingClientRect().bottom : window.innerHeight;
    let dyScroll = 0;
    if (y < viewTop + EDGE_PX) dyScroll = -EDGE_MAX_SPEED * Math.min(1, (viewTop + EDGE_PX - y) / EDGE_PX);
    else if (y > viewBottom - EDGE_PX) dyScroll = EDGE_MAX_SPEED * Math.min(1, (y - (viewBottom - EDGE_PX)) / EDGE_PX);
    if (dyScroll) {
      if (sc) sc.scrollTop += dyScroll; else window.scrollBy(0, dyScroll);
    }

    // Duch jedzie za palcem.
    const g = ghostRef.current;
    if (g) {
      g.style.transform = `translate(${x - startPointer.current.x}px, ${y - startPointer.current.y}px) scale(1.05)`;
    }

    // Slot pod palcem = kafelek, w ktorego prostokat trafia palec (uklad strony).
    const py = y + scrollTop();
    const cur = orderRef.current;
    const from = cur.indexOf(act);
    let to = -1;
    for (let i = 0; i < cur.length; i++) {
      const id = cur[i];
      if (id === act) continue;
      const r = rects.current.get(id);
      if (!r) continue;
      if (x >= r.left && x <= r.left + r.width && py >= r.top && py <= r.top + r.height) { to = i; break; }
    }
    if (to >= 0 && from >= 0 && to !== from) {
      const lm = lastMove.current;
      const pingPong = lm && lm.from === to && lm.to === from && Math.hypot(x - lm.x, y - lm.y) < 12;
      if (!pingPong) {
        const next = arrayMove(cur, from, to);
        orderRef.current = next;
        lastMove.current = { from, to, x, y };
        setOrder(next);
        haptics.selection();
      }
    }

    if (dyScroll) raf.current = requestAnimationFrame(tick); // przy krawedzi jedziemy dalej bez ruchu palca
  }, []);

  const schedule = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  const finish = useCallback(() => {
    const act = activeRef.current;
    if (!act) return;
    stopLoop();
    document.removeEventListener("pointermove", onDocMove);
    document.removeEventListener("pointerup", onDocUp);
    document.removeEventListener("pointercancel", onDocUp);
    document.removeEventListener("touchmove", blockScroll);
    document.removeEventListener("contextmenu", blockEvent, true);
    document.removeEventListener("selectstart", blockEvent, true);
    suppressClickUntil.current = Date.now() + 500;

    const changed = orderRef.current.join("|") !== startOrder.current.join("|");
    if (changed) onReorderRef.current(orderRef.current);
    haptics.light();

    // Duch dolatuje do swojego slotu i znika.
    const g = ghostRef.current;
    const el = els.current.get(act);
    const base = ghostBase.current;
    if (g && el && base) {
      const r = el.getBoundingClientRect();
      g.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), opacity ${SETTLE_MS}ms ease`;
      g.style.transform = `translate(${r.left - base.left}px, ${r.top - base.top}px) scale(1)`;
    }
    window.setTimeout(() => { activeRef.current = null; setActive(null); }, SETTLE_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sluchacze dokumentu - stale referencje, zeby dalo sie je zdjac.
  const onDocMove = useCallback((e: PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    schedule();
  }, [schedule]);
  const onDocUp = useCallback(() => finish(), [finish]);
  const blockScroll = useCallback((e: TouchEvent) => { if (e.cancelable) e.preventDefault(); }, []);
  const blockEvent = useCallback((e: Event) => { e.preventDefault(); }, []);

  const activate = useCallback((id: T, x: number, y: number) => {
    const el = els.current.get(id);
    if (!el) return;
    activeRef.current = id;
    startOrder.current = orderRef.current;
    scrollerRef.current = findScroller(containerRef.current);
    rects.current = measure();
    const r = el.getBoundingClientRect();
    ghostBase.current = { left: r.left, top: r.top, width: r.width, height: r.height };
    startPointer.current = { x, y };
    pointer.current = { x, y };
    lastMove.current = null;
    haptics.medium();
    setActive(id);
    document.addEventListener("pointermove", onDocMove);
    document.addEventListener("pointerup", onDocUp);
    document.addEventListener("pointercancel", onDocUp);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    document.addEventListener("contextmenu", blockEvent, true);
    document.addEventListener("selectstart", blockEvent, true);
  }, [measure, onDocMove, onDocUp, blockScroll, blockEvent]);

  useEffect(() => () => {
    clearPress();
    stopLoop();
    if (activeRef.current) {
      document.removeEventListener("pointermove", onDocMove);
      document.removeEventListener("pointerup", onDocUp);
      document.removeEventListener("pointercancel", onDocUp);
      document.removeEventListener("touchmove", blockScroll);
      document.removeEventListener("contextmenu", blockEvent, true);
      document.removeEventListener("selectstart", blockEvent, true);
    }
  }, [clearPress, onDocMove, onDocUp, blockScroll, blockEvent]);

  const setItemRef = useCallback((id: T) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el); else els.current.delete(id);
  }, []);

  const itemProps = useCallback((id: T) => {
    if (!enabled) return { ref: setItemRef(id) } as const;
    const style: CSSProperties | undefined = active === id ? { opacity: 0.35 } : undefined;
    return {
      ref: setItemRef(id),
      "data-reorder-item": id,
      style,
      onPointerDown: (e: React.PointerEvent) => {
        if (activeRef.current) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if ((e.target as HTMLElement | null)?.closest?.("[data-no-longpress]")) return;
        clearPress();
        pressOrigin.current = { x: e.clientX, y: e.clientY, id };
        timer.current = setTimeout(() => {
          timer.current = null;
          const o = pressOrigin.current;
          pressOrigin.current = null;
          if (o) activate(o.id, o.x, o.y);
        }, HOLD_MS);
      },
      onPointerMove: (e: React.PointerEvent) => {
        const o = pressOrigin.current;
        if (!o || !timer.current) return;
        if (Math.abs(e.clientX - o.x) > MOVE_TOLERANCE || Math.abs(e.clientY - o.y) > MOVE_TOLERANCE) clearPress();
      },
      onPointerUp: clearPress,
      onPointerCancel: clearPress,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
    } as const;
  }, [enabled, active, setItemRef, clearPress, activate]);

  const containerProps = {
    ref: (el: HTMLElement | null) => { containerRef.current = el; },
    onClickCapture: (e: React.MouseEvent) => {
      if (Date.now() < suppressClickUntil.current || activeRef.current) { e.preventDefault(); e.stopPropagation(); }
    },
    // useSwipeNav na rodzicu liczy gest z touchend - po przeciaganiu kafelka nie ma go widziec.
    onTouchEnd: (e: React.TouchEvent) => {
      if (activeRef.current || Date.now() < suppressClickUntil.current) e.stopPropagation();
    },
    onTouchCancel: (e: React.TouchEvent) => {
      if (activeRef.current || Date.now() < suppressClickUntil.current) e.stopPropagation();
    },
  } as const;

  const ghost = active && ghostBase.current
    ? createPortal(
      <div
        ref={ghostRef}
        aria-hidden
        className="pointer-events-none fixed z-[200] overflow-hidden rounded-2xl shadow-2xl shadow-black/30 [&>*]:!m-0"
        style={{
          left: ghostBase.current.left,
          top: ghostBase.current.top,
          width: ghostBase.current.width,
          height: ghostBase.current.height,
          transform: "scale(1.05)",
          willChange: "transform",
        }}
      />,
      document.body,
    )
    : null;

  return {
    /** Zywa kolejnosc - w trakcie gestu wyprzedza `ids`, po nim jest z nimi zgodna. */
    order,
    /** Id przeciaganego kafelka albo null. */
    active,
    itemProps,
    containerProps,
    /** Portal z duchem - wyrenderuj obok kontenera. */
    ghost,
  };
}
