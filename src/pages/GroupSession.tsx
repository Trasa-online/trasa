import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Star, Check, Route, UserPlus, Play, Clock, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MOCK_MODE, getMockPlaces } from "@/lib/mockPlaces";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum",
  park: "Park", bar: "Bar", club: "Klub", monument: "Zabytek",
  gallery: "Galeria", market: "Targ", viewpoint: "Widok",
  shopping: "Zakupy", experience: "Rozrywka",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchItem {
  place_name: string;
  category: string;
  photo_url: string | null;
  liked_by: number;
  hasSuperLike: boolean;
}

interface BannerData {
  placeName: string;
  otherName: string;
}

// ─── GroupSession ─────────────────────────────────────────────────────────────

const GroupSession = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"swipe" | "matches">("swipe");
  const [joining, setJoining] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [deselectedPlaces, setDeselectedPlaces] = useState<Set<string>>(new Set());
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [routeProposed, setRouteProposed] = useState(false);
  const prevMatchNamesRef = useRef<Set<string> | null>(null);

  // ── Round state ──────────────────────────────────────────────────────────────
  const [myRoundDone, setMyRoundDone] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [voting, setVoting] = useState(false);
  // Mock mode: local round state (no SQL functions needed)
  const [mockRoundNumber, setMockRoundNumber] = useState<number | null>(null);
  const [mockIsVoting, setMockIsVoting] = useState(false);

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["group-session", joinCode],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_sessions")
        .select("*")
        .eq("join_code", joinCode)
        .maybeSingle();
      return data as { id: string; city: string; created_by: string; join_code: string; trip_date: string | null } | null;
    },
    enabled: !!joinCode,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-session-members", session?.id],
    queryFn: async () => {
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("user_id, joined_at")
        .eq("session_id", session!.id);
      if (!memberRows?.length) return [];
      const userIds = memberRows.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      return memberRows.map((m: any) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
    },
    enabled: !!session?.id,
    refetchInterval: 10000,
  });

  // Always poll reactions (used for both match tab + banner detection)
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
    enabled: !!session?.id,
    refetchInterval: 5000,
  });

  // ── Current round ───────────────────────────────────────────────────────────

  const { data: currentRound } = useQuery({
    queryKey: ["group-session-round", session?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_rounds")
        .select("*")
        .eq("session_id", session!.id)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; round_number: number; place_ids: string[]; status: string } | null;
    },
    enabled: !!session?.id,
    refetchInterval: 3000,
  });

  const { data: roundProgress = [] } = useQuery({
    queryKey: ["group-round-progress", session?.id, currentRound?.round_number],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_members")
        .select("user_id, current_round_done, current_round_vote, swiping_active")
        .eq("session_id", session!.id);
      return data || [];
    },
    enabled: !!session?.id && !!currentRound,
    refetchInterval: 3000,
  });

  // ── Computed ────────────────────────────────────────────────────────────────

  const isMember = members.some((m: any) => m.user_id === user?.id);
  const isCreator = session?.created_by === user?.id;

  const matches: MatchItem[] = useMemo(() => {
    if (!reactions.length || members.length < 2) return [];
    const minMatch = Math.min(2, members.length);
    const byPlace: Record<string, { users: Set<string>; data: any; hasSuperLike: boolean }> = {};
    for (const r of reactions) {
      if (!byPlace[r.place_name]) byPlace[r.place_name] = { users: new Set(), data: r, hasSuperLike: false };
      byPlace[r.place_name].users.add(r.user_id);
      if (r.reaction === "super_liked") byPlace[r.place_name].hasSuperLike = true;
    }
    return Object.entries(byPlace)
      .filter(([_, { users }]) => users.size >= minMatch)
      .map(([place_name, { users, data, hasSuperLike }]) => ({
        place_name, category: data.category, photo_url: data.photo_url,
        liked_by: users.size, hasSuperLike,
      }))
      .sort((a, b) => {
        if (a.hasSuperLike && !b.hasSuperLike) return -1;
        if (!a.hasSuperLike && b.hasSuperLike) return 1;
        return b.liked_by - a.liked_by;
      });
  }, [reactions, members]);

  const memberStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const r of reactions) stats[r.user_id] = (stats[r.user_id] ?? 0) + 1;
    return stats;
  }, [reactions]);

  const selectedMatches = matches.filter(m => !deselectedPlaces.has(m.place_name));

  // ── Round computed ───────────────────────────────────────────────────────────

  const myRoundProgress = roundProgress.find((m: any) => m.user_id === user?.id);
  const mySwipingActive = myRoundProgress?.swiping_active ?? true;
  // True when the user finished swiping this round (local flag OR DB says done)
  const iDoneThisRound = myRoundDone || (myRoundProgress?.current_round_done ?? false);
  const activeSwipers = roundProgress.filter((m: any) => m.swiping_active);
  const doneCount = activeSwipers.filter((m: any) => m.current_round_done).length;
  // Always use DB round for multi-user coordination; mockRoundNumber is only a fallback for solo dev testing
  const effectiveRound = currentRound ?? (MOCK_MODE && mockRoundNumber !== null
    ? { id: "mock", round_number: mockRoundNumber, place_ids: [] as string[], status: mockIsVoting ? "voting" : "active" }
    : null);

  const isVotingPhase = effectiveRound?.status === "voting";
  const myVote = myRoundProgress?.current_round_vote ?? null;

  // ── Match banner detection ──────────────────────────────────────────────────

  useEffect(() => {
    const currentNames = new Set(matches.map(m => m.place_name));

    if (prevMatchNamesRef.current === null) {
      prevMatchNamesRef.current = currentNames;
      return;
    }

    const newMatches = matches.filter(m => !prevMatchNamesRef.current!.has(m.place_name));
    prevMatchNamesRef.current = currentNames;

    if (newMatches.length > 0) {
      const match = newMatches[0];
      // Find who else contributed to this match (not current user)
      const otherReaction = reactions.find(r => r.place_name === match.place_name && r.user_id !== user?.id);
      const otherMember = members.find((m: any) => m.user_id === otherReaction?.user_id);
      const otherName = otherMember?.profile?.first_name || otherMember?.profile?.username || "Znajomy";
      setBannerData({ placeName: match.place_name, otherName });
      const t = setTimeout(() => setBannerData(null), 4000);
      return () => clearTimeout(t);
    }
  }, [matches]);

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  const handleStartRound = async (roundNumber: number) => {
    if (!session) return;
    setStartingRound(true);
    try {
      const { error } = await (supabase as any).rpc("start_group_round", {
        p_session_id: session.id,
        p_round_number: roundNumber,
      });
      if (error) throw error;
      setMyRoundDone(false);
      if (MOCK_MODE) { setMockRoundNumber(roundNumber); setMockIsVoting(false); }
      queryClient.invalidateQueries({ queryKey: ["group-session-round", session.id] });
      queryClient.invalidateQueries({ queryKey: ["group-round-progress", session.id] });
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas startu rundy");
    } finally {
      setStartingRound(false);
    }
  };

  const handleRoundComplete = async () => {
    if (!session) return;
    setMyRoundDone(true);
    if (MOCK_MODE) setMockIsVoting(true);
    if (!currentRound) return;
    try {
      await (supabase as any).rpc("complete_round_for_user", {
        p_session_id: session.id,
        p_round_number: currentRound.round_number,
      });
      queryClient.invalidateQueries({ queryKey: ["group-round-progress", session.id] });
      queryClient.invalidateQueries({ queryKey: ["group-session-round", session.id] });
    } catch (e: any) {
      toast.error(e.message || "Błąd zapisu");
    }
  };

  const handleVote = async (vote: "continue" | "finish" | "opt_out") => {
    if (!session) return;
    setVoting(true);
    try {
      const { error } = await (supabase as any).rpc("vote_on_round", {
        p_session_id: session.id,
        p_vote: vote,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["group-round-progress", session.id] });
      if (vote === "finish" || vote === "opt_out") {
        setTab("matches");
      }
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas głosowania");
    } finally {
      setVoting(false);
    }
  };

  const togglePlace = (placeName: string) => {
    setDeselectedPlaces(prev => {
      const next = new Set(prev);
      if (next.has(placeName)) next.delete(placeName);
      else next.add(placeName);
      return next;
    });
  };

  const handleOpenDetail = async (match: MatchItem) => {
    const { data } = await (supabase as any)
      .from("places")
      .select("*")
      .ilike("city", session!.city)
      .eq("place_name", match.place_name)
      .maybeSingle();
    setDetailPlace(data ?? {
      id: match.place_name,
      place_name: match.place_name,
      category: match.category,
      city: session!.city,
      address: "",
      latitude: 0,
      longitude: 0,
      rating: 0,
      photo_url: match.photo_url || "",
      vibe_tags: [],
      description: "",
    } as MockPlace);
    setDetailOpen(true);
  };

  const handleCreateRoute = async () => {
    if (!user || !session) return;
    if (selectedMatches.length === 0) { toast.error("Zaznacz co najmniej jedno miejsce"); return; }
    setCreatingRoute(true);
    try {
      // Look up coordinates
      const coordsMap: Record<string, any> = {};
      if (MOCK_MODE) {
        for (const p of getMockPlaces(session.city)) coordsMap[p.place_name] = p;
      } else {
        const placeNames = selectedMatches.map(m => m.place_name);
        const { data: dbPlaces } = await (supabase as any)
          .from("places")
          .select("place_name, latitude, longitude, address, description")
          .ilike("city", session.city)
          .in("place_name", placeNames);
        for (const p of (dbPlaces || [])) coordsMap[p.place_name] = p;
      }

      const pins = selectedMatches.map((m, idx) => {
        const db = coordsMap[m.place_name];
        return {
          place_name: m.place_name,
          address: db?.address || "",
          description: db?.description || "",
          suggested_time: "",
          duration_minutes: 60,
          category: m.category,
          latitude: db?.latitude || 0,
          longitude: db?.longitude || 0,
          day_number: 1,
        };
      });

      navigate("/create", {
        state: {
          fromTemplate: true,
          city: session.city,
          date: session.trip_date ?? null,
          initialPlan: { city: session.city, days: [{ day_number: 1, pins }] },
          backTo: `/sesja/${joinCode}`,
          groupSession: {
            sessionId: session.id,
            otherMemberIds: members.filter((m: any) => m.user_id !== user.id).map((m: any) => m.user_id),
          },
        },
      });
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas tworzenia trasy");
    } finally {
      setCreatingRoute(false);
    }
  };

  // ── Loading / error states ──────────────────────────────────────────────────

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
        <button onClick={() => navigate("/")} className="text-sm text-orange-600 font-semibold underline">Wróć do głównej</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center max-w-sm mx-auto">
        <p className="text-4xl">👋</p>
        <p className="font-bold text-lg">Zaloguj się, żeby dołączyć</p>
        <p className="text-sm text-muted-foreground">
          Twój znajomy zaprasza Cię do wspólnego parowania miejsc w <strong>{session.city}</strong>.
        </p>
        <button onClick={() => navigate("/auth")} className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-base">
          Zaloguj się
        </button>
      </div>
    );
  }

  // ── Join screen ─────────────────────────────────────────────────────────────

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
            <p className="text-xl font-black mb-1">Grupowe parowanie</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Swipe'ujcie miejsca w <strong>{session.city}</strong> niezależnie i sprawdźcie, co Was łączy!
            </p>
          </div>
          {members.length > 0 && (
            <div className="w-full rounded-2xl border border-border/40 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-3">W sesji ({members.length}/4)</p>
              <div className="flex flex-col gap-2">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-orange-600/20 flex items-center justify-center text-sm font-bold text-orange-700 shrink-0">
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
            {joining ? "Dołączam…" : members.length >= 4 ? "Sesja pełna (max 4)" : "Dołącz i zacznij swipe'ować"}
          </button>
        </div>
      </div>
    );
  }

  // ── Member view ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate(-1)} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight">{session.city}</p>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "osoba" : "osoby"} · #{joinCode}
            {session.trip_date && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                · <CalendarDays className="h-3 w-3 inline mx-0.5" />
                {format(new Date(session.trip_date), "d MMM", { locale: pl })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m: any) => (
              <div key={m.user_id} className="h-7 w-7 rounded-full bg-orange-600/20 border-2 border-background flex items-center justify-center text-xs font-bold text-orange-700" title={m.profile?.first_name || m.profile?.username}>
                {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/search")}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title="Znajdź znajomego"
          >
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        <button
          onClick={() => setTab("swipe")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "swipe" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          Swipe'uj
        </button>
        <button
          onClick={() => setTab("matches")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          Dopasowania
          {matches.length > 0 && (
            <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center">
              {matches.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* ── Match banner (floats above both tabs) ── */}
        {bannerData && (
          <div className="absolute top-2 left-4 right-4 z-50 bg-foreground text-background rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl animate-in slide-in-from-top-4 fade-in duration-300">
            <span className="text-2xl shrink-0">🎉</span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Nowy match!</p>
              <p className="text-xs opacity-70 truncate">{bannerData.otherName} też polubiła <strong>{bannerData.placeName}</strong></p>
            </div>
          </div>
        )}

        {/* ── Swipe tab — always mounted so PlaceSwiper state survives tab switches ── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", tab !== "swipe" && "hidden")}>
        {(() => {
          // User opted out of swiping
          if (!mySwipingActive && myVote) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center">
                <p className="text-3xl">👀</p>
                <p className="font-bold">Nie swipe'ujesz w tej rundzie</p>
                <p className="text-sm text-muted-foreground">Twoje wcześniejsze lajki nadal liczą się do matchów.</p>
                <button onClick={() => setTab("matches")} className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm">
                  Zobacz dopasowania
                </button>
              </div>
            );
          }

          // ── Decision modal (voting phase) ───────────────────────────────
          if (isVotingPhase && !myVote) {
            const nextRound = (effectiveRound?.round_number ?? 0) + 1;
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
                <div className="text-center">
                  <p className="text-4xl mb-3">🏁</p>
                  <p className="text-xl font-black">Koniec rundy {effectiveRound?.round_number}!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Znaleźliście <strong>{matches.length}</strong> {matches.length === 1 ? "wspólne miejsce" : "wspólnych miejsc"}
                  </p>
                </div>

                <div className="w-full space-y-2.5">
                  {isCreator ? (
                    <>
                      {/* Creator: start next round */}
                      <button
                        onClick={() => handleStartRound(nextRound)}
                        disabled={startingRound}
                        className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        {startingRound ? "Startuję…" : `Runda ${nextRound} — start!`}
                      </button>

                      {/* Creator: finish and go to matches */}
                      <button
                        onClick={() => { handleVote("finish"); setTab("matches"); }}
                        disabled={voting || startingRound}
                        className="w-full py-3.5 rounded-2xl border border-border/60 bg-card font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-40"
                      >
                        {matches.length > 0
                          ? `Przejdź do dopasowań (${matches.length})`
                          : "Zakończ i przejdź do dopasowań"}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Participant: waiting for creator to decide */}
                      <div className="w-full py-5 flex flex-col items-center gap-3 text-center">
                        <div className="flex gap-1.5">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">Czekam na decyzję organizatora…</p>
                        {matches.length > 0 && (
                          <p className="text-xs text-muted-foreground">{matches.length} matchów do tej pory</p>
                        )}
                      </div>

                      {/* Participant: opt out */}
                      <button
                        onClick={() => handleVote("opt_out")}
                        disabled={voting}
                        className="w-full py-3.5 rounded-2xl border border-border/60 bg-card font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-40"
                      >
                        Wychodzę z parowania
                      </button>
                      <p className="text-xs text-muted-foreground text-center -mt-1">
                        zostaję w podróży i widzę dopasowania
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          }

          // ── Voted "continue", waiting for creator to start next round ──
          if (myVote === "continue" && isVotingPhase) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center">
                <p className="text-3xl">👍</p>
                <p className="font-bold text-lg">Gotowe!</p>
                <p className="text-sm text-muted-foreground">Czekam aż host rozpocznie kolejną rundę…</p>
                {matches.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{matches.length} matchów do tej pory</p>
                )}
              </div>
            );
          }

          // ── Waiting for others ──────────────────────────────────────────
          if (iDoneThisRound && !isVotingPhase) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="font-bold text-lg">Czekam na pozostałych…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {doneCount} / {activeSwipers.length} osób skończyło rundę {effectiveRound?.round_number}
                  </p>
                </div>
                <div className="flex gap-2">
                  {activeSwipers.map((m: any) => {
                    const member = members.find((mem: any) => mem.user_id === m.user_id);
                    const done = m.current_round_done;
                    return (
                      <div key={m.user_id} className="flex flex-col items-center gap-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${done ? "bg-orange-600 text-white border-orange-600" : "bg-muted text-muted-foreground border-border/40"}`}>
                          {(member?.profile?.first_name || member?.profile?.username || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{done ? "✓" : "…"}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {matches.length > 0 ? `${matches.length} matchów do tej pory` : "Brak matchów jeszcze"}
                </p>
              </div>
            );
          }

          // ── No round started yet ────────────────────────────────────────
          if (!effectiveRound || effectiveRound.status === "completed") {
            const nextRound = (effectiveRound?.round_number ?? 0) + 1;

            if (!isCreator) {
              // Participant waiting screen
              return (
                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
                    <Users className="h-10 w-10 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xl font-black mb-1">
                      {nextRound === 1 ? "Zaraz zaczniemy!" : `Runda ${nextRound} — chwilka`}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {nextRound === 1
                        ? "Organizator sesji za chwilę rozpocznie parowanie. Przygotuj się!"
                        : `Czekam aż organizator uruchomi kolejną rundę. ${matches.length > 0 ? `${matches.length} matchów do tej pory.` : ""}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Czekam na organizatora…</p>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
                <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
                  <Users className="h-10 w-10 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-black mb-1">
                    {nextRound === 1 ? "Gotowi na start?" : `Runda ${nextRound}`}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {nextRound === 1
                      ? members.length < 2
                        ? "Czekaj aż co najmniej jedna osoba dołączy do sesji."
                        : `${members.length} ${members.length === 1 ? "osoba" : "osoby"} w pokoju. Wszyscy zobaczycie te same 10 miejsc.`
                      : `Kolejna pula 10 nowych miejsc. ${matches.length} matchów do tej pory.`}
                  </p>
                </div>
                {nextRound === 1 && members.length < 2 ? (
                  <div className="w-full py-3 rounded-2xl border border-border/40 bg-muted/50 text-center space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Udostępnij kod sesji</p>
                    <p className="text-2xl font-black tracking-widest">{joinCode}</p>
                    <p className="text-xs text-muted-foreground">Gdy znajomy dołączy, będziesz mógł rozpocząć</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartRound(nextRound)}
                    disabled={startingRound}
                    className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    <Play className="h-5 w-5" />
                    {startingRound ? "Startuję…" : nextRound === 1 ? "Rozpocznij parowanie" : `Runda ${nextRound} — start!`}
                  </button>
                )}
              </div>
            );
          }

          // ── Active round: show swiper ───────────────────────────────────
          return (
            <PlaceSwiper
              city={session.city}
              date={session.trip_date ? new Date(session.trip_date) : new Date()}
              groupSessionId={session.id}
              roundPlaceIds={MOCK_MODE ? undefined : effectiveRound.place_ids}
              onRoundComplete={handleRoundComplete}
              onGroupFinished={() => setTab("matches")}
            />
          );
        })()}
        </div>{/* end always-mounted swipe tab */}

        {/* ── Matches tab ── */}
        {tab === "matches" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">

              {/* Member stats chips */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card px-3 py-2 shrink-0">
                    <div className="h-7 w-7 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
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
                    Potrzeba co najmniej 2 osób, które polubiły to samo miejsce. Wróć do swipe'owania!
                  </p>
                  <button onClick={() => setTab("swipe")} className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm">
                    Swipe'uj dalej
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    {matches.length} {matches.length === 1 ? "miejsce" : "miejsc"}
                    {isCreator ? " · zaznacz miejsca do trasy" : " · lubiane przez co najmniej 2 osoby"}
                  </p>

                  <div className="space-y-2">
                    {matches.map((m) => {
                      const isSelected = !deselectedPlaces.has(m.place_name);
                      return (
                        <button
                          key={m.place_name}
                          onClick={() => handleOpenDetail(m)}
                          className={`w-full flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all active:scale-[0.98] ${
                            isCreator && !isSelected ? "border-border/20 opacity-50" : "border-border/40"
                          }`}
                        >
                          {/* Photo thumbnail */}
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.place_name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <MapPin className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-sm leading-tight">{m.place_name}</p>
                              {/* Super-like star */}
                              {m.hasSuperLike && (
                                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                              )}
                            </div>
                            {m.category && (
                              <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[m.category] ?? m.category}</p>
                            )}
                          </div>

                          {/* Right side: liked count OR creator checkbox */}
                          <div className="shrink-0 flex items-center gap-2">
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-600/10">
                              <span className="text-orange-600 font-bold text-xs">{m.liked_by}</span>
                              <span className="text-[10px]">❤️</span>
                            </div>
                            {isCreator && (
                              <div
                                onClick={(e) => { e.stopPropagation(); togglePlace(m.place_name); }}
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "bg-orange-600 border-orange-600"
                                    : "border-border/60 bg-background"
                                }`}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Route action bar — admin creates, participants propose/wait */}
            {matches.length > 0 && (
              <div className="px-4 py-3 shrink-0 border-t border-border/20">
                {isCreator ? (
                  <button
                    onClick={handleCreateRoute}
                    disabled={creatingRoute || selectedMatches.length === 0}
                    className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-40"
                  >
                    <Route className="h-4 w-4" />
                    {creatingRoute
                      ? "Tworzę trasę…"
                      : `Stwórz trasę · ${selectedMatches.length} ${selectedMatches.length === 1 ? "miejsce" : "miejsc"}`}
                  </button>
                ) : routeProposed ? (
                  <div className="w-full py-3 flex flex-col items-center gap-2 text-center">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">Czekam aż organizator stworzy trasę…</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setRouteProposed(true)}
                    className="w-full py-3.5 rounded-2xl border border-orange-600/40 text-orange-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                  >
                    <Route className="h-4 w-4" />
                    Zaproponuj stworzenie trasy
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Place detail sheet */}
      <PlaceSwiperDetail
        place={detailPlace}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

    </div>
  );
};

export default GroupSession;
