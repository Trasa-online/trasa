// Pusty stan zawsze mowi DWIE rzeczy: co jest faktem i co z tym zrobic.
// ⛔ NIE "Brak rozpatrzonych." - takie zdanie nie pomaga nikomu.
import type { ReactNode } from "react";

export function EmptyState({ fact, next, action }: { fact: string; next: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-[14px] font-semibold text-[var(--ink)]">{fact}</p>
      <p className="max-w-[420px] text-[13px] text-[var(--stone)]">{next}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
