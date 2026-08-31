import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import AdminApp from "./AdminApp";
import "@/index.css";
import "./admin.css";

// Panel admina NIE ma i nie powinien miec service-workera. Jesli jakis SW zostal
// wczesniej zarejestrowany na tej domenie (np. gdy chwilowo serwowala apke z PWA),
// przegladarka moze serwowac STARY build mimo deployu (stad "stara" wersja logowania).
// Wyrejestrowujemy wszystkie SW i czyscimy cache przy kazdym wejsciu - samonaprawa.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => { /* ignore */ });
  if (typeof caches !== "undefined" && caches.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => { /* ignore */ });
  }
}

// Panel operacyjny (admin.trasa.travel) - osobny web-only entry.
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
