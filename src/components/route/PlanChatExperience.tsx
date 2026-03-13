import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2, Brain, Zap, Users, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import DayPinList, { type PlanPin } from "./DayPinList";
import PlaceDetailDrawer from "./PlaceDetailDrawer";
import AddPinSheet from "./AddPinSheet";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DayMetrics {
  total_walking_km?: number;
  crowd_level?: "low" | "medium" | "high";
  energy_cost?: "low" | "medium" | "high";
}

interface RoutePlan {
  city: string;
  days: {
    day_number: number;
    day_metrics?: DayMetrics;
    pins: PlanPin[];
  }[];
}

interface TripPreferences {
  numDays: number;
  pace: string;
  priorities: string[];
  startDate: string | null;
  planningMode: string;
  city: string;
  folderId?: string;
  dayNumber?: number;
}

interface PlanChatExperienceProps {
  preferences: TripPreferences;
  onPlanReady: (plan: RoutePlan, messages: ChatMessage[]) => void;
  likedPlaces?: string[];
}

// ── Mock plan data for Kraków ────────────────────────────────────────────────

type MockPin = Omit<PlanPin, "day_number">;

const MOCK_PINS_DAY1: MockPin[] = [
  { place_name: "Wzgórze Wawelskie", address: "Wawel 5, 31-001 Kraków", description: "Symboliczne serce Krakowa — zamek, katedra i panorama Wisły.", suggested_time: "10:00", duration_minutes: 90, category: "monument", latitude: 50.0542, longitude: 19.9354, walking_time_from_prev: null, distance_from_prev: null },
  { place_name: "Kazimierz", address: "ul. Szeroka, 31-053 Kraków", description: "Klimatyczna żydowska dzielnica pełna kawiarni i galerii.", suggested_time: "11:50", duration_minutes: 60, category: "walk", latitude: 50.0493, longitude: 19.9451, walking_time_from_prev: "20 min", distance_from_prev: "1.5 km" },
  { place_name: "Mleczarnia", address: "ul. Meiselsa 20, 31-058 Kraków", description: "Kultowa knajpka na Kazimierzu — śledzie, bigos i wnętrze jak z PRL.", suggested_time: "13:00", duration_minutes: 75, category: "restaurant", latitude: 50.0500, longitude: 19.9462, walking_time_from_prev: "8 min", distance_from_prev: "600 m" },
  { place_name: "Rynek Główny", address: "Rynek Główny, 31-042 Kraków", description: "Największy rynek Europy Środkowej — Sukiennice, Kościół Mariacki, hejnał.", suggested_time: "14:30", duration_minutes: 60, category: "monument", latitude: 50.0617, longitude: 19.9373, walking_time_from_prev: "20 min", distance_from_prev: "1.5 km" },
  { place_name: "Cafe Camelot", address: "ul. Tomasza 17, 31-027 Kraków", description: "Legendarna krakowska kawiarnia — lody z bitą śmietaną i spokojna atmosfera.", suggested_time: "15:45", duration_minutes: 45, category: "cafe", latitude: 50.0639, longitude: 19.9357, walking_time_from_prev: "8 min", distance_from_prev: "600 m" },
  { place_name: "Restauracja Miód Malina", address: "ul. Grodzka 40, 31-044 Kraków", description: "Polska kuchnia w sercu Starego Miasta — żurek, pierogi, bigos.", suggested_time: "19:00", duration_minutes: 90, category: "restaurant", latitude: 50.0579, longitude: 19.9386, walking_time_from_prev: "12 min", distance_from_prev: "900 m" },
];

const MOCK_PINS_DAY2: MockPin[] = [
  { place_name: "Fabryka Schindlera", address: "ul. Lipowa 4, 30-702 Kraków", description: "Muzeum historii Krakowa podczas II WŚ — zarezerwuj bilet wcześniej.", suggested_time: "10:00", duration_minutes: 120, category: "museum", latitude: 50.0447, longitude: 19.9440, walking_time_from_prev: null, distance_from_prev: null },
  { place_name: "Plac Bohaterów Getta", address: "Plac Bohaterów Getta, 30-543 Kraków", description: "Puste krzesła upamiętniające krakowskie getto — chwila refleksji.", suggested_time: "12:30", duration_minutes: 30, category: "monument", latitude: 50.0468, longitude: 19.9467, walking_time_from_prev: "8 min", distance_from_prev: "600 m" },
  { place_name: "Lunch w Podgórzu", address: "ul. Zabłocie, 30-701 Kraków", description: "Modna dzielnica z galeriami i świetnymi restauracjami na lunch.", suggested_time: "13:15", duration_minutes: 75, category: "restaurant", latitude: 50.0455, longitude: 19.9491, walking_time_from_prev: "5 min", distance_from_prev: "400 m" },
  { place_name: "Muzeum Narodowe w Krakowie", address: "al. 3 Maja 1, 30-062 Kraków", description: "Najważniejsze muzeum sztuki polskiej — od średniowiecza po współczesność.", suggested_time: "15:00", duration_minutes: 120, category: "museum", latitude: 50.0591, longitude: 19.9248, walking_time_from_prev: "30 min", distance_from_prev: "2.2 km" },
  { place_name: "Kolacja przy Plantach", address: "ul. Krupnicza 20, 31-123 Kraków", description: "Wieczór w modnej części miasta pełnej restauracji i barów.", suggested_time: "19:30", duration_minutes: 90, category: "restaurant", latitude: 50.0636, longitude: 19.9307, walking_time_from_prev: "15 min", distance_from_prev: "1.1 km" },
];

const MOCK_PINS_DAY3: MockPin[] = [
  { place_name: "Nowa Huta", address: "al. Róż 1, 31-621 Kraków", description: "Zaplanowane miasto z epoki stalinizmu — architektura jak z ZSRR.", suggested_time: "10:00", duration_minutes: 120, category: "walk", latitude: 50.0681, longitude: 20.0487, walking_time_from_prev: null, distance_from_prev: null },
  { place_name: "Lunch w Nowej Hucie", address: "os. Centrum A, 31-901 Kraków", description: "Nieturystyczna restauracja w sercu socjalistycznej dzielnicy.", suggested_time: "12:30", duration_minutes: 75, category: "restaurant", latitude: 50.0683, longitude: 20.0471, walking_time_from_prev: "5 min", distance_from_prev: "400 m" },
  { place_name: "Bulwary Wiślane", address: "Bulwar Czerwieński, Kraków", description: "Spacer wzdłuż Wisły pod Wawelem — złota godzina i tratwy z barami.", suggested_time: "16:00", duration_minutes: 75, category: "walk", latitude: 50.0510, longitude: 19.9320, walking_time_from_prev: "30 min (tramwaj)", distance_from_prev: "8 km" },
  { place_name: "Kolacja — pożegnanie z Krakowem", address: "ul. Poselska 24, 31-002 Kraków", description: "Ostatnia kolacja z widokiem na Wawel — wspomnienia do zabrania ze sobą.", suggested_time: "19:30", duration_minutes: 90, category: "restaurant", latitude: 50.0563, longitude: 19.9388, walking_time_from_prev: "12 min", distance_from_prev: "900 m" },
];

const ALL_MOCK_DAYS = [MOCK_PINS_DAY1, MOCK_PINS_DAY2, MOCK_PINS_DAY3];

function buildMockPlan(numDays: number): RoutePlan {
  return {
    city: "Kraków",
    days: Array.from({ length: Math.min(numDays, 3) }, (_, i) => ({
      day_number: i + 1,
      day_metrics: { total_walking_km: 7 + i, crowd_level: "medium" as const, energy_cost: "medium" as const },
      pins: (ALL_MOCK_DAYS[i] ?? MOCK_PINS_DAY1).map(p => ({ ...p, day_number: i + 1 })),
    })),
  };
}

const INITIAL_SUGGESTIONS = ["Wygląda świetnie! ✓", "Zmień restaurację", "Za dużo chodzenia", "Dodaj nocne życie"];

function parseSuggestions(message: string): { cleanMessage: string; suggestions: string[] } {
  const match = message.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
  if (!match) return { cleanMessage: message, suggestions: [] };
  try {
    const suggestions = JSON.parse(match[1]);
    return {
      cleanMessage: message.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "").trim(),
      suggestions: Array.isArray(suggestions) ? suggestions : [],
    };
  } catch {
    return { cleanMessage: message.replace(/<suggestions>[\s\S]*?<\/suggestions>/, "").trim(), suggestions: [] };
  }
}

// ── Skeleton shown while the plan is being generated ────────────────────────
function PlanSkeleton({ numDays }: { numDays: number }) {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: numDays }).map((_, di) => (
        <div key={di} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-28 rounded-full" />
          {Array.from({ length: 4 }).map((_, pi) => (
            <div key={pi} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </div>
              <Skeleton className="h-3 w-10 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Render a single bubble with **bold** markdown support
function renderBubble(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const PlanChatExperience = ({ preferences, onPlanReady, likedPlaces }: PlanChatExperienceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [editCount, setEditCount] = useState(0);
  const [preparingPlan, setPreparingPlan] = useState(false);
  const [planHistory, setPlanHistory] = useState<RoutePlan[]>([]);
  const [selectedPin, setSelectedPin] = useState<PlanPin | null>(null);
  const [addPinDay, setAddPinDay] = useState<number | null>(null);
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [alternativesFor, setAlternativesFor] = useState<{ pin: PlanPin; dayNumber: number; pinIndex: number } | null>(null);
  const [alternatives, setAlternatives] = useState<PlanPin[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plan]);

  // Start conversation — show mock plan immediately (no API call)
  useEffect(() => {
    const nDays = preferences.numDays;
    const mock = buildMockPlan(nDays);
    const daysLabel = nDays === 1 ? "1 dzień" : `${nDays} dni`;
    const intro = `Hej! Mam już wstępny plan dla Ciebie na **${daysLabel} w Krakowie** 🗺️\n\nTo tylko punkt startowy — powiedz co zmienić!`;
    setMessages([{ role: "assistant", content: intro }]);
    setPlan(mock);
    setSuggestions(INITIAL_SUGGESTIONS);
    setInitializing(false);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: msgText },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("plan-route", {
        body: { preferences, messages: newMessages, current_plan: plan, liked_places: likedPlaces },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;

      // Parse suggestions out of message
      const { cleanMessage: parsedMsg, suggestions: newSuggestions } = parseSuggestions(data.message ?? "");
      if (newSuggestions.length) setSuggestions(newSuggestions);

      // Always add the assistant message to chat
      const withAssistant: ChatMessage[] = parsedMsg
        ? [...newMessages, { role: "assistant" as const, content: parsedMsg }]
        : newMessages;

      if (parsedMsg) setMessages(withAssistant);

      if (data.memory_used) setMemoryUsed(true);

      if (data.plan) {
        if (plan) {
          setPlanHistory(prev => [...prev, plan]);
          setEditCount(prev => prev + 1);
        }
        setPlan(data.plan);
        setLoading(false);
      } else if (data.preparing_plan) {
        // AI signalled it's about to generate — show skeleton and force-generate
        setLoading(false);
        setPreparingPlan(true);
        try {
          const planResponse = await supabase.functions.invoke("plan-route", {
            body: { preferences, messages: withAssistant, current_plan: plan, force_plan: true, liked_places: likedPlaces },
          });
          if (!planResponse.error && planResponse.data?.plan) {
            if (planResponse.data.memory_used) setMemoryUsed(true);
            if (plan) {
              setPlanHistory(prev => [...prev, plan]);
              setEditCount(prev => prev + 1);
            }
            setPlan(planResponse.data.plan);
            if (planResponse.data.message) {
              const { cleanMessage: cm, suggestions: s } = parseSuggestions(planResponse.data.message);
              if (s.length) setSuggestions(s);
              if (cm) setMessages(prev => [...prev, { role: "assistant", content: cm }]);
            }
            if (planResponse.data.suggestions?.length) setSuggestions(planResponse.data.suggestions);
          }
        } catch (planErr) {
          console.error("Force plan error:", planErr);
        }
        setPreparingPlan(false);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Przepraszam, coś poszło nie tak. Spróbuj ponownie." },
      ]);
      setLoading(false);
    }
  }, [input, messages, loading, preferences, plan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => sendMessage(transcript), 300);
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleRemovePin = (dayNumber: number, pinIndex: number) => {
    if (!plan) return;
    setPlan({
      ...plan,
      days: plan.days.map(d =>
        d.day_number === dayNumber
          ? { ...d, pins: d.pins.filter((_, i) => i !== pinIndex) }
          : d
      ),
    });
  };

  const handleReorderPins = (dayNumber: number, newPins: PlanPin[]) => {
    if (!plan) return;
    setPlan({
      ...plan,
      days: plan.days.map(d =>
        d.day_number === dayNumber ? { ...d, pins: newPins } : d
      ),
    });
  };

  const handleAddPinToDay = (pin: PlanPin) => {
    if (!plan || addPinDay === null) return;
    setPlan({
      ...plan,
      days: plan.days.map(d =>
        d.day_number === addPinDay
          ? { ...d, pins: [...d.pins, { ...pin, day_number: addPinDay }] }
          : d
      ),
    });
    setAddPinDay(null);
  };

  const handleConfirm = () => {
    if (plan) {
      onPlanReady(plan, messages);
    }
  };

  const handleEditRequest = () => {
    setMessages(prev => [
      ...prev,
      { role: "assistant" as const, content: "Okej, co konkretnie chciałbyś poprawić? 🤔" },
    ]);
  };

  const handleGetAlternatives = useCallback(async (pin: PlanPin, dayNumber: number, pinIndex: number) => {
    setAlternativesFor({ pin, dayNumber, pinIndex });
    setAlternatives([]);
    setLoadingAlternatives(true);
    try {
      const response = await supabase.functions.invoke("get-alternatives", {
        body: {
          place_name: pin.place_name,
          category: pin.category,
          city: plan?.city ?? "",
          latitude: pin.latitude,
          longitude: pin.longitude,
        },
      });
      if (!response.error && response.data?.alternatives) {
        setAlternatives(response.data.alternatives);
      }
    } catch {
      // ignore
    }
    setLoadingAlternatives(false);
  }, [plan]);

  const handleSelectAlternative = useCallback((altPin: PlanPin) => {
    if (!alternativesFor || !plan) return;
    const { dayNumber, pinIndex, pin: original } = alternativesFor;
    setPlan({
      ...plan,
      days: plan.days.map(d =>
        d.day_number === dayNumber
          ? {
              ...d,
              pins: d.pins.map((p, i) =>
                i === pinIndex
                  ? { ...altPin, suggested_time: original.suggested_time, duration_minutes: original.duration_minutes, day_number: dayNumber }
                  : p
              ),
            }
          : d
      ),
    });
    setAlternativesFor(null);
  }, [alternativesFor, plan]);

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Przygotowuję rozmowę...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Plan overview bar */}
      {plan && (
        <div className="flex-shrink-0 flex gap-2 px-4 py-2 border-b border-border/20 bg-muted/30 overflow-x-auto scrollbar-none">
          {plan.days.map(d => (
            <div key={d.day_number} className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border/40 rounded-full px-3 py-1">
              <span className="font-medium text-foreground">Dzień {d.day_number}</span>
              <span>·</span>
              <span>{d.pins.length} miejsc</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages + Plan */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => {
          const bubbles = msg.role === "assistant"
            ? msg.content.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
            : [msg.content];
          return (
            <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
              {bubbles.map((bubble, j) => (
                <div
                  key={j}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-foreground text-background rounded-br-md"
                      : "bg-card text-foreground rounded-bl-md shadow-sm"
                  )}
                >
                  {msg.role === "assistant" ? renderBubble(bubble) : bubble}
                </div>
              ))}
            </div>
          );
        })}

        {loading && !preparingPlan && (
          <div className="flex justify-start">
            <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {preparingPlan && !plan && (
          <PlanSkeleton numDays={preferences.numDays} />
        )}

        {/* Historical Plans */}
        {planHistory.map((histPlan, idx) => (
          <div key={idx} className="space-y-3 pt-2 opacity-40 pointer-events-none">
            <p className="text-[11px] text-muted-foreground px-1 font-medium uppercase tracking-wider">
              Plan #{idx + 1}
            </p>
            {histPlan.days.map((day) => (
              <DayPinList
                key={day.day_number}
                dayNumber={day.day_number}
                totalDays={histPlan.days.length}
                pins={day.pins}
                onRemovePin={() => {}}
              />
            ))}
          </div>
        ))}

        {/* Current Plan */}
        {plan && (
          <div className="space-y-4 pt-2">
            {/* Memory receipt banner */}
            {memoryUsed && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/40">
                <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[12px] text-muted-foreground">Plan uwzględnia Twoje wcześniejsze preferencje</span>
              </div>
            )}

            {plan.days.map((day) => (
              <div key={day.day_number} className="space-y-2">
                {/* Day metrics bar */}
                {day.day_metrics && (
                  <div className="flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
                    {day.day_metrics.total_walking_km != null && (
                      <span className="flex items-center gap-1">
                        <Footprints className="h-3 w-3" />
                        {day.day_metrics.total_walking_km} km
                      </span>
                    )}
                    {day.day_metrics.crowd_level && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {day.day_metrics.crowd_level === "low" ? "spokojnie" : day.day_metrics.crowd_level === "medium" ? "umiarkowanie" : "tłoczno"}
                      </span>
                    )}
                    {day.day_metrics.energy_cost && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {day.day_metrics.energy_cost === "low" ? "relaks" : day.day_metrics.energy_cost === "medium" ? "aktywnie" : "intensywnie"}
                      </span>
                    )}
                  </div>
                )}
                <DayPinList
                  dayNumber={day.day_number}
                  totalDays={plan.days.length}
                  pins={day.pins}
                  onRemovePin={handleRemovePin}
                  onReorderPins={handleReorderPins}
                  onPinClick={(pin) => setSelectedPin(pin)}
                  onAddPin={(dayNum) => setAddPinDay(dayNum)}
                  onAlternatives={(pin, idx) => handleGetAlternatives(pin, day.day_number, idx)}
                />
              </div>
            ))}

            {preparingPlan && <PlanSkeleton numDays={preferences.numDays} />}

            {/* Action buttons — inside scroll area so they're always reachable */}
            {!preparingPlan && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span>Ilość zmian</span>
                  <span>Pozostało {Math.max(0, 3 - editCount)}/3</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-3 rounded-xl bg-foreground text-background text-sm font-semibold"
                  >
                    Wybieram ten plan!
                  </button>
                  <button
                    onClick={handleEditRequest}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-foreground bg-card disabled:opacity-50"
                  >
                    Wprowadź zmiany
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area — sticky bottom */}
      <div className="flex-shrink-0 border-t border-border/40 bg-background px-3 pt-2 pb-safe">
        {/* Suggestion chips */}
        {suggestions.length > 0 && !loading && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          {hasVoiceSupport && (
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                listening
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={plan ? "Chcesz coś zmienić?" : "Napisz odpowiedź..."}
              rows={1}
              disabled={loading}
              className="w-full resize-none rounded-xl border border-border/60 bg-card px-4 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
          </div>

          <Button
            size="icon"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 h-10 w-10 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Place Detail Drawer */}
      {selectedPin && (
        <PlaceDetailDrawer
          open={!!selectedPin}
          onOpenChange={(open) => !open && setSelectedPin(null)}
          placeName={selectedPin.place_name}
          address={selectedPin.address}
          latitude={selectedPin.latitude}
          longitude={selectedPin.longitude}
        />
      )}

      {/* Add Pin Sheet */}
      <AddPinSheet
        open={addPinDay !== null}
        onOpenChange={(open) => !open && setAddPinDay(null)}
        onPinAdd={handleAddPinToDay}
        cityContext={plan?.city || ""}
      />

      {/* Alternatives Sheet */}
      <Sheet open={!!alternativesFor} onOpenChange={(open) => !open && setAlternativesFor(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">
              Alternatywy dla: {alternativesFor?.pin.place_name}
            </SheetTitle>
          </SheetHeader>
          {loadingAlternatives ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alternatives.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nie znaleziono alternatyw w tej okolicy.</p>
          ) : (
            <div className="space-y-2 pb-4">
              {alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectAlternative(alt)}
                  className="w-full text-left p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors"
                >
                  <p className="text-sm font-medium">{alt.place_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{alt.address}</p>
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlanChatExperience;
