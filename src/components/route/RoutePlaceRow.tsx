import type { ReactNode } from "react";
import { PlacePhoto } from "@/components/PlacePhoto";

// Oficjalne logo Google (4-kolorowe "G") - guzik "otworz miejsce w Google Maps".
const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Wspoldzielony wiersz miejsca na trasie (widok eksploracji SharedRoute + widok wlasciciela
// ReviewSummary). Duze zdjecie 104px, numer, nazwa (2 linie), chip kategorii + guzik Google.
// dragHandle (opcjonalny) = uchwyt przeciagania po lewej (tryb wlasciciela). note = dodatkowa
// tresc pod wierszem (np. notka autora). visited = wyszarzenie.
export function RoutePlaceRow({ pin, index, categoryLabel, onOpen, onGoogle, dragHandle, note, visited }: {
  pin: any;
  index: number;
  categoryLabel: ReactNode;
  onOpen: () => void;
  onGoogle: () => void;
  dragHandle?: ReactNode;
  note?: ReactNode;
  visited?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-2xl bg-secondary border border-border/40 shadow-sm p-2.5 ${visited ? "opacity-60" : ""}`}>
      <div className="flex items-stretch gap-3">
        {dragHandle}
        <button onClick={onOpen} className="relative h-[104px] w-[104px] shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
          <PlacePhoto pin={pin} className="w-full h-full object-cover" />
          <span className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold flex items-center justify-center">{index + 1}</span>
        </button>
        <div className="flex-1 min-w-0 flex flex-col py-0.5">
          <button onClick={onOpen} className="text-left min-w-0">
            <p className={`text-[15px] font-bold leading-snug line-clamp-2 ${visited ? "line-through" : ""}`}>{pin.place_name}</p>
          </button>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white text-[12px] font-semibold text-foreground">{categoryLabel}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onGoogle(); }}
              aria-label="Otwórz w Google Maps"
              className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-transform shrink-0"
            >
              <GoogleGlyph className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
      {note}
    </div>
  );
}
