import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import RoutePlanTimeline from "@/components/route/RoutePlanTimeline";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PlanPin {
  place_name: string;
  address: string;
  description: string;
  suggested_time: string;
  duration_minutes?: number;
  category: string;
  latitude: number;
  longitude: number;
  day_number: number;
  walking_time_from_prev?: string | null;
  distance_from_prev?: string | null;
  place_id?: string | null;
}

interface RoutePlan {
  city: string;
  days: { day_number: number; pins: PlanPin[] }[];
}

const DayPlan = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
  const reviewedId = searchParams.get("reviewed");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: route } = useQuery({
    queryKey: ["day-plan-route", routeId],
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

  const { data: reviewedRoute, isSuccess: reviewedSuccess } = useQuery({
    queryKey: ["day-plan-reviewed", reviewedId],
    queryFn: async () => {
      if (!reviewedId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, day_number, ai_summary, ai_tip, city")
        .eq("id", reviewedId)
        .single();
      return data;
    },
    enabled: !!reviewedId && !!user,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plan]);

  // Initialize plan + first AI message from DB data
  useEffect(() => {
    if (!route || initialized) return;
    if (reviewedId && !reviewedSuccess) return;

    const dbPins = ((route.pins as any[]) || [])
      .sort((a: any, b: any) => (a.pin_order || 0) - (b.pin_order || 0));

    const planPins: PlanPin[] = dbPins.map((p: any) => ({
      place_name: p.place_name || "",
      address: p.address || "",
      description: p.description || "",
      suggested_time: p.suggested_time || "",
      duration_minutes: p.duration_minutes || 60,
      category: p.category || "",
      latitude: p.latitude || 0,
      longitude: p.longitude || 0,
      day_number: route.day_number || 1,
      walking_time_from_prev: null,
      distance_from_prev: null,
      place_id: p.place_id || null,
    }));

    setPlan({
      city: (route as any).city || "",
      days: [{ day_number: route.day_number || 1, pins: planPins }],
    });

    // Build contextual AI greeting based on previous day review
    let msg = `Oto Twój plan na dzień ${route.day_number || 2}.`;
    if (reviewedRoute?.ai_summary) {
      msg = `Na podstawie wczorajszego dnia: ${reviewedRoute.ai_summary}`;
      if (reviewedRoute.ai_tip) msg += ` Wskazówka: ${reviewedRoute.ai_tip}`;
      msg += ` Poniżej plan na dzień ${route.day_number || 2} — czy chcesz coś zmienić?`;
    } else {
      msg += " Czy chcesz coś zmienić?";
    }

    setMessages([{ role: "assistant", content: msg }]);
    setInitialized(true);
  }, [route, reviewedRoute, reviewedSuccess, initialized, reviewedId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !plan || editCount >= 3) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const preferences = {
        numDays: 1,
        pace: "mixed",
        priorities: [],
        startDate: (route as any)?.start_date ?? null,
        planningMode: "text",
        city: (route as any)?.city ?? "",
      };

      const response = await supabase.functions.invoke("plan-route", {
        body: { preferences, messages: newMessages, current_plan: plan },
      });

      if (!response.error && response.data) {
        if (response.data.message) {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: response.data.message },
          ]);
        }
        if (response.data.plan) {
          setPlan(response.data.plan);
          setEditCount(prev => prev + 1);
        }
      } else {
        toast.error("Błąd AI. Spróbuj ponownie.");
      }
    } catch {
      toast.error("Błąd połączenia. Spróbuj ponownie.");
    }
    setLoading(false);
  }, [input, loading, plan, editCount, messages, route]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const savePlan = async () => {
    if (!plan || !routeId || !user) return;
    setSaving(true);

    try {
      await supabase.from("pins").delete().eq("route_id", routeId);

      const pinsToInsert = (plan.days[0]?.pins || []).map((p, idx) => ({
        route_id: routeId,
        user_id: user.id,
        place_name: p.place_name,
        address: p.address,
        description: p.description,
        suggested_time: p.suggested_time,
        duration_minutes: p.duration_minutes || 60,
        category: p.category,
        latitude: p.latitude,
        longitude: p.longitude,
        pin_order: idx + 1,
        place_id: p.place_id || null,
      }));

      if (pinsToInsert.length > 0) {
        await supabase.from("pins").insert(pinsToInsert);
      }

      navigate("/");
    } catch {
      toast.error("Błąd zapisu. Spróbuj ponownie.");
    }
    setSaving(false);
  };

  if (!routeId) return null;

  const dayNumber = (route as any)?.day_number ?? 2;
  const city = (route as any)?.city ?? "";

  const timelineDays = plan
    ? plan.days.map(d => ({
        day_number: d.day_number,
        pins: d.pins.map(p => ({
          place_name: p.place_name,
          description: p.description,
          suggested_time: p.suggested_time,
        })),
      }))
    : [];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background px-4 pt-safe pb-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Plan na dzień {dayNumber}</h1>
          {city && <p className="text-xs text-muted-foreground">{city}</p>}
        </div>
        {editCount < 3 && (
          <span className="text-xs text-muted-foreground">
            {3 - editCount} {3 - editCount === 1 ? "zmiana" : "zmiany"}
          </span>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {/* Read-only plan timeline */}
        {plan && timelineDays.length > 0 && (
          <div className="border-b border-border/40">
            <RoutePlanTimeline days={timelineDays} totalDays={1} />
          </div>
        )}

        {/* Chat messages */}
        <div className="px-4 py-3 space-y-3">
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
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
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
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom */}
      <div className="flex-shrink-0 border-t border-border/40 bg-background px-3 pt-3 pb-safe space-y-2">
        {editCount >= 3 && (
          <p className="text-xs text-center text-muted-foreground">
            Wykorzystano limit 3 zmian
          </p>
        )}
        {editCount < 3 && (
          <div className="flex items-end gap-2 max-w-lg mx-auto">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chcesz coś zmienić?"
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
        )}
        <Button
          onClick={savePlan}
          disabled={saving || !plan}
          className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 h-12 rounded-xl font-semibold"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {saving ? "Zapisywanie..." : "Gotowe"}
        </Button>
      </div>
    </div>
  );
};

export default DayPlan;
