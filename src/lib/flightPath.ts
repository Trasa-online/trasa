// Tor "lotu" (2026-09-08).
//
// Uzywa go animacja TOPKI: gwiazdka nie leci po prostej, tylko zatacza luk, po drodze wchodzi
// na zdjecie miejsca i konczy przy nazwie. Ruch mowi wtedy, CZEGO dotyczy akcja, i zostawia
// slad tam, gdzie wyroznienie faktycznie zyje.
//
// Odhaczenie odwiedzin NIE uzywa toru (decyzja Nat 2026-09-08): tam liczy sie sila przybicia
// pieczatki, a nie droga, wiec animacja gra w miejscu. Modul zostaje wydzielony, bo lot jest
// wielokrotnego uzytku, a jego geometria (Catmull-Rom) latwo psuje sie przy przepisywaniu.
//
// Dlaczego przez PUNKTY, a nie krzywa z punktami sterujacymi: bezier tylko ZBLIZA sie do
// punktow sterujacych, wiec przy pierwszej wersji gwiazdka ocierala sie o krawedz miniaturki
// zamiast po niej przejsc (zmierzone: docieral do x=65 przy zdjeciu konczacym sie na 64).
// Catmull-Rom przez podane punkty faktycznie PRZECHODZI, wiec wejscie na zdjecie jest pewne
// niezaleznie od wysokosci wiersza.

export type Point = { x: number; y: number };

/** Dlugosc lotu. Wolniej niz domyslne ~400 ms - ruch ma byc czytelny jako TOR, nie przeskok. */
export const FLIGHT_MS = 1100;

/**
 * Probkuje gladki tor przechodzacy przez WSZYSTKIE podane punkty.
 * Zwraca klatki dla `animate={{ x, y }}` w framer-motion.
 */
export function arcThrough(way: Point[], segments = 12): { x: number[]; y: number[] } {
  const x: number[] = [], y: number[] = [];
  if (way.length < 2) return { x, y };
  for (let i = 0; i < way.length - 1; i++) {
    const p0 = way[Math.max(0, i - 1)];
    const p1 = way[i];
    const p2 = way[i + 1];
    const p3 = way[Math.min(way.length - 1, i + 2)];
    for (let k = 0; k < segments; k++) {
      const t = k / segments, t2 = t * t, t3 = t2 * t;
      x.push(0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3));
      y.push(0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3));
    }
  }
  x.push(way[way.length - 1].x);
  y.push(way[way.length - 1].y);
  return { x, y };
}

/** Prostokat elementu wzgledem wiersza - obie animacje licza pozycje tak samo. */
export const relRect = (row: DOMRect, r: DOMRect) => ({
  x: r.left - row.left, y: r.top - row.top, w: r.width, h: r.height,
  cx: r.left - row.left + r.width / 2, cy: r.top - row.top + r.height / 2,
});
