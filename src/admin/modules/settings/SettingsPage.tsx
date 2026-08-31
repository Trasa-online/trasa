import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { useAdmin } from "../../RequireAdmin";

export function SettingsPage() {
  const { email, tier, roles } = useAdmin();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Hasło min. 8 znaków"); return; }
    if (password !== confirm) { toast.error("Hasła nie są identyczne"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message || "Nie udało się ustawić hasła"); return; }
    setPassword(""); setConfirm("");
    toast.success("Hasło ustawione. Możesz się teraz logować hasłem.");
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Ustawienia</h1>
        <p className="text-sm text-slate-500 mt-1">Twoje konto w panelu operacyjnym.</p>
      </div>

      {/* Konto */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Konto</p>
        <Row label="Email" value={email} />
        <Row label="Rola" value={tier === "super_admin" ? "super-admin" : "operator"} />
        <Row label="Wszystkie role" value={roles.join(", ") || "—"} />
      </div>

      {/* Hasło */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4 text-slate-700" />
          <p className="text-sm font-bold text-slate-900">Ustaw hasło</p>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Po ustawieniu hasła będziesz mogła logować się nim zamiast magic-linkiem (na ekranie logowania: „Wolisz zalogować się hasłem?").
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nowe hasło</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 znaków"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Powtórz hasło</label>
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Powtórz hasło"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-[4px] bg-slate-900 hover:opacity-95 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60">
            {loading ? "Zapisuję…" : "Ustaw hasło"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
