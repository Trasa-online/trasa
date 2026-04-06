import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Mode = "login" | "register";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("auth");
  const [mode, setMode] = useState<Mode>(searchParams.get("tab") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [formOpenedAt] = useState(() => Date.now());
  const [businessMode, setBusinessMode] = useState(false);
  const navigate = useNavigate();

  // Pick up referral code from URL (?ref=CODE) or landing page (localStorage)
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) localStorage.setItem("pending_referral_code", refFromUrl);
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();
      // If column doesn't exist yet (migration pending), go to home directly
      navigate("/");
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user!.id)
        .single();
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || t("errors.login"));
    } finally {
      setLoading(false);
    }
  };

  const [waitlistDone, setWaitlistDone] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Anti-bot: honeypot field must be empty
    if (honeypot) return;
    // Anti-bot: form must be open for at least 3 seconds
    if (Date.now() - formOpenedAt < 3000) return;
    if (!agreed) {
      toast.error(t("errors.terms_required"));
      return;
    }
    if (username.trim().length < 2) {
      toast.error(t("errors.username_short"));
      return;
    }
    if (firstName.trim().length < 1) {
      toast.error("Podaj swoje imię");
      return;
    }
    setLoading(true);
    try {
      const referralCode = localStorage.getItem("pending_referral_code") || null;
      const { error } = await (supabase as any).from("waitlist").insert({
        email: email.trim().toLowerCase(),
        source: referralCode ? "referral" : "website",
        referral_code: referralCode,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error(t("errors.email_duplicate"));
        } else {
          throw error;
        }
        return;
      }
      localStorage.removeItem("pending_referral_code");
      setWaitlistDone(true);
    } catch (error: any) {
      toast.error(error.message || t("errors.register"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        {/* Logo mark — orb without background */}
        <div
          className="w-14 h-14 rounded-full mb-4"
          style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
        />
        <h1 className="text-4xl font-black tracking-tight mb-1.5">TRASA</h1>
        {businessMode ? (
          <p className="text-muted-foreground text-center text-sm max-w-[280px] leading-relaxed mb-6">
            Panel biznesowy — zaloguj się kontem powiązanym z Twoim lokalem.
          </p>
        ) : (
          <p className="text-muted-foreground text-center text-sm max-w-[260px] leading-relaxed mb-6">
            {t("description")}
          </p>
        )}

        <div className="w-full max-w-sm">
          {businessMode ? (
            <>
              <button
                onClick={() => setBusinessMode(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground mb-6 active:opacity-60"
              >
                ← Wróć
              </button>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="biz-email">{t("fields.email")}</Label>
                  <Input
                    id="biz-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t("fields.email_placeholder")}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-password">{t("fields.password")}</Label>
                  <Input
                    id="biz-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t("fields.password_placeholder")}
                    className="bg-card"
                  />
                </div>
                <Button type="submit" className="w-full rounded-2xl py-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base" disabled={loading}>
                  {loading ? t("logging_in") : "Zaloguj się do panelu"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
                Nie masz jeszcze konta?{" "}
                <a href="mailto:kontakt@trasa.app" className="underline text-foreground">
                  Napisz do nas
                </a>
              </p>
            </>
          ) : (
          <>
          {/* Login / Register tabs */}
          <div className="flex rounded-2xl bg-muted p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("tabs.login")}
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("tabs.register")}
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("fields.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("fields.email_placeholder")}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("fields.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t("fields.password_placeholder")}
                  className="bg-card"
                />
              </div>
              <Button type="submit" className="w-full rounded-2xl py-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base" disabled={loading}>
                {loading ? t("logging_in") : t("login_btn")}
              </Button>
            </form>
          ) : waitlistDone ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-3xl">✉️</p>
              <p className="font-semibold">{t("waitlist_done_title")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("waitlist_done_desc")} <strong>{email}</strong>.
              </p>
              <button
                onClick={() => { setWaitlistDone(false); setMode("login"); }}
                className="text-sm text-muted-foreground underline pt-2"
              >
                {t("back_to_login")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Honeypot — hidden from humans, bots fill it */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
              />
              <div className="space-y-1.5">
                <Label htmlFor="reg-firstname">Imię</Label>
                <Input
                  id="reg-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="np. Marta"
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">{t("fields.username")}</Label>
                <Input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={t("fields.username_placeholder")}
                  minLength={2}
                  className="bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">{t("fields.email")}</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("fields.email_placeholder")}
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
                  {t("terms_accept")}{" "}
                  <Link to="/terms" className="underline text-foreground" target="_blank">
                    {t("terms_link")}
                  </Link>{" "}
                  {t("terms_app")}
                </span>
              </label>
              <Button type="submit" className="w-full rounded-2xl py-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base" disabled={loading}>
                {loading ? t("registering") : t("register_btn")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t("beta_notice")}
              </p>
            </form>
          )}

          {/* Business link — subtle, at the bottom */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            Jesteś właścicielem lokalu?{" "}
            <button
              onClick={() => setBusinessMode(true)}
              className="underline text-foreground font-medium"
            >
              Zaloguj się do panelu
            </button>
          </p>
          </>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-6">
        <Link to="/terms" className="underline">{t("terms")}</Link>
      </p>
    </div>
  );
};

export default Auth;
