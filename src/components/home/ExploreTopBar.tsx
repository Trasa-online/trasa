import { useNavigate } from "react-router-dom";
import { Layers, Compass, SlidersHorizontal, Search } from "lucide-react";
import RegionSelect from "@/components/home/RegionSelect";

// Wspoldzielona zawartosc gornej belki dla Eksploracji (feed) i Przegladania (swiper):
// (opcjonalny selektor miasta) + toggle Trasy|Miejsca + filtry + szukanie. Renderuje FRAGMENT
// (bez kontenera) - rodzic dostarcza wiersz naglowka. Dzieki temu widoki maja IDENTYCZNA belke.
//
// 2026-08-05: w EKSPLORACJI (Explore.tsx) selektor miasta zniknal z belki - toggle Trasy|Miejsca
// przejal jego miejsce (lewa strona), a wybor miasta zszedl do sheetu "Filtry" (CityFilterRow).
// Selektor renderuje sie TYLKO gdy podano `onCityChange` (uzywa go jeszcze PlanWizard /plan
// exploreMode, gdzie wybor miasta w belce ma sens). Bez `onCityChange` -> toggle po lewej.
//
// mode: "explore" = feed (Eksploracja aktywna), "browse" = swiper. Toggle nawiguje miedzy
// /eksploruj a /plan (exploreMode) TYLKO w fallbacku (gdy brak onModeChange).
export default function ExploreTopBar({
  mode,
  city,
  cities,
  onCityChange,
  onOpenFilters,
  onOpenSearch,
  activeFilterCount = 0,
  onModeChange,
  hideModeToggle = false,
}: {
  mode: "explore" | "browse";
  // Selektor miasta w belce - renderowany tylko gdy podano onCityChange (PlanWizard).
  // W Eksploracji NIE podajemy tych propsow (miasto wybiera sie w sheecie Filtry).
  city?: string;
  cities?: string[];
  onCityChange?: (city: string) => void;
  onOpenFilters: () => void;
  // Klik lupy -> rodzic rozwija pelnoszerokosciowa wyszukiwarke w belce.
  onOpenSearch?: () => void;
  activeFilterCount?: number;
  // Toggle feed<->swiper. Gdy podane -> lokalna zmiana (seamless, bez nawigacji).
  // Gdy brak -> fallback do nawigacji miedzy /eksploruj a /plan (legacy).
  onModeChange?: (mode: "explore" | "browse") => void;
  // Ukrywa toggle Trasy|Miejsca (2026-07-26: na homepage zostają same Trasy - widok
  // "Miejsca" wstrzymany do czasu zebrania większej liczby lokali). Zdejmuje dostęp
  // do swipera z belki, feed Tras zostaje jedynym widokiem.
  hideModeToggle?: boolean;
}) {
  const navigate = useNavigate();
  const cur = city || "all";
  const showRegion = !!onCityChange;
  const goBrowse = () => (onModeChange ? onModeChange("browse") : navigate("/plan", { state: { exploreMode: true, city: cur } }));
  const goExplore = () => (onModeChange ? onModeChange("explore") : navigate("/eksploruj", { state: { city: cur } }));

  return (
    <>
      {/* Selektor miasta - tylko z onCityChange (PlanWizard). W Eksploracji ukryty. */}
      {showRegion && <RegionSelect city={cur} cities={cities} onCityChange={onCityChange!} />}
      {showRegion && <div className="flex-1" />}

      {/* Toggle Trasy | Miejsca. Bez selektora (Eksploracja) stoi po lewej - w miejscu
          dawnego selektora miasta. Aktywny segment = pomaranczowa orba (gradient) z biala
          ikona, nieaktywny = szara ikona + etykieta. hideModeToggle -> ukryty. */}
      <div className={`shrink-0 items-center rounded-full bg-secondary p-0.5 ${hideModeToggle ? "hidden" : "flex"}`}>
        {mode === "explore" ? (
          <span data-ob="toggle-trasy" className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white shadow-sm" aria-current="true" title="Trasy">
            <Compass className="h-4 w-4" />
          </span>
        ) : (
          <button
            data-ob="toggle-trasy"
            onClick={goExplore}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title="Trasy"
          >
            <Compass className="h-4 w-4" />
            Trasy
          </button>
        )}
        {mode === "browse" ? (
          <span data-ob="toggle-miejsca" className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white shadow-sm" aria-current="true" title="Miejsca">
            <Layers className="h-4 w-4" />
          </span>
        ) : (
          <button
            data-ob="toggle-miejsca"
            onClick={goBrowse}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title="Miejsca"
          >
            <Layers className="h-4 w-4" />
            Miejsca
          </button>
        )}
      </div>

      {/* Bez selektora (Eksploracja): spacer po toggle -> filtry/szukanie na prawo.
          Z selektorem (PlanWizard): spacer jest juz przed toggle, drugiego nie dodajemy. */}
      {!showRegion && <div className="flex-1" />}

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

      {/* Szukaj - rozwija pelnoszerokosciowa wyszukiwarke w belce (rodzic zarzadza stanem) */}
      <button
        onClick={onOpenSearch}
        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-muted active:scale-95 transition-transform"
        aria-label="Szukaj"
      >
        <Search className="h-4 w-4 text-foreground" />
      </button>
    </>
  );
}
