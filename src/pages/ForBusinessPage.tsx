import { useRef, useState, useEffect } from "react";
import { Check, X, BarChart2, ImagePlus, CalendarDays, TrendingUp, Eye, Star, MapPin } from "lucide-react";

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
    subtitle: "Zaistniej na mapie",
    price: "Bezpłatny",
    cta: "Napisz do nas",
    highlight: false,
    danger: false,
    features: [
      { label: "Widoczność w trasach użytkowników", val: true },
      { label: "Profil lokalu z opisem", val: true },
      { label: "Dodawanie do trasy przez użytkowników", val: true },
      { label: "1 zdjęcie profilowe", val: true },
      { label: "Podstawowa analityka (wyświetlenia)", val: "limited" },
      { label: "Aktualności i promocje", val: false },
    ],
  },
  {
    name: "Premium",
    subtitle: "Pełna kontrola wizerunku",
    price: "Wycena indywidualna",
    cta: "Umów rozmowę",
    highlight: true,
    danger: false,
    features: [
      { label: "Widoczność w trasach użytkowników", val: true },
      { label: "Profil lokalu z opisem", val: true },
      { label: "Dodawanie do trasy przez użytkowników", val: true },
      { label: "Pełna galeria zdjęć (bez limitu)", val: true },
      { label: "Pełna analityka - kliknięcia, dodania, oceny", val: true },
      { label: "Aktualności i promocje w feedzie", val: true },
    ],
  },
  {
    name: "Enterprise",
    subtitle: "Dla sieciówek i sieci lokali",
    price: "Wycena indywidualna",
    cta: "Porozmawiajmy",
    highlight: false,
    danger: false,
    features: [
      { label: "Wszystko z pakietu Premium", val: true },
      { label: "Wiele lokalizacji pod jednym kontem", val: true },
      { label: "Dedykowany opiekun konta", val: true },
      { label: "Zbiorcza analityka dla wszystkich lokali", val: true },
      { label: "Priorytetowe wyróżnienie w wynikach", val: true },
      { label: "Integracja z systemem rezerwacji", val: true },
    ],
  },
];

// ─── Feature icon ──────────────────────────────────────────────────────────────

function FeatureVal({ val }: { val: boolean | string }) {
  if (val === true) return <Check className="h-4 w-4 text-blue-500 shrink-0" strokeWidth={2.5} />;
  if (val === false) return <X className="h-4 w-4 text-slate-300 shrink-0" strokeWidth={2} />;
  return (
    <span className="text-[9px] font-black shrink-0 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200 uppercase tracking-wide whitespace-nowrap">
      podstawowa
    </span>
  );
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

export default function ForBusinessPage() {

  return (
    <div className="min-h-[100dvh] bg-[#FEFEFE] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl">
        <div className="bg-[#1a1a1a] rounded-full px-5 h-14 flex items-center justify-between shadow-xl">
          <a href="/" className="flex items-center">
            <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          </a>
          <div className="hidden sm:flex items-center gap-5">
            <button
              onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              Pakiety
            </button>
            <button
              onClick={() => document.getElementById("faq-biznes")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              FAQ
            </button>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-all border border-orange-500/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Dla podróżujących
            </a>
            <a
              href="mailto:trasa.app@gmail.com"
              className="text-sm font-bold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all"
            >
              Kontakt →
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="min-h-[85dvh] flex items-center">
        <div className="max-w-5xl mx-auto px-5 pt-28 pb-16 w-full text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-8">
            <MapPin className="h-3.5 w-3.5" />
            Lokalne biznesy
          </div>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground leading-[1.05] mb-6 mx-auto"
            style={{ fontFamily: "'Baloo 2', 'Inter', sans-serif", letterSpacing: "-0.02em", maxWidth: "18ch", textWrap: "balance" } as React.CSSProperties}
          >
            Bądź tam, gdzie{" "}
            <span className="bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">
              turyści szukają
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-[52ch] mx-auto">
            trasa to aplikacja, w której turyści poznają się z miastem. Twój lokal może pojawić się już dzisiaj w ich planach!
          </p>
          <a
            href="mailto:trasa.app@gmail.com"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-200"
          >
            Daj się odkryć →
          </a>
          <p className="text-xs text-muted-foreground mt-4">Odpisujemy w ciągu 24h</p>
        </div>
      </section>

      {/* ── Model zero - loss aversion ── */}
      <section className="py-24 px-5 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Model zero</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-white mb-4"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Gdy Cię nie ma na Trasie - tracisz.
            </h2>
            <p className="text-base text-white/50 max-w-[48ch] mx-auto leading-relaxed">
              Użytkownicy planują wyjazd do Twojego miasta. Wybierają miejsca z listy.
              Jeśli Cię tam nie ma - trafiają do konkurencji.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { num: "0", label: "wyświetleń Twojego lokalu", sub: "niewidoczny dla planujących" },
              { num: "0 zł", label: "przychodów z trasy", sub: "konkurencja zarabia zamiast Ciebie" },
              { num: "∞", label: "traconych okazji dziennie", sub: "każdy plan to szansa której nie masz" },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100} className="h-full">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center h-full flex flex-col items-center justify-center min-h-[140px]">
                  <p className="text-4xl font-black text-red-400 mb-1">{item.num}</p>
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
              Wybierz jak chcesz być widoczny
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {TIERS.map((tier, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className={`rounded-3xl p-6 h-full flex flex-col ${
                  tier.highlight
                    ? "bg-blue-600 text-white shadow-2xl shadow-blue-200 ring-2 ring-blue-400 ring-offset-2"
                    : tier.danger
                    ? "bg-slate-900 border border-white/10"
                    : "bg-white border border-border/50 shadow-sm"
                }`}>
                  <div className="mb-6">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${tier.highlight ? "text-blue-200" : tier.danger ? "text-red-400" : "text-muted-foreground"}`}>
                      {tier.name}
                    </p>
                    <h3 className={`text-xl font-black mb-2 ${tier.highlight ? "text-white" : tier.danger ? "text-white" : "text-foreground"}`}>
                      {tier.subtitle}
                    </h3>
                    <p className={`text-sm font-bold ${tier.highlight ? "text-blue-100" : tier.danger ? "text-red-300" : "text-muted-foreground"}`}>
                      {tier.price ?? "Brak obecności"}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-3 flex-1 mb-6">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        {tier.danger
                          ? <X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                          : <FeatureVal val={f.val} />
                        }
                        <span className={`text-sm leading-snug ${
                          tier.highlight ? "text-blue-100" : tier.danger ? "text-white/50" : "text-muted-foreground"
                        }`}>
                          {f.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tier.cta && (
                    <a
                      href="mailto:trasa.app@gmail.com"
                      className={`mt-auto text-center text-sm font-bold px-4 py-3 rounded-2xl transition-all active:scale-95 ${
                        tier.highlight
                          ? "bg-white text-blue-600 hover:bg-blue-50"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      }`}
                    >
                      {tier.cta} →
                    </a>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Premium features ── */}
      <section className="py-24 px-5 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Premium</p>
            <h2
              className="text-3xl sm:text-4xl font-black text-foreground"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Co dostajesz w pakiecie Premium
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {PREMIUM_FEATURES.map((feat, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="bg-white rounded-3xl p-6 border border-border/40 shadow-sm hover:shadow-md hover:shadow-blue-100/60 transition-shadow h-full">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                    {feat.icon}
                  </div>
                  <h3 className="font-black text-base text-foreground mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq-biznes" className="py-24 px-5">
        <div className="max-w-2xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground" style={{ textWrap: "balance" } as React.CSSProperties}>
              Najczęściej zadawane pytania
            </h2>
          </FadeIn>
          <FadeIn>
            <FaqAccordion items={[
              {
                q: "Jak dodać swój lokal do trasy?",
                a: "Napisz do nas na trasa.app@gmail.com. Odpiszemy w ciągu 24h, dodamy Twój lokal do bazy i skonfigurujemy profil razem z Tobą.",
              },
              {
                q: "Czym różni się Basic od Premium?",
                a: "Basic daje Ci widoczność w trasach użytkowników, jedno zdjęcie profilowe i podstawowe statystyki wyświetleń. Premium to pełna galeria zdjęć, szczegółowa analityka (kliknięcia, dodania do trasy, oceny), aktualności i promocje w feedzie oraz wyróżnienie w wynikach wyszukiwania.",
              },
              {
                q: "Ile kosztuje pakiet Premium?",
                a: "Przez pierwsze 3 miesiące pakiet Premium jest całkowicie darmowy. Po tym czasie przechodzimy na wycenę indywidualną - napisz do nas, żeby ustalić szczegóły.",
              },
              {
                q: "Jak wygląda analityka?",
                a: "W panelu biznesowym widzisz ile osób wyświetliło Twój profil, ile kliknęło w szczegóły i ile dodało lokal do swojej trasy. W pakiecie Premium dane są podzielone na dni i źródła ruchu.",
              },
              {
                q: "Czy mogę zarządzać wieloma lokalami?",
                a: "Tak - pakiet Enterprise jest stworzony z myślą o sieciach i właścicielach kilku lokali. Jedno konto, wiele lokalizacji, zbiorcze statystyki. Napisz do nas po szczegóły.",
              },
            ]} />
          </FadeIn>
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
            Niech turyści sami Cię znajdą
          </h2>
          <p className="text-base text-muted-foreground mb-8 max-w-[40ch] mx-auto">
            Napisz do nas - ustalimy szczegóły i dodamy Twój lokal do bazy.
          </p>
          <a
            href="mailto:trasa.app@gmail.com"
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
