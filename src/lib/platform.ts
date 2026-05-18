import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const isWeb = !isNative;
export const platform = Capacitor.getPlatform() as "ios" | "android" | "web";

export const capabilities = {
  webShare: typeof navigator !== "undefined" && "share" in navigator,
  nativeShare: isNative,
  haptics: isNative,
  pushNotifications: isNative,
  serviceWorker: isWeb && typeof navigator !== "undefined" && "serviceWorker" in navigator,
  installablePWA: isWeb,
  vercelAnalytics: isWeb,
};
