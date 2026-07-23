import { useNavigate } from "react-router-dom";
import { ChevronDown, MapPin, Check, Layers, Compass, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UNLOCKED_CITIES } from "@/components/plan-wizard/CityPicker";
import { cn } from "@/lib/utils";

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
}: {
  mode: "explore" | "browse";
  city: string;
  onCityChange: (city: string) => void;
  onOpenFilters: () => void;
  activeFilterCount?: number;
}) {
  const navigate = useNavigate();
  const cur = city || "Warszawa";

  return (
    <>
      {/* Selektor miasta (pill) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[160px]"
            aria-label="Zmień miasto"
          >
            <span className="text-sm font-bold text-foreground truncate">{cur}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-2xl max-h-[60vh] overflow-y-auto">
          {UNLOCKED_CITIES.map((c) => (
            <DropdownMenuItem key={c} onClick={() => onCityChange(c)} className="gap-2 rounded-xl cursor-pointer">
              <MapPin className={cn("h-4 w-4 shrink-0", c === cur ? "text-orange-600" : "text-muted-foreground")} />
              <span className={cn("flex-1", c === cur && "font-bold")}>{c}</span>
              {c === cur && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Toggle Przegladaj | Eksploracja (aktywny segment = ikona, nieaktywny = ikona + etykieta) */}
      <div className="shrink-0 flex items-center rounded-full bg-secondary p-0.5">
        {mode === "browse" ? (
          <span className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground shadow-sm" aria-current="true" title="Przeglądaj">
            <Layers className="h-4 w-4" />
          </span>
        ) : (
          <button
            onClick={() => navigate("/plan", { state: { exploreMode: true, city: cur } })}
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
            onClick={() => navigate("/eksploruj", { state: { city: cur } })}
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
