import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import posthog from "posthog-js";
import { supabase } from "@/integrations/supabase/client";
import { pendingReferralCode } from "@/lib/referral";
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
      { title: "Twórz własne\nkolekcje tematyczne", body: "Odwiedzone lub te, które chcesz odwiedzić.\nZapisuj miejsca i podziel się z innymi swoją opinią.", cta: "Stwórz pierwszą listę", img: "/kolekcje_grafika.png", alt: "Lista miejsc „Fav kawiarnie” w aplikacji Spontaway" },
      { title: "Dziel się wrażeniami\nz przeżytych podróży", body: "Planuj i twórz podsumowania wyjazdów, pomagając innym użytkownikom w ich podróżach.", cta: "Dodaj pierwszy wyjazd", img: "/dziel_sie.png", alt: "Planowanie wyjazdu i podsumowanie podróży w aplikacji Spontaway" },
    ],
    stats: { heading: "SPONTAWAY TO", countries: "Krajów", cities: "Miast", possibilities: "Możliwości" },
    business: {
      title: "Prowadzisz lokal?",
      // **gwiazdki** = pogrubienie (patrz `boldParts`). Tak jest w makiecie: wyroznione sa
      // trzy powody, dla ktorych ktos siega po aplikacje, a nie cale zdanie.
      body: "Nie pozwól by Ci, którzy **szukają gdzie zjeść**, **co zobaczyć** i **jak spędzić czas** go przegapili",
      cta: "Skontaktuj się",
      mockupAlt: "Wizytówka lokalu w aplikacji: zdjęcia, menu, godziny otwarcia i wydarzenie",
    },
    inquiry: {
      title: "Witamy na pokładzie",
      body: "Na podany adres e-mail prześlemy link aktywacyjny oraz więcej szczegółów",
      venue: "Nazwa lokalu",
      venuePlaceholder: "np. Kawiarnia Poranek",
      city: "Miasto",
      cityPlaceholder: "np. Łódź",
      person: "Osoba do kontaktu",
      personPlaceholder: "Imię i\u00a0Nazwisko",
      email: "E-mail",
      emailPlaceholder: "kontakt@twojlokal.pl",
      phone: "Telefon",
      phonePlaceholder: "123 123 123",
      message: "Dodatkowe informacje",
      messagePlaceholder: "Kilka słów o\u00a0lokalu, docelowych klientach itp.",
      optional: "opcjonalnie",
      submit: "Wyślij",
      sending: "Wysyłam...",
      doneTitle: "Zapytanie poszło!",
      done: "Odezwiemy się na podany adres w ciągu dwóch dni roboczych.",
      error: "Nie udało się wysłać. Spróbuj jeszcze raz.",
      close: "Zamknij",
      consentPre: "Wysyłając formularz zgadzasz się na kontakt w\u00a0sprawie oferty. Szczegóły w\u00a0",
      consentLink: "polityce prywatności",
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
      { title: "Build your own\nthemed collections", body: "Places you have been to, or the ones you still want to see.\nSave them and share your take with others.", cta: "Create your first list", img: "/kolekcje_grafika.png", alt: "A place list in the Spontaway app" },
      { title: "Share what you brought\nback from a trip", body: "Plan your trips and turn them into recaps that help other travellers.", cta: "Add your first trip", img: "/dziel_sie.png", alt: "Trip planning and trip recap in the Spontaway app" },
    ],
    stats: { heading: "SPONTAWAY IS", countries: "Countries", cities: "Cities", possibilities: "Possibilities" },
    business: {
      title: "Running a place?",
      body: "Don't let the people **looking for a bite**, **something to see** and **a way to spend the day** walk past you",
      cta: "Get in touch",
      mockupAlt: "A place listing in the app: photos, menu, opening hours and an event",
    },
    inquiry: {
      title: "Welcome aboard",
      body: "We will send an activation link and more details to the address you give us",
      venue: "Name of the place",
      venuePlaceholder: "e.g. Poranek Coffee",
      city: "City",
      cityPlaceholder: "e.g. Lodz",
      person: "Contact person",
      personPlaceholder: "First and last name",
      email: "Email",
      emailPlaceholder: "hello@yourplace.com",
      phone: "Phone",
      phonePlaceholder: "123 123 123",
      message: "Anything else",
      messagePlaceholder: "A few words about your place, who you want to reach, and so on.",
      optional: "optional",
      submit: "Send",
      sending: "Sending...",
      doneTitle: "Enquiry sent!",
      done: "We will get back to you at that address within two working days.",
      error: "Could not send that. Please try again.",
      close: "Close",
      consentPre: "By sending this form you agree to be contacted about our offer. Details in the ",
      consentLink: "privacy policy",
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

// Lockup ma teraz GWIAZDKE wystajaca ponad napis (nowe logo, 2026-09-15), wiec ramka pliku
// urosla z 240x43 na 240x47,3. Klasy wysokosci przy kazdym uzyciu sa przeskalowane o te same
// ~10%, zeby SAM NAPIS zostal w dotychczasowym rozmiarze.
function Wordmark({ className }: { className?: string }) {
  return <img src="/wordmark_spontaway.svg" alt="spontaway" className={className} width={240} height={47} />;
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
    // Kod zapraszajacego (?ref=) jedzie RAZEM z zapisem, bo link laduje w przegladarce,
    // a konto zaklada sie pozniej w natywce - localStorage tego nie przenosi. E-mail jest
    // jedynym mostem miedzy tymi dwoma swiatami (patrz src/lib/referral.ts).
    const ref = pendingReferralCode();
    const { error } = await (supabase as any).from("waitlist").insert({ email: value, source: "landing_modal", language: lang, referral_code: ref });
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
          <img src="/logo.svg" alt="" width={618} height={636} className="w-[50px]" />
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
        <img src="/logo.svg" alt="" width={618} height={636} className="w-[24px]" />
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
        <Wordmark className="h-[19px] w-auto shrink-0 sm:h-[21px] lg:h-[36px]" />
        <div className="flex items-center gap-2 lg:gap-3">
          {/* ⛔ Wejscia "Dla firm" TU NIE MA (decyzja Nat 2026-09-15). Landingu B2B jeszcze
              nie ma, a zbieramy trakcje na samych uzytkownikach - jedyna sciezka dla lokali
              to guzik "Skontaktuj sie" w sekcji nizej, ktory otwiera formularz zapytania.
              Nie przywracaj linku do /dla-firm, dopoki nie powstanie landing dla firm. */}
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

        {/* Telefony z aplikacja + TRZY gwiazdki marki (grafika od Nat 2026-09-17).
            Gwiazdki sa OSOBNYMI elementami, nie czescia PNG - tylko wtedy moga sie ruszac.
            Pozycje i rozmiar w PROCENTACH kontenera, wiec trzymaja sie grafiki na kazdej
            szerokosci ekranu; `aria-hidden`, bo nie niosa tresci.
            ⚠️ Kazda ma INNA animacje (`-alt`, `-slow`): przy wspolnej dwie sasiadujace
            gwiazdki pulsuja rownoczesnie i caly hero zaczyna mrugac jak jeden element. */}
        <div className="relative order-2 -mx-5 mt-6 w-[calc(100%+40px)] max-w-none lg:mx-0 lg:mt-0 lg:w-[680px]">
          <img
            src="/grafika_hero.png"
            alt={c.hero.heroAlt}
            width={963}
            height={1032}
            className="w-full"
          />
          {/* GORNA: wcisnieta w "V" miedzy telefonami. Zeszla z `top-[2%]` na `top-[8%]`,
              zeby NACHODZILA na mockup (prosba Nat 2026-09-17) - wczesniej tylko musnela
              rog i wygladala, jakby unosila sie obok grafiki, a nie na niej. */}
          <img src="/star.svg" alt="" aria-hidden="true" width={51} height={47}
            className="animate-star-twinkle pointer-events-none absolute left-[45%] top-[6%] w-[8%]" />
          {/* PRAWA (nowa 2026-09-17): przy PRAWEJ KRAWEDZI prawego telefonu, ~2/3 wysokosci.
              Razem z gorna i dolna lewa tworzy trojkat - trzy gwiazdki przy jednej krawedzi
              czytalyby sie jak rzad, a nie jak rozsypane akcenty.
              ⛔ Nie wracaj z nia pod gore ekranu: przy `top-[4%]` stala tuz obok gornej
              i obie zlewaly sie w jedna pare, a przy `top-[11%]` siadala na czarnej ramce
              obok wyspy, miedzy godzina a ikonami zasiegu (oba sprawdzone renderem w WebKit). */}
          <img src="/star.svg" alt="" aria-hidden="true" width={51} height={47}
            className="animate-star-twinkle-slow pointer-events-none absolute left-[80%] top-[67%] w-[8%]" />
          {/* DOLNA LEWA. */}
          <img src="/star.svg" alt="" aria-hidden="true" width={51} height={47}
            className="animate-star-twinkle-alt pointer-events-none absolute left-[3%] top-[82%] w-[8%]" />
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

// ─── Dla firm ────────────────────────────────────────────────────────────────
// Sekcja wg makiety Nat (Figma "Landing (web)", ramka 1263:284 + wersja mobilna 1926:38)
// i pliku public/B2B_mockup.png.
//
// UWAGA na regule z CLAUDE.md "B2B = niebieski": ona dotyczy EKRANOW dla firm (panel,
// logowanie, onboarding). Tutaj jestesmy na landingu KONSUMENCKIM - to zaproszenie dla
// lokali, nie ich panel - i makieta trzyma palete spontaway (brazowy tekst, pomaranczowy
// guzik). Poprzednia wersja miala niebieski kafelek z bialym naglowkiem o kontrascie 2,65:1.

/** `**pogrubienie**` w tekscie copy - zamiast trzymac zdanie pocięte na osiem kluczy. */
function boldParts(text: string) {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : <span key={i}>{part}</span>,
  );
}

function BusinessStrip({ c, onContact }: { c: Copy; onContact: () => void }) {
  const nb = useNb();
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-[50px] lg:py-[88px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center gap-8 lg:flex-row lg:justify-center lg:gap-[80px]">
        {/* Kolaz wizytowki - jeden eksport z Figmy zamiast skladania dziesieciu warstw w kodzie.
            Na mobile idzie NAD tekstem (kolejnosc DOM), na desktopie po lewej. */}
        <img
          src="/B2B_mockup.png"
          alt={c.business.mockupAlt}
          className="w-full max-w-[320px] shrink-0 sm:max-w-[380px] lg:max-w-[520px]"
          loading="lazy"
        />

        <div className="flex w-full max-w-[440px] flex-col items-center text-center lg:items-start lg:text-left">
          <h2 className="font-brand text-[30px] leading-[1.2] text-spontaway-brown lg:text-[36px]">
            {nb(c.business.title)}
          </h2>
          <p className="mt-4 text-[15px] leading-[1.35] text-spontaway-brown lg:mt-5 lg:text-[16px]">
            {boldParts(nb(c.business.body))}
          </p>

          {/* JEDEN guzik (decyzja Nat 2026-09-15): "Zaloz konto" prowadzilo lokal do panelu
              bez zadnej rozmowy, a "Dowiedz sie wiecej" na strone, ktorej nie ma. Teraz
              jedna sciezka: formularz z zapytaniem o oferte (modal na desktopie, arkusz
              na telefonie) - zadnej nawigacji poza landing. */}
          <div className="mt-7 flex w-full sm:w-auto">
            <button
              type="button"
              onClick={onContact}
              className="inline-flex h-[48px] w-full items-center justify-center rounded-full bg-spontaway-orange px-7 text-[15px] font-extrabold text-white transition-opacity hover:opacity-90 active:scale-[0.98] sm:w-auto sm:min-w-[200px]"
            >
              {c.business.cta}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Zapytanie o oferte (lokal) ──────────────────────────────────────────────
// Jedyna sciezka dla lokali na tym landingu. Na desktopie modal na srodku, na telefonie
// arkusz dolem - to ta sama komponenta, roznica siedzi w klasach (`items-end` -> `sm:items-center`),
// zeby copy i logika nie rozjechaly sie miedzy dwiema wersjami.
//
// Zapisu NIE robimy z klienta: `business_inquiries` nie ma polityki INSERT dla anon,
// wszystko idzie przez funkcje brzegowa `business-inquiry` (walidacja, limit, mail do nas).

/** Kierunkowe w formularzu lokalu. Polska pierwsza (i domyslna), dalej sasiedzi i najwieksze
 *  rynki europejskie - lista ma byc krotka, bo to pole opcjonalne przy zapytaniu o oferte,
 *  a nie miedzynarodowy formularz rejestracji. */
const DIAL_CODES = ["+48", "+49", "+420", "+421", "+380", "+370", "+44", "+353", "+31", "+32", "+33", "+34", "+39", "+1"];

const INQ_FIELD =
  "h-[46px] w-full rounded-2xl border border-black/10 bg-white px-4 text-[14px] text-spontaway-brown outline-none placeholder:text-black/30 focus:border-spontaway-orange";

function InquiryField({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-[12px] font-semibold text-spontaway-brown">
        {label}
        {hint ? <span className="ml-1 font-normal text-spontaway-brown/50">({hint})</span> : null}
      </span>
      {children}
    </label>
  );
}

function BusinessInquirySheet({ c, lang, onClose }: { c: Copy; lang: Lang; onClose: () => void }) {
  const nb = useNb();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({ venue: "", city: "", person: "", email: "", phone: "", message: "" });
  // Kierunkowy osobno od numeru (makieta Nat 2026-09-17). Lokale sa dzis polskie, wiec +48
  // jest domyslne, ale lista musi istniec - inaczej lokal spoza Polski nie ma jak podac numeru,
  // a pole i tak jest opcjonalne, wiec nikt go nie poprawi za niego.
  const [dial, setDial] = useState("+48");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    const { error } = await supabase.functions.invoke("business-inquiry", {
      body: {
        venue_name: form.venue.trim(),
        city: form.city.trim(),
        contact_name: form.person.trim(),
        email: form.email.trim().toLowerCase(),
        // Kierunkowy doklejamy TYLKO do niepustego numeru - inaczej do skrzynki zalozycielek
        // trafialoby samo "+48" jako telefon lokalu.
        phone: form.phone.trim() ? `${dial} ${form.phone.trim()}` : "",
        message: form.message.trim(),
        language: lang,
        source: "landing_b2c",
      },
    });
    if (error) {
      setState("error");
      return;
    }
    posthog.capture("landing_business_inquiry_sent", { lang, has_phone: !!form.phone.trim() });
    setState("done");
  };

  return (
    // z-[70], bo pasek zgody na ciasteczka stoi na z-[60] i na telefonie zaslanial guzik
    // "Wyslij zapytanie" - formularz musi stac nad nim.
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:px-5 sm:py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={c.inquiry.title}
    >
      <div
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl duration-200 animate-in slide-in-from-bottom-6 sm:max-h-[88dvh] sm:max-w-[460px] sm:rounded-[28px] sm:slide-in-from-bottom-0 sm:fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={c.inquiry.close}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-spontaway-brown transition-colors hover:bg-black/10"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="overflow-y-auto overscroll-contain">
          <div className="flex flex-col items-center bg-spontaway-yellow px-6 pb-7 pt-5 text-center sm:pt-9">
            {/* Uchwyt arkusza - tylko na telefonie, gdzie panel wchodzi od dolu. */}
            <div className="mb-4 h-1 w-10 shrink-0 rounded-full bg-spontaway-brown/20 sm:hidden" />
            <img src="/logo.svg" alt="" width={618} height={636} className="w-[44px]" />
            <h2 className="mt-3 font-brand text-[24px] leading-[1.15] text-spontaway-orange sm:text-[26px]">
              {nb(state === "done" ? c.inquiry.doneTitle : c.inquiry.title)}
            </h2>
            <p className="mt-2 text-[14px] leading-[1.45] text-spontaway-brown">
              {nb(state === "done" ? c.inquiry.done : c.inquiry.body)}
            </p>
          </div>

          {state !== "done" && (
            <form
              onSubmit={submit}
              className="flex flex-col gap-3 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:pb-7"
            >
              {/* E-MAIL JEST PIERWSZY (makieta Nat 2026-09-17). To jedyne pole, bez ktorego
                  zapytanie jest bezuzyteczne - nie ma jak odpisac - wiec stoi nad reszta.
                  Nazwa lokalu zaraz pod nim; cala reszta jest opcjonalna. */}
              <InquiryField label={c.inquiry.email}>
                <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder={c.inquiry.emailPlaceholder} className={INQ_FIELD} />
              </InquiryField>
              <InquiryField label={c.inquiry.venue}>
                <input required value={form.venue} onChange={set("venue")} placeholder={c.inquiry.venuePlaceholder} className={INQ_FIELD} />
              </InquiryField>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <InquiryField label={c.inquiry.city} hint={c.inquiry.optional}>
                    <input value={form.city} onChange={set("city")} placeholder={c.inquiry.cityPlaceholder} className={INQ_FIELD} />
                  </InquiryField>
                </div>
                <div className="flex-1">
                  <InquiryField label={c.inquiry.person} hint={c.inquiry.optional}>
                    <input value={form.person} onChange={set("person")} placeholder={c.inquiry.personPlaceholder} className={INQ_FIELD} />
                  </InquiryField>
                </div>
              </div>
              <InquiryField label={c.inquiry.phone} hint={c.inquiry.optional}>
                <div className="flex gap-2">
                  {/* Natywny <select>: na telefonie otwiera kolo iOS, ktorego niczym wlasnym
                      nie zastapimy lepiej. `appearance-none` + wlasny chevron, zeby pole
                      wygladalo jak sasiednie, a nie jak systemowy formularz. */}
                  <div className="relative shrink-0">
                    <select
                      value={dial}
                      onChange={(e) => setDial(e.target.value)}
                      aria-label={c.inquiry.phone}
                      className={`${INQ_FIELD} w-[92px] appearance-none pr-7`}
                    >
                      {DIAL_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-spontaway-brown/60">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder={c.inquiry.phonePlaceholder} className={`${INQ_FIELD} flex-1`} />
                </div>
              </InquiryField>
              <InquiryField label={c.inquiry.message} hint={c.inquiry.optional}>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={set("message")}
                  placeholder={c.inquiry.messagePlaceholder}
                  className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-[14px] leading-[1.4] text-spontaway-brown outline-none placeholder:text-black/30 focus:border-spontaway-orange"
                />
              </InquiryField>

              <button
                type="submit"
                disabled={state === "sending"}
                className="mt-1 h-[48px] w-full rounded-full bg-spontaway-orange text-[15px] font-extrabold text-white transition-colors hover:bg-[#d94a05] active:scale-[0.98] disabled:opacity-60"
              >
                {state === "sending" ? c.inquiry.sending : c.inquiry.submit}
              </button>
              {state === "error" && (
                <p className="text-center text-[12px] font-semibold text-red-600">{nb(c.inquiry.error)}</p>
              )}
              <p className="px-1 text-center text-[11px] leading-snug text-spontaway-brown/70">
                {nb(c.inquiry.consentPre)}
                <Link to="/privacy" className="underline">{c.inquiry.consentLink}</Link>.
              </p>
            </form>
          )}

          {state === "done" && (
            <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 sm:pb-7">
              <button
                type="button"
                onClick={onClose}
                className="h-[48px] w-full rounded-full bg-spontaway-orange text-[15px] font-extrabold text-white transition-colors hover:bg-[#d94a05] active:scale-[0.98]"
              >
                {c.inquiry.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CTA na koncu strony ──────────────────────────────────────────────────────

function FooterCta({ c, onDownload }: { c: Copy; onDownload: () => void }) {
  const nb = useNb();
  return (
    <section className="px-4 py-12 lg:px-[50px] lg:py-[125px]">
      <div className="mx-auto flex max-w-[1340px] flex-col items-center rounded-[28px] bg-spontaway-yellow px-6 py-10 text-center lg:h-[480px] lg:justify-center lg:rounded-[36px] lg:py-0">
        <Wordmark className="h-[35px] w-auto lg:h-[47px]" />
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
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const openInquiry = useCallback(() => {
    posthog.capture("landing_business_inquiry_open", { placement: "section" });
    setInquiryOpen(true);
  }, []);

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
    { w: 1066, h: 933, cls: "w-full max-w-[340px] lg:w-[574px] lg:max-w-none", body: 382 },
    { w: 1112, h: 977, cls: "w-full max-w-[430px] lg:w-[600px] lg:max-w-none", body: 460 },
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
        <BusinessStrip c={c} onContact={openInquiry} />
        <FooterCta c={c} onDownload={() => openDownload("footer_cta")} />
      </main>
      <FooterBar c={c} lang={lang} onSwitchLang={switchLang} />
      {modalOpen && <DownloadModal c={c} lang={lang} onClose={() => setModalOpen(false)} />}
      {inquiryOpen && <BusinessInquirySheet c={c} lang={lang} onClose={() => setInquiryOpen(false)} />}
    </div>
    </NbContext.Provider>
  );
}
