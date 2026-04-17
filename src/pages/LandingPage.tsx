import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Users, Heart, ArrowRight, Zap, Star, Check } from "lucide-react";

// ─── Scroll-trigger hook ───────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Step 1 animation: city drum picker ───────────────────────────────────────

function CityAnim() {
  const CITIES = ["Kraków", "Gdańsk", "Warszawa", "Wrocław", "Zakopane", "Poznań"];
  const [idx, setIdx] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setIdx(i => (i + 1) % CITIES.length);
        setExiting(false);
      }, 220);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 w-52 mx-auto border border-border/20">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-center mb-3">
        Wybierz miasto
      </p>
      <div className="h-10 flex items-center justify-center overflow-hidden">
        <p
          className="text-2xl font-black text-foreground transition-all duration-220"
          style={{
            transform: exiting ? "translateY(-12px)" : "translateY(0)",
            opacity: exiting ? 0 : 1,
          }}
        >
          {CITIES[idx]}
        </p>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B]" />
      <div className="mt-3 flex justify-center gap-1">
        {CITIES.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 16 : 4,
              background: i === idx ? "#ea580c" : "#e5e7eb",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 2 animation: swipe cards ────────────────────────────────────────────

const PLACES = [
  { name: "Wawel", emoji: "🏰", cat: "Zabytek" },
  { name: "Kazimierz", emoji: "🍷", cat: "Dzielnica" },
  { name: "MOCAK", emoji: "🖼️", cat: "Muzeum" },
  { name: "Planty", emoji: "🌳", cat: "Park" },
  { name: "Nolio", emoji: "🍕", cat: "Restauracja" },
];

function SwipeAnim() {
  const [cardIdx, setCardIdx] = useState(0);
  const [action, setAction] = useState<"like" | "skip" | null>(null);

  useEffect(() => {
    const cycle = () => {
      const isLike = Math.random() > 0.25;
      setAction(isLike ? "like" : "skip");
      setTimeout(() => {
        setAction(null);
        setCardIdx(i => (i + 1) % PLACES.length);
      }, 650);
    };
    const t = setInterval(cycle, 2200);
    return () => clearInterval(t);
  }, []);

  const place = PLACES[cardIdx];
  const nextPlace = PLACES[(cardIdx + 1) % PLACES.length];

  return (
    <div className="relative w-52 h-36 mx-auto">
      {/* Back card */}
      <div className="absolute inset-x-2 inset-y-3 bg-white rounded-2xl shadow-md opacity-60 scale-95" />
      {/* Main card */}
      <div
        className="absolute inset-0 bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden transition-all duration-500"
        style={{
          transform: action === "like"
            ? "translateX(60px) rotate(8deg)"
            : action === "skip"
            ? "translateX(-60px) rotate(-8deg)"
            : "translateX(0) rotate(0deg)",
          opacity: action ? 0 : 1,
        }}
      >
        <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center text-4xl">
          {place.emoji}
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground">{place.name}</p>
            <p className="text-[10px] text-muted-foreground">{place.cat}</p>
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-7 rounded-full border-2 border-red-200 flex items-center justify-center">
              <span className="text-sm">✕</span>
            </div>
            <div className="h-7 w-7 rounded-full border-2 border-green-200 flex items-center justify-center">
              <Heart className="h-3.5 w-3.5 text-green-500" />
            </div>
          </div>
        </div>
      </div>
      {/* Like/skip indicator */}
      {action === "like" && (
        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full rotate-[-12deg] animate-in zoom-in duration-150">
          LUBIĘ ❤
        </div>
      )}
      {action === "skip" && (
        <div className="absolute top-2 right-2 bg-slate-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full rotate-[12deg] animate-in zoom-in duration-150">
          SKIP ✕
        </div>
      )}
    </div>
  );
}

// ─── Step 3 animation: route pins dropping ────────────────────────────────────

const ROUTE_PINS = [
  { x: 38, y: 72, label: "1" },
  { x: 88, y: 40, label: "2" },
  { x: 140, y: 60, label: "3" },
  { x: 172, y: 28, label: "4" },
];

function RouteAnim() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const advance = (n: number) => {
      if (n > ROUTE_PINS.length) {
        setTimeout(() => setVisible(0), 1200);
        setTimeout(() => advance(1), 2000);
        return;
      }
      setVisible(n);
      setTimeout(() => advance(n + 1), 480);
    };
    const t = setTimeout(() => advance(1), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-52 h-36 mx-auto bg-white rounded-2xl shadow-xl overflow-hidden relative border border-border/10">
      {/* Faux map background */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(#cbd5e1 1px, transparent 1px),
            linear-gradient(90deg, #cbd5e1 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute bottom-4 left-4 right-4 h-2 rounded bg-slate-200/60" />
      <div className="absolute top-8 left-8 right-16 h-1.5 rounded bg-slate-200/60" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 208 144" fill="none">
        {/* Connecting lines */}
        {ROUTE_PINS.slice(1).map((pin, i) => (
          <line
            key={i}
            x1={ROUTE_PINS[i].x} y1={ROUTE_PINS[i].y}
            x2={pin.x} y2={pin.y}
            stroke="#ea580c"
            strokeWidth="2"
            strokeDasharray="5 3"
            opacity={visible > i + 1 ? 0.7 : 0}
            style={{ transition: "opacity 0.3s ease" }}
          />
        ))}
        {/* Pins */}
        {ROUTE_PINS.map((pin, i) => (
          <g
            key={i}
            style={{
              transform: visible > i ? "translateY(0) scale(1)" : "translateY(-20px) scale(0.5)",
              transformOrigin: `${pin.x}px ${pin.y}px`,
              opacity: visible > i ? 1 : 0,
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
            }}
          >
            <circle cx={pin.x} cy={pin.y} r="10" fill="#ea580c" />
            <text
              x={pin.x} y={pin.y + 4}
              textAnchor="middle"
              fill="white"
              fontSize="9"
              fontWeight="bold"
            >
              {pin.label}
            </text>
          </g>
        ))}
      </svg>
      {/* "Gotowe!" badge */}
      <div
        className="absolute bottom-3 right-3 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1"
        style={{
          opacity: visible >= ROUTE_PINS.length ? 1 : 0,
          transform: visible >= ROUTE_PINS.length ? "scale(1)" : "scale(0.6)",
          transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <Check className="h-3 w-3" /> Gotowe!
      </div>
    </div>
  );
}

// ─── Email capture form ────────────────────────────────────────────────────────

function EmailCapture({ size = "default" }: { size?: "default" | "large" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;
    setStatus("loading");
    const { error } = await (supabase as any).from("waitlist").insert({ email: email.trim().toLowerCase() });
    if (error && error.code !== "23505") { // 23505 = unique violation (already signed up)
      setStatus("error");
      return;
    }
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 justify-center px-6 py-4 rounded-2xl bg-orange-50 border border-orange-200 max-w-sm mx-auto">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Dzięki! Niedługo wyślemy Ci dostęp na maila 🧡
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="twoj@email.pl"
        className={`flex-1 rounded-2xl border border-border/50 bg-white px-4 outline-none focus:ring-2 focus:ring-orange-300 text-foreground placeholder:text-muted-foreground ${size === "large" ? "py-4 text-base" : "py-3 text-sm"}`}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={`rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold whitespace-nowrap active:scale-95 transition-transform shadow-lg shadow-orange-200 ${size === "large" ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"}`}
      >
        {status === "loading" ? "..." : "Dołącz do listy →"}
      </button>
    </form>
  );
}

// ─── Landing page ──────────────────────────────────────────────────────────────

const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const howItWorks = useInView();
  const forWhom = useInView();
  const founders = useInView();
  const testimonials = useInView();
  const ctaSection = useInView();

  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const STEPS = [
    {
      num: "01",
      title: "Wybierz miasto i datę",
      desc: "Kraków, Gdańsk, Warszawa — wybierz gdzie i kiedy. Reszta sama się ułoży.",
      anim: <CityAnim />,
    },
    {
      num: "02",
      title: "Przeglądajcie miejsca razem",
      desc: "Każdy z grupy klika co go kręci. Restauracje, muzea, bary — bez kompromisów w messengerze.",
      anim: <SwipeAnim />,
    },
    {
      num: "03",
      title: "Trasa gotowa w minutę",
      desc: "Na podstawie wspólnych wyborów Trasa układa gotowy plan — z kolejnością, mapą i godzinami.",
      anim: <RouteAnim />,
    },
  ];

  const FOR_WHOM = [
    {
      icon: <Users className="h-6 w-6 text-orange-600" />,
      title: "Grupy przyjaciół",
      desc: "Każdy chce coś innego? Trasa pogodzi wszystkich bez godzin negocjacji.",
    },
    {
      icon: <Heart className="h-6 w-6 text-orange-600" />,
      title: "Pary",
      desc: "Weekendowy wypad we dwoje — znajdźcie miejsca które kręcą was oboje.",
    },
    {
      icon: <Zap className="h-6 w-6 text-orange-600" />,
      title: "Spontaniczne wypady",
      desc: "Piątek wieczór, sobota wolna. Za 5 minut macie plan na cały dzień.",
    },
  ];

  const TESTIMONIALS = [
    {
      text: "Planowaliśmy wyjazd do Krakowa w 6 osób — każdy chciał co innego. Trasa pogodzi nas w 10 minut. Dosłownie.",
      author: "Marta, 28",
      city: "Warszawa",
    },
    {
      text: "Wreszcie aplikacja która nie wymaga 3 godzin planowania. Wybraliśmy miejsca razem z partnerem i pojechaliśmy.",
      author: "Kasia, 31",
      city: "Wrocław",
    },
    {
      text: "Używałam do weekendu w Gdańsku — trasa ułożona lepiej niż cokolwiek co sama bym wymyśliła.",
      author: "Ania, 24",
      city: "Poznań",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FEFEFE] font-sans overflow-x-hidden">

      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-50 bg-[#FEFEFE]/90 backdrop-blur-md border-b border-border/20">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-base text-foreground tracking-tight">trasa</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Zaloguj się
            </button>
            <button
              onClick={() => document.getElementById("waitlist-hero")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-bold px-4 py-2 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white shadow-sm active:scale-95 transition-transform"
            >
              Dołącz →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold mb-8">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
          Early access — dołącz do listy
        </div>

        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground leading-[1.05] mb-6"
          style={{ fontFamily: "'Baloo 2', 'Inter', sans-serif" }}
        >
          Speed dating<br />
          <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">
            z miastem.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
          Planujecie trip w grupie? Każdy klika co go kręci — Trasa układa gotową trasę.
          Zero messengerów, zero kompromisów na wyczerpanie.
        </p>

        <div id="waitlist-hero">
          <EmailCapture size="large" />
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Bez kart kredytowych · Piszemy gdy jesteś gotowy/a
        </p>

        {/* Hero visual — phone mockup */}
        <div className="mt-16 relative flex justify-center">
          <div className="relative w-64 h-[480px]">
            {/* Phone shell */}
            <div className="absolute inset-0 rounded-[3rem] bg-foreground shadow-2xl shadow-black/30" />
            <div className="absolute inset-[3px] rounded-[2.8rem] bg-white overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-7 bg-foreground rounded-b-2xl z-10" />
              {/* App screen */}
              <div className="absolute inset-0 bg-[#FEFEFE] flex flex-col pt-8">
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
                  <span className="font-black text-sm">trasa</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-bold">Kraków · 14 Jun</span>
                </div>
                {/* Swipe card */}
                <div className="mx-3 flex-1 bg-gradient-to-b from-amber-100 to-orange-200 rounded-2xl flex flex-col justify-end overflow-hidden shadow-inner">
                  <div className="text-center text-5xl py-8">🏰</div>
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-3">
                    <p className="text-white font-bold text-sm">Zamek Królewski na Wawelu</p>
                    <p className="text-white/70 text-[10px]">Zabytek · Kraków</p>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex justify-center gap-5 py-4">
                  <div className="h-12 w-12 rounded-full bg-white border-2 border-slate-200 shadow flex items-center justify-center text-lg">✕</div>
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] shadow-lg flex items-center justify-center">
                    <Heart className="h-6 w-6 text-white fill-white" />
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white border-2 border-slate-200 shadow flex items-center justify-center text-lg">⭐</div>
                </div>
              </div>
            </div>
          </div>
          {/* Floating reaction badges */}
          <div className="absolute left-[calc(50%-160px)] top-24 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 animate-bounce" style={{ animationDuration: "3s" }}>
            <span className="text-base">❤️</span>
            <p className="text-xs font-bold">Marta lubi to!</p>
          </div>
          <div className="absolute right-[calc(50%-160px)] top-48 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2" style={{ animation: "bounce 3s 1.5s infinite" }}>
            <span className="text-base">⭐</span>
            <p className="text-xs font-bold">Piotr: must-see</p>
          </div>
        </div>
      </section>

      {/* ── Jak to działa ── */}
      <section className="bg-slate-50 py-20 px-5" ref={howItWorks.ref}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest text-center mb-3">Jak to działa</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center text-foreground mb-14">
            Od pomysłu do trasy<br />w 3 krokach
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center gap-5 transition-all duration-700"
                style={{
                  opacity: howItWorks.inView ? 1 : 0,
                  transform: howItWorks.inView ? "translateY(0)" : "translateY(32px)",
                  transitionDelay: `${i * 150}ms`,
                }}
              >
                <div className="w-full">{step.anim}</div>
                <div>
                  <p className="text-[11px] font-black text-orange-400 mb-1 tracking-widest">{step.num}</p>
                  <h3 className="text-lg font-black text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dla kogo ── */}
      <section className="py-20 px-5" ref={forWhom.ref}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest text-center mb-3">Dla kogo</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center text-foreground mb-12">
            Trasa działa dla każdego tripu
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FOR_WHOM.map((item, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 p-6 rounded-3xl bg-card border border-border/40 shadow-sm transition-all duration-700"
                style={{
                  opacity: forWhom.inView ? 1 : 0,
                  transform: forWhom.inView ? "translateY(0)" : "translateY(24px)",
                  transitionDelay: `${i * 120}ms`,
                }}
              >
                <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founders ── */}
      <section className="bg-slate-50 py-20 px-5" ref={founders.ref}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest text-center mb-3">O twórcach</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center text-foreground mb-12">
            Cześć, jesteśmy Bart i Nat
          </h2>

          <div
            className="flex flex-col sm:flex-row gap-8 items-center sm:items-start transition-all duration-700"
            style={{
              opacity: founders.inView ? 1 : 0,
              transform: founders.inView ? "translateY(0)" : "translateY(24px)",
            }}
          >
            {/* Avatars */}
            <div className="flex gap-4 shrink-0">
              {[{ initials: "B", name: "Bart" }, { initials: "N", name: "Nat" }].map(p => (
                <div key={p.name} className="flex flex-col items-center gap-2">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shadow-lg">
                    <span className="text-white font-black text-2xl">{p.initials}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground">{p.name}</p>
                </div>
              ))}
            </div>

            {/* Text */}
            <div className="text-center sm:text-left">
              <p className="text-base text-foreground leading-relaxed mb-4">
                Jesteśmy małżeństwem, które uwielbia podróżować i robić krótkie wypady po Polsce i Europie.
                Razem stworzyliśmy Trasę — Nat odpowiada za produkt i techniczny aspekt, a Bart stoi za wizją,
                strategią i marketingiem.
              </p>
              <p className="text-base text-foreground leading-relaxed">
                Rozumiemy, że czasami ciężko jest ustalić co chcecie robić podczas szybkiego tripu — więc
                <span className="font-bold text-orange-600"> Trasa pomaga, aby wyjazd wyszedł poza messengera!</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 px-5" ref={testimonials.ref}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest text-center mb-3">Opinie</p>
          <h2 className="text-3xl sm:text-4xl font-black text-center text-foreground mb-12">
            Co mówią pierwsi użytkownicy
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 p-6 rounded-3xl bg-card border border-border/40 shadow-sm transition-all duration-700"
                style={{
                  opacity: testimonials.inView ? 1 : 0,
                  transform: testimonials.inView ? "translateY(0)" : "translateY(24px)",
                  transitionDelay: `${i * 120}ms`,
                }}
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">
                  "{t.text}"
                </p>
                <div>
                  <p className="text-sm font-bold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA końcowe ── */}
      <section
        className="py-24 px-5 text-center"
        ref={ctaSection.ref}
        style={{ background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fff7ed 100%)" }}
      >
        <div
          className="max-w-xl mx-auto transition-all duration-700"
          style={{
            opacity: ctaSection.inView ? 1 : 0,
            transform: ctaSection.inView ? "translateY(0)" : "translateY(24px)",
          }}
        >
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full shadow-xl" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-4">
            Zacznij planować inaczej
          </h2>
          <p className="text-base text-muted-foreground mb-8">
            Dołącz do listy i bądź pierwszą osobą która wypróbuje Trasę.
          </p>
          <EmailCapture size="large" />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-foreground text-background py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-white">trasa.travel</span>
          </div>
          <p className="text-xs text-white/50 text-center">
            © {new Date().getFullYear()} Trasa · Stworzone z ❤ w Polsce
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/terms")}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Regulamin
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-xs font-bold text-white hover:text-orange-300 transition-colors"
            >
              Zaloguj się →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
