// ─── Google Analytics 4 ───────────────────────────────────────────────────────

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...args);
  }
}

/** Wyślij zdarzenie page_view (wywołuj przy zmianie trasy React Router) */
export function trackPageView(path: string) {
  gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
  });
}

/** Wyślij dowolne zdarzenie GA4 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  gtag("event", eventName, params);
}

// Predefiniowane zdarzenia aplikacji
export const analytics = {
  planStarted: (city: string) =>
    trackEvent("plan_started", { city }),

  planSaved: (city: string, numPins: number) =>
    trackEvent("plan_saved", { city, num_pins: numPins }),

  planChatMessage: (city: string) =>
    trackEvent("plan_chat_message", { city }),

  pinRemoved: () =>
    trackEvent("pin_removed"),

  pinAdded: () =>
    trackEvent("pin_added"),

  pinDetailOpened: (placeName: string) =>
    trackEvent("pin_detail_opened", { place_name: placeName }),
};
