import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Check, Menu, X, User, Compass } from "lucide-react";
import TrialModal from "@/components/trial/TrialModal";
import posthog from "posthog-js";

// Store product URLs — uzupelnic po publikacji w sklepach
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

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

// ─── Logo (znak Trasy) ────────────────────────────────────────────────────────

function Logo({ className = "h-7 w-auto" }: { className?: string }) {
  return <img src="/Icon_Trasa.png" alt="Trasa" className={className} draggable={false} />;
}

// ─── Avatar stack (jak trasy grupowe w appce) ─────────────────────────────────

function AvatarStack() {
  const avatars = [
    { grad: "linear-gradient(135deg,#F4A259,#F9662B)", initials: "M" },
    { grad: "linear-gradient(135deg,#C6BFF4,#5B4FC4)", initials: "K" },
    { grad: "linear-gradient(135deg,#BFE6DE,#0F766E)", initials: "P" },
  ];
  return (
    <div className="flex items-center -space-x-3">
      {avatars.map((a, i) => (
        <div
          key={i}
          className="h-11 w-11 rounded-full border-[3px] border-white flex items-center justify-center text-white text-sm font-bold shadow-sm"
          style={{ background: a.grad, zIndex: avatars.length - i }}
        >
          {a.initials}
        </div>
      ))}
      <div className="h-11 w-11 rounded-full border-[3px] border-white bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm">
        +4
      </div>
    </div>
  );
}

// ─── Store badges (App Store + Google Play) ───────────────────────────────────

function StoreBadges({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 items-center ${center ? "sm:justify-center" : "sm:justify-start"}`}>
      <a
        href={APP_STORE_URL}
        onClick={(e) => { if (APP_STORE_URL === "#") e.preventDefault(); posthog.capture("landing_store_click", { store: "app_store" }); }}
        className="transition-transform hover:scale-[1.03] active:scale-95"
        aria-label="Pobierz z App Store"
      >
        <img src="/Pobierz-z-App-Store.png" alt="Pobierz z App Store" className="h-[54px] w-auto" draggable={false} />
      </a>
      <a
        href={PLAY_STORE_URL}
        onClick={(e) => { if (PLAY_STORE_URL === "#") e.preventDefault(); posthog.capture("landing_store_click", { store: "play_store" }); }}
        className="transition-transform hover:scale-[1.03] active:scale-95"
        aria-label="Pobierz z Google Play"
      >
        <img src="/google-play-badge.png" alt="Pobierz z Google Play" className="h-[54px] w-auto" draggable={false} />
      </a>
    </div>
  );
}

// ─── Phone frame (shell + screen) ─────────────────────────────────────────────

function PhoneFrame({ children, width = 240, className = "" }: { children: React.ReactNode; width?: number; className?: string }) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ width }}>
      <div className="relative bg-[#0E0E0E] rounded-[40px] p-2 shadow-2xl shadow-orange-950/25" style={{ aspectRatio: "9/19.5" }}>
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        {/* Screen */}
        <div className="w-full h-full bg-[#FEFEFE] rounded-[32px] overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// Hero: real app animation (demo.mp4). Status bar z nagrania przyciety gora/dol.
function HeroPhone() {
  return (
    <PhoneFrame width={260}>
      <div className="relative w-full h-full overflow-hidden">
        <video
          src="/demo.mp4"
          poster="/landing/hero-poster.png"
          autoPlay muted loop playsInline preload="metadata"
          className="absolute left-0 w-full object-cover object-top"
          style={{ top: "-5.5%", height: "105.5%" }}
        />
      </div>
    </PhoneFrame>
  );
}

// Krok: prawdziwy screenshot apki w ramce telefonu.
// Ekran ma aspect screenshotu (430:872) - dzieki temu object-cover NIE przycina
// bokow i padding aplikacji zostaje zachowany. Plus wyrazny bezel.
function StepPhone({ src }: { src: string }) {
  return (
    <div className="relative mx-auto" style={{ width: 184 }}>
      <div className="relative bg-[#0E0E0E] rounded-[30px] p-[9px] shadow-2xl shadow-orange-950/25">
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[54px] h-[13px] bg-black rounded-full z-10" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[22px]" style={{ aspectRatio: "430 / 872" }}>
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        </div>
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
    posthog.capture("landing_waitlist_signup", { source: "landing_page" });
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

  const STEPS = [
    { num: "01", title: "Wybierz miasto", desc: "Kraków, Gdańsk, Warszawa i więcej. Zacznij od miejsca, w które się wybierasz.", img: "/landing/step-city.png" },
    { num: "02", title: "Przeglądaj lokalne miejsca", desc: "Kawiarnie, muzea, bary, widoki. Dodawaj to co Cię kręci - sam albo ze znajomymi.", img: "/landing/step-browse.png" },
    { num: "03", title: "Trasa gotowa w minutę", desc: "Trasa układa gotowy plan dnia z kolejnością, mapą i godzinami. Ty tylko ruszasz w miasto.", img: "/landing/step-route.png" },
  ];

  const FOR_WHOM = [
    { icon: <Compass className="h-7 w-7 text-orange-600" />, title: "Solo odkrywanie", desc: "Poznawaj swoje miasto na nowo. Odkrywaj lokalne miejsca we własnym tempie i twórz własne trasy." },
    { avatars: true, title: "Ze znajomymi", desc: "Planujcie wspólnie - każdy dodaje co lubi, a trasa godzi wszystkich w jeden plan." },
    { icon: <Zap className="h-6 w-6 text-orange-600" />, title: "Spontaniczne wypady", desc: "Wolny wieczór? W minutę masz gotowy plan na odkrywanie okolicy." },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F1F1F3] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        {/* Pill bar */}
        <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-full px-5 h-14 flex items-center gap-3 shadow-lg shadow-orange-900/5">
          {/* Left: logo + section links */}
          <div className="flex items-center gap-4 shrink-0">
            <button onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMenuOpen(false); }} className="flex items-center" aria-label="Trasa">
              <Logo className="h-6 w-auto shrink-0" />
            </button>
            <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              Jak to działa
            </button>
            <button onClick={() => document.getElementById("for-whom")?.scrollIntoView({ behavior: "smooth" })} className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
              Dla kogo
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: desktop links + mobile buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <a href="/dla-firm" className="hidden md:flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all border border-blue-200 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              Dla firm
            </a>
            <button
              onClick={() => navigate("/auth")}
              className="hidden sm:flex items-center text-sm font-semibold px-4 py-2 rounded-full border border-black/10 text-foreground/80 hover:border-black/25 hover:text-foreground active:scale-95 transition-all whitespace-nowrap"
            >
              Zaloguj się
            </button>
            {/* Hamburger - mobile only */}
            <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full bg-black/5 hover:bg-black/10 transition-colors" aria-label="Menu">
              {menuOpen ? <X className="h-4 w-4 text-foreground" /> : <Menu className="h-4 w-4 text-foreground" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden mt-2 bg-white border border-black/5 rounded-2xl shadow-lg shadow-orange-900/5 overflow-hidden">
            <div className="flex flex-col py-2">
              <button onClick={() => { document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-foreground/70 hover:text-foreground hover:bg-slate-50 text-left transition-colors">
                Jak to działa
              </button>
              <button onClick={() => { document.getElementById("for-whom")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-foreground/70 hover:text-foreground hover:bg-slate-50 text-left transition-colors">
                Dla kogo
              </button>
              <a href="/dla-firm" className="px-5 py-3 text-sm font-bold text-blue-700 hover:text-blue-800 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                Dla firm
              </a>
              <div className="mx-5 my-1 border-t border-black/5" />
              <div className="px-5 pt-1 pb-2">
                <button onClick={() => { navigate("/auth"); setMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border border-black/10 text-foreground/80 hover:border-black/25 hover:text-foreground active:scale-95 transition-all">
                  <User className="h-4 w-4" />
                  Zaloguj się
                </button>
              </div>
              <div className="px-5 pb-4">
                <button onClick={() => { document.getElementById("cta-hero")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="w-full text-sm font-bold px-4 py-2.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white hover:opacity-95 active:scale-95 transition-all">
                  Pobierz aplikację
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
                Odkrywaj lokalne miejsca
              </div>
              <h1
                className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold text-foreground leading-[1.05] mb-6"
                style={{ letterSpacing: "-0.02em", textWrap: "balance" } as React.CSSProperties}
              >
                Speed dating<br />
                <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">z&nbsp;miastem</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-[48ch] mx-auto md:mx-0">
                Odkrywaj najlepsze miejsca w&nbsp;swoim mieście i&nbsp;układaj trasy zwiedzania - solo albo ze&nbsp;znajomymi. Kawiarnie, muzea, bary, widoki: wszystko w&nbsp;jednej aplikacji.
              </p>
              <div id="cta-hero" className="flex flex-col items-center md:items-start gap-4">
                <StoreBadges />
              </div>
            </div>

            {/* Right: phone mockup (real app animation) */}
            <div className="flex justify-center md:justify-end mt-8 md:mt-0">
              <div className="relative">
                <HeroPhone />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Jak to działa ── */}
      <section id="how-it-works" className="bg-white py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Jak to działa</p>
            <h2
              className="font-display text-3xl sm:text-4xl font-extrabold text-foreground"
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
                    <StepPhone src={step.img} />
                  </div>
                  <div className={`text-center md:text-left ${i % 2 === 1 ? "md:order-1" : ""}`}>
                    <p className="text-[10px] font-black text-orange-400 tracking-widest mb-2">{step.num}</p>
                    <h3
                      className="font-display text-2xl font-extrabold text-foreground mb-3"
                      style={{ textWrap: "balance" } as React.CSSProperties}
                    >
                      {step.title}
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed max-w-[40ch] mx-auto md:mx-0">{step.desc}</p>
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
              className="font-display text-3xl sm:text-4xl font-extrabold text-foreground"
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
                  <h3 className="font-display font-extrabold text-xl text-foreground mb-2">{FOR_WHOM[0].title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-[36ch]">{FOR_WHOM[0].desc}</p>
                </div>
              </div>
            </FadeIn>
            {/* Smaller cards */}
            {FOR_WHOM.slice(1).map((item, i) => (
              <FadeIn key={i} delay={(i + 1) * 100}>
                <div className="flex gap-4 p-6 rounded-3xl bg-card border border-border/40 shadow-sm h-full items-start transition-shadow hover:shadow-md hover:shadow-orange-100/40">
                  {"avatars" in item ? (
                    <div className="shrink-0 pt-0.5"><AvatarStack /></div>
                  ) : (
                    <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                  )}
                  <div>
                    <h3 className="font-display font-extrabold text-base text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founders ── */}
      <section className="bg-white py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">O twórcach</p>
            <h2
              className="font-display text-3xl sm:text-4xl font-extrabold text-foreground"
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
                  Jesteśmy małżeństwem, które uwielbia podróżować i&nbsp;odkrywać nowe miejsca po Polsce i&nbsp;Europie.
                </p>
                <p className="text-base text-foreground leading-relaxed">
                  Zbudowaliśmy Trasę, żeby każdy mógł łatwo odkryć swoje miasto na nowo -
                  <span className="font-bold text-orange-600"> lokalne miejsca, dobre trasy, zero planowania w&nbsp;głowie.</span>
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-5 bg-white">
        <div className="max-w-2xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
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
                q: "Do czego służy trasa?",
                a: "Trasa pomaga odkrywać lokalne miejsca w Twoim mieście - kawiarnie, muzea, bary, parki, widoki - i układa z nich gotową trasę zwiedzania z kolejnością, mapą i godzinami. Sam albo ze znajomymi.",
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
                q: "Jak wygląda planowanie ze znajomymi?",
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
            <Logo className="h-14 w-auto drop-shadow-[0_8px_24px_rgba(234,88,12,0.25)]" />
          </div>
          <h2
            className="font-display text-3xl sm:text-4xl font-extrabold text-foreground mb-4"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Zacznij odkrywać swoje miasto
          </h2>
          <p className="text-base text-muted-foreground mb-8 max-w-[40ch] mx-auto">Pobierz Trasę i&nbsp;zaplanuj pierwszą trasę już dziś.</p>
          <StoreBadges center />
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-border/60 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-auto shrink-0" />
            <span className="font-black text-foreground">trasa.travel</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} Trasa · Stworzone z&nbsp;❤ w&nbsp;Polsce</p>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/trasa.travel" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
              @trasa.travel
            </a>
            <button onClick={() => navigate("/terms")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Regulamin</button>
          </div>
        </div>
      </footer>

      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </div>
  );
};

export default LandingPage;
