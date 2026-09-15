// Naglowek sekcji wewnatrz strony. Jedna wysokosc i jedna wielkosc liter dla calego panelu.
import type { ReactNode } from "react";

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--stone)]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
