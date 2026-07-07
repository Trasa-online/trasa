import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, User, Compass, ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import posthog from "posthog-js";

const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";
const EASE = "cubic-bezier(0.32,0.72,0,1)";

// ─── Scroll reveal (fade-up + blur) ───────────────────────────────────────────

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } }, { threshold: 0.08, rootMargin: "0px 0px -60px 0px" });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: on ? 1 : 0,
      filter: on ? "blur(0px)" : "blur(10px)",
      transform: on ? "translateY(0)" : "translateY(40px)",
      transition: `opacity 0.9s ${EASE} ${delay}ms, transform 0.9s ${EASE} ${delay}ms, filter 0.9s ${EASE} ${delay}ms`,
    }}>{children}</div>
  );
}

// ─── Ambient background (ciepłe glow-orby + grain) - to nadaje glebie i "plynie" ─

function Ambient() {
  return (
    <>
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(249,102,43,0.16), transparent 70%)", animation: "flowA 18s ease-in-out infinite" }} />
        <div className="absolute top-[36%] -right-32 h-[620px] w-[620px] rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, rgba(244,162,89,0.18), transparent 70%)", animation: "flowB 22s ease-in-out infinite" }} />
        <div className="absolute top-[68%] left-[8%] h-[560px] w-[560px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(255,214,170,0.28), transparent 70%)", animation: "flowA 26s ease-in-out infinite" }} />
      </div>
      {/* film grain - fixed, pointer-events-none */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-[0.035]" aria-hidden style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "180px 180px",
      }} />
      <style>{`
        @keyframes flowA { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(24px,-30px,0) scale(1.08); } }
        @keyframes flowB { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-30px,26px,0) scale(1.06); } }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
      `}</style>
    </>
  );
}

// ─── Eyebrow pill ─────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700 ring-1 ring-orange-200/70 shadow-sm shadow-orange-100/50">
      <Sparkles className="h-3 w-3" strokeWidth={1.75} />
      {children}
    </span>
  );
}

// ─── Phone mockup (czysty realistyczny iPhone: cienki rowny bezel + status bar + wyspa) ─

function Phone({ width = 260, ar = "430 / 872", float = false, rotate = 0, bare = false, children }: { width?: number; ar?: string; float?: boolean; rotate?: number; bare?: boolean; children: React.ReactNode }) {
  const b = Math.round(width * 0.032);
  const dark = "#0E0E0E";
  return (
    <div className="relative mx-auto" style={{ width, animation: float ? "floatY 7s ease-in-out infinite" : undefined, transform: `rotate(${rotate}deg)` }}>
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[3rem] opacity-70" style={{ background: "radial-gradient(60% 50% at 50% 60%, rgba(249,102,43,0.20), transparent 75%)", filter: "blur(24px)" }} />
      <div className="relative bg-[#0E0E0E]" style={{ padding: b, borderRadius: Math.round(width * 0.155), boxShadow: "0 40px 90px -30px rgba(120,50,10,0.35), 0 12px 30px -12px rgba(120,50,10,0.18)" }}>
        <div className="relative flex flex-col overflow-hidden bg-[#F4F4F5]" style={{ aspectRatio: ar, borderRadius: Math.round(width * 0.125) }}>
          {/* status bar (pomijany w trybie bare - screen apki ma juz wlasny safe-area) */}
          {!bare && (
          <div className="relative z-10 flex shrink-0 items-center justify-between" style={{ paddingLeft: width * 0.07, paddingRight: width * 0.055, paddingTop: width * 0.032, paddingBottom: width * 0.014 }}>
            <span className="font-semibold" style={{ color: dark, fontSize: width * 0.04, lineHeight: 1 }}>9:41</span>
            <div className="flex items-center" style={{ gap: width * 0.012 }}>
              <svg width={width * 0.048} viewBox="0 0 20 13" fill={dark}><rect x="0" y="9" width="3.2" height="4" rx="1" /><rect x="5.6" y="6" width="3.2" height="7" rx="1" /><rect x="11.2" y="3" width="3.2" height="10" rx="1" /><rect x="16.8" y="0" width="3.2" height="13" rx="1" /></svg>
              <svg width={width * 0.044} viewBox="0 0 18 13" fill={dark}><path d="M9 2.2c2.9 0 5.6 1.1 7.6 3l-1.5 1.5A8.6 8.6 0 0 0 9 5.2 8.6 8.6 0 0 0 2.9 6.7L1.4 5.2A10.8 10.8 0 0 1 9 2.2Z" /><path d="M9 6.7c1.7 0 3.3.7 4.5 1.8l-1.6 1.6A4 4 0 0 0 9 9a4 4 0 0 0-2.9 1.1L4.5 8.5A6.4 6.4 0 0 1 9 6.7Z" /><circle cx="9" cy="11.3" r="1.4" /></svg>
              <div className="flex items-center" style={{ gap: width * 0.003 }}>
                <div className="flex items-center rounded-[2px]" style={{ width: width * 0.07, height: width * 0.036, padding: width * 0.005, border: `1px solid ${dark}80` }}>
                  <div className="h-full rounded-[1px]" style={{ width: "65%", background: dark }} />
                </div>
                <div className="rounded-full" style={{ width: width * 0.006, height: width * 0.015, background: `${dark}66` }} />
              </div>
            </div>
          </div>
          )}
          {/* app content */}
          <div className="relative flex-1">{children}</div>
          {/* dynamic island */}
          <div className="absolute left-1/2 -translate-x-1/2 z-20 rounded-full bg-black" style={{ top: width * 0.022, width: width * 0.24, height: width * 0.052 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Store badges (island) ────────────────────────────────────────────────────

function StoreBadges({ center = false }: { center?: boolean }) {
  // Oba badge'y wypelniaja plotno pixel-perfect (Google Play przyciety z transparent
  // paddingu -> google-play-badge-trim.png), wiec ta sama wysokosc = ta sama wielkosc.
  const link = "group inline-flex transition-transform duration-500 hover:-translate-y-0.5 active:scale-[0.98]";
  return (
    <div className={`flex flex-col sm:flex-row gap-3 items-center ${center ? "sm:justify-center" : "sm:justify-start"}`} style={{ transitionTimingFunction: EASE }}>
      <a href={APP_STORE_URL} onClick={(e) => { if (APP_STORE_URL === "#") e.preventDefault(); posthog.capture("landing_store_click", { store: "app_store", v: 2 }); }} className={link} aria-label="Pobierz z App Store">
        <img src="/Pobierz-z-App-Store.png" alt="Pobierz z App Store" className="h-[50px] w-auto object-contain drop-shadow-sm" draggable={false} />
      </a>
      <a href={PLAY_STORE_URL} onClick={(e) => { if (PLAY_STORE_URL === "#") e.preventDefault(); posthog.capture("landing_store_click", { store: "play_store", v: 2 }); }} className={link} aria-label="Pobierz z Google Play">
        <img src="/google-play-badge-trim.png" alt="Pobierz z Google Play" className="h-[50px] w-auto object-contain drop-shadow-sm" draggable={false} />
      </a>
    </div>
  );
}

// ─── Circle stacks (avatary / miejsca) ────────────────────────────────────────

function CircleStack({ srcs, extra }: { srcs: string[]; extra?: string }) {
  return (
    <div className="flex items-center -space-x-3.5">
      {srcs.map((src, i) => (
        <img key={src} src={src} alt="" className="h-12 w-12 rounded-full border-[3px] border-white object-cover bg-secondary shadow-md shadow-orange-900/10" style={{ zIndex: srcs.length + 1 - i }} draggable={false} />
      ))}
      {extra && <div className="h-12 w-12 rounded-full border-[3px] border-white bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shadow-md shadow-orange-900/10">{extra}</div>}
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-[1.75rem] bg-white/60 p-1.5 ring-1 ring-black/5 backdrop-blur-sm transition-shadow duration-500 hover:shadow-lg hover:shadow-orange-100/50" style={{ transitionTimingFunction: EASE }}>
            <div className="rounded-[1.4rem] bg-white">
              <button onClick={() => setOpen(isOpen ? null : i)} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                <span className="font-display font-extrabold text-base text-foreground">{it.q}</span>
                <span className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-500 ${isOpen ? "bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white rotate-45" : "bg-orange-50 text-orange-600"}`} style={{ transitionTimingFunction: EASE }}>
                  <span className="text-lg leading-none">+</span>
                </span>
              </button>
              <div className="grid transition-all duration-500" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", transitionTimingFunction: EASE }}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">{it.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Jak to działa (animowane: telefon gra demo apki, kroki podswietlaja sie w rytm) ─

const STEPS = [
  { num: "01", kicker: "Krok pierwszy", title: "Wybierz miasto", desc: "Na start Warszawa i Trójmiasto (Gdańsk, Sopot, Gdynia). Kolejne miasta dodajemy na bieżąco.", img: "/landing/flow-city.png" },
  { num: "02", kicker: "Krok drugi", title: "Przeglądaj lokalne miejsca", desc: "Kawiarnie, muzea, bary, widoki. Dodawaj to co Cię kręci: sam albo ze znajomymi.", img: "/landing/flow-browse.jpg" },
  { num: "03", kicker: "Krok trzeci", title: "Trasa gotowa w minutę", desc: "Trasa układa gotowy plan dnia z kolejnością, mapą i godzinami. Ty tylko ruszasz w miasto.", img: "/landing/flow-route.jpg" },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive(a => (a + 1) % STEPS.length), 3400);
    return () => clearInterval(t);
  }, [paused]);
  const jump = (i: number) => setActive(i);
  return (
    <section id="how" className="relative px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center mb-16 flex flex-col items-center gap-4">
          <Eyebrow>Jak to działa</Eyebrow>
          <h2 className="font-display font-extrabold text-foreground text-[clamp(2rem,5vw,3.25rem)] tracking-[-0.02em] leading-tight max-w-[16ch]">Od pomysłu do trasy w&nbsp;trzech krokach</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          <Reveal className="flex justify-center md:order-1">
            <Phone width={266} float bare ar="393 / 852">
              {STEPS.map((s, i) => (
                <img
                  key={s.img}
                  src={s.img}
                  alt={s.title}
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[900ms]"
                  style={{ transitionTimingFunction: EASE, opacity: active === i ? 1 : 0 }}
                />
              ))}
            </Phone>
          </Reveal>
          <Reveal delay={140} className="md:order-2">
            <div className="flex flex-col gap-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              {STEPS.map((s, i) => {
                const on = active === i;
                return (
                  <button
                    key={i}
                    onClick={() => jump(i)}
                    className={`group relative text-left rounded-[1.75rem] p-1.5 transition-all duration-700 ${on ? "bg-white/60 ring-1 ring-black/5" : "ring-1 ring-transparent"}`}
                    style={{ transitionTimingFunction: EASE, boxShadow: on ? "0 22px 50px -32px rgba(120,50,10,0.3)" : "none" }}
                  >
                    <div className={`relative overflow-hidden rounded-[1.4rem] px-6 py-5 transition-colors duration-700 ${on ? "bg-white" : ""}`} style={{ transitionTimingFunction: EASE }}>
                      {on && <span className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-[#F4A259] to-[#F9662B]" />}
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-extrabold transition-all duration-700 ${on ? "bg-gradient-to-br from-[#F4A259] to-[#F9662B] text-white shadow-md shadow-orange-200" : "bg-orange-50 text-orange-500"}`} style={{ transitionTimingFunction: EASE }}>{s.num}</span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">{s.kicker}</span>
                      </div>
                      <h3 className={`mt-2.5 font-display font-extrabold tracking-[-0.02em] transition-all duration-700 ${on ? "text-foreground text-2xl" : "text-foreground/55 text-xl"}`} style={{ transitionTimingFunction: EASE }}>{s.title}</h3>
                      <div className="grid transition-all duration-700" style={{ gridTemplateRows: on ? "1fr" : "0fr", transitionTimingFunction: EASE }}>
                        <div className="overflow-hidden"><p className="pt-2 text-[15px] text-muted-foreground leading-relaxed max-w-[42ch]">{s.desc}</p></div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Landing V2 ────────────────────────────────────────────────────────────────

const LandingV2 = () => {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  if (loading) return null;

  const links = [
    { label: "Jak to działa", id: "how" },
    { label: "Dla kogo", id: "who" },
    { label: "FAQ", id: "faq" },
  ];

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#FEFEFE] text-foreground">
      <Ambient />
      {/* delikatny radialny gradient przy stopce (1:1 jak /dla-firm, wersja ciepla) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-[1] h-[1200px]"
        style={{ background: "radial-gradient(ellipse 72% 55% at 50% 100%, #FFE6CC 0%, #FFF3E9 42%, transparent 78%)" }} />

      {/* ── Nav ── */}
      <nav className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        <div className="flex items-center gap-3 rounded-full bg-[#0E0E0E]/95 backdrop-blur-xl px-4 h-14 ring-1 ring-white/10 shadow-[0_14px_44px_-12px_rgba(0,0,0,0.5)]">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center pl-1" aria-label="Trasa">
            <img src="/Icon_Trasa.png" alt="Trasa" className="h-6 w-auto" draggable={false} />
          </button>
          <div className="hidden sm:flex items-center gap-1 ml-1">
            {links.map(l => (
              <button key={l.id} onClick={() => document.getElementById(l.id)?.scrollIntoView({ behavior: "smooth" })} className="px-3 py-2 text-sm text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors whitespace-nowrap">{l.label}</button>
            ))}
          </div>
          <div className="flex-1" />
          <a href="/dla-firm" className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20 hover:bg-blue-500/25 transition-colors whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Dla firm
          </a>
          <button onClick={() => navigate("/auth")} className="group hidden sm:inline-flex items-center gap-2 text-sm font-semibold pl-4 pr-1.5 py-1.5 rounded-full bg-white text-[#0E0E0E] transition-transform duration-500 hover:-translate-y-0.5 active:scale-[0.98]" style={{ transitionTimingFunction: EASE }}>
            Zaloguj się
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-black/[0.06] transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ transitionTimingFunction: EASE }}>
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Menu">
            <div className="relative h-4 w-4">
              <span className="absolute left-0 top-1/2 h-[2px] w-4 bg-white rounded-full transition-all duration-500" style={{ transform: menuOpen ? "translateY(-50%) rotate(45deg)" : "translateY(-4px)", transitionTimingFunction: EASE }} />
              <span className="absolute left-0 top-1/2 h-[2px] w-4 bg-white rounded-full transition-all duration-500" style={{ transform: menuOpen ? "translateY(-50%) rotate(-45deg)" : "translateY(3px)", transitionTimingFunction: EASE }} />
            </div>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden mt-2 rounded-3xl bg-[#0E0E0E]/95 backdrop-blur-xl ring-1 ring-white/10 shadow-xl overflow-hidden">
            <div className="flex flex-col p-2">
              {links.map((l, i) => (
                <button key={l.id} onClick={() => { document.getElementById(l.id)?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-4 py-3 text-sm text-white/70 hover:bg-white/10 rounded-2xl text-left transition-colors" style={{ animation: `fadeUp 0.5s ${EASE} ${i * 60}ms both` }}>{l.label}</button>
              ))}
              <a href="/dla-firm" className="px-4 py-3 text-sm font-bold text-blue-300 hover:bg-white/10 rounded-2xl flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Dla firm</a>
              <button onClick={() => { navigate("/auth"); setMenuOpen(false); }} className="mt-1 mx-1 mb-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white text-[#0E0E0E] text-sm font-semibold"><User className="h-4 w-4" strokeWidth={1.75} /> Zaloguj się</button>
            </div>
          </div>
        )}
        <style>{`@keyframes fadeUp { from { opacity:0; transform: translateY(12px);} to { opacity:1; transform: translateY(0);} }`}</style>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[100dvh] flex items-center px-5">
        <div className="mx-auto max-w-6xl w-full pt-32 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-8 items-center">
            {/* TEXT (mobile: tylko H1 + opis; desktop: + eyebrow, badge'y, social) */}
            <div className="text-center md:text-left">
              <Reveal className="hidden md:block"><div className="mb-7 flex md:justify-start"><Eyebrow>Odkrywaj lokalne miejsca</Eyebrow></div></Reveal>
              <Reveal delay={80}>
                <h1 className="font-display font-extrabold text-foreground leading-[1.0] tracking-[-0.03em] text-[clamp(3rem,8vw,5.5rem)]">
                  Speed dating<br />
                  <span className="bg-gradient-to-r from-[#F4A259] via-[#F9662B] to-[#F4A259] bg-clip-text text-transparent" style={{ backgroundSize: "200% auto" }}>z&nbsp;miastem</span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-7 text-lg text-muted-foreground leading-relaxed max-w-[46ch] mx-auto md:mx-0">
                  Odkrywaj najlepsze miejsca w&nbsp;swoim mieście i&nbsp;układaj trasy zwiedzania - solo albo ze&nbsp;znajomymi. Kawiarnie, muzea, bary, widoki: wszystko w&nbsp;jednej aplikacji.
                </p>
              </Reveal>
              <Reveal delay={240} className="hidden md:block"><div className="mt-10"><StoreBadges /></div></Reveal>
              <Reveal delay={320} className="hidden md:block">
                <div className="mt-8 flex items-center gap-3 md:justify-start">
                  <CircleStack srcs={["Marta", "Kuba", "Piotr"].map(n => `/landing/avatars/${n}.png`)} extra="+2k" />
                  <p className="text-sm text-muted-foreground max-w-[18ch] text-left">Dołącz do&nbsp;odkrywców swojego miasta</p>
                </div>
              </Reveal>
            </div>
            {/* PHONE (animacja) */}
            <Reveal delay={200} className="flex justify-center md:justify-end">
              {/* Ta sama animacja co na /dla-firm/landing: wideo z mixBlendMode multiply (biale tlo znika, animacja "plywa" bez sztywnej ramki) */}
              <div className="relative select-none" style={{ animation: "floatY 7s ease-in-out infinite" }}>
                <div aria-hidden className="absolute -inset-6 -z-10 rounded-full opacity-70" style={{ background: "radial-gradient(58% 48% at 50% 56%, rgba(249,102,43,0.16), transparent 74%)", filter: "blur(34px)" }} />
                <video
                  ref={el => { if (!el) return; el.muted = true; el.play().catch(() => {}); }}
                  src="/landing/hero-anim.mp4"
                  autoPlay muted loop playsInline preload="auto"
                  className="block h-auto"
                  style={{ width: "clamp(270px,40vw,320px)", mixBlendMode: "multiply", transform: "translateZ(0)" }}
                />
              </div>
            </Reveal>
            {/* BADGE'Y - tylko mobile, pod telefonem (jak Figma) */}
            <Reveal delay={120} className="md:hidden flex justify-center">
              <StoreBadges center />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Jak to działa (animowane) ── */}
      <HowItWorks />

      {/* ── Dla kogo (asymmetric bento, double-bezel) ── */}
      <section id="who" className="relative px-5 py-28 sm:py-36">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center mb-16 flex flex-col items-center gap-4">
            <Eyebrow>Dla kogo</Eyebrow>
            <h2 className="font-display font-extrabold text-foreground text-[clamp(2rem,5vw,3.25rem)] tracking-[-0.02em] leading-tight max-w-[18ch]">Trasa działa dla&nbsp;każdego tripu</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Featured - solo */}
            <Reveal className="md:col-span-1 md:row-span-2">
              <div className="group h-full rounded-[2rem] bg-white/50 p-1.5 ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1" style={{ transitionTimingFunction: EASE, boxShadow: "0 30px 60px -30px rgba(120,50,10,0.25)" }}>
                <div className="relative h-full overflow-hidden rounded-[calc(2rem-0.375rem)] p-8 flex flex-col justify-between min-h-[320px]"
                  style={{ background: "linear-gradient(160deg, #FFF3E9 0%, #FFEFD8 45%, #FEFEFE 100%)" }}>
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-60" style={{ background: "radial-gradient(circle, rgba(249,102,43,0.25), transparent 70%)" }} />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
                    <Compass className="h-7 w-7 text-orange-600" strokeWidth={1.6} />
                  </div>
                  <div className="relative mt-8">
                    <h3 className="font-display font-extrabold text-2xl text-foreground">Solo odkrywanie</h3>
                    <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed max-w-[26ch]">Poznawaj swoje miasto na&nbsp;nowo. Odkrywaj lokalne miejsca we&nbsp;własnym tempie i&nbsp;twórz własne trasy.</p>
                  </div>
                </div>
              </div>
            </Reveal>
            {/* Ze znajomymi */}
            <Reveal delay={100} className="md:col-span-2">
              <div className="group h-full rounded-[2rem] bg-white/50 p-1.5 ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1" style={{ transitionTimingFunction: EASE, boxShadow: "0 24px 50px -30px rgba(120,50,10,0.2)" }}>
                <div className="h-full rounded-[calc(2rem-0.375rem)] bg-white p-8 flex flex-col items-start gap-5">
                  <div className="shrink-0"><CircleStack srcs={["Marta", "Kuba", "Piotr", "Ola"].map(n => `/landing/avatars/${n}.png`)} extra="+3" /></div>
                  <div>
                    <h3 className="font-display font-extrabold text-xl text-foreground">Ze znajomymi</h3>
                    <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed max-w-[40ch]">Planujcie wspólnie - każdy dodaje co&nbsp;lubi, a&nbsp;trasa godzi wszystkich w&nbsp;jeden plan.</p>
                  </div>
                </div>
              </div>
            </Reveal>
            {/* Spontaniczne */}
            <Reveal delay={180} className="md:col-span-2">
              <div className="group h-full rounded-[2rem] bg-white/50 p-1.5 ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-1" style={{ transitionTimingFunction: EASE, boxShadow: "0 24px 50px -30px rgba(120,50,10,0.2)" }}>
                <div className="h-full rounded-[calc(2rem-0.375rem)] bg-white p-8 flex flex-col items-start gap-5">
                  <div className="shrink-0"><CircleStack srcs={["park", "restaurant", "bar"].map(n => `/landing/places/${n}.jpg`)} /></div>
                  <div>
                    <h3 className="font-display font-extrabold text-xl text-foreground">Spontaniczne wypady</h3>
                    <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed max-w-[40ch]">Wolny wieczór? W&nbsp;minutę masz gotowy plan na&nbsp;odkrywanie okolicy.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative px-5 py-28 sm:py-36">
        <div className="mx-auto max-w-2xl">
          <Reveal className="text-center mb-14 flex flex-col items-center gap-4">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display font-extrabold text-foreground text-[clamp(2rem,5vw,3rem)] tracking-[-0.02em] leading-tight">Najczęściej zadawane pytania</h2>
          </Reveal>
          <Reveal delay={80}>
            <Faq items={[
              { q: "Czy trasa jest darmowa?", a: "Tak, konto jest darmowe. Podstawowe planowanie - solo i w grupie - zawsze będzie bezpłatne. Płatne funkcje mogą pojawić się w przyszłości, ale z wyprzedzeniem damy Ci znać." },
              { q: "Do czego służy trasa?", a: "Trasa pomaga odkrywać lokalne miejsca w Twoim mieście - kawiarnie, muzea, bary, parki, widoki - i układa z nich gotową trasę zwiedzania z kolejnością, mapą i godzinami. Sam albo ze znajomymi." },
              { q: "W jakich miastach działa trasa?", a: "Aktualnie działamy w Warszawie i Trójmieście (Gdańsk, Sopot, Gdynia). Kolejne miasta dodajemy sukcesywnie - jeśli nie widzisz swojego, daj nam znać." },
              { q: "Czy mogę planować solo, bez grupy?", a: "Tak! Trasa działa świetnie zarówno solo jak i w grupie. Przeglądaj miejsca samodzielnie i buduj własny plan dnia we własnym tempie." },
              { q: "Jak wygląda planowanie ze znajomymi?", a: "Tworzysz sesję i zapraszasz znajomych jednym linkiem. Każdy przegląda miejsca osobno na swoim telefonie. Trasa zbiera wasze wybory i pokazuje miejsca które spodobały się wszystkim - na tej podstawie układa gotową trasę." },
            ]} />
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative px-5 py-28 sm:py-36">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white/50 p-1.5 ring-1 ring-black/5 backdrop-blur-sm" style={{ boxShadow: "0 40px 90px -40px rgba(120,50,10,0.35)" }}>
              <div className="relative overflow-hidden rounded-[calc(2.5rem-0.375rem)] px-6 py-20 text-center"
                style={{ background: "radial-gradient(ellipse 90% 80% at 50% 0%, #FFE6CC 0%, #FFF3E9 45%, #FEFEFE 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full opacity-70" style={{ background: "radial-gradient(circle, rgba(249,102,43,0.28), transparent 70%)", filter: "blur(30px)" }} />
                <div className="relative flex flex-col items-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-orange-200/60 ring-1 ring-orange-100">
                    <MapPin className="h-8 w-8 text-orange-600" strokeWidth={1.6} />
                  </div>
                  <h2 className="font-display font-extrabold text-foreground text-[clamp(2rem,5vw,3.25rem)] tracking-[-0.02em] leading-tight max-w-[16ch]">Zacznij odkrywać swoje miasto</h2>
                  <p className="mt-4 text-base text-muted-foreground max-w-[40ch]">Pobierz Trasę i&nbsp;zaplanuj pierwszą trasę już dziś.</p>
                  <div className="mt-9"><StoreBadges center /></div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative px-5 pt-14 pb-12 border-t border-black/[0.06]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <img src="/Icon_Trasa.png" alt="Trasa" className="h-5 w-auto" draggable={false} />
            <span className="font-display font-extrabold text-foreground">trasa.travel</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Trasa · Stworzone z&nbsp;❤ w&nbsp;Polsce</p>
          <div className="flex items-center gap-5">
            <a href="https://instagram.com/trasa.travel" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">@trasa.travel</a>
            <button onClick={() => navigate("/terms")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Regulamin</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingV2;
