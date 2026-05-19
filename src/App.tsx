import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
    location.pathname.startsWith("/set-password") ||
    location.pathname.startsWith("/join/") ||
    location.pathname.startsWith("/biznes/") ||
    location.pathname.startsWith("/dla-firm/");
  if (!user && !isPublicRoute) return <MaintenanceScreen onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}

function RootPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;
  return <Navigate to="/auth" replace />;
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

function SplashScreen({ done }: { done: boolean }) {
  if (isNative) return null;
  const [progress, setProgress] = useState(5);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => {
      setProgress(p => {
        const next = p + Math.random() * 12 + 4;
        if (next >= 85) { clearInterval(id); return 85; }
        return next;
      });
    }, 130);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (!done) return;
    setProgress(100);
    const t = setTimeout(() => setHidden(true), 500);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5"
      style={{ transition: "opacity 0.4s", opacity: done ? 0 : 1 }}
    >
      <div
        className="h-20 w-20 rounded-full shadow-lg"
        style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
      />
      <p className="font-black text-2xl tracking-tight text-foreground">trasa</p>
      <div className="flex flex-col items-center gap-1.5 w-44">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%`, transition: "width 0.3s ease-out" }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</p>
      </div>
    </div>
  );
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
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible || loading || booted.current) return;
    booted.current = true;

    if (!user) { setDone(true); setTimeout(() => setVisible(false), 500); return; }

    (async () => {
      try {
        const { data: adminRow } = await supabase
          .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (adminRow) return;

        const { data: bp } = await (supabase as any)
          .from("business_profiles").select("place_id, id").eq("owner_user_id", user.id).maybeSingle();
        if (bp?.id) navigate(`/biznes/${bp.place_id ?? bp.id}`, { replace: true });
      } finally {
        setDone(true);
        setTimeout(() => setVisible(false), 500);
      }
    })();
  }, [loading, user, visible]);

  // Hide native Capacitor splash once we're ready (boot logic done) or on a skipSplash route.
  // On web this is a no-op (lazy import never resolves to a meaningful action — see useShare pattern).
  const readyToHideNative = isNative && !loading && (skipSplash || done);
  useEffect(() => {
    if (!readyToHideNative) return;
    let cancelled = false;
    import("@capacitor/splash-screen").then(({ SplashScreen: NativeSplash }) => {
      if (cancelled) return;
      NativeSplash.hide({ fadeOutDuration: 300 }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [readyToHideNative]);

  if (!visible) return null;
  return <SplashScreen done={done} />;
}

// Blocks unauthenticated access to app routes - redirects to /auth with optional hint
function RequireAuth({ children, hint }: { children: React.ReactNode; hint?: "journal" | "settings" }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>;
  if (!user) {
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
    if (
      location.pathname.startsWith("/biznes") ||
      location.pathname.startsWith("/dla-firm") ||
      location.pathname === "/auth" ||
      location.pathname.startsWith("/set-password") ||
      location.pathname === "/settings" ||
      location.pathname === "/moj-profil" ||
      location.pathname === "/demo"
    ) return;

    (async () => {
      const { data: adminRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (adminRow) return;

      const { data: bp } = await (supabase as any)
        .from("business_profiles").select("place_id, id").eq("owner_user_id", user.id).maybeSingle();
      if (bp?.id) navigate(`/biznes/${bp.place_id ?? bp.id}`, { replace: true });
    })();
  }, [user, location.pathname]);

  return null;
}
import CookieBanner from "./components/CookieBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isNative } from "@/lib/platform";
// Lazy-loaded public pages - one chunk each, fetched on demand
const WaitlistPage = lazy(() => import("./pages/WaitlistPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const DemoSession = lazy(() => import("./pages/DemoSession"));
import ForBusinessPage from "./pages/ForBusinessPage";
import Auth from "./pages/Auth";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
// Lazy loaded - only fetched when the user navigates to that route
const AppLayout        = lazy(() => import("./components/layout/AppLayout"));
const Home             = lazy(() => import("./pages/Home"));
const CreateRoute      = lazy(() => import("./pages/CreateRoute"));
const Settings         = lazy(() => import("./pages/Settings"));
const DayReview        = lazy(() => import("./pages/DayReview"));
const SetPassword      = lazy(() => import("./pages/SetPassword"));
const Admin            = lazy(() => import("./pages/Admin"));
const TravelerProfile  = lazy(() => import("./pages/TravelerProfile"));
const MyTrips          = lazy(() => import("./pages/MyTrips"));
const Journal          = lazy(() => import("./pages/Journal"));
const EditPlan         = lazy(() => import("./pages/EditPlan"));
const ReviewSummary    = lazy(() => import("./pages/ReviewSummary"));
const PlanWizard       = lazy(() => import("./pages/PlanWizard"));
const CreateGroupSession = lazy(() => import("./pages/CreateGroupSession"));
const GroupSession     = lazy(() => import("./pages/GroupSession"));
const QuickPlanReview  = lazy(() => import("./pages/QuickPlanReview"));
const UserSearch       = lazy(() => import("./pages/UserSearch"));
const AdminRoutes      = lazy(() => import("./pages/AdminRoutes"));
const SharedRoute      = lazy(() => import("./pages/SharedRoute"));
const JoinPage         = lazy(() => import("./pages/JoinPage"));
const PublicProfile    = lazy(() => import("./pages/PublicProfile"));
const ClaimPlace       = lazy(() => import("./pages/ClaimPlace"));
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const BusinessOnePager  = lazy(() => import("./pages/BusinessOnePager"));
const BusinessStart     = lazy(() => import("./pages/BusinessStart"));
const BusinessLanding   = lazy(() => import("./pages/BusinessLanding"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <HashRouter>
        <ErrorBoundary>
        <AuthProvider>
        <RouteTracker />
        <SplashController />
        <BusinessGuard />
        <CookieBanner />
        <MaintenanceGate>
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<RootPage />} />
          <Route path="/home" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/settings" element={<RequireAuth><AppLayout><Settings /></AppLayout></RequireAuth>} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/set-password-biznes" element={<SetPassword forceBusiness />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/moje-trasy" element={<AppLayout><MyTrips /></AppLayout>} />
          <Route path="/dziennik" element={<RequireAuth hint="journal"><AppLayout><Journal /></AppLayout></RequireAuth>} />
          <Route path="/moj-profil" element={<AppLayout><TravelerProfile /></AppLayout>} />
          <Route path="/edit-plan" element={<EditPlan />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/plan" element={<PlanWizard />} />
          <Route path="/demo" element={<DemoSession />} />
          <Route path="/sesja/nowa" element={<CreateGroupSession />} />
          <Route path="/sesja/:joinCode" element={<GroupSession />} />
          <Route path="/search" element={<UserSearch />} />
          <Route path="/admin/routes" element={<RequireAuth><AdminRoutes /></RequireAuth>} />
          <Route path="/route/:id" element={<SharedRoute />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/lokal/:placeId" element={<ClaimPlace />} />
          <Route path="/profil/:username" element={<PublicProfile />} />
          <Route path="/quick-plan-review" element={<QuickPlanReview />} />
          <Route path="/biznes/start" element={<BusinessStart />} />
          <Route path="/biznes/:placeId" element={<BusinessDashboard />} />
          <Route path="/dla-firm" element={<ForBusinessPage />} />
          <Route path="/dla-firm/landing" element={<BusinessLanding />} />
<Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </MaintenanceGate>
        </AuthProvider>
        </ErrorBoundary>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
