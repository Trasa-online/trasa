import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Feed />} />
          <Route path="/my-routes" element={<MyRoutes />} />
          <Route path="/create" element={<CreateRoute />} />
          <Route path="/edit/:id" element={<CreateRoute />} />
          <Route path="/saved" element={<SavedRoutes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/route/:id" element={<RouteDetails />} />
          <Route path="/search" element={<Search />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
