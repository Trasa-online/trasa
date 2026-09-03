import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import posthog from "posthog-js";
import { capabilities } from "@/lib/platform";

/* ─────────────────────────────────────────────────────────────────────────────
   Landing B2C (spontaway) - web-only, stoi pod "/" (spontaway.com).
   Figma: [NEW] Ekrany > Landing (web) > "Landing B2C (web) / (mobile) - strona (high-fi copy)"
   Desktop = kanwa 1440 (wartosci 1:1 z Figmy), mobile = kanwa 320 (iPhone SE)
   przeskalowana w gore do realnych telefonow (decyzja Nat, 2026-09-02).
   ────────────────────────────────────────────────────────────────────────── */

// Premiera: dopoki APP_LIVE=false plakietki sklepowe sa WYGASZONE, a kazde CTA
// otwiera modal "wkrotce". W dniu premiery zmieniasz JEDNA linie ponizej na true -
// link do App Store jest juz realny (Apple ID 6777705751, bundle travel.trasa.app).
const APP_LIVE = false;
const APP_STORE_URL = "https://apps.apple.com/pl/app/spontaway/id6777705751";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=travel.trasa.app";

// ─── Polskie sieroty ──────────────────────────────────────────────────────────
// Pojedyncze litery (a i o u w z) i krotkie przyimki nie moga konczyc linii.
// Regex leci dwa razy, bo sasiadujace trafienia zjadaja wspolna spacje ("i o tym").
const ORPHANS = /(^|[\s("„])([aiouwz]|do|na|po|za|ze|od|we)\s+/gi;
const nb = (s: string) => s.replace(ORPHANS, "$1$2\u00A0").replace(ORPHANS, "$1$2\u00A0");

// ─── Copy (bramka jezykowa: ?lang=en; domyslnie PL) ───────────────────────────

type Lang = "pl" | "en";

const COPY = {
  pl: {
    htmlTitle: "spontaway - odkrywaj, planuj, dziel się!",
    banner: { name: "Spontaway", tagline: "Odkrywaj, planuj, dziel się! Za darmo!", cta: "Pobierz", close: "Zamknij baner" },
    nav: { login: "Zaloguj się", download: "Pobierz apkę", loginLong: "Zaloguj się lub załóż konto" },
    hero: {
      titleA: "Najlepsze wspomnienia",
      titleB: "zaczynają się od polecenia",
      subA: "Ze ",
      subB: "Spontaway ",
      subC: "odkrywasz, planujesz i dzielisz się swoimi doświadczeniami ",
      subD: "pomagając innym.",
      ctaPrimary: "Zacznij odkrywać",
      ctaSecondary: "Pobierz aplikację",
      storeNote: "Aplikacja dostępna wkrótce również w Google Play!",
    },
    features: [
      { title: "Odkrywaj najlepsze\nmiejsca i wydarzenia", body: "Zobacz gdzie i jak najlepiej spędzić czas.", cta: "Zacznij odkrywać", img: "/mockup_odkrywaj.png", alt: "Karty miejsc i wydarzeń w aplikacji Spontaway" },
      { title: "Twórz własne\nlisty tematyczne", body: "Odwiedzone lub te, które chcesz odwiedzić.\nZapisuj miejsca i podziel się z innymi swoją opinią.", cta: "Stwórz pierwszą listę", img: "/mockup_listy.png", alt: "Lista miejsc „Fav kawiarnie” w aplikacji Spontaway" },
      { title: "Dziel się wrażeniami\nz przeżytych podróży", body: "Planuj i twórz podsumowania wyjazdów, pomagając innym użytkownikom w ich podróżach.", cta: "Dodaj pierwszy wyjazd", img: "/mockup_dziel_sie.png", alt: "Planowanie wyjazdu i podsumowanie podróży w aplikacji Spontaway" },
    ],
    stats: { heading: "SPONTAWAY TO", countries: "Krajów", cities: "Miast", possibilities: "Możliwości" },
    business: {
      navLink: "Dla firm",
      eyebrow: "Dla firm",
      title: "Prowadzisz lokal?",
      body: "Dodaj swoją wizytówkę i pokaż się osobom, które właśnie planują, gdzie pójść. Wizytówka jest za darmo.",
      cta: "Sprawdź, jak to działa",
      login: "Zaloguj się do panelu",
    },
    footerCta: { title: "Odkrywaj, planuj, dziel się!", sub: "Pobierz Spontaway i zacznij zabawę", note: "Za darmo na iOS... i wkrótce na Android!" },
    footer: { rights: "© 2026 Spontaway · Stworzone z", inPoland: "w Polsce", terms: "Regulamin", privacy: "Prywatność" },
    modal: {
      titleSoon: "Premiera już wkrótce",
      titleLive: "Pobierz Spontaway",
      bodySoon: "Spontaway pojawia się w App Store lada moment. Zajrzyj tu za chwilę - albo od razu weź telefon do ręki, żeby nic nie przegapić.",
      bodyLive: "Zeskanuj kod telefonem albo pobierz aplikację prosto ze sklepu.",
      badge: "Za darmo · bez zobowiązań",
      qrHint: "Zeskanuj kod telefonem",
      close: "Zamknij",
    },
  },
  en: {
    htmlTitle: "spontaway - discover, plan, share!",
    banner: { name: "Spontaway", tagline: "Discover, plan, share! For free!", cta: "Get", close: "Close banner" },
    nav: { login: "Log in", download: "Get the app", loginLong: "Log in or create an account" },
    hero: {
      titleA: "The best memories",
      titleB: "start with a recommendation",
      subA: "With ",
      subB: "Spontaway ",
      subC: "you discover, plan and share your experiences ",
      subD: "to help others.",
      ctaPrimary: "Start exploring",
      ctaSecondary: "Get the app",
      storeNote: "Coming soon to Google Play as well!",
    },
    features: [
      { title: "Discover the best\nplaces and events", body: "See where and how to spend your time best.", cta: "Start exploring", img: "/mockup_odkrywaj.png", alt: "Place and event cards in the Spontaway app" },
      { title: "Build your own\nthemed lists", body: "Places you have been to, or the ones you still want to see.\nSave them and share your take with others.", cta: "Create your first list", img: "/mockup_listy.png", alt: "A place list in the Spontaway app" },
      { title: "Share what you brought\nback from a trip", body: "Plan your trips and turn them into recaps that help other travellers.", cta: "Add your first trip", img: "/mockup_dziel_sie.png", alt: "Trip planning and trip recap in the Spontaway app" },
    ],
    stats: { heading: "SPONTAWAY IS", countries: "Countries", cities: "Cities", possibilities: "Possibilities" },
    business: {
      navLink: "For business",
      eyebrow: "For business",
      title: "Running a place?",
      body: "Add your listing and show up for people who are deciding where to go right now. Listings are free.",
      cta: "See how it works",
      login: "Log in to the panel",
    },
    footerCta: { title: "Discover, plan, share!", sub: "Get Spontaway and start the fun", note: "Free on iOS... and soon on Android!" },
    footer: { rights: "© 2026 Spontaway · Made with", inPoland: "in Poland", terms: "Terms", privacy: "Privacy" },
    modal: {
      titleSoon: "Launching very soon",
      titleLive: "Get Spontaway",
      bodySoon: "Spontaway lands in the App Store any moment now. Come back shortly, or grab your phone so you do not miss it.",
      bodyLive: "Scan the code with your phone, or download the app straight from the store.",
      badge: "Free · no strings attached",
      qrHint: "Scan the code with your phone",
      close: "Close",
    },
  },
} as const;

type Copy = (typeof COPY)["pl"];

// ─── Znak marki ───────────────────────────────────────────────────────────────

function Wordmark({ className }: { className?: string }) {
  return <img src="/wordmark_spontaway.svg" alt="spontaway" className={className} width={240} height={43} />;
}

// ─── Plakietki sklepowe ───────────────────────────────────────────────────────
// Przed premiera wygaszone (decyzja Nat): klik otwiera modal zamiast prowadzic do
// sklepu, bo apki jeszcze tam nie ma.

function StoreBadges({ onDownload, className = "", height = 54 }: { onDownload: () => void; className?: string; height?: number }) {
  const badges = [
    { src: "/AppStore.png", alt: "Pobierz w App Store", href: APP_STORE_URL, w: 162, h: 54 },
    { src: "/GooglePlay.png", alt: "Pobierz z Google Play", href: PLAY_STORE_URL, w: 183, h: 54 },
  ];
  return (
    <div className={`flex items-center gap-[14px] lg:gap-[23px] ${className}`}>
      {badges.map((b) => {
        const img = (
          <img
            src={b.src}
            alt={b.alt}
            width={b.w}
            height={b.h}
            style={{ height, width: (b.w / b.h) * height, filter: APP_LIVE ? undefined : "grayscale(1) opacity(0.55)" }}
          />
        );
        // Po premierze: iOS = realny link, Android nadal wygaszony (nie ma buildu).
        return APP_LIVE && b.href === APP_STORE_URL ? (
          <a key={b.src} href={b.href} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture("landing_store_badge_click", { store: "ios" })}>
            {img}
          </a>
        ) : (
          <button key={b.src} type="button" onClick={onDownload} aria-label={b.alt} className="cursor-pointer">
            {img}
          </button>
        );
      })}
    </div>
  );
}

// ─── Guziki ───────────────────────────────────────────────────────────────────
// Kazde CTA na stronie otwiera modal pobrania (decyzja Nat) - apka jest native-only,
// wiec na webie nie ma dokad prowadzic.

function Pill({
  children,
  tone = "orange",
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "orange" | "brown";
  onClick: () => void;
  className?: string;
}) {
  const bg = tone === "orange" ? "bg-spontaway-orange hover:bg-[#d94a05]" : "bg-spontaway-brown hover:bg-[#4a2405]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${bg} inline-flex items-center justify-center rounded-full px-6 font-extrabold text-white transition-colors active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Modal pobrania ───────────────────────────────────────────────────────────

function DownloadModal({ c, onClose }: { c: Copy; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-5 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={c.modal.close}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-spontaway-brown transition-colors hover:bg-black/10"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex flex-col items-center bg-spontaway-yellow px-6 pb-7 pt-9 text-center">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-[18px] bg-white">
            <img src="/logo.svg" alt="" width={37} height={33} className="w-[34px]" />
          </div>
          <h2 className="mt-4 font-brand text-[26px] leading-[1.15] text-spontaway-orange">
            {APP_LIVE ? c.modal.titleLive : c.modal.titleSoon}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.45] text-spontaway-brown">
            {nb(APP_LIVE ? c.modal.bodyLive : c.modal.bodySoon)}
          </p>
          <span className="mt-4 rounded-full bg-white/70 px-3 py-1 text-[12px] font-bold text-spontaway-orange">
            {nb(c.modal.badge)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 py-7">
          {APP_LIVE && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-black/10 p-3">
                <QRCodeSVG value={APP_STORE_URL} size={116} bgColor="#ffffff" fgColor="#5B2C06" />
              </div>
              <p className="text-[12px] text-spontaway-brown/70">{nb(c.modal.qrHint)}</p>
            </div>
          )}
          <StoreBadges onDownload={() => {}} height={44} />
          <p className="text-center text-[12px] font-medium text-spontaway-brown/70">{nb(c.footerCta.note)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Baner instalacyjny (tylko mobile) ────────────────────────────────────────
// Po premierze Safari na iOS pokazuje wlasny Smart App Banner Apple (meta
// apple-itunes-app w index.html), wiec tam chowamy nasz - dwa paski jeden pod drugim
// to szum. Przed premiera baner Apple sie nie renderuje (apki nie ma jeszcze w sklepie),
// wiec nasz zostaje wszedzie.

function InstallBanner({ c, onDownload }: { c: Copy; onDownload: () => void }) {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("spontaway_install_banner_dismissed") === "1");
  if (hidden || (APP_LIVE && capabilities.appleSmartBanner)) return null;
  return (
    <div className="flex items-center gap-3 border-b border-spontaway-yellow bg-[#F9F9F9] px-4 py-2.5 lg:hidden">
      <button
        type="button"
        aria-label={c.banner.close}
        onClick={() => { sessionStorage.setItem("spontaway_install_banner_dismissed", "1"); setHidden(true); }}
        className="shrink-0 text-spontaway-brown"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] bg-spontaway-yellow">
        <img src="/logo.svg" alt="" width={37} height={33} className="w-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-tight text-spontaway-brown">{c.banner.name}</p>
        <p className="truncate text-[11px] leading-tight text-spontaway-brown">{nb(c.banner.tagline)}</p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="shrink-0 rounded-full border border-spontaway-orange px-3 py-1.5 text-[11px] font-semibold text-spontaway-orange"
      >
        {c.banner.cta}
      </button>
    </div>
  );
}

// ─── Nawigacja ────────────────────────────────────────────────────────────────
// Bez menu / hamburgera - landing nie ma nawigacji (decyzja Nat 2026-09-02),
// pasek to wylacznie znak marki + CTA.

function Nav({ c, onDownload }: { c: Copy; onDownload: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-[#F9F9F9] shadow-[0_4px_25px_0_rgba(0,0,0,0.05)]">
      <InstallBanner c={c} onDownload={onDownload} />
      <div className="mx-auto flex h-[56px] max-w-[1440px] items-center justify-between px-5 lg:h-[80px] lg:px-[120px]">
        <Wordmark className="h-[17px] w-auto shrink-0 sm:h-[19px] lg:h-[33px]" />
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Wejscie dla lokali. Tekstowy link, nie guzik - to sciezka poboczna wobec
              glownego CTA konsumenckiego, a kolor marki B2B (niebieski) zostaje w samej
              sekcji nizej, zeby nie rozbijac pomaranczowego naglowka. */}
          <Link
            to="/dla-firm"
            onClick={() => posthog.capture("landing_business_click", { placement: "nav" })}
            className="whitespace-nowrap px-1 text-[10px] font-semibold text-spontaway-brown underline-offset-2 hover:underline sm:text-[11px] lg:px-2 lg:text-[15px]"
          >
            {c.business.navLink}
          </Link>
          <Pill tone="brown" onClick={onDownload} className="hidden h-[47px] text-[15px] lg:inline-flex">
            {c.nav.login}
          </Pill>
          <Pill tone="orange" onClick={onDownload} className="h-[36px] whitespace-nowrap px-3 text-[10px] sm:px-4 sm:text-[11px] lg:h-[47px] lg:px-6 lg:text-[15px]">
            <span className="sm:hidden">{c.nav.login}</span>
            <span className="hidden sm:inline lg:hidden">{c.nav.loginLong}</span>
            <span className="hidden lg:inline">{c.nav.download}</span>
          </Pill>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ c, onDownload }: { c: Copy; onDownload: () => void }) {
  return (
    <section className="px-4 pt-6 lg:px-[50px] lg:pt-[53px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-spontaway-yellow px-6 py-10 text-center lg:h-[644px] lg:flex-row lg:items-center lg:justify-between lg:rounded-[36px] lg:px-[70px] lg:py-0 lg:text-left">
        {/* Kolumna z tekstem */}
        <div className="order-1 w-full lg:w-[686px] lg:shrink-0">
          <h1 className="font-brand text-[32px] leading-[1.15] text-spontaway-orange lg:text-[48px] lg:leading-[1.2]">
            {nb(c.hero.titleA)}
            <br className="hidden lg:block" />{" "}
            {nb(c.hero.titleB)}
          </h1>
          <p className="mx-auto mt-3 max-w-[280px] text-[14px] leading-[1.4] text-spontaway-brown lg:mx-0 lg:mt-5 lg:max-w-[554px] lg:text-[20px] lg:leading-[1.3]">
            {c.hero.subA}
            {c.hero.subB}
            <strong className="font-bold">{nb(c.hero.subC)}</strong>
            {nb(c.hero.subD)}
          </p>

          {/* Mobile: plakietki nad mockupem, guziki pod nim (uklad z Figmy) */}
          <div className="mt-6 flex flex-col items-center lg:hidden">
            <StoreBadges onDownload={onDownload} height={40} />
            <p className="mt-3 max-w-[260px] text-[11px] leading-[1.5] text-spontaway-brown">{nb(c.hero.storeNote)}</p>
          </div>

          <div className="hidden lg:block">
            <div className="mt-[29px] flex items-center gap-[10px]">
              <Pill tone="orange" onClick={onDownload} className="h-[47px] w-[215px] text-[16px]">{c.hero.ctaPrimary}</Pill>
              <Pill tone="brown" onClick={onDownload} className="h-[47px] text-[16px]">{c.hero.ctaSecondary}</Pill>
            </div>
            <StoreBadges onDownload={onDownload} className="mt-[123px]" height={54} />
            <p className="mt-[19px] text-[17px] leading-[1.5] text-spontaway-brown">{nb(c.hero.storeNote)}</p>
          </div>
        </div>

        {/* Telefony z aplikacja */}
        <img
          src="/hero_mockup.png"
          alt="Aplikacja Spontaway: trasa po Łodzi i profil z wyjazdem do Gdańska"
          width={722}
          height={774}
          className="order-2 mt-6 w-full max-w-[320px] lg:mt-0 lg:w-[455px] lg:max-w-none"
        />

        {/* Mobile: guziki na koncu karty */}
        <div className="order-3 mt-6 flex w-full flex-col items-center gap-3 lg:hidden">
          <Pill tone="orange" onClick={onDownload} className="h-[44px] w-full max-w-[264px] text-[14px]">{c.hero.ctaPrimary}</Pill>
          <Pill tone="brown" onClick={onDownload} className="h-[44px] w-full max-w-[264px] text-[14px]">{c.hero.ctaSecondary}</Pill>
        </div>
      </div>
    </section>
  );
}

// ─── Sekcja z funkcja ─────────────────────────────────────────────────────────

function Feature({
  title,
  body,
  cta,
  img,
  alt,
  imgWidth,
  imgHeight,
  imgClass,
  bodyWidth,
  side,
  onDownload,
}: {
  title: string; body: string; cta: string; img: string; alt: string;
  imgWidth: number; imgHeight: number; imgClass: string; bodyWidth: number;
  side: "left" | "right";
  onDownload: () => void;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-[160px] lg:py-[88px]">
      <div className={`flex flex-col items-center gap-8 lg:flex-row lg:justify-between lg:gap-[60px] ${side === "left" ? "lg:flex-row-reverse" : ""}`}>
        <div className="w-full text-center lg:w-[460px] lg:shrink-0 lg:text-left">
          <h2 className="whitespace-normal font-brand text-[24px] leading-[1.2] text-spontaway-orange sm:text-[26px] lg:whitespace-pre-line lg:text-[36px]">{nb(title)}</h2>
          <p style={{ ["--bw" as string]: `${bodyWidth}px` }} className="mx-auto mt-3 whitespace-normal text-[15px] leading-[1.35] text-spontaway-brown lg:mx-0 lg:max-w-[var(--bw)] lg:whitespace-pre-line lg:text-[18px]">{nb(body)}</p>
          <Pill tone="orange" onClick={onDownload} className="mt-6 h-[44px] px-6 text-[14px] lg:mt-[64px] lg:h-[44px] lg:text-[15px]">{cta}</Pill>
        </div>
        <img src={img} alt={alt} width={imgWidth} height={imgHeight} className={imgClass} loading="lazy" />
      </div>
    </section>
  );
}

// ─── Pasek statystyk ──────────────────────────────────────────────────────────

function Stats({ c }: { c: Copy }) {
  const items = [
    { value: "90+", label: c.stats.countries },
    { value: "300+", label: c.stats.cities },
    { value: null, label: c.stats.possibilities },
  ];
  return (
    <section className="bg-spontaway-yellow py-12 lg:py-16">
      <h2 className="text-center font-brand text-[26px] leading-none tracking-[1.6px] text-spontaway-brown lg:text-[36px]">
        {c.stats.heading}
      </h2>
      <div className="mt-10 flex flex-col items-center justify-center gap-[54px] lg:mt-4 lg:flex-row lg:items-end lg:gap-[101px]">
        {items.map((it) => (
          <div key={it.label} className={`flex flex-col items-center gap-4 ${it.value ? "lg:gap-0" : "lg:gap-[34px]"}`}>
            {it.value ? (
              <p className="font-brand text-[72px] leading-[1.38] text-spontaway-orange lg:text-[120px]">{it.value}</p>
            ) : (
              <img src="/spontaway-infinity.svg" alt="" width={155} height={71} className="h-[52px] w-auto lg:h-[71px]" aria-hidden="true" />
            )}
            <p className="text-[17px] font-extrabold leading-[1.38] text-spontaway-brown lg:text-[24px]">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Dla firm (wersja robocza) ────────────────────────────────────────────────
// Wejscie dla lokali. Akcent NIEBIESKI, bo caly kontekst B2B ma w marce wlasna
// identyfikacje (CLAUDE.md) - pomarancz zostaje dla konsumenta. Tresc jest tymczasowa,
// docelowo zastapi ja pelna sekcja marketingowa.

function BusinessStrip({ c }: { c: Copy }) {
  const track = (placement: string) => posthog.capture("landing_business_click", { placement });
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-4 lg:px-[50px]">
      <div className="flex flex-col items-center gap-6 rounded-[28px] border border-slate-200 bg-[#F8FAFC] px-6 py-10 text-center lg:flex-row lg:justify-between lg:gap-10 lg:rounded-[36px] lg:px-[70px] lg:py-[56px] lg:text-left">
        <div>
          <p className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-blue-600 lg:text-[13px]">
            {c.business.eyebrow}
          </p>
          <h2 className="mt-2 font-brand text-[24px] leading-[1.2] text-spontaway-brown sm:text-[26px] lg:text-[36px]">
            {nb(c.business.title)}
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-[1.4] text-slate-600 lg:mx-0 lg:text-[17px]">
            {nb(c.business.body)}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-center gap-3 sm:w-auto sm:flex-row lg:flex-col lg:items-end">
          <Link
            to="/dla-firm"
            onClick={() => track("section_cta")}
            className="inline-flex h-[44px] w-full items-center justify-center whitespace-nowrap rounded-full bg-blue-600 px-6 text-[14px] font-extrabold text-white transition-colors hover:bg-blue-700 active:scale-[0.98] sm:w-auto lg:h-[47px] lg:text-[15px]"
          >
            {c.business.cta}
          </Link>
          <Link
            to="/auth?business=true"
            onClick={() => track("section_login")}
            className="whitespace-nowrap text-[14px] font-semibold text-blue-600 underline-offset-2 hover:underline"
          >
            {c.business.login}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── CTA na koncu strony ──────────────────────────────────────────────────────

function FooterCta({ c, onDownload }: { c: Copy; onDownload: () => void }) {
  return (
    <section className="px-4 py-12 lg:px-[50px] lg:py-[125px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-spontaway-yellow px-6 py-10 text-center lg:h-[480px] lg:justify-center lg:rounded-[36px] lg:py-0">
        <Wordmark className="h-[32px] w-auto lg:h-[43px]" />
        <h2 className="mt-6 font-brand text-[30px] leading-[1.14] text-spontaway-orange lg:mt-[43px] lg:text-[64px]">
          {nb(c.footerCta.title)}
        </h2>
        <p className="mt-5 text-[14px] leading-[1.5] text-spontaway-brown lg:mt-[42px] lg:text-[17px]">{nb(c.footerCta.sub)}</p>
        <StoreBadges onDownload={onDownload} className="mt-5 lg:mt-[19px]" height={44} />
        <p className="mt-4 text-[12px] font-medium text-spontaway-brown lg:mt-[20px] lg:text-[14px]">{nb(c.footerCta.note)}</p>
      </div>
    </section>
  );
}

// ─── Stopka ───────────────────────────────────────────────────────────────────

function FooterBar({ c }: { c: Copy }) {
  return (
    <footer className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-5 pb-8 text-[13px] text-[#6B6B75] lg:h-[96px] lg:flex-row lg:justify-center lg:gap-0 lg:px-[120px] lg:pb-0 lg:text-[14px]">
      <p className="flex items-center gap-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
        {c.footer.rights}
        <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true" className="text-spontaway-orange">
          <path d="M6.5 11S1 7.7 1 4.2A2.9 2.9 0 016.5 2.6 2.9 2.9 0 0112 4.2C12 7.7 6.5 11 6.5 11z" fill="currentColor" />
        </svg>
        {nb(c.footer.inPoland)}
      </p>
      <div className="flex gap-6 lg:ml-auto">
        <Link to="/terms" className="hover:text-spontaway-brown">{c.footer.terms}</Link>
        <Link to="/privacy" className="hover:text-spontaway-brown">{c.footer.privacy}</Link>
      </div>
    </footer>
  );
}

// ─── Strona ───────────────────────────────────────────────────────────────────

export default function SpontawayLanding() {
  const [params] = useSearchParams();
  const lang: Lang = params.get("lang") === "en" ? "en" : "pl";
  const c = COPY[lang] as Copy;
  const [modalOpen, setModalOpen] = useState(false);

  const openDownload = useCallback((placement: string) => {
    posthog.capture("landing_download_modal_open", { placement, app_live: APP_LIVE });
    setModalOpen(true);
  }, []);

  useEffect(() => {
    document.title = c.htmlTitle;
    document.documentElement.lang = lang;
  }, [c.htmlTitle, lang]);

  const features = c.features;
  const imgMeta = [
    { w: 1038, h: 616, cls: "w-full max-w-[340px] lg:w-[676px] lg:max-w-none", body: 399 },
    { w: 900, h: 792, cls: "w-full max-w-[340px] lg:w-[574px] lg:max-w-none", body: 382 },
    { w: 834, h: 733, cls: "w-full max-w-[340px] lg:w-[556px] lg:max-w-none", body: 460 },
  ];

  return (
    <div className="min-h-dvh bg-[#FEFEFE] font-body">
      <Nav c={c} onDownload={() => openDownload("nav")} />
      <main>
        <Hero c={c} onDownload={() => openDownload("hero")} />
        {features.map((f, i) => (
          <Feature
            key={f.img}
            title={f.title}
            body={f.body}
            cta={f.cta}
            img={f.img}
            alt={f.alt}
            imgWidth={imgMeta[i].w}
            imgHeight={imgMeta[i].h}
            imgClass={imgMeta[i].cls}
            bodyWidth={imgMeta[i].body}
            side={i === 1 ? "left" : "right"}
            onDownload={() => openDownload(`feature_${i + 1}`)}
          />
        ))}
        <Stats c={c} />
        <BusinessStrip c={c} />
        <FooterCta c={c} onDownload={() => openDownload("footer_cta")} />
      </main>
      <FooterBar c={c} />
      {modalOpen && <DownloadModal c={c} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
