import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Mode = "login" | "register";
type BizMode = "login" | "register";

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
  const [businessMode, setBusinessMode] = useState(searchParams.get("business") === "true");
  const [bizMode, setBizMode] = useState<BizMode>("login");
  // Business registration fields
  const [bizPlace, setBizPlace] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizMessage, setBizMessage] = useState("");
  const [bizDone, setBizDone] = useState(false);
  const navigate = useNavigate();

  // Pick up referral code from URL (?ref=CODE) or landing page (localStorage)
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) localStorage.setItem("pending_referral_code", refFromUrl);
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      // Always check for business profile first — business users must not land on /home
      const { data: bp } = await (supabase as any)
        .from("business_profiles")
        .select("place_id, id")
        .eq("owner_user_id", session.user.id)
        .maybeSingle();
      if (bp?.id) {
        navigate(`/biznes/${bp.place_id ?? bp.id}`);
        return;
      }
      const demoRaw = localStorage.getItem("trasa_demo_liked");
      if (demoRaw) {
        try {
          const demo = JSON.parse(demoRaw);
          localStorage.removeItem("trasa_demo_liked");
          navigate("/create", { state: { city: demo.city, likedPlacesData: demo.places } });
          return;
        } catch {}
      }
      const guestRaw = localStorage.getItem("trasa_guest_plan");
      if (guestRaw) {
        try {
          const guest = JSON.parse(guestRaw);
          localStorage.removeItem("trasa_guest_plan");
          navigate("/plan", { state: { step: 3, city: guest.city, date: guest.date, likedPlaceNames: guest.likedPlaceNames } });
          return;
        } catch {}
      }
      const returnTo = searchParams.get("return");
      navigate(returnTo || "/home");
    });
  }, [navigate]);

  const handleBizRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizPlace.trim()) { toast.error("Podaj nazwę lokalu"); return; }
    setLoading(true);
    try {
      // Just submit the inquiry — no auth account yet.
      // Admin will invite the owner via Supabase after reviewing the claim.
      const { error: claimError } = await (supabase as any).from("business_claims").insert({
        contact_email: email,
        contact_phone: bizPhone.trim() || null,
        place_name_text: bizPlace.trim(),
        message: bizMessage.trim() || null,
        status: "pending",
      });
      if (claimError) throw claimError;

      setBizDone(true);
    } catch (err: any) {
      toast.error(err.message || "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error("Podaj najpierw swój adres email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://trasa.travel/set-password",
      });
      if (error) throw error;
      toast.success("Link do resetowania hasła wysłany na " + email);
    } catch (err: any) {
      toast.error(err.message || "Błąd wysyłania emaila");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check for business profile (covers both businessMode and regular login for biz accounts)
      const { data: bp } = await (supabase as any)
        .from("business_profiles")
        .select("place_id, id")
        .eq("owner_user_id", data.user!.id)
        .maybeSingle();
      if (bp?.id) {
        navigate(`/biznes/${bp.place_id ?? bp.id}`);
        return;
      }
      if (businessMode) {
        toast.error("Nie znaleziono panelu biznesowego dla tego konta.");
        return;
      }

      // Restore demo liked places if user came from demo upsell
      const demoRaw = localStorage.getItem("trasa_demo_liked");
      if (demoRaw) {
        try {
          const demo = JSON.parse(demoRaw);
          localStorage.removeItem("trasa_demo_liked");
          navigate("/create", { state: { city: demo.city, likedPlacesData: demo.places } });
          return;
        } catch {}
      }
      const guestRaw = localStorage.getItem("trasa_guest_plan");
      if (guestRaw) {
        try {
          const guest = JSON.parse(guestRaw);
          localStorage.removeItem("trasa_guest_plan");
          navigate("/plan", { state: { step: 3, city: guest.city, date: guest.date, likedPlaceNames: guest.likedPlaceNames } });
          return;
        } catch {}
      }

      const returnTo = searchParams.get("return");
      navigate(returnTo || "/home");
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
    <div className={`min-h-screen flex flex-col ${businessMode ? "bg-blue-950" : "bg-background"}`}>
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        {/* Logo mark */}
        <div
          className="w-14 h-14 rounded-full mb-4"
          style={{
            background: businessMode
              ? "radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 60%, #1d4ed8)"
              : "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
          }}
        />
        <h1 className={`text-4xl font-black tracking-tight mb-1.5 ${businessMode ? "text-white" : ""}`}>TRASA</h1>
        {businessMode ? (
          <>
            <span className="mb-3 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
              Panel Biznesowy
            </span>
            <p className="text-blue-300/70 text-center text-sm max-w-[280px] leading-relaxed mb-6">
              Zaloguj się kontem powiązanym z Twoim lokalem.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-center text-sm max-w-[260px] leading-relaxed mb-6">
            {t("description")}
          </p>
        )}

        <div className="w-full max-w-sm">
          {businessMode ? (
            <>
              <button
                onClick={() => { setBusinessMode(false); setBizMode("login"); setBizDone(false); }}
                className="flex items-center gap-1 text-sm text-blue-400 mb-6 active:opacity-60"
              >
                ← Wróć
              </button>

              {/* Biz tabs */}
              <div className="flex rounded-2xl bg-blue-900/60 p-1 mb-6">
                <button
                  onClick={() => setBizMode("login")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
                    bizMode === "login" ? "bg-blue-600 text-white shadow-sm" : "text-blue-300 hover:text-white"
                  }`}
                >
                  Zaloguj się
                </button>
                <button
                  onClick={() => setBizMode("register")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
                    bizMode === "register" ? "bg-blue-600 text-white shadow-sm" : "text-blue-300 hover:text-white"
                  }`}
                >
                  Zarejestruj lokal
                </button>
              </div>

              {bizMode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-email" className="text-blue-200">{t("fields.email")}</Label>
                    <Input
                      id="biz-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder={t("fields.email_placeholder")}
                      className="bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-password" className="text-blue-200">{t("fields.password")}</Label>
                    <Input
                      id="biz-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder={t("fields.password_placeholder")}
                      className="bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus-visible:ring-blue-500"
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-2xl py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base border-0" disabled={loading}>
                    {loading ? t("logging_in") : "Zaloguj się do panelu"}
                  </Button>
                </form>
              ) : bizDone ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-4xl">🎉</p>
                  <p className="text-white font-bold text-lg">Zgłoszenie wysłane!</p>
                  <p className="text-blue-300 text-sm leading-relaxed">
                    Sprawdzimy Twoje zgłoszenie i skontaktujemy się na <strong>{email}</strong>.
                    Zazwyczaj odpowiadamy w ciągu 24 godzin.
                  </p>
                  <button
                    onClick={() => { setBizDone(false); setBizMode("login"); }}
                    className="text-sm text-blue-400 underline pt-2"
                  >
                    Wróć do logowania
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBizRegister} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-place" className="text-blue-200">Nazwa lokalu</Label>
                    <Input
                      id="biz-place"
                      type="text"
                      value={bizPlace}
                      onChange={(e) => setBizPlace(e.target.value)}
                      required
                      placeholder="np. Kawiarnia Stara Kamienica, Kraków"
                      className="bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-reg-email" className="text-blue-200">{t("fields.email")}</Label>
                    <Input
                      id="biz-reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder={t("fields.email_placeholder")}
                      className="bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-phone" className="text-blue-200">Telefon kontaktowy <span className="text-blue-400/60 font-normal">(opcjonalnie)</span></Label>
                    <Input
                      id="biz-phone"
                      type="tel"
                      value={bizPhone}
                      onChange={(e) => setBizPhone(e.target.value)}
                      placeholder="+48 600 000 000"
                      className="bg-blue-900/50 border-blue-700/60 text-white placeholder:text-blue-400/50 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="biz-message" className="text-blue-200">Wiadomość <span className="text-blue-400/60 font-normal">(opcjonalnie)</span></Label>
                    <textarea
                      id="biz-message"
                      value={bizMessage}
                      onChange={(e) => setBizMessage(e.target.value)}
                      placeholder="Coś jeszcze, co chcesz nam powiedzieć..."
                      rows={2}
                      className="w-full rounded-2xl px-3 py-2 text-sm bg-blue-900/50 border border-blue-700/60 text-white placeholder:text-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-2xl py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base border-0" disabled={loading}>
                    {loading ? "Wysyłam..." : "Wyślij zgłoszenie"}
                  </Button>
                  <p className="text-xs text-blue-400/60 text-center leading-relaxed">
                    Po weryfikacji otrzymasz dostęp do panelu zarządzania swoim lokalem.
                  </p>
                </form>
              )}
            </>
          ) : (
          <>
          {/* Login / Register tabs */}
          <div className="flex rounded-2xl bg-muted p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("tabs.login")}
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${
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
              <Button type="submit" className="w-full rounded-2xl py-6 bg-primary hover:bg-primary/90 text-white font-bold text-base" disabled={loading}>
                {loading ? t("logging_in") : t("login_btn")}
              </Button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Zapomniałeś/aś hasła?
              </button>
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
              <Button type="submit" className="w-full rounded-2xl py-6 bg-primary hover:bg-primary/90 text-white font-bold text-base" disabled={loading}>
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
