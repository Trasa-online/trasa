import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RouteSummary {
  city?: string;
  intent?: Record<string, string>;
  pins?: any[];
  deviations?: any[];
  considerations?: any[];
  weather_impact?: string | null;
  highlight?: string;
  tip?: string;
  summary_text?: string;
}

interface ChatExperienceProps {
  routeId: string;
  pins: { place_name: string; address: string }[];
  onComplete: (summary: RouteSummary) => void;
  onSkip: () => void;
}

const hasVoiceSupport =
  typeof window !== "undefined" &&
  ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

const ChatExperience = ({ routeId, pins, onComplete, onSkip }: ChatExperienceProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start conversation — send empty messages to get first AI question
  useEffect(() => {
    const startChat = async () => {
      setInitializing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setInitializing(false);
          return;
        }

        const response = await supabase.functions.invoke("chat-route", {
          body: { route_id: routeId, messages: [] },
        });

        if (response.data?.message) {
          setMessages([{ role: "assistant", content: response.data.message }]);
        }
      } catch (err) {
        console.error("Failed to start chat:", err);
        setMessages([{
          role: "assistant",
          content: "Hej! Opowiedz mi o swoim dniu — z kim byłeś i jaki to miał być wyjazd?",
        }]);
      }
      setInitializing(false);
    };

    startChat();
  }, [routeId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("chat-route", {
        body: { route_id: routeId, messages: newMessages },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.done && data.summary) {
        // Chat complete — show final message then callback
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message || "Gotowe!" },
        ]);
        setLoading(false);
        // Small delay so user sees the final message
        setTimeout(() => onComplete(data.summary), 1500);
        return;
      }

      if (data.message) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Przepraszam, coś poszło nie tak. Spróbuj ponownie.",
        },
      ]);
    }

    setLoading(false);
  }, [input, messages, loading, routeId, onComplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice input
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

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Przygotowuję rozmowę...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pin context bar */}
      <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <p className="text-[12px] text-muted-foreground">
          {pins.length} {pins.length === 1 ? "miejsce" : pins.length < 5 ? "miejsca" : "miejsc"} do omówienia
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {pins.slice(0, 5).map((p, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {p.place_name || p.address}
            </span>
          ))}
          {pins.length > 5 && (
            <span className="text-[11px] px-2 py-0.5 text-muted-foreground">
              +{pins.length - 5}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
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
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 border-t border-border/40 bg-background px-3 pt-3 pb-safe z-10">
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          {hasVoiceSupport && (
            <button
              type="button"
              onClick={toggleVoice}
              className={cn(
                "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                listening
                  ? "bg-red-500 text-white animate-pulse"
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
              disabled={loading}
              className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />
          </div>

          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 h-10 w-10 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-[12px] text-muted-foreground/60 hover:text-muted-foreground mt-2 py-1"
        >
          Pomiń rozmowę
        </button>
      </div>
    </div>
  );
};

export default ChatExperience;
