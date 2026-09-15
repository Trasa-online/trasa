// Naglowek strony. Zastepuje 13 recznych <h1> z wlasnym rozmiarem i waga.
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[36px] font-semibold text-[var(--ink)]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] leading-5 text-[var(--stone)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
