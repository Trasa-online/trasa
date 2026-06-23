import { MapPin } from "lucide-react";
import { requestLocation, markGeoPrimed } from "@/hooks/useGeolocation";

// Zgoda na lokalizacje "w kontekscie": nasz ekran "po co", dopiero potem systemowy prompt.
// Pokazywany raz (flaga w localStorage ustawiana po decyzji). Brak zgody = chip dystansu
// po prostu sie nie pojawia, reszta dziala normalnie.
interface LocationPrimerProps {
  open: boolean;
  onClose: () => void;
}

const LocationPrimer = ({ open, onClose }: LocationPrimerProps) => {
  if (!open) return null;

  const enable = async () => {
    markGeoPrimed();
    onClose();
    await requestLocation();
  };
  const skip = () => {
    markGeoPrimed();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={skip}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-black leading-snug">Pokażemy, jak blisko jesteś</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Trasa pokaże dystans do polecanych miejsc i&nbsp;punktów Twojej trasy. Lokalizacja liczona jest na&nbsp;Twoim telefonie i&nbsp;nigdzie jej nie&nbsp;zapisujemy.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={enable}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
          >
            Włącz lokalizację
          </button>
          <button
            onClick={skip}
            className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
          >
            Nie teraz
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPrimer;
