import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Star, Check, UserPlus, CalendarDays, Copy, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_CATEGORIES = [
  { id: "breakfast",  label: "Śniadania",  emoji: "🥐" },
  { id: "cafe",       label: "Kawiarnie",  emoji: "☕" },
  { id: "restaurant", label: "Restauracje", emoji: "🍽️" },
  { id: "museum",    label: "Muzea",       emoji: "🏛️" },
  { id: "park",      label: "Parki",       emoji: "🌿" },
  { id: "bar",       label: "Bary",        emoji: "🍺" },
  { id: "monument",  label: "Zabytki",     emoji: "🏰" },
  { id: "experience",label: "Rozrywka",    emoji: "🎪" },
  { id: "market",    label: "Markety",     emoji: "🛒" },
];

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Śniadanie", restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum",
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
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [deselectedPlaces, setDeselectedPlaces] = useState<Set<string>>(new Set());
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const prevMatchNamesRef = useRef<Set<string> | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Category state ───────────────────────────────────────────────────────────
  const [activeCategoryForSwiping, setActiveCategoryForSwiping] = useState<string | null>(null);
  const [settingActiveCategory, setSettingActiveCategory] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["group-session", joinCode],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_sessions")
        .select("*")
        .eq("join_code", joinCode)
        .maybeSingle();
      return data as { id: string; city: string; created_by: string; join_code: string; trip_date: string | null; status: string | null; categories: string[]; current_category_index: number } | null;
    },
    enabled: !!joinCode,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-session-members", session?.id],
    queryFn: async () => {
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("user_id, joined_at, categories_done")
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

  // Switch to matches tab automatically when session is completed.
  // Must be placed AFTER session query to avoid TDZ ReferenceError.
  useEffect(() => {
    if (session?.status === "completed") setTab("matches");
  }, [session?.status]);

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

  // ── Category computed ────────────────────────────────────────────────────────

  const sessionCategories: string[] = (session as any)?.categories ?? [];
  const currentCategoryIndex: number = (session as any)?.current_category_index ?? 0;
  const adminPickedCategory: string | null = sessionCategories[currentCategoryIndex] ?? null;
  const myMemberData = members.find((m: any) => m.user_id === user?.id);
  const myDoneCategories: string[] = myMemberData?.categories_done ?? [];
  const allMyDone = sessionCategories.length > 0 && sessionCategories.every(c => myDoneCategories.includes(c));

  const CATEGORY_EMOJI: Record<string, string> = {
    breakfast: "🥐", cafe: "☕", restaurant: "🍽️", museum: "🏛️", park: "🌿",
    bar: "🍺", monument: "🏰", experience: "🎪", market: "🛒",
  };

  // Fetch 20 random places for the category the user tapped
  const { data: categoryPlaceIds = [] } = useQuery({
    queryKey: ["category-places", session?.city, activeCategoryForSwiping],
    queryFn: async () => {
      if (!activeCategoryForSwiping || !session?.city) return [];
      const { data } = await (supabase as any)
        .from("places")
        .select("id")
        .ilike("city", session.city)
        .eq("category", activeCategoryForSwiping)
        .eq("is_active", true)
        .limit(80);
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 20).map((p: any) => p.id as string);
    },
    enabled: !!activeCategoryForSwiping && !!session?.city,
    staleTime: Infinity,
  });

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

  const handleCategoryComplete = async () => {
    if (!session || !activeCategoryForSwiping) return;
    const updated = [...new Set([...myDoneCategories, activeCategoryForSwiping])];
    await (supabase as any)
      .from("group_session_members")
      .update({ categories_done: updated })
      .eq("session_id", session.id)
      .eq("user_id", user!.id);
    queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
    setActiveCategoryForSwiping(null);
  };

  const handleSaveCategories = async () => {
    if (!session || !isCreator || !pendingCategories.length) return;
    setSavingCategories(true);
    await (supabase as any)
      .from("group_sessions")
      .update({ categories: pendingCategories, current_category_index: 0 })
      .eq("id", session.id);
    queryClient.invalidateQueries({ queryKey: ["group-session", joinCode] });
    setSavingCategories(false);
  };

  const handleSetActiveCategory = async (catId: string) => {
    if (!session || !isCreator) return;
    const idx = sessionCategories.indexOf(catId);
    if (idx === -1) return;
    setSettingActiveCategory(true);
    await (supabase as any)
      .from("group_sessions")
      .update({ current_category_index: idx })
      .eq("id", session.id);
    queryClient.invalidateQueries({ queryKey: ["group-session", joinCode] });
    setSettingActiveCategory(false);
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
            disabled={joining || members.length >= 10}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
          >
            {joining ? "Dołączam…" : members.length >= 10 ? "Sesja pełna (max 10)" : "Dołącz i zacznij swipe'ować"}
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
        <button
          onClick={() => activeCategoryForSwiping ? setActiveCategoryForSwiping(null) : navigate(-1)}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base leading-tight">{session.city}</p>
            {activeCategoryForSwiping && (
              <span className="text-sm font-semibold text-orange-600">
                {CATEGORY_EMOJI[activeCategoryForSwiping] ?? ""} {CATEGORY_LABELS[activeCategoryForSwiping] ?? activeCategoryForSwiping}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "osoba" : "osoby"} · #{joinCode}
            {sessionCategories.length > 0 && (
              <span className="ml-1.5">· {myDoneCategories.length}/{sessionCategories.length} kategorii</span>
            )}
            {session.trip_date && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                · <CalendarDays className="h-3 w-3 inline mx-0.5" />
                {(() => { const d = parseISO(session.trip_date!); return isValid(d) ? format(d, "d MMM", { locale: pl }) : null; })()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m: any) => (
              m.profile?.avatar_url ? (
                <img key={m.user_id} src={m.profile.avatar_url} alt={m.profile?.first_name || m.profile?.username || "?"} className="h-7 w-7 rounded-full border-2 border-background object-cover" title={m.profile?.first_name || m.profile?.username} />
              ) : (
                <div key={m.user_id} className="h-7 w-7 rounded-full bg-orange-600/20 border-2 border-background flex items-center justify-center text-xs font-bold text-orange-700" title={m.profile?.first_name || m.profile?.username}>
                  {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
                </div>
              )
            ))}
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title="Zaproś do sesji"
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
        {/* ── Setup screen: admin picks categories before swiping starts ── */}
        {!sessionCategories.length && (
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6 flex flex-col gap-5">
            {isCreator ? (
              <>
                <div>
                  <p className="font-bold text-base mb-0.5">Wybierz kategorie</p>
                  <p className="text-sm text-muted-foreground">Wszyscy będą swipe'ować miejsca z wybranych kategorii</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CATEGORIES.map((cat) => {
                    const selected = pendingCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setPendingCategories(prev =>
                          selected ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                        )}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                          selected
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-card text-foreground border-border/60"
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                        {selected && (
                          <span className="ml-0.5 text-xs opacity-80">{pendingCategories.indexOf(cat.id) + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {pendingCategories.length > 0 && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Kolejność: {pendingCategories.map(id => AVAILABLE_CATEGORIES.find(c => c.id === id)?.label).join(" → ")}
                  </p>
                )}
                <button
                  onClick={handleSaveCategories}
                  disabled={savingCategories || pendingCategories.length === 0}
                  className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40 mt-auto"
                >
                  {savingCategories ? "Zapisuję…" : "Rozpocznij parowanie"}
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
                <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
                  <Users className="h-10 w-10 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-black mb-1">Zaraz zaczniemy!</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Organizator wybiera kategorie miejsc do parowania. Chwilę cierpliwości!
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!!sessionCategories.length && activeCategoryForSwiping ? (
          // ── Active swiper for chosen category ──────────────────────────
          categoryPlaceIds.length > 0 ? (
            <PlaceSwiper
              city={session.city}
              date={session.trip_date ? new Date(session.trip_date) : new Date()}
              groupSessionId={session.id}
              roundPlaceIds={categoryPlaceIds}
              onRoundComplete={handleCategoryComplete}
              onGroupFinished={() => { handleCategoryComplete(); }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Ładowanie miejsc…</p>
            </div>
          )
        ) : !!sessionCategories.length ? (
          // ── Category list ───────────────────────────────────────────────
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-2">
            {!sessionCategories.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <p className="text-3xl">⚙️</p>
                <p className="font-bold">Brak kategorii</p>
                <p className="text-sm text-muted-foreground">Organizator nie wybrał żadnych kategorii dla tej sesji.</p>
              </div>
            ) : (
              <>
                {allMyDone && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center gap-3 mb-1">
                    <span className="text-xl">🎉</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-700">Wszystkie kategorie przejrzane!</p>
                      <p className="text-xs text-emerald-600/70">Sprawdź dopasowania →</p>
                    </div>
                  </div>
                )}
                {adminPickedCategory && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1">
                    Aktywna kategoria
                  </p>
                )}
                {sessionCategories.map((catId) => {
                  const isDone = myDoneCategories.includes(catId);
                  const isAdminPick = catId === adminPickedCategory;
                  const doneByMembers = members.filter((m: any) =>
                    (m.categories_done ?? []).includes(catId)
                  ).length;

                  return (
                    <button
                      key={catId}
                      onClick={() => !isDone && setActiveCategoryForSwiping(catId)}
                      className={`w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                        isDone
                          ? "border-border/20 bg-muted/40 opacity-60"
                          : isAdminPick
                          ? "border-orange-500/60 bg-orange-500/5"
                          : "border-border/50 bg-card"
                      }`}
                    >
                      <span className="text-2xl shrink-0">{CATEGORY_EMOJI[catId] ?? "📍"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                          {CATEGORY_LABELS[catId] ?? catId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isDone
                            ? "Przejrzane"
                            : doneByMembers > 0
                            ? `${doneByMembers}/${members.length} osób skończyło`
                            : "20 miejsc"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isAdminPick && !isDone && (
                          <span className="text-[10px] font-bold bg-orange-600 text-white px-2 py-0.5 rounded-full">
                            Aktywna
                          </span>
                        )}
                        {isDone ? (
                          <div className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-orange-600/10 flex items-center justify-center">
                            <ArrowLeft className="h-3.5 w-3.5 text-orange-600 rotate-180" />
                          </div>
                        )}
                      </div>
                      {/* Admin: set as active button */}
                      {isCreator && !isDone && !isAdminPick && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetActiveCategory(catId); }}
                          disabled={settingActiveCategory}
                          className="shrink-0 text-[10px] font-semibold text-muted-foreground border border-border/50 px-2 py-1 rounded-full active:scale-95 transition-transform disabled:opacity-40"
                        >
                          Ustaw aktywną
                        </button>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        ) : null}
        </div>{/* end always-mounted swipe tab */}

        {/* ── Matches tab ── */}
        {tab === "matches" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">

              {/* Member stats chips */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card px-3 py-2 shrink-0">
                    {m.profile?.avatar_url ? (
                      <img src={m.profile.avatar_url} alt={m.profile?.first_name || m.profile?.username || "?"} className="h-7 w-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
                        {(m.profile?.first_name || m.profile?.username || "?")[0].toUpperCase()}
                      </div>
                    )}
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
                    {matches.length} {matches.length === 1 ? "wspólne miejsce" : "wspólnych miejsc"} · polubione przez co najmniej 2 osoby
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

            {/* Finish button */}
            <div className="px-4 py-3 shrink-0 border-t border-border/20 space-y-2">
              {matches.length > 0 && (
                <button
                  onClick={async () => {
                    const selectedMatches = matches.filter(m => !deselectedPlaces.has(m.place_name));
                    if (session) {
                      await (supabase as any)
                        .from("group_sessions")
                        .update({ status: "completed", match_count: selectedMatches.length })
                        .eq("id", session.id);
                    }
                    navigate("/create", {
                      state: {
                        city: session?.city ?? "",
                        date: session?.trip_date ?? undefined,
                        likedPlacesData: selectedMatches.map(m => ({
                          place_name: m.place_name,
                          category: m.category,
                          description: "",
                        })),
                        backTo: `/sesja/${session?.join_code}`,
                      },
                    });
                  }}
                  className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  Przejdź do tworzenia trasy →
                </button>
              )}
              <button
                onClick={async () => {
                  const selectedMatches = matches.filter(m => !deselectedPlaces.has(m.place_name));
                  if (session) {
                    await (supabase as any)
                      .from("group_sessions")
                      .update({ status: "completed", match_count: selectedMatches.length })
                      .eq("id", session.id);
                  }
                  navigate("/");
                }}
                className={`w-full py-3 rounded-2xl font-semibold text-sm active:scale-[0.97] transition-transform ${matches.length > 0 ? "border border-border/50 text-muted-foreground bg-card" : "bg-orange-600 text-white"}`}
              >
                Zakończ parowanie
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invite sheet */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle>Zaproś do sesji</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mb-3">Podaj znajomemu kod sesji lub wyślij link:</p>
          <div className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-muted mb-4">
            <span className="text-3xl font-black tracking-widest">{joinCode}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(joinCode ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-border/50 bg-card text-sm font-semibold active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Skopiowano!" : "Kopiuj kod"}
            </button>
            {typeof navigator.share === "function" && (
              <button
                onClick={() => navigator.share({ title: "Dołącz do mojej sesji w TRASA", text: `Dołącz używając kodu: ${joinCode}`, url: `${window.location.origin}/sesja/${joinCode}` })}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-orange-600 text-white text-sm font-semibold active:scale-[0.97] transition-transform"
              >
                <Share2 className="h-4 w-4" />
                Udostępnij
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
