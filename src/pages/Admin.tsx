import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Check, Loader2, ArrowLeft, Trash2, Plus, ToggleLeft, ToggleRight, Link as LinkIcon, Sparkles } from "lucide-react";
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

interface CreatorPlan {
  id: string;
  creator_handle: string;
  city: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
  places?: { id: string; place_name: string; category: string | null }[];
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"waitlist" | "places" | "referrals">("waitlist");

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Referrals state
  const [referrals, setReferrals] = useState<Array<{
    id: string;
    code: string;
    slot: number;
    used_by_email: string | null;
    used_by_name: string | null;
    used_at: string | null;
    owner: { username: string | null; first_name: string | null; avatar_url: string | null };
  }>>([]);
  const [fetchingReferrals, setFetchingReferrals] = useState(false);

  // Creator plans state
  const [plans, setPlans] = useState<CreatorPlan[]>([]);
  const [fetchingPlaces, setFetchingPlaces] = useState(false);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<string | null>(null);
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedPlaces, setExtractedPlaces] = useState<Array<{
    place_name: string; city: string | null; category: string | null; creator_handle: string | null;
  }>>([]);
  const [extractedSourceUrl, setExtractedSourceUrl] = useState<string | null>(null);
  const [extractedThumbnail, setExtractedThumbnail] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

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
        loadPlans();
        loadReferrals();
      });
  }, [user, loading, navigate]);

  // Auto-refresh waitlist
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => loadWaitlist(), 30000);
    return () => clearInterval(interval);
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

  const loadPlans = async () => {
    setFetchingPlaces(true);
    const { data: planData } = await supabase
      .from("creator_plans")
      .select("id, creator_handle, city, title, video_url, thumbnail_url, is_active, created_at")
      .order("created_at", { ascending: false });
    if (planData?.length) {
      const { data: placeData } = await supabase
        .from("creator_places")
        .select("id, place_name, category, plan_id")
        .in("plan_id", planData.map(p => p.id));
      setPlans(planData.map(plan => ({
        ...plan,
        places: (placeData ?? []).filter(pl => pl.plan_id === plan.id),
      })));
    } else {
      setPlans([]);
    }
    setFetchingPlaces(false);
  };

  const loadReferrals = async () => {
    setFetchingReferrals(true);
    const { data: codes } = await (supabase as any)
      .from("referral_codes")
      .select("id, code, slot, used_by_email, used_by_name, used_at, owner_id")
      .order("slot");
    if (codes?.length) {
      const ownerIds = [...new Set(codes.map((c: any) => c.owner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, first_name")
        .in("id", ownerIds as string[]);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      setReferrals(codes.map((c: any) => ({
        ...c,
        owner: profileMap[c.owner_id] ?? { username: null, first_name: null, avatar_url: null },
      })));
    } else {
      setReferrals([]);
    }
    setFetchingReferrals(false);
  };

  const handleInvite = async (entry: WaitlistEntry) => {
    setInviting(entry.id);
    try {
      const response = await supabase.functions.invoke("invite-user", {
        body: { email: entry.email, username: entry.email.split("@")[0], waitlist_id: entry.id },
      });
      if (response.error || !response.data?.link) throw new Error(response.error?.message ?? "Błąd generowania linku");
      const link = response.data.link as string;
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

  const handleExtractUrl = async () => {
    const url = extractUrl.trim();
    if (!url) return;
    setExtracting(true);
    setExtractedPlaces([]);
    try {
      const { data, error } = await supabase.functions.invoke("extract-creator-place", {
        body: { url },
      });
      if (error || !data) throw new Error(error?.message ?? "Błąd ekstrakcji");
      if (data.error) throw new Error(data.error);

      const places = data.places ?? [];
      if (places.length === 0) {
        toast.error("AI nie znalazło konkretnych miejsc w tym materiale");
      } else {
        setExtractedPlaces(places);
        setExtractedSourceUrl(url);
        setExtractedThumbnail(data.photo_url ?? null);
        const handle = places[0]?.creator_handle ?? "";
        if (handle) setPlanTitle(`Plan od ${handle}`);
        toast.success(`Znaleziono ${places.length} miejsc — nadaj tytuł i zapisz plan`);
        setExtractUrl("");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się przetworzyć URL");
    }
    setExtracting(false);
  };

  const handleSavePlan = async () => {
    if (!planTitle.trim()) { toast.error("Wpisz tytuł planu"); return; }
    const valid = extractedPlaces.filter(p => p.place_name && p.city);
    if (valid.length === 0) { toast.error("Brak miejsc do zapisania"); return; }
    setSavingPlan(true);
    const creatorHandle = extractedPlaces[0]?.creator_handle || "@nieznany";
    const city = extractedPlaces[0]?.city || "";
    const { data: plan, error: planErr } = await supabase
      .from("creator_plans")
      .insert({ title: planTitle.trim(), creator_handle: creatorHandle, city, video_url: extractedSourceUrl, thumbnail_url: extractedThumbnail })
      .select("id")
      .single();
    if (planErr || !plan) { toast.error("Błąd zapisu planu: " + planErr?.message); setSavingPlan(false); return; }
    const { error: placesErr } = await supabase.from("creator_places").insert(
      valid.map(p => ({ plan_id: plan.id, place_name: p.place_name, city: p.city!, category: p.category || null, creator_handle: creatorHandle, instagram_reel_url: extractedSourceUrl || null }))
    );
    if (placesErr) { toast.error("Błąd zapisu miejsc: " + placesErr.message); setSavingPlan(false); return; }
    toast.success(`Plan „${planTitle}" zapisany z ${valid.length} miejscami!`);
    setExtractedPlaces([]);
    setExtractedSourceUrl(null);
    setExtractedThumbnail(null);
    setPlanTitle("");
    loadPlans();
    setSavingPlan(false);
  };

  const handleTogglePlan = async (plan: CreatorPlan) => {
    setTogglingPlan(plan.id);
    const { error } = await supabase.from("creator_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (error) { toast.error("Błąd aktualizacji"); } else {
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p));
    }
    setTogglingPlan(null);
  };

  const handleDeletePlan = async (plan: CreatorPlan) => {
    if (!confirm(`Usunąć plan „${plan.title}"? Usunie też wszystkie powiązane miejsca.`)) return;
    setDeletingPlan(plan.id);
    const { error } = await supabase.from("creator_plans").delete().eq("id", plan.id);
    if (error) { toast.error("Błąd usuwania"); } else {
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      toast.success("Plan usunięty");
    }
    setDeletingPlan(null);
  };

  if (loading || isAdmin === null) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <button onClick={() => navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Panel admina</h1>
        <button
          onClick={() => navigate("/admin/routes")}
          className="text-xs bg-orange-500/10 text-orange-600 font-semibold px-3 py-1.5 rounded-full hover:bg-orange-500/20 transition-colors"
        >
          🗺️ Trasy wzorcowe
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(["waitlist", "referrals", "places"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "waitlist" ? "Oczekujący" : t === "referrals" ? "Zaproszenia" : "Miejsca"}
          </button>
        ))}
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
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {link ? (
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">{link}</div>
                        <button
                          onClick={() => copyLink(entry.id, link)}
                          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
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
                        className="w-full rounded-lg"
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

        {/* ── Referrals Tab ── */}
        {tab === "referrals" && (
          fetchingReferrals ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Brak kodów zaproszeń.</p>
          ) : (
            <div className="space-y-3">
              {/* Group by owner */}
              {Object.entries(
                referrals.reduce<Record<string, typeof referrals>>((acc, r) => {
                  const key = r.owner.username ?? r.id;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(r);
                  return acc;
                }, {})
              ).map(([, slots]) => {
                const owner = slots[0].owner;
                const ownerName = owner.first_name || owner.username || "Użytkownik";
                return (
                  <div key={slots[0].id} className="border border-border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">
                        {ownerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{ownerName}</p>
                        {owner.username && <p className="text-xs text-muted-foreground">@{owner.username}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {slots.map(slot => (
                        <div key={slot.code} className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground w-16 flex-shrink-0">Slot {slot.slot}</span>
                          {slot.used_at ? (
                            <span className="flex-1 font-medium text-amber-600 dark:text-amber-400">
                              Wykorzystany — {slot.used_by_name || slot.used_by_email || "nieznany"}
                            </span>
                          ) : (
                            <span className="flex-1 font-mono text-muted-foreground truncate">
                              {window.location.origin}/join/{slot.code}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${
                            slot.used_at
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {slot.used_at ? "Użyty" : "Wolny"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Creator Places Tab ── */}
        {tab === "places" && (
          <div className="space-y-6">
            {/* Add form */}
            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <p className="font-semibold text-sm">Dodaj miejsce</p>

              {/* URL auto-fill */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-wypełnij z URL (YouTube / TikTok)
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={extractUrl}
                    onChange={e => setExtractUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleExtractUrl())}
                    className="flex-1 bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtractUrl}
                    disabled={!extractUrl.trim() || extracting}
                    className="shrink-0"
                  >
                    {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Wklej link → AI przeczyta opis i wyciągnie wszystkie wymienione miejsca.
                </p>
              </div>

              {/* Extracted places → save as plan */}
              {extractedPlaces.length > 0 && (
                <div className="space-y-3 border border-border rounded-xl p-3 bg-background">
                  {extractedThumbnail && (
                    <img src={extractedThumbnail} alt="miniaturka" className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <p className="text-xs font-medium text-muted-foreground">
                    Znaleziono {extractedPlaces.length} miejsc — nadaj tytuł i zapisz jako plan
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tytuł planu</label>
                    <Input
                      placeholder="np. 10 kawiarni w Krakowie"
                      value={planTitle}
                      onChange={e => setPlanTitle(e.target.value)}
                      className="bg-card text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    {extractedPlaces.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground text-xs w-4">{idx + 1}.</span>
                        <span className="font-medium truncate">{p.place_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">{p.category}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleSavePlan} disabled={savingPlan || !planTitle.trim()} className="w-full">
                    {savingPlan ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Zapisywanie...</> : "Zapisz plan"}
                  </Button>
                </div>
              )}
            </div>

            {/* Plans list */}
            {fetchingPlaces ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Brak planów twórców.</p>
            ) : (
              <div className="space-y-3">
                {plans.map(plan => (
                  <div key={plan.id} className="border border-border rounded-xl bg-card overflow-hidden">
                    {plan.thumbnail_url && (
                      <img src={plan.thumbnail_url} alt={plan.title} className="w-full h-24 object-cover" />
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{plan.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {plan.creator_handle} · {plan.city} · {plan.places?.length ?? 0} miejsc
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTogglePlan(plan)}
                            disabled={togglingPlan === plan.id}
                            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            title={plan.is_active ? "Dezaktywuj" : "Aktywuj"}
                          >
                            {togglingPlan === plan.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : plan.is_active ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan)}
                            disabled={deletingPlan === plan.id}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {deletingPlan === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      {!plan.is_active && (
                        <span className="inline-block mt-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Nieaktywne</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
