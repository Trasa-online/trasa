import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

// Ikona informacji (i) w naglowku widoku - po tapnieciu pokazuje popover z wyjasnieniem, co user
// moze robic na tym widoku i co tworzy. Tap w tlo zamyka. Popover wyrownany do prawej pod ikona.
export function InfoTooltip({ title, children, align = "right" }: { title?: string; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Informacja"
        className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted transition-colors"
      >
        <Info className="h-[22px] w-[22px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute top-10 z-50 w-[290px] max-w-[80vw] rounded-2xl bg-card border border-border/50 shadow-xl p-4 animate-in fade-in slide-in-from-top-1 duration-150 ${align === "right" ? "right-0" : "left-0"}`}>
            {title && <p className="text-sm font-bold text-foreground mb-1.5">{title}</p>}
            <div className="text-[13px] text-muted-foreground leading-relaxed">{children}</div>
          </div>
        </>
      )}
    </div>
  );
}
