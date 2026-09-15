// Wiersz kolejki. Zastepuje TripCard, ListCard i wiersze w panelach zgloszen.
// Lista NIE zmienia wysokosci przy zaznaczeniu - szczegol zyje obok, nie w srodku.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

export function QueueRow({ kind, title, meta, age, overdue, thumb, selected, onClick, trailing }: {
  kind: string;
  title: string;
  meta?: string;
  age?: string;
  overdue?: boolean;
  thumb?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors",
        selected ? "bg-[var(--canvas)]" : "hover:bg-[var(--canvas)]",
      )}
    >
      {thumb ? <div className="shrink-0">{thumb}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge tone="neutral">{kind}</StatusBadge>
          <span className="flex-1" />
          {age ? (
            <span className={cn("data text-[11px]", overdue ? "text-[var(--bad)]" : "text-[var(--stone)]")}>{age}</span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[13px] font-semibold text-[var(--ink)]">{title}</p>
        {meta ? <p className="truncate text-[12px] text-[var(--stone)]">{meta}</p> : null}
      </div>
      {trailing}
    </button>
  );
}
