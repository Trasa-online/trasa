import { useNavigate } from "react-router-dom";
import { ChevronLeft, Layers, Compass, SlidersHorizontal } from "lucide-react";
import CitySelect from "@/components/home/CitySelect";

// Wspoldzielona zawartosc gornej belki dla Eksploracji (feed) i Przegladania (swiper):
// selektor miasta (pill) + toggle Przegladaj|Eksploracja + filtry. Renderuje FRAGMENT
// (bez kontenera) - rodzic dostarcza wiersz naglowka (safe-area, ew. back). Dzieki temu
// oba widoki maja IDENTYCZNA belke (te same guziki, ta sama wysokosc).
//
// mode: "explore" = jestesmy w feedzie (Eksploracja aktywna), "browse" = w swiperze
// (Przegladaj aktywne). Toggle nawiguje miedzy /eksploruj a /plan (exploreMode), niosac
// wybrane miasto, zeby zostalo spojne przy przelaczaniu.
export default function ExploreTopBar({
  mode,
  city,
  onCityChange,
  onOpenFilters,
  activeFilterCount = 0,
  onModeChange,
  onBack,
}: {
  mode: "explore" | "browse";
  city: string;
  onCityChange: (city: string) => void;
  onOpenFilters: () => void;
  activeFilterCount?: number;
  // Toggle feed<->swiper. Gdy podane -> lokalna zmiana (seamless, bez nawigacji).
  // Gdy brak -> fallback do nawigacji miedzy /eksploruj a /plan (legacy).
  onModeChange?: (mode: "explore" | "browse") => void;
  // Cofniecie z przegladania na widok glowny (feed). Chevron-left przed selektorem
  // miasta, renderowany TYLKO w trybie "browse".
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const cur = city || "Warszawa";
  const goBrowse = () => (onModeChange ? onModeChange("browse") : navigate("/plan", { state: { exploreMode: true, city: cur } }));
  const goExplore = () => (onModeChange ? onModeChange("explore") : navigate("/eksploruj", { state: { city: cur } }));

  return (
    <>
      {/* Cofnij na widok glowny (feed) - tylko w przegladaniu, obok selektora miasta */}
      {mode === "browse" && onBack && (
        <button
          onClick={onBack}
          className="shrink-0 h-8 w-8 -ml-1 flex items-center justify-center text-foreground active:scale-90 transition-transform"
          aria-label="Wróć"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Selektor miasta (pill) */}
      <CitySelect city={cur} onCityChange={onCityChange} />

      <div className="flex-1" />

      {/* Toggle Przegladaj | Eksploracja (aktywny segment = ikona, nieaktywny = ikona + etykieta) */}
      <div className="shrink-0 flex items-center rounded-full bg-secondary p-0.5">
        {mode === "browse" ? (
          <span className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground shadow-sm" aria-current="true" title="Przeglądaj">
            <Layers className="h-4 w-4" />
          </span>
        ) : (
          <button
            onClick={goBrowse}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title="Przeglądaj"
          >
            <Layers className="h-4 w-4" />
            Przeglądaj
          </button>
        )}
        {mode === "explore" ? (
          <span className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground shadow-sm" aria-current="true" title="Eksploracja">
            <Compass className="h-4 w-4" />
          </span>
        ) : (
          <button
            onClick={goExplore}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title="Eksploracja"
          >
            <Compass className="h-4 w-4" />
            Eksploracja
          </button>
        )}
      </div>

      {/* Filtry */}
      <button
        onClick={onOpenFilters}
        className="relative shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-muted active:scale-95 transition-transform"
        aria-label="Filtry"
      >
        <SlidersHorizontal className="h-4 w-4 text-foreground" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
        )}
      </button>
    </>
  );
}
