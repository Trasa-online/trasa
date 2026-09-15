// Karta panelu lokalu. Jeden promien, jedno obramowanie, jeden padding - zeby sekcje
// nie rozjezdzaly sie miedzy soba tak, jak rozjezdzaly sie przed przebudowa.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BizCard({ children, className, padded = true }: {
  children: ReactNode;
  className?: string;
  /** false = tresc sama rysuje swoje marginesy (tabela, lista z separatorami). */
  padded?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", padded && "p-5", className)}>
      {children}
    </div>
  );
}

export function BizCardTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-black text-slate-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
