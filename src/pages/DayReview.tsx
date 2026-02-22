import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Loader2, X, ArrowLeft, Send, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import RoutePlanTimeline from "@/components/route/RoutePlanTimeline";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE_QUESTIONS = [
  "Gdzie byłeś i jakie było tempo dnia?",
  "Które miejsca z planu odwiedziłeś? Coś pominąłeś lub dodałeś spontanicznie?",
  "Co było najlepsze? Co byś zmienił następnym razem?",
];

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const DayReview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionQueue, setQuestionQueue] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const { data: route, isLoading } = useQuery({
    queryKey: ["review-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("*, pins(*)")
        .eq("id", routeId)
        .single();
      return data;
    },
    enabled: !!routeId && !!user,
  });

  const { data: folderRoutes } = useQuery({
    queryKey: ["folder-routes", route?.folder_id],
    queryFn: async () => {
      if (!route?.folder_id) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, day_number, title")
        .eq("folder_id", route.folder_id)
        .order("day_number");
      return data;
    },
    enabled: !!route?.folder_id,
  });

  const totalDays = folderRoutes?.length || 1;
  const dayNumber = route?.day_number || 1;

  const sortedPins = useMemo(() => {
    if (!route?.pins) return [];
    return [...(route.pins as any[])]
      .sort((a, b) => a.pin_order - b.pin_order)
      .map((p) => ({
        place_name: p.place_name,
        address: p.address,
        description: p.description,
        suggested_time: p.suggested_time,
      }));
  }, [route]);

  const timelineDays = useMemo(() => [{
    day_number: dayNumber,
    pins: sortedPins,
  }], [dayNumber, sortedPins]);

  const skippedPinNames = useMemo(() => {
    if (!route?.pins) return [];
    return (route.pins as any[])
      .filter(p => p.was_skipped)
      .sort((a, b) => a.pin_order - b.pin_order)
      .map(p => p.place_name);
  }, [route]);

  const questions = useMemo(() => {
    const q2 = skippedPinNames.length > 0
      ? `Widzę, że pominąłeś: ${skippedPinNames.join(", ")}. Co się stało? Coś może dodałeś spontanicznie?`
      : BASE_QUESTIONS[1];
    return [BASE_QUESTIONS[0], q2, BASE_QUESTIONS[2]];
  }, [skippedPinNames]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      }, 50);
    }
  }, [messages, isDone]);

  // Ask next question from queue
  const askNextQuestion = useCallback((queue: string[], index: number) => {
    if (index < queue.length) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: queue[index] }]);
        setQuestionIndex(index + 1);
      }, 600);
    } else {
      // All questions asked — finish
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Dziękuję za odpowiedzi! Zapisuję podsumowanie Twojego dnia. 🙏",
        }]);
        setSaving(true);
        // Save chat session
        saveChatSession();
      }, 600);
    }
  }, []);

  const saveChatSession = async () => {
    if (!routeId || !user) {
      setIsDone(true);
      setSaving(false);
      return;
    }
    try {
      await Promise.all([
        supabase.from("chat_sessions").upsert({
          route_id: routeId,
          user_id: user.id,
          messages: messages as any,
          completed_at: new Date().toISOString(),
        }, { onConflict: "route_id" }),
        supabase.from("routes").update({ chat_status: "completed" }).eq("id", routeId),
      ]);
    } catch (err) {
      console.error("Failed to save chat session:", err);
    }
    setSaving(false);
    setIsDone(true);
  };

  // Handle initial yes/no choice
  const handleInitialChoice = (positive: boolean) => {
    const userMsg = positive ? "Tak, wszystko poszło zgodnie z planem!" : "Nie do końca.";

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setQuestionQueue(questions);
    setQuestionIndex(0);
    setChatStarted(true);
    askNextQuestion(questions, 0);
  };

  // Send a free-text answer
  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isDone) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    askNextQuestion(questionQueue, questionIndex);
  }, [input, messages, questionQueue, questionIndex, isDone, askNextQuestion]);

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

  if (isLoading || !route) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-muted px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="p-1 text-foreground/70">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button onClick={() => navigate("/")} className="text-2xl font-black tracking-tight">TRASA</button>
          <button onClick={() => navigate("/settings")} className="p-1 text-foreground/70">
            <Settings className="h-6 w-6" />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-muted px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="p-1 text-foreground/70">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
        <button onClick={() => navigate("/settings")} className="p-1 text-foreground/70">
          <Settings className="h-6 w-6" />
        </button>
      </header>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* AI intro + timeline */}
        <div className="px-5 pt-6 pb-2">
          <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] text-[14px] leading-relaxed">
            Czy Twój dzień przebiegł zgodnie z planem?
          </div>
        </div>

        <div className="px-1">
          <RoutePlanTimeline days={timelineDays} totalDays={totalDays} />
        </div>

        {/* Quick choice buttons (before chat starts) */}
        {!chatStarted && (
          <div className="px-5 pb-4 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleInitialChoice(true)}
                className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[14px] font-medium hover:bg-muted transition-colors"
              >
                Tak ✅
              </button>
              <button
                onClick={() => handleInitialChoice(false)}
                className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[14px] font-medium hover:bg-muted transition-colors"
              >
                Nie do końca 🤔
              </button>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full text-center text-[13px] text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Wróć później
            </button>
          </div>
        )}

        {/* Chat messages */}
        {chatStarted && messages.length > 0 && (
          <div className="px-4 py-2 space-y-3">
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
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="flex flex-col items-center px-8 py-8">
            <h2 className="text-xl font-black text-center">Super! Dziękuję za rozmowę.</h2>
            <p className="text-muted-foreground text-center mt-3 text-sm leading-relaxed">
              Zapisałam Twoje odpowiedzi i zaktualizowałam trasę.
            </p>
            <Button
              onClick={() => routeId ? navigate(`/route/${routeId}`) : navigate("/")}
              variant="outline"
              size="lg"
              className="w-full rounded-full text-base font-medium mt-6"
            >
              Zobacz trasę
            </Button>
          </div>
        )}
      </div>

      {/* Sticky input — only when chat is active and not done */}
      {chatStarted && !isDone && (
        <div className="sticky bottom-0 border-t border-border/40 bg-background p-3 z-10">
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
                placeholder="Napisz odpowiedź..."
                rows={1}
                disabled={saving}
                className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
                style={{ maxHeight: "120px" }}
              />
            </div>

            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || saving}
              className="flex-shrink-0 h-10 w-10 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayReview;
