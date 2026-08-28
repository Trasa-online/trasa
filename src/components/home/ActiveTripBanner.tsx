import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { useTripShortcut } from "@/hooks/useTripShortcut";

// Mini baner-skrot pod belka eksploracji: wraca jednym tapnieciem do wyjazdu W TRAKCIE, a gdy
// takiego nie ma - do najswiezszego ROBOCZEGO (prosba Nat 2026-08-29). Gdy user nie ma zadnego
// aktywnego wyjazdu, baner sie nie renderuje (zero pustego miejsca w widoku).
export default function ActiveTripBanner() {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const { data: trip } = useTripShortcut(!isAnonymous ? user?.id : null);
  if (!trip) return null;

  const ongoing = trip.stage === "ongoing";
  const cover = resolveStored(trip.cover);
  const title = trip.title || (trip.city ? `Wyjazd do ${trip.city}` : "Twój wyjazd");

  return (
    <div className="px-4 pt-2 shrink-0">
      <button
        onClick={() => { haptics.light(); navigate(`/route/${trip.id}`); }}
        className="w-full flex items-center gap-3 rounded-2xl bg-secondary/70 border border-border/50 pl-2 pr-3 py-2 text-left active:scale-[0.99] transition-transform"
      >
        <span className="h-10 w-10 rounded-xl overflow-hidden bg-[#fcede3] flex items-center justify-center shrink-0">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="h-5 w-5 block"
              style={{
                backgroundColor: "#ef9d78",
                WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
                WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                WebkitMaskSize: "contain", maskSize: "contain",
                WebkitMaskPosition: "center", maskPosition: "center",
              }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {/* Etap wyjazdu: "W trakcie" ma kolor akcentu, "Robocze" jest wyciszone. */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ongoing ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {ongoing ? "W trakcie" : "Robocze"}
            </span>
            {trip.city && <span className="text-[11.5px] text-muted-foreground truncate">{trip.city}</span>}
          </span>
          <span className="block text-[14px] font-semibold text-foreground truncate mt-0.5">{title}</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
