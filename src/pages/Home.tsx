import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, CalendarDays, ArrowLeft, CheckCircle, Sparkles, Trash2 } from "lucide-react";
import { parseISO, isValid, format, formatDistanceToNow, startOfToday, differenceInDays } from "date-fns";
import { pl } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import PlaceDetailSheet from "@/components/home/PlaceDetailSheet";
import HomeTour, { useHomeTour } from "@/components/home/HomeTour";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
};

// ─── Solo trip card ────────────────────────────────────────────────────────────

function PinThumb({ pin, onTap }: { pin: any; onTap: () => void }) {
  const thumb = pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null) || pin.photo_url;
  const emoji = CATEGORY_EMOJI[pin.category] ?? "📍";
  return (
    <button onClick={onTap} className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
      <div className="h-[72px] w-[72px] rounded-2xl overflow-hidden bg-muted">
        {thumb ? (
          <img src={thumb} alt={pin.place_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-2xl">
            {emoji}
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center leading-tight w-[72px] line-clamp-2">{pin.place_name}</p>
    </button>
  );
}

function SoloTripCard({ route, onDelete }: { route: any; onDelete: () => void }) {
  const navigate = useNavigate();
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const pins: any[] = route.pins || [];

  const startDateObj = route.start_date ? parseISO(route.start_date) : null;
  const dateLabel = startDateObj && isValid(startDateObj)
    ? format(startDateObj, "d MMM yyyy", { locale: pl })
    : null;
  const today = startOfToday();
  const daysUntil = startDateObj && isValid(startDateObj) ? differenceInDays(startDateObj, today) : null;
  const countdown =
    daysUntil === 0 ? "Dzisiaj! 🔥"
    : daysUntil === 1 ? "Jutro!"
    : daysUntil !== null && daysUntil > 0 ? `Za ${daysUntil} dni`
    : null;

  // Group pins by day_number (default 1)
  const dayGroups: Record<number, any[]> = {};
  for (const pin of pins) {
    const day = pin.day_number ?? 1;
    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push(pin);
  }
  const days = Object.keys(dayGroups).map(Number).sort();

  return (
    <div className="rounded-3xl bg-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <p className="font-black text-base leading-tight">{route.city || "Trasa"}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {dateLabel && <span className="text-xs text-muted-foreground">{dateLabel}</span>}
            {countdown && (
              <span className="text-xs font-semibold text-orange-600">{countdown}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Days with pins */}
      {days.length > 0 ? days.map((day, idx) => {
        const dayPins = [...dayGroups[day]].sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0));
        const dayDate = startDateObj && days.length > 1
          ? format(new Date(startDateObj.getTime() + (day - 1) * 86400000), "EEE d MMM", { locale: pl })
          : null;
        return (
          <div key={day} className={idx > 0 ? "border-t border-border/20" : ""}>
            {days.length > 1 && (
              <p className="px-4 pt-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                Dzień {day}{dayDate ? ` · ${dayDate}` : ""}
              </p>
            )}
            <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none">
              {dayPins.map((pin: any) => (
                <PinThumb key={pin.id} pin={pin} onTap={() => setSelectedPin(pin)} />
              ))}
            </div>
          </div>
        );
      }) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">Brak miejsc w trasie</p>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        <button
          onClick={() => navigate(`/edit-plan?route=${route.id}`)}
          className="flex-1 py-2.5 rounded-full bg-foreground text-background font-bold text-xs active:scale-95 transition-transform"
        >
          Podejrzyj plan →
        </button>
        <button
          onClick={() => navigate("/plan", {
            state: {
              city: route.city,
              step: 3,
              date: route.start_date,
              likedPlaceNames: pins.map((p: any) => p.place_name),
            },
          })}
          className="flex-1 py-2.5 rounded-full border border-border/60 text-foreground font-bold text-xs active:scale-95 transition-transform bg-card"
        >
          Dodaj miejsca
        </button>
      </div>

      {selectedPin && (
        <PlaceDetailSheet
          pin={{ id: selectedPin.id, place_name: selectedPin.place_name, latitude: selectedPin.latitude, longitude: selectedPin.longitude }}
          open={!!selectedPin}
          onOpenChange={(open) => { if (!open) setSelectedPin(null); }}
        />
      )}
    </div>
  );
}

// ─── Inspiration template card ─────────────────────────────────────────────────

// ─── Home page ────────────────────────────────────────────────────────────────

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isGuest = !loading && !user;
  const { showTour, dismissTour } = useHomeTour(isGuest);
  const queryClient = useQueryClient();
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });
  const [selectedPlace, setSelectedPlace] = useState<{
    place_name: string; photo_url?: string | null;
    latitude?: number | null; longitude?: number | null;
  } | null>(null);

  // All group sessions the user is a member of
  const { data: allSessions = [] } = useQuery({
    queryKey: ["my-active-sessions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("session_id")
        .eq("user_id", user.id);
      if (!memberRows?.length) return [];
      const sessionIds = memberRows.map((m: any) => m.session_id);
      const { data: sessions } = await (supabase as any)
        .from("group_sessions")
        .select("id, city, join_code, trip_date, created_at, status, match_count, name")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(20);
      return sessions || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Solo routes (no group session)
  const { data: soloRoutes = [] } = useQuery({
    queryKey: ["solo-routes-home", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, city, start_date, trip_type, num_days, pins(id, place_name, latitude, longitude, category, pin_order, day_number, image_url, images, photo_url)")
        .eq("user_id", user.id)
        .is("group_session_id", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
    staleTime: 0,
  });

  // Bulk route lookup for group sessions
  const sessionIds = allSessions.map((s: any) => s.id);
  const { data: sessionRoutes = [] } = useQuery({
    queryKey: ["session-routes-bulk", sessionIds.join(",")],
    queryFn: async () => {
      if (!sessionIds.length) return [];
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, group_session_id, chat_status")
        .in("group_session_id", sessionIds)
        .order("created_at", { ascending: false });
      const seen = new Set<string>();
      return (data || []).filter((r: any) => {
        if (seen.has(r.group_session_id)) return false;
        seen.add(r.group_session_id);
        return true;
      });
    },
    enabled: sessionIds.length > 0,
  });

  const sessionRoute = sessionRoutes.find((r: any) => r.group_session_id === previewSessionId) ?? null;

  const { data: routePins = [] } = useQuery({
    queryKey: ["session-route-pins", sessionRoute?.id],
    queryFn: async () => {
      if (!sessionRoute?.id) return [];
      const { data } = await (supabase as any)
        .from("pins")
        .select("place_name, latitude, longitude, category, image_url, images")
        .eq("route_id", sessionRoute.id);
      return (data || []).filter((p: any) => p.latitude && p.longitude);
    },
    enabled: !!sessionRoute?.id,
  });

  const { data: matchedPlaces = [] } = useQuery({
    queryKey: ["session-matches", previewSessionId],
    queryFn: async () => {
      if (!previewSessionId) return [];
      const { data: members } = await (supabase as any)
        .from("group_session_members")
        .select("user_id")
        .eq("session_id", previewSessionId);
      if (!members?.length) return [];
      const memberCount = members.length;
      const memberIds = members.map((m: any) => m.user_id);
      const { data: reactions } = await (supabase as any)
        .from("group_session_reactions")
        .select("place_name, reaction, user_id, photo_url, category")
        .eq("session_id", previewSessionId)
        .in("reaction", ["liked", "super_liked"])
        .in("user_id", memberIds);
      if (!reactions?.length) return [];
      const map = new Map<string, { place_name: string; photo_url: string | null; category: string; users: Set<string>; hasSuperLike: boolean }>();
      for (const r of reactions) {
        const key = r.place_name;
        if (!map.has(key)) map.set(key, { place_name: key, photo_url: r.photo_url ?? null, category: r.category ?? "", users: new Set(), hasSuperLike: false });
        const entry = map.get(key)!;
        entry.users.add(r.user_id);
        if (r.reaction === "super_liked") entry.hasSuperLike = true;
      }
      const minMatch = Math.min(2, memberCount);
      return Array.from(map.values())
        .filter(p => p.users.size >= minMatch)
        .sort((a, b) => (b.hasSuperLike ? 1 : 0) - (a.hasSuperLike ? 1 : 0) || b.users.size - a.users.size)
        .map(p => ({ place_name: p.place_name, photo_url: p.photo_url, category: p.category, hasSuperLike: p.hasSuperLike }));
    },
    enabled: !!previewSessionId,
  });

  // Split sessions: active vs historical
  const today = startOfToday();
  const activeSessions = allSessions.filter((s: any) => {
    const route = sessionRoutes.find((r: any) => r.group_session_id === s.id);
    if (route?.chat_status === "completed") return false;
    if (s.trip_date && parseISO(s.trip_date) < today) return false;
    return true;
  });
  const historicalSessions = allSessions.filter((s: any) => {
    const route = sessionRoutes.find((r: any) => r.group_session_id === s.id);
    return route?.chat_status === "completed" || (s.trip_date && parseISO(s.trip_date) < today);
  });

  const hasPersonalContent = soloRoutes.length > 0 || activeSessions.length > 0;

  if (loading) return null;

  return (
    <div className={`flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto w-full overflow-y-auto`}>

      {/* ── Maintenance banner ── */}
      <div className="flex items-start gap-3 mb-5 px-4 py-4 rounded-2xl bg-amber-50 border border-amber-200">
        <span className="text-xl shrink-0">🔧</span>
        <div>
          <p className="text-sm font-bold text-amber-900 leading-snug">Trwa rozbudowa bazy miejsc</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Aplikacja jest chwilowo niedostępna. Wracamy wkrótce z nowymi miastami i miejscami!</p>
        </div>
      </div>

      {/* ── Guest banner ── */}
      {isGuest && (
        <div className="flex items-center justify-between gap-3 mb-5 px-4 py-3.5 rounded-2xl bg-orange-50 border border-orange-100">
          <p className="text-xs text-orange-800 font-semibold leading-snug">
            🧳 Dołącz za darmo — zapisuj trasy i zbieraj wspomnienia z podróży!
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="shrink-0 text-xs font-bold text-white bg-primary px-3.5 py-2 rounded-full active:scale-95 transition-transform whitespace-nowrap"
          >
            Dołącz →
          </button>
        </div>
      )}

      {/* ── Admin link ── */}
      {isAdmin && (
        <button
          onClick={() => navigate("/admin")}
          className="w-full flex items-center justify-between mb-4 px-4 py-3 rounded-2xl bg-muted border border-border/40 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
        >
          <span>⚙️ Panel admina</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* ── Personal section ── */}
      {hasPersonalContent && (
        <div className="space-y-3 mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Twoje trasy
          </p>

          {/* Solo routes */}
          {soloRoutes.map((route: any) => (
            <SoloTripCard
              key={route.id}
              route={route}
              onDelete={async () => {
                queryClient.setQueryData(["solo-routes-home", user?.id], (old: any[]) =>
                  (old ?? []).filter((r: any) => r.id !== route.id)
                );
                await (supabase as any).from("pins").delete().eq("route_id", route.id);
                await (supabase as any).from("routes").delete().eq("id", route.id);
                toast.success(`Usunięto trasę „${route.city}"`);
              }}
            />
          ))}

          {/* Active group sessions */}
          {activeSessions.map((s: any) => {
            const tripDateObj = s.trip_date ? parseISO(s.trip_date) : null;
            const dateLabel = tripDateObj && isValid(tripDateObj)
              ? format(tripDateObj, "d MMM", { locale: pl })
              : null;
            const createdObj = s.created_at ? parseISO(s.created_at) : null;
            const agoLabel = createdObj && isValid(createdObj)
              ? formatDistanceToNow(createdObj, { addSuffix: true, locale: pl })
              : null;
            const sessionRouteEntry = sessionRoutes.find((r: any) => r.group_session_id === s.id);
            const hasRoute = !!sessionRouteEntry;
            return (
              <button
                key={s.id}
                onClick={() => setPreviewSessionId(s.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-3xl bg-card border border-border/50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight truncate">{s.name || s.city}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {dateLabel && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />{dateLabel}
                      </span>
                    )}
                    {agoLabel && !dateLabel && (
                      <span className="text-xs text-muted-foreground">{agoLabel}</span>
                    )}
                    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      #{s.join_code}
                    </span>
                  </div>
                </div>
                {hasRoute ? (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await (supabase as any).from("routes").update({ chat_status: "completed" }).eq("id", sessionRouteEntry.id);
                      navigate(`/review-summary?route=${sessionRouteEntry.id}&new=1`);
                    }}
                    className="h-8 w-8 flex items-center justify-center shrink-0 text-emerald-500 active:scale-90 transition-transform"
                  >
                    <CheckCircle className="h-6 w-6" />
                  </button>
                ) : (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!hasPersonalContent && (
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          {isGuest ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-6xl">🗺️</p>
              <h2 className="text-xl font-black">Zacznij planować</h2>
              <p className="text-sm text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                Kliknij <strong>+</strong> żeby wybrać miasto i zaplanować trasę — solo lub ze znajomymi.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center space-y-2">
                <p className="text-5xl">🗺️</p>
                <h2 className="text-xl font-black">Zacznij planować</h2>
                <p className="text-sm text-muted-foreground max-w-[220px] mx-auto">
                  Wybierz miasto i datę, a Trasa zaproponuje gotowy plan.
                </p>
              </div>
              <button
                onClick={() => navigate("/plan")}
                className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-primary/20"
              >
                <Sparkles className="h-4 w-4" />
                Zaplanuj pierwszą trasę
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Session preview sheet ── */}
      {(() => {
        const previewSession = allSessions.find((s: any) => s.id === previewSessionId);
        const isHistorical = historicalSessions.some((s: any) => s.id === previewSessionId);
        const mapPins = routePins.length > 0 ? routePins : [];
        const pinsJson = JSON.stringify(mapPins.map((p: any, i: number) => ({ lat: p.latitude, lng: p.longitude, name: p.place_name, index: i + 1 })));
        const leafletHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}body{height:100%;overflow:hidden}#map{height:100%;width:100%}.pm{color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:-apple-system,sans-serif;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.3);background:#ea580c}</style></head><body><div id="map"></div><script>const pins=${pinsJson};const map=L.map('map',{zoomControl:false,attributionControl:false});L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);const coords=pins.map(p=>[p.lat,p.lng]);if(coords.length>1){L.polyline(coords,{color:'#ea580c',weight:2.5,opacity:.6,dashArray:'6 5'}).addTo(map);map.fitBounds(coords,{padding:[30,30]});}else if(coords.length===1){map.setView(coords[0],15);}pins.forEach(p=>{const icon=L.divIcon({className:'',html:'<div class="pm">'+p.index+'</div>',iconSize:[26,26],iconAnchor:[13,13]});L.marker([p.lat,p.lng],{icon}).bindPopup('<b style="font-size:12px">'+p.name+'</b>').addTo(map);});<\/script></body></html>`;
        return (
          <Sheet open={!!previewSessionId} onOpenChange={(open) => { if (!open) setPreviewSessionId(null); }}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[88vh] flex flex-col p-0">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/20 shrink-0">
                <button onClick={() => setPreviewSessionId(null)} className="h-8 w-8 flex items-center justify-center -ml-1 shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{previewSession?.name || previewSession?.city}</p>
                  <p className="text-xs text-muted-foreground">{matchedPlaces.length} wspólnych miejsc</p>
                </div>
              </div>

              {/* Mini map */}
              {mapPins.length > 0 && (
                <div className="h-44 shrink-0">
                  <iframe key={pinsJson} srcDoc={leafletHtml} className="w-full h-full border-0" />
                </div>
              )}

              {/* Places list */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {matchedPlaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak wspólnych miejsc jeszcze</p>
                ) : (
                  matchedPlaces.map((p: any) => {
                    const pinCoords = routePins.find((rp: any) => rp.place_name === p.place_name);
                    return (
                      <button
                        key={p.place_name}
                        onClick={() => setSelectedPlace({
                          ...p,
                          latitude: pinCoords?.latitude ?? null,
                          longitude: pinCoords?.longitude ?? null,
                        })}
                        className="w-full flex items-center gap-3 p-3 rounded-full bg-muted/40 text-left active:scale-[0.98] transition-transform"
                      >
                        {(() => {
                          const pin = routePins.find((rp: any) => rp.place_name === p.place_name);
                          const thumb = p.photo_url || pin?.image_url || (Array.isArray(pin?.images) ? pin.images[0] : null);
                          return thumb ? (
                            <img src={thumb} alt={p.place_name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xl">
                              {CATEGORY_EMOJI[p.category] ?? "📍"}
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.place_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
                        </div>
                        {p.hasSuperLike && <span className="text-base">⭐</span>}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Action buttons */}
              {previewSession && (
                <div className="px-4 py-3 border-t border-border/20 space-y-2 shrink-0">
                  {isHistorical ? (
                    sessionRoute && (
                      <button
                        onClick={() => { setPreviewSessionId(null); navigate(`/review-summary?route=${sessionRoute.id}`); }}
                        className="w-full py-3.5 rounded-full bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
                      >
                        Zobacz trasę w dzienniku →
                      </button>
                    )
                  ) : (
                    <>
                      {sessionRoute && (
                        <button
                          onClick={async () => {
                            await (supabase as any).from("routes").update({ chat_status: "completed" }).eq("id", sessionRoute.id);
                            if (previewSession?.id) {
                              const { data: members } = await (supabase as any)
                                .from("group_session_members")
                                .select("user_id")
                                .eq("session_id", previewSession.id)
                                .neq("user_id", user?.id);
                              const memberIds: string[] = (members ?? []).map((m: any) => m.user_id);
                              if (memberIds.length) {
                                await (supabase as any).from("routes")
                                  .update({ new_for_users: memberIds })
                                  .eq("id", sessionRoute.id);
                                for (const memberId of memberIds) {
                                  supabase.functions.invoke("send-push", {
                                    body: {
                                      user_id: memberId,
                                      title: "Trasa zakończona! 🗺️",
                                      body: `Oceń miejsca z ${sessionRoute.city || "trasy"} i dodaj wspomnienia`,
                                      url: `/review-summary?route=${sessionRoute.id}`,
                                    },
                                  });
                                }
                              }
                            }
                            setPreviewSessionId(null);
                            navigate(`/review-summary?route=${sessionRoute.id}&new=1`);
                          }}
                          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
                        >
                          Zakończ i oceń trasę ✓
                        </button>
                      )}
                      {sessionRoute && (
                        <button
                          onClick={() => { setPreviewSessionId(null); navigate("/create", { state: { city: sessionRoute.city, existingRouteId: sessionRoute.id } }); }}
                          className="w-full py-3.5 rounded-full bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
                        >
                          Otwórz zapisaną trasę →
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => { setPreviewSessionId(null); navigate(`/sesja/${previewSession.join_code}`); }}
                    className={`w-full py-3.5 rounded-full font-bold text-sm active:scale-[0.97] transition-transform ${sessionRoute ? "border border-border/50 bg-card text-foreground" : "bg-primary text-white"}`}
                  >
                    {sessionRoute ? "Wróć do parowania" : "Wejdź do sesji →"}
                  </button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        );
      })()}

      {selectedPlace && (
        <PlaceDetailSheet
          pin={{
            id: selectedPlace.place_name,
            place_name: selectedPlace.place_name,
            latitude: selectedPlace.latitude,
            longitude: selectedPlace.longitude,
          }}
          open={!!selectedPlace}
          onOpenChange={(open) => { if (!open) setSelectedPlace(null); }}
        />
      )}

      {showTour && <HomeTour onDone={dismissTour} />}
    </div>
  );
};

export default Home;
