import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Loader2, ArrowLeft, Send, Mic, MicOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import RoutePlanTimeline from "@/components/route/RoutePlanTimeline";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const DayReview = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [initialSent, setInitialSent] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<(text?: string) => void>(() => {});

  const { data: route, isLoading: routeLoading } = useQuery({
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

  const nextDayRouteRef = folderRoutes?.find(r => r.day_number === (route?.day_number || 1) + 1);

  const { data: nextDayRoute } = useQuery({
    queryKey: ["next-day-route", nextDayRouteRef?.id],
    queryFn: async () => {
      if (!nextDayRouteRef?.id) return null;
      const { data } = await supabase
        .from("routes")
        .select("*, pins(*)")
        .eq("id", nextDayRouteRef.id)
        .single();
      return data;
    },
    enabled: !!nextDayRouteRef?.id,
  });

  const nextDayPins = useMemo(() => {
    if (!nextDayRoute?.pins) return [];
    return [...(nextDayRoute.pins as any[])].sort((a, b) => a.pin_order - b.pin_order);
  }, [nextDayRoute]);

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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      }, 50);
    }
  }, [messages, isDone]);

  // Redirect to review summary after conversation completes
  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(() => {
      navigate(`/review-summary?route=${routeId}`, {
        state: { summary: reviewSummary, messages },
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [isDone, navigate, routeId, reviewSummary, messages]);

  // Send message to chat-route edge function
  const callChatRoute = useCallback(async (chatMessages: ChatMessage[]) => {
    if (!routeId || !session?.access_token) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-route`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            route_id: routeId,
            messages: chatMessages,
          }),
        }
      );

      if (response.status === 429) {
        toast.error("Zbyt wiele zapytań. Spróbuj ponownie za chwilę.");
        setIsLoading(false);
        return;
      }
      if (response.status === 402) {
        toast.error("Brak kredytów AI. Doładuj konto.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("chat-route error:", errData);
        toast.error("Błąd AI. Spróbuj ponownie.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.done) {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
        setIsDone(true);
        setReviewSummary(data.summary ?? null);
        // Fire-and-forget: embed AAR into user memory for cross-trip recall
        supabase.functions.invoke("embed-memory", { body: { route_id: routeId } }).catch(() => {});
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch (err) {
      console.error("Failed to call chat-route:", err);
      toast.error("Błąd połączenia. Spróbuj ponownie.");
    }
    setIsLoading(false);
  }, [routeId, session?.access_token]);

  // Trigger initial AI message when route loads — AI speaks first, no user bubble
  useEffect(() => {
    if (route && !initialSent && !routeLoading) {
      setInitialSent(true);
      // Pass a hidden trigger message to the API but don't show it in the UI
      const initialMessages: ChatMessage[] = [
        { role: "user", content: "Cześć! Opowiem Ci o moim dniu." },
      ];
      callChatRoute(initialMessages);
    }
  }, [route, initialSent, routeLoading, callChatRoute]);

  // Send a free-text answer
  const sendMessage = useCallback((voiceText?: string) => {
    const text = voiceText || input.trim();
    if (!text || isDone || isLoading) return;

    // Stop voice recognition if still running
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    callChatRoute(newMessages);
  }, [input, messages, isDone, isLoading, callChatRoute]);

  sendMessageRef.current = sendMessage;

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
        setTimeout(() => sendMessageRef.current(transcript), 300);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  if (routeLoading || !route) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col">
        <header className="bg-muted px-4 pt-safe-4 pb-4 flex items-center justify-between">
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
    <div className="h-[100dvh] bg-background flex flex-col">
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
        {/* Timeline accordion */}
        <div className="mx-4 mb-3 mt-3">
          <button
            onClick={() => setPlanOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border/50 text-sm font-semibold"
          >
            <span>Plan dnia {route?.day_number || 1}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", planOpen && "rotate-180")} />
          </button>
          {planOpen && (
            <div className="mt-1 rounded-2xl bg-card border border-border/50 overflow-hidden px-1">
              <RoutePlanTimeline days={timelineDays} totalDays={totalDays} />
            </div>
          )}
        </div>

        {/* Next day plan */}
        {nextDayPins.length > 0 && (
          <div className="mx-4 mb-3 rounded-2xl bg-card border border-border/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
              <p className="text-xs font-semibold">Plan — Dzień {(route?.day_number || 1) + 1}</p>
              <button
                onClick={() => nextDayRouteRef && navigate(`/edit-plan?route=${nextDayRouteRef.id}`)}
                className="text-[11px] text-primary font-medium"
              >
                Popraw
              </button>
            </div>
            <div className="divide-y divide-border/30">
              {nextDayPins.map((pin: any, i: number) => (
                <div key={pin.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-tight truncate">{pin.place_name}</p>
                  </div>
                  {pin.suggested_time && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{pin.suggested_time}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.length > 0 && (
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

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="flex flex-col items-center px-8 py-8">
            <h2 className="text-xl font-black text-center">Super! Dziękuję za rozmowę.</h2>
            <p className="text-muted-foreground text-center mt-3 text-sm leading-relaxed">
              Zapisałam Twoje odpowiedzi. Za chwilę wrócisz na stronę główną.
            </p>
          </div>
        )}
      </div>

      {/* Sticky input — only when chat is active and not done */}
      {!isDone && (
        <div className="flex-shrink-0 border-t border-border/40 bg-background px-3 pt-3 pb-safe z-10">
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
                disabled={isLoading}
                className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
                style={{ maxHeight: "120px" }}
              />
            </div>

            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
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
