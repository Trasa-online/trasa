import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import DayPinList, { type PlanPin } from "./DayPinList";

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
}

interface PlanChatExperienceProps {
  preferences: TripPreferences;
  onPlanReady: (plan: RoutePlan, messages: ChatMessage[]) => void;
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
        if (!session) return;

        const response = await supabase.functions.invoke("plan-route", {
          body: { preferences, messages: [] },
        });

        if (response.data?.message) {
          setMessages([{ role: "assistant", content: response.data.message }]);
          if (response.data.plan) {
            setPlan(response.data.plan);
          }
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
        body: {
          preferences,
          messages: newMessages,
          current_plan: plan,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;

      if (data.message) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message },
        ]);
      }

      if (data.plan) {
        setPlan(data.plan);
        if (plan) setEditCount(prev => prev + 1);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Przepraszam, coś poszło nie tak. Spróbuj ponownie." },
      ]);
    }

    setLoading(false);
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
      
      // Auto-send when voice recognition ends with final result
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
    const updated = {
      ...plan,
      days: plan.days.map(d =>
        d.day_number === dayNumber
          ? { ...d, pins: d.pins.filter((_, i) => i !== pinIndex) }
          : d
      ),
    };
    setPlan(updated);
  };

  const handleConfirm = () => {
    if (plan) {
      onPlanReady(plan, messages);
    }
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                msg.role === "user"
                  ? "bg-foreground text-background rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Generated Plan */}
        {plan && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold">
                📍 Plan: {plan.city}
              </h2>
              {editCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  Edycje: {editCount}/3
                </span>
              )}
            </div>
            
            {plan.days.map((day) => (
              <DayPinList
                key={day.day_number}
                dayNumber={day.day_number}
                totalDays={plan.days.length}
                pins={day.pins}
                onRemovePin={handleRemovePin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm FAB */}
      {plan && (
        <button
          onClick={handleConfirm}
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Check className="h-6 w-6" />
        </button>
      )}

      {/* Input area */}
      <div className="border-t border-border/40 bg-background p-3">
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
              className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
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
    </div>
  );
};

export default PlanChatExperience;
