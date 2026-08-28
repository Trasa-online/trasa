import { useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { ArrowLeft, Bookmark, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { useMyRouteStats } from "@/hooks/useRouteStats";

// Widok "Statystyki" (otwierany z pomaranczowej karty na profilu): jak inni korzystaja
// z tras usera. Na razie pokazujemy tylko Zapisania i Wyswietlenia.
function StatBox({ icon, value, label, sub }: { icon: ReactNode; value: ReactNode; label: string; sub: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col bg-secondary">
      <div className="flex items-start justify-between">
        <span className="text-3xl font-black tabular-nums leading-none text-foreground">{value}</span>
        <span className="opacity-40 shrink-0">{icon}</span>
      </div>
      <p className="text-sm font-bold text-foreground mt-4 leading-tight">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

export default function Stats() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useMyRouteStats();

  return (
    <div className="min-h-[100dvh] bg-background max-w-lg mx-auto flex flex-col">
      {/* Naglowek z cofnieciem */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => goBackOr(navigate, "/moj-profil")} aria-label="Wróć" className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Statystyki</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black leading-tight">Wykorzystanie Twoich tras</h2>
          <p className="text-sm text-muted-foreground mt-1">Zobacz, jak inni korzystają z tras, które stworzyłaś.</p>
        </div>

        {/* Metryki: na razie tylko Zapisania i Wyswietlenia */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={<Bookmark className="h-5 w-5" />} value={isLoading ? "–" : (stats?.uses ?? 0)} label="Zapisania" sub="łącznie wszystkich tras" />
          <StatBox icon={<Eye className="h-5 w-5" />} value={isLoading ? "–" : (stats?.views ?? 0)} label="Wyświetlenia" sub="Twoich tras" />
        </div>
      </div>
    </div>
  );
}
