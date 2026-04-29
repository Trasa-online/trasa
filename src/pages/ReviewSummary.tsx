import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Globe, Lock, Star } from "lucide-react";
import CreatePolecajkaSheet from "@/components/home/CreatePolecajkaSheet";
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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
  const isNewCompletion = searchParams.get("new") === "1";

  const [narrative, setNarrative] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinRatings, setPinRatings] = useState<Record<string, number>>({});
  const [highlightPlace, setHighlightPlace] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [notVisited, setNotVisited] = useState<Record<string, boolean>>({});
  const [notVisitedReason, setNotVisitedReason] = useState<Record<string, string>>({});
  const [notVisitedSaved, setNotVisitedSaved] = useState<Record<string, boolean>>({});
  const [showPolecajkaSheet, setShowPolecajkaSheet] = useState(false);
  const [polecajkaPublished, setPolecajkaPublished] = useState(false);
  const notVisitedTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const narrativeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: route } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, review_narrative, is_shared, group_session_id, overall_rating")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

  // Group session: fetch all participants
  const { data: groupParticipants = [] } = useQuery({
    queryKey: ["review-summary-participants", route?.group_session_id],
    queryFn: async () => {
      if (!route?.group_session_id) return [];
      // Use group_session_members - always populated when users join
      const { data: members } = await (supabase as any)
        .from("group_session_members")
        .select("user_id")
        .eq("session_id", route.group_session_id);
      if (!members?.length) return [];
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      return (profiles ?? []) as { id: string; username: string | null; first_name: string | null; avatar_url: string | null }[];
    },
    enabled: !!route?.group_session_id,
  });

  // Group session: fetch other participants' photos
  const { data: groupPhotos = [] } = useQuery({
    queryKey: ["review-summary-group-photos", route?.group_session_id],
    queryFn: async () => {
      if (!route?.group_session_id || !user) return [];
      // Get all routes in the same group session (excluding current)
      const { data: groupRoutes } = await supabase
        .from("routes")
        .select("id, user_id, review_photos")
        .eq("group_session_id", route.group_session_id)
        .neq("id", routeId);
      if (!groupRoutes?.length) return [];
      // Fetch profiles for those users
      const userIds = [...new Set(groupRoutes.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      return groupRoutes.flatMap((r: any) =>
        (r.review_photos ?? []).map((url: string) => ({
          url,
          userId: r.user_id,
          username: profileMap[r.user_id]?.first_name || profileMap[r.user_id]?.username || "Uczestnik",
        }))
      );
    },
    enabled: !!route?.group_session_id,
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

  const { data: existingRatings = [] } = useQuery({
    queryKey: ["pin-ratings", routeId, user?.id],
    queryFn: async () => {
      if (!routeId || !user) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("place_name, rating, is_highlight, not_visited, not_visited_reason")
        .eq("route_id", routeId)
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!routeId && !!user,
  });

  useEffect(() => {
    if (route?.review_narrative) setNarrative(route.review_narrative);
    if (route?.review_photos?.length) setPhotos(route.review_photos);
    if (route?.is_shared != null) setIsPublic(route.is_shared);
  }, [route?.review_narrative, route?.review_photos, route?.is_shared]);

  useEffect(() => {
    if (existingRatings.length) {
      const map: Record<string, number> = {};
      const nv: Record<string, boolean> = {};
      const nvr: Record<string, string> = {};
      let hl: string | null = null;
      for (const r of existingRatings) {
        if (r.rating) map[r.place_name] = r.rating;
        if (r.is_highlight) hl = r.place_name;
        if (r.not_visited) nv[r.place_name] = true;
        if (r.not_visited_reason) nvr[r.place_name] = r.not_visited_reason;
      }
      setPinRatings(map);
      setHighlightPlace(hl);
      setNotVisited(nv);
      setNotVisitedReason(nvr);
    }
  }, [existingRatings]);

  // Dismiss "Nowa trasa!" badge when user opens the review
  useEffect(() => {
    if (!routeId || !user) return;
    (supabase as any).rpc("dismiss_route_badge", { p_route_id: routeId });
  }, [routeId, user]);

  useEffect(() => {
    if (route?.overall_rating) setOverallRating(route.overall_rating);
  }, [route?.overall_rating]);

  const togglePublic = async (val: boolean) => {
    setIsPublic(val);
    if (routeId) {
      await supabase.from("routes").update({ is_shared: val } as any).eq("id", routeId);
      queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    }
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
    for (const file of files.slice(0, 15 - photos.length)) {
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

  const setCoverPhoto = async (url: string) => {
    const updated = [url, ...photos.filter(p => p !== url)];
    setPhotos(updated);
    await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
  };

  const ratePinHandler = async (placeName: string, rating: number) => {
    if (!routeId || !user) return;
    setPinRatings(prev => ({ ...prev, [placeName]: rating }));
    await (supabase as any).from("pin_ratings").upsert({
      route_id: routeId,
      user_id: user.id,
      place_name: placeName,
      rating,
      is_highlight: highlightPlace === placeName,
    }, { onConflict: "route_id,user_id,place_name" });
  };

  const toggleHighlight = async (placeName: string) => {
    if (!routeId || !user) return;
    const newHL = highlightPlace === placeName ? null : placeName;
    // Remove highlight from previous
    if (highlightPlace && highlightPlace !== placeName) {
      await (supabase as any).from("pin_ratings").upsert({
        route_id: routeId, user_id: user.id, place_name: highlightPlace,
        rating: pinRatings[highlightPlace] ?? null, is_highlight: false,
      }, { onConflict: "route_id,user_id,place_name" });
    }
    setHighlightPlace(newHL);
    if (newHL) {
      await (supabase as any).from("pin_ratings").upsert({
        route_id: routeId, user_id: user.id, place_name: newHL,
        rating: pinRatings[newHL] ?? null, is_highlight: true,
      }, { onConflict: "route_id,user_id,place_name" });
    }
  };

  const toggleNotVisited = async (placeName: string) => {
    if (!routeId || !user) return;
    const newVal = !notVisited[placeName];
    setNotVisited(prev => ({ ...prev, [placeName]: newVal }));
    await (supabase as any).from("pin_ratings").upsert({
      route_id: routeId, user_id: user.id, place_name: placeName,
      not_visited: newVal,
      not_visited_reason: notVisitedReason[placeName] ?? null,
      rating: null, is_highlight: false,
    }, { onConflict: "route_id,user_id,place_name" });
  };

  const handleNotVisitedReason = (placeName: string, value: string) => {
    setNotVisitedReason(prev => ({ ...prev, [placeName]: value }));
    if (notVisitedTimer.current[placeName]) clearTimeout(notVisitedTimer.current[placeName]);
    notVisitedTimer.current[placeName] = setTimeout(async () => {
      if (!routeId || !user) return;
      await (supabase as any).from("pin_ratings").upsert({
        route_id: routeId, user_id: user.id, place_name: placeName,
        not_visited: true, not_visited_reason: value,
        rating: null, is_highlight: false,
      }, { onConflict: "route_id,user_id,place_name" });
      setNotVisitedSaved(prev => ({ ...prev, [placeName]: true }));
      setTimeout(() => setNotVisitedSaved(prev => ({ ...prev, [placeName]: false })), 2000);
    }, 800);
  };

  const rateOverall = async (rating: number) => {
    if (!routeId) return;
    setOverallRating(rating);
    await (supabase as any).from("routes").update({ overall_rating: rating }).eq("id", routeId);
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
          {/* Group participant avatars */}
          {groupParticipants.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {groupParticipants.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="h-7 w-7 rounded-full border-2 border-white/60 overflow-hidden bg-primary flex items-center justify-center text-white text-[10px] font-bold"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p.first_name || p.username || "?")[0].toUpperCase()
                    )}
                  </div>
                ))}
                {groupParticipants.length > 5 && (
                  <div className="h-7 w-7 rounded-full border-2 border-white/60 bg-black/50 flex items-center justify-center text-white text-[9px] font-bold">
                    +{groupParticipants.length - 5}
                  </div>
                )}
              </div>
              <span className="text-white/70 text-xs font-medium">
                {groupParticipants.length} uczestników
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {/* Celebration banner - only when arriving from "Zakończ trasę" */}
        {isNewCompletion && (
          <div className="px-5 pt-6 pb-5 text-center border-b border-border/30">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-xl font-black">Świetna trasa!</h2>
            <p className="text-sm text-muted-foreground mt-1">Oceń miejsca i zachowaj wspomnienia</p>
          </div>
        )}

        {/* Overall rating */}
        <div className="px-5 pt-5 pb-5 border-b border-border/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ocena trasy</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => rateOverall(n)}
                className={`text-2xl transition-transform active:scale-90 ${n <= (overallRating ?? 0) ? "opacity-100" : "opacity-25"}`}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        {/* AI highlight - big pull quote */}
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
              Brak podsumowania AI - dodaj zdjęcia i opis, żeby zachować wspomnienia z tego dnia.
            </p>
          )}
        </div>

        {/* ── Photos ── */}
        <div className="pt-5 pb-5 border-b border-border/30">
          <div className="flex items-center justify-between px-5 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zdjęcia
            </p>
            {photos.length > 0 && photos.length < 15 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-primary"
              >
                {uploading ? "Dodawanie…" : "+ Dodaj"}
              </button>
            )}
          </div>

          {/* My photos */}
          {photos.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
              {photos.map((url, idx) => (
                <div key={url} className="relative flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden shadow-sm">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {idx !== 0 && (
                    <button
                      onClick={() => setCoverPhoto(url)}
                      title="Ustaw jako okładkę"
                      className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1"
                    >
                      <Star className="h-3 w-3 text-white" />
                    </button>
                  )}
                  {idx === 0 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-primary/90 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Okładka
                    </div>
                  )}
                  <button
                    onClick={() => removePhoto(url)}
                    className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 15 && (
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

          {/* Group participants' photos */}
          {groupPhotos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 mb-3">
                Zdjęcia uczestników
              </p>
              <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
                {groupPhotos.map((item, idx) => (
                  <div key={`${item.url}-${idx}`} className="relative flex-shrink-0 w-32 rounded-2xl overflow-hidden shadow-sm">
                    <img src={item.url} alt="" className="w-full h-32 object-cover" />
                    <div className="px-1.5 py-1 bg-card/80 backdrop-blur-sm">
                      <p className="text-[10px] font-medium text-foreground/70 truncate">{item.username}</p>
                    </div>
                    <button
                      onClick={() => setCoverPhoto(item.url)}
                      title="Ustaw jako moją okładkę"
                      className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1"
                    >
                      <Star className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* ── Visibility toggle ── */}
        <div className="px-5 pt-4 pb-4 border-b border-border/30 flex items-center gap-3">
          {isPublic ? <Globe className="h-4 w-4 text-orange-600 flex-shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{isPublic ? "Publiczne" : "Prywatne"}</p>
            <p className="text-xs text-muted-foreground">{isPublic ? "Widoczne na feedzie znajomych" : "Tylko dla Ciebie"}</p>
          </div>
          <button
            onClick={() => togglePublic(!isPublic)}
            className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 ${isPublic ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* ── Places with star ratings ── */}
        {pins.length > 0 && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Oceń miejsca</p>
            <div className="space-y-4">
              {pins.map((pin: any) => {
                const thumb = pin.images?.[0] ?? pin.image_url ?? null;
                const currentRating = pinRatings[pin.place_name] ?? 0;
                const isHL = highlightPlace === pin.place_name;
                const isNV = notVisited[pin.place_name] ?? false;
                return (
                  <div key={pin.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl overflow-hidden bg-muted shrink-0 ${isNV ? "opacity-40" : ""}`}>
                        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : (
                          <div className="w-full h-full flex items-center justify-center text-lg">{CATEGORY_EMOJI[pin.category] ?? "📍"}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold leading-tight truncate flex-1 ${isNV ? "line-through text-muted-foreground" : ""}`}>{pin.place_name}</p>
                          {isNV && (
                            <span className="text-[10px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0">Nie było</span>
                          )}
                        </div>
                        {!isNV && (
                          <div className="flex items-center gap-1 mt-1">
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={() => ratePinHandler(pin.place_name, n)}
                                className={`text-lg leading-none transition-transform active:scale-90 ${n <= currentRating ? "opacity-100" : "opacity-25"}`}>
                                ⭐
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {!isNV && (
                      <button
                        onClick={() => toggleHighlight(pin.place_name)}
                        className={`w-full py-1.5 rounded-xl text-xs font-semibold border transition-colors ${isHL ? "bg-amber-400/20 border-amber-400 text-amber-700" : "border-border/40 text-muted-foreground"}`}
                      >
                        {isHL ? "⭐ Miejsce dnia!" : "Wyróżnij jako miejsce dnia"}
                      </button>
                    )}
                    {isNV ? (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => toggleNotVisited(pin.place_name)}
                          className="w-full py-1.5 rounded-xl text-xs font-semibold border transition-colors bg-red-500/10 border-red-400/60 text-red-600"
                        >
                          ✕ Odznacz nieobecność
                        </button>
                        <div className="relative">
                          <textarea
                            value={notVisitedReason[pin.place_name] ?? ""}
                            onChange={e => handleNotVisitedReason(pin.place_name, e.target.value)}
                            placeholder="Powód (np. było zamknięte)…"
                            rows={2}
                            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/65"
                          />
                          {notVisitedSaved[pin.place_name] && (
                            <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">Zapisano ✓</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleNotVisited(pin.place_name)}
                        className="w-full py-2 rounded-full text-xs font-medium border border-dashed border-border/60 text-muted-foreground bg-muted/20 active:scale-[0.98] transition-transform"
                      >
                        ✕ Nie było tego miejsca na trasie
                      </button>
                    )}
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

        {/* ── Polecajka CTA ── */}
        {pins.length >= 2 && (
          <div className="px-5 pt-5 pb-6">
            {polecajkaPublished ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                <p className="text-2xl mb-1">✓</p>
                <p className="font-bold text-sm text-emerald-800">Polecajka opublikowana!</p>
                <p className="text-xs text-emerald-600 mt-0.5">Widoczna dla wszystkich na stronie głównej</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4">
                <p className="text-base font-black leading-tight">Podziel się tą trasą 🗺️</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Twoje miejsca trafią na discovery feed innych. Ktoś zaplanuje trasę dzięki Tobie!
                </p>
                <button
                  onClick={() => setShowPolecajkaSheet(true)}
                  className="mt-3 w-full py-3 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-sm shadow-orange-400/20"
                >
                  Stwórz polecajkę →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {user && (
        <CreatePolecajkaSheet
          open={showPolecajkaSheet}
          onClose={() => setShowPolecajkaSheet(false)}
          onPublished={() => setPolecajkaPublished(true)}
          city={route?.city ?? ""}
          pins={pins}
          userId={user.id}
        />
      )}

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          Gotowe
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
