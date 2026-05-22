import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { usePostHog } from "@posthog/react";
import { X } from "lucide-react";

type Mode = "login" | "register";

const AuthDrawer = () => {
  const { isOpen, mode: initialMode, hint, close } = useAuthDrawer();
  const { isAnonymous } = useAuth();
  const { t } = useTranslation("auth");
  const posthog = usePostHog();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // Sync mode when drawer reopens with a different intent
  useEffect(() => { if (isOpen) setMode(initialMode); }, [isOpen, initialMode]);

  // Reset transient state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSignupDone(false);
      setLoading(false);
    }
  }, [isOpen]);

  const handleOAuth = async (provider: "apple" | "google") => {
    setLoading(true);
    try {
      // Zawsze signInWithOAuth (jak Auth.tsx). Wczesniej dla anonimowych uzywalismy
      // linkIdentity zeby zachowac anon data (sesje grupowe, polubione miejsca),
      // ale to silently failuje gdy Google email juz ma konto w Trasie - user wraca
      // jako gosc bez widocznego bledu. Tradeoff: anon data nie przenosi sie przy
      // OAuth, ale flow dziala niezawodnie dla wszystkich przypadkow.
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err: any) {
      posthog.captureException(err);
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("provider is not enabled") || msg.includes("unsupported")) {
        toast.error(`Logowanie przez ${provider === "apple" ? "Apple" : "Google"} nie jest jeszcze skonfigurowane.`);
      } else {
        toast.error(err.message || "Błąd logowania");
      }
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      posthog.identify(data.user!.id, { email: data.user!.email });
      posthog.capture("user_signed_in", { source: "drawer" });
      close();
    } catch (err: any) {
      posthog.captureException(err);
      toast.error(err.message || t("errors.login"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error("Podaj najpierw swój adres email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/#/set-password`,
      });
      if (error) throw error;
      toast.success("Link do resetowania hasła wysłany na " + email);
    } catch (err: any) {
      toast.error(err.message || "Błąd wysyłania emaila");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error(t("errors.terms_required")); return; }
    if (username.trim().length < 2) { toast.error(t("errors.username_short")); return; }
    if (firstName.trim().length < 1) { toast.error("Podaj swoje imię"); return; }
    if (password.length < 6) { toast.error("Hasło musi mieć co najmniej 6 znaków"); return; }
    setLoading(true);
    try {
      const referralCode = localStorage.getItem("pending_referral_code") || null;
      const userData = {
        first_name: firstName.trim(),
        username: username.trim(),
        referral_code: referralCode,
      };

      if (isAnonymous) {
        // Upgrade anon -> real user. Zachowuje user_id, czyli wszystkie
        // sesje grupowe, polubione miejsca z anon zostaja przypisane do nowego konta.
        // updateUser ustawia email + password na istniejacym anon user; Supabase
        // wysyla email z linkiem potwierdzajacym, po klikniecie email staje sie
        // zweryfikowany i is_anonymous flipuje na false.
        const { error } = await supabase.auth.updateUser({
          email: email.trim().toLowerCase(),
          password,
          data: userData,
        });
        if (error) {
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("already") || msg.includes("registered")) {
            toast.error(t("errors.email_duplicate"));
          } else {
            throw error;
          }
          return;
        }
        // Profile row dla anon usera nie zostal utworzony przy anon signIn
        // (trigger handle_new_user pomija anon, patrz migracja 20260429_fix_anon_user_trigger).
        // Teraz gdy user dostal email/username - tworzymy profil recznie.
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await (supabase as any).from("profiles").upsert({
              id: currentUser.id,
              username: userData.username,
              first_name: userData.first_name,
            }, { onConflict: "id" });
          }
        } catch (e) {
          console.warn("[AuthDrawer] profile upsert after upgrade failed:", e);
        }
        localStorage.removeItem("pending_referral_code");
        posthog.capture("user_upgraded_from_anon", { source: referralCode ? "referral" : "drawer" });
      } else {
        // Standard signUp (no anon session to upgrade)
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: userData,
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) {
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("already registered") || msg.includes("user already")) {
            toast.error(t("errors.email_duplicate"));
          } else if (msg.includes("password")) {
            toast.error("Hasło jest za słabe. Użyj co najmniej 6 znaków.");
          } else {
            throw error;
          }
          return;
        }
        localStorage.removeItem("pending_referral_code");
        posthog.capture("user_signed_up", { source: referralCode ? "referral" : "drawer" });
      }
      setSignupDone(true);
    } catch (err: any) {
      posthog.captureException(err);
      toast.error(err.message || t("errors.register"));
    } finally {
      setLoading(false);
    }
  };

  const hintMessage = hint === "journal"
    ? "Załóż konto, żeby mieć dziennik podróży i zapisywać wspomnienia."
    : hint === "save_route"
      ? "Załóż konto, żeby zapisać swoją trasę."
      : hint === "join_session"
        ? "Załóż konto, żeby dołączyć do sesji grupowej."
        : hint === "settings"
          ? "Zaloguj się, żeby zmieniać ustawienia konta."
          : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl flex flex-col p-0 bg-background [&>button]:hidden"
        style={{ maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-full"
              style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
            />
            <div>
              <p className="text-base font-black tracking-tight leading-none">trasa</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">speed dating z miastem</p>
            </div>
          </div>
          <button
            onClick={close}
            className="h-9 w-9 -mr-1 flex items-center justify-center text-muted-foreground active:text-foreground"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-1 mb-5">
            <p className="text-xl font-black leading-tight">
              Aby skorzystać ze wszystkich funkcji,{" "}załóż konto
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Zapisuj trasy, prowadź dziennik, planuj grupowo. Albo&nbsp;przeglądaj jako gość.
            </p>
          </div>

          {hintMessage && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-200">
              <p className="text-sm text-foreground leading-snug">{hintMessage}</p>
            </div>
          )}

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-black text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Kontynuuj z Apple
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-white border border-slate-200 text-foreground font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Kontynuuj z Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">lub przez email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Tabs */}
          <div className="flex rounded-2xl bg-muted p-1 mb-4">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t("tabs.login")}
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
                mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t("tabs.register")}
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="ad-email">{t("fields.email")}</Label>
                <Input
                  id="ad-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("fields.email_placeholder")}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-password">{t("fields.password")}</Label>
                <Input
                  id="ad-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t("fields.password_placeholder")}
                  className="bg-card"
                />
              </div>
              <Button type="submit" className="w-full rounded-2xl py-5 bg-primary hover:bg-primary/90 text-white font-bold text-base" disabled={loading}>
                {loading ? t("logging_in") : t("login_btn")}
              </Button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Zapomniałeś/aś hasła?
              </button>
            </form>
          ) : signupDone ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-3xl">✉️</p>
              <p className="font-semibold">{t("signup_done_title")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("signup_done_desc")} <strong>{email}</strong>. {t("signup_done_action")}
              </p>
              <p className="text-xs text-muted-foreground pt-1">{t("signup_done_spam")}</p>
              <button
                onClick={() => { setSignupDone(false); setMode("login"); }}
                className="text-sm text-muted-foreground underline pt-1"
              >
                {t("back_to_login")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="ad-fn">Imię</Label>
                <Input
                  id="ad-fn"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="np. Marta"
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-username">{t("fields.username")}</Label>
                <Input
                  id="ad-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                  placeholder={t("fields.username_placeholder")}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-reg-email">{t("fields.email")}</Label>
                <Input
                  id="ad-reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("fields.email_placeholder")}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-reg-password">{t("fields.password")}</Label>
                <Input
                  id="ad-reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={t("fields.password_placeholder")}
                  className="bg-card"
                  autoComplete="new-password"
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
                  {t("terms_accept")}{" "}
                  <Link to="/terms" className="underline text-foreground" target="_blank" onClick={close}>
                    {t("terms_link")}
                  </Link>{" "}
                  {t("terms_app")}
                </span>
              </label>
              <Button type="submit" className="w-full rounded-2xl py-5 bg-primary hover:bg-primary/90 text-white font-bold text-base" disabled={loading}>
                {loading ? t("registering") : t("register_btn")}
              </Button>
            </form>
          )}

          {/* Continue as guest */}
          <button
            onClick={close}
            className="w-full mt-5 py-3 rounded-2xl border border-border/60 text-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            Kontynuuj jako gość
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">
            Gość przegląda miejsca bez zapisu. Trasy i dziennik wymagają konta.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AuthDrawer;
