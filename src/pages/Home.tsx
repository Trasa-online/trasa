import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { parseISO, isValid, format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);

  // Active group sessions the user is a member of
  const { data: activeSessions = [] } = useQuery({
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
        .select("id, city, join_code, trip_date, created_at, status, match_count")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(10);
      return (sessions || []).filter((s: any) => {
        if (!s.created_at) return true;
        const created = parseISO(s.created_at);
        const expires = new Date(created.getTime() + 48 * 60 * 60 * 1000);
        return new Date() < expires;
      });
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: matchedPlaces = [] } = useQuery({
    queryKey: ["session-matches", previewSessionId],
    queryFn: async () => {
      if (!previewSessionId) return [];
      // Get all members of this session
      const { data: members } = await (supabase as any)
        .from("group_session_members")
        .select("user_id")
        .eq("session_id", previewSessionId);
      if (!members?.length) return [];
      const memberCount = members.length;
      const memberIds = members.map((m: any) => m.user_id);
      // Get reactions (liked or super_liked) for this session from all members
      const { data: reactions } = await (supabase as any)
        .from("group_session_reactions")
        .select("place_name, reaction, user_id, photo_url, category")
        .eq("session_id", previewSessionId)
        .in("reaction", ["liked", "super_liked"])
        .in("user_id", memberIds);
      if (!reactions?.length) return [];
      // Group by place_name, count unique users
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

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex-1 flex flex-col px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto w-full">

      {/* Hero CTA */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
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

      {/* Sessions list */}
      {activeSessions.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Twoje sesje
          </p>
          {activeSessions.map((s: any) => {
            const isCompleted = s.status === "completed";
            const tripDateObj = s.trip_date ? parseISO(s.trip_date) : null;
            const dateLabel = tripDateObj && isValid(tripDateObj)
              ? format(tripDateObj, "d MMM", { locale: pl })
              : null;
            const createdObj = s.created_at ? parseISO(s.created_at) : null;
            const agoLabel = createdObj && isValid(createdObj)
              ? formatDistanceToNow(createdObj, { addSuffix: true, locale: pl })
              : null;
            return (
              <button
                key={s.id}
                onClick={() => setPreviewSessionId(s.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border active:scale-[0.98] transition-transform text-left ${isCompleted ? "border-border/30 opacity-80" : "border-border/50"}`}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${isCompleted ? "bg-emerald-500/10" : "bg-orange-600/10"}`}>
                  <Users className={`h-4 w-4 ${isCompleted ? "text-emerald-600" : "text-orange-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold leading-tight">{s.city}</p>
                    {isCompleted && (
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full">
                        Zakończone
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isCompleted && s.match_count > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">
                        {s.match_count} {s.match_count === 1 ? "wspólne miejsce" : s.match_count < 5 ? "wspólne miejsca" : "wspólnych miejsc"}
                      </span>
                    )}
                    {!isCompleted && dateLabel && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />{dateLabel}
                      </span>
                    )}
                    {!isCompleted && agoLabel && (
                      <span className="text-xs text-muted-foreground">{agoLabel}</span>
                    )}
                    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      #{s.join_code}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Session preview sheet */}
      {(() => {
        const previewSession = activeSessions.find((s: any) => s.id === previewSessionId);
        const isCompletedPreview = previewSession?.status === "completed";
        return (
          <Sheet open={!!previewSessionId} onOpenChange={(open) => { if (!open) setPreviewSessionId(null); }}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col">
              <SheetHeader className="pb-2">
                <SheetTitle className="text-base font-bold">
                  {previewSession?.city} — dopasowania
                  {matchedPlaces.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({matchedPlaces.length})</span>
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto flex-1 space-y-2">
                {matchedPlaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak wspólnych miejsc jeszcze</p>
                ) : (
                  matchedPlaces.map((p: any) => (
                    <div key={p.place_name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
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
                    </div>
                  ))
                )}
              </div>
              {!isCompletedPreview && previewSession && (
                <div className="pt-3 pb-1 shrink-0">
                  <button
                    onClick={() => { setPreviewSessionId(null); navigate(`/sesja/${previewSession.join_code}`); }}
                    className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                  >
                    Wejdź do sesji →
                  </button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        );
      })()}

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
