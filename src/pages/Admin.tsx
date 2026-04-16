import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  notified_at: string | null;
  source: string | null;
  referral_code?: string | null;
  has_account?: boolean;
}

interface BusinessClaim {
  id: string;
  place_id: string | null;
  user_id: string;
  contact_email: string;
  contact_phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  business_name: string | null;
  place_name_text: string | null;
  places: { place_name: string; city: string } | null;
  business_profiles: { activated_at: string | null } | null;
}

/** Call invite-user with explicit session token to avoid PWA auth issues */
async function invokeInviteUser(email: string, username: string, waitlist_id?: string, isBusiness?: boolean) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Brak sesji – zaloguj się ponownie");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ email, username, waitlist_id, isBusiness }),
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  if (!json?.link) throw new Error(`Brak linku w odpowiedzi: ${JSON.stringify(json)}`);
  return json as { link: string; email: string; userId?: string };
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"waitlist" | "cities" | "businesses" | "bugs">("waitlist");

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Cities state
  const [cityRequests, setCityRequests] = useState<Array<{ city_name: string; count: number }>>([]);
  const [fetchingCities, setFetchingCities] = useState(false);

  // Bug reports state
  const [bugReports, setBugReports] = useState<Array<{
    id: string;
    user_id: string | null;
    description: string;
    screenshot_url: string | null;
    status: string;
    created_at: string;
    profiles?: { username: string | null; first_name: string | null } | null;
  }>>([]);
  const [fetchingBugs, setFetchingBugs] = useState(false);

  // Business claims state
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [fetchingClaims, setFetchingClaims] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const [bizInviteLinks, setBizInviteLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { navigate("/"); return; }
        setIsAdmin(true);
        loadWaitlist();
        loadCityRequests();
        loadClaims();
        loadBugReports();
      });
  }, [user, loading, navigate]);

  // Auto-refresh waitlist
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => loadWaitlist(), 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Realtime: notify when a new business claim arrives
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-business-claims")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "business_claims" }, (payload) => {
        const name = (payload.new as any).place_name_text || (payload.new as any).contact_email || "nowy lokal";
        toast.info(`🏪 Nowe zgłoszenie: ${name}`, { duration: 8000 });
        loadClaims();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const loadWaitlist = async () => {
    setFetchingList(true);
    try {
      const response = await supabase.functions.invoke("check-waitlist-status");
      if (response.data?.entries) {
        setWaitlist(response.data.entries as WaitlistEntry[]);
      }
    } catch (err) {
      console.error("Failed to load waitlist:", err);
    }
    setFetchingList(false);
  };

  const loadCityRequests = async () => {
    setFetchingCities(true);
    const { data } = await (supabase as any)
      .from("city_requests")
      .select("city_name")
      .order("city_name");
    if (data) {
      const counts: Record<string, number> = {};
      for (const row of data) counts[row.city_name] = (counts[row.city_name] ?? 0) + 1;
      setCityRequests(
        Object.entries(counts)
          .map(([city_name, count]) => ({ city_name, count }))
          .sort((a, b) => b.count - a.count)
      );
    }
    setFetchingCities(false);
  };

  const loadBugReports = async () => {
    setFetchingBugs(true);
    const { data, error } = await (supabase as any)
      .from("bug_reports")
      .select("id, user_id, description, screenshot_url, status, created_at")
      .order("created_at", { ascending: false });
    if (error) { console.error("bug_reports fetch error:", error); }
    if (data?.length) {
      // Enrich with profile names
      const userIds = [...new Set(data.map((r: any) => r.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name")
        .in("id", userIds as string[]);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      setBugReports(data.map((r: any) => ({ ...r, profiles: profileMap[r.user_id] ?? null })));
    } else {
      setBugReports(data ?? []);
    }
    setFetchingBugs(false);
  };

  const markBugResolved = async (id: string) => {
    await (supabase as any).from("bug_reports").update({ status: "resolved" }).eq("id", id);
    setBugReports(prev => prev.map(r => r.id === id ? { ...r, status: "resolved" } : r));
  };

  const loadClaims = async () => {
    setFetchingClaims(true);
    const { data } = await (supabase as any)
      .from("business_claims")
      .select("id, place_id, user_id, contact_email, contact_phone, message, status, created_at, business_name, place_name_text, places(place_name, city), business_profiles(activated_at)")
      .order("created_at", { ascending: false });
    setClaims(data ?? []);
    setFetchingClaims(false);
  };

  const handleApproveClaim = async (claim: BusinessClaim) => {
    setApprovingId(claim.id);
    try {
      // 1. Invite user — creates auth account + returns magic link + userId
      const { link, userId: newUserId } = await invokeInviteUser(claim.contact_email, claim.contact_email.split("@")[0], undefined, true);

      // 2. Create/update business profile linked to the new user (core — must succeed)
      const bizName = claim.place_name_text ?? claim.business_name ?? claim.places?.place_name ?? "Mój lokal";
      if (claim.place_id) {
        const { error: bpErr } = await (supabase as any).from("business_profiles").upsert({
          place_id: claim.place_id,
          owner_user_id: newUserId,
          business_name: bizName,
          is_active: true,
        }, { onConflict: "place_id" });
        if (bpErr) throw new Error(`business_profiles upsert: ${bpErr.message}`);
      } else {
        const { error: bpErr } = await (supabase as any).from("business_profiles").insert({
          owner_user_id: newUserId,
          business_name: bizName,
          is_active: true,
        });
        if (bpErr) throw new Error(`business_profiles insert: ${bpErr.message}`);
      }

      // 2b. Link claim_id for activation tracking (optional — requires migration)
      await (supabase as any).from("business_profiles")
        .update({ claim_id: claim.id })
        .eq("owner_user_id", newUserId);

      // 3. Mark claim as approved
      await (supabase as any).from("business_claims").update({ status: "approved" }).eq("id", claim.id);

      // 4. Store link to display in UI for copying
      setBizInviteLinks(prev => ({ ...prev, [claim.id]: link }));
      loadClaims();
      toast.success(`Zatwierdzono — skopiuj link i wyślij do ${claim.contact_email}`);
    } catch (err: any) {
      toast.error(err.message ?? "Błąd zatwierdzania");
    } finally {
      setApprovingId(null);
    }
  };

  const handleGenerateBizLink = async (claim: BusinessClaim) => {
    setApprovingId(claim.id);
    try {
      const { link } = await invokeInviteUser(claim.contact_email, claim.contact_email.split("@")[0], undefined, true);
      setBizInviteLinks(prev => ({ ...prev, [claim.id]: link }));
      toast.success("Link wygenerowany — skopiuj i wyślij");
    } catch (err: any) {
      toast.error(err.message ?? "Błąd generowania linku", { duration: 10000 });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectClaim = async (claim: BusinessClaim) => {
    setRejectingId(claim.id);
    await (supabase as any).from("business_claims").update({ status: "rejected" }).eq("id", claim.id);
    setRejectingId(null);
    loadClaims();
    toast.success("Odrzucono");
  };

  const handleDeleteClaim = async (claim: BusinessClaim) => {
    setDeletingClaimId(claim.id);
    await (supabase as any).from("business_claims").delete().eq("id", claim.id);
    setDeletingClaimId(null);
    setClaims(prev => prev.filter(c => c.id !== claim.id));
    toast.success("Usunięto zgłoszenie");
  };

  const handleInvite = async (entry: WaitlistEntry) => {
    setInviting(entry.id);
    try {
      const { link } = await invokeInviteUser(entry.email, entry.email.split("@")[0], entry.id);
      setGeneratedLinks(prev => ({ ...prev, [entry.id]: link }));
      setWaitlist(prev => prev.map(e => e.id === entry.id ? { ...e, notified_at: new Date().toISOString() } : e));
      toast.success(`Link dla ${entry.email} gotowy — skopiuj i wyślij!`);
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się wygenerować linku");
    } finally {
      setInviting(null);
    }
  };

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link skopiowany!");
  };

  const handleDelete = async (entry: WaitlistEntry) => {
    if (!confirm(`Usunąć ${entry.email} z listy oczekujących?`)) return;
    setDeleting(entry.id);
    try {
      const { error } = await supabase.from("waitlist").delete().eq("id", entry.id);
      if (error) throw error;
      setWaitlist(prev => prev.filter(e => e.id !== entry.id));
      toast.success(`${entry.email} usunięto z listy`);
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się usunąć");
    } finally {
      setDeleting(null);
    }
  };

  if (loading || isAdmin === null) return null;

  const pendingClaims = claims.filter(c => c.status === "pending").length;
  const pendingWaitlist = waitlist.filter(w => !w.notified_at).length;

  const tabLabels: Record<string, string> = {
    waitlist: "Oczekujący",
    cities: "Miasta",
    businesses: "Biznesy",
    bugs: "Błędy",
  };

  const sortedClaims = [...claims].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-4 border-b border-border/40">
        <button onClick={() => navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Panel admina</h1>
        <button
          onClick={() => navigate("/admin/routes")}
          className="text-xs bg-orange-600/10 text-orange-600 font-semibold px-3 py-1.5 rounded-full hover:bg-orange-700/20 transition-colors"
        >
          🗺️ Trasy wzorcowe
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(["waitlist", "cities", "businesses", "bugs"] as const).map(t => {
          const newBugs = bugReports.filter(r => r.status === "new").length;
          const badge = t === "businesses" ? pendingClaims : t === "waitlist" ? pendingWaitlist : t === "bugs" ? newBugs : 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"
              }`}
            >
              {tabLabels[t]}
              {badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* ── Waitlist Tab ── */}
        {tab === "waitlist" && (
          fetchingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : waitlist.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Brak zgłoszeń na liście oczekujących.
            </p>
          ) : (
            <div className="space-y-3">
              {waitlist.map(entry => {
                const link = generatedLinks[entry.id];
                return (
                  <div key={entry.id} className="border border-border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{entry.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Zgłoszono: {format(new Date(entry.created_at), "dd.MM.yyyy HH:mm")}
                          {entry.notified_at && (
                            <> · Zaproszono: {format(new Date(entry.notified_at), "dd.MM.yyyy HH:mm")}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.referral_code && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            🔗 Zaproszony
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          entry.has_account
                            ? "bg-blue-100 text-blue-700"
                            : entry.notified_at
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {entry.has_account ? "Konto stworzone" : entry.notified_at ? "Zaproszono" : "Oczekuje"}
                        </span>
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={deleting === entry.id}
                          className="h-7 w-7 flex items-center justify-center rounded-2xl text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {link ? (
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground font-mono truncate">{link}</div>
                        <button
                          onClick={() => copyLink(entry.id, link)}
                          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-2xl border border-border bg-card hover:bg-muted transition-colors"
                        >
                          {copiedId === entry.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={entry.notified_at ? "outline" : "default"}
                        onClick={() => handleInvite(entry)}
                        disabled={inviting === entry.id}
                        className="w-full rounded-2xl"
                      >
                        {inviting === entry.id ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generuję link...</>
                        ) : entry.notified_at ? "Wygeneruj nowy link" : "Generuj link aktywacyjny"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}


        {/* ── Cities Tab ── */}
        {tab === "cities" && (
          fetchingCities ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cityRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Brak zgłoszeń miast.</p>
          ) : (
            <div className="space-y-2">
              {cityRequests.map(({ city_name, count }) => (
                <div key={city_name} className="flex items-center justify-between border border-border rounded-xl px-4 py-3 bg-card">
                  <p className="text-sm font-semibold">{city_name}</p>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Businesses Tab ── */}
        {tab === "businesses" && (
          fetchingClaims ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Brak zgłoszeń biznesowych.</p>
          ) : (
            <div className="space-y-3">
              {sortedClaims.map(claim => (
                <div key={claim.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {claim.business_name ?? claim.places?.place_name ?? claim.place_id ?? "—"}
                      </p>
                      {(claim.place_name_text || claim.places?.city) && (
                        <p className="text-xs text-muted-foreground">
                          {claim.place_name_text ?? claim.places?.city}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {claim.contact_email}
                        {claim.contact_phone && ` · ${claim.contact_phone}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(claim.created_at), "dd.MM.yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        claim.status === "pending"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : claim.status === "approved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {claim.status === "pending" ? "Oczekuje" : claim.status === "approved" ? "Zatwierdzono" : "Odrzucono"}
                      </span>
                      <button
                        onClick={() => handleDeleteClaim(claim)}
                        disabled={deletingClaimId === claim.id}
                        className="h-7 w-7 flex items-center justify-center rounded-2xl text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {deletingClaimId === claim.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {claim.message && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-2xl px-3 py-2">
                      {claim.message}
                    </p>
                  )}
                  {claim.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRejectClaim(claim)}
                        disabled={rejectingId === claim.id || approvingId === claim.id}
                      >
                        {rejectingId === claim.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Odrzuć"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => handleApproveClaim(claim)}
                        disabled={approvingId === claim.id || rejectingId === claim.id}
                      >
                        {approvingId === claim.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generuję...</> : "Zatwierdź i wyślij link"}
                      </Button>
                    </div>
                  )}
                  {claim.status === "approved" && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-2xl w-fit ${
                      claim.business_profiles?.activated_at
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${claim.business_profiles?.activated_at ? "bg-green-500" : "bg-amber-500"}`} />
                      {claim.business_profiles?.activated_at
                        ? `Konto aktywowane ${format(new Date(claim.business_profiles.activated_at), "dd.MM.yyyy HH:mm")}`
                        : "Link nie użyty"}
                    </div>
                  )}
                  {claim.status === "approved" && !bizInviteLinks[claim.id] && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleGenerateBizLink(claim)}
                      disabled={approvingId === claim.id}
                    >
                      {approvingId === claim.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generuję...</> : "Wyślij link aktywacyjny"}
                    </Button>
                  )}
                  {bizInviteLinks[claim.id] && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                          {bizInviteLinks[claim.id]}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(bizInviteLinks[claim.id]);
                            setCopiedId(claim.id);
                            setTimeout(() => setCopiedId(null), 2000);
                            toast.success("Link skopiowany!");
                          }}
                          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-2xl border border-border bg-card hover:bg-muted transition-colors"
                        >
                          {copiedId === claim.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleGenerateBizLink(claim)}
                        disabled={approvingId === claim.id}
                        className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {approvingId === claim.id ? <><Loader2 className="h-3 w-3 animate-spin" />Generuję...</> : "Wygeneruj nowy link (użyty lub wygasły)"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
        {/* ── Bug Reports Tab ── */}
        {tab === "bugs" && (
          fetchingBugs ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bugReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Brak zgłoszeń błędów.</p>
          ) : (
            <div className="space-y-3">
              {bugReports.map(r => {
                const author = (r.profiles as any)?.first_name || (r.profiles as any)?.username || r.user_id?.slice(0, 8) || "?";
                return (
                  <div key={r.id} className={`rounded-2xl border p-4 space-y-2.5 ${r.status === "resolved" ? "opacity-50 border-border/30" : "border-border/60 bg-card"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-muted-foreground">{author}</span>
                          <span className="text-xs text-muted-foreground/50">·</span>
                          <span className="text-xs text-muted-foreground/50">{format(new Date(r.created_at), "dd.MM.yyyy HH:mm")}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.description}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${r.status === "resolved" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {r.status === "resolved" ? "Rozwiązane" : "Nowe"}
                      </span>
                    </div>
                    {r.screenshot_url && (
                      <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer">
                        <img src={r.screenshot_url} alt="screenshot" className="w-full max-h-48 object-cover rounded-xl border border-border/30" />
                      </a>
                    )}
                    {r.status !== "resolved" && (
                      <button
                        onClick={() => markBugResolved(r.id)}
                        className="w-full py-1.5 rounded-xl border border-border/40 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Oznacz jako rozwiązane
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Admin;
