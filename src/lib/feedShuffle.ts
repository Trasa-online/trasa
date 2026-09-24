import { useEffect, useState } from "react";

// „Za kazdym odswiezeniem inny szyk" (prosba Nat 2026-09-24) - dla feedu Eksploracji.
//
// ⛔ To NIE jest losowa kolejnosc. Feed ma dwie zasady, ktorych nie wolno zgubic: tresci od
// OBSERWOWANYCH stoja nad reszta swiata, a w kazdym koszyku najnowsze sa wyzej. Pelne
// potasowanie zabraloby jedno i drugie - user zobaczylby wyjazd sprzed pol roku nad tym
// z wczoraj i przestalby wracac.
//
// Dlatego tasujemy w OKNACH: kolejnosc zostaje z grubsza ta sama („swieze na gorze"), ale
// sasiadujace pozycje zamieniaja sie miejscami, wiec feed za kazdym razem wyglada inaczej
// i inne kafelki wpadaja pod pierwsze spojrzenie.
//
// Ziarno zyje w MODULE (nie w stanie ekranu): feed montuje sie od nowa przy kazdym wejsciu
// w kafelek, a kolejnosc ma sie zmieniac na ODSWIEZENIE, a nie przy kazdym powrocie.

const OKNO = 4;

let seed = Math.floor(Math.random() * 1e9);
const listeners = new Set<() => void>();

/** Nowe ziarno = nowy szyk. Wolane z odswiezenia feedu (gest w dol albo w gore). */
export function reshuffleFeed(): void {
  seed = Math.floor(Math.random() * 1e9);
  listeners.forEach((l) => l());
}

/** Ziarno + przerysowanie przy zmianie. */
export function useFeedSeed(): number {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return seed;
}

/** Deterministyczny RNG - ten sam szyk przy kazdym renderze, dopoki ziarno sie nie zmieni.
 *  Bez tego lista przestawialaby sie przy KAZDYM przerysowaniu (i skakala pod palcem). */
function rng(s: number): () => number {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tasuje WEWNATRZ okien po `win` pozycji - patrz komentarz na gorze pliku. */
export function shuffleWindows<T>(arr: T[], s: number, win = OKNO): T[] {
  if (arr.length < 3) return arr;
  const rand = rng(s);
  const out = [...arr];
  for (let start = 0; start < out.length; start += win) {
    const end = Math.min(start + win, out.length);
    for (let i = end - 1; i > start; i--) {
      const j = start + Math.floor(rand() * (i - start + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
