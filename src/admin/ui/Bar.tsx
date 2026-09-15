// Pasek udzialu / zuzycia. Kolor = semantyka (ok/warn/bad), nigdy dekoracja.
// ⚠️ Klasy wypisane w calosci - Tailwind nie widzi sklejanych nazw.
import { cn } from "@/lib/utils";

type BarTone = "neutral" | "ok" | "warn" | "bad";

const FILL: Record<BarTone, string> = {
  neutral: "bg-[var(--graphite)]",
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  bad: "bg-[var(--bad)]",
};

export function Bar({ pct, tone = "neutral", className }: { pct: number; tone?: BarTone; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--line)]", className)}>
      <div className={cn("h-full rounded-full", FILL[tone])} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}
