import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrasaLogo } from "@/components/TrasaLogo";
import { OpsLogo } from "@/admin/OpsLogo";
import { AdminMfaGate } from "@/admin/AdminMfaGate";
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
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
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);

  // Magic-link: zespol loguje sie linkiem z maila (bez hasel). shouldCreateUser=false
  // -> tylko istniejace konta. Redirect wraca na ten sam origin (admin.trasa.travel).
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // origin + "/" -> pewny match z allowlista Supabase w formacie ".../**".
      // Bez wpisu admina na allowliscie Supabase odbija na Site URL (glowna apka/waitlista).
      options: { emailRedirectTo: window.location.origin + "/", shouldCreateUser: false },
    });
    setLoading(false);
    if (error) toast.error(error.message || "Nie udało się wysłać linku");
    else setSent(true);
  };

  const loginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) toast.error(error.message || "Błąd logowania");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
      {/* Modal 50/50: lewa = logowanie, prawa = zdjecie. Radius 2px (ostre rogi). */}
      <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-[2px] overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200 min-h-[600px]">
        {/* LEWA: logowanie */}
        <div className="flex flex-col p-8 sm:p-12">
          <OpsLogo tile={44} />
          <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-10">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-4xl">📬</p>
              <h1 className="text-xl font-black text-slate-900">Sprawdź skrzynkę</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Wysłaliśmy link do logowania na <strong className="text-slate-700">{email}</strong>. Kliknij go, żeby wejść do panelu.
              </p>
              <button onClick={() => setSent(false)} className="text-sm text-slate-700 font-medium underline pt-2">
                Użyj innego adresu
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-black text-slate-900">Panel operacyjny</h1>
                <p className="text-sm text-slate-500 mt-1">Zaloguj się kontem zespołu.</p>
              </div>

              <form onSubmit={usePassword ? loginPassword : sendMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="ty@trasa.travel" />
                </div>

                {usePassword && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Hasło</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="••••••••" />
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-[4px] bg-slate-900 hover:opacity-95 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60">
                  {loading ? (usePassword ? "Logowanie…" : "Wysyłam…") : (usePassword ? "Zaloguj się" : "Wyślij link do logowania")}
                </button>
              </form>

              <button
                onClick={() => setUsePassword((v) => !v)}
                className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                {usePassword ? "← Wróć do logowania linkiem" : "Wolisz zalogować się hasłem?"}
              </button>
            </>
          )}
          </div>
        </div>
        {/* PRAWA: losowe zdjecie podrozy (Unsplash) - ukryte na malych ekranach. */}
        <div className="relative hidden lg:block bg-slate-100">
          <img src={LOGIN_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/25 via-transparent to-transparent" />
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <TrasaLogo size={48} className="mb-5" />
      <h1 className="text-xl font-black text-slate-900 mb-1">Brak dostępu</h1>
      <p className="text-sm text-slate-500 max-w-[36ch]">
        Konto <strong className="text-slate-700">{email}</strong> nie ma uprawnień do panelu operacyjnego.
      </p>
      <button onClick={() => supabase.auth.signOut()} className="mt-6 text-sm text-slate-700 font-semibold underline">
        Wyloguj się
      </button>
    </div>
  );
}
