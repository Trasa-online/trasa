import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Star, Check, UserPlus, CalendarDays, Copy, Share2, Search, X } from "lucide-react";
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
  { id: "Kawiarnia",   label: "Kawiarnia",   emoji: "☕",  dbValue: "cafe" },
  { id: "Śniadania",   label: "Śniadania",   emoji: "🍳",  dbValue: "Śniadania" },
  { id: "Restauracja", label: "Restauracja", emoji: "🍽️", dbValue: "restaurant" },
  { id: "Bar",         label: "Bar",         emoji: "🍺",  dbValue: "bar" },
  { id: "Muzeum",      label: "Muzeum",      emoji: "🏛️", dbValue: "museum" },
  { id: "Park",        label: "Park",        emoji: "🌿",  dbValue: "park" },
  { id: "Market",      label: "Market",      emoji: "🛒",  dbValue: "market" },
  { id: "Landmark",    label: "Landmark",    emoji: "🏰",  dbValue: "monument" },
  { id: "Rozrywka",    label: "Rozrywka",    emoji: "🎪",  dbValue: "experience" },
];

const CATEGORY_LABELS: Record<string, string> = {
  Kawiarnia: "Kawiarnia", "Śniadania": "Śniadania",
  Restauracja: "Restauracja", Bar: "Bar", Muzeum: "Muzeum",
  Park: "Park", Market: "Market", Landmark: "Landmark", Rozrywka: "Rozrywka",
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
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<{ id: string; username: string | null; first_name: string | null; avatar_url: string | null }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);
  // Inline search on the waiting screen
  const [waitingSearch, setWaitingSearch] = useState("");
  const [waitingResults, setWaitingResults] = useState<{ id: string; username: string | null; first_name: string | null; avatar_url: string | null }[]>([]);
  const [waitingInvitedIds, setWaitingInvitedIds] = useState<Set<string>>(new Set());
  const [waitingInviting, setWaitingInviting] = useState<string | null>(null);

  // ── Place search in swiper ───────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Suggest place ────────────────────────────────────────────────────────────
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);

  // ── Category state ───────────────────────────────────────────────────────────
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  // Local override so server refetch can't reset the UI mid-swipe
  const [localActiveCategory, setLocalActiveCategory] = useState<string | null>(null);

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
    refetchInterval: 5000,
  });

  // Existing route saved from this session
  const { data: existingRoute } = useQuery({
    queryKey: ["group-session-route", session?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("id, title, city, start_date")
        .eq("group_session_id" as any, session!.id)
        .order("created_at" as any, { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!session?.id,
    refetchInterval: 15000,
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

  // ── Category computed ────────────────────────────────────────────────────────

  const sessionCategories: string[] = (session as any)?.categories ?? [];
  const currentCategoryIndex: number = (session as any)?.current_category_index ?? 0;
  const serverCategory: string | null = sessionCategories[currentCategoryIndex] ?? null;
  // localActiveCategory takes precedence — prevents server refetch from resetting UI
  const currentCategory: string | null = localActiveCategory ?? serverCategory;
  const myMemberData = members.find((m: any) => m.user_id === user?.id);
  const myDoneCategories: string[] = myMemberData?.categories_done ?? [];
  const iMyCategoryDone = currentCategory ? myDoneCategories.includes(currentCategory) : false;
  // All members (min 1) finished current category
  const allMembersDoneCategory = !!currentCategory && !localActiveCategory && members.length >= 1 &&
    members.every((m: any) => (m.categories_done ?? []).includes(currentCategory));
  // Admin needs to pick: either no category set yet, or everyone finished current one
  const needsCategoryPick = !currentCategory || allMembersDoneCategory;

  const CATEGORY_EMOJI: Record<string, string> = {
    Kawiarnia: "☕", "Śniadania": "🍳",
    Restauracja: "🍽️", Bar: "🍺", Muzeum: "🏛️",
    Park: "🌿", Market: "🛒", Landmark: "🏰", Rozrywka: "🎪",
  };

  // Deterministic seeded shuffle — same session+category = same order for all users
  function seededShuffle<T>(arr: T[], seed: string): T[] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Counts per category for current city — used to gray out empty categories
  const { data: categoryCounts = {} } = useQuery({
    queryKey: ["category-counts", session?.city],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("category")
        .ilike("city", session!.city)
        .eq("is_active", true);
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.category] = (counts[row.category] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!session?.city,
    staleTime: 60_000,
  });

  const dbCategoryValue = AVAILABLE_CATEGORIES.find(c => c.id === currentCategory)?.dbValue ?? currentCategory;
  const { data: categoryPlaceIds = [], isLoading: placesLoading } = useQuery({
    queryKey: ["category-places", session?.id, currentCategory],
    queryFn: async () => {
      if (!currentCategory || !session?.city || !session?.id) return [];
      const { data, error } = await (supabase as any)
        .from("places")
        .select("id")
        .ilike("city", session.city)
        .eq("category", dbCategoryValue)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .limit(40);
      if (error) { console.error("Places query error:", error); return []; }
      if (!data?.length) { console.warn("No places found for", dbCategoryValue, "in", session.city); return []; }
      // Seed = sessionId + category → same result for every user in this session
      const shuffled = seededShuffle(data, session.id + currentCategory);
      return shuffled.slice(0, 10).map((p: any) => p.id as string);
    },
    enabled: !!currentCategory && !!session?.id && !!session?.city && !iMyCategoryDone,
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
        .upsert({ session_id: session.id, user_id: user.id }, { onConflict: "session_id,user_id", ignoreDuplicates: true });
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
    if (!session || !currentCategory) return;
    const updated = [...new Set([...myDoneCategories, currentCategory])];
    await (supabase as any)
      .from("group_session_members")
      .update({ categories_done: updated })
      .eq("session_id", session.id)
      .eq("user_id", user!.id);
    setLocalActiveCategory(null); // clear local override — let server state take over
    queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
  };

  // Creator skips waiting — marks ALL members as done for current category
  const handleSkipWaiting = async () => {
    if (!session || !currentCategory) return;
    await Promise.all(
      members
        .filter((m: any) => !(m.categories_done ?? []).includes(currentCategory))
        .map((m: any) => {
          const updated = [...new Set([...(m.categories_done ?? []), currentCategory])];
          return (supabase as any)
            .from("group_session_members")
            .update({ categories_done: updated })
            .eq("session_id", session.id)
            .eq("user_id", m.user_id);
        })
    );
    queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
  };

  // Admin picks next category (or first one)
  const handleStartCategory = async () => {
    if (!session || !isCreator || !pendingCategory) return;
    setSavingCategory(true);
    // Set local override immediately — UI transitions now, before DB confirms
    setLocalActiveCategory(pendingCategory);
    setPendingCategory(null);
    setSavingCategory(false);
    // Fire DB update in background
    const newCategories = [...sessionCategories, pendingCategory];
    const newIndex = newCategories.length - 1;
    const { error } = await (supabase as any)
      .from("group_sessions")
      .update({ categories: newCategories, current_category_index: newIndex })
      .eq("id", session.id);
    if (error) {
      toast.error("Błąd zapisu: " + error.message);
      // Revert local override on failure
      setLocalActiveCategory(null);
      return;
    }
    queryClient.setQueryData(["group-session", joinCode], (old: any) => ({
      ...old,
      categories: newCategories,
      current_category_index: newIndex,
    }));
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


  // ── Friend search ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!inviteOpen) {
      setFriendSearch("");
      setFriendResults([]);
      setSelectedFriends(new Set());
      return;
    }
  }, [inviteOpen]);

  useEffect(() => {
    const q = friendSearch.trim();
    if (q.length < 2) { setFriendResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .or(`username.ilike.%${q}%,first_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(10);
      setFriendResults(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [friendSearch, user?.id]);

  useEffect(() => {
    const q = waitingSearch.trim();
    if (q.length < 2) { setWaitingResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .or(`username.ilike.%${q}%,first_name.ilike.%${q}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      setWaitingResults(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [waitingSearch, user?.id]);

  const handleWaitingInvite = async (profile: { id: string; username: string | null; first_name: string | null }) => {
    if (!session) return;
    setWaitingInviting(profile.id);
    try {
      await (supabase as any).from("notifications").insert({
        user_id: profile.id,
        type: "group_session_invite",
        data: { session_id: session.id, join_code: joinCode, city: session.city },
        message: `Zaproszenie do sesji parowania w ${session.city}`,
      });
      setWaitingInvitedIds((prev) => new Set(prev).add(profile.id));
    } catch {
      toast.error("Nie udało się wysłać zaproszenia");
    } finally {
      setWaitingInviting(null);
    }
  };

  const handleSendInvites = async () => {
    if (selectedFriends.size === 0 || !session) return;
    setSendingInvites(true);
    try {
      await Promise.all(
        Array.from(selectedFriends).map((friendId) =>
          (supabase as any).from("notifications").insert({
            user_id: friendId,
            type: "group_session_invite",
            data: { session_id: session.id, join_code: joinCode, city: session.city },
            message: `Zaproszenie do sesji parowania w ${session.city}`,
          })
        )
      );
      toast.success(`Zaproszenia wysłane (${selectedFriends.size})`);
      setInviteOpen(false);
    } catch {
      toast.error("Nie udało się wysłać zaproszeń");
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSuggestPlace = async () => {
    if (!placeSearchQuery.trim()) return;
    setSuggestSending(true);
    try {
      await (supabase as any).from("place_suggestions").insert({
        place_name: placeSearchQuery.trim(),
        city: session?.city ?? null,
        google_maps_url: suggestUrl.trim() || null,
        suggested_by: user?.id ?? null,
      });
      toast.success("Dziękujemy! Dodamy to miejsce wkrótce 🙌");
      setSuggestOpen(false);
      setSuggestUrl("");
    } catch {
      toast.error("Nie udało się wysłać sugestii");
    } finally {
      setSuggestSending(false);
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
          <button onClick={() => navigate("/")} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0">
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
              Eksplorujcie miejsca w <strong>{session.city}</strong> niezależnie i sprawdźcie, co Was łączy!
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
          onClick={() => navigate("/")}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base leading-tight">{(session as any).name || session.city}</p>
            {currentCategory && !needsCategoryPick && (
              <span className="text-sm font-semibold text-orange-600">
                {CATEGORY_EMOJI[currentCategory] ?? ""} {CATEGORY_LABELS[currentCategory] ?? currentCategory}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "osoba" : "osoby"} · #{joinCode}
            {sessionCategories.length > 0 && (
              <span className="ml-1.5">· runda {currentCategoryIndex + 1}</span>
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
            onClick={() => { setSearchOpen(o => !o); if (searchOpen) setPlaceSearchQuery(""); else setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title="Szukaj miejsca"
          >
            {searchOpen ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title="Zaproś do sesji"
          >
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search bar — expands under header when lupka active */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 h-9">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={placeSearchQuery}
              onChange={e => setPlaceSearchQuery(e.target.value)}
              placeholder="Szukaj miejsca…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {placeSearchQuery && (
              <button onClick={() => setPlaceSearchQuery("")} className="shrink-0">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/20 shrink-0">
        <button
          onClick={() => setTab("swipe")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "swipe" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          Eksploruj
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

        {/* ── Swipe tab ── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", tab !== "swipe" && "hidden")}>
        {(() => {

          // ── Block solo swiping — need at least 2 members ────────────────
          if (members.length < 2) {
            return (
              <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-orange-600/10 flex items-center justify-center text-3xl mb-3">⏳</div>
                  <p className="text-lg font-black mb-1">Czekamy na kogoś jeszcze</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Parowanie zacznie się gdy co najmniej jedna osoba dołączy do sesji.
                  </p>
                </div>

                {/* Inline friend search */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-orange-600 shrink-0" />
                    <p className="text-sm font-semibold">Zaproś znajomych</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background border border-border/60 rounded-xl px-3 h-10">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      inputMode="search"
                      value={waitingSearch}
                      onChange={(e) => setWaitingSearch(e.target.value)}
                      placeholder="Szukaj po imieniu lub @nickname…"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {waitingResults.length > 0 && (
                    <div className="space-y-1">
                      {waitingResults.map((profile) => {
                        const isInvited = waitingInvitedIds.has(profile.id);
                        const isSending = waitingInviting === profile.id;
                        return (
                          <div key={profile.id} className="flex items-center gap-3 rounded-xl bg-background p-2">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
                                {(profile.first_name || profile.username || "?")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight">{profile.first_name || profile.username}</p>
                              {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                            </div>
                            <button
                              disabled={isInvited || isSending}
                              onClick={() => handleWaitingInvite(profile)}
                              className={cn(
                                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform disabled:opacity-60 disabled:scale-100",
                                isInvited ? "border border-border/60 text-emerald-600" : "bg-orange-600 text-white"
                              )}
                            >
                              {isInvited ? <><Check className="h-3 w-3" />Zaproszono</> : isSending ? "…" : <><UserPlus className="h-3 w-3" />Zaproś</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {waitingSearch.trim().length >= 2 && waitingResults.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">Nie znaleziono użytkownika</p>
                  )}
                </div>

                {/* Share code */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lub udostępnij kod</p>
                  <p className="text-3xl font-black tracking-widest text-center py-1">{joinCode}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(joinCode ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Skopiowano!" : "Kopiuj kod"}
                    </button>
                    {typeof navigator.share === "function" && (
                      <button
                        onClick={() => navigator.share({ title: "Dołącz do mojej sesji w TRASA", text: `Dołącz używając kodu: ${joinCode}`, url: `${window.location.origin}/sesja/${joinCode}` })}
                        className="flex-1 py-2.5 rounded-xl border border-border/60 bg-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                      >
                        <Share2 className="h-4 w-4" />
                        Udostępnij
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ── Admin/member picking next category ──────────────────────────
          if (needsCategoryPick) {
            if (isCreator) {
              const isFirst = sessionCategories.length === 0;
              return (
                <div className="flex-1 flex flex-col px-4 pt-5 pb-6 gap-5 overflow-y-auto">
                  {!isFirst && (
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center gap-3">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">Runda zakończona!</p>
                        <p className="text-xs text-emerald-600/70">Wybierz kolejną kategorię lub zakończ parowanie.</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base mb-0.5">
                      {isFirst ? "Wybierz pierwszą kategorię" : "Wybierz następną kategorię"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Wszyscy będą swipe'ować 10 miejsc z wybranej kategorii
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_CATEGORIES.map((cat) => {
                      const count = categoryCounts[cat.dbValue] ?? 0;
                      const isEmpty = count === 0;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => !isEmpty && setPendingCategory(p => p === cat.id ? null : cat.id)}
                          disabled={isEmpty}
                          className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                            isEmpty
                              ? "bg-card text-muted-foreground/40 border-border/30 cursor-not-allowed"
                              : pendingCategory === cat.id
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-card text-foreground border-border/60"
                          }`}
                        >
                          <span>{cat.emoji}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2 mt-auto">
                    <button
                      onClick={handleStartCategory}
                      disabled={savingCategory || !pendingCategory}
                      className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
                    >
                      {savingCategory ? "Startuję…" : isFirst ? "Rozpocznij parowanie" : "Następna runda →"}
                    </button>
                    {!isFirst && (
                      <button
                        onClick={() => setTab("matches")}
                        className="w-full py-3 rounded-2xl border border-border/50 bg-card font-semibold text-sm"
                      >
                        Zakończ i sprawdź dopasowania ({matches.length})
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Member waiting for admin to pick category
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 text-center">
                <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
                  <Users className="h-10 w-10 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-black mb-1">
                    {sessionCategories.length === 0 ? "Zaraz zaczniemy!" : "Runda zakończona!"}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {sessionCategories.length === 0
                      ? "Organizator wybiera pierwszą kategorię miejsc."
                      : "Czekam aż organizator wybierze kolejną kategorię."}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            );
          }

          // ── I finished this category, waiting for others ─────────────────
          if (iMyCategoryDone && !allMembersDoneCategory) {
            const catEmoji = CATEGORY_EMOJI[currentCategory!] ?? "";
            const catLabel = CATEGORY_LABELS[currentCategory!] ?? currentCategory;
            const doneCount = members.filter((m: any) => (m.categories_done ?? []).includes(currentCategory)).length;
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
                {/* Category chip */}
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600/10 border border-orange-600/20 text-orange-700 font-semibold text-base">
                  {catEmoji} {catLabel}
                </span>

                <div className="space-y-1">
                  <p className="font-black text-2xl leading-tight">Gotowe!</p>
                  <p className="text-sm text-muted-foreground">
                    Czekam aż wszyscy skończą tę kategorię
                  </p>
                </div>

                {/* Member avatars with done state */}
                <div className="flex gap-4 justify-center flex-wrap">
                  {members.map((m: any) => {
                    const done = (m.categories_done ?? []).includes(currentCategory);
                    const name = m.profile?.first_name || m.profile?.username || "?";
                    return (
                      <div key={m.user_id} className="flex flex-col items-center gap-2">
                        <div className="relative">
                          {m.profile?.avatar_url ? (
                            <img
                              src={m.profile.avatar_url}
                              alt={name}
                              className={`h-14 w-14 rounded-full object-cover border-2 transition-all ${done ? "border-orange-600" : "border-border/40 opacity-60"}`}
                            />
                          ) : (
                            <div className={`h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all ${done ? "bg-orange-600 text-white border-orange-600" : "bg-muted text-muted-foreground border-border/40 opacity-60"}`}>
                              {name[0].toUpperCase()}
                            </div>
                          )}
                          {done && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-orange-600 border-2 border-background flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium max-w-[60px] truncate">{name}</span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">{doneCount} / {members.length} gotowych</p>

                {isCreator && (
                  <button
                    onClick={handleSkipWaiting}
                    className="py-2.5 px-5 rounded-2xl border border-border/50 bg-card text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
                  >
                    Pomiń oczekiwanie →
                  </button>
                )}

                {/* Match count — prominent */}
                {matches.length > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 flex flex-col items-center gap-1">
                    <p className="text-3xl font-black text-emerald-700">{matches.length}</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {matches.length === 1 ? "wspólne miejsce" : matches.length < 5 ? "wspólne miejsca" : "wspólnych miejsc"}
                    </p>
                    <p className="text-xs text-emerald-600/70">do tej pory</p>
                  </div>
                )}
              </div>
            );
          }

          // ── Active swiper ────────────────────────────────────────────────
          if (!iMyCategoryDone && categoryPlaceIds.length > 0) {
            return (
              <PlaceSwiper
                city={session.city}
                date={session.trip_date ? new Date(session.trip_date) : new Date()}
                groupSessionId={session.id}
                roundPlaceIds={categoryPlaceIds}
                onRoundComplete={handleCategoryComplete}
                onGroupFinished={handleCategoryComplete}
                searchQuery={placeSearchQuery}
                onSuggestPlace={() => setSuggestOpen(true)}
              />
            );
          }

          // ── Still fetching ───────────────────────────────────────────────
          if (placesLoading) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-2 w-2 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Ładowanie miejsc…</p>
              </div>
            );
          }

          // ── No places for this category in this city ─────────────────────
          return (
            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center">
              <p className="text-3xl">😕</p>
              <p className="font-bold">Brak miejsc w tej kategorii</p>
              <p className="text-sm text-muted-foreground">
                Nie mamy jeszcze miejsc z kategorii{" "}
                <strong>{CATEGORY_LABELS[currentCategory!] ?? currentCategory}</strong> dla {session.city}.
              </p>
              {isCreator && (
                <button
                  onClick={handleCategoryComplete}
                  className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                >
                  Przejdź do następnej kategorii
                </button>
              )}
            </div>
          );
        })()}
        </div>{/* end swipe tab */}

        {/* ── Matches tab ── */}
        {tab === "matches" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">

              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <p className="text-4xl">🤔</p>
                  <p className="font-bold">Brak dopasowań jeszcze</p>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                    Potrzeba co najmniej 2 osób, które polubiły to samo miejsce. Wróć do eksplorowania!
                  </p>
                  <button onClick={() => setTab("swipe")} className="py-3 px-6 rounded-2xl bg-orange-600 text-white font-semibold text-sm">
                    Eksploruj dalej
                  </button>
                </div>
              ) : (() => {
                  // Group matches by category
                  const grouped = matches.reduce<Record<string, MatchItem[]>>((acc, m) => {
                    const key = m.category || "inne";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(m);
                    return acc;
                  }, {});
                  const catMeta = (dbVal: string) => AVAILABLE_CATEGORIES.find(c => c.dbValue === dbVal);
                  return (
                    <div className="space-y-5">
                      <p className="text-xs text-muted-foreground">
                        {matches.length} {matches.length === 1 ? "wspólne miejsce" : "wspólnych miejsc"}
                      </p>
                      {Object.entries(grouped).map(([cat, items]) => {
                        const meta = catMeta(cat);
                        return (
                          <div key={cat}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              {meta ? `${meta.emoji} ${meta.label}` : cat}
                            </p>
                            <div className="space-y-2">
                              {items.map((m) => {
                                const isSelected = !deselectedPlaces.has(m.place_name);
                                return (
                                  <button
                                    key={m.place_name}
                                    onClick={() => handleOpenDetail(m)}
                                    className={`w-full flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all active:scale-[0.98] ${
                                      isCreator && !isSelected ? "border-border/20 opacity-50" : "border-border/40"
                                    }`}
                                  >
                                    {m.photo_url ? (
                                      <img src={m.photo_url} alt={m.place_name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                                    ) : (
                                      <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                        <MapPin className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-sm leading-tight">{m.place_name}</p>
                                        {m.hasSuperLike && (
                                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                                        )}
                                      </div>
                                    </div>
                                    {isCreator && (
                                      <div
                                        onClick={(e) => { e.stopPropagation(); togglePlace(m.place_name); }}
                                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                          isSelected ? "bg-orange-600 border-orange-600" : "border-border/60 bg-background"
                                        }`}
                                      >
                                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
              })()}
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
                        groupSession: { sessionId: session!.id, otherMemberIds: [] },
                      },
                    });
                  }}
                  className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  {existingRoute ? "Stwórz nową trasę →" : "Przejdź do tworzenia trasy →"}
                </button>
              )}
              {existingRoute && (
                <button
                  onClick={() => navigate("/create", { state: { city: existingRoute.city, existingRouteId: existingRoute.id } })}
                  className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  Otwórz zapisaną trasę →
                </button>
              )}
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
                    navigate("/");
                  }}
                  className={`w-full py-3 rounded-2xl font-semibold text-sm active:scale-[0.97] transition-transform ${matches.length > 0 ? "border border-border/50 text-muted-foreground bg-card" : "bg-orange-600 text-white"}`}
                >
                  Zakończ parowanie
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite sheet */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[85vh] flex flex-col">
          <SheetHeader className="pb-3 shrink-0">
            <SheetTitle>Zaproś do sesji</SheetTitle>
          </SheetHeader>

          {/* Code copy row */}
          <div className="flex gap-2 mb-4 shrink-0">
            <div className="flex-1 flex items-center justify-center gap-3 py-3 rounded-2xl bg-muted">
              <span className="text-2xl font-black tracking-widest">{joinCode}</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(joinCode ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-4 flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card text-sm font-semibold active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              {copied ? "✓" : "Kopiuj"}
            </button>
          </div>

          {/* Friend search */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 shrink-0">Znajdź znajomych</p>
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder="Szukaj po nazwie lub @nickname…"
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-muted text-sm placeholder:text-muted-foreground/60 outline-none"
            />
            {friendSearch && (
              <button onClick={() => setFriendSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {friendResults.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {friendResults.map((f) => {
                  const selected = selectedFriends.has(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => {
                          setSelectedFriends((prev) => {
                            const next = new Set(prev);
                            selected ? next.delete(f.id) : next.add(f.id);
                            return next;
                          });
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors",
                          selected ? "bg-orange-600/10" : "active:bg-muted"
                        )}
                      >
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-orange-600/20 flex items-center justify-center text-sm font-bold text-orange-700 shrink-0">
                            {(f.first_name || f.username || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-semibold leading-tight">{f.first_name || f.username}</p>
                          {f.username && <p className="text-xs text-muted-foreground">@{f.username}</p>}
                        </div>
                        <div className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          selected ? "bg-orange-600 border-orange-600" : "border-border"
                        )}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : friendSearch.trim().length >= 2 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Brak wyników dla „{friendSearch}"</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Wpisz co najmniej 2 znaki, żeby wyszukać</p>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSendInvites}
            disabled={selectedFriends.size === 0 || sendingInvites}
            className={cn(
              "mt-4 shrink-0 w-full py-3.5 rounded-2xl font-bold text-base transition-all",
              selectedFriends.size > 0
                ? "bg-orange-600 text-white active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {sendingInvites
              ? "Wysyłanie…"
              : selectedFriends.size > 0
                ? `Wyślij zaproszenia (${selectedFriends.size})`
                : "Wybierz znajomych"}
          </button>
        </SheetContent>
      </Sheet>

      {/* Suggest place sheet */}
      <Sheet open={suggestOpen} onOpenChange={(o) => { setSuggestOpen(o); if (!o) setSuggestUrl(""); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe-6 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle>Zaproponuj dodanie miejsca</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">Nazwa miejsca</p>
              <p className="font-semibold text-sm">{placeSearchQuery.trim()}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Link do wizytówki Google <span className="text-muted-foreground font-normal">(opcjonalnie)</span></p>
              <input
                type="url"
                inputMode="url"
                value={suggestUrl}
                onChange={e => setSuggestUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                autoComplete="off"
                className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-600/30"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Wklej link z Google Maps — pomoże nam szybciej dodać miejsce</p>
            </div>
            <button
              onClick={handleSuggestPlace}
              disabled={suggestSending || !placeSearchQuery.trim()}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {suggestSending ? "Wysyłam…" : "Wyślij sugestię"}
            </button>
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
