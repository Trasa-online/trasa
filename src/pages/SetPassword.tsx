import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const SetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("Code exchange failed:", error);
          toast.error("Weryfikacja nie powiodła się. Spróbuj ponownie.");
          navigate("/auth");
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
          navigate("/auth");
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
      toast.success("Hasło ustawione!");
      navigate("/onboarding");
    } catch (error: any) {
      toast.error(error.message || "Nie udało się ustawić hasła.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Weryfikacja linku...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-5xl font-black tracking-tight mb-2">TRASA</h1>
        <p className="text-muted-foreground text-center text-sm max-w-[280px] mb-8">
          Ustaw hasło do swojego konta, aby móc się logować.
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Hasło</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min. 6 znaków"
              minLength={6}
              className="bg-card"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Potwierdź hasło</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Powtórz hasło"
              className="bg-card"
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Zapisuję..." : "Ustaw hasło"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SetPassword;
