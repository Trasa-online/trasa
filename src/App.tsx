import { useEffect, useRef, useState, lazy as reactLazy, Suspense } from "react";
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
import AuthDrawer from "@/components/auth/AuthDrawer";
import { TrasaLogo } from "@/components/TrasaLogo";
import { businessPanelPath } from "@/lib/businessRedirect";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/platform";
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
    location.pathname === "/waitlist" ||
    location.pathname === "/landing" ||
    location.pathname === "/landing-v2" ||
    location.pathname.startsWith("/set-password") ||
    location.pathname.startsWith("/biznes/") ||
    location.pathname.startsWith("/dla-firm/");
  if (!user && !isPublicRoute) return <MaintenanceScreen onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}

// Na WEB chowamy aplikacje B2C za waitlista - userzy nie maja ogladac dema apki webowej.
// Native (iOS) = pelna apka, bez redirectu. Allowlista (zostaje na web): biznes, auth,
// set-password, marketing (landing/dla-firm), legal, linki publiczne (shared route / profil /
// claim lokalu) + callbacki auth (?code=/?token_hash=). Reszta (w tym /demo) -> /waitlist.
function WebWaitlistGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (isNative) return <>{children}</>;
  const hasAuthParams = /[?&#](code|token_hash|error|access_token)=/.test(window.location.href);
  const p = location.pathname;
  const allowed =
    p === "/waitlist" || p === "/landing" || p === "/landing-v2" || p === "/auth" ||
    p === "/terms" || p === "/privacy" ||
    p.startsWith("/set-password") || p.startsWith("/biznes") ||
    p.startsWith("/dla-firm") || p.startsWith("/route/") ||
    p.startsWith("/profil/") || p.startsWith("/lokal/") ||
    // TEST: odblokowane parowanie grupowe na web (sesja grupowa + swipe + tworzenie trasy
    // z grupy przez PlanChatExperience). Reszta apki B2C nadal za waitlista.
    p.startsWith("/sesja") || p === "/create" || p.startsWith("/quick-plan-review") ||
    // Link zaproszeniowy znajomych (viral) - musi byc publiczny na web
    p.startsWith("/dodaj");
  if (!allowed && !hasAuthParams) return <Navigate to="/waitlist" replace />;
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
        toast.success("Witamy w Trasie 🧡");
        // Web OAuth wraca na origin/ i tracimy kontekst route. Jesli przed logowaniem
        // zapisalismy docelowa sciezke (np. /sesja/KOD - dolaczanie do sesji grupowej),
        // wracamy do niej zamiast na /eksploruj (= waitlista na web).
        // Priorytet: ?next= z URL (odporny na in-app browser) > sessionStorage > /eksploruj.
        let dest = "/eksploruj";
        try {
          const stored = sessionStorage.getItem("trasa_post_login_redirect");
          if (stored) { dest = stored; sessionStorage.removeItem("trasa_post_login_redirect"); }
        } catch { /* sessionStorage unavailable */ }
        if (nextDest) dest = nextDest;
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
      const fragment = fragmentIdx >= 0 ? url.slice(fragmentIdx + 1) : "";
      const params = new URLSearchParams(query);
      const hashParams = new URLSearchParams(fragment);
      const code = params.get("code");
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      if (code) {
        const { error } = await dedupedExchange(code);
        if (error) console.error("[NativeDeepLink] exchange failed:", error.message);
      } else if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) console.error("[NativeDeepLink] setSession failed:", error.message);
      } else {
        console.warn("[NativeDeepLink] auth/callback URL bez code i token:", url);
      }
      // AppLayout useEffect zlapie auth state change i zdecyduje gdzie navigate'owac
      // (intent-aware: guest_plan -> /create, biz -> /biznes, inaczej zostan).
    });
    return () => { handlerPromise.then((h) => h.remove()).catch(() => {}); };
  }, []);
  return null;
}

function RootPage() {
  const { loading } = useAuth();
  const [exchangingCode, setExchangingCode] = useState(false);
  const [codeChecked, setCodeChecked] = useState(false);

  // Po kliknieciu linka aktywacyjnego Supabase redirectuje na trasa.travel z
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
  return <Navigate to="/eksploruj" replace />;
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

// ── Splash screen shown on app boot ─────────────────────────────────────────
// On native (iOS/Android), the Capacitor SplashScreen plugin renders the splash
// OUTSIDE the WebView — we only need to call SplashScreen.hide() when ready.
// This React component is the web/PWA fallback (no native splash there).

// Animowany splash (logo "mryga" - pulsuje). Renderowany w WebView na natywnym i
// web; natywny statyczny splash chowamy zaraz po starcie (oba tla #FEFEFE).
function SplashScreen({ done }: { done: boolean }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHidden(true), 450);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex items-center justify-center"
      style={{ transition: "opacity 0.4s", opacity: done ? 0 : 1 }}
    >
      <TrasaLogo size={132} />
    </div>
  );
}

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

  const skipSplash =
    location.pathname.startsWith("/biznes") ||
    location.pathname.startsWith("/dla-firm") ||
    location.pathname === "/auth" ||
    location.pathname.startsWith("/set-password") ||
    location.pathname === "/demo";

  const [visible, setVisible] = useState(!skipSplash);
  const [bootDone, setBootDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  // Splash znika gdy boot gotowy ORAZ minal krotki min. czas (zeby statyczny
  // splash nie mrugnal na 1 klatke przy blyskawicznym starcie).
  const done = bootDone && minElapsed;

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Ukryj natywny statyczny splash zaraz po pierwszym paint React splasha -
  // animowany (w WebView) przejmuje plynnie (oba tla #FEFEFE).
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    const t = setTimeout(() => {
      import("@capacitor/splash-screen").then(({ SplashScreen: NativeSplash }) => {
        if (!cancelled) NativeSplash.hide({ fadeOutDuration: 200 }).catch(() => {});
      });
    }, 90);
    return () => { cancelled = true; clearTimeout(t); };
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
  return <SplashScreen done={done} />;
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
      location.pathname === "/moj-profil" ||
      location.pathname === "/demo"
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
const WaitlistPage = lazy(() => import("./pages/WaitlistPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LandingV2 = lazy(() => import("./pages/LandingV2"));
const DemoSession = lazy(() => import("./pages/DemoSession"));
import ForBusinessPage from "./pages/ForBusinessPage";
import Auth from "./pages/Auth";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
// Lazy loaded - only fetched when the user navigates to that route
const AppLayout        = lazy(() => import("./components/layout/AppLayout"));
const HomeSwipe        = lazy(() => import("./pages/HomeSwipe"));
const Explore          = lazy(() => import("./pages/Explore"));
const LikedPlaces      = lazy(() => import("./pages/LikedPlaces"));
const CreateRanking    = lazy(() => import("./pages/CreateRanking"));
const CreateRoute      = lazy(() => import("./pages/CreateRoute"));
const Settings         = lazy(() => import("./pages/Settings"));
const DayReview        = lazy(() => import("./pages/DayReview"));
const SetPassword      = lazy(() => import("./pages/SetPassword"));
const TravelerProfile  = lazy(() => import("./pages/TravelerProfile"));
const MyTrips          = lazy(() => import("./pages/MyTrips"));
const Journal          = lazy(() => import("./pages/Journal"));
const EditPlan         = lazy(() => import("./pages/EditPlan"));
const ReviewSummary    = lazy(() => import("./pages/ReviewSummary"));
const ActiveTrip       = lazy(() => import("./pages/ActiveTrip"));
const AddPlaceToTrip   = lazy(() => import("./pages/AddPlaceToTrip"));
const PlanWizard       = lazy(() => import("./pages/PlanWizard"));
const CreateGroupSession = lazy(() => import("./pages/CreateGroupSession"));
const GroupSession     = lazy(() => import("./pages/GroupSession"));
const AddFriend        = lazy(() => import("./pages/AddFriend"));
const QuickPlanReview  = lazy(() => import("./pages/QuickPlanReview"));
const UserSearch       = lazy(() => import("./pages/UserSearch"));
const SharedRoute      = lazy(() => import("./pages/SharedRoute"));
const PublicProfile    = lazy(() => import("./pages/PublicProfile"));
const ClaimPlace       = lazy(() => import("./pages/ClaimPlace"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const BusinessOnePager  = lazy(() => import("./pages/BusinessOnePager"));
const BusinessStart     = lazy(() => import("./pages/BusinessStart"));
const BusinessOnboarding = lazy(() => import("./pages/BusinessOnboarding"));
const BusinessLanding   = lazy(() => import("./pages/BusinessLanding"));

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
  // Native network reconnect detection - invalidateQueries gdy connection wraca.
  // No-op na webie (refetchOnReconnect: "always" w queryClient zalatwia sprawe).
  useNetworkReconnect();
  // Odswiezenie danych po powrocie appki na wierzch (m.in. swieze profile biznesow po edycji).
  useAppResume();
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
        <MaintenanceGate>
        <WebWaitlistGate>
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/landing-v2" element={<LandingV2 />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/" element={<RootPage />} />
          {/* Tryb uproszczony (PLANNING_DISABLED): "Twoje trasy" scalone w Wyjazdy (Dziennik). */}
          <Route path="/home" element={PLANNING_DISABLED ? <Navigate to="/dziennik" replace /> : <AppLayout hideTopBar><HomeSwipe /></AppLayout>} />
          <Route path="/eksploruj" element={<AppLayout hideTopBar><Explore /></AppLayout>} />
          <Route path="/polubione" element={<AppLayout hideTopBar><LikedPlaces /></AppLayout>} />
          <Route path="/zestawienie/nowe" element={<RequireAuth><CreateRanking /></RequireAuth>} />
          <Route path="/zestawienie/:id/edytuj" element={<RequireAuth><CreateRanking /></RequireAuth>} />
          {/* /create (generowanie planu przez AI) - wylaczone w trybie uproszczonym na native.
              Na web zostaje (testowy flow sesji grupowej odblokowany w WebWaitlistGate). */}
          <Route path="/create" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <CreateRoute />} />
          <Route path="/settings" element={<RequireAuth><AppLayout><Settings /></AppLayout></RequireAuth>} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/set-password-biznes" element={<SetPassword forceBusiness />} />
          {/* Panel admina przeniesiony na admin.trasa.travel (usuniety z aplikacji). */}
          <Route path="/moje-trasy" element={PLANNING_DISABLED ? <Navigate to="/dziennik" replace /> : <AppLayout><MyTrips /></AppLayout>} />
          <Route path="/dziennik" element={<AppLayout hideTopBar><Journal /></AppLayout>} />
          <Route path="/moj-profil" element={<AppLayout hideTopBar><TravelerProfile /></AppLayout>} />
          <Route path="/edit-plan" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <EditPlan />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/trasa/:id/dodaj" element={<AddPlaceToTrip />} />
          <Route path="/trasa/:id" element={<ActiveTrip />} />
          {/* Planowanie tras (kreator + sesje grupowe) - wylaczone w trybie uproszczonym na native. */}
          <Route path="/plan" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <PlanWizard />} />
          <Route path="/demo" element={<DemoSession />} />
          <Route path="/sesja/nowa" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <CreateGroupSession />} />
          <Route path="/sesja/:joinCode" element={PLANNING_DISABLED ? <Navigate to="/eksploruj" replace /> : <GroupSession />} />
          <Route path="/dodaj/:code" element={<AddFriend />} />
          <Route path="/search" element={<UserSearch />} />
          <Route path="/route/:id" element={<SharedRoute />} />
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
        </WebWaitlistGate>
        </MaintenanceGate>
        </AuthDrawerProviderWrapper>
        </AuthProvider>
        </ErrorBoundary>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
