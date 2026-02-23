import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Mode = "login" | "register";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("tab") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();
      navigate(profile?.onboarding_completed ? "/" : "/onboarding");
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user!.id)
        .single();
      navigate(profile?.onboarding_completed ? "/" : "/onboarding");
    } catch (error: any) {
      toast.error(error.message || "Błąd logowania");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error("Musisz zaakceptować regulamin, żeby się zarejestrować.");
      return;
    }
    if (username.trim().length < 2) {
      toast.error("Nazwa użytkownika musi mieć co najmniej 2 znaki.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username: username.trim(),
        });
      }
      if (data.session) {
        // Email confirmation disabled — user is logged in immediately
        navigate("/onboarding");
      } else {
        // Email confirmation enabled — user must verify email first
        toast.success("Konto założone! Sprawdź email w celu weryfikacji, a następnie zaloguj się.");
        setMode("login");
      }
    } catch (error: any) {
      toast.error(error.message || "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <h1 className="text-5xl font-black tracking-tight mb-2">TRASA</h1>
        <p className="text-muted-foreground text-center text-sm max-w-[280px]">
          Planuj podróże z AI. Zapisuj wspomnienia. Wracaj do nich kiedy chcesz.
        </p>
        {/* Feature pills */}
        <div className="flex flex-wrap gap-1.5 justify-center mt-4 mb-8">
          {["Wersja beta", "Planer tras z AI", "Dziennik podróży", "Mapa miejsc"].map((f) => (
            <span key={f} className="text-xs bg-card border border-border rounded-full px-3 py-1 text-muted-foreground">
              {f}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="w-full max-w-sm">
          <div className="flex rounded-xl border border-border overflow-hidden mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Zaloguj się
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Zarejestruj się
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="twoj@email.com"
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-card"
                />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading ? "Logowanie..." : "Zaloguj się"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Nazwa użytkownika</Label>
                <Input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="twoja_nazwa"
                  minLength={2}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="twoj@email.com"
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Hasło</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 6 znaków"
                  minLength={6}
                  className="bg-card"
                />
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-foreground"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Akceptuję{" "}
                  <Link to="/terms" className="underline text-foreground" target="_blank">
                    Regulamin i Politykę Prywatności
                  </Link>{" "}
                  aplikacji TRASA.
                </span>
              </label>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading ? "Tworzę konto..." : "Zarejestruj się"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-6">
        <Link to="/terms" className="underline">Regulamin i Polityka Prywatności</Link>
      </p>
    </div>
  );
};

export default Auth;
