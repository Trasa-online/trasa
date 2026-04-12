import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, CalendarDays, MapPin, ArrowLeft, CheckCircle } from "lucide-react";
import { parseISO, isValid, format, formatDistanceToNow, startOfToday } from "date-fns";
import { pl } from "date-fns/locale";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import PlaceDetailSheet from "@/components/home/PlaceDetailSheet";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{
    place_name: string; photo_url?: string | null;
    latitude?: number | null; longitude?: number | null;
  } | null>(null);

  // All group sessions the user is a member of (no expiry filter — historical ones need to be shown)
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

  // Bulk route lookup: one query for all session IDs
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
      // Keep only the most recent route per session
      const seen = new Set<string>();
      return (data || []).filter((r: any) => {
        if (seen.has(r.group_session_id)) return false;
        seen.add(r.group_session_id);
        return true;
      });
    },
    enabled: sessionIds.length > 0,
  });

  // Derive current preview session's route
  const sessionRoute = sessionRoutes.find((r: any) => r.group_session_id === previewSessionId) ?? null;

  // Route pins for map (coords from saved route)
  const { data: routePins = [] } = useQuery({
    queryKey: ["session-route-pins", sessionRoute?.id],
    queryFn: async () => {
      if (!sessionRoute?.id) return [];
      const { data } = await (supabase as any)
        .from("pins")
        .select("place_name, latitude, longitude, category")
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

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex-1 flex flex-col px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto w-full overflow-y-auto">

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Aktywne sesje
          </p>
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
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-orange-600/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{s.name || s.city}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {dateLabel && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />{dateLabel}
                      </span>
                    )}
                    {agoLabel && (
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

      {/* Historical sessions */}
      {historicalSessions.length > 0 && (
        <div className="space-y-2 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Historyczne
          </p>
          {historicalSessions.map((s: any) => {
            const tripDateObj = s.trip_date ? parseISO(s.trip_date) : null;
            const dateLabel = tripDateObj && isValid(tripDateObj)
              ? format(tripDateObj, "d MMM yyyy", { locale: pl })
              : null;
            const sessionRouteEntry = sessionRoutes.find((r: any) => r.group_session_id === s.id);
            return (
              <button
                key={s.id}
                onClick={() => setPreviewSessionId(s.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/30 active:scale-[0.98] transition-transform text-left opacity-70"
              >
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{s.name || s.city}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {dateLabel && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />{dateLabel}
                      </span>
                    )}
                    {sessionRouteEntry && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                        Odbyta
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Hero CTA */}
      <div className={`flex flex-col items-center justify-center gap-8 py-10 ${activeSessions.length > 0 || historicalSessions.length > 0 ? "" : "flex-1"}`}>
        <div className="text-center space-y-3">
          <div className="mx-auto h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none">
              <circle cx="18" cy="16" r="8" fill="#fdba74" />
              <path d="M4 44c0-7.732 6.268-14 14-14s14 6.268 14 14" fill="#fdba74" />
              <circle cx="38" cy="14" r="9" fill="#ea580c" />
              <path d="M22 44c0-8.284 6.716-15 15-15s15 6.716 15 15" fill="#ea580c" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight leading-tight">
            Zaplanujcie razem
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            Swipe'ujcie miejsca niezależnie i odkryjcie co Was łączy. Trasa tworzy się sama z Waszych wspólnych wyborów.
          </p>
        </div>

        <button
          onClick={() => navigate("/sesja/nowa")}
          className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
        >
          <Users className="h-5 w-5" />
          Zaplanuj razem
        </button>
      </div>

      {/* Session preview sheet */}
      {(() => {
        const previewSession = allSessions.find((s: any) => s.id === previewSessionId);
        const isHistorical = historicalSessions.some((s: any) => s.id === previewSessionId);
        const mapPins = routePins.length > 0
          ? routePins
          : [];
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

              {/* Mini map — key on pinsJson so iframe re-renders when pins load */}
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
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 text-left active:scale-[0.98] transition-transform"
                      >
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.place_name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
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
                    // Historical session — only view route, no editing
                    sessionRoute && (
                      <button
                        onClick={() => { setPreviewSessionId(null); navigate(`/review-summary?route=${sessionRoute.id}`); }}
                        className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
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
                          className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                        >
                          Zakończ i oceń trasę ✓
                        </button>
                      )}
                      {sessionRoute && (
                        <button
                          onClick={() => { setPreviewSessionId(null); navigate("/create", { state: { city: sessionRoute.city, existingRouteId: sessionRoute.id } }); }}
                          className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
                        >
                          Otwórz zapisaną trasę →
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => { setPreviewSessionId(null); navigate(`/sesja/${previewSession.join_code}`); }}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform ${sessionRoute ? "border border-border/50 bg-card text-foreground" : "bg-orange-600 text-white"}`}
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

      {/* Admin shortcut */}
      {user.email === "nat.maz98@gmail.com" && (
        <button
          onClick={() => navigate("/admin/routes")}
          className="mt-4 self-center text-xs bg-orange-600/10 text-orange-600 font-semibold px-4 py-2 rounded-full"
        >
          🗺️ Trasy wzorcowe
        </button>
      )}
    </div>
  );
};

export default Home;
