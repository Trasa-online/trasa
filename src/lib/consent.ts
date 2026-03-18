// ─── Cookie Consent (RODO / GDPR) ────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

const CONSENT_KEY = "trasa_cookie_consent";

export type ConsentStatus = "granted" | "denied" | null;

export function getConsent(): ConsentStatus {
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "granted" || val === "denied") return val;
  return null;
}

function applyGtagConsent(status: "granted" | "denied") {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("consent", "update", {
      analytics_storage: status,
    });
  }
}

function applyClarityConsent(status: "granted" | "denied") {
  if (status === "granted" && typeof window !== "undefined" && typeof window._clarityInit === "function") {
    window._clarityInit();
  }
}

export function grantConsent() {
  localStorage.setItem(CONSENT_KEY, "granted");
  applyGtagConsent("granted");
  applyClarityConsent("granted");
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
      applyClarityConsent("granted");
    }
    return false;
  }

  // No consent in DB — show banner
  return true;
}
