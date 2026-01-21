import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";
import Waitlist from "./pages/Waitlist";
import MyRoutes from "./pages/MyRoutes";
import CreateRoute from "./pages/CreateRoute";
import SavedRoutes from "./pages/SavedRoutes";
import Settings from "./pages/Settings";
import RouteDetails from "./pages/RouteDetails";
import Search from "./pages/Search";
import Admin from "./pages/Admin";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import PinDetails from "./pages/PinDetails";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/" element={<AppLayout><Feed /></AppLayout>} />
          <Route path="/my-routes" element={<AppLayout><MyRoutes /></AppLayout>} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/edit/:id" element={<CreateRoute />} />
          <Route path="/saved" element={<AppLayout><SavedRoutes /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="/route/:id" element={<AppLayout><RouteDetails /></AppLayout>} />
          <Route path="/pin/:pinId" element={<AppLayout><PinDetails /></AppLayout>} />
          <Route path="/search" element={<AppLayout><Search /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
          <Route path="/notifications" element={<AppLayout><Notifications /></AppLayout>} />
          <Route path="/profile/:userId" element={<AppLayout><Profile /></AppLayout>} />
          <Route path="/friends/:userId" element={<AppLayout><Friends /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;