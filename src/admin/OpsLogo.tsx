import { TrasaLogo } from "@/components/TrasaLogo";
import { cn } from "@/lib/utils";

// Logo panelu ops = ikona aplikacji (zaokraglony kwadrat, gradient zolto-zloty
// #FDF184 -> #FDCD84 + pomaranczowe faliste "S") + wordmark "spontaway ops".
// Uzywane na ekranie logowania (RequireAdmin) i w naglowku po zalogowaniu (AdminLayout).
// tile = bok kafelka w px; reszta (radius/symbol/font) skaluje sie proporcjonalnie.
export function OpsLogo({ tile = 40, className }: { tile?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="grid place-items-center bg-gradient-to-br from-[#FDF184] to-[#FDCD84]"
        style={{ width: tile, height: tile, borderRadius: Math.round(tile * 0.24) }}
      >
        <TrasaLogo size={Math.round(tile * 0.62)} tone="orange" />
      </div>
      <span
        className="font-black text-slate-900 tracking-tight leading-none"
        style={{ fontSize: Math.max(14, Math.round(tile * 0.4)) }}
      >
        spontaway<span className="text-slate-400 font-bold"> ops</span>
      </span>
    </div>
  );
}

export default OpsLogo;
