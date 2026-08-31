import posthog from "posthog-js";

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

// ─── PostHog: lejek produktowy (2026-08-31) ───────────────────────────────────
// Trzy sciezki, ktore realnie mierzymy: EKSPLORACJA, TWORZENIE WYJAZDU, TWORZENIE LISTY.
// Nazwy zdarzen sa stabilnym kontraktem dla panelu/edge - NIE zmieniaj ich bez aktualizacji lejka:
//   explore_opened -> place_viewed -> place_saved
//   trip_create_opened -> trip_place_added -> trip_published
//   list_create_opened -> list_place_added -> list_published
// Zgoda: posthog jest opt-out do czasu akceptacji cookies (patrz lib/consent.ts), wiec capture
// przed zgoda jest po prostu odrzucany po stronie SDK - nie trzeba tego sprawdzac tutaj.
export function track(event: string, props?: Record<string, unknown>) {
  try {
    posthog.capture(event, props);
  } catch (e) {
    console.warn("[analytics] capture failed:", e instanceof Error ? e.message : e);
  }
}
