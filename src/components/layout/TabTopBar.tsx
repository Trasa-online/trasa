import type { ReactNode } from "react";
import { scrollTopTapProps } from "@/lib/scrollTop";

// Wspoldzielona gorna belka zakladek (Eksploruj, Wyjazdy, Zapisane). Stala wysokosc i
// padding -> wszystkie zakladki maja IDENTYCZNY TopNav 1:1 (bez roznic w wysokosci
// zaleznych od tresci). Zaklada rodzica w AppLayout hideTopBar (main ma pt-safe), wiec
// dokladamy tylko pt-1. Tresc (selektor miasta, toggle, akcje) przekazuje rodzic jako children.
// hidden: ekran ma wlasny chrome (np. wyszukiwarka eksploracji ma naglowek + kategorie +
// pole zamiast jednej belki) - wtedy belka sie nie renderuje, zeby nie dublowac wysokosci.
export default function TabTopBar({ children, hidden }: { children: ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    // Tapniecie w belke = powrot na gore listy (odruch z iOS). Guziki w srodku belki
    // dzialaja normalnie - `scrollTopTapProps` odpuszcza klikniecia w elementy interaktywne.
    <div {...scrollTopTapProps()} className="flex items-center gap-2 px-4 border-b border-border/40 shrink-0 h-[3.25rem]">
      {children}
    </div>
  );
}
