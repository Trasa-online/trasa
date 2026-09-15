import type { ReactNode } from "react";

// Wspoldzielony naglowek zakladek (Wyjazdy, Zapisane, Moj profil): z lewej nazwa zakladki,
// z prawej akcje zalezne od zakladki. Zaklada, ze rodzic jest w AppLayout hideTopBar (main
// ma juz pt-safe), wiec dokladamy tylko pt-1 => env(top)+~1rem. Pelna szerokosc + border-b.
// `below` = przypiety wiersz pod tytulem (np. filtry).
// `overlay` = tresc, ktora PRZYKRYWA caly wiersz naglowka (tytul + akcje). Uzywa jej szukanie
//   na profilu: zwiniete jest lupka wsrod ikon, a po tapnieciu pole dostaje cala belke zamiast
//   zajmowac osobny wiersz pod spodem (prosba Nat 2026-09-09). Ta sama zasada, co w Eksploracji,
//   gdzie w trybie wynikow toggle Trasy|Miejsca ustepuje miejsca polu.
export default function TabHeader({ title, right, below, overlay }: { title: string; right?: ReactNode; below?: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="px-4 pt-1 pb-3 border-b border-border/40 shrink-0">
      {overlay ? (
        <div className="flex items-center gap-2 min-h-9">{overlay}</div>
      ) : (
        <div className="flex items-center gap-3">
          <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{title}</h1>
          {right && <div className="flex items-center gap-1.5 shrink-0">{right}</div>}
        </div>
      )}
      {below && <div className="flex items-center gap-2 pt-2.5">{below}</div>}
    </div>
  );
}
