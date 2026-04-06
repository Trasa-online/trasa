import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, ArrowRight, Users, Trash2, Search, UserPlus, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Normalize city name capitalization from DB
function capitalizeCity(city: string): string {
  return city.charAt(0).toUpperCase() + city.slice(1);
}

const CreateGroupSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState("");
  const [tripDate, setTripDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);

  // Active sessions the user is already a member of
  const { data: activeSessions = [] } = useQuery({
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
        .select("id, city, join_code, created_at")
        .in("id", sessionIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      return sessions || [];
    },
    enabled: !!user,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["places-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("city")
        .eq("is_active", true);
      const unique = [...new Set((data || []).map((p: any) => p.city as string))].sort();
      return unique as string[];
    },
  });

  // Load all profiles for friend search (only when session is created)
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-invite", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .neq("id", user?.id ?? "")
        .not("username", "is", null)
        .order("username")
        .limit(200);
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
    if (!user) { navigate("/auth"); return; }
    if (!selectedCity) { toast.error("Wybierz miasto"); return; }
    setLoading(true);
    try {
      const code = generateJoinCode();
      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .insert({
          city: selectedCity,
          created_by: user.id,
          join_code: code,
          ...(tripDate ? { trip_date: format(tripDate, "yyyy-MM-dd") } : {}),
        })
        .select()
        .single();
      if (error) throw error;

      await (supabase as any)
        .from("group_session_members")
        .insert({ session_id: session.id, user_id: user.id });

      setCreatedCode(code);
      setCreatedSessionId(session.id);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas tworzenia sesji");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!user) { navigate("/auth"); return; }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Wpisz kod sesji"); return; }
    setJoining(true);
    try {
      // Check session exists
      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .select("id, city")
        .eq("join_code", code)
        .maybeSingle();
      if (error) throw error;
      if (!session) { toast.error("Nie znaleziono sesji z tym kodem"); setJoining(false); return; }

      // Join (ignore duplicate error — user may already be a member)
      await (supabase as any)
        .from("group_session_members")
        .upsert({ session_id: session.id, user_id: user.id }, { onConflict: "session_id,user_id", ignoreDuplicates: true });

      navigate(`/sesja/${code}`);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas dołączania");
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Usunąć tę sesję? Wszyscy członkowie stracą dostęp.")) return;
    await (supabase as any).from("group_sessions").delete().eq("id", sessionId);
    queryClient.invalidateQueries({ queryKey: ["my-group-sessions", user?.id] });
    toast.success("Sesja usunięta");
  };

  const shareUrl = createdCode ? `${window.location.origin}/sesja/${createdCode}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Skopiowano link!");
  };

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
        <span className="font-bold text-base">Grupowe matchowanie</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col px-4 py-6 gap-6">
        {!createdCode ? (
          <>
            {/* Active sessions */}
            {activeSessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Twoje aktywne sesje</p>
                {activeSessions.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/sesja/${s.join_code}`)}
                    className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="h-10 w-10 rounded-full bg-orange-600/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{capitalizeCity(s.city)}</p>
                      <p className="text-xs text-muted-foreground font-mono">#{s.join_code}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 active:scale-90 transition-transform shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </button>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-xs text-muted-foreground">lub nowa</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              </div>
            )}

            {/* Join by code section */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <p className="text-sm font-semibold">Dołącz do sesji</p>
              <p className="text-xs text-muted-foreground">Masz kod od znajomego? Wpisz go poniżej.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="np. AB3X9K"
                  className="min-w-0 flex-1 h-11 rounded-xl border border-border/60 bg-background px-3 text-base font-mono font-bold tracking-widest uppercase outline-none focus:border-orange-500 transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={joining || joinCode.trim().length < 4}
                  className="shrink-0 h-11 px-4 rounded-xl bg-orange-600 text-white font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
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

            {/* Trip date */}
            <div>
              <p className="text-sm font-semibold mb-3">Data wyjazdu <span className="font-normal text-muted-foreground">(opcjonalnie)</span></p>
              <button
                onClick={() => setDatePickerOpen(o => !o)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors w-full ${
                  tripDate ? "border-orange-500 text-orange-600 bg-orange-500/5" : "border-border/60 bg-card text-muted-foreground"
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

            {/* Create session */}
            <div>
              <p className="text-sm font-semibold mb-3">Wybierz miasto</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      selectedCity === city
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-card text-foreground border-border/60"
                    }`}
                  >
                    {capitalizeCity(city)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !selectedCity}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
            >
              {loading ? "Tworzę sesję…" : "Stwórz sesję grupową"}
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-4">
              <p className="text-5xl mb-4">🎉</p>
              <p className="text-xl font-black mb-1">Sesja gotowa!</p>
              <p className="text-sm text-muted-foreground">
                Wyślij link znajomym, żeby dołączyli i razem swipe'owali miejsca w{" "}
                <strong>{capitalizeCity(selectedCity)}</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Kod sesji</p>
              <p className="text-4xl font-black tracking-widest mb-4">{createdCode}</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdCode!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success("Skopiowano kod!");
                  }}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Skopiowano!" : "Kopiuj kod"}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex-1 py-3 rounded-xl border border-border/60 bg-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Copy className="h-4 w-4" />
                  Kopiuj link
                </button>
              </div>
            </div>

            {/* Friend invite search */}
            <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm font-semibold">Zaproś znajomego po username</p>
              </div>
              <div className="flex items-center gap-2 bg-background border border-border/60 rounded-xl px-3 h-10">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="search"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Szukaj @username..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                />
              </div>
              {friendResults.length > 0 && (
                <div className="space-y-1">
                  {friendResults.map(profile => {
                    const initials = (profile.first_name || profile.username || "?")[0].toUpperCase();
                    const isInvited = invitedIds.has(profile.id);
                    const isSending = inviting === profile.id;
                    return (
                      <div key={profile.id} className="flex items-center gap-3 rounded-xl bg-background p-2">
                        <div className="h-8 w-8 rounded-full bg-orange-600/15 flex items-center justify-center text-xs font-bold text-orange-700 shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight">{profile.first_name || profile.username}</p>
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        </div>
                        <button
                          disabled={isInvited || isSending}
                          onClick={async () => {
                            if (!createdSessionId) return;
                            setInviting(profile.id);
                            try {
                              const { error } = await (supabase as any).rpc("send_group_invite", {
                                p_target_user_id: profile.id,
                                p_session_id: createdSessionId,
                              });
                              if (error) throw error;
                              setInvitedIds(prev => new Set([...prev, profile.id]));
                              toast.success(`Zaproszenie wysłane do @${profile.username}!`);
                            } catch (e: any) {
                              toast.error(e.message || "Błąd podczas wysyłania zaproszenia");
                            } finally {
                              setInviting(null);
                            }
                          }}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform disabled:opacity-60 disabled:scale-100 ${
                            isInvited
                              ? "border border-border/60 text-emerald-600"
                              : "bg-orange-600 text-white"
                          }`}
                        >
                          {isInvited
                            ? <><Check className="h-3 w-3" />Zaproszono</>
                            : isSending
                            ? "…"
                            : <><UserPlus className="h-3 w-3" />Zaproś</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {friendSearch.trim().length > 0 && friendResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-1">Nie znaleziono użytkownika</p>
              )}
            </div>

            <button
              onClick={() => navigate(`/sesja/${createdCode}`)}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform"
            >
              Zacznij swipe'ować
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateGroupSession;
