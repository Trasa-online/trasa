import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import posthog from "posthog-js";
import { supabase } from "@/integrations/supabase/client";
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
// Twarde spacje po jednoliterowych spojnikach to regula POLSKA. Po angielsku ten sam wzorzec
// zlapalby "a", "I", "we", "do" i sklejal je z nastepnym slowem, psujac lamanie wierszy -
// dlatego `nb` dostaje jezyk i po angielsku oddaje tekst bez zmian.
const nbFor = (lang: Lang) => (s: string) =>
  lang === "en" ? s : s.replace(ORPHANS, "$1$2\u00A0").replace(ORPHANS, "$1$2\u00A0");

// Helper podajemy kontekstem, a nie propsem przez osiem komponentow - i tak zalezy tylko
// od jezyka strony, ktory jest jeden na cala stronę.
const NbContext = createContext<(s: string) => string>((s) => s);
const useNb = () => useContext(NbContext);

// ─── Copy (bramka jezykowa: ?lang=en; domyslnie PL) ───────────────────────────

type Lang = "pl" | "en";

// i18n-ignore-start: landing ma WLASNY, kompletny slownik dwujezyczny (COPY.pl / COPY.en
// przelaczany przez ?lang=en) - nie idzie przez ns i18next, wiec polski w galezi `pl`
// to nie jest brak tlumaczenia. Zmieniajac cokolwiek tutaj, zmien to w OBU galeziach.
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
      heroAlt: "Aplikacja Spontaway: trasa po Łodzi i profil z wyjazdem do Gdańska",
    },
    features: [
      { title: "Odkrywaj najlepsze\nmiejsca i wydarzenia", body: "Zobacz gdzie i jak najlepiej spędzić czas.", cta: "Zacznij odkrywać", img: "/mockup_odkrywaj.png", alt: "Karty miejsc i wydarzeń w aplikacji Spontaway" },
      { title: "Twórz własne\nlisty tematyczne", body: "Odwiedzone lub te, które chcesz odwiedzić.\nZapisuj miejsca i podziel się z innymi swoją opinią.", cta: "Stwórz pierwszą listę", img: "/mockup_listy.png", alt: "Lista miejsc „Fav kawiarnie” w aplikacji Spontaway" },
      { title: "Dziel się wrażeniami\nz przeżytych podróży", body: "Planuj i twórz podsumowania wyjazdów, pomagając innym użytkownikom w ich podróżach.", cta: "Dodaj pierwszy wyjazd", img: "/mockup_dziel_sie.png", alt: "Planowanie wyjazdu i podsumowanie podróży w aplikacji Spontaway" },
    ],
    stats: { heading: "SPONTAWAY TO", countries: "Krajów", cities: "Miast", possibilities: "Możliwości" },
    business: {
      navLink: "Dla firm",
      title: "Prowadzisz lokal?",
      body: "Dodaj swoją wizytówkę i pokaż się podróżującym, którzy właśnie planują, gdzie i co odwiedzić!",
      free: "Założenie konta nic nie kosztuje.",
      cta: "Załóż konto",
      login: "Zaloguj się do panelu",
    },
    footerCta: { title: "Odkrywaj, planuj, dziel się!", sub: "Pobierz Spontaway i zacznij zabawę", note: "Za darmo na iOS... i wkrótce na Android!" },
    footer: { rights: "© 2026 Spontaway · Stworzone z", inPoland: "w Polsce", terms: "Regulamin", privacy: "Prywatność" },
    modal: {
      titleSoon: "Premiera już wkrótce",
      titleLive: "Pobierz Spontaway",
      bodySoon: "Spontaway pojawi się w App Store lada moment. Zostaw swojego maila, a powiadomimy Cię o starcie:",
      bodyLive: "Zeskanuj kod telefonem albo pobierz aplikację prosto ze sklepu.",
      qrHint: "Zeskanuj kod telefonem",
      close: "Zamknij",
      emailPlaceholder: "twoj@email.pl",
      submit: "Powiadom mnie",
      sending: "Zapisuję...",
      done: "Dzięki! Napiszemy, jak tylko Spontaway będzie do pobrania.",
      error: "Nie udało się zapisać. Spróbuj jeszcze raz.",
      consentPre: "Zapisując się, zgadzasz się na przetwarzanie adresu e-mail w celu powiadomienia o premierze. Szczegóły w ",
      consentLink: "polityce prywatności",
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
      heroAlt: "The Spontaway app: a route around Lodz and a profile with a trip to Gdansk",
    },
    features: [
      { title: "Discover the best\nplaces and events", body: "See where and how to spend your time best.", cta: "Start exploring", img: "/mockup_odkrywaj.png", alt: "Place and event cards in the Spontaway app" },
      { title: "Build your own\nthemed lists", body: "Places you have been to, or the ones you still want to see.\nSave them and share your take with others.", cta: "Create your first list", img: "/mockup_listy.png", alt: "A place list in the Spontaway app" },
      { title: "Share what you brought\nback from a trip", body: "Plan your trips and turn them into recaps that help other travellers.", cta: "Add your first trip", img: "/mockup_dziel_sie.png", alt: "Trip planning and trip recap in the Spontaway app" },
    ],
    stats: { heading: "SPONTAWAY IS", countries: "Countries", cities: "Cities", possibilities: "Possibilities" },
    business: {
      navLink: "For business",
      title: "Running a place?",
      body: "Add your listing and show up for travellers who are deciding right now where to go and what to see!",
      free: "Creating an account is free.",
      cta: "Create an account",
      login: "Log in to the panel",
    },
    footerCta: { title: "Discover, plan, share!", sub: "Get Spontaway and start the fun", note: "Free on iOS... and soon on Android!" },
    footer: { rights: "© 2026 Spontaway · Made with", inPoland: "in Poland", terms: "Terms", privacy: "Privacy" },
    modal: {
      titleSoon: "Launching very soon",
      titleLive: "Get Spontaway",
      bodySoon: "Spontaway hits the App Store any moment now. Leave your email and we will tell you when it is live:",
      bodyLive: "Scan the code with your phone, or download the app straight from the store.",
      qrHint: "Scan the code with your phone",
      close: "Close",
      emailPlaceholder: "you@email.com",
      submit: "Notify me",
      sending: "Saving...",
      done: "Thanks! We will write as soon as Spontaway is downloadable.",
      error: "Could not save that. Please try again.",
      consentPre: "By signing up you agree to your email being used to notify you about the launch. Details in the ",
      consentLink: "privacy policy",
    },
  },
} as const;
// i18n-ignore-end

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

// Zapis na powiadomienie o premierze. Trafia do tabeli `waitlist` (RLS: "Anyone can join"),
// z oznaczeniem zrodla, zeby dalo sie odroznic te zapisy od starej strony zapisow.
function LaunchNotifyForm({ c, lang }: { c: Copy; lang: Lang }) {
  const nb = useNb();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || state === "sending") return;
    setState("sending");
    // Jezyk zapisujemy przy wierszu, nie tylko w wywolaniu maila: kolejne wysylki
    // (zaproszenie na premiere) maja isc w tym samym jezyku, w ktorym user sie zapisal.
    const { error } = await (supabase as any).from("waitlist").insert({ email: value, source: "landing_modal", language: lang });
    // Duplikat maila to dla usera sukces, nie blad - juz jest zapisany.
    if (error && !String(error.code) .startsWith("23")) {
      setState("error");
      return;
    }
    supabase.functions.invoke("send-waitlist-email", { body: { email: value, lang } });
    posthog.capture("landing_waitlist_signup", { source: "download_modal", lang });
    setState("done");
  };

  if (state === "done") {
    return (
      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[14px] font-semibold text-spontaway-brown">
        {nb(c.modal.done)}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={c.modal.emailPlaceholder}
          className="h-[44px] w-full rounded-full border border-black/10 bg-white px-4 text-[14px] text-spontaway-brown outline-none placeholder:text-black/35 focus:border-spontaway-orange"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="h-[44px] shrink-0 rounded-full bg-spontaway-orange px-5 text-[14px] font-extrabold text-white transition-colors hover:bg-[#d94a05] active:scale-[0.98] disabled:opacity-60"
        >
          {state === "sending" ? c.modal.sending : c.modal.submit}
        </button>
      </div>
      {state === "error" && <p className="text-center text-[12px] font-semibold text-red-600">{nb(c.modal.error)}</p>}
      <p className="px-1 text-center text-[11px] leading-snug text-spontaway-brown/70">
        {nb(c.modal.consentPre)}
        <Link to="/privacy" className="underline">{c.modal.consentLink}</Link>.
      </p>
    </form>
  );
}

function DownloadModal({ c, lang, onClose }: { c: Copy; lang: Lang; onClose: () => void }) {
  const nb = useNb();
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
          {/* Sam znak marki, bez bialego kafelka - na zoltym tle ramka tylko dzielila kompozycje. */}
          <img src="/logo.svg" alt="" width={37} height={33} className="w-[52px]" />
          <h2 className="mt-4 font-brand text-[26px] leading-[1.15] text-spontaway-orange">
            {APP_LIVE ? c.modal.titleLive : c.modal.titleSoon}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.45] text-spontaway-brown">
            {nb(APP_LIVE ? c.modal.bodyLive : c.modal.bodySoon)}
          </p>
          {/* Przed premiera modal zbiera zapisy na powiadomienie - to jedyne miejsce, gdzie
              mierzymy realne zainteresowanie, skoro apki nie da sie jeszcze pobrac. */}
          {!APP_LIVE && (
            <div className="mt-4 w-full">
              <LaunchNotifyForm c={c} lang={lang} />
            </div>
          )}
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
  const nb = useNb();
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
  const nb = useNb();
  return (
    <section className="px-4 pb-12 pt-6 lg:px-[50px] lg:pb-[80px] lg:pt-[53px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-spontaway-yellow px-5 py-10 text-center lg:h-[644px] lg:flex-row lg:items-center lg:justify-between lg:rounded-[36px] lg:px-[40px] lg:py-0 lg:text-left">
        {/* Kolumna z tekstem */}
        <div className="order-1 w-full lg:w-[560px] lg:shrink-0">
          <h1 className="font-brand text-[32px] leading-[1.15] text-spontaway-orange lg:text-[40px] lg:leading-[1.2]">
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
            <StoreBadges onDownload={onDownload} className="mt-[44px]" height={54} />
            <p className="mt-[19px] text-[17px] leading-[1.5] text-spontaway-brown">{nb(c.hero.storeNote)}</p>
          </div>
        </div>

        {/* Telefony z aplikacja */}
        <img
          src="/hero_mockup.png"
          alt={c.hero.heroAlt}
          width={722}
          height={774}
          className="order-2 -mx-5 mt-6 w-[calc(100%+40px)] max-w-none lg:mx-0 lg:mt-0 lg:w-[680px]"
        />

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
  const nb = useNb();
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-[160px] lg:py-[88px]">
      <div className={`flex flex-col items-center gap-8 lg:flex-row lg:justify-between lg:gap-[60px] ${side === "left" ? "lg:flex-row-reverse" : ""}`}>
        <div className="order-2 w-full text-center lg:order-none lg:w-[460px] lg:shrink-0 lg:text-left">
          <h2 className="whitespace-normal font-brand text-[24px] leading-[1.2] text-spontaway-orange sm:text-[26px] lg:whitespace-pre-line lg:text-[36px]">{nb(title)}</h2>
          <p style={{ ["--bw" as string]: `${bodyWidth}px` }} className="mx-auto mt-3 whitespace-normal text-[15px] leading-[1.35] text-spontaway-brown lg:mx-0 lg:max-w-[var(--bw)] lg:whitespace-pre-line lg:text-[18px]">{nb(body)}</p>
          <Pill tone="orange" onClick={onDownload} className="mt-6 h-[44px] w-[216px] px-6 text-[14px] lg:mt-[64px] lg:h-[44px] lg:w-auto lg:text-[15px]">{cta}</Pill>
        </div>
        <img src={img} alt={alt} width={imgWidth} height={imgHeight} className={`order-1 lg:order-none ${imgClass}`} loading="lazy" />
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
  const nb = useNb();
  const track = (placement: string) => posthog.capture("landing_business_click", { placement });
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-4 pt-12 lg:px-[50px] lg:pt-[88px]">
      {/* Niebieski kafelek, bo caly kontekst B2B ma w marce wlasna identyfikacje (CLAUDE.md) -
          pomarancz zostaje dla konsumenta. Granat sluzy za kolor tekstu i guzikow: na tym
          niebieskim daje kontrast 8:1, wiec czyta sie tez przy slabym swietle. */}
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-[#7B9CF5] px-6 py-12 text-center lg:rounded-[36px] lg:px-[70px] lg:py-[64px]">
        <h2 className="max-w-[16ch] font-brand text-[28px] leading-[1.15] text-white sm:text-[32px] lg:text-[40px]">
          {nb(c.business.title)}
        </h2>
        <p className="mt-5 max-w-[42ch] text-[15px] leading-[1.5] text-[#1B2559] lg:text-[17px]">
          {nb(c.business.body)}
        </p>
        <p className="mt-4 max-w-[42ch] text-[15px] font-semibold leading-[1.5] text-[#1B2559] lg:text-[17px]">
          {nb(c.business.free)}
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/biznes/start"
            onClick={() => track("section_cta")}
            className="inline-flex h-[48px] w-full max-w-[300px] items-center justify-center rounded-full bg-[#1B2559] px-6 text-[15px] font-extrabold text-white transition-opacity hover:opacity-90 active:scale-[0.98] sm:w-auto sm:min-w-[220px]"
          >
            {c.business.cta}
          </Link>
          <Link
            to="/auth?business=true"
            onClick={() => track("section_login")}
            className="inline-flex h-[48px] w-full max-w-[300px] items-center justify-center rounded-full border-2 border-[#1B2559] px-6 text-[15px] font-extrabold text-[#1B2559] transition-colors hover:bg-[#1B2559]/10 active:scale-[0.98] sm:w-auto sm:min-w-[220px]"
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
  const nb = useNb();
  return (
    <section className="px-4 py-12 lg:px-[50px] lg:py-[125px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-spontaway-yellow px-6 py-10 text-center lg:h-[480px] lg:justify-center lg:rounded-[36px] lg:py-0">
        <Wordmark className="h-[32px] w-auto lg:h-[43px]" />
        <h2 className="mt-6 font-brand text-[30px] leading-[1.14] text-spontaway-orange lg:mt-[43px] lg:text-[52px]">
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

function FooterBar({ c, lang, onSwitchLang }: { c: Copy; lang: Lang; onSwitchLang: (l: Lang) => void }) {
  const nb = useNb();
  return (
    <footer className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-5 pb-8 text-[13px] text-[#6B6B75] lg:h-[96px] lg:flex-row lg:justify-center lg:gap-0 lg:px-[120px] lg:pb-0 lg:text-[14px]">
      <p className="flex items-center gap-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
        {c.footer.rights}
        <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true" className="text-spontaway-orange">
          <path d="M6.5 11S1 7.7 1 4.2A2.9 2.9 0 016.5 2.6 2.9 2.9 0 0112 4.2C12 7.7 6.5 11 6.5 11z" fill="currentColor" />
        </svg>
        {nb(c.footer.inPoland)}
      </p>
      <div className="flex items-center gap-6 lg:ml-auto">
        <Link to="/terms" className="hover:text-spontaway-brown">{c.footer.terms}</Link>
        <Link to="/privacy" className="hover:text-spontaway-brown">{c.footer.privacy}</Link>
        {/* Przelacznik jezyka: wykrywanie z przegladarki bywa mylne (Polak z angielskim
            systemem), wiec musi byc czym je nadpisac. Wybor pamietamy w tej przegladarce. */}
        <div className="flex items-center gap-1" role="group" aria-label="Language">
          {(["pl", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onSwitchLang(code)}
              aria-pressed={lang === code}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
                lang === code ? "bg-spontaway-orange text-white" : "text-spontaway-brown/60 hover:text-spontaway-brown"}`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Strona ───────────────────────────────────────────────────────────────────

// Jezyk landingu. Kolejnosc ma znaczenie:
//   1. ?lang= w adresie - jawny wybor, wygrywa zawsze (dziala tez w linkach z kampanii),
//   2. wybor zapamietany w tej przegladarce (przelacznik w stopce),
//   3. jezyk przegladarki - bez tego kazdy odwiedzajacy z zagranicy widzial polska strone.
const LANG_KEY = "spontaway_landing_lang";
// Sciezka /en to OSOBNY adres dla Google (wlasna migawka + hreflang, patrz
// scripts/inject-landing-snapshot.mjs). Aplikacja stoi na HashRouterze, wiec pathname
// jest wolny i mozemy go uzyc jako sygnalu jezyka bez kolizji z routingiem.
const EN_PATH = "/en";
const pathLang = (): Lang | null =>
  (typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === EN_PATH) ? "en" : null;

// UWAGA: aplikacja stoi na HashRouterze, wiec useSearchParams czyta query string Z HASHA,
// a nie z prawdziwego adresu. Link z kampanii ma postac spontaway.com/?lang=en, wiec musimy
// zajrzec takze do window.location.search - inaczej parametr jest po cichu ignorowany.
const queryLang = (): Lang | null => {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("lang");
  return v === "en" || v === "pl" ? v : null;
};

function detectLang(param: string | null): Lang {
  const explicit = param === "en" || param === "pl" ? param : queryLang();
  if (explicit) return explicit;                        // ?lang= - jawny wybor z linku
  const fromPath = pathLang();
  if (fromPath) return fromPath;                        // /en - wejscie z wynikow wyszukiwania
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "pl") return saved; // wybor zapamietany w przegladarce
  } catch { /* prywatne okno */ }
  const nav = typeof navigator !== "undefined" ? (navigator.language || "") : "";
  return nav.toLowerCase().startsWith("pl") ? "pl" : "en";
}

export default function SpontawayLanding() {
  const [params] = useSearchParams();
  const [lang, setLang] = useState<Lang>(() => detectLang(params.get("lang")));
  const c = COPY[lang] as Copy;
  const nb = useMemo(() => nbFor(lang), [lang]);
  const switchLang = useCallback((next: Lang) => {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* prywatne okno */ }
    // Adres ma zgadzac sie z tresci: skopiowany link musi otworzyc ten sam jezyk, a Google
    // ma dwa osobne adresy do zaindeksowania. replaceState, bo HashRouter nie patrzy na
    // pathname - nie ma tu czego przeladowywac.
    try {
      window.history.replaceState(null, "", (next === "en" ? EN_PATH : "/") + window.location.hash);
    } catch { /* srodowisko bez History API */ }
    posthog.capture("landing_language_switched", { lang: next });
  }, []);
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
    { w: 1038, h: 616, cls: "w-full max-w-[430px] lg:w-[676px] lg:max-w-none", body: 399 },
    { w: 900, h: 792, cls: "w-full max-w-[340px] lg:w-[574px] lg:max-w-none", body: 382 },
    { w: 834, h: 733, cls: "w-full max-w-[430px] lg:w-[600px] lg:max-w-none", body: 460 },
  ];

  return (
    <NbContext.Provider value={nb}>
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
      <FooterBar c={c} lang={lang} onSwitchLang={switchLang} />
      {modalOpen && <DownloadModal c={c} lang={lang} onClose={() => setModalOpen(false)} />}
    </div>
    </NbContext.Provider>
  );
}
