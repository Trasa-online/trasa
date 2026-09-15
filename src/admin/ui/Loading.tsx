// Jedyne ladowanie w panelu. Do 15.09.2026 kazdy modul rysowal wlasne (15 plikow).
// `Spinner` to ta sama animacja w wersji do wstawienia w guzik albo w miniature -
// dzieki niemu zaden modul nie importuje `Loader2` na wlasna reke.
import { Loader2 } from "lucide-react";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function Loading({ label = "Ładowanie…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--stone)]">
      <Spinner />
      {label}
    </div>
  );
}
