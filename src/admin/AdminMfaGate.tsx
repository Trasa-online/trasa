import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OpsLogo } from "@/admin/OpsLogo";

// Bramka MFA (TOTP) dla panelu ops. Wymuszona dla WSZYSTKICH adminow:
//  - brak zweryfikowanego czynnika  -> ekran "Wlacz 2FA" (skan QR + kod, jednorazowo),
//  - jest czynnik, ale sesja aal1    -> ekran "Kod z aplikacji" (wpisz kod),
//  - sesja aal2                      -> wpuszczamy do panelu (children).
// ZASADA: children renderujemy WYLACZNIE gdy state === "ok". Kazdy blad/niepewnosc
// trzyma uzytkownika przed bramka (nigdy nie przepuszcza po cichu).

const CARD = "w-full max-w-sm bg-white rounded-[2px] border border-slate-200 p-8";
const CODE_INPUT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-lg tracking-[0.4em] font-semibold text-slate-900 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400";
const PRIMARY_BTN = "w-full py-3 rounded-[4px] bg-slate-900 hover:opacity-95 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60";
const LINK_BTN = "w-full mt-4 text-xs text-slate-400 hover:text-slate-600 font-medium";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className={CARD}>
        <OpsLogo tile={38} className="mb-6" />
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-8 w-8 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
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
      <h1 className="text-xl font-black text-slate-900">Włącz 2FA</h1>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">
        Zeskanuj kod w aplikacji uwierzytelniającej (Google Authenticator, Authy, 1Password), potem wpisz 6-cyfrowy kod, żeby dokończyć.
      </p>
      <div className="mt-5 flex justify-center">
        {qrSrc
          ? <img src={qrSrc} alt="Kod QR do 2FA" className="h-44 w-44 rounded-[2px] border border-slate-200 bg-white" />
          : <div className="h-44 w-44 grid place-items-center"><div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" /></div>}
      </div>
      {secret && (
        <p className="mt-3 text-center text-[11px] text-slate-400 leading-relaxed">
          Nie możesz zeskanować? Wpisz klucz ręcznie:<br />
          <span className="font-mono text-slate-600 break-all select-all">{secret}</span>
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className={CODE_INPUT} />
        {err && <p className="text-xs text-red-500">{err}</p>}
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
      <h1 className="text-xl font-black text-slate-900">Kod z aplikacji</h1>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">
        Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej, żeby wejść do panelu.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className={CODE_INPUT} />
        {err && <p className="text-xs text-red-500">{err}</p>}
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
      <h1 className="text-xl font-black text-slate-900">Nie udało się sprawdzić 2FA</h1>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">Spróbuj ponownie za chwilę.</p>
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

  if (state === "checking") return <Spinner />;
  if (state === "enroll") return <MfaEnroll onDone={() => setState("ok")} />;
  if (state === "challenge") return <MfaChallenge factorId={factorId} onDone={() => setState("ok")} />;
  if (state === "error") return <MfaError onRetry={recheck} />;
  return <>{children}</>;
}

export default AdminMfaGate;
