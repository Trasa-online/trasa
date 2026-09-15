// Potwierdzenie akcji nieodwracalnej. NAZYWA SKUTEK, nie pyta "na pewno?".
// Wzor: "Usuniesz zdjęcie @kasia.wjr. Tego nie da się cofnąć."
import { useEffect, type ReactNode } from "react";

export function ConfirmDialog({ open, consequence, confirmLabel, onConfirm, onCancel, busy, children, confirmDisabled }: {
  open: boolean;
  consequence: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Pole wymagane do decyzji, np. powod usuniecia (trafia do audytu). */
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-[14px] leading-5 text-[var(--ink)]">{consequence}</p>
        {children ? <div className="mt-3">{children}</div> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button" onClick={onCancel} disabled={busy}
            className="h-10 flex-1 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--graphite)] disabled:opacity-60"
          >
            Anuluj
          </button>
          <button
            type="button" onClick={onConfirm} disabled={busy || confirmDisabled}
            className="h-10 flex-1 rounded-[var(--r-control)] bg-[var(--bad)] text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
