import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X, Plus, Filter, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { usePostHog } from "@posthog/react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MAIN_CATEGORIES, getSubcategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

// Steps: 1=CityPicker, 2=FullCalendarPicker, 4=PlaceSwiper.
// Step 3 (CategoryPicker) został usunięty - kategorie filtruje się teraz inline
// w TopBar (chip + drawer multi-select) w trakcie swipe'owania.
type Step = 1 | 2 | 4;

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const posthog = usePostHog();
  const returnState = location.state as { step?: number; city?: string; date?: string; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; exploreMode?: boolean } | null;

  // Mapuj legacy step 3 → 4 (CategoryPicker usunięty)
  const initialStep: Step = (() => {
    const s = returnState?.step;
    if (s === 1 || s === 2 || s === 4) return s;
    if (s === 3) return 4;
    return 1;
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [city, setCity] = useState(returnState?.city ?? "");
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : null);
  const [numDays, setNumDays] = useState(1);

  // Multi-select kategorii (puste = wszystkie)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);

  const allLikedNames: string[] = returnState?.likedPlaceNames ?? [];
  const allSkippedNames: string[] = returnState?.skippedPlaceNames ?? [];

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddPlace, setShowAddPlace] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exploreMode = returnState?.exploreMode ?? false;

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const categoryLabel = useMemo(() => {
    if (selectedCategories.length === 0) return "Wszystko";
    if (selectedCategories.length === 1) return getSubcategoryLabel(selectedCategories[0]) ?? "Wybrane";
    return `${selectedCategories.length} kategorie`;
  }, [selectedCategories]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((c) => c !== id) : [...prev, id];
      posthog.capture("plan_category_toggled", { category: id, selected: !has, total_selected: next.length });
      return next;
    });
  };

  const handleBack = () => {
    if (step === 1) navigate("/");
    else if (step === 4) setStep(2);    // back to calendar
    else setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={handleBack}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
          aria-label="Wróć"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {searchOpen && step === 4 ? (
          <>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj miejsca…"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="h-9 w-9 flex items-center justify-center -mr-1 shrink-0 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : step === 4 ? (
          <>
            {/* Akcje + chip filtru kategorii - chip ostatni (po prawej) */}
            <div className="flex-1" />
            <button
              onClick={() => {
                if (!user || isAnonymous) {
                  try {
                    localStorage.setItem("trasa_guest_plan", JSON.stringify({
                      city,
                      date: date?.toISOString() ?? null,
                      likedPlaceNames: allLikedNames,
                    }));
                  } catch { /* unavailable */ }
                  openAuthDrawer({ mode: "register", hint: "save_route" });
                  return;
                }
                navigate("/home");
              }}
              className="text-sm text-muted-foreground font-medium px-2 py-1"
            >
              Zakończ
            </button>
            <button
              onClick={() => setShowAddPlace(true)}
              className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
              aria-label="Dodaj miejsce"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
              aria-label="Szukaj"
            >
              <Search className="h-5 w-5" />
            </button>
            {/* Chip filtru - na prawym koncu */}
            <button
              onClick={() => setCategoryDrawerOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[140px]"
            >
              <Filter className="h-3.5 w-3.5 text-orange-600 shrink-0" />
              <span className="text-sm font-semibold text-foreground truncate">{categoryLabel}</span>
            </button>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && (
          <CityPicker onConfirm={(selectedCity) => {
            setCity(selectedCity);
            posthog.capture("plan_city_selected", { city: selectedCity, explore_mode: exploreMode });
            if (exploreMode) { setDate(new Date()); setStep(4); }
            else setStep(2);
          }} />
        )}
        {step === 2 && (
          <FullCalendarPicker onConfirm={(selectedDate, days) => {
            setDate(selectedDate);
            setNumDays(days);
            setStep(4); // skip CategoryPicker - kategorie filtruje sie w TopBar krok 4
          }} />
        )}
        {step === 4 && date && (
          <PlaceSwiper
            city={city}
            date={date}
            numDays={numDays}
            categoryFilter={selectedCategories.length > 0 ? selectedCategories : undefined}
            initialLikedPlaceNames={allLikedNames}
            initialSkippedPlaceNames={allSkippedNames}
            searchQuery={searchQuery}
            showAddPlace={showAddPlace}
            onAddPlaceClose={() => setShowAddPlace(false)}
            onSuggestPlace={() => setShowAddPlace(true)}
            exploreMode={exploreMode}
          />
        )}
      </div>

      {/* Category filter drawer - multi-select grouped by main category */}
      <Sheet open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden" style={{ maxHeight: "85vh" }}>
          {/* X w wrapperze - shadcn [&>button]:hidden ukrywa direct child buttons, wrap broni przed tym */}
          <div>
            <button
              type="button"
              onClick={() => setCategoryDrawerOpen(false)}
              className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70 transition-colors shadow-sm"
              aria-label="Zamknij"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 mb-5 pr-12">
              <div>
                <p className="text-lg font-black">Filtruj kategorie</p>
                <p className="text-xs text-muted-foreground mt-0.5">Domyślnie pokazujemy wszystkie miejsca. Możesz zaznaczyć kilka.</p>
              </div>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-muted-foreground underline underline-offset-2 active:opacity-60 shrink-0"
                >
                  Wyczyść
                </button>
              )}
            </div>

            {/* "Wszystko" - reset */}
            <button
              onClick={() => setSelectedCategories([])}
              className={cn(
                "mb-4 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                selectedCategories.length === 0
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              Wszystko
            </button>

            {/* Podkategorie pogrupowane wg MAIN_CATEGORIES */}
            <div className="space-y-4 mb-5">
              {MAIN_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{cat.emoji}</span>
                    <p className="text-sm font-bold text-foreground">{cat.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sub) => {
                      const active = selectedCategories.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => toggleCategory(sub.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-muted text-foreground border-transparent"
                          )}
                        >
                          <span>{sub.emoji}</span>
                          <span>{sub.label}</span>
                          {active && <Check className="h-3.5 w-3.5 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCategoryDrawerOpen(false)}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
            >
              Pokaż miejsca
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlanWizard;
