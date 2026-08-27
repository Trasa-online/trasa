import { useState } from "react";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { MapPin, Navigation, Map as MapIcon, Loader2, AlertTriangle } from "lucide-react";
import {
  setStartReference,
  markAskedForCity,
  resolveGpsForCity,
  forceGpsReference,
} from "@/lib/distanceReference";
import type { LatLng } from "@/lib/distance";
import StartingLocationPicker from "@/components/plan-wizard/StartingLocationPicker";

// Wybor punktu odniesienia dla dystansu, kontekstowo wzgledem miasta docelowego.
// Rozwiazuje problem: user planujacy z wyprzedzeniem (jest w Warszawie, planuje Gdansk)
// nie chce GPS - chce wskazac, skad zacznie w Gdansku. User na miejscu chce GPS.
//
// "Jestes juz w {city}?"  -> Tak = GPS ("od Ciebie") / Nie = punkt startu na mapie
// miasta docelowego ("od startu") / Pomin. Miasto wyszukiwania = ZAWSZE wybrane miasto;
// lokalizacja wplywa TYLKO na dystans i kolejnosc.
interface LocationPrimerProps {
  open: boolean;
  city: string;
  onClose: () => void;
}

const LocationPrimer = ({ open, city, onClose }: LocationPrimerProps) => {
  const [view, setView] = useState<"ask" | "map" | "confirm">("ask");
  const [checking, setChecking] = useState(false);
  // Double-check: GPS daleko od miasta docelowego (user moze omylkowo kliknal "jestem na miejscu").
  const [farKm, setFarKm] = useState<number | null>(null);
  const [farCoords, setFarCoords] = useState<LatLng | null>(null);
  if (!open) return null;

  const cityLabel = city || "tym mieście";
  // Gest natywny: przeciagniecie panelu w dol = to samo co "pomin".

  // "Tak, jestem w {city}" -> pobierz GPS i ZWALIDUJ dystans do miasta docelowego.
  // Blisko -> ustawiamy "od Ciebie". Daleko -> double-check zamiast slepego ustawienia
  // bezuzytecznego dystansu (np. user w Warszawie omylkowo klika "jestem w Gdansku").
  const here = async () => {
    markAskedForCity(city);
    setChecking(true);
    const res = await resolveGpsForCity(city);
    setChecking(false);
    if (res.status === "onsite") {
      onClose();
    } else if (res.status === "offsite") {
      setFarKm(res.km ? Math.round(res.km) : null);
      setFarCoords(res.coords ?? null);
      setView("confirm");
    } else {
      // Brak zgody / pozycji - zaproponuj wskazanie punktu startu na mapie.
      setView("map");
    }
  };
  const skip = () => {
    markAskedForCity(city);
    setView("ask");
    onClose();
  };
  const { dragProps } = useDragToDismiss({ onDismiss: skip });

  // Wybor punktu startu na mapie miasta docelowego (planuje z wyprzedzeniem).
  if (view === "map") {
    return (
      <div className="fixed inset-0 z-[80] bg-background flex flex-col">
        <StartingLocationPicker
          city={city}
          onConfirm={(loc) => {
            setStartReference({ lat: loc.latitude, lng: loc.longitude });
            markAskedForCity(city);
            setView("ask");
            onClose();
          }}
          onSkip={() => { markAskedForCity(city); setView("ask"); onClose(); }}
        />
      </div>
    );
  }

  // Double-check: GPS pokazuje, ze user jest daleko od miasta docelowego.
  if (view === "confirm") {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={skip}
      >
        <div
          {...dragProps}
          className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold leading-snug">Na pewno jesteś na&nbsp;miejscu?</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {farKm != null
                  ? `Twoja lokalizacja jest ~${farKm} km od ${cityLabel}. Może jeszcze planujesz?`
                  : `Wygląda na to, że nie jesteś teraz w ${cityLabel}. Może jeszcze planujesz?`}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setView("map")}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              <MapIcon className="h-4 w-4" /> Wskażę skąd zacznę
            </button>
            <button
              onClick={() => {
                if (farCoords) forceGpsReference(farCoords);
                onClose();
              }}
              className="w-full py-3.5 rounded-full border border-border text-foreground font-bold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            >
              <Navigation className="h-4 w-4" /> Mimo to użyj mojej lokalizacji
            </button>
            <button
              onClick={skip}
              className="w-full py-2.5 rounded-full text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
            >
              Pomiń
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={skip}
    >
      <div
        {...dragProps}
        className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold leading-snug">Jesteś już w&nbsp;{cityLabel}?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Policzymy dystans do&nbsp;miejsc.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={here}
            disabled={checking}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {checking ? "Sprawdzam…" : <>Tak, jestem w&nbsp;{cityLabel}</>}
          </button>
          <button
            onClick={() => setView("map")}
            disabled={checking}
            className="w-full py-3.5 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <MapIcon className="h-4 w-4" /> Nie, wskażę skąd zacznę
          </button>
          <button
            onClick={skip}
            className="w-full py-2.5 rounded-full text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
          >
            Pomiń
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPrimer;
