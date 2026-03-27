import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CalendarIcon, Mic } from "lucide-react";
import { geocodeCity } from "@/lib/googleMaps";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlanChatExperience from "@/components/route/PlanChatExperience";
import RouteSummaryDialog from "@/components/route/RouteSummaryDialog";
import CreatorPlanSheet from "@/components/home/CreatorPlanSheet";
import type { CreatorPlan, CreatorPlaceItem } from "@/components/home/CreatorPlanCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TripPreferences {
  numDays: 1;
  pace: "active" | "calm" | "mixed";
  priorities: string[];
  startDate: string | null;
  planningMode: "voice" | "text";
  city: string;
  folderId?: string;
  dayNumber?: number;
}




const CreateRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wizardState = (location.state as { city?: string; date?: string; fromTemplate?: boolean; routeId?: string; initialPlan?: any; likedPlaceNames?: string[]; skippedPlaceNames?: string[] } | null);
  const fromTemplate = wizardState?.fromTemplate ?? false;
  const templateInitialPlan = wizardState?.initialPlan ?? null;
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("trip") ?? undefined;
  const dayNumber = searchParams.get("day") ? parseInt(searchParams.get("day")!) : undefined;
  const creatorPlanId = searchParams.get("creatorPlan") ?? undefined;
  const initialUserMessage = searchParams.get("q") ?? undefined;
  const wizardLikedPlaces = wizardState?.likedPlaceNames ?? [];
  const wizardSkippedPlaces = wizardState?.skippedPlaceNames ?? [];
  const [step, setStep] = useState(creatorPlanId || initialUserMessage || fromTemplate || wizardLikedPlaces.length > 0 ? 2 : 1);
  const [likedPlaces, setLikedPlaces] = useState<string[]>(wizardLikedPlaces);

  useEffect(() => {
    if (!creatorPlanId) return;
    supabase
      .from("creator_places")
      .select("place_name")
      .eq("plan_id", creatorPlanId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data?.length) setLikedPlaces(data.map(p => p.place_name));
      });
  }, [creatorPlanId]);
  const [cityResults, setCityResults] = useState<{ name: string; full_address: string }[]>([]);
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cityInput, setCityInput] = useState(wizardState?.city ?? "");
  const [idealDay, setIdealDay] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const wizardDate = wizardState?.date ? new Date(wizardState.date) : undefined;
  const [preferences, setPreferences] = useState<TripPreferences>({
    numDays: 1,
    pace: "mixed",
    priorities: [],
    startDate: wizardDate ? wizardDate.toISOString().slice(0, 10) : null,
    planningMode: "text",
    city: wizardState?.city ?? "",
    folderId,
    dayNumber,
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(wizardDate);
  const [showSummary, setShowSummary] = useState(false);
  const [finalPlan, setFinalPlan] = useState<any>(null);
  const [finalMessages, setFinalMessages] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<(CreatorPlan & { places: CreatorPlaceItem[] }) | null>(null);

  const { t } = useTranslation("create-route");

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleCityInputChange = (value: string) => {
    setCityInput(value);
    setPreferences(prev => ({ ...prev, city: value }));
    setCityResults([]);
    if (cityTimer.current) clearTimeout(cityTimer.current);
    if (value.length < 2) return;
    cityTimer.current = setTimeout(async () => {
      try {
        const results = await geocodeCity(value);
        setCityResults(results);
      } catch { /* ignore */ }
    }, 350);
  };

  const handleToggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as any[])
        .map((r: any) => r[0].transcript)
        .join(" ");
      setIdealDay(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setPreferences(prev => ({
      ...prev,
      startDate: date ? format(date, "yyyy-MM-dd") : null,
    }));
  };

  const handlePlanReady = (plan: any, messages: any[]) => {
    setFinalPlan(plan);
    setFinalMessages(messages);
    setShowSummary(true);
  };

  // Step 1: Preferences
  if (step === 1) {
    return (
      <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40">
          <button onClick={() => navigate("/")} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
        </div>

        <div className="p-4 space-y-8 max-w-lg mx-auto">

          {/* Date picker — TOP */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("date_label")}</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-card h-12",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : t("date_placeholder")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => { const today = new Date(); today.setHours(0, 0, 0, 0); const d = new Date(date); d.setHours(0, 0, 0, 0); return d.getTime() < today.getTime(); }}
                  initialFocus
                  weekStartsOn={1}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {validationErrors.date && <p className="text-xs text-destructive">{validationErrors.date}</p>}
          </div>

          {/* City input with autocomplete */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("city_label")}</label>
            <div className="relative">
              <Input
                placeholder={t("city_placeholder")}
                value={cityInput}
                onChange={e => handleCityInputChange(e.target.value)}
                className="bg-card h-12"
                autoComplete="off"
              />
              {cityResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {cityResults.map((result, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCityInput(result.name);
                        setPreferences(prev => ({ ...prev, city: result.name }));
                        setCityResults([]);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors border-b border-border/40 last:border-b-0"
                    >
                      <p className="text-sm font-medium">{result.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.full_address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {validationErrors.city && <p className="text-xs text-destructive">{validationErrors.city}</p>}
          </div>

          {/* Ideal day */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("ideal_day_label")}</label>
            <div className="relative">
              <Textarea
                placeholder={t("ideal_day_placeholder")}
                value={idealDay}
                onChange={e => setIdealDay(e.target.value)}
                className="min-h-[120px] text-base resize-none pr-12 bg-card"
                maxLength={600}
              />
              <button
                type="button"
                onClick={handleToggleListen}
                className={cn(
                  "absolute bottom-3 right-3 p-2 rounded-full transition-colors",
                  isListening
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            {isListening && (
              <p className="text-xs text-red-500">Słucham...</p>
            )}
          </div>

          {/* Next button */}
          <Button
            onClick={() => {
              const errors: Record<string, string> = {};
              if (!selectedDate) errors.date = t("date_error");
              setValidationErrors(errors);
              if (Object.keys(errors).length === 0) setStep(2);
            }}
            size="lg"
            className="w-full"
          >
            {t("next")}
          </Button>
        </div>
      </div>

      <CreatorPlanSheet
        plan={selectedPlan}
        open={!!selectedPlan}
        onOpenChange={open => { if (!open) setSelectedPlan(null); }}
        onPersonalize={plan => {
          setLikedPlaces(plan.places.map(p => p.place_name));
          setSelectedPlan(null);
          setStep(2);
        }}
      />
      </>
    );
  }

  // Step 2: Chat
  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40 flex-shrink-0">
        <button onClick={() => fromTemplate ? navigate("/plan") : setStep(1)} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t("planning_title")}</h1>
      </div>

      <div className="flex-1 min-h-0">
        <PlanChatExperience
          preferences={preferences}
          onPlanReady={handlePlanReady}
          likedPlaces={likedPlaces}
          skippedPlaces={wizardSkippedPlaces}
          idealDay={idealDay}
          initialUserMessage={initialUserMessage}
          initialPlan={templateInitialPlan ?? undefined}
        />
      </div>

      {/* Summary dialog */}
      {finalPlan && (
        <RouteSummaryDialog
          open={showSummary}
          onOpenChange={setShowSummary}
          plan={finalPlan}
          preferences={preferences}
          messages={finalMessages}
        />
      )}
    </div>
  );
};

export default CreateRoute;
