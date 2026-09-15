import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrasaLogo } from "@/components/TrasaLogo";
import { OpsLogo } from "@/admin/OpsLogo";
import { AdminMfaGate } from "@/admin/AdminMfaGate";
import { Spinner } from "@/admin/ui";
import { toast } from "sonner";

export type AdminTier = "super_admin" | "operator";

interface AdminCtx {
  email: string;
  roles: string[];
  tier: AdminTier;
  isSuperAdmin: boolean;
}
const AdminContext = createContext<AdminCtx | null>(null);
export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin poza RequireAdmin");
  return ctx;
};

// Bramka panelu operacyjnego: logowanie (email+haslo) + gate na role 'admin'
// (has_role z user_roles). Wyliczany tier: super_admin > operator. Osobny
// origin => sesja niewspoldzielona z apka, admin loguje sie tutaj osobno.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [roles, setRoles] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user || (user as any).is_anonymous) { setChecking(false); setRoles(null); return; }
    setChecking(true);
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (cancelled) return;
      setRoles((data ?? []).map((r: any) => r.role));
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)]">
        <Spinner className="h-7 w-7 text-[var(--stone)]" />
      </div>
    );
  }

  if (!user || (user as any).is_anonymous) return <AdminLogin />;

  const isAdmin = (roles ?? []).includes("admin");
  if (!isAdmin) return <AccessDenied email={user.email ?? ""} />;

  const isSuperAdmin = (roles ?? []).includes("super_admin");
  const tier: AdminTier = isSuperAdmin ? "super_admin" : "operator";

  // Po przejsciu bramki roli - wymuszamy 2FA (TOTP). Panel (children) renderuje sie
  // dopiero gdy sesja osiagnie aal2 (kod z aplikacji potwierdzony).
  return (
    <AdminContext.Provider value={{ email: user.email ?? "", roles: roles ?? [], tier, isSuperAdmin }}>
      <AdminMfaGate>{children}</AdminMfaGate>
    </AdminContext.Provider>
  );
}

// Losowe zdjecie podrozy (ludzie) - Unsplash, wolna licencja, hotlink OK.
// Prawa polowa ekranu logowania. Zmien URL, zeby podmienic zdjecie.
const LOGIN_IMAGE = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);

  // Logowanie KODEM (6-cyfrowy OTP z maila), NIE linkiem. Powod: magic-linki + PKCE
  // psuly sie przez prefetch skanera Gmaila (jednorazowy token konsumowany przed klikiem)
  // -> petla powrotu na login. Kod wpisywany recznie omija prefetch, redirect i PKCE.
  // shouldCreateUser=false -> tylko istniejace konta.
  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) toast.error(error.message || "Nie udało się wysłać kodu");
    else { setCode(""); setSent(true); }
  };

  // Weryfikacja 6-cyfrowego kodu -> sesja (bez PKCE/redirectu). onAuthStateChange
  // (useAuth) wychwyci SIGNED_IN i RequireAdmin przepusci dalej (na krok 2FA).
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 8) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) toast.error(error.message || "Nieprawidłowy lub wygasły kod");
  };

  const loginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) toast.error(error.message || "Błąd logowania");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 sm:p-6">
      {/* Modal 50/50: lewa = logowanie, prawa = zdjecie. Radius 2px (ostre rogi). */}
      <div className="grid min-h-[600px] w-full max-w-5xl overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-2">
        {/* LEWA: logowanie */}
        <div className="flex flex-col p-8 sm:p-12">
          <OpsLogo tile={44} />
          <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-10">
          {sent ? (
            <>
              <div className="text-center mb-6">
                <h1 className="text-[26px] font-semibold text-[var(--ink)]">Wpisz kod z maila</h1>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--stone)]">
                  Wysłaliśmy 8-cyfrowy kod na <strong className="text-[var(--ink)]">{email}</strong>.
                </p>
              </div>
              <form onSubmit={verifyCode} className="space-y-4">
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="00000000"
                  className="data w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-center text-[18px] tracking-[0.3em] text-[var(--ink)] outline-none placeholder:tracking-normal placeholder:text-[var(--stone)] focus:border-[var(--accent)]" />
                <button type="submit" disabled={loading || code.length < 8}
                  className="w-full rounded-[var(--r-control)] bg-[var(--accent)] py-3 text-[14px] font-semibold text-[var(--on-accent)] transition-all hover:opacity-90 disabled:opacity-60">
                  {loading ? "Sprawdzam…" : "Zaloguj się"}
                </button>
              </form>
              <button onClick={() => { setSent(false); setCode(""); }} className="mt-4 w-full text-[12px] font-medium text-[var(--stone)] hover:text-[var(--ink)]">
                ← Użyj innego adresu
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-[26px] font-semibold text-[var(--ink)]">Panel operacyjny</h1>
                <p className="mt-1 text-[14px] text-[var(--stone)]">Zaloguj się kontem zespołu.</p>
              </div>

              <form onSubmit={usePassword ? loginPassword : sendCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[var(--graphite)]">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)] focus:border-[var(--accent)]"
                    placeholder="ty@spontaway.com" />
                </div>

                {usePassword && (
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--graphite)]">Hasło</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)] focus:border-[var(--accent)]"
                      placeholder="••••••••" />
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full rounded-[var(--r-control)] bg-[var(--accent)] py-3 text-[14px] font-semibold text-[var(--on-accent)] transition-all hover:opacity-90 disabled:opacity-60">
                  {loading ? (usePassword ? "Logowanie…" : "Wysyłam…") : (usePassword ? "Zaloguj się" : "Wyślij kod logowania")}
                </button>
              </form>

              <button
                onClick={() => setUsePassword((v) => !v)}
                className="mt-4 w-full text-[12px] font-medium text-[var(--stone)] hover:text-[var(--ink)]"
              >
                {usePassword ? "← Wróć do logowania kodem" : "Wolisz zalogować się hasłem?"}
              </button>
            </>
          )}
          </div>
        </div>
        {/* PRAWA: losowe zdjecie podrozy (Unsplash) - ukryte na malych ekranach. */}
        <div className="relative hidden bg-[var(--photo)] lg:block">
          <img src={LOGIN_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center">
      <TrasaLogo size={48} className="mb-5" />
      <h1 className="mb-1 text-[20px] font-semibold text-[var(--ink)]">Nie masz dostępu</h1>
      <p className="max-w-[36ch] text-[14px] text-[var(--stone)]">
        Konto <strong className="text-[var(--ink)]">{email}</strong> nie ma uprawnień do panelu operacyjnego.
      </p>
      <button onClick={() => supabase.auth.signOut()} className="mt-6 text-[14px] font-semibold text-[var(--graphite)] underline">
        Wyloguj się
      </button>
    </div>
  );
}
