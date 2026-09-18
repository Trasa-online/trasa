// Konta ZESPOLU wylaczone z analityki (prosba Nat 2026-09-18): PostHog nie zbiera po nich
// zadnych zdarzen, Clarity ich nie nagrywa. Ta sama lista siedzi po stronie raportu
// dziennego (supabase/functions/daily-analytics-digest, INTERNAL_EMAILS) - tam filtruje
// takze zdarzenia HISTORYCZNE, ktore juz w PostHogu sa. Dopisujesz konto - dopisz w obu.
//
// ⛔ To NIE jest lista adminow (src/lib/admins.ts) - Maciej jest adminem, ale jego uzycie
// apki ma sie liczyc jak kazdego usera.
export const INTERNAL_ANALYTICS_EMAILS = new Set<string>([
  "nat.maz98@gmail.com",
  "tomalab97@gmail.com",
]);

export function isInternalAnalyticsAccount(email: string | null | undefined): boolean {
  return !!email && INTERNAL_ANALYTICS_EMAILS.has(email.toLowerCase());
}

/** E-mail zalogowanego usera odczytany SYNCHRONICZNIE z sesji Supabase w localStorage.
 *  PostHog startuje przed odpowiedzia `auth.getSession()`, a pierwszy $pageview leci od
 *  razu - bez tego konto wewnetrzne zdazyloby wyslac zdarzenia startu, zanim useAuth je
 *  wylaczy. Klucz `sb-api-auth-token` = domena api.spontaway.com (custom domain Supabase). */
export function internalAccountFromStorage(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const email = JSON.parse(raw)?.user?.email;
      if (isInternalAnalyticsAccount(email)) return true;
    }
  } catch { /* brak localStorage albo obcy ksztalt sesji - traktuj jak zwyklego usera */ }
  return false;
}
