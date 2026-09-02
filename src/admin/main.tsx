import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import AdminApp from "./AdminApp";
import "@/index.css";
import "./admin.css";

// Panel operacyjny (admin.spontaway.com) - osobny web-only entry.
// BrowserRouter (nie HashRouter): admin jest tylko web na czystej domenie z
// SPA-rewrite Vercela, wiec czyste URL-e (/moderacja, /users) bez '#'.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AdminApp />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
