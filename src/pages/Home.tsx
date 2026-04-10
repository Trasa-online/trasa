import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowRight, CalendarDays } from "lucide-react";
import { parseISO, isValid, format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
        .select("id, city, join_code, trip_date, created_at")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(5);
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

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="mt-6 space-y-2">
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
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/sesja/${s.join_code}`)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-orange-600/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{s.city}</p>
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
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
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
