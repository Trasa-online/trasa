import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";
import MyRoutes from "./pages/MyRoutes";
import CreateRoute from "./pages/CreateRoute";
import SavedRoutes from "./pages/SavedRoutes";
import Settings from "./pages/Settings";
import RouteDetails from "./pages/RouteDetails";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Feed />} />
        <Route path="/my-routes" element={<MyRoutes />} />
        <Route path="/create" element={<CreateRoute />} />
        <Route path="/edit/:id" element={<CreateRoute />} />
        <Route path="/saved" element={<SavedRoutes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/route/:id" element={<RouteDetails />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
