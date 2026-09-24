import { useLayoutEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { goBackOr } from "@/hooks/useGoBack";
import { scrollDocumentToTop } from "@/lib/scrollTop";

// Wspolna oprawa dokumentow prawnych (Regulamin, Polityka Prywatnosci). Sama rama - tytul
// i tresc podaje strona, wiec ten plik NIE MA copy i nie wymaga tlumaczen.
//
// ⚠️ `scrollDocumentToTop` w `useLayoutEffect`: dokumenty linkuja do siebie nawzajem, a React
// Router nie zeruje pozycji przewijania - bez tego przejscie z pkt 7 Regulaminu otwieralo
// Polityke w jej srodku (zgloszenie testerow 2026-09-24).
export default function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  useLayoutEffect(() => { scrollDocumentToTop(); }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center gap-3">
        <button onClick={() => goBackOr(navigate, "/")} className="p-1 text-foreground/70 hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">{title}</h1>
      </header>

      <div className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
