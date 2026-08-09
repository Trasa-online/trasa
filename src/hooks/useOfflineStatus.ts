import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { isNative } from "@/lib/platform";

// Zwraca true gdy urzadzenie jest OFFLINE. Native: Capacitor Network (iOS WebView nie
// propaguje navigator.onLine). Web: navigator.onLine + online/offline eventy.
export function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNative) {
      const update = () => setOffline(!navigator.onLine);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
    }
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const s = await Network.getStatus();
        if (!cancelled) setOffline(!s.connected);
        handle = (await Network.addListener("networkStatusChange", (e) => setOffline(!e.connected))) as { remove: () => Promise<void> };
      } catch { /* Network API niedostepne - ignoruj */ }
    })();
    return () => { cancelled = true; if (handle) void handle.remove(); };
  }, []);

  return offline;
}
