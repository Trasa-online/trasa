import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X, Plus, Users } from "lucide-react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import CategoryPicker from "@/components/plan-wizard/CategoryPicker";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";

// Steps: 1=CityPicker, 2=FullCalendarPicker, 3=CategoryPicker, 4=PlaceSwiper
type Step = 1 | 2 | 3 | 4;

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { step?: number; city?: string; date?: string; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; exploreMode?: boolean } | null;

  const [step, setStep] = useState<Step>((returnState?.step as Step) ?? 1);
  const [city, setCity] = useState(returnState?.city ?? "");
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : null);
  const [numDays, setNumDays] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddPlace, setShowAddPlace] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exploreMode = returnState?.exploreMode ?? false;
  const returnLiked = returnState?.likedPlaceNames ?? [];
  const returnSkipped = returnState?.skippedPlaceNames ?? [];

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const handleBack = () => {
    if (step === 1) navigate("/");
    else if (exploreMode && step === 4) setStep(1);
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
            {step === 1 ? (
              <button
                onClick={() => navigate("/sesja/nowa")}
                className="h-9 w-9 flex items-center justify-center -mr-1 shrink-0 text-muted-foreground"
                aria-label="Sesja grupowa"
              >
                <Users className="h-5 w-5" />
              </button>
            ) : step === 4 ? (
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
            if (exploreMode) { setDate(new Date()); setStep(4); }
            else setStep(2);
          }} />
        )}
        {step === 2 && (
          <FullCalendarPicker onConfirm={(selectedDate, days) => { setDate(selectedDate); setNumDays(days); setStep(3); }} />
        )}
        {step === 3 && (
          <CategoryPicker onConfirm={(cats) => { setSelectedCategories(cats); setStep(4); }} />
        )}
        {step === 4 && date && (
          <PlaceSwiper
            city={city}
            date={date}
            numDays={numDays}
            selectedCategories={selectedCategories}
            initialLikedPlaceNames={returnLiked}
            initialSkippedPlaceNames={returnSkipped}
            searchQuery={searchQuery}
            showAddPlace={showAddPlace}
            onAddPlaceClose={() => setShowAddPlace(false)}
            onSuggestPlace={() => setShowAddPlace(true)}
            exploreMode={exploreMode}
          />
        )}
      </div>
    </div>
  );
};

export default PlanWizard;
