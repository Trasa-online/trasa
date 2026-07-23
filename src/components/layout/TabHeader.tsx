import type { ReactNode } from "react";

// Wspoldzielony naglowek zakladek (Wyjazdy, Zapisane, Moj profil): z lewej nazwa zakladki,
// z prawej akcje zalezne od zakladki. Zaklada, ze rodzic jest w AppLayout hideTopBar (main
// ma juz pt-safe), wiec dokladamy tylko pt-1 => env(top)+~1rem. Pelna szerokosc + border-b.
export default function TabHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-1 pb-3 border-b border-border/40 shrink-0">
      <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{title}</h1>
      {right && <div className="flex items-center gap-1.5 shrink-0">{right}</div>}
    </div>
  );
}
