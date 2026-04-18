import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X, Plus } from "lucide-react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import CategoryPicker from "@/components/plan-wizard/CategoryPicker";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";

// Steps: 1=CityPicker, 2=FullCalendarPicker, 3=CategoryPicker, 4=PlaceSwiper (one category batch)
type Step = 1 | 2 | 3 | 4;

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { step?: number; city?: string; date?: string; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; exploreMode?: boolean } | null;

  const [step, setStep] = useState<Step>((returnState?.step as Step) ?? 1);
  const [city, setCity] = useState(returnState?.city ?? "");
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : null);
  const [numDays, setNumDays] = useState(1);

  // Iterative category flow state
  const [currentCategory, setCurrentCategory] = useState<string>("");
  const [visitedCategories, setVisitedCategories] = useState<string[]>([]);
  const [allLikedNames, setAllLikedNames] = useState<string[]>(returnState?.likedPlaceNames ?? []);
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

  const handleSelectCategory = (category: string) => {
    setCurrentCategory(category);
    setVisitedCategories(prev => prev.includes(category) ? prev : [...prev, category]);
    setStep(4);
  };

  // Called by PlaceSwiper when the 20-place batch is exhausted
  const handleBatchComplete = (newLikedNames: string[]) => {
    setAllLikedNames(newLikedNames);
    setStep(3);
  };

  // "Show all" = skip category filter, go straight to full swiper
  const handleShowAll = () => {
    setCurrentCategory("");
    setStep(4);
  };

  const handleBack = () => {
    if (step === 1) navigate("/");
    else if (step === 4) setStep(3);          // batch → back to category picker
    else setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={handleBack}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
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
        ) : (
          <>
            <div className="flex-1" />
            {step === 4 ? (
              <div className="flex items-center gap-1 -mr-1">
                <button
                  onClick={() => navigate("/historia", { state: { fromCity: city } })}
                  className="text-sm text-muted-foreground font-medium px-2 py-1"
                >
                  Zakończ
                </button>
                <button
                  onClick={() => setShowAddPlace(true)}
                  className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="w-9" />
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && (
          <CityPicker onConfirm={(selectedCity) => {
            setCity(selectedCity);
            if (exploreMode) { setDate(new Date()); setCurrentCategory(""); setStep(4); }
            else setStep(2);
          }} />
        )}
        {step === 2 && (
          <FullCalendarPicker onConfirm={(selectedDate, days) => {
            setDate(selectedDate);
            setNumDays(days);
            setStep(3);
          }} />
        )}
        {step === 3 && (
          <CategoryPicker
            onSelect={handleSelectCategory}
            onShowAll={handleShowAll}
            visitedCategories={visitedCategories}
            likedCount={allLikedNames.length}
          />
        )}
        {step === 4 && date && (
          <PlaceSwiper
            city={city}
            date={date}
            numDays={numDays}
            categoryFilter={currentCategory || undefined}
            initialLikedPlaceNames={allLikedNames}
            initialSkippedPlaceNames={allSkippedNames}
            searchQuery={searchQuery}
            showAddPlace={showAddPlace}
            onAddPlaceClose={() => setShowAddPlace(false)}
            onSuggestPlace={() => setShowAddPlace(true)}
            onBatchComplete={currentCategory ? handleBatchComplete : undefined}
            exploreMode={exploreMode}
          />
        )}
      </div>
    </div>
  );
};

export default PlanWizard;
