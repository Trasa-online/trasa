import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
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
import DayPlan from "./pages/DayPlan";
import Terms from "./pages/Terms";
import MyRoutes from "./pages/MyRoutes";
import Onboarding from "./pages/Onboarding";
import SetPassword from "./pages/SetPassword";
import Admin from "./pages/Admin";
import TravelerProfile from "./pages/TravelerProfile";
import MyTrips from "./pages/MyTrips";
import Journal from "./pages/Journal";
import SwipeHistory from "./pages/SwipeHistory";
import EditPlan from "./pages/EditPlan";
import ReviewSummary from "./pages/ReviewSummary";
import PlanWizard from "./pages/PlanWizard";
import AdminRoutes from "./pages/AdminRoutes";
import SharedRoute from "./pages/SharedRoute";
import JoinPage from "./pages/JoinPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <CookieBanner />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/my-routes" element={<AppLayout><MyRoutes /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/day-plan" element={<DayPlan />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/moje-trasy" element={<AppLayout><MyTrips /></AppLayout>} />
          <Route path="/dziennik" element={<AppLayout><Journal /></AppLayout>} />
          <Route path="/historia" element={<AppLayout><SwipeHistory /></AppLayout>} />
          <Route path="/moj-profil" element={<AppLayout><TravelerProfile /></AppLayout>} />
          <Route path="/edit-plan" element={<EditPlan />} />
          <Route path="/review-summary" element={<ReviewSummary />} />
          <Route path="/plan" element={<PlanWizard />} />
          <Route path="/admin/routes" element={<AdminRoutes />} />
          <Route path="/route/:id" element={<SharedRoute />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
