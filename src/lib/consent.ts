// ─── Cookie Consent (RODO / GDPR) ────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

const CONSENT_KEY = "trasa_cookie_consent_v2";
// For unauthenticated visitors: reset on each browser session (tab close)
const SESSION_CONSENT_KEY = "trasa_cookie_consent_session";

// Internal accounts excluded from Clarity session recording
const CLARITY_EXCLUDED_EMAILS = new Set([
  "nat.maz98@gmail.com",
  "tomalab97@gmail.com",
]);

export type ConsentStatus = "granted" | "denied" | null;

export function getConsent(): ConsentStatus {
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "granted" || val === "denied") return val;
  return null;
}

/** For unauthenticated visitors — stored in sessionStorage (resets each session). */
export function getSessionConsent(): ConsentStatus {
  const val = sessionStorage.getItem(SESSION_CONSENT_KEY);
  if (val === "granted" || val === "denied") return val;
  return null;
}

export function grantSessionConsent() {
  sessionStorage.setItem(SESSION_CONSENT_KEY, "granted");
  applyGtagConsent("granted");
  applyClarityConsent("granted", null);
}

export function denySessionConsent() {
  sessionStorage.setItem(SESSION_CONSENT_KEY, "denied");
}

function applyGtagConsent(status: "granted" | "denied") {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: status,
    });
  }
}

function applyClarityConsent(status: "granted" | "denied", email?: string | null) {
  if (status !== "granted") return;
  if (email && CLARITY_EXCLUDED_EMAILS.has(email.toLowerCase())) return;
  if (typeof window !== "undefined" && typeof window._clarityInit === "function") {
    window._clarityInit();
  }
}

export async function grantConsent() {
  localStorage.setItem(CONSENT_KEY, "granted");
  applyGtagConsent("granted");
  const { data: { user } } = await supabase.auth.getUser();
  applyClarityConsent("granted", user?.email);
  // Save to DB in the background (fire & forget)
  void saveConsentToProfile("granted");
}

export function denyConsent() {
  localStorage.setItem(CONSENT_KEY, "denied");
  // analytics_storage remains 'denied' — no gtag update needed
  void saveConsentToProfile("denied");
}

async function saveConsentToProfile(status: "granted" | "denied") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ cookie_consent: status, cookie_consent_at: new Date().toISOString() })
    .eq("id", user.id);
}

/**
 * Call on auth state change (login). Syncs DB consent → localStorage.
 * Returns true if the banner should be shown.
 */
export async function syncConsentFromProfile(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getConsent() === null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("cookie_consent")
    .eq("id", user.id)
    .single();

  const dbConsent = profile?.cookie_consent as ConsentStatus;

  if (dbConsent === "granted" || dbConsent === "denied") {
    // Sync DB value to localStorage so banner stays hidden
    localStorage.setItem(CONSENT_KEY, dbConsent);
    if (dbConsent === "granted") {
      applyGtagConsent("granted");
      applyClarityConsent("granted", user.email);
    }
    return false;
  }

  // No consent in DB — show banner
  return true;
}
