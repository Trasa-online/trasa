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
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
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

  const submit = async (e: React.FormEvent) => {
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
          <span className="text-sm font-black text-slate-800">trasa<span className="text-blue-600"> ops</span></span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-900/[0.06] border border-slate-100 p-8 space-y-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-black text-slate-900">Panel operacyjny</h1>
            <p className="text-sm text-slate-500 mt-1">Zaloguj się kontem zespołu.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ty@trasa.travel" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Hasło</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all disabled:opacity-60">
            {loading ? "Logowanie…" : "Zaloguj się"}
          </button>
        </form>
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
      <button onClick={() => supabase.auth.signOut()} className="mt-6 text-sm text-blue-600 font-semibold underline">
        Wyloguj się
      </button>
    </div>
  );
}

const dotBg = {
  backgroundImage: "radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
} as const;
