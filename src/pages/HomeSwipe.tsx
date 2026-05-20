import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MapPin, ChevronDown, Check, Lock } from "lucide-react";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { MAIN_CATEGORIES } from "@/lib/categories";
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
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => { writeFilters(filters); }, [filters]);

  const todayDate = useMemo(() => new Date(), []);

  // Flat list of subcategory chips: [{ id, label, emoji, mainId }]
  const categoryChips = useMemo(() => {
    const all: { id: string; label: string; emoji: string; mainId: string }[] = [];
    MAIN_CATEGORIES.forEach((cat) => {
      cat.subcategories.forEach((sub) => {
        all.push({ id: sub.id, label: sub.label, emoji: sub.emoji, mainId: cat.id });
      });
    });
    return all;
  }, []);

  const selectedCategory = filters.category;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky filter bar */}
      <div className="shrink-0 bg-background border-b border-border/20">
        {/* City chip row */}
        <div className="flex items-center gap-2 px-4 pt-2 pb-2">
          <button
            onClick={() => setCityPickerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform"
          >
            <MapPin className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-semibold text-foreground">{filters.city}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {selectedCategory && (
            <button
              onClick={() => setFilters((f) => ({ ...f, category: "" }))}
              className="text-xs text-muted-foreground underline underline-offset-2 active:opacity-60"
            >
              Wyczyść filtr
            </button>
          )}
        </div>

        {/* Category chips row */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <button
              onClick={() => setFilters((f) => ({ ...f, category: "" }))}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-[0.96]",
                selectedCategory === ""
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              Wszystko
            </button>
            {categoryChips.map((chip) => {
              const active = selectedCategory === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setFilters((f) => ({ ...f, category: chip.id }))}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-[0.96]",
                    active
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground"
                  )}
                >
                  <span>{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
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

      {/* City picker sheet */}
      <Sheet open={cityPickerOpen} onOpenChange={setCityPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0" style={{ maxHeight: "70vh" }}>
          <div className="px-5 pt-5 pb-2">
            <p className="text-lg font-black">Wybierz miasto</p>
            <p className="text-xs text-muted-foreground mt-0.5">Na razie odblokowana jest tylko Warszawa.</p>
          </div>
          <div className="px-3 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col gap-1">
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
                    setCityPickerOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-colors",
                    active
                      ? "bg-orange-50 border border-orange-200"
                      : disabled
                        ? "opacity-40"
                        : "bg-card active:bg-muted"
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
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default HomeSwipe;
