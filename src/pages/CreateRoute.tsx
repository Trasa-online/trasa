import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CalendarIcon, Search, X } from "lucide-react";
import { forwardGeocodeWithTypes } from "@/lib/googleMaps";
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



function getPlaceEmoji(types: string[]): string {
  if (types.some(t => ["restaurant", "food", "meal_delivery", "meal_takeaway"].includes(t))) return "🍽️";
  if (types.some(t => ["cafe", "bakery"].includes(t))) return "☕";
  if (types.some(t => ["bar", "night_club"].includes(t))) return "🍸";
  if (types.some(t => ["museum"].includes(t))) return "🏛️";
  if (types.some(t => ["park", "natural_feature"].includes(t))) return "🌳";
  if (types.some(t => ["church", "place_of_worship", "synagogue", "mosque"].includes(t))) return "⛪";
  if (types.some(t => ["shopping_mall", "store", "clothing_store", "department_store"].includes(t))) return "🛍️";
  if (types.some(t => ["lodging"].includes(t))) return "🏨";
  if (types.some(t => ["tourist_attraction", "point_of_interest"].includes(t))) return "🏰";
  return "📍";
}

const CreateRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("trip") ?? undefined;
  const dayNumber = searchParams.get("day") ? parseInt(searchParams.get("day")!) : undefined;
  const creatorPlanId = searchParams.get("creatorPlan") ?? undefined;
  const initialUserMessage = searchParams.get("q") ?? undefined;
  const [step, setStep] = useState(creatorPlanId || initialUserMessage ? 2 : 1);
  const [likedPlaces, setLikedPlaces] = useState<string[]>([]);
  const [mustVisitPlaces, setMustVisitPlaces] = useState<{ name: string; emoji: string }[]>([]);

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
  const [mustSearch, setMustSearch] = useState("");
  const [mustSearchResults, setMustSearchResults] = useState<{ name: string; full_address: string; types: string[] }[]>([]);
  const mustSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [preferences, setPreferences] = useState<TripPreferences>({
    numDays: 1,
    pace: "mixed",
    priorities: [],
    startDate: null,
    planningMode: "text",
    city: "",
    folderId,
    dayNumber,
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showSummary, setShowSummary] = useState(false);
  const [finalPlan, setFinalPlan] = useState<any>(null);
  const [finalMessages, setFinalMessages] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<(CreatorPlan & { places: CreatorPlaceItem[] }) | null>(null);

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleMustSearchChange = (value: string) => {
    setMustSearch(value);
    setMustSearchResults([]);
    if (mustSearchTimer.current) clearTimeout(mustSearchTimer.current);
    if (value.length < 2) return;
    mustSearchTimer.current = setTimeout(async () => {
      try {
        const results = await forwardGeocodeWithTypes(`${value} ${preferences.city}`);
        setMustSearchResults(results.slice(0, 6));
      } catch { /* ignore */ }
    }, 400);
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
          <h1 className="text-lg font-semibold">Zaplanuj podróż</h1>
        </div>

        <div className="p-4 space-y-8 max-w-lg mx-auto">

          {/* Date picker — TOP */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Wybierz datę</label>
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
                  {selectedDate ? format(selectedDate, "PPP") : "Wybierz datę"}
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

          {/* City input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Destynacja</label>
            <Input
              placeholder="Wpisz miasto..."
              value={cityInput}
              onChange={e => {
                setCityInput(e.target.value);
                setPreferences(prev => ({ ...prev, city: e.target.value }));
              }}
              className="bg-card h-12"
            />
          </div>

          {/* Must-visit places */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Chętnie odwiedzę</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Szukaj miejsca..."
                value={mustSearch}
                onChange={e => handleMustSearchChange(e.target.value)}
                className="pl-9 bg-card h-12"
              />
              {mustSearchResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {mustSearchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMustVisitPlaces(prev =>
                          prev.some(p => p.name === result.name)
                            ? prev
                            : [...prev, { name: result.name, emoji: getPlaceEmoji(result.types) }]
                        );
                        setMustSearch("");
                        setMustSearchResults([]);
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
            <p className="text-xs text-muted-foreground">
              Np. konkretna restauracja, muzeum czy zabytek — AI uwzględni je w planie.
            </p>
            {mustVisitPlaces.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mustVisitPlaces.map(place => (
                  <div key={place.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-foreground text-background">
                    <span>{place.emoji}</span>
                    <span>{place.name}</span>
                    <button onClick={() => setMustVisitPlaces(prev => prev.filter(p => p.name !== place.name))}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next button */}
          <Button
            onClick={() => {
              const errors: Record<string, string> = {};
              if (!selectedDate) errors.date = "Wybierz datę podróży";
              setValidationErrors(errors);
              if (Object.keys(errors).length === 0) setStep(2);
            }}
            size="lg"
            className="w-full"
          >
            Dalej
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
        <button onClick={() => setStep(1)} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Planowanie trasy</h1>
      </div>

      <div className="flex-1 min-h-0">
        <PlanChatExperience
          preferences={preferences}
          onPlanReady={handlePlanReady}
          likedPlaces={[...likedPlaces, ...mustVisitPlaces.map(p => p.name)]}
          initialUserMessage={initialUserMessage}
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
