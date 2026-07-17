import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Check, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import PlaceDetailSheet from "@/components/home/PlaceDetailSheet";
import RouteMap from "@/components/RouteMap";
import { useTranslation } from "react-i18next";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const EditPlan = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("myplan");
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [initialSent, setInitialSent] = useState(false);
  const [listening, setListening] = useState(false);
  const [selectedPin, setSelectedPin] = useState<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const { data: route } = useQuery({
    queryKey: ["edit-route", routeId],
    queryFn: async () => {
      if (!routeId) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, title, city, day_number, starting_location_name, starting_location_lat, starting_location_lng, pins(*)")
        .eq("id", routeId)
        .single();
      return data;
    },
    enabled: !!routeId,
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      }, 50);
    }
  }, [messages]);

  const callEditPlan = useCallback(async (chatMessages: ChatMessage[]) => {
    if (!routeId || !session?.access_token) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ route_id: routeId, messages: chatMessages }),
        }
      );

      if (!response.ok) {
        toast.error(t("edit_plan.error_ai"));
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.done) {
        setMessages(prev => [...prev, { role: "assistant", content: data.message || t("edit_plan.ai_done_fallback") }]);
        setIsDone(true);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch {
      toast.error(t("edit_plan.error_connection"));
    }
    setIsLoading(false);
  }, [routeId, session?.access_token, t]);

  // Trigger initial AI message when route loads
  useEffect(() => {
    if (route && !initialSent) {
      setInitialSent(true);
      const greeting = t("edit_plan.ai_greeting");
      const initial: ChatMessage[] = [{ role: "user", content: greeting }];
      callEditPlan(initial);
    }
  }, [route, initialSent, callEditPlan, t]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isDone || isLoading) return;

    // Stop voice if still running
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
    callEditPlan(newMessages);
  }, [input, messages, isDone, isLoading, callEditPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
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

  const sortedPins = route?.pins
    ? [...(route.pins as any[])].sort((a: any, b: any) => a.pin_order - b.pin_order)
    : [];

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="bg-muted px-4 py-4 flex items-center justify-between shrink-0">
        <button onClick={() => navigate("/")} className="p-1 text-foreground/70">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold leading-tight">{t("edit_plan.title")}</h1>
          {route?.city && (
            <p className="text-xs text-muted-foreground">{route.city}</p>
          )}
        </div>
        <div className="w-8" />
      </header>

      {/* Route map */}
      {sortedPins.length > 0 && (
        <div className="shrink-0 border-b border-border/40">
          <RouteMap
            pins={sortedPins.map((p: any) => ({
              place_name: p.place_name,
              address: p.address,
              latitude: p.latitude,
              longitude: p.longitude,
              pin_order: p.pin_order,
            }))}
            startingLocation={(route as any)?.starting_location_lat && (route as any)?.starting_location_lng ? {
              name: (route as any).starting_location_name ?? t("edit_plan.start_label"),
              latitude: (route as any).starting_location_lat,
              longitude: (route as any).starting_location_lng,
            } : undefined}
            className="h-44 rounded-none border-0"
            onPinClick={(pin) => {
              const full = sortedPins.find((p: any) => p.place_name === pin.place_name);
              if (full) setSelectedPin(full);
            }}
          />
        </div>
      )}

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
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

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {isDone && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="h-12 w-12 rounded-full bg-foreground flex items-center justify-center">
              <Check className="h-6 w-6 text-background" />
            </div>
            <p className="text-sm text-muted-foreground text-center">{t("edit_plan.updated")}</p>
            <Button onClick={() => navigate("/")} className="rounded-full px-6">
              {t("edit_plan.back_to_plan")}
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      {!isDone && (
        <div className="shrink-0 border-t border-border/40 bg-background px-3 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
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
                placeholder={t("edit_plan.input_placeholder")}
                rows={1}
                disabled={isLoading}
                className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
                style={{ maxHeight: "120px" }}
              />
            </div>
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 h-10 w-10 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedPin && (
        <PlaceDetailSheet
          pin={selectedPin}
          open={!!selectedPin}
          onOpenChange={(open) => !open && setSelectedPin(null)}
        />
      )}
    </div>
  );
};

export default EditPlan;
