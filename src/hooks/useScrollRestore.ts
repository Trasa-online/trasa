import { useEffect, useRef, type RefObject } from "react";

// PRZYWRACANIE POZYCJI PRZEWIJANIA (prosba Nat 2026-09-15: "wchodze w cos z Eksploracji albo
// z Miejsc i po powrocie laduje na poczatku widoku, a powinno mnie cofnac na konkretna rzecz").
//
// Wejscie w wyjazd, kolekcje czy wizytowke zmienia trase, wiec React odmontowuje caly ekran
// razem z jego scrollerem - pozycja przepada. Zakladka ma sie zachowywac jak w natywnej apce:
// wracasz tam, gdzie byles.
//
// Pamiec jest MODULOWA, nie w `sessionStorage`: ma zyc dokladnie tyle, co uruchomienie
// aplikacji. Po restarcie user oczekuje swiezego widoku, a nie miejsca sprzed dwoch dni.
const POS = new Map<string, number>();

/** Ile najwyzej czekamy na tresc, zanim odtworzymy tyle pozycji, ile sie da. */
const RESTORE_MS = 2000;

export function useScrollRestore(
  /** Klucz widoku - zwykle `location.pathname`. Rozne zakladki nie moga dzielic pozycji. */
  key: string,
  ref: RefObject<HTMLElement | null>,
  opts: {
    /** `false` = nie zapisuj i nie odtwarzaj (np. ten sam scroller pokazuje teraz wyniki szukania). */
    enabled?: boolean;
    /** Wolane, gdy tresci jest ZA MALO, zeby dojechac do zapisanej pozycji - widok z leniwym
     *  doladowywaniem moze tu dosypac kolejna porcje. */
    onNeedMore?: () => void;
  } = {},
) {
  const { enabled = true, onNeedMore } = opts;
  // Callback trzymamy w refie, zeby nowa referencja funkcji przy kazdym renderze nie
  // restartowala efektu (a wraz z nim odtwarzania).
  const needMore = useRef(onNeedMore);
  needMore.current = onNeedMore;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    // ── Zapis: raz na klatke, nie przy kazdym zdarzeniu scrolla ──
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; POS.set(key, el.scrollTop); });
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    // ── Odtworzenie ──
    // Tresc dojezdza asynchronicznie (TanStack Query, a w Miejscach jeszcze leniwe
    // doladowywanie kart), wiec w chwili montowania kontener jest za niski i samo
    // `scrollTop = X` zostaloby przyciete do zera. Probujemy przez chwile, az sie zmiesci.
    const want = POS.get(key) ?? 0;
    let stopped = false;
    if (want > 0) {
      const deadline = performance.now() + RESTORE_MS;
      let lastMax = -1;
      const tick = () => {
        const node = ref.current;
        if (stopped || !node) return;
        const max = node.scrollHeight - node.clientHeight;
        if (max >= want) { node.scrollTop = want; return; }
        // Dosypujemy tresc TYLKO gdy kontener przestal rosnac - inaczej przy leniwej liscie
        // wywolalibysmy to w kazdej klatce i od razu zaladowali wszystko.
        if (max === lastMax) needMore.current?.();
        lastMax = max;
        if (performance.now() < deadline) requestAnimationFrame(tick);
        else node.scrollTop = max;   // nie doczekalismy sie - tyle, ile mamy
      };
      requestAnimationFrame(tick);
    }

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      // ⚠️ Zapisujemy tylko wartosc DODATNIA. Przy odmontowaniu element bywa juz odpiety
      // od dokumentu i oddaje `scrollTop === 0` - zapisanie tego zerowaloby pozycje,
      // ktora sekunde wczesniej poprawnie zapisal handler scrolla.
      const last = el.scrollTop;
      if (last > 0) POS.set(key, last);
    };
  }, [key, enabled, ref]);
}

/** Czysci zapamietana pozycje - np. gdy widok celowo wraca na gore (zmiana miasta, filtra). */
export function resetScrollRestore(key: string) {
  POS.delete(key);
}

// ── Wariant dla list o NIESTABILNEJ kolejnosci ────────────────────────────────────────────
// Zakladka Miejsca uklada kolejke od nowa przy kazdym montowaniu (`interleaveByCategory`
// miesza kategorie z losowym jitterem), wiec zapamietany offset w pikselach trafilby po
// powrocie w INNA wizytowke. Tam pamietamy IDENTYFIKATOR elementu i szukamy go w nowej
// kolejnosci - „cofnij mnie na konkretna rzecz" znaczy na te sama rzecz, nie na to samo miejsce.
const ITEM = new Map<string, string>();

export function rememberItem(key: string, id: string | null | undefined) {
  if (id) ITEM.set(key, id); else ITEM.delete(key);
}

export function recallItem(key: string): string | null {
  return ITEM.get(key) ?? null;
}
