import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, ChevronDown, ChevronUp, Zap, ArrowLeft, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pin {
  place_name: string;
  suggested_time: string;
  duration_minutes: number;
  category: string;
  walking_time_from_prev: string | null;
  note?: string;
}

interface RouteExample {
  id: string;
  title: string;
  personality_type: string;
  description: string | null;
  pins: Pin[];
  day_metrics: { walking_km: number; crowd_level: string; energy_cost: string } | null;
  is_approved: boolean;
  is_rejected: boolean;
  evaluator_notes: string | null;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PERSONALITY_LABELS: Record<string, { label: string; color: string }> = {
  kulturalny:  { label: "Kulturalny",    color: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  historyczny: { label: "Historyczny",   color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  kawiarniany: { label: "Kawiarniany",   color: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  nocny:       { label: "Nocny",         color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  aktywny:     { label: "Aktywny",       color: "bg-green-500/15 text-green-700 dark:text-green-300" },
  zakupowy:    { label: "Zakupowy",      color: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  mix:         { label: "Zrównoważony",  color: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  museum: "🏛️", cafe: "☕", restaurant: "🍽️", bar: "🍺",
  park: "🌿", monument: "🏰", shopping: "🛍️", viewpoint: "🔭",
  experience: "🎪", church: "⛪", gallery: "🖼️",
};

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({
  route,
  onApprove,
  onReject,
  onNoteChange,
}: {
  route: RouteExample;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(route.evaluator_notes ?? "");
  const meta = PERSONALITY_LABELS[route.personality_type] ?? { label: route.personality_type, color: "bg-muted text-muted-foreground" };
  const isPlaceholder = (name: string) => name.startsWith("[PLACEHOLDER]");

  const status = route.is_approved ? "approved" : route.is_rejected ? "rejected" : "pending";

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-all",
      status === "approved" && "border-green-500/40 bg-green-500/5",
      status === "rejected" && "border-red-500/20 bg-red-500/5 opacity-60",
      status === "pending" && "border-border",
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", meta.color)}>
                {meta.label}
              </span>
              {route.day_metrics && (
                <span className="text-xs text-muted-foreground">
                  {route.day_metrics.walking_km} km · {route.day_metrics.energy_cost} energy
                </span>
              )}
            </div>
            <h3 className="font-bold text-foreground mt-1">{route.title}</h3>
            {route.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{route.description}</p>
            )}
          </div>

          {/* Status badge */}
          {status === "approved" && (
            <span className="text-xs font-semibold text-green-600 bg-green-500/15 px-2 py-0.5 rounded-full shrink-0">✓ Zatwierdzona</span>
          )}
          {status === "rejected" && (
            <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">✗ Odrzucona</span>
          )}
        </div>

        {/* Pin preview (collapsed: first 3 inline) */}
        {!expanded && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {route.pins.slice(0, 4).map((pin, i) => (
              <span key={i} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                {CATEGORY_EMOJI[pin.category] ?? "📍"}
                <span className={cn(isPlaceholder(pin.place_name) && "italic opacity-70")}>
                  {isPlaceholder(pin.place_name)
                    ? pin.place_name.replace("[PLACEHOLDER] ", "").split(" — ")[0]
                    : pin.place_name}
                </span>
              </span>
            ))}
            {route.pins.length > 4 && (
              <span className="text-xs text-muted-foreground">+{route.pins.length - 4} więcej</span>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Zwiń" : "Rozwiń trasę"}
        </button>
      </div>

      {/* Expanded pin list */}
      {expanded && (
        <div className="px-4 pb-2 border-t border-border/40 pt-3 space-y-2">
          {route.pins.map((pin, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span className="text-base leading-none">{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>
                {i < route.pins.length - 1 && <div className="w-0.5 h-4 bg-border/50 mx-auto mt-0.5" />}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-sm font-medium",
                    isPlaceholder(pin.place_name) && "italic text-muted-foreground"
                  )}>
                    {isPlaceholder(pin.place_name)
                      ? pin.place_name.replace("[PLACEHOLDER] ", "")
                      : pin.place_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {pin.suggested_time} · {pin.duration_minutes} min
                  </span>
                  {pin.walking_time_from_prev && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {pin.walking_time_from_prev} pieszo
                    </span>
                  )}
                </div>
                {pin.note && (
                  <p className="text-xs text-muted-foreground mt-0.5">{pin.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes + actions */}
      <div className="px-4 pb-4 pt-2 border-t border-border/40 space-y-3">
        <Textarea
          placeholder="Notatka (opcjonalnie): co poprawić, co jest dobre..."
          value={note}
          onChange={e => {
            setNote(e.target.value);
            onNoteChange(route.id, e.target.value);
          }}
          className="text-xs min-h-[60px] resize-none bg-muted/50"
        />
        <div className="flex gap-2">
          <Button
            onClick={() => onReject(route.id)}
            variant="outline"
            size="sm"
            className={cn(
              "flex-1 gap-1.5",
              status === "rejected" && "border-red-500/40 text-red-500"
            )}
          >
            <X className="h-3.5 w-3.5" />
            {status === "rejected" ? "Odrzucona" : "Odrzuć"}
          </Button>
          <Button
            onClick={() => onApprove(route.id)}
            size="sm"
            className={cn(
              "flex-2 gap-1.5 flex-1",
              status === "approved"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gradient-to-r from-orange-500 to-amber-500"
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {status === "approved" ? "Zatwierdzona ✓" : "Zatwierdź"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CITY = "Kraków";

const AdminRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [routes, setRoutes] = useState<RouteExample[]>([]);
  const [fetching, setFetching] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading]);

  const fetchRoutes = async () => {
    setFetching(true);
    const { data, error } = await (supabase as any)
      .from("route_examples")
      .select("*")
      .ilike("city", CITY)
      .order("created_at", { ascending: false });

    if (!error && data) setRoutes(data as RouteExample[]);
    setFetching(false);
  };

  useEffect(() => { fetchRoutes(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-route-examples", {
        body: { city: CITY },
      });
      if (error) throw new Error(String(error));
      toast({ title: "Wygenerowano 30 tras! 🎉", description: "Możesz teraz przeglądać i zatwierdzać." });
      await fetchRoutes();
    } catch (err) {
      toast({ title: "Błąd generowania", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    const note = pendingNotes[id];
    await (supabase as any)
      .from("route_examples")
      .update({ is_approved: true, is_rejected: false, ...(note ? { evaluator_notes: note } : {}) })
      .eq("id", id);
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, is_approved: true, is_rejected: false } : r));
  };

  const handleReject = async (id: string) => {
    const note = pendingNotes[id];
    await (supabase as any)
      .from("route_examples")
      .update({ is_rejected: true, is_approved: false, ...(note ? { evaluator_notes: note } : {}) })
      .eq("id", id);
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, is_rejected: true, is_approved: false } : r));
  };

  const handleNoteChange = (id: string, note: string) => {
    setPendingNotes(prev => ({ ...prev, [id]: note }));
  };

  if (loading) return null;

  const filtered = routes.filter(r => {
    if (filter === "pending")  return !r.is_approved && !r.is_rejected;
    if (filter === "approved") return r.is_approved;
    if (filter === "rejected") return r.is_rejected;
    return true;
  });

  const counts = {
    all: routes.length,
    pending:  routes.filter(r => !r.is_approved && !r.is_rejected).length,
    approved: routes.filter(r => r.is_approved).length,
    rejected: routes.filter(r => r.is_rejected).length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold">Panel tras wzorcowych</h1>
          <p className="text-xs text-muted-foreground">{CITY} · {counts.approved} zatwierdzone z {counts.all}</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="sm"
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white shrink-0 gap-1.5"
        >
          <Zap className="h-3.5 w-3.5" />
          {generating ? "Generuję..." : routes.length > 0 ? "Generuj więcej" : "Generuj 30 tras"}
        </Button>
      </div>

      {/* Stats bar */}
      {routes.length > 0 && (
        <div className="px-4 py-3 flex gap-2 overflow-x-auto">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === f
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "Wszystkie" : f === "pending" ? "Do oceny" : f === "approved" ? "✓ Zatwierdzone" : "✗ Odrzucone"}
              <span className="ml-1 opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-16">
        {fetching ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Ładowanie...</div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-4xl">🗺️</p>
            <p className="font-semibold text-foreground">Brak wygenerowanych tras</p>
            <p className="text-sm text-muted-foreground">Kliknij „Generuj 30 tras" żeby AI stworzyło propozycje do oceny</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Brak tras w tej kategorii
          </div>
        ) : (
          filtered.map(route => (
            <RouteCard
              key={route.id}
              route={route}
              onApprove={handleApprove}
              onReject={handleReject}
              onNoteChange={handleNoteChange}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AdminRoutes;
