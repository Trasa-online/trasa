import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, ChevronDown, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const ReviewSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routeId = searchParams.get("route");

  const locationState = location.state as { summary?: any; messages?: any[] } | null;

  const [narrative, setNarrative] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const narrativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch route data
  const { data: route } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

  // Fetch chat history (fallback if not in location state)
  const { data: chatSession } = useQuery({
    queryKey: ["review-chat-session", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("chat_sessions")
        .select("messages")
        .eq("route_id", routeId)
        .single();
      return data;
    },
    enabled: !!routeId && !!user && !locationState?.messages,
  });

  // Fetch user insights for this route
  const { data: insights } = useQuery({
    queryKey: ["route-insights", routeId],
    queryFn: async () => {
      if (!routeId || !user) return [];
      const { data } = await supabase
        .from("user_insights" as any)
        .select("category, insight")
        .eq("source_route_id", routeId);
      return (data ?? []) as { category: string; insight: string }[];
    },
    enabled: !!routeId && !!user,
  });

  // Populate from DB when loaded
  useEffect(() => {
    if (route?.review_narrative) setNarrative(route.review_narrative);
    if (route?.review_photos?.length) setPhotos(route.review_photos);
  }, [route?.review_narrative, route?.review_photos]);

  const chatMessages: { role: string; content: string }[] =
    locationState?.messages ??
    chatSession?.messages ??
    [];

  // Debounced save of narrative
  const saveNarrative = useCallback((value: string) => {
    if (!routeId) return;
    if (narrativeTimer.current) clearTimeout(narrativeTimer.current);
    narrativeTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("routes").update({ review_narrative: value }).eq("id", routeId);
      setSaving(false);
    }, 1000);
  }, [routeId]);

  const handleNarrativeChange = (value: string) => {
    setNarrative(value);
    saveNarrative(value);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !routeId || !user) return;
    setUploading(true);

    const newUrls: string[] = [];
    for (const file of files.slice(0, 6 - photos.length)) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const ext = "jpg";
        const path = `${user.id}/${routeId}/review_${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("route-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (!error) {
          const url = `${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`;
          newUrls.push(url);
        }
      } catch (err) {
        console.error("Photo upload error:", err);
      }
    }

    if (newUrls.length) {
      const updated = [...photos, ...newUrls];
      setPhotos(updated);
      await supabase.from("routes").update({ review_photos: updated }).eq("id", routeId);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = async (url: string) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from("routes").update({ review_photos: updated }).eq("id", routeId);
  };

  const cityLabel = route?.city || "Podróż";
  const dayLabel = route?.day_number ? `Dzień ${route.day_number}` : "";
  const dateLabel = route?.start_date
    ? format(new Date(route.start_date), "d MMMM yyyy", { locale: pl })
    : "";

  const categoryLabels: Record<string, string> = {
    pace: "Tempo",
    food: "Jedzenie",
    interests: "Zainteresowania",
    avoid: "Unikaj",
    preferences: "Preferencje",
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="bg-muted px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate("/")} className="p-1 text-foreground/70">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Podsumowanie dnia</h1>
        {saving && <span className="text-xs text-muted-foreground">Zapisywanie...</span>}
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Summary card */}
        <div className="mx-4 mt-4 rounded-2xl bg-card border border-border/50 overflow-hidden">
          <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-xl font-bold leading-tight">{cityLabel}</h2>
                {(dayLabel || dateLabel) && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[dayLabel, dateLabel].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            {route?.ai_summary && (
              <p className="text-sm text-foreground/80 leading-relaxed">{route.ai_summary}</p>
            )}
            {route?.ai_highlight && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-muted/60 text-sm text-muted-foreground italic">
                "{route.ai_highlight}"
              </div>
            )}
          </div>
        </div>

        {/* Photos section */}
        <div className="mx-4 mt-4">
          <p className="text-sm font-medium mb-2">Zdjęcia</p>
          <div className="flex gap-2 flex-wrap">
            {photos.map((url) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border/40">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(url)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-foreground/30 transition-colors"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">{uploading ? "..." : "Dodaj"}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Narrative section */}
        <div className="mx-4 mt-4">
          <p className="text-sm font-medium mb-2">Relacja z podróży</p>
          <textarea
            value={narrative}
            onChange={e => handleNarrativeChange(e.target.value)}
            placeholder="Opisz swoje wspomnienia z tego dnia..."
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/50 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20 placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Insights banner */}
        {insights && insights.length > 0 && (
          <div className="mx-4 mt-4 rounded-2xl bg-muted/50 border border-border/40 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-foreground/60" />
              <p className="text-sm font-semibold">Czego się nauczyłam o Tobie</p>
            </div>
            <ul className="space-y-1.5">
              {insights.map((ins, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5 self-start mt-px shrink-0">
                    {categoryLabels[ins.category] ?? ins.category}
                  </span>
                  <span className="text-foreground/80 leading-snug">{ins.insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chat history (collapsible) */}
        {chatMessages.length > 0 && (
          <div className="mx-4 mt-4">
            <button
              onClick={() => setChatOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border/50 text-sm font-semibold"
            >
              <span>Historia rozmowy</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", chatOpen && "rotate-180")} />
            </button>
            {chatOpen && (
              <div className="mt-1 rounded-2xl bg-card border border-border/50 overflow-hidden px-4 py-3 space-y-3">
                {chatMessages
                  .filter(m => m.content && m.content !== "Cześć! Opowiem Ci o moim dniu.")
                  .map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-foreground text-background"
                          : "bg-muted text-foreground"
                      )}>
                        {m.content}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSummary;
