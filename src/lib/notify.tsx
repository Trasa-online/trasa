import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

// Kategorie toastow (jak na referencji): sukces (zielony), ostrzezenie (zolty),
// error (czerwony), info (niebieski). Bialy okragly ikonka po lewej, tytul +
// opis, przycisk zamkniecia (X). Renderowane przez sonner toast.custom (unstyled).
type ToastType = "success" | "warning" | "error" | "info";

const STYLES: Record<ToastType, { wrap: string; icon: string; Icon: typeof Info }> = {
  success: { wrap: "bg-green-50 border-green-100", icon: "text-green-600", Icon: CheckCircle2 },
  warning: { wrap: "bg-amber-50 border-amber-100", icon: "text-amber-500", Icon: AlertCircle },
  error:   { wrap: "bg-red-50 border-red-100",     icon: "text-red-600",   Icon: AlertTriangle },
  info:    { wrap: "bg-blue-50 border-blue-100",   icon: "text-blue-600",  Icon: Info },
};

function show(type: ToastType, title: string, description?: string, duration = 4000) {
  const s = STYLES[type];
  const Ic = s.Icon;
  return toast.custom((id) => (
    <div className={`w-[calc(100vw-2rem)] max-w-md rounded-2xl border ${s.wrap} shadow-lg shadow-black/5 p-3.5 flex items-start gap-3 mb-[calc(4rem+env(safe-area-inset-bottom,0px))]`}>
      <div className="h-11 w-11 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
        <Ic className={`h-5 w-5 ${s.icon}`} strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-bold text-foreground leading-snug">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        onClick={() => toast.dismiss(id)}
        aria-label="Zamknij"
        className="shrink-0 -mt-0.5 -mr-0.5 p-1 text-muted-foreground/60 active:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  ), { duration, unstyled: true });
}

export const notify = {
  success: (title: string, description?: string) => show("success", title, description),
  warning: (title: string, description?: string) => show("warning", title, description),
  error: (title: string, description?: string) => show("error", title, description),
  info: (title: string, description?: string) => show("info", title, description),
};
