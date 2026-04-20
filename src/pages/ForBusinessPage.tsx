import { useRef, useState, useEffect } from "react";
import { Check, X, BarChart2, ImagePlus, CalendarDays, TrendingUp, Eye, Star, MapPin, Menu, User } from "lucide-react";

// ─── Scroll reveal ─────────────────────────────────────────────────────────────

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

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── Tiers data ────────────────────────────────────────────────────────────────

const TIERS = [
  {
    name: "Basic",
    subtitle: "Jesteś widoczny",
    price: "Bezpłatny",
    cta: null,
    highlight: false,
    danger: false,
    features: [
      { label: "Profil biznesowy w aplikacji", val: true },
      { label: "Możliwość bycia dodanym do trasy", val: true },
      { label: "Adres", val: true },
      { label: "Krótki opis", val: true },
      { label: "1 zdjęcie (profilowe)", val: true },
      { label: "Podstawowa analityka (wyświetlenia)", val: true },
    ],
  },
  {
    name: "Premium",
    subtitle: "Wyróżniasz się",
    price: "Bezpłatny",
    priceNote: "(na pierwsze trzy miesiące)",
    cta: "Wybieram",
    highlight: true,
    danger: false,
    features: [
      { label: "Profil biznesowy w aplikacji", val: true },
      { label: "Możliwość bycia dodanym do trasy", val: true },
      { label: "Adres", val: true },
      { label: "Krótki opis", val: true },
      { label: "Pełna galeria zdjęć (bez limitu)", val: true, bold: true },
      { label: "Pełna analityka - wyświetlenia, kliknięcia, dodania, oceny i inne", val: true, bold: true },
      { label: "Sekcja aktualności i promocji okresowych", val: true, bold: true },
    ],
  },
];

// ─── Feature icon ──────────────────────────────────────────────────────────────

function FeatureVal({ val }: { val: boolean | string }) {
  if (val === false) return <X className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={2} />;
  return <Check className="h-4 w-4 text-blue-500 shrink-0" strokeWidth={2.5} />;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const PREMIUM_FEATURES = [
  { icon: <Eye className="h-6 w-6 text-blue-500" />, title: "Widoczność gdzie trzeba", desc: "Twój lokal pojawia się gdy ktoś planuje wyjazd do Twojego miasta - nie w ogłoszeniach, ale w planie dnia." },
  { icon: <BarChart2 className="h-6 w-6 text-blue-500" />, title: "Analityka w czasie rzeczywistym", desc: "Ile osób zobaczyło Twój profil, ile kliknęło, ile dodało do trasy. Wiesz co działa." },
  { icon: <ImagePlus className="h-6 w-6 text-blue-500" />, title: "Pełna galeria zdjęć", desc: "Przesyłasz własne zdjęcia - kontrolujesz jak wygląda Twój lokal w trasach użytkowników." },
  { icon: <CalendarDays className="h-6 w-6 text-blue-500" />, title: "Aktualności i promocje", desc: "Wrzuć specjalną ofertę, wydarzenie albo nowe danie. Użytkownicy planujący trasę zobaczą to w odpowiednim momencie." },
  { icon: <TrendingUp className="h-6 w-6 text-blue-500" />, title: "Oceny i opinie", desc: "Zbieraj oceny od osób które faktycznie odwiedziły Twój lokal przez Trasę. Autentyczny social proof." },
  { icon: <Star className="h-6 w-6 text-blue-500" />, title: "Wyróżnienie w wynikach", desc: "Lokale Premium wyświetlają się wyżej w rekomendacjach gdy użytkownik wybiera miejsca w Twoim mieście." },
];

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

// ─── Interactive dashboard mockup ─────────────────────────────────────────────

type MockTab = 'overview' | 'gallery' | 'posts' | 'analytics';

const MOCK_TABS: { id: MockTab; label: string }[] = [
  { id: 'overview', label: 'Przegląd' },
  { id: 'gallery', label: 'Galeria zdjęć' },
  { id: 'posts', label: 'Aktualności' },
  { id: 'analytics', label: 'Analityka' },
];

const ANNOTATIONS: Record<MockTab, { text: string; sub?: string; top: string }> = {
  overview:  { text: 'Śledź aktywność w czasie rzeczywistym', sub: 'kto i kiedy odwiedza Twój lokal', top: '28%' },
  gallery:   { text: 'Twoje zdjęcia, Twój wizerunek',         sub: 'kontroluj co widzą turyści',        top: '22%' },
  posts:     { text: 'Publikuj promocje i wydarzenia',         sub: 'widoczne dla planujących wyjazd',    top: '18%' },
  analytics: { text: 'Pełna analityka jednym rzutem',          sub: 'bez arkuszy, bez zgadywania',        top: '34%' },
};

function DashboardMockup() {
  const [tab, setTab] = useState<MockTab>('overview');
  const [animKey, setAnimKey] = useState(0);

  const switchTab = (t: MockTab) => { setTab(t); setAnimKey(k => k + 1); };

  return (
    <div className="relative mt-16 text-left">
      {/* Floating annotation — always right side */}
      {Object.entries(ANNOTATIONS).map(([key, ann]) => tab === key && (
        <div
          key={key + animKey}
          className="absolute z-10 hidden lg:flex flex-col gap-0.5 bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 px-4 py-3 max-w-[190px] -right-5 translate-x-full"
          style={{
            top: ann.top,
            animation: 'callout-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both, float-bob 3s ease-in-out 0.4s infinite',
          }}
        >
          {/* Arrow pointing left toward dashboard */}
          <div
            className="absolute top-4 -left-2 w-0 h-0"
            style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: '8px solid white' }}
          />
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mb-1" />
          <p className="text-xs font-bold text-foreground leading-snug">{ann.text}</p>
          {ann.sub && <p className="text-[10px] text-slate-400 leading-snug">{ann.sub}</p>}
        </div>
      ))}

      <style>{`
        @keyframes callout-in {
          from { opacity: 0; transform: scale(0.88) translateX(10px); }
          to   { opacity: 1; transform: scale(1) translateX(0); }
        }
        @keyframes float-bob {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes content-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-blue-100/60 border border-slate-200">
        {/* Browser bar */}
        <div className="bg-slate-100 px-4 py-2.5 flex items-center gap-3 border-b border-slate-200">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">
            trasa.travel/biznes
          </div>
        </div>

        {/* App shell */}
        <div className="flex bg-white" style={{ height: 460 }}>
          {/* Sidebar — desktop only */}
          <div className="hidden sm:flex w-48 shrink-0 border-r border-slate-100 bg-white flex-col py-5 px-3 gap-1">
            <div className="flex items-center gap-2 px-2 mb-5">
              <div className="h-6 w-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
              <span className="font-black text-sm text-foreground">trasa.biznes</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">Menu</p>
            {MOCK_TABS.map(item => (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${tab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${tab === item.id ? 'bg-blue-500' : 'bg-slate-300'}`} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Main */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 w-52">
                <span className="text-slate-300 text-xs">⌕</span>
                <span className="text-xs text-slate-400">Szukaj...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">BK</div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-none">Bulaj Kraków</p>
                  <p className="text-[10px] text-slate-400">właściciel</p>
                </div>
              </div>
            </div>

            {/* Mobile tab strip — shown instead of sidebar on small screens */}
            <div className="sm:hidden flex border-b border-slate-100 shrink-0">
              {MOCK_TABS.map(item => (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`flex-1 py-2.5 text-[10px] font-semibold whitespace-nowrap px-1 transition-colors border-b-2 ${tab === item.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Content — animated on tab change */}
            <div
              key={animKey}
              className="flex-1 px-6 py-5 overflow-hidden"
              style={{ animation: 'content-fade 0.3s ease both' }}
            >

              {/* ── PRZEGLĄD ── */}
              {tab === 'overview' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-black text-foreground">Przegląd</h3>
                      <p className="text-[10px] text-slate-400">Witaj! Oto co dzieje się dziś z Twoim lokalem.</p>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold">+ Dodaj aktualność</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: 'Wyświetlenia', val: '1 284', delta: '+12%', up: true },
                      { label: 'Dodania do trasy', val: '347', delta: '+8%', up: true },
                      { label: 'Kliknięcia', val: '89', delta: '-2%', up: false },
                      { label: 'Ocena', val: '4.7 ★', delta: '+0.2', up: true },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-1">{s.label}</p>
                        <p className="text-sm font-black text-foreground leading-none mb-1">{s.val}</p>
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${s.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{s.delta}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ostatnia aktywność</p>
                  {[
                    { txt: 'Marta K. dodała Twój lokal do trasy na Kraków', time: '2 min temu', dot: 'bg-blue-400' },
                    { txt: 'Nowa ocena 5★ od użytkownika Piotr W.', time: '14 min temu', dot: 'bg-emerald-400' },
                    { txt: 'Twój profil wyświetlono 38 razy dzisiaj', time: '1 godz. temu', dot: 'bg-amber-400' },
                  ].map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.dot}`} />
                      <p className="text-[10px] text-slate-600 flex-1">{a.txt}</p>
                      <p className="text-[9px] text-slate-400 shrink-0">{a.time}</p>
                    </div>
                  ))}
                </>
              )}

              {/* ── GALERIA ── */}
              {tab === 'gallery' && (
                <>
                  <h3 className="text-sm font-black text-foreground mb-1">Galeria zdjęć</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Logo, zdjęcie główne i galeria widoczne na wizytówce.</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 mb-1.5">Logo</p>
                      <div className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-slate-400 mb-1.5">Zdjęcie główne</p>
                      <div className="aspect-square rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center overflow-hidden">
                        <div className="text-2xl">🍽️</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] font-semibold text-slate-400 mb-1.5">Galeria (3/10)</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['from-blue-100 to-sky-200', 'from-green-100 to-emerald-200', 'from-purple-100 to-violet-200'].map((g, i) => (
                      <div key={i} className={`aspect-square rounded-lg bg-gradient-to-br ${g}`} />
                    ))}
                    <div className="aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-lg">+</div>
                  </div>
                </>
              )}

              {/* ── AKTUALNOŚCI ── */}
              {tab === 'posts' && (
                <>
                  <h3 className="text-sm font-black text-foreground mb-1">Aktualności</h3>
                  <p className="text-[10px] text-slate-400 mb-3">Promocje i wydarzenia widoczne dla użytkowników planujących trip.</p>
                  <div className="border border-slate-100 rounded-xl p-3 mb-3 bg-slate-50">
                    <div className="h-8 bg-white rounded-lg border border-slate-100 mb-2 flex items-center px-3">
                      <span className="text-[10px] text-slate-300">Co nowego w Twoim lokalu?</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold px-2 py-1 bg-white rounded-full border border-slate-100">📷 Zdjęcia</div>
                      <div className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[9px] font-bold">Opublikuj</div>
                    </div>
                  </div>
                  {[
                    { title: 'Happy hour 17:00–19:00 🍸', time: '2 godz. temu', tag: 'Wydarzenie' },
                    { title: 'Nowe menu degustacyjne już dostępne!', time: 'wczoraj', tag: 'Nowość' },
                  ].map((p, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl p-3 mb-2 bg-white flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center text-sm shrink-0">📣</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-foreground leading-snug">{p.title}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{p.time} · <span className="text-blue-500">{p.tag}</span></p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── ANALITYKA ── */}
              {tab === 'analytics' && (
                <>
                  <h3 className="text-sm font-black text-foreground mb-1">Analityka</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Ostatnie 30 dni · aktualizowane na bieżąco</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: 'Wyświetlenia profilu', val: '1 284', icon: '👁', color: 'bg-blue-50 text-blue-600' },
                      { label: 'Dodania do trasy', val: '347', icon: '📍', color: 'bg-emerald-50 text-emerald-600' },
                      { label: 'Kliknięcia', val: '89', icon: '👆', color: 'bg-violet-50 text-violet-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <div className={`h-7 w-7 rounded-lg ${s.color} flex items-center justify-center text-sm mb-2`}>{s.icon}</div>
                        <p className="text-base font-black text-foreground leading-none mb-0.5">{s.val}</p>
                        <p className="text-[9px] text-slate-400 leading-snug">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Mini bar chart */}
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">Wyświetlenia — ostatnie 7 dni</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-md bg-blue-200" style={{ height: `${h}%` }} />
                        <span className="text-[7px] text-slate-300">{['Pn','Wt','Śr','Cz','Pt','So','Nd'][i]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Tab hint */}
      <p className="text-center text-xs text-slate-400 mt-3">
        <span className="sm:hidden">Kliknij zakładkę, żeby zobaczyć więcej</span>
        <span className="hidden sm:inline">Kliknij menu po lewej, żeby zobaczyć więcej</span>
      </p>
    </div>
  );
}

export default function ForBusinessPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-[#FEFEFE] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
        {/* Pill bar */}
        <div className="bg-[#1a1a1a] rounded-full px-5 h-14 flex items-center gap-3 shadow-xl">
          {/* Left: logo + section links */}
          <div className="flex items-center gap-4 shrink-0">
            <a href="/" className="flex items-center">
              <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            </a>
            <button
              onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })}
              className="hidden sm:block text-sm text-white/60 hover:text-white/90 transition-colors whitespace-nowrap"
            >
              Pakiety
            </button>
          </div>

          <div className="flex-1" />

          {/* Right: badge + zaloguj */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })}
              className="hidden md:flex items-center text-xs font-bold px-4 py-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all whitespace-nowrap"
            >
              Pakiety
            </button>
            <a
              href="/"
              className="hidden md:flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-all border border-orange-500/30 whitespace-nowrap"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
              Dla podróżujących
            </a>
            <a
              href="/auth?business=true"
              className="hidden sm:flex items-center text-sm font-bold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all whitespace-nowrap"
            >
              Zaloguj się
            </a>
            {/* Hamburger — mobile only */}
            <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              {menuOpen ? <X className="h-4 w-4 text-white" /> : <Menu className="h-4 w-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden mt-2 bg-[#1a1a1a] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex flex-col py-2">
              <button onClick={() => { document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 text-left transition-colors">
                Pakiety
              </button>
              <button onClick={() => { document.getElementById("faq-biznes")?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); }} className="px-5 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 text-left transition-colors">
                FAQ
              </button>
              <a href="/" className="px-5 py-3 text-sm font-bold text-orange-300 hover:text-orange-200 hover:bg-white/5 flex items-center gap-2 transition-colors">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                Dla podróżujących
              </a>
              <div className="mx-5 my-1 border-t border-white/10" />
              <div className="px-5 pb-3 pt-1">
                <a href="/auth?business=true" className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border border-white/25 text-white/80 hover:border-white/50 hover:text-white active:scale-95 transition-all">
                  <User className="h-4 w-4" />
                  Zaloguj się
                </a>
              </div>
              <div className="px-5 py-3">
                <a href="mailto:trasa.app@gmail.com" className="block w-full text-center text-sm font-bold px-4 py-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all">
                  Kontakt →
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="min-h-[85dvh] flex items-center">
        <div className="max-w-5xl mx-auto px-5 pt-28 pb-16 w-full text-center">
          <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-8">
            <MapPin className="h-3.5 w-3.5" />
            Lokalne biznesy
          </div>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground leading-[1.05] mb-6 mx-auto"
            style={{ letterSpacing: "-0.02em", maxWidth: "18ch", textWrap: "balance" } as React.CSSProperties}
          >
            Bądź tam, gdzie{" "}
            <span className="bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">
              turyści szukają
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-[52ch] mx-auto">
            Trasa, to aplikacja, w której turyści poznają się z miastem, a Twój lokal może pojawić się już dzisiaj w ich planach!
          </p>
          <a
            href="/auth?business=true"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            Stwórz profil biznesowy →
          </a>
          <p className="text-xs text-muted-foreground mt-4">Rejestracja i prowadzenie konta jest darmowe</p>

          {/* ── Dashboard mockup ── */}
          <FadeIn>
            <DashboardMockup />
          </FadeIn>
        </div>
      </section>

      {/* ── Model zero - loss aversion ── */}
      <section className="py-24 px-5 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3">Bądź pierwszy</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-white mb-4"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Załóż konto zanim zrobi to konkurencja
            </h2>
            <p className="text-base text-white/50 max-w-[52ch] mx-auto leading-relaxed">
              Wprowadzamy nowy sposób planowania podróży. Lokale, które dołączą teraz,
              będą pierwszym wyborem, gdy ruch zacznie rosnąć.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { num: "0 zł", label: "za prowadzenie konta", sub: "bez ryzyka, bez zobowiązań" },
              { num: "+1", label: "nowy kanał komunikacji", sub: "skierowany do planujących wyjazd" },
              { num: "1", label: "miejsca w kolejce", sub: "dołączasz zanim zrobi się tłoczno" },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100} className="h-full">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center h-full flex flex-col items-center justify-center min-h-[140px]">
                  <p className="text-4xl font-black text-orange-400 mb-1">{item.num}</p>
                  <p className="text-sm font-bold text-white mb-1">{item.label}</p>
                  <p className="text-xs text-white/40">{item.sub}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pakiety ── */}
      <section id="pakiety" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Pakiety</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-foreground"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Sprawdź pełne możliwości Trasy
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch max-w-3xl mx-auto">
            {TIERS.map((tier, i) => (
              <FadeIn key={i} delay={i * 80} className="h-full">
                <div className={`rounded-3xl p-6 h-full flex flex-col ${
                  tier.highlight
                    ? "bg-white border-2 border-blue-500 shadow-2xl shadow-blue-100"
                    : "bg-white border border-border/50 shadow-sm"
                }`}>
                  <div className="mb-6">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${tier.highlight ? "text-blue-600" : "text-muted-foreground"}`}>
                      {tier.name}
                    </p>
                    <h3 className={`text-xl font-black mb-2 ${tier.highlight ? "text-blue-600" : "text-foreground"}`}>
                      {tier.subtitle}
                    </h3>
                    <p className={`text-sm font-bold ${tier.highlight ? "text-foreground" : "text-muted-foreground"}`}>
                      {tier.price}
                      {(tier as any).priceNote && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">{(tier as any).priceNote}</span>
                      )}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-3 flex-1 mb-6">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <FeatureVal val={f.val} />
                        <span className={`text-sm leading-snug ${
                          (f as any).bold && tier.highlight ? "text-blue-600 font-semibold" : "text-muted-foreground"
                        }`}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tier.cta && (
                    <a
                      href="/auth?business=true"
                      className="mt-auto text-center text-sm font-bold px-4 py-3 rounded-2xl transition-all active:scale-95 bg-blue-600 text-white hover:bg-blue-500"
                    >
                      {tier.cta}
                    </a>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, #eff6ff 0%, #dbeafe 40%, #FEFEFE 100%)" }} />
        <FadeIn className="max-w-xl mx-auto relative">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-blue-600 shadow-xl shadow-blue-300/30 flex items-center justify-center">
              <MapPin className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2
            className="text-3xl sm:text-4xl font-black text-foreground mb-4"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Daj się odkryć turystom
          </h2>
          <p className="text-base text-muted-foreground mb-8 max-w-[40ch] mx-auto">
            Dołącz teraz i bądź jednym z pierwszych miejsc na Trasie.
          </p>
          <a
            href="/auth?business=true"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            Dodaj swój lokal →
          </a>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-foreground py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <div className="h-6 w-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/" className="text-xs text-white/50 hover:text-white/80 transition-colors">Dla podróżujących</a>
            <a href="mailto:trasa.app@gmail.com" className="text-xs font-bold text-white hover:text-blue-300 transition-colors">trasa.app@gmail.com</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
