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
import { TESTFLIGHT_URL } from "@/lib/testflight";

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

/**
 * Link z zaproszenia prowadzi PROSTO DO TESTFLIGHT (zgloszenie Nat 2026-09-24: „piecioro
 * testerow chce sie dostac do aplikacji i nie moze").
 *
 * Do tej pory szedl na landing (`spontaway.com/?ref=<kod>`) - a landing przed premiera
 * (`APP_LIVE = false` w [SpontawayLanding.tsx](../pages/SpontawayLanding.tsx)) NIE MA zadnej
 * drogi do apki: plakietki sklepowe sa wygaszone, a jedyne dzialajace pole to zapis na
 * powiadomienie o premierze. Zapraszany ladowal wiec w slepym zaulku, mimo ze apka dziala
 * i czeka na niego w testach. Tego samego adresu uzywa kod QR z tej samej karty - i to on
 * jako jedyny dzialal.
 *
 * ⚠️ KOSZT, swiadomy: adres TestFlight nie przyjmuje parametrow, wiec rejestracja z takiego
 * zaproszenia NIE DOLICZY SIE do licznika (`profiles.referred_by` ustawia sie z kodu w URL
 * albo z e-maila zapisanego na waitliscie). Dopoki apka nie jest w App Store, wejscie
 * testera jest warte wiecej niz slupek postepu. Cala maszyneria kodow zostaje nietknieta:
 * `captureReferralFromUrl` dalej lapie `?ref=` u kazdego, kto wejdzie na landing.
 *
 * ⛔ PO PREMIERZE wroc na `referralLandingLink` - wtedy landing prowadzi do App Store,
 * a atrybucja zaproszen znowu dziala.
 */
export const inviteLink = () => TESTFLIGHT_URL;

/** Link na landing z kodem - do wykorzystania po premierze (patrz `inviteLink`). */
export const referralLandingLink = (code: string) => `${SHARE_BASE_URL}/?ref=${encodeURIComponent(code)}`;
