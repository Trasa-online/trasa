import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const isWeb = !isNative;
export const platform = Capacitor.getPlatform() as "ios" | "android" | "web";

// Na native (Capacitor) relative URLs resolwuja sie do capacitor://localhost,
// gdzie nasze Vercel Edge Functions nie istnieja. Trzeba uzyc absolute URL.
// Na web "" oznacza same-origin (np. https://trasa.travel/api/... = relative).
export const API_BASE = isNative ? "https://trasa.travel" : "";

// Czy przegladarka wyrenderuje natywny Smart App Banner Apple (meta apple-itunes-app
// w index.html). Pokazuje go WYLACZNIE Safari na iOS/iPadOS - nie Chrome/Firefox na iOS,
// nie Android, nie desktop, nie apka dodana do ekranu glownego. Nie ma na to zadnego API,
// wiec jedyne w projekcie czytanie userAgenta trzymamy tutaj, razem z reszta detekcji
// platformy - komponenty importuja gotowa flage zamiast sniffowac u siebie.
function detectAppleSmartBanner(): boolean {
  if (isNative || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ podaje sie za Maca, rozpoznajemy go po dotyku.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  // Przegladarki z wlasnym silnikiem UI na iOS nie pokazuja banera Apple.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua)) return false;
  // W trybie standalone (PWA z ekranu glownego) baner tez sie nie pojawia.
  return !(window.navigator as Navigator & { standalone?: boolean }).standalone;
}

export const capabilities = {
  webShare: typeof navigator !== "undefined" && "share" in navigator,
  nativeShare: isNative,
  haptics: isNative,
  geolocation: isNative || (typeof navigator !== "undefined" && "geolocation" in navigator),
  pushNotifications: isNative,
  serviceWorker: isWeb && typeof navigator !== "undefined" && "serviceWorker" in navigator,
  installablePWA: isWeb,
  vercelAnalytics: isWeb,
  appleSmartBanner: detectAppleSmartBanner(),
};
