import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Share2, Globe, Lock } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶",
};

const ReviewSummary = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");

  const [narrative, setNarrative] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const narrativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: route } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, review_narrative, is_shared")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });


  const { data: pins = [] } = useQuery({
    queryKey: ["review-summary-pins", routeId],
    queryFn: async () => {
      if (!routeId || !user) return [];
      const { data } = await supabase
        .from("pins")
        .select("id, place_name, category, suggested_time, images, image_url, pin_order")
        .eq("route_id", routeId)
        .order("pin_order");
      return (data ?? []) as any[];
    },
    enabled: !!routeId && !!user,
  });


  useEffect(() => {
    if (route?.review_narrative) setNarrative(route.review_narrative);
    if (route?.review_photos?.length) setPhotos(route.review_photos);
    if (route?.is_shared != null) setIsPublic(route.is_shared);
  }, [route?.review_narrative, route?.review_photos, route?.is_shared]);


  const togglePublic = async (val: boolean) => {
    setIsPublic(val);
    if (routeId) await supabase.from("routes").update({ is_shared: val } as any).eq("id", routeId);
  };

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

  const handleShare = async () => {
    if (!routeId) return;
    setSharing(true);
    await supabase.from("routes").update({ is_shared: true } as any).eq("id", routeId);
    const url = `${window.location.origin}/route/${routeId}`;
    if (navigator.share) {
      await navigator.share({ title: `Trasa: ${cityLabel}`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    setSharing(false);
  };

  const cityLabel = route?.city || "Podróż";
  const dayLabel = route?.day_number ? `Dzień ${route.day_number}` : "";
  const dateLabel = route?.start_date
    ? format(new Date(route.start_date), "d MMMM yyyy", { locale: pl })
    : "";

  if (authLoading) return null;
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

        {/* ── Visibility toggle ── */}
        <div className="px-5 pt-4 pb-4 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPublic ? <Globe className="h-4 w-4 text-orange-600" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-semibold">{isPublic ? "Publiczne" : "Prywatne"}</p>
              <p className="text-xs text-muted-foreground">{isPublic ? "Widoczne na feedzie znajomych" : "Tylko dla Ciebie"}</p>
            </div>
          </div>
          <button
            onClick={() => togglePublic(!isPublic)}
            className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? "bg-orange-600" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* ── Places ── */}
        {pins.length > 0 && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Miejsca w tej trasie
            </p>
            <div className="space-y-3">
              {pins.map((pin: any, i: number) => {
                const thumb = pin.images?.[0] ?? pin.image_url ?? null;
                return (
                  <div key={pin.id} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </div>
                    <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          {CATEGORY_EMOJI[pin.category] ?? "📍"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{pin.place_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      </div>

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 space-y-2 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
        >
          <Share2 className="h-4 w-4" />
          {sharing ? "Tworzę link…" : "Poleć tę trasę"}
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full py-3 rounded-2xl text-muted-foreground font-medium text-sm active:bg-muted/50 transition-colors"
        >
          Gotowe
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
