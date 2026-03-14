import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const EditPlan = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [initialSent, setInitialSent] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: route } = useQuery({
    queryKey: ["edit-route", routeId],
    queryFn: async () => {
      if (!routeId) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, title, city, day_number, pins(*)")
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
        toast.error("Błąd AI. Spróbuj ponownie.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.done) {
        setMessages(prev => [...prev, { role: "assistant", content: data.message || "Gotowe! Plan został zaktualizowany." }]);
        setIsDone(true);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch {
      toast.error("Błąd połączenia.");
    }
    setIsLoading(false);
  }, [routeId, session?.access_token]);

  // Trigger initial AI message when route loads
  useEffect(() => {
    if (route && !initialSent) {
      setInitialSent(true);
      const pinList = ((route.pins as any[]) || [])
        .sort((a: any, b: any) => a.pin_order - b.pin_order)
        .map((p: any, i: number) => `${i + 1}. ${p.place_name}`)
        .join(", ");
      const greeting = `Cześć! Chcę poprawić plan.`;
      const initial: ChatMessage[] = [{ role: "user", content: greeting }];
      setMessages(initial);
      callEditPlan(initial);
    }
  }, [route, initialSent, callEditPlan]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isDone || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
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
          <h1 className="text-base font-bold leading-tight">Popraw trasę</h1>
          {route?.city && (
            <p className="text-xs text-muted-foreground">{route.city}</p>
          )}
        </div>
        <div className="w-8" />
      </header>

      {/* Current plan — compact */}
      {sortedPins.length > 0 && (
        <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-muted/20">
          <p className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
            Aktualny plan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sortedPins.map((pin: any, i: number) => (
              <span
                key={pin.id}
                className="text-[11px] bg-background/60 border border-border/40 rounded-full px-2 py-0.5"
              >
                {i + 1}. {pin.place_name}
              </span>
            ))}
          </div>
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
            <p className="text-sm text-muted-foreground text-center">Plan został zaktualizowany</p>
            <Button
              onClick={() => navigate("/")}
              className="rounded-full px-6"
            >
              Wróć do planu
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      {!isDone && (
        <div className="shrink-0 border-t border-border/40 bg-background px-3 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Powiedz co zmienić..."
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
    </div>
  );
};

export default EditPlan;
