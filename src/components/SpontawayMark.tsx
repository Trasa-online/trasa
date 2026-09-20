import { cn } from "@/lib/utils";
import { MARK_H, MARK_S_PATH, MARK_STAR_BOX, MARK_STAR_PATH, MARK_W } from "./spontawayMarkPaths";

// ZNAK SPONTAWAY Z NOWEGO LOGO (Logo_Spontaway.jpg, 2026-09-15): faliste "S" + GWIAZDKA
// w prawym gornym rogu. Do 15.09 stala tam PINEZKA (`/Ikona_Trasy.svg`) - samo "S" sie nie
// zmienilo, wiec `TrasaLogo` (/spontaway-symbol.png) zostaje bez zmian wszedzie indziej.
//
// Dlaczego INLINE svg, a nie plik przez `BrandIcon`:
//  1. ekran ladowania animuje gwiazdke OSOBNO od "S", a `-webkit-mask-image` w animowanej
//     warstwie WebKit na iOS gubi (to samo, co przy nakladkach awatara i kafelkach eksploracji);
//  2. to pierwsza klatka zimnego startu - maska z pliku to dodatkowe zapytanie sieciowe
//     PRZED czymkolwiek widocznym.
//
// Sciezki sa generowane z logo (`scripts/gen_app_icon.py`) w JEDNYM ukladzie wspolrzednych,
// wiec obie warstwy stoja wzgledem siebie dokladnie tak, jak na obrazku od Nat.

export const MARK_ORANGE = "#F75708";
/** Proporcja znaku (szer./wys.) - do policzenia wysokosci z podanej szerokosci. */
export const MARK_RATIO = MARK_W / MARK_H;

/** Sam ksztalt gwiazdki, w ukladzie wspolrzednych CALEGO znaku (`viewBox` z przesunieciem). */
export function MarkStar({ className, color = MARK_ORANGE }: { className?: string; color?: string }) {
  const b = MARK_STAR_BOX;
  return (
    <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} className={cn("block h-full w-full", className)} aria-hidden>
      <path fill={color} d={MARK_STAR_PATH} />
    </svg>
  );
}

/** Caly znak: "S" + gwiazdka. `size` = szerokosc w px (wysokosc z proporcji). */
export function SpontawayMark({ size = 96, color = MARK_ORANGE, className }: {
  size?: number; color?: string; className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${MARK_W} ${MARK_H}`}
      width={size}
      height={Math.round(size / MARK_RATIO)}
      className={cn("block shrink-0", className)}
      aria-hidden
    >
      <path fill={color} d={MARK_S_PATH} />
      <path fill={color} d={MARK_STAR_PATH} />
    </svg>
  );
}

export default SpontawayMark;
