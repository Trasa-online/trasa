import { QueryClient } from "@tanstack/react-query";

// JEDEN klient zapytan na cala aplikacje. Wyciagniety z App.tsx do osobnego modulu
// (2026-09-15), zeby warstwa danych - a nie komponent - mogla uniewazniac cache.
// Konkretny powod: usuwanie wyjazdu / kolekcji musi odswiezyc kilkanascie list naraz,
// a kazde miejsce w UI pamietalo tylko o swoich kluczach. Patrz `invalidateContentLists`
// w [trash.ts](./trash.ts).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Po wlaczeniu internetu po offline - automatyczny refetch wszystkich
      // aktywnych queries. Bez tego user widzial bialy ekran / "brak miejsc"
      // dopoki nie zrobil page reload (test Network edge cases / airplane mode).
      refetchOnReconnect: "always",
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});
