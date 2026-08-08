import { X, Plus, Check, Loader2 } from "lucide-react";

export type CoverOption = { id: string; name: string; url: string };

// Arkusz wyboru okladki (hero lub miniatura) - 1:1 z pickerem w ReviewSummary. Grid 3-kol:
// pierwszy kafel = "Nowe zdjecie" (upload), reszta = zdjecia miejsc listy. Zaznaczony = ring.
export default function CoverPickerSheet({
  open, onClose, title, subtitle, options, currentUrl, onPick, onUploadNew, uploading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  options: CoverOption[];
  currentUrl: string | null;
  onPick: (url: string) => void;
  onUploadNew: () => void;
  uploading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: "82dvh" }}>
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
        <button onClick={onClose} aria-label="Zamknij" className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
          <X className="h-4 w-4" />
        </button>
        <p className="text-lg font-bold pr-8">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{subtitle}</p>
        <div className="overflow-y-auto -mx-1 px-1" style={{ maxHeight: "62dvh" }}>
          <div className="grid grid-cols-3 gap-2 pb-1">
            <button
              onClick={onUploadNew}
              disabled={uploading}
              className="relative aspect-square rounded-2xl border-2 border-dashed border-border/70 flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
              <span className="text-[11px] font-semibold leading-tight text-center px-1">Nowe zdjęcie</span>
            </button>
            {options.map((opt) => {
              const isCurrent = currentUrl === opt.url;
              return (
                <button
                  key={opt.id}
                  onClick={() => onPick(opt.url)}
                  className={`relative aspect-square rounded-2xl overflow-hidden bg-muted active:scale-95 transition-transform ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                >
                  <img src={opt.url} alt={opt.name} loading="lazy" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-semibold text-white leading-tight line-clamp-2 [text-shadow:_0_1px_2px_rgb(0_0_0/60%)]">{opt.name}</span>
                  {isCurrent && (
                    <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center px-4 pt-2 pb-3 leading-relaxed">
              Dodaj miejsca do listy albo wgraj własne zdjęcie, żeby ustawić okładkę.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
