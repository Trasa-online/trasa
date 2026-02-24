import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import CreateRoute from "./pages/CreateRoute";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import CreateTrip from "./pages/CreateTrip";
import DayReview from "./pages/DayReview";
import Terms from "./pages/Terms";
import MyRoutes from "./pages/MyRoutes";
import Onboarding from "./pages/Onboarding";
import SetPassword from "./pages/SetPassword";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<AppLayout><Home /></AppLayout>} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/my-routes" element={<AppLayout><MyRoutes /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/create-trip" element={<CreateTrip />} />
          <Route path="/day-review" element={<DayReview />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
