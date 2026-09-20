import { useCallback, useRef } from "react";

// Wysokosc PRZYKLEJONEJ belki zakladek profilu jako zmienna CSS `--profile-sticky`.
//
// Po co: przy wlaczonym snapie kafelek kolekcji ma sie zatrzymywac POD belka, a nie za nia,
// wiec scroller dostaje `scroll-pt-[var(--profile-sticky,44px)]`. Stala wpisana na sztywno
// rozjezdza sie przy kazdej zmianie tego paska - a paska juz raz przybylo (chipy podzakladek
// weszly do tego samego pudelka 2026-09-15, przez co 44 px przestalo byc prawda).
//
// ⚠️ To CALLBACK REF, nie `useRef` + `useEffect`. Efekt z tablica zaleznosci odpalal sie, gdy
// profil jeszcze sie ladowal (early-return -> `ref.current === null`) i NIE wracal po tym, jak
// belka faktycznie sie zamontowala - zmienna nie powstawala wcale, a `scroll-pt` cichcem
// spadal na wartosc zapasowa. Ratowalo to dopiero przelaczenie zakladki (zmiana zaleznosci),
// wiec wejscie prosto z linku `?tab=listy` mialo zly odstep. Callback ref dostaje wezel
// dokladnie w chwili podpiecia i `null` przy odpieciu, wiec nie ma czego przegapic.
//
// Zmienna jest JEDNA dla obu profili (wlasnego i publicznego) - nigdy nie stoja obok siebie,
// a React sprzata odmontowane drzewo przed efektami nowego.
export function useStickyHeadVar() {
  const roRef = useRef<ResizeObserver | null>(null);
  return useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) { document.documentElement.style.removeProperty("--profile-sticky"); return; }
    const apply = () => document.documentElement.style.setProperty(
      "--profile-sticky", `${Math.round(el.getBoundingClientRect().height)}px`,
    );
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    roRef.current = ro;
  }, []);
}
