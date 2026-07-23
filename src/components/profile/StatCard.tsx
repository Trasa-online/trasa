import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Kafel statystyki profilu: duza liczba w lewym gornym rogu, ikona w prawym gornym
// (przygaszona), tytul + podtytul na dole. `full` = pelna szerokosc + strzalka.
// Wspolny dla wlasnego profilu (TravelerProfile) i cudzego (PublicProfile).
export default function StatCard({ value, title, subtitle, icon, className, onClick, full = false }: {
  value: number | string; title: string; subtitle: string; icon: ReactNode;
  className?: string; onClick?: () => void; full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative text-left rounded-3xl p-4 flex flex-col transition-transform",
        full ? "min-h-[108px]" : "min-h-[132px]",
        className,
        onClick && "active:scale-[0.98]",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl font-black leading-none tabular-nums">{value}</span>
        <span className="opacity-40 shrink-0">{icon}</span>
      </div>
      <div className="mt-auto pt-6 pr-6">
        <p className="text-lg font-display font-extrabold leading-tight">{title}</p>
        <p className="text-xs font-medium opacity-60 mt-0.5">{subtitle}</p>
      </div>
      {full && onClick && <ArrowUpRight className="absolute bottom-4 right-4 h-5 w-5 opacity-50" />}
    </button>
  );
}
