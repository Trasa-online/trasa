import type { ReactNode } from "react";

// Wspoldzielona gorna belka zakladek (Eksploruj, Wyjazdy, Zapisane). Stala wysokosc i
// padding -> wszystkie zakladki maja IDENTYCZNY TopNav 1:1 (bez roznic w wysokosci
// zaleznych od tresci). Zaklada rodzica w AppLayout hideTopBar (main ma pt-safe), wiec
// dokladamy tylko pt-1. Tresc (selektor miasta, toggle, akcje) przekazuje rodzic jako children.
export default function TabTopBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 border-b border-border/40 shrink-0 h-[3.25rem]">
      {children}
    </div>
  );
}
