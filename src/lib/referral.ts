// Zapraszanie znajomych (2026-09-10). Zamiast paywalla - ekran zachety.
//
// Liczy sie REJESTRACJA z linku, a nie samo wyslanie linku: licznik, ktory kazdy nabija
// w dziesiec sekund, nie mowi nic ani userowi, ani nam. Stad `profiles.referred_by`
// ustawiane RPC `attach_referral` (SECURITY DEFINER - user nie ma zapisu do cudzego profilu).
//
// Dwie drogi, ktorymi kod dociera do rejestracji, bo link laduje w PRZEGLADARCE, a konto
// zaklada sie w natywce i localStorage tego nie przenosi:
//   1. ten sam kontekst (link otwarty juz w apce) -> localStorage,
//   2. inny kontekst -> kod jedzie z zapisem na waitliste (waitlist.referral_code), a most
//      miedzy swiatami stanowi adres e-mail.

import { supabase } from "@/integrations/supabase/client";
import { SHARE_BASE_URL } from "@/lib/shareUrl";

/** Ile zaproszen "domyka" pasek postepu. Prog, nie brama - nic nie jest odciete. */
export const REFERRAL_GOAL = 3;

const STORAGE_KEY = "spontaway_ref";

/** Kod z adresu: obsluguje i ?ref=, i /#/cos?ref= (HashRouter). */
function codeFromUrl(): string | null {
  try {
    const direct = new URLSearchParams(window.location.search).get("ref");
    if (direct) return direct;
    const hashQuery = window.location.hash.split("?")[1];
    return hashQuery ? new URLSearchParams(hashQuery).get("ref") : null;
  } catch {
    return null;
  }
}

/** Wolane raz przy starcie aplikacji - kod moze przyjsc na dowolnym ekranie. */
export function captureReferralFromUrl(): void {
  const code = codeFromUrl();
  if (!code) return;
  try { localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase()); } catch { /* prywatne okno */ }
}

export function pendingReferralCode(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/**
 * Przypisuje czekajacy kod do zalogowanego usera. Bezpieczne do wolania wielokrotnie:
 * RPC ustawia `referred_by` tylko wtedy, gdy jest jeszcze puste, i odrzuca wskazanie
 * samego siebie.
 */
export async function applyPendingReferral(): Promise<void> {
  const code = pendingReferralCode();
  if (!code) {
    // Brak kodu w tym urzadzeniu nie znaczy, ze zaproszenia nie bylo: link mogl zostac
    // otwarty w przegladarce, a konto powstaje dopiero teraz w natywce. Serwer sprawdza
    // wtedy waitliste po adresie e-mail z tokenu.
    try { await (supabase as any).rpc("attach_referral_from_waitlist"); }
    catch (e) { console.warn("[referral] waitlist bridge failed:", (e as Error)?.message ?? e); }
    return;
  }
  try {
    await (supabase as any).rpc("attach_referral", { p_code: code });
  } catch (e) {
    console.warn("[referral] attach failed:", (e as Error)?.message ?? e);
    return;   // sprobujemy przy nastepnym starcie
  }
  // Czyscimy TAKZE gdy RPC zwrocilo false (kod nieznany / juz przypisany / wlasny) -
  // ponawianie w nieskonczonosc niczego nie naprawi, a kosztuje zapytanie przy kazdym starcie.
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* prywatne okno */ }
}

export type ReferralStats = { code: string | null; invited: number };

/**
 * Statystyki przez RPC, a NIE przez odczyt kolumn `profiles`.
 *
 * `profiles` ma kolumnowe grantry SELECT (whitelista) - bezposredni odczyt `referral_code`
 * konczy sie "permission denied for table profiles". I dobrze: dopisanie `referred_by` do
 * whitelisty zrobiloby z niej publiczna krawedz grafu spolecznego (kto kogo zaprosil).
 * RPC oddaje wylacznie dane wolajacego.
 */
export async function fetchReferralStats(_userId: string): Promise<ReferralStats> {
  const { data, error } = await (supabase as any).rpc("referral_stats");
  if (error) {
    console.warn("[referral] stats failed:", error.message);
    return { code: null, invited: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { code: row?.code ?? null, invited: Number(row?.invited ?? 0) };
}

/** Link prowadzi na LANDING, nie w glab apki: zapraszany jeszcze jej nie ma. */
export const referralLink = (code: string) => `${SHARE_BASE_URL}/?ref=${encodeURIComponent(code)}`;
