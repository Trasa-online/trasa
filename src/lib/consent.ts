// ─── Cookie Consent (RODO / GDPR) ────────────────────────────────────────────

const CONSENT_KEY = "trasa_cookie_consent";

export type ConsentStatus = "granted" | "denied" | null;

export function getConsent(): ConsentStatus {
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "granted" || val === "denied") return val;
  return null;
}

export function grantConsent() {
  localStorage.setItem(CONSENT_KEY, "granted");
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: "granted",
    });
  }
}

export function denyConsent() {
  localStorage.setItem(CONSENT_KEY, "denied");
  // analytics_storage pozostaje 'denied' — brak zmian potrzebny
}
