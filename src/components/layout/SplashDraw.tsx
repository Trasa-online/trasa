import { useEffect, useState } from "react";

// EKRAN STARTOWY (cold start): znak spontaway RYSUJE SIE od lewej do prawej, konczac na pinezce.
//
// Dlaczego rysowanie, a nie pulsowanie albo spinner (decyzja Nat 2026-09-01, po eksploracji
// w Figmie, sekcja "Ekran ładowania"): sciezka znaku to jedna linia zakonczona pinezka, wiec
// rysowanie opowiada dokladnie to, co robi aplikacja - prowadzi trase i stawia pinezke. Ruch ma
// KIERUNEK I KONIEC, wiec sam w sobie sygnalizuje postep; kregace sie kolko mowi tylko "czekaj".
//
// Jak jest zrobione: znak to maska (Ikona_Trasy.svg) nalozona na pomaranczowy prostokat, ktory
// rozjezdza sie w poziomie (scaleX 0 -> 1, transform-origin: left). Maska przycina go do ksztaltu
// znaku, wiec pomaranczowy kolor "wchodzi" w litere od lewej. Pinezka siedzi w prawym gornym rogu
// sciezki, wiec zapala sie na samym koncu - dokladnie tak, jak konczy sie rysowanie trasy.
// Zaleta nad SVG stroke-dashoffset: ten znak to WYPELNIONY ksztalt, nie linia - animacja
// dashoffset obrysowywalaby jego sylwetke, co wyglada jak obwodka, nie jak rysowanie.

const DRAW_MS = 900;   // czas rysowania
const HOLD_MS = 280;   // chwila zatrzymania na komplecie, zeby oko zdazylo odczytac znak
const FADE_MS = 380;   // wygaszenie ekranu

export default function SplashDraw({ done, onHidden }: {
  /** Aplikacja gotowa (auth + pierwszy ekran). Ekran znika dopiero gdy TO i animacja sie skoncza. */
  done: boolean;
  onHidden?: () => void;
}) {
  const [drawn, setDrawn] = useState(false);   // animacja dobiegla konca
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), DRAW_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  // Wychodzimy dopiero, gdy OBA warunki: aplikacja gotowa i znak dorysowany. Bez tego przy
  // szybkim starcie animacja urywalaby sie w polowie, a przy wolnym - ekran znikalby za wczesnie.
  useEffect(() => {
    if (!done || !drawn) return;
    setLeaving(true);
    const t = setTimeout(() => { setHidden(true); onHidden?.(); }, FADE_MS);
    return () => clearTimeout(t);
  }, [done, drawn, onHidden]);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FEFEFE]"
      style={{ transition: `opacity ${FADE_MS}ms ease-out`, opacity: leaving ? 0 : 1 }}
      aria-hidden
    >
      <span
        className="block"
        style={{
          width: 132, height: 132,
          WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskSize: "contain", maskSize: "contain",
          WebkitMaskPosition: "center", maskPosition: "center",
        }}
      >
        <span
          className="block h-full w-full origin-left bg-[#F75708]"
          style={{
            transform: "scaleX(0)",
            animation: `splash-draw ${DRAW_MS}ms cubic-bezier(0.22,0.61,0.36,1) forwards`,
          }}
        />
      </span>
    </div>
  );
}
