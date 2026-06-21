import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";

type Lang = "pl" | "en";
const COPY = {
  pl: {
    heroA: "Wasz plan", heroB: "na miasto",
    sub: "Budujemy aplikację do planowania city breaków i wspólnych wyjazdów z przyjaciółmi. Coś, czego sami szukaliśmy.",
    notify: "Powiadomimy Cię o premierze na iOS i Androidzie.",
    available: "dostępne w lipcu",
    emailPlaceholder: "twoj@email.pl",
    consentPre: "Wyrażam zgodę na przetwarzanie mojego adresu e-mail w celu otrzymywania informacji o premierze aplikacji. Zapoznałem się z ",
    privacy: "polityką prywatności",
    submit: "Zapisz się",
    done: "Dzięki za zapis! Poinformujemy Cię kiedy aplikacja będzie dostępna.",
    badgeIosTop: "Pobierz w", badgeAndroidTop: "Dostępne w",
  },
  en: {
    heroA: "Your plan", heroB: "for the city",
    sub: "We're building an app for planning city breaks and trips with friends. Something we were looking for ourselves.",
    notify: "We'll let you know when it launches on iOS and Android.",
    available: "available in July",
    emailPlaceholder: "you@email.com",
    consentPre: "I agree to the processing of my email address to receive information about the app launch. I have read the ",
    privacy: "privacy policy",
    submit: "Sign up",
    done: "Thanks for signing up! We'll let you know when the app is available.",
    badgeIosTop: "Download on", badgeAndroidTop: "Get it on",
  },
} as const;

// ─── Email Capture ────────────────────────────────────────────────────────────

function EmailCapture({ inputRef, lang }: { inputRef?: React.RefObject<HTMLInputElement>; lang: Lang }) {
  const c = COPY[lang];
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !consent || status !== "idle") return;
    setStatus("loading");
    const trimmed = email.trim().toLowerCase();
    await (supabase as any).from("waitlist").insert({ email: trimmed });
    supabase.functions.invoke("send-waitlist-email", { body: { email: trimmed } });
    posthog.capture("landing_waitlist_signup", { source: "waitlist_page" });
    setStatus("done");
  };
  if (status === "done") return (
    <div className="px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200">
      <p className="text-sm font-semibold text-[#0E0E0E]">{c.done}</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-full">
      <input ref={inputRef} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={c.emailPlaceholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-[#0E0E0E] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300" />

      <label className="flex items-start gap-2.5 text-left cursor-pointer select-none px-1">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange-600 focus:ring-orange-300 cursor-pointer shrink-0"
        />
        <span className="text-[11px] text-slate-500 leading-snug">
          {c.consentPre}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline hover:text-orange-700">{c.privacy}</a>.
        </span>
      </label>

      <button type="submit" disabled={status === "loading" || !consent || !email.trim()}
        className="w-full rounded-2xl bg-orange-700 hover:bg-orange-800 text-white font-bold px-5 py-3.5 text-sm whitespace-nowrap shadow-md shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed">
        {status === "loading" ? "..." : c.submit}
      </button>
    </form>
  );
}

function AppStoreBadge({ store, lang }: { store: "ios" | "android"; lang: Lang }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 select-none h-[52px]">
      {store === "ios" ? (
        <svg className="h-6 w-6 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      ) : (
        <svg className="h-6 w-6 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.18 23.76c.37.2.8.22 1.19.06l11.3-6.5-2.49-2.49-10 8.93zm-1.13-20.7A1.5 1.5 0 0 0 2 4v16a1.5 1.5 0 0 0 .05.94l.09.1 8.96-8.96v-.21L2.14 2.96l-.09.1zm17.3 7.84-2.41-1.39-2.72 2.72 2.72 2.72 2.44-1.41a1.5 1.5 0 0 0 0-2.64zM4.37.18 15.67 6.68l-2.49 2.49L3.18.24A1.5 1.5 0 0 1 4.37.18z" />
        </svg>
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">{store === "ios" ? COPY[lang].badgeIosTop : COPY[lang].badgeAndroidTop}</p>
        <p className="text-[12px] font-semibold text-slate-600 leading-tight whitespace-nowrap">{store === "ios" ? "App Store" : "Google Play"}</p>
      </div>
    </div>
  );
}

// ─── WaitlistPage ─────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>("pl");
  const c = COPY[lang];

  return (
    <div style={{ background: "#FAFAFA", minHeight: "100dvh" }}>

      {/* ── Shared TopBar nav ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 h-14 lg:h-16">
        <div className="h-full flex items-center px-5 lg:px-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-base lg:text-lg text-[#0E0E0E] tracking-tight">trasa</span>
          </div>
          <div className="ml-auto flex items-center rounded-full border border-slate-200 overflow-hidden text-xs font-bold">
            <button onClick={() => setLang("pl")} className={lang === "pl" ? "px-2.5 py-1 bg-orange-600 text-white" : "px-2.5 py-1 text-slate-500"} aria-label="Polski">PL</button>
            <button onClick={() => setLang("en")} className={lang === "en" ? "px-2.5 py-1 bg-orange-600 text-white" : "px-2.5 py-1 text-slate-500"} aria-label="English">EN</button>
          </div>
        </div>
      </header>

      {/* ── Hero — single layout for all viewports ── */}
      <div className="flex flex-col items-center justify-center px-5 lg:px-8 pt-16 lg:pt-24 pb-12 max-w-md mx-auto text-center" style={{ minHeight: "calc(100dvh - 3.5rem)" }}>
        <h1 className="text-4xl lg:text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-4">
          {c.heroA}<br />{c.heroB}
        </h1>
        <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-xs">
          {c.sub}
        </p>

        <div className="w-full mb-3">
          <EmailCapture inputRef={inputRef} lang={lang} />
        </div>
        <p className="text-slate-400 text-xs mb-8">{c.notify}</p>

        <div className="flex flex-row gap-2 w-full">
          <div className="flex-1 min-w-0"><AppStoreBadge store="ios" lang={lang} /></div>
          <div className="flex-1 min-w-0"><AppStoreBadge store="android" lang={lang} /></div>
        </div>
        <p className="text-xs text-slate-400 mt-3">{c.available}</p>
      </div>
    </div>
  );
}
