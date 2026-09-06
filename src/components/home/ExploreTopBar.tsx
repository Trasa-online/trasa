import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Layers, Compass, SlidersHorizontal, ChevronLeft } from "lucide-react";
import RegionSelect from "@/components/home/RegionSelect";
import PinnedSearchField from "@/components/layout/PinnedSearchField";
import { haptics } from "@/hooks/useHaptics";

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
  searchValue,
  onSearchChange,
  searchOpen = false,
  onCloseSearch,
  searchInputRef,
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
  // Wyszukiwarka PRZYPIETA w belce (2026-09-06): pole stoi na stale, focus wlacza tryb
  // wynikow. Renderujemy je tylko gdy rodzic poda `onSearchChange` (Eksploracja);
  // PlanWizard uzywa tej samej belki bez wyszukiwarki.
  onOpenSearch?: () => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  // Tryb wynikow: toggle Trasy|Miejsca ustepuje miejsca strzalce powrotu, zeby pole
  // dostalo cala szerokosc belki.
  searchOpen?: boolean;
  onCloseSearch?: () => void;
  // Ref do inputu - rodzic ustawia focus po wejsciu z profilu (deep-link do szukania).
  searchInputRef?: RefObject<HTMLInputElement>;
  activeFilterCount?: number;
  // Toggle feed<->swiper. Gdy podane -> lokalna zmiana (seamless, bez nawigacji).
  // Gdy brak -> fallback do nawigacji miedzy /eksploruj a /plan (legacy).
  onModeChange?: (mode: "explore" | "browse") => void;
  // Ukrywa toggle Trasy|Miejsca (2026-07-26: na homepage zostają same Trasy - widok
  // "Miejsca" wstrzymany do czasu zebrania większej liczby lokali). Zdejmuje dostęp
  // do swipera z belki, feed Tras zostaje jedynym widokiem.
  hideModeToggle?: boolean;
}) {
  const { t } = useTranslation("explore");
  const navigate = useNavigate();
  const cur = city || "all";
  const showRegion = !!onCityChange;
  // Pole wyszukiwania renderujemy tylko tam, gdzie rodzic obsluguje fraze (Eksploracja).
  const showSearch = !!onSearchChange;
  // Lekki "tick" przy przelaczeniu Trasy<->Miejsca (native; no-op na web).
  const goBrowse = () => { haptics.selection(); onModeChange ? onModeChange("browse") : navigate("/plan", { state: { exploreMode: true, city: cur } }); };
  const goExplore = () => { haptics.selection(); onModeChange ? onModeChange("explore") : navigate("/eksploruj", { state: { city: cur } }); };

  return (
    <>
      {/* Selektor miasta - tylko z onCityChange (PlanWizard). W Eksploracji ukryty. */}
      {showRegion && <RegionSelect city={cur} cities={cities} onCityChange={onCityChange!} />}
      {showRegion && <div className="flex-1" />}

      {/* Tryb wynikow: strzalka powrotu zamiast toggle'a (pole dostaje cala belke). */}
      {showSearch && searchOpen && (
        <button
          onClick={onCloseSearch}
          aria-label={t("search.close")}
          className="shrink-0 -ml-1 h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </button>
      )}

      {/* Toggle Trasy | Miejsca. Bez selektora (Eksploracja) stoi po lewej - w miejscu
          dawnego selektora miasta. Aktywny segment = pomaranczowa orba (gradient) z biala
          ikona, nieaktywny = szara ikona + etykieta. hideModeToggle -> ukryty.
          W trybie wynikow chowamy go razem z etykietami - wraca po zamknieciu szukania. */}
      <div className={`shrink-0 items-center rounded-full bg-secondary p-0.5 ${hideModeToggle || (showSearch && searchOpen) ? "hidden" : "flex"}`}>
        {mode === "explore" ? (
          <span data-ob="toggle-trasy" className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white shadow-sm" aria-current="true" title={t("common:filters.routes")}>
            <Compass className="h-4 w-4" />
          </span>
        ) : (
          <button
            data-ob="toggle-trasy"
            onClick={goExplore}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title={t("common:filters.routes")}
          >
            <Compass className="h-4 w-4" />{t("common:filters.routes")}</button>
        )}
        {mode === "browse" ? (
          <span data-ob="toggle-miejsca" className="h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white shadow-sm" aria-current="true" title={t("common:filters.places")}>
            <Layers className="h-4 w-4" />
          </span>
        ) : (
          <button
            data-ob="toggle-miejsca"
            onClick={goBrowse}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/70 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
            title={t("common:filters.places")}
          >
            <Layers className="h-4 w-4" />{t("common:filters.places")}</button>
        )}
      </div>

      {/* Przypiete pole wyszukiwania - wypelnia srodek belki (zastapilo lupe 2026-09-06).
          Bez propsow wyszukiwarki (PlanWizard) zostaje sam spacer jak dawniej. */}
      {showSearch ? (
        <PinnedSearchField
          ref={searchInputRef}
          value={searchValue ?? ""}
          onChange={onSearchChange}
          onFocus={onOpenSearch}
          placeholder={searchOpen ? t("search.placeholder_all") : t("common:buttons.search")}
          aria-label={t("common:buttons.search")}
        />
      ) : (
        /* Bez selektora (Eksploracja): spacer po toggle -> filtry na prawo.
           Z selektorem (PlanWizard): spacer jest juz przed toggle, drugiego nie dodajemy. */
        !showRegion && <div className="flex-1" />
      )}

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
