import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

function RootPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/home" replace />;
  return <WaitlistPage />;
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

// ── Splash screen shown on app boot ─────────────────────────────────────────

function SplashScreen({ done }: { done: boolean }) {
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
    location.pathname === "/auth" ||
    location.pathname.startsWith("/set-password");

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

  if (!visible) return null;
  return <SplashScreen done={done} />;
}

// Blocks unauthenticated access to app routes - redirects to landing page
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
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
      location.pathname === "/auth" ||
      location.pathname.startsWith("/set-password") ||
      location.pathname === "/settings" ||
      location.pathname === "/moj-profil"
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
// Eagerly loaded - public-facing pages that need fast FCP
import WaitlistPage from "./pages/WaitlistPage";
import LandingPage from "./pages/LandingPage";
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
const MyRoutes         = lazy(() => import("./pages/MyRoutes"));
const SetPassword      = lazy(() => import("./pages/SetPassword"));
const Admin            = lazy(() => import("./pages/Admin"));
const TravelerProfile  = lazy(() => import("./pages/TravelerProfile"));
const MyTrips          = lazy(() => import("./pages/MyTrips"));
const Journal          = lazy(() => import("./pages/Journal"));
const SwipeHistory     = lazy(() => import("./pages/SwipeHistory"));
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
const BusinessDashboard = lazy(() => import("./pages/BusinessDashboard"));
const BusinessOnePager  = lazy(() => import("./pages/BusinessOnePager"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <RouteTracker />
        <SplashController />
        <BusinessGuard />
        <CookieBanner />
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /></div>}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<RootPage />} />
          <Route path="/home" element={<RequireAuth><AppLayout><Home /></AppLayout></RequireAuth>} />
          <Route path="/create" element={<RequireAuth><CreateRoute /></RequireAuth>} />
          <Route path="/my-routes" element={<RequireAuth><AppLayout><MyRoutes /></AppLayout></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><AppLayout><Settings /></AppLayout></RequireAuth>} />
          <Route path="/day-review" element={<RequireAuth><DayReview /></RequireAuth>} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/set-password-biznes" element={<SetPassword forceBusiness />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/moje-trasy" element={<RequireAuth><AppLayout><MyTrips /></AppLayout></RequireAuth>} />
          <Route path="/dziennik" element={<RequireAuth><AppLayout><Journal /></AppLayout></RequireAuth>} />
          <Route path="/historia" element={<RequireAuth><AppLayout><SwipeHistory /></AppLayout></RequireAuth>} />
          <Route path="/moj-profil" element={<RequireAuth><AppLayout><TravelerProfile /></AppLayout></RequireAuth>} />
          <Route path="/edit-plan" element={<RequireAuth><EditPlan /></RequireAuth>} />
          <Route path="/review-summary" element={<RequireAuth><ReviewSummary /></RequireAuth>} />
          <Route path="/plan" element={<RequireAuth><PlanWizard /></RequireAuth>} />
          <Route path="/demo" element={<Navigate to="/" replace />} />
          <Route path="/sesja/nowa" element={<RequireAuth><CreateGroupSession /></RequireAuth>} />
          <Route path="/sesja/:joinCode" element={<RequireAuth><GroupSession /></RequireAuth>} />
          <Route path="/search" element={<RequireAuth><UserSearch /></RequireAuth>} />
          <Route path="/admin/routes" element={<RequireAuth><AdminRoutes /></RequireAuth>} />
          <Route path="/route/:id" element={<SharedRoute />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/profil/:username" element={<PublicProfile />} />
          <Route path="/quick-plan-review" element={<RequireAuth><QuickPlanReview /></RequireAuth>} />
          <Route path="/biznes/demo" element={<Navigate to="/" replace />} />
          <Route path="/biznes/:placeId" element={<BusinessDashboard />} />
          <Route path="/dla-firm" element={<ForBusinessPage />} />
          <Route path="/dla-firm/start" element={<Navigate to="/" replace />} />
<Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
