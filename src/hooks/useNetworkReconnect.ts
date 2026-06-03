import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Network } from "@capacitor/network";
import { isNative } from "@/lib/platform";

// iOS WebView nie propaguje native networkStatusChange do navigator.onLine,
// wiec TanStack Query 'refetchOnReconnect' (ktore polega na window event 'online')
// czesto nie pali sie po zmianie sieci na iPhone (WiFi <-> cellular, airplane on/off).
//
// Ten hook nasluchuje natywnego Capacitor Network event i recznie invalidateQueries
// gdy connection wraca - powoduje refetch wszystkich aktywnych queries jako efekt
// uboczny (tak samo jak refetchOnReconnect dla web).
//
// Na webie hook nic nie robi - browser native online/offline events dzialaja
// natywnie i refetchOnReconnect: 'always' zalatwia sprawe.
export function useNetworkReconnect() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isNative) return;
    let wasOffline = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    (async () => {
      // Initial state - jesli startujemy offline, oznacz wasOffline
      const status = await Network.getStatus();
      wasOffline = !status.connected;

      const handle = await Network.addListener("networkStatusChange", (event) => {
        const nowOnline = event.connected;
        // Tylko gdy DROP -> CONNECTED (nie connected -> connected na zmiana typu sieci)
        if (wasOffline && nowOnline) {
          console.log("[useNetworkReconnect] reconnect detected - invalidating queries");
          queryClient.invalidateQueries();
        }
        wasOffline = !nowOnline;
      });
      listenerHandle = handle as { remove: () => Promise<void> };
    })();

    return () => {
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [queryClient]);
}
