// Jedna liczba z etykieta. Zastepuje trzy rozne "Kpi"/"Stat" rysowane osobno
// w Analityce, Leadach i Miejscach.
//
// Liczba idzie monospace'em (.data) - w kolumnie kart cyfry stoja pod cyframi.
// ⚠️ Klasy sa wypisane w calosci, bo skaner Tailwinda nie widzi `bg-[var(--${tone})]`.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "ok" | "warn" | "bad";

const INK: Record<MetricTone, string> = {
  neutral: "text-[var(--ink)]",
  ok: "text-[var(--ok)]",
  warn: "text-[var(--warn)]",
  bad: "text-[var(--bad)]",
};
const EDGE: Record<MetricTone, string> = {
  neutral: "border-[var(--line)]",
  ok: "border-[var(--line)]",
  warn: "border-[var(--warn)]",
  bad: "border-[var(--bad)]",
};

export function Metric({ label, value, hint, tone = "neutral", icon }: {
  label: string;
  value: ReactNode;
  /** Druga linia pod liczba: zmiana, udzial, kontekst. */
  hint?: ReactNode;
  /** "warn"/"bad" tylko gdy liczba WYMAGA reakcji - nie do dekoracji. */
  tone?: MetricTone;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-[var(--r-card)] border bg-[var(--surface)] p-4", EDGE[tone])}>
      <div className="flex items-center gap-1.5 text-[var(--stone)]">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={cn("data mt-1 text-[26px] leading-8", INK[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--stone)]">{hint}</p> : null}
    </div>
  );
}
