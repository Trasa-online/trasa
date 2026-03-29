import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, ChevronDown, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompression";
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const narrativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: route } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, review_narrative")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

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

  const { data: insights } = useQuery({
    queryKey: ["route-insights", routeId],
    queryFn: async () => {
      if (!routeId || !user) return [];
      const { data } = await supabase
        .from("user_insights" as any)
        .select("category, insight")
        .eq("source_route_id", routeId);
      return (data ?? []) as unknown as { category: string; insight: string }[];
    },
    enabled: !!routeId && !!user,
  });

  useEffect(() => {
    if (route?.review_narrative) setNarrative(route.review_narrative);
    if (route?.review_photos?.length) setPhotos(route.review_photos);
  }, [route?.review_narrative, route?.review_photos]);

  const chatMessages: { role: string; content: string }[] =
    locationState?.messages ?? (chatSession?.messages as any) ?? [];

  const saveNarrative = useCallback((value: string) => {
    if (!routeId) return;
    if (narrativeTimer.current) clearTimeout(narrativeTimer.current);
    narrativeTimer.current = setTimeout(async () => {
      setSaving(true);
      await supabase.from("routes").update({ review_narrative: value } as any).eq("id", routeId);
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
        const path = `${user.id}/${routeId}/review_${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("route-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (!error) newUrls.push(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
      } catch {}
    }
    if (newUrls.length) {
      const updated = [...photos, ...newUrls];
      setPhotos(updated);
      await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = async (url: string) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
  };

  const cityLabel = route?.city || "Podróż";
  const dayLabel = route?.day_number ? `Dzień ${route.day_number}` : "";
  const dateLabel = route?.start_date
    ? format(new Date(route.start_date), "d MMMM yyyy", { locale: pl })
    : "";

  const categoryLabels: Record<string, string> = {
    pace: "Tempo", food: "Jedzenie", interests: "Zainteresowania",
    avoid: "Unikaj", preferences: "Preferencje",
  };

  if (!user) { navigate("/auth"); return null; }

  const heroPhoto = photos[0];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-[4/5] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        {heroPhoto && (
          <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />

        {/* No photo placeholder */}
        {!heroPhoto && (
          <div className="absolute inset-0 flex items-center justify-center text-8xl opacity-20 select-none">
            🗺️
          </div>
        )}

        {/* Back + save indicator */}
        <div className="absolute left-0 right-0 flex items-center justify-between px-4"
          style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button
            onClick={() => navigate("/")}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          {saving && (
            <span className="text-xs text-white/70 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
              Zapisywanie...
            </span>
          )}
        </div>

        {/* City + date */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          {dateLabel && (
            <p className="text-white/70 text-sm mb-1">{dateLabel}</p>
          )}
          <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm">
            {cityLabel}
          </h1>
          {dayLabel && (
            <p className="text-white/70 text-base font-medium mt-0.5">{dayLabel}</p>
          )}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {/* AI highlight — big pull quote */}
        {route?.ai_highlight && (
          <div className="px-5 pt-6 pb-5 border-b border-border/30">
            <p className="text-[22px] font-bold leading-snug text-foreground">
              „{route.ai_highlight}"
            </p>
          </div>
        )}

        {/* AI summary */}
        <div className="px-5 pt-5 pb-5 border-b border-border/30">
          {route?.ai_summary ? (
            <p className="text-sm text-foreground/70 leading-relaxed">{route.ai_summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic leading-relaxed">
              Brak podsumowania AI — dodaj zdjęcia i opis, żeby zachować wspomnienia z tego dnia.
            </p>
          )}
        </div>

        {/* ── Photos ── */}
        <div className="pt-5 pb-5 border-b border-border/30">
          <div className="flex items-center justify-between px-5 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zdjęcia
            </p>
            {photos.length > 0 && photos.length < 6 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-primary"
              >
                {uploading ? "Dodawanie…" : "+ Dodaj"}
              </button>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
              {photos.map((url) => (
                <div key={url} className="relative flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden shadow-sm">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-shrink-0 w-32 h-32 rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">{uploading ? "…" : "Dodaj"}</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mx-5 w-[calc(100%-40px)] h-24 rounded-2xl border-2 border-dashed border-border/40 flex items-center justify-center gap-2.5 text-muted-foreground active:bg-muted/40 transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span className="text-sm">{uploading ? "Dodawanie…" : "Dodaj zdjęcia z tego dnia"}</span>
            </button>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* ── Narrative ── */}
        <div className="px-5 pt-5 pb-5 border-b border-border/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Twoje wspomnienia
          </p>
          <textarea
            value={narrative}
            onChange={e => handleNarrativeChange(e.target.value)}
            placeholder="Co zapamiętasz z tego dnia? Opisz swoje wrażenia, emocje, niespodzianki…"
            rows={5}
            className="w-full bg-transparent border-0 text-[15px] text-foreground resize-none focus:outline-none placeholder:text-muted-foreground/40 leading-relaxed"
          />
        </div>

        {/* ── Insights ── */}
        {insights && insights.length > 0 && (
          <div className="mx-5 mt-4 rounded-2xl bg-card border border-border/50 overflow-hidden">
            <button
              onClick={() => setInsightsOpen(p => !p)}
              className="w-full flex items-center gap-3 px-4 py-3.5"
            >
              <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">Zapisane wnioski</p>
                <p className="text-[11px] text-muted-foreground">{insights.length} rzeczy na kolejne podróże</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", insightsOpen && "rotate-180")} />
            </button>
            {insightsOpen && (
              <ul className="divide-y divide-border/30 border-t border-border/40">
                {insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 self-start mt-0.5 shrink-0">
                      {categoryLabels[ins.category] ?? ins.category}
                    </span>
                    <span className="text-sm text-foreground/80 leading-snug">{ins.insight}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Chat history ── */}
        {chatMessages.length > 0 && (
          <div className="mx-5 mt-3">
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
                  .filter(m => m.content && !m.content.startsWith("Skończyłem") && m.content !== "Cześć! Opowiem Ci o moim dniu.")
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

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base active:scale-[0.98] transition-transform"
        >
          Gotowe
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
