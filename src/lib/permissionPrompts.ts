import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/platform";
import { track } from "@/lib/analytics";
import { requestAndRegisterNativePush, registerNativePushIfGranted } from "@/hooks/useNativePush";

// Zgody systemowe W KONTEKSCIE (decyzja Nat 2026-09-14). Onboarding nie pyta juz o powiadomienia
// ani lokalizacje - pytamy tam, gdzie user bez zgody "jest jak bez reki":
//   push:     pierwsza kolekcja / wyjazd, publikacja wyjazdu, wyslane zaproszenia, dzwonek,
//             Ustawienia;
//   location: trzecia wizytowka w Miejscach (przegladasz - pewnie jestes w miescie), chip
//             "Pokaz dystans" na karcie i w wizytowce, "Biezace polozenie", "Moja lokalizacja".
//
// Dwa tryby wejscia:
//   explicit=true  - user SAM tapnal cos, co wymaga zgody -> systemowy prompt od razu (bez
//                    posrednich pytan, decyzja Nat 2026-08-28), a gdy zgoda byla juz odrzucona,
//                    arkusz z "Otworz Ustawienia" (iOS pokazuje systemowy alert tylko RAZ na
//                    instalacje; toast "wlacz w ustawieniach" nikogo tam nie zaprowadzil).
//   explicit=false - wyzwalacz kontekstowy -> najpierw NASZ arkusz z wyjasnieniem ("miekkie
//                    pytanie"), systemowy alert dopiero po "Wlacz". "Nie teraz" nic nie psuje:
//                    systemowy alert zostaje na kolejna okazje. Limity, zeby nie meczyc:
//                    raz na kontekst, nie czesciej niz co 3 dni, max 3 razy w ogole, nigdy
//                    w trakcie coach-markow i nigdy, gdy inny arkusz zgody juz stoi.
// Arkusz rysuje PermissionPrimerSheet (zamontowany raz w App.tsx), sterowany tym modulem.

export type PermKind = "push" | "location";
export type PushContext = "list_created" | "trip_created" | "trip_published" | "invite_sent" | "bell" | "settings";
export type LocationContext = "browse" | "distance" | "nearby" | "map_me" | "detail";
export type PermContext = PushContext | LocationContext;
export type PermResult = "granted" | "denied" | "dismissed" | "unsupported";
export type SystemStatus = "granted" | "denied" | "prompt" | "unsupported";

// Ta sama flaga co OnboardingFlow.COACH_PENDING_KEY (wpisana wprost, zeby lib nie ciagnal komponentu).
const COACH_PENDING_KEY = "spontaway_coach_pending";
const ASKS_KEY = "spontaway_perm_asks_v1";
const MIN_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_SOFT_ASKS = 3;

type AskLog = { ctxs: string[]; last: number; count: number };
type AskStore = Partial<Record<PermKind, AskLog>>;

function readAsks(): AskStore {
  try { return JSON.parse(localStorage.getItem(ASKS_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
function writeAsks(s: AskStore) {
  try { localStorage.setItem(ASKS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
const coachActive = () => { try { return localStorage.getItem(COACH_PENDING_KEY) === "1"; } catch { return false; } };

function shouldSoftAsk(kind: PermKind, ctx: string): boolean {
  if (coachActive()) return false;
  const log = readAsks()[kind];
  if (!log) return true;
  if (log.ctxs.includes(ctx)) return false;
  if (log.count >= MAX_SOFT_ASKS) return false;
  return Date.now() - log.last >= MIN_GAP_MS;
}
function recordSoftAsk(kind: PermKind, ctx: string) {
  const s = readAsks();
  const log = s[kind] ?? { ctxs: [], last: 0, count: 0 };
  s[kind] = { ctxs: [...log.ctxs, ctx], last: Date.now(), count: log.count + 1 };
  writeAsks(s);
}

// ─── Stan systemowy ─────────────────────────────────────────────────────────

export async function getSystemStatus(kind: PermKind): Promise<SystemStatus> {
  // Web: push ma osobny przelacznik (usePushNotifications), a o lokalizacje pyta sama
  // przegladarka przy getCurrentPosition - cala brama jest na webie przezroczysta.
  if (!isNative) return "unsupported";
  try {
    if (kind === "push") {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const st = await PushNotifications.checkPermissions();
      if (st.receive === "granted") return "granted";
      if (st.receive === "denied") return "denied";
      return "prompt";
    }
    const { Geolocation } = await import("@capacitor/geolocation");
    const st = await Geolocation.checkPermissions();
    if (st.location === "granted" || st.coarseLocation === "granted") return "granted";
    if (st.location === "denied" && (st.coarseLocation === "denied" || !st.coarseLocation)) return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

async function requestSystem(kind: PermKind): Promise<PermResult> {
  if (!isNative) return "unsupported";
  try {
    if (kind === "push") {
      const { data } = await supabase.auth.getSession();
      const res = await requestAndRegisterNativePush(data.session?.user?.id ?? null);
      return res;
    }
    const { Geolocation } = await import("@capacitor/geolocation");
    const st = await Geolocation.requestPermissions();
    return st.location === "granted" || st.coarseLocation === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

// iOS: nawigacja na `app-settings:` w glownej ramce trafia do Capacitora, ktory nie laduje jej
// w WebView, tylko oddaje systemowi (UIApplication.open) - otwiera sie strona apki w Ustawieniach.
export function openAppSettings() {
  if (!isNative) return;
  try { window.location.assign("app-settings:"); } catch { /* ignore */ }
}

// ─── Arkusz (store dla PermissionPrimerSheet) ───────────────────────────────

export type PrimerVariant = "ask" | "settings";
export type PrimerChoice = "accept" | "later";
export interface PrimerRequest { kind: PermKind; ctx: PermContext; variant: PrimerVariant }

type PrimerState = (PrimerRequest & { resolve: (c: PrimerChoice) => void }) | null;
let primer: PrimerState = null;
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((l) => l());

function showPrimer(req: PrimerRequest): Promise<PrimerChoice> {
  return new Promise((resolve) => {
    primer = { ...req, resolve };
    notifyAll();
  });
}
export function closePrimer(choice: PrimerChoice) {
  const cur = primer;
  primer = null;
  notifyAll();
  cur?.resolve(choice);
}
export function usePermissionPrimer(): PrimerRequest | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return primer;
}

// ─── Brama ──────────────────────────────────────────────────────────────────

export async function askPermission(kind: PermKind, ctx: PermContext, opts: { explicit?: boolean } = {}): Promise<PermResult> {
  const explicit = !!opts.explicit;
  if (!isNative) return "unsupported"; // web: callerzy ida dalej, przegladarka pyta sama
  const status = await getSystemStatus(kind);
  if (status === "unsupported") return "unsupported";
  if (status === "granted") {
    if (kind === "push") void registerNativePushIfGranted();
    return "granted";
  }
  if (primer) return "dismissed"; // inny arkusz zgody juz stoi - nie nakladamy drugiego

  if (status === "denied") {
    if (!explicit) return "denied";
    track("permission_settings_shown", { kind, ctx });
    const choice = await showPrimer({ kind, ctx, variant: "settings" });
    track("permission_settings_result", { kind, ctx, choice });
    if (choice === "accept") openAppSettings();
    return "denied";
  }

  // status === "prompt"
  if (explicit) {
    const res = await requestSystem(kind);
    track("permission_system_result", { kind, ctx, result: res });
    return res;
  }
  if (!shouldSoftAsk(kind, ctx)) return "dismissed";
  recordSoftAsk(kind, ctx);
  track("permission_prompt_shown", { kind, ctx });
  const choice = await showPrimer({ kind, ctx, variant: "ask" });
  track("permission_prompt_result", { kind, ctx, choice });
  if (choice !== "accept") return "dismissed";
  const res = await requestSystem(kind);
  track("permission_system_result", { kind, ctx, result: res });
  return res;
}

// Wyzwalacz kontekstowy "po chwili": widok pod spodem ma sie najpierw pokazac (nawigacja,
// toast), dopiero potem wjezdza arkusz. Nie czeka na wynik.
export function askPermissionSoon(kind: PermKind, ctx: PermContext, delayMs = 1200) {
  if (!isNative) return;
  window.setTimeout(() => { void askPermission(kind, ctx); }, delayMs);
}

// Tylko dev: reczne odpalenie bramy z konsoli / harnessu (window.__askPermission("push","bell")).
if (import.meta.env.DEV && typeof window !== "undefined") (window as any).__askPermission = askPermission;
