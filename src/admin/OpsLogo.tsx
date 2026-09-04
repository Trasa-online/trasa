import { cn } from "@/lib/utils";

// Logo panelu ops = ikona panelu + wordmark "spontaway ops".
//
// Ikona ma ODWROCONE kolory wzgledem ikony aplikacji: apka to zolto-zloty kafelek
// z pomaranczowym "S", panel to pomaranczowy kafelek z zoltym "S". Powod: zakladka
// panelu zapisana na ekranie domowym telefonu wygladala identycznie jak apka.
//
// Swiadomie ten SAM plik co apple-touch-icon w admin.html - naglowek panelu i skrot
// na telefonie pokazuja wtedy dokladnie ten sam znak. Generator: scripts/gen_ops_icon.py.
// tile = bok kafelka w px; promien i wielkosc fontu skaluja sie proporcjonalnie.
export function OpsLogo({ tile = 40, className }: { tile?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/ops-icon-180.png"
        alt=""
        className="shrink-0 object-cover"
        style={{ width: tile, height: tile, borderRadius: Math.round(tile * 0.24) }}
      />
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
