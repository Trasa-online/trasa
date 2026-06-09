import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Users, ArrowRight, CheckCircle, BookOpen } from "lucide-react";
import { parseISO, isValid, format, formatDistanceToNow, startOfToday } from "date-fns";
import { pl } from "date-fns/locale";
import JournalTab from "@/components/home/JournalTab";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";

const Journal = () => {
  const { user, isAnonymous } = useAuth();
  const { open } = useAuthDrawer();
  // Anon = traktuj jak gosc (zero zapisanych danych w UI). Dziennik wymaga
  // konta z mailem zeby trasy/pocztówki byly persystowane miedzy urzadzeniami.
  const isGuestView = !user || isAnonymous;
  const navigate = useNavigate();

  // Active group sessions (for logged-in user only)
  const { data: allSessions = [] } = useQuery({
    queryKey: ["journal-active-sessions", user?.id],
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
        .select("id, city, join_code, trip_date, created_at, status, name")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(20);
      return sessions || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const sessionIds = allSessions.map((s: any) => s.id);
  const { data: sessionRoutes = [] } = useQuery({
    queryKey: ["journal-session-routes-bulk", sessionIds.join(",")],
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

  const today = startOfToday();
  const activeSessions = allSessions.filter((s: any) => {
    const route = sessionRoutes.find((r: any) => r.group_session_id === s.id);
    if (route?.chat_status === "completed") return false;
    if (s.trip_date && parseISO(s.trip_date) < today) return false;
    return true;
  });

  // Guest: pelnoekranowy wycentrowany empty state, bez tytulu strony (TopBar tez ukryty na route /dziennik)
  if (isGuestView) {
    // Większy pb żeby empty state wygladał na realnie wycentrowany (bez tego
    // pb=5rem grupa landuje ~10-15% ponizej optycznego srodka - icon + tytul
    // sa lekkie, button na dole ciągnie wizualnie ku dolowi).
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
        <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <BookOpen className="h-9 w-9 text-orange-600" />
        </div>
        <div className="space-y-2 max-w-[320px]">
          <p className="text-2xl font-black tracking-tight leading-tight">Twój dziennik podróży</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Załóż konto, żeby zapisywać trasy, dodawać zdjęcia i&nbsp;oceniać miejsca z&nbsp;każdej podróży.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
          <button
            onClick={() => open({ mode: "register", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Załóż konto
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => open({ mode: "login", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-white border-2 border-orange-600 text-orange-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Zaloguj się
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <h1 className="text-xl font-black tracking-tight pt-2 pb-3">Dziennik podróży</h1>

      <>
          {/* Active group sessions */}
          {activeSessions.length > 0 && (
            <div className="space-y-2.5 mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Aktywne sesje grupowe
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
                const thumb = getRandomPinPlaceholder(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sesja/${s.join_code}`)}
                    className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[11px] font-semibold">
                        <Users className="h-3 w-3" /> Sesja grupowa
                      </div>
                      <div className="absolute top-3 right-3">
                        {hasRoute
                          ? <div className="bg-emerald-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1"><CheckCircle className="h-3 w-3" />Trasa gotowa</div>
                          : <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">Aktywna</div>
                        }
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                        <p className="text-white font-bold text-lg leading-tight drop-shadow-sm truncate">{s.name || s.city}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {dateLabel && (
                            <span className="flex items-center gap-1 text-white/80 text-xs">
                              <CalendarDays className="h-3 w-3" />{dateLabel}
                            </span>
                          )}
                          {agoLabel && !dateLabel && (
                            <span className="text-white/70 text-xs">{agoLabel}</span>
                          )}
                          <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded text-white/90">
                            #{s.join_code}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <JournalTab userId={user.id} />
        </>
    </div>
  );
};

export default Journal;
