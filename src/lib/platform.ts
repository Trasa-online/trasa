import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const isWeb = !isNative;
export const platform = Capacitor.getPlatform() as "ios" | "android" | "web";

// Na native (Capacitor) relative URLs resolwuja sie do capacitor://localhost,
// gdzie nasze Vercel Edge Functions nie istnieja. Trzeba uzyc absolute URL.
// Na web "" oznacza same-origin (np. https://trasa.travel/api/... = relative).
export const API_BASE = isNative ? "https://trasa.travel" : "";

export const capabilities = {
  webShare: typeof navigator !== "undefined" && "share" in navigator,
  nativeShare: isNative,
  haptics: isNative,
  geolocation: isNative || (typeof navigator !== "undefined" && "geolocation" in navigator),
  pushNotifications: isNative,
  serviceWorker: isWeb && typeof navigator !== "undefined" && "serviceWorker" in navigator,
  installablePWA: isWeb,
  vercelAnalytics: isWeb,
};
