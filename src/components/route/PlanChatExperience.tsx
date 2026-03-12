import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import DayPinList, { type PlanPin } from "./DayPinList";
import PlaceDetailDrawer from "./PlaceDetailDrawer";
import AddPinSheet from "./AddPinSheet";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RoutePlan {
  city: string;
  days: {
    day_number: number;
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
}

// Skeleton shown while the plan is being generated
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

const PlanChatExperience = ({ preferences, onPlanReady }: PlanChatExperienceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [editCount, setEditCount] = useState(0);
  const [preparingPlan, setPreparingPlan] = useState(false);
  const [planHistory, setPlanHistory] = useState<RoutePlan[]>([]);
  const [selectedPin, setSelectedPin] = useState<PlanPin | null>(null);
  const [addPinDay, setAddPinDay] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plan]);

  // Start conversation
  useEffect(() => {
    const startChat = async () => {
      setInitializing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setInitializing(false);
          return;
        }

        const response = await supabase.functions.invoke("plan-route", {
          body: { preferences, messages: [] },
        });

        if (response.error) throw new Error(response.error.message);

        if (response.data?.message) {
          setMessages([{ role: "assistant", content: response.data.message }]);
          if (response.data.plan) {
            setPlan(response.data.plan);
          }
        } else {
          throw new Error("Empty response");
        }
      } catch (err) {
        console.error("Failed to start plan chat:", err);
        setMessages([{
          role: "assistant",
          content: "Cześć! Dokąd planujesz podróż? 🌍",
        }]);
      }
      setInitializing(false);
    };

    startChat();
  }, [preferences]);

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
        body: { preferences, messages: newMessages, current_plan: plan },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;

      // Always add the assistant message to chat
      const withAssistant: ChatMessage[] = data.message
        ? [...newMessages, { role: "assistant" as const, content: data.message }]
        : newMessages;

      if (data.message) setMessages(withAssistant);

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
            body: { preferences, messages: withAssistant, current_plan: plan, force_plan: true },
          });
          if (!planResponse.error && planResponse.data?.plan) {
            if (plan) {
              setPlanHistory(prev => [...prev, plan]);
              setEditCount(prev => prev + 1);
            }
            setPlan(planResponse.data.plan);
            // Append the plan message if any
            if (planResponse.data.message) {
              setMessages(prev => [...prev, { role: "assistant", content: planResponse.data.message }]);
            }
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
      {/* Messages + Plan */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 pb-20 space-y-4">
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
            {plan.days.map((day) => (
              <DayPinList
                key={day.day_number}
                dayNumber={day.day_number}
                totalDays={plan.days.length}
                pins={day.pins}
                onRemovePin={handleRemovePin}
                onReorderPins={handleReorderPins}
                onPinClick={(pin) => setSelectedPin(pin)}
                onAddPin={(dayNum) => setAddPinDay(dayNum)}
              />
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

      {/* Input area — fixed to bottom so it follows the user on scroll */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/40 bg-background p-3">
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
              className="w-full resize-none rounded-xl border border-border/60 bg-card px-4 py-2.5 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
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
    </div>
  );
};

export default PlanChatExperience;
