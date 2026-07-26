import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Bookmark, Eye, CheckCircle2, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { useMyRouteStats } from "@/hooks/useRouteStats";

// Widok "Statystyki" (otwierany z pomaranczowej karty na profilu): jak inni korzystaja
// z tras usera. Glowna metryka = ile osob wykorzystalo trasy. "Polecenia" - placeholder
// (do dodania pozniej).
function StatBox({ icon, value, label, sub, muted }: { icon: ReactNode; value: ReactNode; label: string; sub: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col ${muted ? "bg-muted/50" : "bg-secondary"}`}>
      <div className="flex items-start justify-between">
        <span className={`text-3xl font-black tabular-nums leading-none ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
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
        <button onClick={() => navigate(-1)} aria-label="Wróć" className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Statystyki</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black leading-tight">Wykorzystanie Twoich tras</h2>
          <p className="text-sm text-muted-foreground mt-1">Zobacz, jak inni korzystają z tras, które stworzyłaś.</p>
        </div>

        {/* Glowna metryka: ile OSOB wykorzystalo trasy (pomaranczowa karta) */}
        <div className="rounded-3xl bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white p-5 shadow-md shadow-orange-500/20">
          <div className="flex items-start justify-between">
            <span className="text-5xl font-black tabular-nums leading-none">{isLoading ? "–" : (stats?.people ?? 0)}</span>
            <Users className="h-7 w-7 opacity-70 shrink-0" />
          </div>
          <p className="text-base font-bold mt-4">osób wykorzystało Twoje trasy</p>
          <p className="text-xs opacity-80 mt-0.5 leading-relaxed">Tyle różnych osób zapisało Twoje trasy u siebie, żeby z nich skorzystać.</p>
        </div>

        {/* Metryki dodatkowe */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={<Bookmark className="h-5 w-5" />} value={isLoading ? "–" : (stats?.uses ?? 0)} label="Zapisania" sub="łącznie wszystkich tras" />
          <StatBox icon={<Eye className="h-5 w-5" />} value={isLoading ? "–" : (stats?.views ?? 0)} label="Wyświetlenia" sub="Twoich tras" />
          <StatBox icon={<CheckCircle2 className="h-5 w-5" />} value={isLoading ? "–" : (stats?.completions ?? 0)} label="Ukończenia" sub="przez innych" />
          <StatBox icon={<Heart className="h-5 w-5" />} value="—" label="Polecenia" sub="wkrótce" muted />
        </div>
      </div>
    </div>
  );
}
