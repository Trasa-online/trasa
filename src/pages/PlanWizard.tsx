import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X } from "lucide-react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";

type Step = 1 | 2 | 3;

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnState = location.state as { step?: number; city?: string; date?: string; likedPlaceNames?: string[]; skippedPlaceNames?: string[] } | null;

  const [step, setStep] = useState<Step>((returnState?.step as Step) ?? 1);
  const [city, setCity] = useState(returnState?.city ?? "");
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const returnLiked = returnState?.likedPlaceNames ?? [];
  const returnSkipped = returnState?.skippedPlaceNames ?? [];

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const handleBack = () => {
    if (searchOpen) { setSearchOpen(false); return; }
    if (step === 1) navigate("/");
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

        {searchOpen && step === 3 ? (
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
            <h1 className="flex-1 text-center text-xl font-black tracking-tight">trasa</h1>
            {step === 3 ? (
              <button
                onClick={() => setSearchOpen(true)}
                className="h-9 w-9 flex items-center justify-center -mr-1 shrink-0 text-foreground"
              >
                <Search className="h-5 w-5" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && (
          <CityPicker onConfirm={(selectedCity) => { setCity(selectedCity); setStep(2); }} />
        )}
        {step === 2 && (
          <FullCalendarPicker onConfirm={(selectedDate) => { setDate(selectedDate); setStep(3); }} />
        )}
        {step === 3 && date && (
          <PlaceSwiper
            city={city}
            date={date}
            initialLikedPlaceNames={returnLiked}
            initialSkippedPlaceNames={returnSkipped}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
};

export default PlanWizard;
