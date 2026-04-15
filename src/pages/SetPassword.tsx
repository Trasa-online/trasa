import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const SetPassword = ({ forceBusiness }: { forceBusiness?: boolean } = {}) => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Business flow: either via dedicated /set-password-biznes route or legacy ?type=business param
  const params = new URLSearchParams(window.location.search);
  const isBusiness = forceBusiness || params.get("type") === "business";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Code exchange failed:", error);
          toast.error("Weryfikacja nie powiodła się. Spróbuj ponownie.");
          navigate(isBusiness ? "/auth?business=true" : "/auth");
        } else {
          setReady(true);
        }
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
      });
    }

    const timeout = setTimeout(() => {
      setReady((prev) => {
        if (!prev) {
          toast.error("Weryfikacja linku przekroczyła czas. Spróbuj ponownie.");
          navigate(isBusiness ? "/auth?business=true" : "/auth");
        }
        return prev;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== confirm) {
      toast.error("Hasła nie są identyczne.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      if (isBusiness && user) {
        // Business flow — find their profile and go to dashboard
        const { data: bp } = await (supabase as any)
          .from("business_profiles")
          .select("place_id, id")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (bp?.id) {
          toast.success("Hasło ustawione! Witaj w panelu biznesowym Trasy.");
          navigate(`/biznes/${bp.place_id ?? bp.id}`);
        } else {
          toast.success("Hasło ustawione! Zaloguj się do panelu biznesowego.");
          navigate("/auth?business=true");
        }
        return;
      }

      // Regular user flow
      toast.success("Hasło ustawione! Możesz się teraz zalogować.");
      navigate("/home");
    } catch (error: any) {
      toast.error(error.message || "Nie udało się ustawić hasła.");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center",
        isBusiness ? "bg-blue-50" : "bg-background"
      )}>
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-full animate-pulse",
            isBusiness ? "bg-blue-200" : "bg-orange-200"
          )} />
          <p className="text-sm text-muted-foreground">Weryfikacja linku…</p>
        </div>
      </div>
    );
  }

  // ── Business flow ──────────────────────────────────────────────────────────
  if (isBusiness) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Top bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700 w-full" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">trasa</p>
                <p className="text-lg font-black text-slate-800 leading-tight">Panel Biznesowy</p>
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-2xl font-black text-slate-800 mb-1">Ustaw hasło</h1>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              To ostatni krok. Po ustawieniu hasła uzyskasz dostęp do panelu biznesowego.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-slate-700 font-semibold text-sm">Hasło</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Min. 6 znaków"
                    minLength={6}
                    className="bg-white border-slate-200 pr-10 focus-visible:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-slate-700 font-semibold text-sm">Potwierdź hasło</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Powtórz hasło"
                    className="bg-white border-slate-200 pr-10 focus-visible:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      password.length >= i * 3
                        ? i <= 2 ? "bg-blue-400" : "bg-blue-600"
                        : "bg-slate-200"
                    )} />
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100 mt-2"
              >
                {loading ? "Zapisuję…" : "Aktywuj konto biznesowe"}
              </button>
            </form>

            <p className="text-xs text-center text-slate-400 mt-6">
              Problem z linkiem?{" "}
              <a href="mailto:kontakt@trasa.travel" className="text-blue-600 font-medium underline">
                Napisz do nas
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular user flow ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-600 w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-full mb-3 shadow-lg shadow-orange-600/25"
              style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
            />
            <h1 className="text-3xl font-black tracking-tight">TRASA</h1>
            <p className="text-muted-foreground text-center text-sm mt-1 leading-relaxed">
              Ustaw hasło i zacznij odkrywać miasta.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Hasło</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 6 znaków"
                  minLength={6}
                  className="bg-card pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Potwierdź hasło</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Powtórz hasło"
                  className="bg-card pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password strength */}
            {password.length > 0 && (
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    password.length >= i * 3
                      ? i <= 2 ? "bg-orange-300" : "bg-orange-600"
                      : "bg-muted"
                  )} />
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base shadow-lg shadow-orange-600/20 active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100 mt-2"
            >
              {loading ? "Zapisuję…" : "Ustaw hasło i wejdź"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
