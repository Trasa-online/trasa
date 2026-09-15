import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";
import { useAdmin } from "../../RequireAdmin";
import { AppShell, PageHeader, useTheme, type Theme } from "../../ui";
import { cn } from "@/lib/utils";

const MODES: { id: Theme; label: string }[] = [
  { id: "light", label: "Jasny" },
  { id: "dark", label: "Ciemny" },
  { id: "system", label: "Jak system" },
];

export function SettingsPage() {
  const { email, tier, roles } = useAdmin();
  const { theme, setTheme } = useTheme();
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

  const input = "h-10 w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[var(--stone)] focus:border-[var(--accent)]";

  return (
    <AppShell>
      <PageHeader title="Ustawienia" subtitle="Konto operatorki, wygląd panelu i hasło." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Konto">
          <Row label="Email" value={email} />
          <Row label="Rola" value={tier === "super_admin" ? "super-admin" : "operator"} />
          <Row label="Wszystkie role" value={roles.join(", ") || "brak"} last />
        </Card>

        <Card title="Wygląd panelu">
          <div className="flex gap-2 pt-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setTheme(m.id)}
                className={cn(
                  "h-10 flex-1 rounded-[var(--r-control)] text-[13px] font-semibold transition-colors",
                  theme === m.id
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border border-[var(--line)] bg-[var(--surface)] text-[var(--graphite)] shadow-[var(--shadow-inset)]",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="pt-2 text-[12px] leading-[17px] text-[var(--stone)]">
            Siatka zdjęć w kwarantannie zostaje na neutralnym tle w obu trybach, żeby ocena
            ekspozycji nie zależała od pory dnia.
          </p>
        </Card>
      </div>

      <Card title="Hasło">
        <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--graphite)]">Nowe hasło</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)}
                required minLength={8} placeholder="Min. 8 znaków" className={input}
              />
              <button
                type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--stone)]"
                aria-label={show ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--graphite)]">Powtórz hasło</span>
            <input
              type={show ? "text" : "password"} value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required placeholder="Powtórz hasło" className={input}
            />
          </label>
          <button
            type="submit" disabled={loading}
            className="h-10 rounded-[var(--r-control)] bg-[var(--accent)] text-[13px] font-semibold text-[var(--on-accent)] disabled:opacity-60"
          >
            {loading ? "Zapisywanie…" : "Zapisz hasło"}
          </button>
        </form>
      </Card>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--stone)]">{title}</p>
      {children}
    </section>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", !last && "border-b border-[var(--line)]")}>
      <span className="text-[13px] text-[var(--graphite)]">{label}</span>
      <span className="data truncate text-[12px] text-[var(--ink)]">{value}</span>
    </div>
  );
}
