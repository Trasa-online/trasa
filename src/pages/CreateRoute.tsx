import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Mic, MessageSquare, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlanChatExperience from "@/components/route/PlanChatExperience";
import RouteSummaryDialog from "@/components/route/RouteSummaryDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TripPreferences {
  numDays: 1 | 2 | 3;
  pace: "active" | "calm" | "mixed";
  priorities: string[];
  startDate: string | null;
  planningMode: "voice" | "text";
  city: string;
  folderId?: string;
  dayNumber?: number;
}

const PRIORITY_OPTIONS = [
  { id: "good_food", label: "Dobre jedzenie", emoji: "🍽️" },
  { id: "nice_views", label: "Ładne widoki", emoji: "🌅" },
  { id: "long_walks", label: "Długie spacery", emoji: "🚶" },
  { id: "museums", label: "Muzea i kultura", emoji: "🏛️" },
  { id: "nightlife", label: "Życie nocne", emoji: "🌙" },
  { id: "shopping", label: "Zakupy", emoji: "🛍️" },
  { id: "local_vibes", label: "Lokalne klimaty", emoji: "🎭" },
  { id: "photography", label: "Fotografia", emoji: "📸" },
];

const CreateRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("trip") ?? undefined;
  const dayNumber = searchParams.get("day") ? parseInt(searchParams.get("day")!) : undefined;
  const [step, setStep] = useState(1);
  const [customPriority, setCustomPriority] = useState("");
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

  if (loading) return null;
  if (!user) {
    navigate("/auth");
    return null;
  }

  const togglePriority = (id: string) => {
    setPreferences(prev => ({
      ...prev,
      priorities: prev.priorities.includes(id)
        ? prev.priorities.filter(p => p !== id)
        : [...prev.priorities, id],
    }));
  };

  const addCustomPriority = () => {
    const trimmed = customPriority.trim();
    if (trimmed && !preferences.priorities.includes(trimmed)) {
      setPreferences(prev => ({
        ...prev,
        priorities: [...prev.priorities, trimmed],
      }));
      setCustomPriority("");
    }
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
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40">
          <button onClick={() => navigate("/")} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Zaplanuj podróż</h1>
        </div>

        <div className="p-4 space-y-6 max-w-lg mx-auto">
          {/* City */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Dokąd jedziesz?</label>
            <Input
              placeholder="np. Kraków, Warszawa, Rzym..."
              value={preferences.city}
              onChange={e => {
                setPreferences(prev => ({ ...prev, city: e.target.value }));
                if (e.target.value.trim()) setValidationErrors(prev => { const { city, ...rest } = prev; return rest; });
              }}
              className={cn("bg-card", validationErrors.city && "border-destructive")}
            />
            {validationErrors.city && <p className="text-xs text-destructive">{validationErrors.city}</p>}
          </div>

          {/* Days */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ile dni?</label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setPreferences(prev => ({ ...prev, numDays: n }))}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-medium transition-colors border",
                    preferences.numDays === n
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  )}
                >
                  {n} {n === 1 ? "dzień" : "dni"}
                </button>
              ))}
            </div>
          </div>

          {/* Pace */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tempo dnia</label>
            <div className="flex gap-2">
              {[
                { id: "active" as const, label: "Aktywne", emoji: "⚡" },
                { id: "mixed" as const, label: "Mieszane", emoji: "⚖️" },
                { id: "calm" as const, label: "Spokojne", emoji: "☕" },
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => setPreferences(prev => ({ ...prev, pace: option.id }))}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-medium transition-colors border",
                    preferences.pace === option.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  )}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Co jest dla Ciebie ważne?</label>
            {validationErrors.priorities && <p className="text-xs text-destructive">{validationErrors.priorities}</p>}
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => togglePriority(option.id)}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm transition-colors border",
                    preferences.priorities.includes(option.id)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  )}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
              {/* Custom priorities */}
              {preferences.priorities
                .filter(p => !PRIORITY_OPTIONS.some(o => o.id === p))
                .map(custom => (
                  <button
                    key={custom}
                    onClick={() => togglePriority(custom)}
                    className="px-3 py-2 rounded-full text-sm transition-colors border bg-foreground text-background border-foreground"
                  >
                    {custom}
                  </button>
                ))}
            </div>
            {/* Custom priority input */}
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Inne..."
                value={customPriority}
                onChange={e => setCustomPriority(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomPriority())}
                className="flex-1 bg-card"
              />
              <Button variant="outline" size="sm" onClick={addCustomPriority} disabled={!customPriority.trim()}>
                Dodaj
              </Button>
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Wybierz datę</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-card",
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
            <p className="text-xs text-muted-foreground">Data wpływa na Twój plan podróży</p>
          </div>

          {/* Planning mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tryb planowania</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPreferences(prev => ({ ...prev, planningMode: "text" }))}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center gap-2",
                  preferences.planningMode === "text"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Tekst
              </button>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, planningMode: "voice" }))}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium transition-colors border flex items-center justify-center gap-2",
                  preferences.planningMode === "voice"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                <Mic className="h-4 w-4" />
                Rozmowa
              </button>
            </div>
          </div>

          {/* Next button */}
          <Button
            onClick={() => {
              const errors: Record<string, string> = {};
              if (!preferences.city.trim()) errors.city = "Wpisz miasto docelowe";
              if (preferences.priorities.length === 0) errors.priorities = "Wybierz przynajmniej jeden priorytet";
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
