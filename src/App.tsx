import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

function RootPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;
  return <LandingPage />;
}

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

// Redirects business-only accounts away from the regular app
function BusinessGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    if (location.pathname.startsWith("/biznes") || location.pathname === "/auth" || location.pathname.startsWith("/set-password")) return;

    (async () => {
      const { data: adminRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (adminRow) return; // admins can go anywhere

      const { data: bp } = await (supabase as any)
        .from("business_profiles").select("place_id, id").eq("owner_user_id", user.id).maybeSingle();
      if (bp?.id) navigate(`/biznes/${bp.place_id ?? bp.id}`, { replace: true });
    })();
  }, [user, location.pathname]);

  return null;
}
import CookieBanner from "./components/CookieBanner";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import CreateRoute from "./pages/CreateRoute";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import DayReview from "./pages/DayReview";
import Terms from "./pages/Terms";
import MyRoutes from "./pages/MyRoutes";
import SetPassword from "./pages/SetPassword";
import Admin from "./pages/Admin";
import TravelerProfile from "./pages/TravelerProfile";
import MyTrips from "./pages/MyTrips";
import Journal from "./pages/Journal";
import SwipeHistory from "./pages/SwipeHistory";
import EditPlan from "./pages/EditPlan";
import ReviewSummary from "./pages/ReviewSummary";
import PlanWizard from "./pages/PlanWizard";
import CreateGroupSession from "./pages/CreateGroupSession";
import GroupSession from "./pages/GroupSession";
import QuickPlanReview from "./pages/QuickPlanReview";
import UserSearch from "./pages/UserSearch";
import AdminRoutes from "./pages/AdminRoutes";
import SharedRoute from "./pages/SharedRoute";
import JoinPage from "./pages/JoinPage";
import PublicProfile from "./pages/PublicProfile";
import BusinessDashboard from "./pages/BusinessDashboard";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <BusinessGuard />
        <CookieBanner />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<RootPage />} />
          <Route path="/home" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/my-routes" element={<AppLayout><MyRoutes /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/set-password-biznes" element={<SetPassword forceBusiness />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/moje-trasy" element={<AppLayout><MyTrips /></AppLayout>} />
          <Route path="/dziennik" element={<AppLayout><Journal /></AppLayout>} />
          <Route path="/historia" element={<AppLayout><SwipeHistory /></AppLayout>} />
          <Route path="/moj-profil" element={<AppLayout><TravelerProfile /></AppLayout>} />
          <Route path="/edit-plan" element={<EditPlan />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/plan" element={<PlanWizard />} />
          <Route path="/demo" element={<Navigate to="/" replace />} />
          <Route path="/sesja/nowa" element={<CreateGroupSession />} />
          <Route path="/sesja/:joinCode" element={<GroupSession />} />
          <Route path="/search" element={<UserSearch />} />
          <Route path="/admin/routes" element={<AdminRoutes />} />
          <Route path="/route/:id" element={<SharedRoute />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/profil/:username" element={<PublicProfile />} />
          <Route path="/quick-plan-review" element={<QuickPlanReview />} />
          <Route path="/biznes/:placeId" element={<BusinessDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
