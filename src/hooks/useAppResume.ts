import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App as CapApp } from "@capacitor/app";
import { isNative } from "@/lib/platform";

// Odswiezenie danych po powrocie appki na wierzch (native: z tla; web: z innej zakladki).
//
// Problem: gdy lokal zaktualizuje swoj profil (business_profiles) w dashboardzie, a user ma
// juz otwarta appke, zmiany nie byly widoczne. Powody:
//  - PlaceSwiper trzyma miejsca (z zagniezdzonym business_profiles) w LOKALNYM state i refetchuje
//    tylko przy zmianie miasta/filtra albo remount - nie po prostym powrocie do appki.
//  - React Query 'refetchOnWindowFocus' polega na window 'focus'/'visibilitychange', ktore w
//    WKWebView na iOS nie pala sie niezawodnie przy resume z tla.
//
// Ten hook na resume: invalidateQueries() (refetch aktywnych React Query views) + emituje
// window event 'trasa:app-resume', ktorego slucha PlaceSwiper zeby dociagnac swieze miejsca.
export function useAppResume() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries();
      window.dispatchEvent(new CustomEvent("trasa:app-resume"));
    };

    if (isNative) {
      let listenerHandle: { remove: () => Promise<void> } | null = null;
      (async () => {
        const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
          if (isActive) refresh();
        });
        listenerHandle = handle as { remove: () => Promise<void> };
      })();
      return () => { if (listenerHandle) void listenerHandle.remove(); };
    }

    // Web/PWA: zakladka wraca na wierzch.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient]);
}
