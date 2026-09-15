import { useEffect, useState } from "react";
import { MARK_H, MARK_S_PATH, MARK_STAR_BOX, MARK_W } from "@/components/spontawayMarkPaths";
import { MarkStar, MARK_ORANGE } from "@/components/SpontawayMark";

// EKRAN STARTOWY (cold start): znak spontaway SKLADA SIE - "S" rysuje sie od lewej do prawej,
// a na jego koncu ZAPALA SIE GWIAZDKA.
//
// Dlaczego rysowanie, a nie pulsowanie albo spinner (decyzja Nat 2026-09-01, po eksploracji
// w Figmie, sekcja "Ekran ładowania"): ruch ma KIERUNEK I KONIEC, wiec sam w sobie sygnalizuje
// postep; kregace sie kolko mowi tylko "czekaj".
//
// Co sie zmienilo 2026-09-15: Nat dala nowe logo, w ktorym w prawym gornym rogu "S" stoi
// GWIAZDKA zamiast dotychczasowej pinezki - i poprosila, zeby ekran ladowania animowal
// wlasnie ja. Rysowanie zostaje takie samo (to nadal jedno pociagniecie od lewej), ale konczy
// sie blyskiem gwiazdki zamiast doklejeniem pinezki. Gwiazdka jest wiec NAGRODA za dojechanie
// do konca, a nie kolejnym elementem, ktory sie wsuwa.
//
// Jak jest zrobione - trzy warstwy jedna na drugiej:
//  1. "S" jako INLINE svg (sciezka z logo, `spontawayMarkPaths.ts`),
//  2. PRZESLONA w kolorze tla ekranu, ktora startuje na calym znaku i zjezdza w prawo -
//     to ona "rysuje" litere, odslaniajac ja od lewej,
//  3. GWIAZDKA jako osobne inline svg NAD przeslona, wiec odsloniecie jej nie dotyczy:
//     ma wlasny pop, a nie wjazd razem z litera.
//
// ⛔ Zadnej `-webkit-mask-image`: WebKit na iOS gubi maski w animowanych warstwach (to samo,
//    co przy nakladkach awatara i kafelkach eksploracji, CLAUDE.md). Przeslona rusza sie
//    samym `transform`, wiec jedzie po GPU - a zimny start to najgorszy moment na animacje
//    liczona na watku glownym. Przy okazji znika zapytanie o plik maski PRZED pierwsza klatka.
//    ⚠️ Przeslona dziala, bo tlo ekranu jest NIEPRZEZROCZYSTE i znane (`SPLASH_BG`) - zmieniasz
//    tlo, zmien oba naraz.
//  Zaleta nad SVG stroke-dashoffset: znak to WYPELNIONY ksztalt, nie linia - dashoffset
//  obrysowywalby jego sylwetke, co wyglada jak obwodka, nie jak rysowanie.

const SPLASH_BG = "#FEFEFE";   // tlo ekranu ORAZ kolor przeslony - musza byc identyczne
const DRAW_MS = 900;   // czas rysowania "S"
const POP_MS = 520;    // zapalenie gwiazdki
const STAR_LEAD = 140; // gwiazdka rusza tyle przed koncem rysowania (inaczej jest przerwa)
const HOLD_MS = 240;   // chwila na komplecie, zeby oko zdazylo odczytac znak
const FADE_MS = 380;   // wygaszenie ekranu
const MARK_W_PX = 140; // szerokosc znaku na ekranie

const STAR_AT = DRAW_MS - STAR_LEAD;
/** Animacja jest gotowa, gdy gwiazdka dopadnie na miejsce - to ona konczy sklejanie znaku. */
const ANIM_MS = STAR_AT + POP_MS;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export default function SplashDraw({ done, onHidden }: {
  /** Aplikacja gotowa (auth + pierwszy ekran). Ekran znika dopiero gdy TO i animacja sie skoncza. */
  done: boolean;
  onHidden?: () => void;
}) {
  const [drawn, setDrawn] = useState(false);   // animacja dobiegla konca
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Oddech gwiazdki wlacza sie TYLKO wtedy, gdy znak jest juz zlozony, a aplikacja nadal
  // sie laduje - wtedy naprawde jest co sygnalizowac. Przy szybkim starcie nie ruszy wcale
  // (ekran wlasnie znika, a ruch pod zanikaniem tylko rozprasza). Raz wlaczony zostaje do
  // konca: zdjecie animacji w polowie cyklu dawaloby skok skali.
  const [breathing, setBreathing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), ANIM_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (drawn && !done) setBreathing(true);
  }, [drawn, done]);

  // Wychodzimy dopiero, gdy OBA warunki: aplikacja gotowa i znak zlozony. Bez tego przy
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
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: SPLASH_BG, transition: `opacity ${FADE_MS}ms ease-out`, opacity: leaving ? 0 : 1 }}
      aria-hidden
    >
      <div
        className="relative overflow-hidden"
        style={{ width: MARK_W_PX, height: (MARK_W_PX * MARK_H) / MARK_W }}
      >
        {/* 1. "S" - caly, od pierwszej klatki; widac go tyle, ile odsloni przeslona */}
        <svg viewBox={`0 0 ${MARK_W} ${MARK_H}`} className="absolute inset-0 block h-full w-full">
          <path fill={MARK_ORANGE} d={MARK_S_PATH} />
        </svg>

        {/* 2. Przeslona - zjezdza w prawo, wiec litera "wchodzi" od lewej. Piksel zapasu z kazdej
            strony chroni przed wloskiem koloru przy zaokragleniu subpikseli. */}
        <span
          className="splash-wipe absolute block"
          style={{
            inset: -1, background: SPLASH_BG, transform: "translateX(0)",
            animation: `splash-wipe ${DRAW_MS}ms cubic-bezier(0.22,0.61,0.36,1) forwards`,
          }}
        />

        {/* 3. GWIAZDKA - nad przeslona, wiec zapala sie sama, tuz przed koncem rysowania,
            a potem spokojnie oddycha, dopoki aplikacja sie laduje */}
        <span
          className="splash-star absolute block"
          style={{
            left: pct(MARK_STAR_BOX.x, MARK_W), top: pct(MARK_STAR_BOX.y, MARK_H),
            width: pct(MARK_STAR_BOX.w, MARK_W), height: pct(MARK_STAR_BOX.h, MARK_H),
            animation: `splash-star-pop ${POP_MS}ms cubic-bezier(0.34,1.56,0.64,1) ${STAR_AT}ms both`,
          }}
        >
          {/* Oddech siedzi na WEWNETRZNEJ warstwie: obie animacje ruszaja `transform`,
              wiec na jednym elemencie by sie wykluczyly. */}
          <span
            className="splash-star-breath block h-full w-full"
            style={breathing ? { animation: "splash-star-breath 2s ease-in-out infinite" } : undefined}
          >
            <MarkStar />
          </span>
        </span>
      </div>
    </div>
  );
}
