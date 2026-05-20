import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MapPin, ChevronDown, Check, Lock } from "lucide-react";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { MAIN_CATEGORIES, getSubcategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

const FILTERS_STORAGE_KEY = "trasa_home_filters";

type AvailableCity = { name: string; available: boolean };

// Only Warszawa is active (matches CityPicker). Others shown as locked.
const AVAILABLE_CITIES: AvailableCity[] = [
  { name: "Warszawa", available: true },
  { name: "Kraków", available: false },
  { name: "Łódź", available: false },
  { name: "Poznań", available: false },
  { name: "Trójmiasto", available: false },
  { name: "Wrocław", available: false },
];

interface StoredFilters {
  city: string;
  category: string; // "" = all
}

function readFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.city === "string" && typeof parsed?.category === "string") return parsed;
    }
  } catch { /* unavailable */ }
  return { city: "Warszawa", category: "" };
}

function writeFilters(f: StoredFilters) {
  try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(f)); } catch { /* unavailable */ }
}

const HomeSwipe = () => {
  const [filters, setFilters] = useState<StoredFilters>(() => readFilters());
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { writeFilters(filters); }, [filters]);

  const todayDate = useMemo(() => new Date(), []);

  const categoryLabel = filters.category
    ? getSubcategoryLabel(filters.category) ?? "Wszystko"
    : "Wszystko";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky filter chip */}
      <div className="shrink-0 bg-background px-4 pt-3 pb-2.5">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-full"
        >
          <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {filters.city}
            <span className="text-muted-foreground font-normal"> · </span>
            {categoryLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* Swiper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PlaceSwiper
          key={`${filters.city}-${filters.category}`}
          city={filters.city}
          date={todayDate}
          numDays={1}
          categoryFilter={filters.category || undefined}
          exploreMode
        />
      </div>

      {/* Filter drawer (city + category) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0" style={{ maxHeight: "85vh" }}>
          <div className="overflow-y-auto px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="mb-5">
              <p className="text-lg font-black">Co przeglądasz</p>
              <p className="text-xs text-muted-foreground mt-0.5">Wybierz miasto i kategorię miejsc.</p>
            </div>

            {/* Miasto */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Miasto</p>
            <div className="flex flex-col gap-1 mb-6">
              {AVAILABLE_CITIES.map((c) => {
                const active = c.name === filters.city;
                const disabled = !c.available;
                return (
                  <button
                    key={c.name}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setFilters((f) => ({ ...f, city: c.name }));
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors",
                      active
                        ? "bg-orange-50 border border-orange-200"
                        : disabled
                          ? "opacity-40"
                          : "bg-card active:bg-muted border border-border/30"
                    )}
                  >
                    <span className="text-sm font-semibold">{c.name}</span>
                    {active && <Check className="h-4 w-4 text-orange-600" />}
                    {disabled && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Wkrótce
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Kategoria */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Kategoria</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setFilters((f) => ({ ...f, category: "" }))}
                className={cn(
                  "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                  filters.category === ""
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground"
                )}
              >
                Wszystko
              </button>
              {MAIN_CATEGORIES.flatMap((cat) =>
                cat.subcategories.map((sub) => {
                  const active = filters.category === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setFilters((f) => ({ ...f, category: sub.id }))}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                        active
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <span>{sub.emoji}</span>
                      <span>{sub.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setDrawerOpen(false)}
              className="w-full py-3.5 mt-2 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
            >
              Pokaż miejsca
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default HomeSwipe;
