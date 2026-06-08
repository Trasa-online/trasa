import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPhotoUrl } from "@/lib/placePhotos";
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Search, Eye, MapPin,
  Users, Route as RouteIcon, UsersRound, Mail, ExternalLink, Phone, X,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const RANGES = [
  { label: "7 dni", days: 7 },
  { label: "30 dni", days: 30 },
  { label: "90 dni", days: 90 },
];

// ── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, deltaPct }: { icon: any; label: string; value: number | string; deltaPct?: number | null }) {
  return (
    <div className="bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {deltaPct != null && (
        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${deltaPct >= 0 ? "text-green-600" : "text-red-500"}`}>
          {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaPct >= 0 ? "+" : ""}{deltaPct}% vs poprzedni okres
        </div>
      )}
    </div>
  );
}

// ── Per-place analytics panel (reuse posthog-analytics) ─────────────────────────
function PlaceAnalytics({ place, rangeDays, onClose }: { place: any; rangeDays: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["place-analytics", place.id, rangeDays],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("posthog-analytics", {
        body: { place_id: place.id, range_days: rangeDays, include_recent: true },
      });
      if (error) throw error;
      return data as any;
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#FEFEFE] w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#FEFEFE] border-b border-border/30 px-5 pt-4 pb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">{place.place_name}</h3>
            <p className="text-xs text-muted-foreground">{place.city} · {place.category}{place.claimed ? " · wizytówka biznesowa" : " · stan zero (bez właściciela)"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <Kpi icon={Eye} label="Wyświetlenia" value={data?.views ?? 0} />
                <Kpi icon={RouteIcon} label="Dodania do trasy" value={data?.onRoutes ?? 0} />
                <Kpi icon={ExternalLink} label="Kliki strona" value={data?.websiteClicks ?? 0} />
                <Kpi icon={Phone} label="Kliki telefon" value={data?.phoneClicks ?? 0} />
              </div>
              {(data?.chartData?.length ?? 0) > 0 ? (
                <div className="h-44 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" stroke="#F9662B" strokeWidth={2} dot={false} name="Wyświetlenia" />
                      <Line type="monotone" dataKey="routes" stroke="#2563eb" strokeWidth={2} dot={false} name="Dodania" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">Brak ruchu w tym okresie (stan zero). Dane pojawią się gdy miejsce zacznie być oglądane.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => { if (!data) { navigate("/"); return; } setIsAdmin(true); });
  }, [user, loading, navigate]);

  // Part A: product KPIs
  const { data: analytics, isLoading: kpiLoading } = useQuery({
    queryKey: ["admin-analytics", rangeDays],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-analytics", { body: { range_days: rangeDays } });
      if (error) throw error;
      return data as any;
    },
    enabled: isAdmin === true,
  });

  // Part B: all places + claimed map
  const { data: places = [], isLoading: placesLoading } = useQuery({
    queryKey: ["admin-places", search, cityFilter],
    queryFn: async () => {
      let q = (supabase as any).from("places").select("id, place_name, city, category, photo_url").eq("is_active", true).order("place_name").limit(60);
      if (search.trim()) q = q.ilike("place_name", `%${search.trim()}%`);
      if (cityFilter) q = q.eq("city", cityFilter);
      const { data: rows } = await q;
      const ids = (rows ?? []).map((r: any) => r.id);
      const { data: biz } = await (supabase as any).from("business_profiles").select("place_id").in("place_id", ids.length ? ids : ["_none_"]);
      const claimedSet = new Set((biz ?? []).map((b: any) => b.place_id));
      return (rows ?? []).map((r: any) => ({ ...r, claimed: claimedSet.has(r.id) }));
    },
    enabled: isAdmin === true,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["admin-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("places").select("city").eq("is_active", true).limit(2000);
      return [...new Set((data ?? []).map((r: any) => r.city))].sort();
    },
    enabled: isAdmin === true,
  });

  if (isAdmin === null) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-[#FEFEFE]"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  }

  const k = analytics?.kpis;

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-border/40 px-4 pt-safe-4 pb-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="p-1"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-base font-bold flex-1">Analityka</h1>
          <div className="flex gap-1 bg-muted rounded-full p-0.5">
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${rangeDays === r.days ? "bg-orange-600 text-white" : "text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-6 pb-safe">
        {/* ── A. Product KPIs ── */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Produkt</h2>
          {kpiLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Kpi icon={Users} label={`Rejestracje (${rangeDays}d)`} value={k?.signups?.value ?? 0} deltaPct={k?.signups?.deltaPct} />
                <Kpi icon={Users} label="DAU" value={k?.dau ?? 0} />
                <Kpi icon={Users} label="WAU" value={k?.wau ?? 0} />
                <Kpi icon={Users} label="MAU" value={k?.mau ?? 0} />
                <Kpi icon={RouteIcon} label={`Trasy (${rangeDays}d)`} value={k?.routes?.value ?? 0} deltaPct={k?.routes?.deltaPct} />
                <Kpi icon={UsersRound} label={`Sesje grupowe (${rangeDays}d)`} value={k?.groups?.value ?? 0} />
                <Kpi icon={Mail} label={`Waitlista (${rangeDays}d)`} value={k?.waitlist?.value ?? 0} />
              </div>

              {(analytics?.daily?.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-border/40 p-4 shadow-sm mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Dziennie: rejestracje · trasy · aktywni</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="signups" stroke="#F9662B" strokeWidth={2} dot={false} name="Rejestracje" />
                        <Line type="monotone" dataKey="routes" stroke="#2563eb" strokeWidth={2} dot={false} name="Trasy" />
                        <Line type="monotone" dataKey="active" stroke="#16a34a" strokeWidth={2} dot={false} name="Aktywni" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Funnel */}
              {(analytics?.funnel?.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-border/40 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Lejek (zdarzenia w okresie {rangeDays}d)</p>
                  <div className="space-y-2">
                    {analytics.funnel.map((step: any, i: number) => {
                      const max = analytics.funnel[0]?.value || 1;
                      const w = Math.max(4, Math.round((step.value / max) * 100));
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-0.5"><span className="text-foreground">{step.step}</span><span className="font-semibold">{step.value}</span></div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#F4A259] to-[#F9662B]" style={{ width: `${w}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── B. Places explorer (wszystkie wizytówki) ── */}
        <section>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Wizytówki (wszystkie miejsca)</h2>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-white border border-border/40 rounded-xl px-3 h-10">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj miejsca..." className="flex-1 bg-transparent text-sm outline-none" style={{ fontSize: 16 }} />
            </div>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-white border border-border/40 rounded-xl px-3 h-10 text-sm">
              <option value="">Wszystkie miasta</option>
              {(cities as string[]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {placesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-orange-500" /></div>
          ) : (
            <div className="space-y-2">
              {(places as any[]).map((p) => (
                <button key={p.id} onClick={() => setSelectedPlace(p)}
                  className="w-full flex items-center gap-3 bg-white border border-border/40 rounded-2xl p-2.5 text-left hover:border-orange-300 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0">
                    {p.photo_url ? <img src={getPhotoUrl(p.photo_url)} alt="" className="h-full w-full object-cover" /> : <MapPin className="h-5 w-5 text-muted-foreground m-auto mt-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.place_name}</p>
                    <p className="text-xs text-muted-foreground">{p.city} · {p.category}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.claimed ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.claimed ? "biznes" : "stan zero"}
                  </span>
                </button>
              ))}
              {(places as any[]).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Brak miejsc dla tego filtra.</p>}
              {(places as any[]).length === 60 && <p className="text-center text-xs text-muted-foreground py-2">Pokazano pierwsze 60 - zawęź wyszukiwaniem.</p>}
            </div>
          )}
        </section>
      </div>

      {selectedPlace && <PlaceAnalytics place={selectedPlace} rangeDays={rangeDays} onClose={() => setSelectedPlace(null)} />}
    </div>
  );
}
