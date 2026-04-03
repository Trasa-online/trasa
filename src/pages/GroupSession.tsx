import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum",
  park: "Park", bar: "Bar", club: "Klub", monument: "Zabytek",
  gallery: "Galeria", market: "Targ", viewpoint: "Widok",
  shopping: "Zakupy", experience: "Rozrywka",
};

const GroupSession = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"swipe" | "matches">("swipe");
  const [joining, setJoining] = useState(false);

  // Load session by join code
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["group-session", joinCode],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_sessions")
        .select("*")
        .eq("join_code", joinCode)
        .maybeSingle();
      return data as { id: string; city: string; created_by: string; join_code: string; status: string } | null;
    },
    enabled: !!joinCode,
  });

  // Load members + their profiles
  const { data: members = [] } = useQuery({
    queryKey: ["group-session-members", session?.id],
    queryFn: async () => {
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("user_id, joined_at, finished_at")
        .eq("session_id", session!.id);
      if (!memberRows?.length) return [];
      const userIds = memberRows.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      return memberRows.map((m: any) => ({
        ...m,
        profile: profileMap[m.user_id] ?? null,
      }));
    },
    enabled: !!session?.id,
    refetchInterval: 10000,
  });

  // Load reactions (for matches tab)
  const { data: reactions = [] } = useQuery({
    queryKey: ["group-session-reactions", session?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_reactions")
        .select("*")
        .eq("session_id", session!.id)
        .in("reaction", ["liked", "super_liked"]);
      return data || [];
    },
    enabled: !!session?.id && tab === "matches",
    refetchInterval: 5000,
  });

  const isMember = members.some((m: any) => m.user_id === user?.id);

  // Compute matches: places liked by at least min(2, memberCount) members
  const matches = useMemo(() => {
    if (!reactions.length || !members.length) return [];
    const minMatch = Math.min(2, members.length);
    const byPlace: Record<string, { users: Set<string>; data: any }> = {};
    for (const r of reactions) {
      if (!byPlace[r.place_name]) byPlace[r.place_name] = { users: new Set(), data: r };
      byPlace[r.place_name].users.add(r.user_id);
    }
    return Object.entries(byPlace)
      .filter(([_, { users }]) => users.size >= minMatch)
      .map(([place_name, { users, data }]) => ({
        place_name,
        category: data.category,
        photo_url: data.photo_url,
        liked_by: users.size,
      }))
      .sort((a, b) => b.liked_by - a.liked_by);
  }, [reactions, members]);

  // Per-member liked count (for matches tab stats)
  const memberStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const r of reactions) stats[r.user_id] = (stats[r.user_id] ?? 0) + 1;
    return stats;
  }, [reactions]);

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!session) return;
    setJoining(true);
    try {
      const { error } = await (supabase as any)
        .from("group_session_members")
        .insert({ session_id: session.id, user_id: user.id });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
      toast.success("Dołączono do sesji!");
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas dołączania");
    } finally {
      setJoining(false);
    }
  };

  // ── Loading states ─────────────────────────────────────────────────────────

  if (authLoading || sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center">
        <p className="text-4xl">🔍</p>
        <p className="font-bold text-lg">Nie znaleziono sesji</p>
        <p className="text-sm text-muted-foreground">Sprawdź czy kod zaproszenia jest poprawny.</p>
        <button onClick={() => navigate("/")} className="text-sm text-orange-600 font-semibold underline">
          Wróć do strony głównej
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center max-w-sm mx-auto">
        <p className="text-4xl">👋</p>
        <p className="font-bold text-lg">Zaloguj się, żeby dołączyć</p>
        <p className="text-sm text-muted-foreground">
          Twój znajomy zaprasza Cię do wspólnego matchowania miejsc w <strong>{session.city}</strong>.
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-base"
        >
          Zaloguj się
        </button>
      </div>
    );
  }

  // ── Join screen (not yet a member) ─────────────────────────────────────────

  if (!isMember) {
    return (
      <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button onClick={() => navigate(-1)} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-base">Zaproszenie do sesji</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
          <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-black mb-1">Grupowe matchowanie</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Swipe'ujcie miejsca w <strong>{session.city}</strong> niezależnie i sprawdźcie, co Was łączy!
            </p>
          </div>

          {/* Members already in session */}
          {members.length > 0 && (
            <div className="w-full rounded-2xl border border-border/40 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-3">W sesji ({members.length}/4)</p>
              <div className="flex flex-col gap-2">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                      {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{m.profile?.first_name || m.profile?.username || "Użytkownik"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={joining || members.length >= 4}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
          >
            {joining ? "Dołączam…" : members.length >= 4 ? "Sesja pełna (max 4 osoby)" : "Dołącz i zacznij swipe'ować"}
          </button>
        </div>
      </div>
    );
  }

  // ── Member view: Swipe + Matches tabs ──────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate(-1)} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-base leading-tight">{session.city}</p>
          <p className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? "osoba" : "osoby"} · #{joinCode}</p>
        </div>
        {/* Member avatars */}
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m: any) => (
            <div
              key={m.user_id}
              className="h-7 w-7 rounded-full bg-orange-600/20 border-2 border-background flex items-center justify-center text-xs font-bold text-orange-700"
              title={m.profile?.first_name || m.profile?.username}
            >
              {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        <button
          onClick={() => setTab("swipe")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
            tab === "swipe" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"
          }`}
        >
          Swipe'uj
        </button>
        <button
          onClick={() => setTab("matches")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            tab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"
          }`}
        >
          Dopasowania
          {matches.length > 0 && (
            <span className="h-4.5 min-w-4.5 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold leading-4">
              {matches.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === "swipe" && (
          <PlaceSwiper
            city={session.city}
            date={new Date()}
            groupSessionId={session.id}
            onGroupFinished={() => setTab("matches")}
          />
        )}

        {tab === "matches" && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            {/* Member stats */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {members.map((m: any) => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card px-3 py-2 shrink-0">
                  <div className="h-7 w-7 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-700">
                    {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{m.profile?.first_name || m.profile?.username || "Użytkownik"}</p>
                    <p className="text-[10px] text-muted-foreground">{memberStats[m.user_id] ?? 0} polubionych</p>
                  </div>
                </div>
              ))}
            </div>

            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <p className="text-4xl">🤔</p>
                <p className="font-bold">Brak dopasowań jeszcze</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  Potrzeba co najmniej 2 osób, które polubiły to samo miejsce.
                  Wróć do swipe'owania!
                </p>
                <button
                  onClick={() => setTab("swipe")}
                  className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm"
                >
                  Swipe'uj dalej
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {matches.length} {matches.length === 1 ? "miejsce" : "miejsc"} · lubiane przez co najmniej 2 osoby
                </p>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <div key={m.place_name} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.place_name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight">{m.place_name}</p>
                        {m.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {CATEGORY_LABELS[m.category] ?? m.category}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-600/10">
                        <span className="text-orange-600 font-bold text-xs">{m.liked_by}</span>
                        <span className="text-[10px] text-orange-600">❤️</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupSession;
