// Panel szczegolow. Na desktopie okno na srodku, ponizej `sm` arkusz od dolu -
// na telefonie okno wycentrowane w pionie zostawia tresci polowe ekranu.
import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({ title, subtitle, onClose, actions, children, wide, flush }: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  /** Szerszy panel - dla podgladow "jak w apce", gdzie licza sie zdjecia. */
  wide?: boolean;
  /** Bez wewnetrznego marginesu - tresc sama rysuje swoje krawedzie (okladka na caly panel). */
  flush?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={cn(
        "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] sm:rounded-[var(--r-card)]",
        wide ? "sm:max-w-[720px]" : "sm:max-w-[560px]",
      )}>
        <div className="flex items-start gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-[var(--ink)]">{title}</h3>
            {subtitle ? <p className="mt-0.5 truncate text-[12px] text-[var(--stone)]">{subtitle}</p> : null}
          </div>
          {actions}
          <button
            type="button" onClick={onClose} aria-label="Zamknij"
            className="shrink-0 rounded-[var(--r-control)] p-1.5 text-[var(--stone)] hover:bg-[var(--canvas)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn("overflow-y-auto", flush ? "" : "p-5")}>{children}</div>
      </div>
    </div>
  );
}
