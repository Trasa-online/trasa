import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Users, Heart, Zap, Check, Castle, GlassWater, Palette, TreePine, Pizza, Star, MapPin, Menu, X, Sparkles, User } from "lucide-react";
import TrialModal from "@/components/trial/TrialModal";

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Step 1: animated city drum picker ───────────────────────────────────────

const CITIES = ["Kraków", "Gdańsk", "Warszawa", "Wrocław", "Zakopane", "Poznań"];

function CityAnim() {
  const [idx, setIdx] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setOut(true);
      setTimeout(() => { setIdx(i => (i + 1) % CITIES.length); setOut(false); }, 230);
    }, 1900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-orange-100/60 border border-slate-100 p-5 w-52 mx-auto">
      <p className="text-[10px] font-semibold text-muted-foreground text-center mb-3 tracking-wide">
        Wybierz miasto
      </p>
      <div className="h-10 overflow-hidden flex items-center justify-center">
        <p
          className="text-2xl font-black text-foreground"
          style={{
            transition: "transform 0.22s ease, opacity 0.22s ease",
            transform: out ? "translateY(-14px)" : "translateY(0)",
            opacity: out ? 0 : 1,
          }}
        >
          {CITIES[idx]}
        </p>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B]" />
      <div className="mt-2.5 flex justify-center gap-1">
        {CITIES.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: i === idx ? 14 : 4, background: i === idx ? "#ea580c" : "#e5e7eb" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: swiping place cards ─────────────────────────────────────────────

const PLACES = [
  { name: "Wawel", Icon: Castle, cat: "Zabytek", color: "from-amber-50 to-orange-100" },
  { name: "Kazimierz", Icon: GlassWater, cat: "Dzielnica", color: "from-violet-50 to-purple-100" },
  { name: "MOCAK", Icon: Palette, cat: "Muzeum", color: "from-sky-50 to-blue-100" },
  { name: "Planty", Icon: TreePine, cat: "Park", color: "from-green-50 to-emerald-100" },
  { name: "Nolio", Icon: Pizza, cat: "Restauracja", color: "from-red-50 to-rose-100" },
];

function SwipeAnim() {
  const [idx, setIdx] = useState(0);
  const [action, setAction] = useState<"like" | "skip" | null>(null);
  useEffect(() => {
    const tick = () => {
      setAction(Math.random() > 0.3 ? "like" : "skip");
      setTimeout(() => { setAction(null); setIdx(i => (i + 1) % PLACES.length); }, 700);
    };
    const t = setInterval(tick, 2400);
    return () => clearInterval(t);
  }, []);
  const p = PLACES[idx];
  const PlaceIcon = p.Icon;
  return (
    <div className="relative w-52 h-40 mx-auto">
      <div className="absolute inset-x-3 inset-y-3 bg-white rounded-2xl shadow-sm border border-slate-100 opacity-50 scale-95" />
      <div
        className="absolute inset-0 bg-white rounded-2xl shadow-lg shadow-orange-100/50 border border-slate-100 flex flex-col overflow-hidden"
        style={{
          transition: "transform 0.5s ease, opacity 0.5s ease",
          transform: action === "like" ? "translateX(56px) rotate(7deg)" : action === "skip" ? "translateX(-56px) rotate(-7deg)" : "none",
          opacity: action ? 0 : 1,
        }}
      >
        <div className={`flex-1 bg-gradient-to-br ${p.color} flex items-center justify-center`}>
          <PlaceIcon className="h-9 w-9 text-orange-500/70" strokeWidth={1.5} />
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">{p.name}</p>
            <p className="text-[10px] text-muted-foreground">{p.cat}</p>
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-7 rounded-full border-2 border-slate-200 flex items-center justify-center text-muted-foreground">
              <span className="text-[10px] font-bold">✕</span>
            </div>
            <div className="h-7 w-7 rounded-full border-2 border-emerald-200 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>
      {action === "like" && (
        <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full -rotate-12 animate-in zoom-in duration-150 shadow flex items-center gap-1">
          LUBIĘ <Heart className="h-2.5 w-2.5 fill-white" />
        </div>
      )}
      {action === "skip" && (
        <div className="absolute top-2 right-2 bg-slate-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full rotate-12 animate-in zoom-in duration-150 shadow">
          POMIŃ
        </div>
      )}
    </div>
  );
}

// ─── Step 3: route pins dropping one by one ───────────────────────────────────

const PINS = [
  { x: 38, y: 70 }, { x: 90, y: 38 }, { x: 142, y: 62 }, { x: 175, y: 28 },
];

function RouteAnim() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const run = () => {
      setN(0);
      PINS.forEach((_, i) => setTimeout(() => setN(i + 1), 400 + i * 500));
      setTimeout(run, 400 + PINS.length * 500 + 1400);
    };
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="w-52 h-40 mx-auto bg-white rounded-2xl shadow-lg shadow-orange-100/50 border border-slate-100 overflow-hidden relative">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="absolute bottom-6 left-5 right-10 h-2 rounded-full bg-slate-100" />
      <div className="absolute top-10 left-10 right-12 h-1.5 rounded-full bg-slate-100" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 208 160" fill="none">
        {PINS.slice(1).map((pin, i) => (
          <line
            key={i}
            x1={PINS[i].x} y1={PINS[i].y}
            x2={pin.x} y2={pin.y}
            stroke="#ea580c" strokeWidth="2.5" strokeDasharray="5 3"
            style={{ opacity: n > i + 1 ? 0.65 : 0, transition: "opacity 0.35s ease" }}
          />
        ))}
        {PINS.map((pin, i) => (
          <g
            key={i}
            style={{
              transformOrigin: `${pin.x}px ${pin.y}px`,
              transform: n > i ? "scale(1) translateY(0)" : "scale(0.3) translateY(-16px)",
              opacity: n > i ? 1 : 0,
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s",
            }}
          >
            <circle cx={pin.x} cy={pin.y} r="11" fill="#ea580c" />
            <text x={pin.x} y={pin.y + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{i + 1}</text>
          </g>
        ))}
      </svg>
      <div
        className="absolute bottom-3 right-3 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow"
        style={{
          opacity: n >= PINS.length ? 1 : 0,
          transform: n >= PINS.length ? "scale(1)" : "scale(0.5)",
          transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <Check className="h-3 w-3" /> Gotowe!
      </div>
    </div>
  );
}

// ─── Email capture ─────────────────────────────────────────────────────────────

function EmailCapture({ large = false }: { large?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status !== "idle") return;
    setStatus("loading");
    await (supabase as any).from("waitlist").insert({ email: email.trim().toLowerCase() });
    setStatus("done");
  };
  if (status === "done") return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200 max-w-sm mx-auto sm:mx-0">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0">
        <Check className="h-4 w-4 text-white" />
      </div>
      <p className="text-sm font-semibold text-foreground">Dzięki! Niedługo wyślemy Ci dostęp na maila.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm mx-auto sm:mx-0">
      <input
        type="email" required value={email} onChange={e => setEmail(e.target.value)}
        placeholder="twoj@email.pl"
        className={`flex-1 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:ring-2 focus:ring-orange-300 text-foreground placeholder:text-muted-foreground ${large ? "py-4 text-base" : "py-3 text-sm"}`}
      />
      <button
        type="submit" disabled={status === "loading"}
        className={`rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold whitespace-nowrap transition-all shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-200/70 hover:opacity-95 active:scale-[0.98] active:translate-y-px ${large ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"}`}
      >
        {status === "loading" ? "…" : "Dołącz do listy →"}
      </button>
    </form>
  );
}

// ─── Fade wrapper ─────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Phone mockup ─────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 240 }}>
      {/* Phone shell */}
      <div className="relative bg-[#0E0E0E] rounded-[40px] p-2 shadow-2xl" style={{ aspectRatio: "9/19.5" }}>
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        {/* Screen */}
        <div className="w-full h-full bg-[#FEFEFE] rounded-[32px] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-8 pb-2 text-[9px] font-semibold text-foreground shrink-0">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>●●●●</span>
            </div>
          </div>
          {/* App header */}
          <div className="px-4 pb-2 shrink-0">
            <p className="text-[10px] text-muted-foreground">Kraków · dziś</p>
            <p className="text-sm font-bold leading-tight">Wybierz miejsca</p>
          </div>
          {/* Swiper card */}
          <div className="flex-1 px-3 pb-3 flex flex-col gap-2">
            <div className="flex-1 rounded-2xl bg-gradient-to-b from-orange-100 to-orange-50 border border-orange-200/60 flex flex-col justify-between p-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-[8px]">🏛️</span>
                </div>
                <span className="text-[9px] font-semibold text-orange-700">Muzeum</span>
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">MOCAK</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Muzeum Sztuki Współczesnej</p>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              <div className="flex-1 h-7 rounded-full border border-border/50 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Pomiń</span>
              </div>
              <div className="flex-1 h-7 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] flex items-center justify-center">
                <Heart className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification bubbles */}
      <div className="absolute -left-28 top-20 hidden sm:flex bg-white rounded-2xl shadow-lg px-3 py-2 items-center gap-1.5 animate-bounce" style={{ animationDuration: "3s" }}>
        <Heart className="h-3.5 w-3.5 text-red-400 fill-red-400" />
        <p className="text-xs font-bold whitespace-nowrap">Marta lubi to!</p>
      </div>
      <div className="absolute -right-24 top-44 hidden sm:flex bg-white rounded-2xl shadow-lg px-3 py-2 items-center gap-1.5" style={{ animation: "bounce 3s 1.5s infinite" }}>
        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
        <p className="text-xs font-bold whitespace-nowrap">Piotr: must-see</p>
      </div>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col divide-y divide-border/40 border border-border/40 rounded-3xl overflow-hidden bg-white">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors"
          >
            <span className="font-bold text-sm text-foreground">{item.q}</span>
            <span className={`shrink-0 h-5 w-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-slate-400 transition-transform ${open === i ? "rotate-45" : ""}`} style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Landing page ──────────────────────────────────────────────────────────────

const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const STEPS = [
    { num: "01", title: "Wybierz miasto i datę", desc: "Kraków, Gdańsk, Warszawa - wybierz gdzie i kiedy. Reszta sama się ułoży.", anim: <CityAnim /> },
    { num: "02", title: "Przeglądajcie miejsca razem", desc: "Każdy z grupy klika co go kręci. Restauracje, muzea, bary - bez kompromisów w messengerze.", anim: <SwipeAnim /> },
    { num: "03", title: "Trasa gotowa w minutę", desc: "Na podstawie wspólnych wyborów trasa układa gotowy plan z kolejnością, mapą i godzinami.", anim: <RouteAnim /> },
  ];

  const FOR_WHOM = [
    { icon: <Users className="h-7 w-7 text-orange-600" />, title: "Grupy przyjaciół", desc: "Każdy chce coś innego? Trasa pogodzi wszystkich bez godzin negocjacji w grupce." },
    { icon: <Heart className="h-6 w-6 text-orange-600" />, title: "Pary", desc: "Weekendowy wypad we dwoje - znajdźcie miejsca które kręcą was oboje." },
    { icon: <Zap className="h-6 w-6 text-orange-600" />, title: "Spontaniczne wypady", desc: "Piątek wieczór, sobota wolna. Za 5 minut macie plan na cały dzień." },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#FEFEFE] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        {/* Pill bar */}
        <div className="bg-[#1a1a1a] rounded-full px-5 h-14 flex items-center gap-3 shadow-xl">
          {/* Left: logo + section links */}
          <div className="flex items-center gap-4 shrink-0">
            <button onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMenuOpen(false); }} className="flex items-center">
              <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            </button>
            <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="hidden sm:block text-sm text-white/60 hover:text-white/90 transition-colors whitespace-nowrap">
              Jak to działa
            </button>
            <button onClick={() => document.getElementById("for-whom")?.scrollIntoView({ behavior: "smooth" })} className="hidden sm:block text-sm text-white/60 hover:text-white/90 transition-colors whitespace-nowrap">
              Dla kogo
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: badge + zaloguj + dołącz */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="/dla-firm" className="hidden md:flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all border border-blue-500/30 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
              Dla firm
            </a>
            <style>{`
              @keyframes trial-flow {
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .trial-btn {
                background: linear-gradient(135deg, #fbbf7a, #F4A259, #F9662B, #ea580c);
                background-size: 250% 250%;
                animation: trial-flow 2.4s ease infinite;
                box-shadow: 0 0 0 0 rgba(249,102,43,0.5);
              }
              @keyframes trial-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(249,102,43,0.5); }
                50%       { box-shadow: 0 0 0 5px rgba(249,102,43,0); }
              }
              .trial-btn {
                animation: trial-flow 2.4s ease infinite, trial-pulse 2.4s ease infinite;
              }
            `}</style>
            {/* Wypróbuj + Hamburger — mobile only */}
            <button onClick={() => navigate("/home")} className="sm:hidden text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/50 text-orange-400 active:scale-95 transition-all whitespace-nowrap">
              Wypróbuj →
            </button>
            <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              {menuOpen ? <X className="h-4 w-4 text-white" /> : <Menu className="h-4 w-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden mt-2 bg-[#1a1a1a] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex flex-col py-2">
              <button onClick={() => { document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 text-left transition-colors">
                Jak to działa
              </button>
              <button onClick={() => { document.getElementById("for-whom")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 text-left transition-colors">
                Dla kogo
              </button>
              <a href="/dla-firm" className="px-5 py-3 text-sm font-bold text-blue-300 hover:text-blue-200 hover:bg-white/5 flex items-center gap-2 transition-colors">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                Dla firm
              </a>
              <div className="mx-5 my-1 border-t border-white/10" />
              <div className="px-5 pb-3 pt-1">
                <button onClick={() => { navigate("/auth"); setMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border border-white/25 text-white/80 hover:border-white/50 hover:text-white active:scale-95 transition-all">
                  <User className="h-4 w-4" />
                  Zaloguj się
                </button>
              </div>
              <div className="px-5 py-3">
                <button onClick={() => { document.getElementById("cta-hero")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="w-full text-sm font-bold px-4 py-2.5 rounded-full bg-white text-[#1a1a1a] hover:bg-white/90 active:scale-95 transition-all">
                  Dołącz →
                </button>
              </div>
              <div className="px-5 pb-4">
                <button onClick={() => { navigate("/home"); setMenuOpen(false); }} className="w-full text-sm font-semibold px-4 py-2.5 rounded-full border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 active:scale-95 transition-all">
                  Wypróbuj bez konta →
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="min-h-[100dvh] flex items-center">
        <div className="max-w-5xl mx-auto px-5 pt-28 pb-16 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-8 items-center">

            {/* Left: text */}
            <div className="text-center md:text-left">
              <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold mb-8">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                Dołącz do trasy
              </div>
              <h1
                className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground leading-[1.05] mb-6"
                style={{ letterSpacing: "-0.02em", textWrap: "balance" } as React.CSSProperties}
              >
                Speed dating<br />
                <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">z&nbsp;miastem</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-[48ch] mx-auto md:mx-0">
                Wyjazd z grupą kojarzy Ci się ze stresem i wiecznymi kłótniami na messengerze? Z trasą całą organizację macie z głowy.
              </p>
              <div id="cta-hero" className="flex flex-col items-center md:items-start gap-4">
                <button
                  onClick={() => navigate("/auth")}
                  className="rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold px-7 py-4 text-base shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-200/70 hover:opacity-95 active:scale-[0.98] active:translate-y-px transition-all"
                >
                  Dołącz do trasy →
                </button>
                <button
                  onClick={() => navigate("/home")}
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Przejdź do aplikacji bez konta
                </button>
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="flex justify-center md:justify-end mt-8 md:mt-0">
              <div className="relative">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Jak to działa ── */}
      <section id="how-it-works" className="bg-slate-50 py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Jak to działa</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-foreground"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Od pomysłu do trasy w 3 krokach
            </h2>
          </FadeIn>
          <div className="flex flex-col gap-20">
            {STEPS.map((step, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center`}>
                  <div className={`flex justify-center ${i % 2 === 1 ? "md:order-2" : ""}`}>
                    {step.anim}
                  </div>
                  <div className={`${i % 2 === 1 ? "md:order-1" : ""}`}>
                    <p className="text-[10px] font-black text-orange-400 tracking-widest mb-2">{step.num}</p>
                    <h3
                      className="text-2xl font-black text-foreground mb-3"
                      style={{ textWrap: "balance" } as React.CSSProperties}
                    >
                      {step.title}
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed max-w-[40ch]">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dla kogo ── */}
      <section id="for-whom" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Dla kogo</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-foreground"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Trasa działa dla każdego tripu
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Featured card */}
            <FadeIn className="md:row-span-2">
              <div className="flex flex-col gap-5 p-8 rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-[#FEFEFE] border border-orange-100 shadow-sm h-full min-h-[260px] transition-shadow hover:shadow-md hover:shadow-orange-100/60">
                <div className="h-14 w-14 rounded-2xl bg-white/80 shadow-sm border border-orange-100/50 flex items-center justify-center">
                  {FOR_WHOM[0].icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-xl text-foreground mb-2">{FOR_WHOM[0].title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-[36ch]">{FOR_WHOM[0].desc}</p>
                </div>
              </div>
            </FadeIn>
            {/* Smaller cards */}
            {FOR_WHOM.slice(1).map((item, i) => (
              <FadeIn key={i} delay={(i + 1) * 100}>
                <div className="flex gap-4 p-6 rounded-3xl bg-card border border-border/40 shadow-sm h-full items-start transition-shadow hover:shadow-md hover:shadow-orange-100/40">
                  <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-black text-base text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founders ── */}
      <section className="bg-slate-50 py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">O twórcach</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-foreground"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Cześć, jesteśmy Bart i Nat
            </h2>
          </FadeIn>
          <FadeIn>
            <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start bg-white rounded-3xl p-8 shadow-sm border border-border/30">
              <div className="shrink-0">
                <img
                  src="/founders.jpg"
                  alt="Bart i Nat - twórcy Trasy"
                  className="w-48 h-64 object-cover rounded-2xl shadow-md"
                  style={{ objectPosition: "center top" }}
                />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-base text-foreground leading-relaxed mb-3">
                  Jesteśmy małżeństwem, które uwielbia podróżować i robić krótkie wypady po Polsce i Europie.
                </p>
                <p className="text-base text-foreground leading-relaxed">
                  Rozumiemy, że czasami ciężko jest ustalić co chcecie robić podczas szybkiego tripu -
                  dlatego <span className="font-bold text-orange-600">Trasa pomaga, żeby wyjazd wyszedł poza messengera.</span>
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-5 bg-slate-50">
        <div className="max-w-2xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
              Najczęściej zadawane pytania
            </h2>
          </FadeIn>
          <FadeIn>
            <FaqAccordion items={[
              {
                q: "Czy trasa jest darmowa?",
                a: "Tak, konto jest darmowe. Podstawowe planowanie - solo i w grupie - zawsze będzie bezpłatne. Płatne funkcje mogą pojawić się w przyszłości, ale z wyprzedzeniem damy Ci znać.",
              },
              {
                q: "W jakich miastach działa trasa?",
                a: "Aktualnie wspieramy Kraków, Gdańsk (Trójmiasto), Warszawę, Wrocław, Poznań i Zakopane. Sukcesywnie dodajemy nowe miasta - jeśli nie widzisz swojego, daj nam znać!",
              },
              {
                q: "Czy mogę planować solo, bez grupy?",
                a: "Tak! trasa działa świetnie zarówno solo jak i w grupie. Przeglądaj miejsca samodzielnie i buduj własny plan dnia we własnym tempie.",
              },
              {
                q: "Kiedy aplikacja będzie dostępna?",
                a: "Jesteśmy w fazie early access. Dołącz do listy oczekujących - napiszemy do Ciebie gdy będziemy gotowi na kolejną rundę użytkowników.",
              },
              {
                q: "Jak wygląda planowanie grupowe w praktyce?",
                a: "Tworzysz sesję i zapraszasz znajomych jednym linkiem. Każdy przegląda miejsca osobno na swoim telefonie. trasa zbiera wasze wybory i pokazuje miejsca które spodobały się wszystkim - na tej podstawie układa gotową trasę.",
              },
            ]} />
          </FadeIn>
        </div>
      </section>

      {/* ── CTA końcowe ── */}
      <section className="py-28 px-5 text-center relative overflow-hidden">
        {/* Gradient background with depth */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, #fff7ed 0%, #fef3c7 40%, #FEFEFE 100%)" }} />
        {/* Subtle grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
        <FadeIn className="max-w-xl mx-auto relative">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full shadow-xl shadow-orange-300/30" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          </div>
          <h2
            className="text-3xl sm:text-4xl font-black text-foreground mb-4"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Następny trip bez chaosu na grupce
          </h2>
          <p className="text-base text-muted-foreground mb-8 max-w-[40ch] mx-auto">Stwórz konto i zaplanuj trasę już dziś.</p>
          <div className="flex justify-center">
            <button
              onClick={() => navigate("/auth")}
              className="rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold px-9 py-4 text-base shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-200/70 hover:opacity-95 active:scale-[0.98] active:translate-y-px transition-all"
            >
              Dołączam! →
            </button>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-foreground py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-white">trasa.travel</span>
          </div>
          <p className="text-xs text-white/40 text-center">© {new Date().getFullYear()} Trasa · Stworzone z ❤ w Polsce</p>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/trasa.travel" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              @trasa.travel
            </a>
            <button onClick={() => navigate("/terms")} className="text-xs text-white/50 hover:text-white/80 transition-colors">Regulamin</button>
            <button onClick={() => navigate("/auth")} className="text-xs font-bold text-white hover:text-orange-300 transition-colors">Zaloguj się →</button>
          </div>
        </div>
      </footer>

      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </div>
  );
};

export default LandingPage;
