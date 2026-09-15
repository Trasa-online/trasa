import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OpsLogo } from "@/admin/OpsLogo";
import { Spinner } from "@/admin/ui";

// Bramka MFA (TOTP) dla panelu ops. Wymuszona dla WSZYSTKICH adminow:
//  - brak zweryfikowanego czynnika  -> ekran "Wlacz 2FA" (skan QR + kod, jednorazowo),
//  - jest czynnik, ale sesja aal1    -> ekran "Kod z aplikacji" (wpisz kod),
//  - sesja aal2                      -> wpuszczamy do panelu (children).
// ZASADA: children renderujemy WYLACZNIE gdy state === "ok". Kazdy blad/niepewnosc
// trzyma uzytkownika przed bramka (nigdy nie przepuszcza po cichu).

const CARD = "w-full max-w-sm rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-8";
const CODE_INPUT = "data w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-center text-[18px] tracking-[0.4em] text-[var(--ink)] outline-none placeholder:tracking-normal placeholder:text-[var(--stone)] focus:border-[var(--accent)]";
const PRIMARY_BTN = "w-full rounded-[var(--r-control)] bg-[var(--accent)] py-3 text-[14px] font-semibold text-[var(--on-accent)] transition-all hover:opacity-90 disabled:opacity-60";
const LINK_BTN = "mt-4 w-full text-[12px] font-medium text-[var(--stone)] hover:text-[var(--ink)]";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4">
      <div className={CARD}>
        <OpsLogo tile={38} className="mb-6" />
        {children}
      </div>
    </div>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)]">
      <Spinner className="h-7 w-7 text-[var(--stone)]" />
    </div>
  );
}

// Wspolny krok weryfikacji kodu TOTP (challenge -> verify). Rzuca przy bledzie.
async function verifyCode(factorId: string, code: string) {
  const ch = await supabase.auth.mfa.challenge({ factorId });
  if (ch.error) throw ch.error;
  const v = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
  if (v.error) throw v.error;
}

// Usun NIEDOKONCZONE (unverified) czynniki TOTP - inaczej enroll rzuca
// "A factor ... already exists". Uzywane tylko przed pierwszym enrollem.
async function cleanupUnverifiedTotp() {
  try {
    const { data: list } = await supabase.auth.mfa.listFactors();
    const stale = (((list as any)?.all ?? list?.totp) ?? []).filter(
      (f: any) => f.factor_type === "totp" && f.status !== "verified",
    );
    for (const f of stale) { try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ } }
  } catch { /* best-effort */ }
}

async function enrollTotp() {
  await cleanupUnverifiedTotp();
  let res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "spontaway ops" });
  // Kolizja nazwy (zostal orphan, ktorego listFactors nie zwrocil) -> sprzataj i sprobuj raz jeszcze.
  if (res.error && /already exists/i.test(res.error.message)) {
    await cleanupUnverifiedTotp();
    res = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "spontaway ops" });
  }
  return res;
}

// Cache enrollu na poziomie MODULU - przezywa remonty MfaEnroll w tej samej sesji karty.
// KRYTYCZNE: RequireAdmin przelacza `checking` przy zmianach sesji i remontuje poddrzewo;
// bez cache kazdy remount robilby nowy enroll (kasujac poprzedni czynnik) -> "Factor not found"
// przy verify na starym id. Z cache czynnik + QR sa STABILNE do momentu weryfikacji.
let enrollCache: { factorId: string; qr: string; secret: string } | null = null;

function MfaEnroll({ onDone }: { onDone: () => void }) {
  // Init ze stabilnego cache (odporne na remont) - jesli enroll juz byl, ten sam QR/factor.
  const [qr, setQr] = useState<string | null>(enrollCache?.qr ?? null);
  const [secret, setSecret] = useState(enrollCache?.secret ?? "");
  const [factorId, setFactorId] = useState(enrollCache?.factorId ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (enrollCache) return; // enroll juz wykonany - reuse (remont NIE tworzy nowego czynnika)
    let cancelled = false;
    (async () => {
      const { data, error } = await enrollTotp();
      if (cancelled) return;
      if (error || !data) { setErr(error?.message || "Nie udało się przygotować 2FA."); return; }
      enrollCache = { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await verifyCode(factorId, code.trim());
      enrollCache = null; // sukces - czynnik zweryfikowany, cache juz niepotrzebny
      onDone();
    } catch (e2: any) { setErr(e2?.message || "Nieprawidłowy kod. Spróbuj ponownie."); }
    finally { setBusy(false); }
  };

  // qr_code bywa surowym <svg> albo data-URI - obsluz oba.
  const qrSrc = qr ? (qr.trim().startsWith("<svg") ? `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}` : qr) : null;

  return (
    <Shell>
      <h1 className="text-[20px] font-semibold text-[var(--ink)]">Włącz 2FA</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-[var(--stone)]">
        Zeskanuj kod w aplikacji uwierzytelniającej (Google Authenticator, Authy, 1Password), potem wpisz 6-cyfrowy kod, żeby dokończyć.
      </p>
      <div className="mt-5 flex justify-center">
        {qrSrc
          ? <img src={qrSrc} alt="Kod QR do 2FA" className="h-44 w-44 rounded-[var(--r-control)] border border-[var(--line)] bg-white" />
          : <div className="grid h-44 w-44 place-items-center"><Spinner className="h-6 w-6 text-[var(--stone)]" /></div>}
      </div>
      {secret && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--stone)]">
          Nie możesz zeskanować? Wpisz klucz ręcznie:<br />
          <span className="data select-all break-all text-[var(--graphite)]">{secret}</span>
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className={CODE_INPUT} />
        {err && <p className="text-[12px] text-[var(--bad)]">{err}</p>}
        <button type="submit" disabled={busy || code.length < 6 || !factorId} className={PRIMARY_BTN}>
          {busy ? "Sprawdzam…" : "Potwierdź i włącz"}
        </button>
      </form>
      <button onClick={() => supabase.auth.signOut()} className={LINK_BTN}>Wyloguj się</button>
    </Shell>
  );
}

function MfaChallenge({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await verifyCode(factorId, code.trim()); onDone(); }
    catch (e2: any) { setErr(e2?.message || "Nieprawidłowy kod. Spróbuj ponownie."); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="text-[20px] font-semibold text-[var(--ink)]">Kod z aplikacji</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-[var(--stone)]">
        Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej, żeby wejść do panelu.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className={CODE_INPUT} />
        {err && <p className="text-[12px] text-[var(--bad)]">{err}</p>}
        <button type="submit" disabled={busy || code.length < 6} className={PRIMARY_BTN}>
          {busy ? "Sprawdzam…" : "Zaloguj się"}
        </button>
      </form>
      <button onClick={() => supabase.auth.signOut()} className={LINK_BTN}>Wyloguj się</button>
    </Shell>
  );
}

function MfaError({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell>
      <h1 className="text-[20px] font-semibold text-[var(--ink)]">Nie udało się sprawdzić 2FA</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-[var(--stone)]">Spróbuj ponownie za chwilę.</p>
      <button onClick={onRetry} className={`${PRIMARY_BTN} mt-5`}>Spróbuj ponownie</button>
      <button onClick={() => supabase.auth.signOut()} className={LINK_BTN}>Wyloguj się</button>
    </Shell>
  );
}

type MfaState = "checking" | "enroll" | "challenge" | "ok" | "error";

export function AdminMfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MfaState>("checking");
  const [factorId, setFactorId] = useState("");

  const recheck = async () => {
    setState("checking");
    try {
      const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (aalErr || fErr) { setState("error"); return; }
      const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
      if (verified.length === 0) { setState("enroll"); return; }
      setFactorId(verified[0].id);
      setState(aal?.currentLevel === "aal2" ? "ok" : "challenge");
    } catch {
      setState("error"); // fail-closed: nigdy nie przepuszczamy przy bledzie
    }
  };

  useEffect(() => { recheck(); }, []);

  if (state === "checking") return <FullScreenSpinner />;
  if (state === "enroll") return <MfaEnroll onDone={() => setState("ok")} />;
  if (state === "challenge") return <MfaChallenge factorId={factorId} onDone={() => setState("ok")} />;
  if (state === "error") return <MfaError onRetry={recheck} />;
  return <>{children}</>;
}

export default AdminMfaGate;
