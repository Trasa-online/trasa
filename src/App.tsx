import { useEffect, useRef, useState, lazy as reactLazy, Suspense } from "react";
import SpontawayLanding from "./pages/SpontawayLanding";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { AuthDrawerProvider } from "@/hooks/useAuthDrawer";
import { useNativePush } from "@/hooks/useNativePush";
import { useNetworkReconnect } from "@/hooks/useNetworkReconnect";
import { useAppResume } from "@/hooks/useAppResume";
import { useNotificationsLive } from "@/hooks/useNotificationsLive";
import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";
import AuthDrawer from "@/components/auth/AuthDrawer";
import { businessPanelPath } from "@/lib/businessRedirect";
import { TrasaLogo } from "@/components/TrasaLogo";
import { OnboardingProvider } from "@/components/OnboardingGuide";
import { supabase } from "@/integrations/supabase/client";
import { isNative, isWeb } from "@/lib/platform";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { toast } from "sonner";

const MAINTENANCE_MODE = false;

function MaintenanceScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (pwd === "Truda2026!") { sessionStorage.setItem("tester_unlocked", "1"); onUnlock(); }
    else { setErr(true); }
  };
  return (
    <div style={{ minHeight: "100dvh", background: "#FEFEFE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
      <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#0E0E0E", letterSpacing: "-0.02em", margin: 0 }}>trasa</h1>
      <p style={{ fontSize: "1rem", color: "#979797", textAlign: "center", maxWidth: "28ch", lineHeight: 1.5, margin: 0 }}>Pracujemy nad czymś fajnym. Wróć wkrótce.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 280, marginTop: 8 }}>
        <input
          type="password"
          value={pwd}
          onChange={e => { setPwd(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Hasło dostępu"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff", fontSize: 16, outline: "none", textAlign: "center" }}
        />
        {err && <p style={{ fontSize: 12, color: "#ef4444", textAlign: "center", margin: 0 }}>Nieprawidłowe hasło</p>}
        <button
          onClick={submit}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#F4A259,#F9662B)", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
        >
          Wejdź
        </button>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("tester_unlocked") === "1");
  if (!MAINTENANCE_MODE) return <>{children}</>;
  if (loading) return null;
  if (unlocked) return <>{children}</>;
  const isPublicRoute =
    location.pathname === "/auth" ||
    location.pathname === "/" ||
    location.pathname === "/landing-v2" ||
    location.pathname.startsWith("/set-password") ||
    location.pathname.startsWith("/biznes/") ||
    location.pathname.startsWith("/dla-firm/");
  if (!user && !isPublicRoute) return <MaintenanceScreen onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}

// NATIVE-ONLY: apka konsumencka B2C NIE jest wspierana w przegladarce. Web sluzy TYLKO
// do: marketingu (landing / waitlist / legal), B2B (auth biznesowy, set-password, dashboard
// /biznes, /dla-firm, claim lokalu /lokal) + callbackow auth (?code=/?token_hash=).
// Native (iOS/Capacitor) = pelna apka, bez redirectu. Cala reszta (rdzen B2C: eksploruj,
// wyjazdy, trasy, sesje grupowe, planer, linki share /route//profil, /demo) -> "/".
//
// Pre-launch: docelowo "/" = landing spontaway (lapie odwiedzajacego). Po wejsciu do App Store podmienic
// redirect na dedykowany ekran "Pobierz z App Store" (komponent NativeGate).
function WebWaitlistGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (isNative) return <>{children}</>;
  const hasAuthParams = /[?&#](code|token_hash|error|access_token)=/.test(window.location.href);
  const p = location.pathname;
  const allowed =
    // Marketing / legal (B2C web presence)
    p === "/" || p === "/landing-v2" ||
    p === "/terms" || p === "/privacy" ||
    // B2B: auth biznesowy, ustawianie hasla, dashboard, landing dla firm, claim lokalu
    p === "/auth" || p.startsWith("/set-password") || p.startsWith("/biznes") ||
    p.startsWith("/dla-firm") || p.startsWith("/lokal/");
  if (!allowed && !hasAuthParams) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// AuthGate (NATIVE): apka konsumencka = TYLKO zalogowany/zarejestrowany user.
// Koniec trybu goscia. Niezalogowany (lub anon) -> /auth, z zachowaniem celu
// (deep-link, np. zaproszenie do grupy). Publiczne: auth, set-password, B2B
// (biznes/dla-firm/claim lokalu), legal + callbacki auth.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!isNative) return <>{children}</>; // web ma WebWaitlistGate
  if (loading) return null;
  const realUser = !!user && !(user as any).is_anonymous;
  const hasAuthParams = /[?&#](code|token_hash|error|access_token)=/.test(window.location.href);
  const p = location.pathname;
  const isPublic =
    p === "/auth" || p.startsWith("/set-password") ||
    p.startsWith("/biznes") || p.startsWith("/dla-firm") || p.startsWith("/lokal/") ||
    p === "/terms" || p === "/privacy";
  if (!realUser && !isPublic && !hasAuthParams) {
    try {
      if (p && p !== "/" && p !== "/auth") sessionStorage.setItem("trasa_post_login_redirect", p + location.search);
    } catch { /* sessionStorage unavailable */ }
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

// Module-level cache: pamieta promise dla danego auth-code zeby uniknac
// double-execution przy React Strict Mode double-mount w dev (uses tej samej
// promise dla obu mount'ow zamiast dwoch oddzielnych HTTP calls). Bez tego
// pierwszy exchange uzywa code, drugi dostaje 400 bo code juz invalidated.
const authCallbackPromises = new Map<string, Promise<any>>();

function dedupedExchange(code: string) {
  const cached = authCallbackPromises.get(code);
  if (cached) return cached;
  const promise = supabase.auth.exchangeCodeForSession(code);
  authCallbackPromises.set(code, promise);
  return promise;
}

function dedupedVerifyOtp(tokenHash: string, type: string) {
  const key = `otp:${tokenHash}`;
  const cached = authCallbackPromises.get(key);
  if (cached) return cached;
  const promise = supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
  authCallbackPromises.set(key, promise);
  return promise;
}

// GLOBAL auth callback handler - przetwarza ?code= / ?token_hash= NIEZALEZNIE od route.
// Wczesniej tylko RootPage (route /) i SetPassword (route /set-password) obslugiwaly to,
// wiec jezeli Supabase Site URL / Redirect URL w Dashboard ladowal usera GDZIE INDZIEJ
// (np. /moj-profil), auth callback nigdy nie zostal przetworzony - user zostawal goscem.
function GlobalAuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    // Invite biznesu: redirect_to z maila celuje w '#/set-password-biznes'. Strona
    // SetPassword(forceBusiness) sama wymienia code i pokazuje formularz - GlobalAuthCallback
    // nie moze sie wtracac (inaczej podwojny exchange code'a albo redirect na /home).
    if ((window.location.hash || "").includes("set-password-biznes")) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    // ?next= doklejony do redirectTo przed OAuth - przezywa round-trip nawet gdy
    // sessionStorage gubi sie (in-app browser, np. Messenger). Lapiemy go TERAZ,
    // bo cleanUrl() ponizej zdejmie search z URL.
    const nextDest = params.get("next");
    // Marker biznesowego resetu hasla - ustawiany w redirectTo (Auth / BusinessDashboard).
    // Lapiemy TERAZ, bo cleanUrl() ponizej zdejmie search z URL.
    const bizReset = params.get("bizreset") === "1";
    if (!code && !tokenHash) return;
    processed.current = true;

    console.log("[GlobalAuthCallback] processing", {
      pathname: window.location.pathname,
      hasCode: !!code,
      hasTokenHash: !!tokenHash,
      type,
    });

    const cleanUrl = () => {
      window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""));
    };

    const navAfterAuth = async () => {
      cleanUrl();
      await new Promise((r) => setTimeout(r, 200));
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[GlobalAuthCallback] user after auth:", {
        id: user?.id,
        email: user?.email,
        is_anonymous: user?.is_anonymous,
        email_confirmed_at: user?.email_confirmed_at,
      });

      // Reset hasla: pokaz odpowiedni formularz set-password. Rozroznienie B2B/B2C:
      // - `bizreset=1` to NASZ marker w redirectTo (przezywa utrate fragmentu #/... w
      //   mailowym round-tripie na natywnym iOS; niezalezny od PKCE vs token_hash).
      // - `type=recovery` to sygnal Supabase (jest przy token_hash, brak przy PKCE code).
      // Bez markera biznesowy reset ladowal na konsumenckim /set-password (albo, przy
      // PKCE, byl brany za zwykle logowanie i wyrzucal usera na /eksploruj).
      // Token-hash flow (szablon maila): link to `.../?token_hash=..&type=recovery&next=<redirectTo>`.
      // biznes rozpoznajemy tez z `next` (zawiera bizreset=1 / set-password-biznes), bo w tym
      // flow bizreset moze byc zakodowany wewnatrz next, nie jako osobny param.
      const isBizReset =
        bizReset
        || (window.location.hash || "").includes("set-password-biznes")
        || (nextDest || "").includes("set-password-biznes")
        || (nextDest || "").includes("bizreset");
      if (isBizReset || type === "recovery") {
        // ?reset=1 -> SetPassword pokazuje copy resetu (nie "Aktywuj konto").
        navigate(isBizReset ? "/set-password-biznes?reset=1" : "/set-password?recovery=1");
        return;
      }

      if (user && !user.is_anonymous) {
        // OAuth signup detection: nowy user = profile.created_at < 60s ago.
        // Dla nowych userow wysylamy branded welcome mail przez Resend.
        try {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("created_at, first_name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.created_at) {
            const ageMs = Date.now() - new Date(profile.created_at).getTime();
            if (ageMs < 60_000 && user.email) {
              console.log("[GlobalAuthCallback] new OAuth user detected, sending welcome");
              supabase.functions.invoke("send-b2c-welcome", {
                body: { email: user.email, first_name: profile.first_name ?? user.user_metadata?.full_name?.split(" ")[0] ?? "" },
              }).catch((err) => console.warn("[send-b2c-welcome] failed:", err));
            }
          }
        } catch (e) {
          console.warn("[GlobalAuthCallback] welcome mail check failed:", e);
        }
        toast.success("Witamy w spontaway 🧡");
        // Web OAuth wraca na origin/ i tracimy kontekst route. Jesli przed logowaniem
        // zapisalismy docelowa sciezke (np. /sesja/KOD - dolaczanie do sesji grupowej),
        // wracamy do niej zamiast na /eksploruj (= waitlista na web).
        // Priorytet: ?next= z URL (odporny na in-app browser) > sessionStorage > /eksploruj.
        let dest = "/eksploruj";
        try {
          const stored = sessionStorage.getItem("trasa_post_login_redirect");
          if (stored) { dest = stored; sessionStorage.removeItem("trasa_post_login_redirect"); }
        } catch { /* sessionStorage unavailable */ }
        // Open-redirect guard: tylko wewnetrzna sciezka (start "/", nie "//").
        if (nextDest && nextDest.startsWith("/") && !nextDest.startsWith("//")) dest = nextDest;
        navigate(dest);
        return;
      }

      // Auth callback failed (no user lub still anonymous) - navigate /auth
      console.warn("[GlobalAuthCallback] auth callback completed but no real user, navigating /auth");
      navigate("/auth");
    };

    if (code) {
      dedupedExchange(code).then(({ error }) => {
        if (error) console.error(`[GlobalAuthCallback] exchange failed: ${error.message}`);
        navAfterAuth();
      });
    } else if (tokenHash && type) {
      dedupedVerifyOtp(tokenHash, type).then(({ error }) => {
        if (error) console.error(`[GlobalAuthCallback] verifyOtp failed: ${error.message}`);
        navAfterAuth();
      });
    }
  }, [navigate]);

  return null;
}

// Native deep link handler dla iOS/Android Capacitor. OAuth Google/Apple na native
// dziala tak: Browser.open() otwiera Safari z URL Supabase OAuth -> Google ->
// Supabase callback -> Supabase redirectuje na travel.trasa.app://auth/callback?code=XYZ
// -> iOS otwiera nasza apke przez custom URL scheme -> appUrlOpen event lapie URL
// -> tutaj wymieniamy code na session i zamykamy in-app Browser.
//
// CELOWO NIE navigate'ujemy i NIE pokazujemy toastu - AppLayout useEffect (i Auth.tsx
// na /auth page) sa SINGLE SOURCE OF TRUTH dla post-login routing. Tam jest intent-aware
// logika (guest_plan -> /create, biz profile -> /biznes, inaczej zostaw user na current page).
// Jezeli tutaj zrobimy navigate, race condition z AppLayout: kazdy widok wymaga loginu z
// roznego powodu i navigate("/home") tutaj nadpisze poprawne navigate("/create") z AppLayout.
function NativeDeepLinkHandler() {
  useEffect(() => {
    if (!isNative) return;
    const handlerPromise = CapApp.addListener("appUrlOpen", async ({ url }) => {
      console.log("[NativeDeepLink] appUrlOpen", { url });
      if (!url.includes("auth/callback")) return;
      try { await Browser.close(); } catch { /* browser already closed */ }
      // Custom scheme URLs (travel.trasa.app://auth/callback?code=XYZ) - parser
      // potrzebuje fallback bo URLSearchParams nie zawsze parsuje custom scheme.
      const queryIdx = url.indexOf("?");
      const fragmentIdx = url.indexOf("#");
      const query = queryIdx >= 0 ? url.slice(queryIdx + 1, fragmentIdx >= 0 ? fragmentIdx : undefined) : "";
      const params = new URLSearchParams(query);
      const code = params.get("code");
      // Akceptujemy WYLACZNIE PKCE code (flowType=pkce). Implicit access_token/
      // refresh_token z deep-linku NIE jest przyjmowany - to wektor session
      // fixation (podsuniety link logowalby ofiare w konto atakujacego).
      if (code) {
        const { error } = await dedupedExchange(code);
        if (error) console.error("[NativeDeepLink] exchange failed:", error.message);
      } else {
        console.warn("[NativeDeepLink] auth/callback bez PKCE code - ignoruje:", url);
      }
      // AppLayout useEffect zlapie auth state change i zdecyduje gdzie navigate'owac
      // (intent-aware: guest_plan -> /create, biz -> /biznes, inaczej zostan).
    });
    return () => { handlerPromise.then((h) => h.remove()).catch(() => {}); };
  }, []);
  return null;
}

// Root strony. Na webie spontaway.com ma pokazywac landing B2C, ale Supabase wraca
// z linkow aktywacyjnych/OAuth wlasnie na root (?code=, ?token_hash=, #access_token=),
// wiec przy takim URL-u nadal musi zadzialac RootPage z wymiana kodu na sesje.
function WebRoot() {
  const hasAuthParams = /[?&#](code|token_hash|error|access_token)=/.test(window.location.href);
  if (isNative || hasAuthParams) return <RootPage />;
  return <SpontawayLanding />;
}

function RootPage() {
  const { loading } = useAuth();
  const [exchangingCode, setExchangingCode] = useState(false);
  const [codeChecked, setCodeChecked] = useState(false);

  // Po kliknieciu linka aktywacyjnego Supabase redirectuje na spontaway.com z
  // jednym z kilku formatow:
  // - PKCE flow: ?code=XYZ
  // - Token hash flow: ?token_hash=XYZ&type=signup (nowsze Supabase)
  // - Implicit flow (legacy): #access_token=XYZ&refresh_token=...
  // - Error: ?error=...&error_description=...
  useEffect(() => {
    if (codeChecked) return;

    // VERBOSE DEBUG - bez tego nie zdiagnozujemy bledow PKCE/redirect
    console.log("[RootPage] mount, URL state:", {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    // Czy mamy blad w URL?
    const urlError = params.get("error") || hashParams.get("error");
    const urlErrorDesc = params.get("error_description") || hashParams.get("error_description");
    if (urlError) {
      console.error("[RootPage] auth callback ERROR:", urlError, urlErrorDesc);
      window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""));
      setCodeChecked(true);
      return;
    }

    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    // Brak zadnego auth parametru - normalny load /
    if (!code && !tokenHash && !accessToken) {
      console.log("[RootPage] no auth params, normal load");
      setCodeChecked(true);
      return;
    }

    setExchangingCode(true);

    // PKCE flow
    if (code) {
      console.log("[RootPage] PKCE flow detected, exchanging code...");
      dedupedExchange(code)
        .then(({ data, error }) => {
          if (error) {
            console.error(
              `[RootPage] exchangeCodeForSession FAILED: ${error.message} (status: ${(error as any).status}, code: ${(error as any).code})`
            );
          } else {
            console.log("[RootPage] PKCE exchange OK:", {
              user_id: data?.user?.id,
              email: data?.user?.email,
              is_anonymous: data?.user?.is_anonymous,
            });
          }
          window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""));
        })
        .catch((err) => console.error("[RootPage] exchangeCodeForSession threw:", err?.message ?? err))
        .finally(() => { setExchangingCode(false); setCodeChecked(true); });
      return;
    }

    // Token hash flow (newer Supabase Auth) - uzywany przez confirm-signup email
    if (tokenHash && type) {
      console.log("[RootPage] token_hash flow detected, verifying...", { type });
      dedupedVerifyOtp(tokenHash, type)
        .then(({ data, error }) => {
          if (error) {
            console.error(
              `[RootPage] verifyOtp FAILED: ${error.message} (status: ${(error as any).status}, code: ${(error as any).code})`
            );
          } else {
            console.log("[RootPage] verifyOtp OK:", {
              user_id: data?.user?.id,
              email: data?.user?.email,
              type,
            });
          }
          window.history.replaceState({}, "", window.location.pathname + (window.location.hash || ""));
        })
        .catch((err) => console.error("[RootPage] verifyOtp threw:", err?.message ?? err))
        .finally(() => { setExchangingCode(false); setCodeChecked(true); });
      return;
    }

    // Implicit flow (legacy hash tokens)
    if (accessToken && refreshToken) {
      console.log("[RootPage] implicit flow detected, setting session...");
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error) {
            console.error("[RootPage] setSession FAILED:", error);
          } else {
            console.log("[RootPage] setSession OK:", { user_id: data?.user?.id });
          }
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch((err) => console.error("[RootPage] setSession threw:", err))
        .finally(() => { setExchangingCode(false); setCodeChecked(true); });
      return;
    }

    console.warn("[RootPage] unknown auth callback shape");
    setExchangingCode(false);
    setCodeChecked(true);
  }, [codeChecked]);

  if (loading || exchangingCode || !codeChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  // Onboarding v3 = coach-overlay na realnych ekranach (OnboardingProvider), nie osobny route.
  return <Navigate to="/eksploruj" replace />;
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search); // GA4
    // PostHog: apka uzywa HashRouter, wiec nawigacja zmienia tylko location.hash - automatyczny
    // $pageview PostHoga (sluchacz History API) NIE lapie zmian route w SPA (liczyl tylko
    // pierwszy load). Capturujemy $pageview recznie przy kazdej zmianie lokalizacji.
    // (capture dziala tylko po opt-in przez cookie banner; opted-out userzy nic nie wysylaja.)
    (window as any).posthog?.capture?.("$pageview");
  }, [location]);
  return null;
}

// ── Splash screen shown on app boot ─────────────────────────────────────────
// On native (iOS/Android), the Capacitor SplashScreen plugin renders the splash
// OUTSIDE the WebView — we only need to call SplashScreen.hide() when ready.
// This React component is the web/PWA fallback (no native splash there).

// Ekran startowy przeniesiony do SplashDraw (znak rysuje sie od lewej). Renderujemy go
// TAKZE na natywnym: natywny splash jest teraz JEDNOLITYM tlem #FEFEFE bez znaku, wiec nie
// ma juz problemu "dwoch log" - to React rysuje znak, a natywny ekran tylko trzyma kolor,
// zanim WebView zdazy odmalowac pierwsza klatke.

// Czy aktualny URL to flow resetu hasla (recovery)? Wtedy guardy biznesowe NIE moga
// redirectowac usera do panelu - SetPassword ma pokazac formularz nowego hasla.
// Na boot URL to `.../?bizreset=1&token_hash=..&type=recovery` (pathname=/), wiec bez
// tego straze wyrzucaly zalogowanego biznesa do panelu, nadpisujac nawigacje na set-password.
function isRecoveryUrl(): boolean {
  const s = (window.location.search || "") + (window.location.hash || "");
  return /(type=recovery|bizreset=1|reset=1|recovery=1|token_hash=)/.test(s);
}

// Handles initial-boot auth check + business redirect while splash is visible
function SplashController() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const booted = useRef(false);

  // Splash to afordancja ZIMNEGO STARTU APLIKACJI NATYWNEJ. Na webie nie ma czego
  // przykrywac: aplikacja konsumencka jest tam zablokowana, wiec zostaja strony
  // marketingowe i legal - a na nich ten ekran tylko zaslania tresc. Na landingu bylo to
  // szczegolnie kosztowne: przy kolejnym wejsciu tego samego dnia splash rysuje pelnoekranowy
  // ScreenSkeleton na z-[9999], wiec przykrywal prerenderowana strone i to WLASNIE jego
  // widac bylo jako "miganie szkieletu", mimo ze HTML przychodzil juz z trescia.
  const skipSplash =
    isWeb ||
    location.pathname.startsWith("/biznes") ||
    location.pathname.startsWith("/dla-firm") ||
    location.pathname === "/auth" ||
    location.pathname.startsWith("/set-password");

  const [visible, setVisible] = useState(!skipSplash);
  const [replayKey, setReplayKey] = useState(0);
  // Wariant C z eksploracji: znak rysuje sie przy PIERWSZYM zimnym starcie w ciagu doby, a przy
  // kolejnych od razu widac szkielet ekranu, na ktory user wchodzi. Marka dostaje swoja chwile
  // raz dziennie; poza tym liczy sie najkrotszy odbierany czas, a nie kolejna animacja.
  const [branded] = useState(() => {
    try {
      const last = Number(localStorage.getItem("spontaway_splash_seen") || 0);
      const fresh = Date.now() - last > 12 * 60 * 60 * 1000;
      if (fresh) localStorage.setItem("spontaway_splash_seen", String(Date.now()));
      return fresh;
    } catch { return true; }   // brak localStorage (prywatne okno) - pokaz znak
  });
  const [forceBranded, setForceBranded] = useState(false);
  // Podglad dla testera (Ustawienia -> "Pokaż ekran startowy", admin): odtwarza animacje bez
  // ubijania aplikacji. Zwykly user trafia na ten ekran wylacznie przy zimnym starcie.
  useEffect(() => {
    const replay = () => { setForceBranded(true); setReplayKey((k) => k + 1); setVisible(true); setBootDone(true); setMinElapsed(true); };
    window.addEventListener("spontaway:replay-splash", replay);
    return () => window.removeEventListener("spontaway:replay-splash", replay);
  }, []);
  const [bootDone, setBootDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  // Splash znika gdy boot gotowy ORAZ minal krotki min. czas (zeby statyczny
  // splash nie mrugnal na 1 klatke przy blyskawicznym starcie).
  const done = bootDone && minElapsed;

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Ukryj natywny splash DOPIERO gdy boot gotowy (done). Na native to natywny splash
  // jest JEDYNYM splashem - React SplashScreen NIE renderuje sie na native (patrz nizej),
  // zeby nie bylo DWOCH log: wczesniejsze wczesne hide + React splash dawalo natywne logo
  // (scaleAspectFill ~185pt) NALOZONE na React (88pt) = dwa koncentryczne loga trasy.
  // Na trasach skipSplash (biznes/auth/...) chowamy od razu (te ekrany maja wlasne UI).
  // Natywny splash chowamy OD RAZU po zamontowaniu Reacta - to on ma zaraz narysowac znak.
  // Wczesniej czekalismy na koniec bootu, bo natywny splash niosl logo i React nie mogl
  // pokazac drugiego. Teraz natywny ekran to samo tlo #FEFEFE (identyczne z SplashDraw),
  // wiec podmiana jest niewidoczna, a animacja startuje natychmiast.
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    import("@capacitor/splash-screen").then(({ SplashScreen: NativeSplash }) => {
      if (!cancelled) NativeSplash.hide({ fadeOutDuration: 0 }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visible || loading || booted.current) return;
    booted.current = true;

    if (!user) { setBootDone(true); return; }

    (async () => {
      try {
        // Recovery (reset hasla) - NIE redirectuj do panelu; SetPassword pokaze formularz.
        if (isRecoveryUrl()) return;
        // Hardcoded admins (Nat, Tomek) zawsze moga uzywac apki konsumencko -
        // nawet jesli maja business_profile rekord (np. po testach draft upgrade).
        if (isHardcodedAdmin(user.email)) return;

        const { data: adminRow } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (adminRow) return;

        const { data: bp } = await (supabase as any)
          .from("business_profiles").select("place_id, id, is_draft").eq("owner_user_id", user.id).maybeSingle();
        // Draft profile (z /biznes/start, jeszcze nie upgraded) NIE wymusza redirectu -
        // user moze przyjsc na strone konsumencka mimo niedokonczonego draftu.
        if (bp?.is_draft) return;
        if (bp?.id) navigate(await businessPanelPath(user.id, bp), { replace: true });
      } finally {
        setBootDone(true);
      }
    })();
  }, [loading, user, visible]);

  // Po gotowosci (boot + min czas) - fade out i odmontowanie.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(t);
  }, [done]);

  if (!visible) return null;
  // Kolejny start tego samego dnia: zamiast znaku od razu szkielet ekranu docelowego, wiec uklad
  // nie skacze po zaladowaniu (podglad admina zawsze pokazuje wersje ze znakiem).
  if (!branded && !forceBranded) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background">
        <ScreenSkeleton variant={variantForPath(window.location.hash)} />
      </div>
    );
  }
  // key: przy ponownym odpaleniu (podglad admina) komponent montuje sie od zera, wiec animacja
  // rysowania startuje od poczatku zamiast zostac na koncowej klatce.
  return <SplashDraw key={replayKey} done={done} onHidden={() => setVisible(false)} />;
}

// Blocks unauthenticated access to app routes - redirects to /auth with optional hint.
// Anonymous Auth users counted jako gosc - musza miec realne konto (email/OAuth)
// zeby przejsc przez ten gate (np. /settings, /admin, /admin/routes).
function RequireAuth({ children, hint }: { children: React.ReactNode; hint?: "journal" | "settings" }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>;
  if (!user || user.is_anonymous) {
    const params = new URLSearchParams({ return: location.pathname });
    if (hint) params.set("hint", hint);
    return <Navigate to={`/auth?${params.toString()}`} replace />;
  }
  return <>{children}</>;
}

// Redirects business-only accounts away from the regular app (ongoing navigation guard)
function BusinessGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    if (isRecoveryUrl()) return; // reset hasla -> nie redirectuj do panelu
    if (
      location.pathname.startsWith("/biznes") ||
      location.pathname.startsWith("/dla-firm") ||
      location.pathname.startsWith("/admin") ||
      location.pathname === "/auth" ||
      location.pathname.startsWith("/set-password") ||
      location.pathname === "/settings" ||
      location.pathname === "/moj-profil"
    ) return;

    (async () => {
      // Hardcoded admins (Nat, Tomek) zawsze moga uzywac apki konsumencko -
      // nawet jesli maja business_profile rekord (np. po testach draft upgrade).
      if (isHardcodedAdmin(user.email)) return;

      const { data: adminRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (adminRow) return;

      const { data: bp } = await (supabase as any)
        .from("business_profiles").select("place_id, id, is_draft").eq("owner_user_id", user.id).maybeSingle();
      // Draft profile NIE wymusza redirectu - jezeli user nie dokonczyl flow
      // upgrade z /biznes/start, to nie blokujemy mu apki konsumenckiej.
      if (bp?.is_draft) return;
      if (bp?.id) navigate(await businessPanelPath(user.id, bp), { replace: true });
    })();
  }, [user, location.pathname]);

  return null;
}
import CookieBanner from "./components/CookieBanner";
import ScreenSkeleton, { variantForPath } from "./components/layout/ScreenSkeleton";
import SplashDraw from "./components/layout/SplashDraw";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isHardcodedAdmin } from "@/lib/admins";

// Auto-recovery po nowym deployu: stary index.js odwoluje sie do chunkow o hashach,
// ktore nowy deploy usunal z serwera -> lazy import rzuca "Failed to fetch dynamically
// imported module" (404). Przy pierwszym takim bledzie przeladowujemy strone, zeby
// pobrac swiezy manifest. Guard czasowy zapobiega petli reloadow gdy chunk realnie
// nie istnieje (offline / prawdziwy brak) - wtedy blad leci do ErrorBoundary.
function lazy(factory: Parameters<typeof reactLazy>[0]) {
  return reactLazy(() =>
    (factory() as Promise<{ default: React.ComponentType<any> }>).catch((err: any) => {
      const msg = String(err?.message || err);
      const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically imported/i.test(msg);
      const KEY = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (isChunkError && Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => {}); // nie resolvuje - strona sie przeladowuje
      }
      throw err;
    })
  );
}

// Lazy-loaded public pages - one chunk each, fetched on demand
const LandingV2 = lazy(() => import("./pages/LandingV2"));
import ForBusinessPage from "./pages/ForBusinessPage";
import Auth from "./pages/Auth";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
// Lazy loaded - only fetched when the user navigates to that route
const AppLayout        = lazy(() => import("./components/layout/AppLayout"));
const HomeSwipe        = lazy(() => import("./pages/HomeSwipe"));
const Explore          = lazy(() => import("./pages/Explore"));
const CreateRanking    = lazy(() => import("./pages/CreateRanking"));
const ComposeWyjazd    = lazy(() => import("./pages/ComposeWyjazd"));
const CountryCityPicker = lazy(() => import("./pages/CountryCityPicker"));
const StartWyjazd      = lazy(() => import("./pages/StartWyjazd"));
const CreateRoute      = lazy(() => import("./pages/CreateRoute"));
const Settings         = lazy(() => import("./pages/Settings"));
const Stats            = lazy(() => import("./pages/Stats"));
const DayReview        = lazy(() => import("./pages/DayReview"));
const SetPassword      = lazy(() => import("./pages/SetPassword"));
const TravelerProfile  = lazy(() => import("./pages/TravelerProfile"));
const MyTrips          = lazy(() => import("./pages/MyTrips"));
const EditPlan         = lazy(() => import("./pages/EditPlan"));
const ReviewSummary    = lazy(() => import("./pages/ReviewSummary"));
const AddPlaceToTrip   = lazy(() => import("./pages/AddPlaceToTrip"));
const PlanWizard       = lazy(() => import("./pages/PlanWizard"));
const AddFriend        = lazy(() => import("./pages/AddFriend"));
const QuickPlanReview  = lazy(() => import("./pages/QuickPlanReview"));
const UserSearch       = lazy(() => import("./pages/UserSearch"));
const SharedRoute      = lazy(() => import("./pages/SharedRoute"));
const SharedList       = lazy(() => import("./pages/SharedList"));
const PublicProfile    = lazy(() => import("./pages/PublicProfile"));
const ClaimPlace       = lazy(() => import("./pages/ClaimPlace"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const BusinessOnePager  = lazy(() => import("./pages/BusinessOnePager"));
const BusinessStart     = lazy(() => import("./pages/BusinessStart"));
const BusinessOnboarding = lazy(() => import("./pages/BusinessOnboarding"));
const BusinessLanding   = lazy(() => import("./pages/BusinessLanding"));

// Tryb uproszczony: /plan sluzy TEZ do zwyklego przegladania kart (exploreMode - "Przegladaj"
// w eksploracji, bez intencji planowania, bez zapisu draftu). Przegladanie zostaje wlaczone;
// blokujemy tylko wejscie w kreator planu.
function PlanRoute() {
  const location = useLocation();
  const st = location.state as any;
  // Wpuszczamy do PlanWizard mimo wylaczonego planowania: exploreMode ("Przegladaj") oraz
  // wyjazdMode ("Stworz wyjazd" - miasto+daty+swiper -> wyjazd, bez kulminacji w planie AI).
  // exploreMode ("Przegladaj") wchloniete przez /eksploruj (lokalny toggle feed<->swiper,
  // seamless). Stare wejscia do /plan exploreMode przekierowujemy na /eksploruj (widok swipera).
  if (st?.exploreMode) return <Navigate to="/eksploruj" state={{ view: "browse", city: st?.city }} replace />;
  const allowed = !!st?.wyjazdMode;
  if (PLANNING_DISABLED && !allowed) return <Navigate to="/eksploruj" replace />;
  return <PlanWizard />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Po wlaczeniu internetu po offline - automatyczny refetch wszystkich
      // aktywnych queries. Bez tego user widzial bialy ekran / "brak miejsc"
      // dopoki nie zrobil page reload (test Network edge cases / airplane mode).
      refetchOnReconnect: "always",
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

function AuthDrawerProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Native iOS APNs registration - tylko gdy user logged in + isNative.
  // Web/PWA uzywa osobnego usePushNotifications (Service Worker + VAPID).
  useNativePush();
  // GLOBALNE powiadomienia in-app (toast + badge) na wszystkich ekranach - dziala gdy user w apce
  // (nawet tam gdzie nie ma TopBara, np. /moj-profil, /route). Realtime na tabeli notifications.
  useNotificationsLive();
  // Native network reconnect detection - invalidateQueries gdy connection wraca.
  // No-op na webie (refetchOnReconnect: "always" w queryClient zalatwia sprawe).
  useNetworkReconnect();
  // Odswiezenie danych po powrocie appki na wierzch (m.in. swieze profile biznesow po edycji).
  useAppResume();
  // Gest natywny: przeciagniecie od lewej krawedzi = cofniecie (WKWebView nie ma systemowego).
  useEdgeSwipeBack();
  return (
    <AuthDrawerProvider user={user} loading={loading}>
      {children}
    </AuthDrawerProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <HashRouter>
        <ErrorBoundary>
        <AuthProvider>
        <AuthDrawerProviderWrapper>
        <GlobalAuthCallback />
        <NativeDeepLinkHandler />
        <RouteTracker />
        <SplashController />
        <BusinessGuard />
        <CookieBanner />
        <AuthDrawer />
        <OnboardingProvider>
        <MaintenanceGate>
        <WebWaitlistGate>
        <AuthGate>
        {/* Przejscie miedzy ekranami: szkielet ukladu docelowego zamiast pustego ekranu ze
            spinnerem (prosba Nat 2026-08-31). Wariant zgadujemy z adresu - w tym momencie
            komponent ekranu jeszcze sie nie zaladowal. */}
        <Suspense fallback={<ScreenSkeleton variant={variantForPath(window.location.hash)} />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          {/* Landing B2C (spontaway) stoi pod "/" (patrz WebRoot). /landing i /waitlist
              ubite 2026-09-02 - stare linki lapie WebWaitlistGate i odsyla na root. */}
          <Route path="/landing-v2" element={<LandingV2 />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/" element={<WebRoot />} />
          {/* Tryb uproszczony (PLANNING_DISABLED): "Twoje trasy" scalone w Wyjazdy (Dziennik). */}
          <Route path="/home" element={PLANNING_DISABLED ? <Navigate to="/moj-profil?tab=wyjazdy" replace /> : <AppLayout hideTopBar><HomeSwipe /></AppLayout>} />
          <Route path="/eksploruj" element={<AppLayout hideTopBar><Explore /></AppLayout>} />
          {/* /polubione (Zapisane) przeniesione do zakładki profilu (IA 2026-08-20). Redirect dla starych linków/pushy. */}
          <Route path="/polubione" element={<Navigate to="/moj-profil" replace />} />
          <Route path="/zestawienie/nowe" element={<RequireAuth><CreateRanking /></RequireAuth>} />
          <Route path="/zestawienie/:id/edytuj" element={<RequireAuth><CreateRanking /></RequireAuth>} />
          {/* /create (generowanie planu przez AI) - wylaczone w trybie uproszczonym na native.
              Na web zostaje (testowy flow sesji grupowej odblokowany w WebWaitlistGate). */}
          <Route path="/create" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <CreateRoute />} />
          <Route path="/settings" element={<RequireAuth><AppLayout><Settings /></AppLayout></RequireAuth>} />
          <Route path="/statystyki" element={<RequireAuth><Stats /></RequireAuth>} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/set-password-biznes" element={<SetPassword forceBusiness />} />
          {/* Panel admina przeniesiony na admin.spontaway.com (usuniety z aplikacji). */}
          <Route path="/moje-trasy" element={PLANNING_DISABLED ? <Navigate to="/moj-profil?tab=wyjazdy" replace /> : <AppLayout><MyTrips /></AppLayout>} />
          {/* /dziennik (Wyjazdy/Journal) przeniesione do zakładki profilu (IA 2026-08-20). Redirect dla starych linków/pushy. */}
          <Route path="/dziennik" element={<Navigate to="/moj-profil?tab=wyjazdy" replace />} />
          <Route path="/moj-profil" element={<AppLayout hideTopBar><TravelerProfile /></AppLayout>} />
          <Route path="/edit-plan" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <EditPlan />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/trasa/:id/dodaj" element={<AddPlaceToTrip />} />
          {/* /trasa/:id (stara strona odhaczania ActiveTrip) USUNIETA 2026-08-24 - redirect na profil. */}
          <Route path="/trasa/:id" element={<Navigate to="/moj-profil?tab=wyjazdy" replace />} />
          {/* Wyjazd (tryb uproszczony) laduje w edytorze wpisu = /review-summary (ReviewSummary). */}
          {/* Kompozycja wyjazdu z zestawienia ("Uzyj tego zestawienia") - nazwa+daty+miejsca */}
          <Route path="/wyjazd/start" element={<StartWyjazd />} />
          <Route path="/wyjazd/nowy" element={<ComposeWyjazd />} />
          <Route path="/utworz" element={<CountryCityPicker />} />
          {/* Widok huba Robocze/Zapisane USUNIETY (IA 2026-08-22) - robocze wyjazdy sa w profilu
              "Wyjazdy" (badge Robocze), zapisane w profilu "Zapisane". Stare linki -> redirect. */}
          <Route path="/utworz/robocze" element={<Navigate to="/moj-profil?tab=wyjazdy" replace />} />
          <Route path="/utworz/zapisane" element={<Navigate to="/moj-profil" replace />} />
          <Route path="/wyjazd/:id" element={<Navigate to="/moj-profil?tab=wyjazdy" replace />} />
          {/* Planowanie tras (kreator + sesje grupowe) - wylaczone w trybie uproszczonym na native.
              Wyjatek: exploreMode ("Przegladaj") zostaje wlaczony - patrz PlanRoute. */}
          <Route path="/plan" element={<PlanRoute />} />
          <Route path="/dodaj/:code" element={<AddFriend />} />
          <Route path="/search" element={<UserSearch />} />
          <Route path="/route/:id" element={<SharedRoute />} />
          <Route path="/lista/:id" element={<SharedList />} />
          <Route path="/lokal/:placeId" element={<ClaimPlace />} />
          <Route path="/profil/:username" element={<PublicProfile />} />
          <Route path="/quick-plan-review" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <QuickPlanReview />} />
          <Route path="/biznes/start" element={<BusinessStart />} />
          <Route path="/biznes/onboarding/:id" element={<BusinessOnboarding />} />
          <Route path="/biznes/:placeId" element={<BusinessDashboard />} />
          <Route path="/dla-firm" element={<ForBusinessPage />} />
          <Route path="/dla-firm/landing" element={<BusinessLanding />} />
<Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </AuthGate>
        </WebWaitlistGate>
        </MaintenanceGate>
        </OnboardingProvider>
        </AuthDrawerProviderWrapper>
        </AuthProvider>
        </ErrorBoundary>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
