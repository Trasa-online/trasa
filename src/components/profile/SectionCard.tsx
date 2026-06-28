import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Kolorowa, ulozona w stos "sekcja" profilu: ikona w bialym zaokraglonym kwadracie (lewy
// gorny), strzalka (prawy gorny gdy klikalne), tytul + podtytul na dole-lewej, duza liczba
// po prawej. Wspolna dla wlasnego profilu (TravelerProfile) i cudzego (PublicProfile) -
// jeden model mentalny.
export default function SectionCard({ icon, title, subtitle, value, bg, onClick }: {
  icon: ReactNode; title: string; subtitle: string; value: number | string;
  bg: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn("w-full text-left rounded-3xl p-5 transition-transform", bg, onClick && "active:scale-[0.99]")}
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white shadow-sm flex items-center justify-center">{icon}</div>
        {onClick && <ArrowUpRight className="h-5 w-5 text-[#0E0E0E]/55" />}
      </div>
      <div className="flex items-end justify-between gap-3 mt-7">
        <div className="min-w-0">
          <p className="text-xl font-display font-extrabold leading-tight text-[#0E0E0E]">{title}</p>
          <p className="text-xs font-medium text-[#0E0E0E]/55 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-4xl font-black text-[#0E0E0E] leading-none tabular-nums shrink-0">{value}</span>
      </div>
    </button>
  );
}
