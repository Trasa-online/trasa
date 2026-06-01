import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Copy, Check, ArrowRight, Users, Trash2, LogOut, Search, UserPlus, CalendarDays, Bell, Share2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { isWeb } from "@/lib/platform";
import { usePostHog } from "@posthog/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, startOfToday } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function capitalizeCity(city: string): string {
  return city.charAt(0).toUpperCase() + city.slice(1);
}

const CreateGroupSession = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromJournal = (location.state as { from?: string } | null)?.from === "journal";
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [tripDate, setTripDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [confirmActionId, setConfirmActionId] = useState<string | null>(null);
  const share = useShare();
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);

  const { data: allUserSessions = [] } = useQuery({
    queryKey: ["my-group-sessions", user?.id],
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
        .select("id, city, join_code, created_at, created_by, name, trip_date")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(20);
      return sessions || [];
    },
    enabled: !!user,
  });

  const today = startOfToday();
  const activeSessions = allUserSessions.filter((s: any) =>
    !s.trip_date || parseISO(s.trip_date) >= today
  );
  const historicalSessions = allUserSessions.filter((s: any) =>
    s.trip_date && parseISO(s.trip_date) < today
  );

  // Hardcoded city list - musi byc spojny z CityPicker (solo) i HomeSwipe.
  // Wczesniej cities pobieralo sie z places.city co dawalo niespojny wynik (np.
  // brak Poznania/Wroclawa bo nie ma jeszcze placow). Teraz pelna lista, lockowanie
  // przez UNLOCKED_CITIES.
  const cities = useMemo(() => ["Warszawa", "Kraków", "Łódź", "Poznań", "Trójmiasto", "Wrocław"], []);

  // Cities currently unlocked for group sessions (lowercase match)
  const UNLOCKED_CITIES = ["warszawa"];
  const isCityUnlocked = (city: string) => UNLOCKED_CITIES.includes(city.toLowerCase());

  // Warsaw first, then locked cities alphabetically
  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      const aUnlocked = isCityUnlocked(a);
      const bUnlocked = isCityUnlocked(b);
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [cities]);

  // Default to Warszawa once cities load
  useEffect(() => {
    if (selectedCity || cities.length === 0) return;
    const warsaw = cities.find(c => c.toLowerCase() === "warszawa");
    if (warsaw) setSelectedCity(warsaw);
  }, [cities, selectedCity]);

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-invite", user?.id],
    queryFn: async () => {
      // Fetch business owner IDs to exclude them from invite list
      const { data: bizOwners } = await (supabase as any)
        .from("business_profiles")
        .select("owner_user_id");
      const bizIds: string[] = (bizOwners ?? []).map((b: any) => b.owner_user_id).filter(Boolean);

      let query = (supabase as any)
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .neq("id", user?.id ?? "")
        .not("username", "is", null)
        .order("username")
        .limit(200);

      if (bizIds.length > 0) {
        query = query.not("id", "in", `(${bizIds.join(",")})`);
      }

      const { data } = await query;
      return (data ?? []) as { id: string; username: string; first_name: string | null; avatar_url: string | null }[];
    },
    enabled: !!createdCode && !!user,
  });

  const friendResults = useMemo(() => {
    const q = friendSearch.trim().replace(/^@/, "").toLowerCase();
    if (!q) return [];
    return allProfiles
      .filter(p => p.username?.toLowerCase().includes(q) || p.first_name?.toLowerCase().includes(q))
      .slice(0, 5);
  }, [friendSearch, allProfiles]);

  const handleCreate = async () => {
    if (loading) return; // Prevent double-submit even if button disabled state hasn't flushed
    // Web: grupowe wymaga rejestracji (drives signups + nie zasmieca profiles
    // anon user_xxx rows widocznymi potem w Admin panel).
    // Native: anon OK (drives downloads + low-friction onboarding ze share-link
    // znajomego). Anon ma user.id z auth.users, FK do profiles zalatwia
    // rpc('ensure_current_user_profile') ponizej (tworzy row dla anon tez).
    if (isWeb && (!user || isAnonymous)) {
      openAuthDrawer({ mode: "register", hint: "join_session" });
      return;
    }
    if (!user) { openAuthDrawer({ mode: "register", hint: "join_session" }); return; }
    if (!selectedCity) { toast.error("Wybierz miasto"); return; }
    setLoading(true);
    try {
      // Idempotentne: tworzy profile row dla anon (username 'user_' + uuid prefix)
      // jak i dla non-anon (z metadata). Wymagane bo group_sessions.created_by
      // ma FK -> profiles(id), a handle_new_user trigger pomija anon userow.
      const { error: profileErr } = await (supabase as any).rpc("ensure_current_user_profile");
      if (profileErr) throw profileErr;

      const code = generateJoinCode();
      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .insert({
          city: selectedCity,
          created_by: user.id,
          join_code: code,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          ...(sessionName.trim() ? { name: sessionName.trim() } : {}),
          ...(tripDate ? { trip_date: format(tripDate, "yyyy-MM-dd") } : {}),
        })
        .select()
        .single();
      if (error) throw error;

      // If member insert fails, rollback the orphaned session manually
      // (Supabase JS doesn't give us a transaction; this is the next best thing)
      const { error: memberError } = await (supabase as any)
        .from("group_session_members")
        .insert({ session_id: session.id, user_id: user.id });
      if (memberError) {
        await (supabase as any).from("group_sessions").delete().eq("id", session.id);
        throw memberError;
      }

      posthog.capture("group_session_created", { city: selectedCity, has_date: !!tripDate, has_name: !!sessionName.trim(), entry_point: fromJournal ? "journal" : "default" });
      setCreatedCode(code);
      setCreatedSessionId(session.id);
    } catch (e: any) {
      posthog.captureException(e);
      toast.error(e.message || "Błąd podczas tworzenia sesji");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    // Web: dolaczanie do sesji wymaga rejestracji (parity z handleCreate).
    // Native: anon moze dolaczac do sesji ze share-link.
    if (isWeb && (!user || isAnonymous)) {
      openAuthDrawer({ mode: "register", hint: "join_session" });
      return;
    }
    if (!user) { openAuthDrawer({ mode: "register", hint: "join_session" }); return; }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Wpisz kod sesji"); return; }
    setJoining(true);
    try {
      // Defensywnie: ensure profile row przed insertem do members (FK -> profiles)
      const { error: profileErr } = await (supabase as any).rpc("ensure_current_user_profile");
      if (profileErr) throw profileErr;

      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .select("id, city")
        .eq("join_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!session) { toast.error("Nie znaleziono sesji z tym kodem"); setJoining(false); return; }

      await (supabase as any)
        .from("group_session_members")
        .upsert({ session_id: session.id, user_id: user.id }, { onConflict: "session_id,user_id", ignoreDuplicates: true });

      posthog.capture("group_session_joined", { city: session.city });
      navigate(`/sesja/${code}`);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas dołączania");
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteOrLeaveSession = async (session: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmActionId !== session.id) {
      setConfirmActionId(session.id);
      setTimeout(() => setConfirmActionId(null), 3000);
      return;
    }
    setConfirmActionId(null);
    const isOwner = session.created_by === user?.id;
    try {
      if (isOwner) {
        const { error } = await (supabase as any).from("group_sessions").delete().eq("id", session.id);
        if (error) throw error;
        toast.success("Sesja usunięta");
      } else {
        const { error } = await (supabase as any).from("group_session_members")
          .delete()
          .eq("session_id", session.id)
          .eq("user_id", user!.id);
        if (error) throw error;
        toast.success("Wyszedłeś z sesji");
      }
      queryClient.invalidateQueries({ queryKey: ["my-group-sessions", user?.id] });
    } catch (err: any) {
      toast.error("Nie udało się usunąć sesji. Spróbuj ponownie.");
      console.error("[CreateGroupSession] delete/leave failed:", err);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleStartWithInvites = async () => {
    if (!createdSessionId || !createdCode) return;
    if (selectedFriends.size > 0) {
      setSendingInvites(true);
      const ids = Array.from(selectedFriends);

      // Pobierz imie hosta dla pretty push body (uzywane w title kazdego pusha).
      const { data: { user } } = await supabase.auth.getUser();
      let hostName = "Ktoś";
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("first_name, username")
          .eq("id", user.id)
          .single();
        hostName = (prof as any)?.first_name ?? (prof as any)?.username ?? "Ktoś";
      }

      await Promise.allSettled(
        ids.map(async (id) => {
          // 1) In-app notification w NotificationsDrawer (RPC: insert do notifications)
          await (supabase as any).rpc("send_group_invite", {
            p_target_user_id: id,
            p_session_id: createdSessionId,
          });
          // 2) Push (web+iOS) - best-effort, nie blokuje jesli failuje.
          //    Klient ma push_subscriptions dla iOS native (APNs) i/lub web (VAPID).
          //    Brak push = uzytkownik dostanie tylko in-app po wejsciu w apke.
          try {
            await supabase.functions.invoke("send-push", {
              body: {
                user_id: id,
                title: "Zaproszenie do sesji 🗺️",
                body: `${hostName} zaprasza Cię do wspólnego parowania w ${selectedCity}`,
                url: `/sesja/${createdCode}`,
              },
            });
          } catch {
            // failed push to nie blocker
          }
        })
      );
      setSendingInvites(false);
      posthog.capture("group_invites_sent", { invite_count: ids.length, city: selectedCity });
      toast.success(`Zaproszono ${ids.length} ${ids.length === 1 ? "osobę" : "osoby"} 🔔`);
    }
    navigate(`/sesja/${createdCode}`);
  };

  const shareUrl = createdCode ? `${SHARE_BASE_URL}/#/sesja/${createdCode}` : "";

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-base">{fromJournal ? "Nowa trasa" : "Grupowe parowanie"}</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col px-4 py-6 gap-6">
        {!createdCode ? (
          <>
            {!fromJournal && (
              <>
                {/* Join by code - TOP */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold">Dołącz do sesji</p>
                  <p className="text-xs text-muted-foreground">Masz kod od znajomego? Wpisz go poniżej.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="np. AB3X9K"
                      className="min-w-0 flex-1 h-11 rounded-2xl border border-border/60 bg-background px-3 text-base font-mono font-bold tracking-widest uppercase outline-none focus:border-orange-500 transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground"
                      onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                    />
                    <button
                      onClick={handleJoinByCode}
                      disabled={joining || joinCode.trim().length < 4}
                      className="shrink-0 h-11 px-4 rounded-full bg-primary text-white font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
                    >
                      {joining ? "…" : <><span>Dołącz</span><ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-xs text-muted-foreground">lub stwórz nową</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              </>
            )}

            {/* Trip date */}
            <div>
              <p className="text-sm font-semibold mb-3">Data wyjazdu <span className="font-normal text-muted-foreground">(opcjonalnie)</span></p>
              <button
                onClick={() => setDatePickerOpen(o => !o)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-medium transition-colors w-full ${
                  tripDate ? "border-orange-500 text-orange-600 bg-primary/5" : "border-border/60 bg-card text-muted-foreground"
                }`}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">
                  {tripDate ? format(tripDate, "d MMMM yyyy", { locale: pl }) : "Kiedy planujecie wyjazd?"}
                </span>
                {tripDate && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setTripDate(undefined); }}
                    className="text-xs text-muted-foreground hover:text-foreground px-1"
                  >✕</span>
                )}
              </button>
              {datePickerOpen && (
                <div className="mt-2 rounded-2xl border border-border/40 bg-card overflow-hidden flex justify-center">
                  <Calendar
                    mode="single"
                    selected={tripDate}
                    onSelect={(d) => { setTripDate(d); setDatePickerOpen(false); }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    locale={pl}
                    className="rounded-2xl"
                  />
                </div>
              )}
            </div>

            {/* City picker */}
            <div>
              <p className="text-sm font-semibold mb-3">Wybierz miasto</p>
              <div className="flex flex-wrap gap-2">
                {sortedCities.map((city) => {
                  const unlocked = isCityUnlocked(city);
                  const isSelected = selectedCity === city;
                  return (
                    <button
                      key={city}
                      onClick={() => {
                        if (unlocked) setSelectedCity(city);
                        else toast("To miasto będzie dostępne wkrótce 🔒");
                      }}
                      disabled={!unlocked && !isSelected}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-primary text-white border-orange-600"
                          : unlocked
                          ? "bg-card text-foreground border-border/60"
                          : "bg-muted/40 text-muted-foreground border-border/30"
                      }`}
                    >
                      {!unlocked && <Lock className="h-3 w-3" />}
                      {capitalizeCity(city)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session name */}
            <div>
              <p className="text-sm font-semibold mb-2">Nazwa sesji <span className="text-muted-foreground font-normal">(opcjonalnie)</span></p>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={selectedCity ? `np. Majówka ${capitalizeCity(selectedCity)}` : "np. Majówka Warszawa"}
                maxLength={40}
                className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-600/30"
                style={{ fontSize: "16px" }}
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !selectedCity}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
            >
              {loading ? (fromJournal ? "Tworzę trasę…" : "Tworzę sesję…") : (fromJournal ? "Stwórz trasę" : "Stwórz sesję grupową")}
            </button>

            {/* Active sessions - BOTTOM */}
            {!fromJournal && (activeSessions.length > 0 || historicalSessions.length > 0) && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-xs text-muted-foreground">twoje sesje</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                {activeSessions.map((s: any) => (
                  <div
                    key={s.id}
                    className="w-full flex items-center gap-3 rounded-full border border-border/40 bg-card p-3 active:scale-[0.98] transition-transform"
                  >
                    <button
                      onClick={() => navigate(`/sesja/${s.join_code}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{s.name || capitalizeCity(s.city)}</p>
                        <p className="text-xs text-muted-foreground font-mono">#{s.join_code}{s.name ? ` · ${capitalizeCity(s.city)}` : ""}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteOrLeaveSession(s, e)}
                      className={`h-10 flex items-center justify-center rounded-full active:scale-90 transition-all shrink-0 text-xs font-bold ${confirmActionId === s.id ? "px-2 bg-red-500 text-white min-w-[70px]" : "w-10 bg-red-500/10 text-red-500"}`}
                    >
                      {confirmActionId === s.id ? "Usunąć?" : s.created_by === user?.id
                        ? <Trash2 className="h-4 w-4" />
                        : <LogOut className="h-4 w-4" />
                      }
                    </button>
                  </div>
                ))}
                {historicalSessions.map((s: any) => {
                  const dateLabel = s.trip_date
                    ? format(parseISO(s.trip_date), "d MMM yyyy", { locale: pl })
                    : null;
                  return (
                    <div
                      key={s.id}
                      className="w-full flex items-center gap-3 rounded-2xl border border-border/30 bg-muted/30 p-3 text-left opacity-70"
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{s.name || capitalizeCity(s.city)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {dateLabel && (
                            <span className="text-xs text-muted-foreground">{dateLabel}</span>
                          )}
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                            Zakończona
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center py-2">
              <p className="text-xl font-black mb-1">{fromJournal ? "Zaprosić kogoś?" : "Zaproś znajomych"}</p>
              <p className="text-sm text-muted-foreground">
                {fromJournal ? (
                  <>Możesz dodać znajomych do tej trasy w <strong>{capitalizeCity(selectedCity)}</strong> albo zacznij sam, zaplanujesz wszystko po swojemu.</>
                ) : (
                  <>Wyślij znajomym powiadomienie, żeby dołączyli i razem przeglądali miejsca w <strong>{capitalizeCity(selectedCity)}</strong>.</>
                )}
              </p>
            </div>

            {/* Friend invite - PRIMARY */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-600 shrink-0" />
                <p className="text-sm font-semibold">Wyślij powiadomienie</p>
              </div>
              {/* Hidden fake fields - trick iOS into not showing Face ID */}
              <input type="text" aria-hidden="true" className="hidden" autoComplete="username" tabIndex={-1} readOnly />
              <input type="password" aria-hidden="true" className="hidden" autoComplete="current-password" tabIndex={-1} readOnly />
              <div className="flex items-center gap-2 bg-background border border-border/60 rounded-2xl px-3 h-10">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  inputMode="search"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Szukaj @username..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  style={{ fontSize: "16px" }}
                />
              </div>
              {friendResults.length > 0 && (
                <div className="space-y-1">
                  {friendResults.map(profile => {
                    const initials = (profile.first_name || profile.username || "?")[0].toUpperCase();
                    const isSelected = selectedFriends.has(profile.id);
                    return (
                      <div key={profile.id} className="flex items-center gap-3 rounded-2xl bg-background p-2">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
                            {initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight">{profile.first_name || profile.username}</p>
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        </div>
                        <button
                          onClick={() => toggleFriend(profile.id)}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-all ${
                            isSelected
                              ? "bg-primary text-white"
                              : "border border-border/60 text-foreground"
                          }`}
                        >
                          {isSelected ? <><Check className="h-3 w-3" />Wybrano</> : <><UserPlus className="h-3 w-3" />Zaproś</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {friendSearch.trim().length > 0 && friendResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">Nie znaleziono użytkownika</p>
              )}

              <button
                onClick={async () => {
                  const result = await share({
                    title: "Dołącz do sesji w Trasa",
                    text: createdCode ? `Kod sesji: ${createdCode}` : undefined,
                    url: shareUrl,
                  });
                  if (!result.ok) return;
                  toast.success(result.method === "clipboard" ? "Link skopiowany" : "Udostępniono");
                }}
                className="w-full py-2.5 rounded-full bg-white border border-orange-600 text-orange-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Share2 className="h-4 w-4" />
                Udostępnij link
              </button>
            </div>

            {/* Share code - SECONDARY */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lub udostępnij kod</p>
              <p className="text-3xl font-black tracking-widest text-center py-1">{createdCode}</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdCode!);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                    toast.success("Skopiowano kod!");
                  }}
                  className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {codeCopied ? "Skopiowano!" : "Kopiuj kod"}
                </button>
                <button
                  onClick={async () => {
                    const result = await share({
                      title: "Dołącz do sesji w Trasa",
                      text: createdCode ? `Kod sesji: ${createdCode}` : undefined,
                      url: shareUrl,
                    });
                    if (!result.ok) return;
                    if (result.method === "clipboard") {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                      toast.success("Skopiowano link!");
                    } else {
                      toast.success("Udostępniono");
                    }
                  }}
                  className="flex-1 py-2.5 rounded-full border border-border/60 bg-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {linkCopied ? "Skopiowano!" : "Kopiuj link"}
                </button>
              </div>
            </div>

            <button
              onClick={handleStartWithInvites}
              disabled={sendingInvites}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-60"
            >
              {sendingInvites ? "Wysyłam zaproszenia…" : selectedFriends.size > 0 ? `Zaproś (${selectedFriends.size}) i zacznij parowanie` : "Zacznij parowanie"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateGroupSession;
