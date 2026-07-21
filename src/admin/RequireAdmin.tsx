import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrasaLogo } from "@/components/TrasaLogo";
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

  return (
    <AdminContext.Provider value={{ email: user.email ?? "", roles: roles ?? [], tier, isSuperAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

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
    <div className="min-h-screen flex flex-col bg-[#F4F4F5]" style={dotBg}>
      <div className="flex items-center px-6 h-16">
        <div className="flex items-center gap-2">
          <TrasaLogo size={34} />
          <span className="text-sm font-black text-slate-800">trasa<span className="text-slate-700"> ops</span></span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-900/[0.06] border border-slate-100 p-8">
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
                  className="w-full py-3 rounded-full bg-slate-900 hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-slate-900/25 active:scale-[0.98] transition-all disabled:opacity-60">
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
    </div>
  );
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F4F5] px-6 text-center" style={dotBg}>
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

const dotBg = {
  backgroundImage: "radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
} as const;
