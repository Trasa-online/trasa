// Jedyne ladowanie w panelu. Do 15.09.2026 kazdy modul rysowal wlasne (15 plikow).
import { Loader2 } from "lucide-react";

export function Loading({ label = "Ładowanie…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--stone)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
