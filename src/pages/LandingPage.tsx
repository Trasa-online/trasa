import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Users, Heart, Zap, Check } from "lucide-react";

// ─── Scroll reveal hook (threshold=0 → fires on first pixel) ─────────────────

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
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-5 w-52 mx-auto">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">
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
  { name: "Wawel", emoji: "🏰", cat: "Zabytek" },
  { name: "Kazimierz", emoji: "🍷", cat: "Dzielnica" },
  { name: "MOCAK", emoji: "🖼️", cat: "Muzeum" },
  { name: "Planty", emoji: "🌳", cat: "Park" },
  { name: "Nolio", emoji: "🍕", cat: "Restauracja" },
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
  return (
    <div className="relative w-52 h-40 mx-auto">
      <div className="absolute inset-x-3 inset-y-3 bg-white rounded-2xl shadow-sm border border-slate-100 opacity-50 scale-95" />
      <div
        className="absolute inset-0 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden"
        style={{
          transition: "transform 0.5s ease, opacity 0.5s ease",
          transform: action === "like" ? "translateX(56px) rotate(7deg)" : action === "skip" ? "translateX(-56px) rotate(-7deg)" : "none",
          opacity: action ? 0 : 1,
        }}
      >
        <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-4xl">
          {p.emoji}
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">{p.name}</p>
            <p className="text-[10px] text-muted-foreground">{p.cat}</p>
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-7 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs text-muted-foreground">✕</div>
            <div className="h-7 w-7 rounded-full border-2 border-emerald-200 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>
      {action === "like" && (
        <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full -rotate-12 animate-in zoom-in duration-150 shadow">
          LUBIĘ ❤
        </div>
      )}
      {action === "skip" && (
        <div className="absolute top-2 right-2 bg-slate-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full rotate-12 animate-in zoom-in duration-150 shadow">
          SKIP ✕
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
    <div className="w-52 h-40 mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
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
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200 max-w-sm mx-auto">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0">
        <Check className="h-4 w-4 text-white" />
      </div>
      <p className="text-sm font-semibold text-foreground">Dzięki! Niedługo wyślemy Ci dostęp na maila 🧡</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm mx-auto">
      <input
        type="email" required value={email} onChange={e => setEmail(e.target.value)}
        placeholder="twoj@email.pl"
        className={`flex-1 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:ring-2 focus:ring-orange-300 text-foreground placeholder:text-muted-foreground ${large ? "py-4 text-base" : "py-3 text-sm"}`}
      />
      <button
        type="submit" disabled={status === "loading"}
        className={`rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold whitespace-nowrap active:scale-95 transition-transform shadow-md shadow-orange-200 ${large ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"}`}
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

// ─── Landing page ──────────────────────────────────────────────────────────────

const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const STEPS = [
    { num: "01", title: "Wybierz miasto i datę", desc: "Kraków, Gdańsk, Warszawa — wybierz gdzie i kiedy. Reszta sama się ułoży.", anim: <CityAnim /> },
    { num: "02", title: "Przeglądajcie miejsca razem", desc: "Każdy z grupy klika co go kręci. Restauracje, muzea, bary — bez kompromisów w messengerze.", anim: <SwipeAnim /> },
    { num: "03", title: "Trasa gotowa w minutę", desc: "Na podstawie wspólnych wyborów Trasa układa gotowy plan z kolejnością, mapą i godzinami.", anim: <RouteAnim /> },
  ];

  const FOR_WHOM = [
    { icon: <Users className="h-6 w-6 text-orange-600" />, title: "Grupy przyjaciół", desc: "Każdy chce coś innego? Trasa pogodzi wszystkich bez godzin negocjacji." },
    { icon: <Heart className="h-6 w-6 text-orange-600" />, title: "Pary", desc: "Weekendowy wypad we dwoje — znajdźcie miejsca które kręcą was oboje." },
    { icon: <Zap className="h-6 w-6 text-orange-600" />, title: "Spontaniczne wypady", desc: "Piątek wieczór, sobota wolna. Za 5 minut macie plan na cały dzień." },
  ];


  return (
    <div className="min-h-screen bg-[#FEFEFE] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#FEFEFE]/90 backdrop-blur-md border-b border-border/20">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-base tracking-tight">trasa</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/auth")} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Zaloguj się
            </button>
            <button
              onClick={() => document.getElementById("cta-hero")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-bold px-4 py-2 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white shadow-sm active:scale-95 transition-transform"
            >
              Dołącz →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold mb-8">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
          Early access — dołącz do listy oczekujących
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground leading-[1.05] mb-6" style={{ fontFamily: "'Baloo 2', 'Inter', sans-serif" }}>
          Speed dating<br />
          <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">z&nbsp;miastem.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
          Planujecie trip w grupie? Każdy klika co go kręci — Trasa układa gotową trasę.
          Zero messengerów, zero kompromisów na wyczerpanie.
        </p>
        <div id="cta-hero">
          <EmailCapture large />
        </div>
        <p className="text-xs text-muted-foreground mt-4">Bez kart kredytowych · Piszemy gdy będziemy gotowi</p>

        {/* Phone mockup */}
        <div className="mt-16 relative flex justify-center select-none">
          <div className="relative w-60 h-[460px]">
            <div className="absolute inset-0 rounded-[3rem] bg-foreground shadow-2xl shadow-black/25" />
            <div className="absolute inset-[3px] rounded-[2.8rem] bg-white overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-foreground rounded-b-2xl z-10" />
              <div className="absolute inset-0 flex flex-col pt-7">
                <div className="px-4 py-2 flex items-center gap-2 shrink-0">
                  <div className="h-5 w-5 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
                  <span className="font-black text-sm">trasa</span>
                  <span className="ml-auto text-[9px] text-muted-foreground font-semibold">Kraków · 14 cze</span>
                </div>
                <div className="mx-3 flex-1 bg-gradient-to-b from-amber-100 to-orange-200 rounded-2xl flex flex-col justify-end overflow-hidden">
                  <div className="text-center text-5xl py-6">🏰</div>
                  <div className="bg-black/40 px-3 py-2.5">
                    <p className="text-white font-bold text-xs">Zamek na Wawelu</p>
                    <p className="text-white/60 text-[9px]">Zabytek · Kraków</p>
                  </div>
                </div>
                <div className="flex justify-center gap-5 py-3 shrink-0">
                  <div className="h-11 w-11 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-base">✕</div>
                  <div className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-orange-300/50" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}>
                    <Heart className="h-6 w-6 text-white fill-white" />
                  </div>
                  <div className="h-11 w-11 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-base">⭐</div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute left-[calc(50%-148px)] top-20 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-1.5 animate-bounce" style={{ animationDuration: "3s" }}>
            <span>❤️</span><p className="text-xs font-bold">Marta lubi to!</p>
          </div>
          <div className="absolute right-[calc(50%-148px)] top-44 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-1.5" style={{ animation: "bounce 3s 1.5s infinite" }}>
            <span>⭐</span><p className="text-xs font-bold">Piotr: must-see</p>
          </div>
        </div>
      </section>

      {/* ── Jak to działa ── */}
      <section className="bg-slate-50 py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Jak to działa</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">Od pomysłu do trasy w 3 krokach</h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <FadeIn key={i} delay={i * 120} className="flex flex-col items-center text-center gap-5">
                <div className="w-full">{step.anim}</div>
                <div>
                  <p className="text-[10px] font-black text-orange-400 tracking-widest mb-1">{step.num}</p>
                  <h3 className="text-lg font-black text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dla kogo ── */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Dla kogo</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">Trasa działa dla każdego tripu</h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FOR_WHOM.map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="flex flex-col gap-4 p-6 rounded-3xl bg-card border border-border/40 shadow-sm h-full">
                  <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center">{item.icon}</div>
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
      <section className="bg-slate-50 py-20 px-5">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">O twórcach</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">Cześć, jesteśmy Bart i Nat</h2>
          </FadeIn>
          <FadeIn>
            <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start bg-white rounded-3xl p-8 shadow-sm border border-border/30">
              <div className="shrink-0">
                <img
                  src="/founders.jpg"
                  alt="Bart i Nat — twórcy Trasy"
                  className="w-48 h-64 object-cover rounded-2xl shadow-md"
                  style={{ objectPosition: "center top" }}
                />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-base text-foreground leading-relaxed mb-3">
                  Jesteśmy małżeństwem, które uwielbia podróżować i robić krótkie wypady po Polsce i Europie.
                  Razem stworzyliśmy Trasę — Nat odpowiada za produkt i techniczny aspekt, a Bart stoi za wizją, strategią i marketingiem.
                </p>
                <p className="text-base text-foreground leading-relaxed">
                  Rozumiemy, że czasami ciężko jest ustalić co chcecie robić podczas szybkiego tripu —
                  dlatego <span className="font-bold text-orange-600">Trasa pomaga, żeby wyjazd wyszedł poza messengera!</span>
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>


      {/* ── CTA końcowe ── */}
      <section className="py-24 px-5 text-center" style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 60%, #fff7ed 100%)" }}>
        <FadeIn className="max-w-xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full shadow-xl" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-4">Zacznij planować inaczej</h2>
          <p className="text-base text-muted-foreground mb-8">Dołącz do listy i bądź pierwszą osobą która wypróbuje Trasę.</p>
          <EmailCapture large />
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
            <button onClick={() => navigate("/terms")} className="text-xs text-white/50 hover:text-white/80 transition-colors">Regulamin</button>
            <button onClick={() => navigate("/auth")} className="text-xs font-bold text-white hover:text-orange-300 transition-colors">Zaloguj się →</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
