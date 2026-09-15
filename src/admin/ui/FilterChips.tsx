// Chipy filtrow. Aktywny chip to JEDNO z czterech miejsc, gdzie wolno uzyc pomaranczu.
import { cn } from "@/lib/utils";

export interface Chip { id: string; label: string; count?: number }

export function FilterChips({ chips, value, onChange, className }: {
  chips: Chip[]; value: string; onChange: (id: string) => void; className?: string;
}) {
  return (
    // Na waskim ekranie chipy jada w poziomie zamiast lamac sie na cztery rzedy.
    <div className={cn("flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible", className)}>
      {chips.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-control)] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "border border-[var(--line)] bg-[var(--surface)] text-[var(--graphite)] hover:bg-[var(--canvas)]",
            )}
          >
            {c.label}
            {typeof c.count === "number" ? (
              <span className={cn("data text-[10px]", active ? "text-[var(--on-accent)]" : "text-[var(--stone)]")}>{c.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
