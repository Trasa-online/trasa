import { useSearchParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  LayoutDashboard, Images, Store, Megaphone, TrendingUp,
  Eye, MapPin, MousePointerClick, Phone, Star, ArrowRight,
  Lock, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { MAIN_CATEGORIES } from "@/lib/categories";

type Tab = "overview" | "gallery" | "profile" | "posts" | "analytics";

const DEMO_STATS = { views: 1247, onRoutes: 89, websiteClicks: 34, phoneClicks: 21, rating: 4.7, reviews: 38 };

const DEMO_CHART = [
  { date: "Pon", views: 58, routes: 4 },
  { date: "Wt", views: 72, routes: 6 },
  { date: "Śr", views: 89, routes: 9 },
  { date: "Czw", views: 61, routes: 5 },
  { date: "Pt", views: 143, routes: 14 },
  { date: "Sob", views: 198, routes: 21 },
  { date: "Nd", views: 176, routes: 18 },
];

const DEMO_ACTIVITY = [
  { icon: "👀", text: "Nowe wyświetlenie Twojej wizytówki", time: "przed chwilą" },
  { icon: "🗺️", text: "Ktoś dodał Twój lokal do trasy", time: "4 min temu" },
  { icon: "⭐", text: "Nowa ocena: 5/5 — \"Świetne miejsce!\"", time: "12 min temu" },
  { icon: "📱", text: "Kliknięcie w numer telefonu", time: "28 min temu" },
  { icon: "🗺️", text: "Ktoś dodał Twój lokal do trasy", time: "1 godz. temu" },
  { icon: "👀", text: "6 nowych wyświetleń w ostatniej godzinie", time: "1 godz. temu" },
];

const DEMO_GALLERY = [
  "from-amber-700 to-orange-600",
  "from-slate-600 to-slate-800",
  "from-rose-500 to-pink-700",
  "from-teal-500 to-emerald-700",
];

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">{icon}</div>
      </div>
      <p className="text-2xl font-black text-[#0E0E0E]">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-orange-600 font-semibold mt-1">{sub}</p>}
    </div>
  );
}

function DemoCardPreview({ businessName, kategoria, miasto }: { businessName: string; kategoria: string; miasto: string }) {
  const catLabel = MAIN_CATEGORIES.find(c => c.id === kategoria)?.label ?? kategoria;
  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-xl" style={{ aspectRatio: "3/4" }}>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-600 to-amber-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <span className="text-white/60 text-xs">{catLabel} · @trasa</span>
        </div>
        <h3 className="text-xl font-black text-white leading-tight">{businessName}</h3>
        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-3 py-1 text-white font-semibold text-xs">
          🎉 Przykładowa promocja — 20% rabatu w weekendy
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["must-see", "lokalne smaki", miasto.toLowerCase()].map(t => (
            <span key={t} className="px-2 py-0.5 bg-white/15 rounded-full text-xs text-white/80">#{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LockedTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="text-xs text-slate-400 mt-1">Dostępne po rejestracji</p>
    </div>
  );
}

export default function BusinessDashboardDemo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const firma = searchParams.get("firma") ?? "Twój Lokal";
  const kategoria = searchParams.get("kategoria") ?? "Restauracja";
  const miasto = searchParams.get("miasto") ?? "Gdańsk";

  const TABS: { id: Tab; label: string; icon: React.ReactNode; locked?: boolean }[] = [
    { id: "overview", label: "Przegląd", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "gallery", label: "Galeria", icon: <Images className="h-4 w-4" />, locked: true },
    { id: "profile", label: "Profil", icon: <Store className="h-4 w-4" />, locked: true },
    { id: "posts", label: "Aktualności", icon: <Megaphone className="h-4 w-4" />, locked: true },
    { id: "analytics", label: "Analityka", icon: <TrendingUp className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      {/* Demo banner */}
      <div className="sticky top-0 z-50 bg-[#0E0E0E] text-white px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
          <p className="text-xs font-semibold text-white/80 truncate">
            To jest demo — tak wygląda Twój panel w Trasie
          </p>
        </div>
        <button
          onClick={() => navigate("/dla-firm")}
          className="shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap active:scale-95 transition-transform"
        >
          Zarejestruj lokal <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md"
                style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
              >
                {firma.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="font-black text-[#0E0E0E] text-sm leading-tight">{firma}</h1>
                <p className="text-xs text-slate-400">{kategoria} · {miasto}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full px-2.5 py-1">
              ✨ Premium
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-0 border-b border-transparent -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {t.icon}
                {t.label}
                {t.locked && <Lock className="h-2.5 w-2.5 opacity-50" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Eye className="h-4 w-4" />} label="Wyświetlenia (30 dni)" value={DEMO_STATS.views} sub="+18% vs poprzedni miesiąc" />
              <StatCard icon={<MapPin className="h-4 w-4" />} label="Dodania do trasy" value={DEMO_STATS.onRoutes} sub="+12% vs poprzedni miesiąc" />
              <StatCard icon={<MousePointerClick className="h-4 w-4" />} label="Kliknięcia w stronę" value={DEMO_STATS.websiteClicks} />
              <StatCard icon={<Star className="h-4 w-4" />} label="Ocena średnia" value={`${DEMO_STATS.rating} ★`} sub={`${DEMO_STATS.reviews} opinii`} />
            </div>

            {/* Chart + preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="sm:col-span-2 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Wyświetlenia — ostatnie 7 dni</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={DEMO_CHART} barSize={20}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 11 }}
                      cursor={{ fill: "rgba(249,102,43,0.06)" }}
                    />
                    <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                      {DEMO_CHART.map((_, i) => (
                        <Cell key={i} fill={i === DEMO_CHART.length - 2 ? "#F9662B" : i === DEMO_CHART.length - 1 ? "#F4A259" : "#fed7aa"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <DemoCardPreview businessName={firma} kategoria={kategoria} miasto={miasto} />
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ostatnia aktywność</p>
              </div>
              <div className="divide-y divide-slate-50">
                {DEMO_ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <p className="text-sm text-slate-700 flex-1">{item.text}</p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Wyświetlenia i dodania do trasy — 7 dni</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DEMO_CHART} barSize={16} barGap={4}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 11 }}
                    cursor={{ fill: "rgba(249,102,43,0.06)" }}
                  />
                  <Bar dataKey="views" name="Wyświetlenia" fill="#fed7aa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="routes" name="Dodania do trasy" fill="#F9662B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Eye className="h-4 w-4" />} label="Łączne wyświetlenia" value={DEMO_STATS.views} />
              <StatCard icon={<MapPin className="h-4 w-4" />} label="Dodania do trasy" value={DEMO_STATS.onRoutes} />
              <StatCard icon={<MousePointerClick className="h-4 w-4" />} label="Kliknięcia w stronę" value={DEMO_STATS.websiteClicks} />
              <StatCard icon={<Phone className="h-4 w-4" />} label="Kliknięcia w telefon" value={DEMO_STATS.phoneClicks} />
            </div>
          </div>
        )}

        {tab === "gallery" && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {DEMO_GALLERY.map((g, i) => (
                <div key={i} className={`rounded-2xl bg-gradient-to-br ${g} aspect-video`} />
              ))}
            </div>
            <LockedTab icon={<Images className="h-6 w-6" />} label="Zarządzaj galerią zdjęć" />
          </div>
        )}

        {tab === "profile" && (
          <LockedTab icon={<Store className="h-6 w-6" />} label="Edytuj profil lokalu" />
        )}

        {tab === "posts" && (
          <LockedTab icon={<Megaphone className="h-6 w-6" />} label="Dodawaj promocje i aktualności" />
        )}
      </div>

      {/* Bottom CTA */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-sm text-[#0E0E0E]">Podoba Ci się?</p>
          <p className="text-xs text-slate-400">Rejestracja zajmuje 2 minuty</p>
        </div>
        <button
          onClick={() => navigate("/dla-firm")}
          className="flex items-center gap-2 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl px-5 py-3 text-sm shadow-lg shadow-orange-200 active:scale-95 transition-transform whitespace-nowrap"
        >
          Zarejestruj lokal <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
