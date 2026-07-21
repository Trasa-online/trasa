import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, MapPin, Star, Check, UserPlus, CalendarDays, Copy, Share2, Search, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, parseISO, isValid, addDays } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";
import { sendGroupInvitePush, getCurrentHostName } from "@/lib/sendGroupInvitePush";
import { getDbCategoriesFor } from "@/lib/categories";

// ─── Constants ────────────────────────────────────────────────────────────────

// dbValues reuzywaja kanonicznego mapowania z categories.ts (getDbCategoriesFor),
// zeby grupowy widzial WSZYSTKIE warianty kategorii w bazie (gallery/church/
// tourist_attraction/walk/club/nightlife/...) - tak jak tryb solo. Wczesniej waska
// lista powodowala, ze wiekszosc kategorii wypadala jako "pusta" i zostawaly ~2.
const expandCats = (...subs: string[]) => [...new Set(subs.flatMap(getDbCategoriesFor))];
const AVAILABLE_CATEGORIES = [
  { id: "Kawiarnia",   label: "Kawiarnia",   emoji: "☕",  dbValues: expandCats("cafe") },
  { id: "Restauracja", label: "Restauracja", emoji: "🍽️", dbValues: expandCats("restaurant") },
  { id: "Bar",         label: "Bar",         emoji: "🍺",  dbValues: expandCats("bar", "club") },
  { id: "Kultura",     label: "Kultura",     emoji: "🏛️", dbValues: expandCats("museum", "monument", "gallery") },
  { id: "Natura",      label: "Natura",      emoji: "🌿",  dbValues: expandCats("park", "viewpoint") },
  { id: "Rozrywka",    label: "Rozrywka",    emoji: "🎪",  dbValues: expandCats("experience") },
  { id: "Zakupy",      label: "Zakupy",      emoji: "🛍️", dbValues: expandCats("shopping", "market") },
];

const CATEGORY_LABELS: Record<string, string> = {
  Kawiarnia: "Kawiarnia", Restauracja: "Restauracja", Bar: "Bar",
  Kultura: "Kultura", Natura: "Natura", Rozrywka: "Rozrywka", Zakupy: "Zakupy",
};

// Wolna eksploracja: runda z 10 LOSOWYCH miejsc (bez filtra kategorii). Sentinel trzymany
// w polu categories sesji jak zwykla kategoria - query wykrywa go i pomija filtr .in(category).
const FREE_CATEGORY = "__wolna__";
const FREE_LABEL = "Wszystko";

// Etykieta kategorii (obsluguje sentinel wolnej eksploracji -> "Wszystko", zamiast raw "__wolna__").
const catLabelOf = (cat: string | null | undefined): string =>
  cat === FREE_CATEGORY ? FREE_LABEL : (CATEGORY_LABELS[cat ?? ""] ?? cat ?? "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchItem {
  place_name: string;
  category: string;
  photo_url: string | null;
  liked_by: number;
  hasSuperLike: boolean;
}

// ─── GroupSession ─────────────────────────────────────────────────────────────

const GroupSession = () => {
  const { joinCode } = useParams<{ joinCode: string }>();
  const navigate = useNavigate();
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const queryClient = useQueryClient();
  const { t } = useTranslation("group");

  const [tab, setTab] = useState<"swipe" | "matches">("swipe");
  const [joining, setJoining] = useState(false);
  // Auto-gosc: zaproszony bez konta dostaje anon sesje zamiast sciany logowania (omija
  // OAuth-w-Messengerze, ktory gubi redirect). Fallback (recznego logowania) gdy padnie.
  const [guestSigningIn, setGuestSigningIn] = useState(false);
  const [guestSignInFailed, setGuestSignInFailed] = useState(false);
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
  const share = useShare();

  // ── Place search in swiper ───────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Suggest place (swiper) ───────────────────────────────────────────────────
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState("");
  const [suggestSending, setSuggestSending] = useState(false);

  // ── Lobby place proposals ────────────────────────────────────────────────────
  const [lobbyQuery, setLobbyQuery] = useState("");
  const [lobbyResults, setLobbyResults] = useState<{id: string; place_name: string; city: string; category: string}[]>([]);
  const [lobbySearching, setLobbySearching] = useState(false);
  const [lobbySuggestOpen, setLobbySuggestOpen] = useState(false);
  const [lobbySuggestUrl, setLobbySuggestUrl] = useState("");
  const [lobbySuggestSending, setLobbySuggestSending] = useState(false);

  // ── Category state ───────────────────────────────────────────────────────────
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  // Local override so server refetch can't reset the UI mid-swipe
  const [localActiveCategory, setLocalActiveCategory] = useState<string | null>(null);

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["group-session", joinCode],
    queryFn: async () => {
      // Odczyt po kodzie idzie przez SECURITY DEFINER RPC (RLS tabeli ograniczony
      // do czlonkow/tworcy; kod = autoryzacja do dolaczenia). Zwraca 0/1 wiersz.
      const { data } = await (supabase as any).rpc("get_group_session_by_code", { p_code: joinCode });
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as { id: string; city: string; created_by: string; join_code: string; trip_date: string | null; num_days: number | null; status: string | null; categories: string[]; current_category_index: number } | null;
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

  // Lobby place proposals (shown before any category starts)
  const { data: lobbyProposals = [], refetch: refetchLobbyProposals } = useQuery({
    queryKey: ["lobby-proposals", session?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_place_proposals")
        .select("id, place_name, proposed_by, city")
        .eq("session_id", session!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!session?.id,
    refetchInterval: 5000,
  });

  // Switch to matches tab automatically when session is completed.
  // Must be placed AFTER session query to avoid TDZ ReferenceError.
  useEffect(() => {
    if (session?.status === "completed") setTab("matches");
  }, [session?.status]);

  // Auto-gosc: gdy zaproszony bez konta otwiera istniejaca sesje (np. z Messengera),
  // tworzymy anon sesje zamiast sciany logowania. handleJoin obsluguje juz anona
  // (ensure_current_user_profile + join). OAuth-w-in-app-browserze gubil redirect powrotu.
  useEffect(() => {
    if (authLoading || sessionLoading) return;
    if (user || !session || guestSigningIn || guestSignInFailed) return;
    let cancelled = false;
    setGuestSigningIn(true);
    (async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        console.error("[group-session] anon sign-in failed:", error.message);
        setGuestSignInFailed(true);
      }
      setGuestSigningIn(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, sessionLoading, user, session, guestSigningIn, guestSignInFailed]);

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
  // localActiveCategory takes precedence - prevents server refetch from resetting UI
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

  // Deterministic seeded shuffle - same session+category = same order for all users
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

  // Counts per category for current city - used to gray out empty categories
  const { data: categoryCounts = {} } = useQuery({
    queryKey: ["category-counts", session?.city],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("category")
        .ilike("city", session!.city)
        .eq("is_active", true);
      // Count per UI category (one UI category can span multiple DB values)
      const rawCounts: Record<string, number> = {};
      for (const row of data ?? []) {
        rawCounts[row.category] = (rawCounts[row.category] ?? 0) + 1;
      }
      const counts: Record<string, number> = {};
      for (const cat of AVAILABLE_CATEGORIES) {
        counts[cat.id] = cat.dbValues.reduce((sum, v) => sum + (rawCounts[v] ?? 0), 0);
      }
      return counts;
    },
    enabled: !!session?.city,
    staleTime: 60_000,
  });

  const dbCategoryValues = AVAILABLE_CATEGORIES.find(c => c.id === currentCategory)?.dbValues ?? [currentCategory];
  const { data: categoryPlaceIds = [], isLoading: placesLoading } = useQuery({
    queryKey: ["category-places", session?.id, currentCategory],
    queryFn: async () => {
      if (!currentCategory || !session?.city || !session?.id) return [];
      const isFree = currentCategory === FREE_CATEGORY;
      let q = (supabase as any)
        .from("places")
        .select("id, business_profiles!left(id)")
        .ilike("city", session.city)
        .eq("is_active", true);
      // Wolna eksploracja: bez filtra kategorii (losowe z calego miasta), wiekszy pool przed shuffle.
      if (!isFree) q = q.in("category", dbCategoryValues);
      const { data, error } = await q
        .order("id", { ascending: true })
        .limit(isFree ? 120 : 40);
      if (error) { console.error("Places query error:", error); return []; }
      if (!data?.length) { console.warn("No places found for", dbCategoryValues, "in", session.city); return []; }
      // Seed = sessionId + category → same result for every user in this session
      const shuffled = seededShuffle(data, session.id + currentCategory);
      // Wizytowki biznesowe zawsze pierwsze, w obrebie grupy zachowujemy seeded order
      // (stabilna partycja, deterministyczna miedzy uczestnikami sesji).
      const hasBiz = (p: any) => {
        const bp = p.business_profiles;
        return Array.isArray(bp) ? bp.length > 0 : !!bp;
      };
      const biz = shuffled.filter(hasBiz);
      const rest = shuffled.filter((p: any) => !hasBiz(p));
      return [...biz, ...rest].slice(0, 10).map((p: any) => p.id as string);
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
      const otherName = otherMember?.profile?.first_name || otherMember?.profile?.username || t("fallback.friend");
      // Toast w jednolitym nowym UI (bialy, ikona w kole, x) zamiast custom czarnego bannera.
      toast.success(t("toast.new_match_title"), { description: t("toast.new_match_desc", { name: otherName, place: match.place_name }) });
    }
  }, [matches]);

  // ── Lobby search ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (lobbyQuery.trim().length < 2) { setLobbyResults([]); setLobbySearching(false); return; }
    setLobbySearching(true);
    const t = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, city, category")
        .ilike("city", session?.city ?? "")
        .ilike("place_name", `%${lobbyQuery.trim()}%`)
        .eq("is_active", true)
        .limit(5);
      setLobbyResults(data ?? []);
      setLobbySearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [lobbyQuery, session?.city]);

  const handleLobbyPropose = async (placeName: string, placeId?: string, city?: string) => {
    if (!session || !user) return;
    await (supabase as any).from("group_session_place_proposals").insert({
      session_id: session.id,
      place_id: placeId ?? null,
      place_name: placeName,
      city: city ?? session.city,
      proposed_by: user.id,
    });
    setLobbyQuery("");
    setLobbyResults([]);
    refetchLobbyProposals();
    toast.success(t("toast.proposal_sent"));
  };

  const handleLobbySuggestNew = async () => {
    if (!lobbyQuery.trim()) return;
    setLobbySuggestSending(true);
    try {
      await (supabase as any).from("place_suggestions").insert({
        place_name: lobbyQuery.trim(),
        city: session?.city ?? null,
        google_maps_url: lobbySuggestUrl.trim() || null,
        suggested_by: user?.id ?? null,
      });
      toast.success(t("toast.suggestion_thanks"));
      setLobbySuggestOpen(false);
      setLobbySuggestUrl("");
      setLobbyQuery("");
    } catch {
      toast.error(t("toast.suggestion_error"));
    } finally {
      setLobbySuggestSending(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!session) return;
    setJoining(true);
    try {
      // Upewnij sie ze profile row istnieje przed insertem czlonka. Anon + swiezy OAuth
      // user nie maja go (handle_new_user pomija anon) -> bez tego join_group_session lamie
      // FK group_session_members.user_id -> profiles(id). Idempotentne.
      const { error: profileErr } = await (supabase as any).rpc("ensure_current_user_profile");
      if (profileErr) throw profileErr;
      const { error } = await supabase.rpc("join_group_session" as any, { p_session_id: session.id });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
      toast.success(t("toast.joined"));
    } catch (e: any) {
      toast.error(e.message || t("toast.join_error"));
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
    setLocalActiveCategory(null); // clear local override - let server state take over

    // Push do innych members o postepie. Best-effort - nie blokuje UI flow.
    void (async () => {
      try {
        const { data: freshMembers } = await (supabase as any)
          .from("group_session_members")
          .select("user_id, categories_done")
          .eq("session_id", session.id);
        if (!freshMembers?.length) return;

        const remainingIds: string[] = freshMembers
          .filter((m: any) => !(m.categories_done ?? []).includes(currentCategory))
          .map((m: any) => m.user_id);

        const { data: prof } = await supabase
          .from("profiles").select("first_name, username")
          .eq("id", user!.id).single();
        const myName = (prof as any)?.first_name ?? (prof as any)?.username ?? "Ktoś";
        const url = `/sesja/${session.join_code}`;

        if (remainingIds.length === 0) {
          // Wszyscy skonczyli te kategorie - push do reszty (nie do mnie)
          const recipients = freshMembers
            .map((m: any) => m.user_id)
            .filter((id: string) => id !== user!.id);
          await Promise.allSettled(recipients.map((id: string) =>
            supabase.functions.invoke("send-push", {
              body: {
                user_id: id,
                title: "Wszyscy gotowi 🎉",
                body: `Możecie ułożyć trasę po ${session.city}`,
                url,
              },
            })
          ));
        } else {
          // Inni czekaja na decyzje - powiedz im ze ja zaglosowalem
          await Promise.allSettled(remainingIds.map((id: string) =>
            supabase.functions.invoke("send-push", {
              body: {
                user_id: id,
                title: `${myName} skończył${myName.endsWith("a") ? "a" : ""}`,
                body: `Czeka tylko Twój głos w "${catLabelOf(currentCategory)}"`,
                url,
              },
            })
          ));
        }
      } catch {
        // Push fail nie blokuje UI - in-app state pokazuje to samo
      }
    })();

    queryClient.invalidateQueries({ queryKey: ["group-session-members", session.id] });
  };

  // Creator skips waiting - marks ALL members as done for current category
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
    // Set local override immediately - UI transitions now, before DB confirms
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
      toast.error(t("toast.save_error", { message: error.message }));
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
      // 1) In-app notyfikacja: RPC send_group_invite. 2) Push: Z KLIENTA (functions.invoke
      // doklada JWT usera). Trigger DB (pg_net, anon key) dostaje z send-push 401, wiec nie
      // dostarcza pusha samodzielnie - dlatego push wolamy tutaj.
      await (supabase as any).rpc("send_group_invite", {
        p_target_user_id: profile.id,
        p_session_id: session.id,
      });
      setWaitingInvitedIds((prev) => new Set(prev).add(profile.id));
      const hostName = await getCurrentHostName();
      void sendGroupInvitePush({ targetUserId: profile.id, hostName, city: session.city, joinCode });
    } catch {
      toast.error(t("toast.invite_error"));
    } finally {
      setWaitingInviting(null);
    }
  };

  const handleSendInvites = async () => {
    if (selectedFriends.size === 0 || !session) return;
    setSendingInvites(true);
    try {
      const friendIds = Array.from(selectedFriends);
      // In-app (RPC) + push Z KLIENTA (send-push wymaga JWT usera; trigger DB z anon key = 401).
      const hostName = await getCurrentHostName();
      await Promise.all(
        friendIds.map(async (friendId) => {
          await (supabase as any).rpc("send_group_invite", { p_target_user_id: friendId, p_session_id: session.id });
          await sendGroupInvitePush({ targetUserId: friendId, hostName, city: session.city, joinCode });
        })
      );
      toast.success(t("toast.invites_sent", { count: selectedFriends.size }));
      setInviteOpen(false);
    } catch {
      toast.error(t("toast.invites_error"));
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
      toast.success(t("toast.suggestion_thanks"));
      setSuggestOpen(false);
      setSuggestUrl("");
    } catch {
      toast.error(t("toast.suggestion_error"));
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
            <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center">
        <p className="text-4xl">🔍</p>
        <p className="font-bold text-lg">{t("not_found.title")}</p>
        <p className="text-sm text-muted-foreground">{t("not_found.desc")}</p>
        <button onClick={() => navigate("/")} className="text-sm text-orange-600 font-semibold underline">{t("not_found.back")}</button>
      </div>
    );
  }

  if (!user) {
    // Fallback: auto-gosc padl (np. blokada storage w in-app browserze) -> reczne logowanie.
    if (guestSignInFailed) {
      return (
        <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center max-w-sm mx-auto">
          <p className="text-4xl">👋</p>
          <p className="font-bold text-lg">{t("login_gate.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("login_gate.desc_before")}<strong>{session.city}</strong>.
          </p>
          <button onClick={() => navigate(`/auth?return=/sesja/${joinCode}`)} className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base">
            {t("login_gate.cta")}
          </button>
        </div>
      );
    }
    // Tworzymy anon sesje (auto-gosc) - krotki stan zamiast promptu logowania.
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 gap-4 bg-background text-center max-w-sm mx-auto">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t("preparing")}</p>
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
          <span className="font-bold text-base">{t("join.header")}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-black mb-1">{t("join.title")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("join.desc_before")}<strong>{session.city}</strong>{t("join.desc_after")}
            </p>
          </div>
          {members.length > 0 && (
            <div className="w-full rounded-2xl border border-border/40 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-3">{t("join.in_session", { count: members.length })}</p>
              <div className="flex flex-col gap-2">
                {members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <img src={avatarSrc(m.profile?.avatar_url)} alt="" className="h-8 w-8 rounded-full object-cover bg-orange-100 shrink-0" />
                    <span className="text-sm font-medium">{m.profile?.first_name || m.profile?.username || t("fallback.user")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleJoin}
            disabled={joining || members.length >= 10}
            className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
          >
            {joining ? t("join.joining") : members.length >= 10 ? t("join.full") : t("join.cta")}
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
          onClick={() => (tab === "matches" ? setTab("swipe") : navigate("/"))}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {/* TopBar: tylko nazwa/miasto + data (zakres gdy num_days > 1). Bez kategorii, liczby osob,
            kodu i rundy - te info sa dostepne gdzie indziej (awatary w rogu, kod w "Zapros"). */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate">{(session as any).name || session.city}</p>
          {session.trip_date && (() => {
            const start = parseISO(session.trip_date!);
            if (!isValid(start)) return null;
            const days = (session as any).num_days ?? 1;
            const end = days > 1 ? addDays(start, days - 1) : null;
            return (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {end
                  ? `${format(start, "d MMM", { locale: dateLocale() })} - ${format(end, "d MMM yyyy", { locale: dateLocale() })}`
                  : format(start, "d MMM yyyy", { locale: dateLocale() })}
              </p>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m: any) => (
              <img key={m.user_id} src={avatarSrc(m.profile?.avatar_url)} alt={m.profile?.first_name || m.profile?.username || "?"} className="h-7 w-7 rounded-full border-2 border-background object-cover bg-orange-100" title={m.profile?.first_name || m.profile?.username} />
            ))}
          </div>
          <button
            onClick={() => { setSearchOpen(o => !o); if (searchOpen) setPlaceSearchQuery(""); else setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title={t("search_place_title")}
          >
            {searchOpen ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
            title={t("invite_title")}
          >
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search bar - expands under header when lupka active */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 h-9">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={placeSearchQuery}
              onChange={e => setPlaceSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              style={{ fontSize: "16px" }}
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
          {t("tab_explore")}
        </button>
        <button
          onClick={() => setTab("matches")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${tab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"}`}
        >
          {t("tab_matches")}
          {matches.length > 0 && (
            <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
              {matches.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* ── Swipe tab ── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", tab !== "swipe" && "hidden")}>
        {(() => {

          // ── Block solo swiping - need at least 2 members ────────────────
          if (members.length < 2) {
            return (
              <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5">
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">⏳</div>
                  <p className="text-lg font-black mb-1">{t("waiting.title")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("waiting.desc")}
                  </p>
                </div>

                {/* Inline friend search */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-orange-600 shrink-0" />
                    <p className="text-sm font-semibold">{t("waiting.invite_friends")}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background border border-border/60 rounded-2xl px-3 h-10">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      inputMode="search"
                      value={waitingSearch}
                      onChange={(e) => setWaitingSearch(e.target.value)}
                      placeholder={t("waiting.search_placeholder")}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  {waitingResults.length > 0 && (
                    <div className="space-y-1">
                      {waitingResults.map((profile) => {
                        const isInvited = waitingInvitedIds.has(profile.id);
                        const isSending = waitingInviting === profile.id;
                        return (
                          <div key={profile.id} className="flex items-center gap-3 rounded-2xl bg-background p-2">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
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
                                isInvited ? "border border-border/60 text-emerald-600" : "bg-primary text-white"
                              )}
                            >
                              {isInvited ? <><Check className="h-3 w-3" />{t("waiting.invited")}</> : isSending ? "…" : <><UserPlus className="h-3 w-3" />{t("waiting.invite")}</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {waitingSearch.trim().length >= 2 && waitingResults.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">{t("waiting.not_found")}</p>
                  )}

                  <button
                    onClick={async () => {
                      const result = await share({
                        title: t("share_sheet.title"),
                        text: t("share_sheet.text", { code: joinCode }),
                        url: `${SHARE_BASE_URL}/#/sesja/${joinCode}`,
                      });
                      if (!result.ok) return;
                      toast.success(result.method === "clipboard" ? t("toast.link_copied") : t("toast.shared"));
                    }}
                    className="w-full py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Share2 className="h-4 w-4" />
                    {t("waiting.share_link")}
                  </button>
                </div>

                {/* Share code */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("waiting.or_share_code")}</p>
                  <p className="text-3xl font-black tracking-widest text-center py-1">{joinCode}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(joinCode ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? t("waiting.copied") : t("waiting.copy_code")}
                    </button>
                    <button
                      onClick={async () => {
                        const result = await share({
                          title: t("share_sheet.title"),
                          text: t("share_sheet.text", { code: joinCode }),
                          url: `${SHARE_BASE_URL}/#/sesja/${joinCode}`,
                        });
                        if (result.ok && result.method === "clipboard") {
                          toast.success(t("toast.link_copied"));
                        }
                      }}
                      className="flex-1 py-2.5 rounded-full border border-border/60 bg-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("waiting.share")}
                    </button>
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
                        <p className="text-sm font-bold text-emerald-700">{t("round_done_title")}</p>
                        <p className="text-xs text-emerald-600/70">{t("round_done_desc")}</p>
                      </div>
                    </div>
                  )}
                  {isFirst && <LobbyProposals lobbyQuery={lobbyQuery} setLobbyQuery={setLobbyQuery} lobbyResults={lobbyResults} lobbySearching={lobbySearching} lobbyProposals={lobbyProposals} members={members} handleLobbyPropose={handleLobbyPropose} onSuggestNew={() => setLobbySuggestOpen(true)} />}
                  <div>
                    <p className="font-bold text-base mb-0.5">
                      {isFirst ? t("pick_first") : t("pick_next")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("pick_desc")}
                    </p>
                  </div>
                  {/* Wolna eksploracja - 10 losowych miejsc. Zablokowana jesli juz uzyta
                      (ponowny wybor uzytej kategorii zakleszcza sesje: wszyscy juz "zrobili"). */}
                  {(() => {
                    const freeUsed = sessionCategories.includes(FREE_CATEGORY);
                    return (
                      <button
                        onClick={() => !freeUsed && setPendingCategory(p => p === FREE_CATEGORY ? null : FREE_CATEGORY)}
                        disabled={freeUsed}
                        className={`w-full px-4 py-3 rounded-2xl text-sm font-semibold border transition-colors flex items-center justify-center gap-2 ${
                          freeUsed
                            ? "bg-card text-muted-foreground/40 border-border/30 cursor-not-allowed"
                            : pendingCategory === FREE_CATEGORY
                              ? "bg-primary text-white border-orange-600"
                              : "bg-card text-foreground border-border/60"
                        }`}
                      >
                        <span>🎲</span>
                        <span>{freeUsed ? t("free_used") : t("free_available")}</span>
                      </button>
                    );
                  })()}
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_CATEGORIES.map((cat) => {
                      const count = categoryCounts[cat.id] ?? 0;
                      const isEmpty = count === 0;
                      // Kategoria juz rozegrana w tej sesji -> zablokuj (ponowny wybor zakleszcza
                      // sesje: currentCategory bylby "zrobiony" przez wszystkich).
                      const used = sessionCategories.includes(cat.id);
                      const disabled = isEmpty || used;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => !disabled && setPendingCategory(p => p === cat.id ? null : cat.id)}
                          disabled={disabled}
                          className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                            disabled
                              ? "bg-card text-muted-foreground/40 border-border/30 cursor-not-allowed"
                              : pendingCategory === cat.id
                                ? "bg-primary text-white border-orange-600"
                                : "bg-card text-foreground border-border/60"
                          }`}
                        >
                          {used && <Check className="h-3.5 w-3.5" />}
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
                      className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
                    >
                      {savingCategory ? t("starting") : isFirst ? t("start_picking") : t("next_round")}
                    </button>
                    {!isFirst && (
                      <button
                        onClick={() => setTab("matches")}
                        className="w-full py-3 rounded-2xl border border-border/50 bg-card font-semibold text-sm"
                      >
                        {t("finish_check_matches", { count: matches.length })}
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Member waiting for admin to pick category
            if (sessionCategories.length === 0) {
              // Lobby - show place proposal section before swiping starts
              return (
                <div className="flex-1 flex flex-col px-4 pt-5 pb-6 gap-5 overflow-y-auto">
                  <LobbyProposals lobbyQuery={lobbyQuery} setLobbyQuery={setLobbyQuery} lobbyResults={lobbyResults} lobbySearching={lobbySearching} lobbyProposals={lobbyProposals} members={members} handleLobbyPropose={handleLobbyPropose} onSuggestNew={() => setLobbySuggestOpen(true)} />
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted/50 mt-auto">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("organizer_picking")}</p>
                  </div>
                </div>
              );
            }
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-10 w-10 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-black mb-1">{t("round_done_title")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("round_done_waiting_desc")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            );
          }

          // ── I finished this category, waiting for others ─────────────────
          if (iMyCategoryDone && !allMembersDoneCategory) {
            const catEmoji = currentCategory === FREE_CATEGORY ? "🎲" : (CATEGORY_EMOJI[currentCategory!] ?? "");
            const catLabel = catLabelOf(currentCategory);
            const doneCount = members.filter((m: any) => (m.categories_done ?? []).includes(currentCategory)).length;
            return (
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
                {/* Category chip */}
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-orange-600/20 text-orange-700 font-semibold text-base">
                  {catEmoji} {catLabel}
                </span>

                <div className="space-y-1">
                  <p className="font-black text-2xl leading-tight">{t("finished.done")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("finished.waiting_others")}
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
                          <img
                            src={avatarSrc(m.profile?.avatar_url)}
                            alt={name}
                            className={`h-14 w-14 rounded-full object-cover bg-orange-100 border-2 transition-all ${done ? "border-orange-600" : "border-border/40 opacity-60"}`}
                          />
                          {done && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-medium max-w-[60px] truncate">{name}</span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">{t("finished.ready_count", { done: doneCount, total: members.length })}</p>

                {isCreator && (
                  <button
                    onClick={handleSkipWaiting}
                    className="py-2.5 px-5 rounded-full border border-border/50 bg-card text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform"
                  >
                    {t("finished.skip_waiting")}
                  </button>
                )}

                {/* Match count - prominent */}
                {matches.length > 0 && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 flex flex-col items-center gap-1">
                    <p className="text-3xl font-black text-emerald-700">{matches.length}</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {matches.length === 1 ? t("shared_spot_one") : matches.length < 5 ? t("shared_spot_few") : t("shared_spot_many")}
                    </p>
                    <p className="text-xs text-emerald-600/70">{t("finished.so_far")}</p>
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
                    <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{t("loading_places")}</p>
              </div>
            );
          }

          // ── No places for this category in this city ─────────────────────
          return (
            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center">
              <p className="text-3xl">😕</p>
              <p className="font-bold">{t("no_places_title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("no_places_desc_before")}<strong>{catLabelOf(currentCategory)}</strong>{t("no_places_desc_after", { city: session.city })}
              </p>
              {isCreator && (
                <button
                  onClick={handleCategoryComplete}
                  className="py-3 px-6 rounded-full bg-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                >
                  {t("next_category")}
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
                  <p className="font-bold">{t("matches.empty_title")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                    {t("matches.empty_desc")}
                  </p>
                  <button onClick={() => setTab("swipe")} className="py-3 px-6 rounded-full bg-primary text-white font-semibold text-sm">
                    {t("matches.explore_more")}
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
                  const catMeta = (dbVal: string) => AVAILABLE_CATEGORIES.find(c => c.dbValues.includes(dbVal));
                  return (
                    <div className="space-y-5">
                      <p className="text-xs text-muted-foreground">
                        {matches.length} {matches.length === 1 ? t("shared_spot_one") : t("shared_spot_many")}
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
                                    className={`w-full flex items-center gap-3 rounded-full border bg-card p-3 text-left transition-all active:scale-[0.98] ${
                                      isCreator && !isSelected ? "border-border/20 opacity-50" : "border-border/40"
                                    }`}
                                  >
                                    {m.photo_url ? (
                                      <img src={m.photo_url} alt={m.place_name} className="h-14 w-14 rounded-2xl object-cover shrink-0" />
                                    ) : (
                                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0">
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
                                          isSelected ? "bg-primary border-orange-600" : "border-border/60 bg-background"
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
              {/* Tworzenie trasy: TYLKO host (created_by). Uczestnicy widza tylko
                  "Otworz zapisana trase" jezeli host juz zapisal, w przeciwnym razie
                  hint ze czekamy na hosta. */}
              {matches.length > 0 && isCreator && (
                <button
                  onClick={async () => {
                    const selectedMatches = matches.filter(m => !deselectedPlaces.has(m.place_name));
                    // Przekazujemy wszystkich CZLONKOW oprocz hosta - RouteSummaryDialog
                    // auto-tworzy kopie trasy dla kazdego (zeby uczestnicy mogli ja
                    // otworzyc po host'owym save).
                    const otherMemberIds = members
                      .filter((m: any) => m.user_id && m.user_id !== user?.id)
                      .map((m: any) => m.user_id);
                    const routeState = {
                      city: session?.city ?? "",
                      date: session?.trip_date ?? undefined,
                      numDays: session?.num_days ?? 1,
                      likedPlacesData: selectedMatches.map(m => ({
                        place_name: m.place_name,
                        category: m.category,
                        description: "",
                      })),
                      backTo: `/sesja/${session?.join_code}`,
                      groupSession: { sessionId: session!.id, otherMemberIds },
                    };
                    // Anon user musi zalozyc konto przed stworzeniem trasy (routes.user_id
                    // FK do auth.users + ownership w UI). Zachowaj routeState w localStorage
                    // zeby po loginie kontynuowac flow.
                    if (!user || isAnonymous) {
                      try { localStorage.setItem("trasa_guest_plan", JSON.stringify(routeState)); } catch { /* unavailable */ }
                      openAuthDrawer({ mode: "register", hint: "save_route" });
                      return;
                    }
                    if (session) {
                      await (supabase as any)
                        .from("group_sessions")
                        .update({ status: "completed", match_count: selectedMatches.length })
                        .eq("id", session.id);
                    }
                    // Tryb uproszczony: grupowa sesja tworzy WYJAZD (routes+pins z dopasowan,
                    // group_session_id + new_for_users) i otwiera edytor - bez planu AI (/create).
                    if (PLANNING_DISABLED) {
                      const pad = (n: number) => String(n).padStart(2, "0");
                      const startISO = session?.trip_date ?? null;
                      let endISO = startISO;
                      if (startISO && (session?.num_days ?? 1) > 1) {
                        const d = new Date(startISO); d.setDate(d.getDate() + ((session!.num_days ?? 1) - 1));
                        endISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                      }
                      const id = await createWyjazdFromPlaces(
                        user.id,
                        session?.city ?? null,
                        session?.city ?? "Wyjazd",
                        selectedMatches.map((m) => ({ place_name: m.place_name, category: m.category, photo_url: m.photo_url })),
                        { start_date: startISO, end_date: endISO },
                        { groupSessionId: session?.id ?? null, newForUsers: otherMemberIds },
                      );
                      if (id) navigate(`/review-summary?route=${id}&edit=1`);
                      return;
                    }
                    navigate("/create", { state: routeState });
                  }}
                  className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  {existingRoute ? t("matches.propose_new_route") : t("matches.propose_route")}
                </button>
              )}
              {/* Hint dla uczestnikow gdy host jeszcze nie zapisal trasy */}
              {matches.length > 0 && !isCreator && !existingRoute && (
                <div className="w-full py-3 rounded-2xl bg-muted/40 border border-border/30 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed px-4">
                    {t("matches.waiting_host")}
                  </p>
                </div>
              )}
              {/* Host: moze otworzyc trase w kreatorze. Uczestnik: trasa zapisala sie u niego
                  jako aktywna - wraca TYLKO na ekran glowny (bez wchodzenia do PlanWizard/kreatora). */}
              {existingRoute && isCreator && (
                <button
                  onClick={() => navigate(PLANNING_DISABLED ? `/review-summary?route=${existingRoute.id}&edit=1` : "/create", PLANNING_DISABLED ? undefined : { state: { city: existingRoute.city, existingRouteId: existingRoute.id } })}
                  className="w-full py-3.5 rounded-full bg-foreground text-background font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  {t("matches.open_saved_route")}
                </button>
              )}
              {existingRoute && !isCreator && (
                <button
                  onClick={() => navigate("/")}
                  className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
                >
                  {t("matches.route_ready")}
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
                  className={`w-full py-3 rounded-full font-semibold text-sm active:scale-[0.97] transition-transform ${matches.length > 0 ? "border border-border/50 text-muted-foreground bg-card" : "bg-primary text-white"}`}
                >
                  {t("matches.finish")}
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
            <SheetTitle>{t("invite_title")}</SheetTitle>
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
              className="px-4 flex items-center justify-center gap-2 rounded-full border border-border/50 bg-card text-sm font-semibold active:scale-[0.97] transition-transform"
            >
              <Copy className="h-4 w-4" />
              {copied ? "✓" : t("invite_sheet.copy")}
            </button>
          </div>

          {/* Friend search */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 shrink-0">{t("invite_sheet.find_friends")}</p>
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder={t("invite_sheet.search_placeholder")}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-muted text-sm placeholder:text-muted-foreground/60 outline-none"
              style={{ fontSize: "16px" }}
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
                          selected ? "bg-primary/10" : "active:bg-muted"
                        )}
                      >
                        <img src={avatarSrc(f.avatar_url)} alt="" className="h-9 w-9 rounded-full object-cover bg-orange-100 shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-semibold leading-tight">{f.first_name || f.username}</p>
                          {f.username && <p className="text-xs text-muted-foreground">@{f.username}</p>}
                        </div>
                        <div className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          selected ? "bg-primary border-orange-600" : "border-border"
                        )}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : friendSearch.trim().length >= 2 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("invite_sheet.no_results", { query: friendSearch })}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">{t("invite_sheet.hint_min_chars")}</p>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSendInvites}
            disabled={selectedFriends.size === 0 || sendingInvites}
            className={cn(
              "mt-4 shrink-0 w-full py-3.5 rounded-2xl font-bold text-base transition-all",
              selectedFriends.size > 0
                ? "bg-primary text-white active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {sendingInvites
              ? t("invite_sheet.sending")
              : selectedFriends.size > 0
                ? t("invite_sheet.send_invites", { count: selectedFriends.size })
                : t("invite_sheet.select_friends")}
          </button>
        </SheetContent>
      </Sheet>

      {/* Suggest place sheet */}
      <Sheet open={suggestOpen} onOpenChange={(o) => { setSuggestOpen(o); if (!o) setSuggestUrl(""); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe-6 pb-8">
          <SheetHeader className="pb-4">
            <SheetTitle>{t("suggest.title")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">{t("suggest.place_name_label")}</p>
              <p className="font-semibold text-sm">{placeSearchQuery.trim()}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t("suggest.google_link_label")} <span className="text-muted-foreground font-normal">{t("suggest.optional")}</span></p>
              <input
                type="url"
                inputMode="url"
                value={suggestUrl}
                onChange={e => setSuggestUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                autoComplete="off"
                className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ fontSize: "16px" }}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("suggest.google_link_hint")}</p>
            </div>
            <button
              onClick={handleSuggestPlace}
              disabled={suggestSending || !placeSearchQuery.trim()}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {suggestSending ? t("suggest.sending") : t("suggest.submit")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lobby suggest-new-place sheet */}
      <Sheet open={lobbySuggestOpen} onOpenChange={(o) => { setLobbySuggestOpen(o); if (!o) setLobbySuggestUrl(""); }}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe-6 px-5 pt-6 space-y-5 [&>button]:hidden">
          <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-1" />
          <SheetHeader className="text-left p-0">
            <SheetTitle>{t("suggest.title")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">{t("suggest.place_name_label")}</p>
              <p className="font-semibold text-sm">{lobbyQuery.trim()}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t("suggest.google_link_label")} <span className="text-muted-foreground font-normal">{t("suggest.optional")}</span></p>
              <input
                type="url"
                inputMode="url"
                value={lobbySuggestUrl}
                onChange={e => setLobbySuggestUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                autoComplete="off"
                className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{ fontSize: "16px" }}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("suggest.google_link_hint")}</p>
            </div>
            <button
              onClick={handleLobbySuggestNew}
              disabled={lobbySuggestSending || !lobbyQuery.trim()}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {lobbySuggestSending ? t("suggest.sending") : t("suggest.submit")}
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

// ─── Lobby proposals component ────────────────────────────────────────────────

interface LobbyProposalsProps {
  lobbyQuery: string;
  setLobbyQuery: (q: string) => void;
  lobbyResults: {id: string; place_name: string; city: string; category: string}[];
  lobbySearching: boolean;
  lobbyProposals: any[];
  members: any[];
  handleLobbyPropose: (name: string, id?: string, city?: string) => void;
  onSuggestNew: () => void;
}

const LobbyProposals = ({
  lobbyQuery, setLobbyQuery, lobbyResults, lobbySearching,
  lobbyProposals, members, handleLobbyPropose, onSuggestNew,
}: LobbyProposalsProps) => {
  const { t } = useTranslation("group");
  return (
  <div className="space-y-4">
    <div>
      <p className="font-bold text-base mb-0.5">{t("lobby.propose_title")}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("lobby.propose_desc")}
      </p>
    </div>

    {/* Search input + dropdown */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
      <input
        value={lobbyQuery}
        onChange={e => setLobbyQuery(e.target.value)}
        placeholder={t("lobby.search_placeholder")}
        className="w-full h-11 pl-9 pr-10 rounded-2xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{ fontSize: "16px" }}
      />
      {lobbySearching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground/60" />
      )}

      {/* Dropdown results */}
      {lobbyQuery.trim().length >= 2 && !lobbySearching && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl border border-border/40 bg-card shadow-lg overflow-hidden">
          {lobbyResults.length > 0 ? (
            lobbyResults.map(place => (
              <button
                key={place.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleLobbyPropose(place.place_name, place.id, place.city)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/20 last:border-0 active:bg-muted/60 transition-colors"
              >
                <MapPin className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{place.place_name}</p>
                  <p className="text-xs text-muted-foreground">{place.city}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("lobby.not_on_trasa")}</p>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={onSuggestNew}
                className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                {t("lobby.suggest_cta")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Proposals feed */}
    {lobbyProposals.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("lobby.group_proposals")}</p>
        {lobbyProposals.map((p: any) => {
          const proposer = members.find((m: any) => m.user_id === p.proposed_by);
          const name = proposer?.profile?.first_name || proposer?.profile?.username || t("fallback.someone");
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/40">
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
                {name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.place_name}</p>
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
              <MapPin className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            </div>
          );
        })}
      </div>
    )}
  </div>
  );
};

export default GroupSession;
