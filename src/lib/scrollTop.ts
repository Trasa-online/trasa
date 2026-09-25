import { haptics } from "@/hooks/useHaptics";

// TAPNIECIE W GORNA BELKE = POWROT NA GORE (prosba Nat 2026-09-16). Odruch z iOS: w natywnych
// aplikacjach stuknięcie w pasek statusu albo nagłówek odsyła listę na początek, więc po długim
// przewijaniu nie trzeba scrollować z powrotem palcem.
//
// ⛔ Zadnego kontekstu ani rejestru scrollerow. Ekran OZNACZA swoj glowny scroller atrybutem
// `data-scroll-main`, a belka tylko pyta o niego DOM. Dzieki temu nowy ekran wlacza to jednym
// atrybutem, bez podpinania sie pod providera i bez ryzyka, ze ref zostanie po odmontowaniu.
const SELECTOR = "[data-scroll-main]";

/** Elementy, ktore maja WLASNA akcje - tapniecie w nie nie moze przewijac. */
const INTERACTIVE = "button, a, input, select, textarea, label, [role='button'], [data-no-scrolltop]";

/** Widoczny scroller biezacego ekranu. Jeden ekran miewa ich w DOM kilka (profil: feed ORAZ
 *  wyniki szukania), ale nieaktywny jest schowany `display:none`.
 *  ⚠️ Widocznosc sprawdzamy przez `getClientRects()`, NIE przez `offsetParent`: ten drugi zwraca
 *  `null` takze dla elementow `position: fixed`, wiec odrzucilby scroller, ktory jest na ekranie. */
function mainScroller(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  // Pager zakladek (TabsPager) trzyma sasiednie ekrany w DOM obok siebie - sa „widoczne"
  // w sensie layoutu, wiec pomijamy wszystko, co siedzi w nieaktywnym panelu.
  const visible = all.filter((el) => el.getClientRects().length > 0 && !el.closest('[data-tab-panel="inactive"]'));
  return visible.find((el) => el.scrollHeight > el.clientHeight + 4) ?? visible[0] ?? null;
}

/** Przewija glowny scroller na gore. Oddaje `false`, gdy nie bylo czego przewijac -
 *  wtedy NIE dajemy haptyki, zeby tapniecie w belke na gorze listy nie udawalo akcji. */
export function scrollMainToTop(): boolean {
  const el = mainScroller();
  if (!el || el.scrollTop <= 0) return false;
  // `smooth` zamiast skoku: user ma zobaczyc, ze wrocil na gore, a nie zastanawiac sie,
  // czy ekran sie przeladowal. Przy `prefers-reduced-motion` iOS sam degraduje do skoku.
  el.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}

/** Props do rozlozenia na gornej belce. Tapniecie w guzik w srodku belki (wstecz, dzwonek,
 *  "...") NIE przewija - inaczej kazda akcja mialaby efekt uboczny. */
export function scrollTopTapProps() {
  return {
    onClick: (e: React.MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest(INTERACTIVE)) return;
      if (scrollMainToTop()) haptics.light();
    },
  };
}

/**
 * „Dokument otwiera sie OD POCZATKU" (zgloszenie testerow 2026-09-24).
 *
 * Regulamin i Polityka Prywatnosci linkuja do siebie nawzajem, a przejscie miedzy trasami
 * w React Routerze NIE resetuje pozycji przewijania. Kto wszedl w Regulamin i zjechal do pkt 7,
 * ten po tapnieciu „Polityka Prywatnosci" ladowal w jej srodku - dokladnie na tej samej
 * wysokosci w pikselach, co poprzedni dokument.
 *
 * ⚠️ Zerujemy KAZDY scroller, bo te strony (min-h-screen wewnatrz powloki h-[100dvh]) raz
 * przewijaja dokument, a raz `main` - zaleznie od tego, czy stoja w AppLayout. Dwa przebiegi
 * (teraz + nastepna klatka), bo WebView potrafi przywrocic wlasna pozycje PO zamontowaniu.
 */
export function scrollDocumentToTop(): void {
  const apply = () => {
    try { window.scrollTo(0, 0); } catch { /* brak window */ }
    for (const el of [document.scrollingElement, document.documentElement, document.body]) {
      if (el) el.scrollTop = 0;
    }
    document.querySelectorAll<HTMLElement>("main, [data-scroll-main]").forEach((el) => { el.scrollTop = 0; });
  };
  apply();
  requestAnimationFrame(apply);
}
