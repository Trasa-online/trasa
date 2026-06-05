import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { usePostHog } from "@posthog/react";
import { isHardcodedAdmin } from "@/lib/admins";
import { isNative } from "@/lib/platform";
import { Browser } from "@capacitor/browser";
import { useAuth } from "@/hooks/useAuth";

type Mode = "login" | "register";
type BizMode = "login" | "register";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("auth");
  const posthog = usePostHog();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(searchParams.get("tab") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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

  // Draft upgrade mode — business came from /biznes/start, wants to create a real account
  const draftProfileId = searchParams.get("draft");
  const isDraftMode = !!draftProfileId;

  // Hint shown when user is sent here from a guest-blocked route
  const hint = searchParams.get("hint");
  const hintMessage = hint === "journal"
    ? "Załóż konto, żeby mieć dziennik podróży i zapisywać wspomnienia."
    : hint === "settings"
      ? "Zaloguj się, żeby zmieniać ustawienia konta."
      : null;

  // Pick up referral code from URL (?ref=CODE) or landing page (localStorage)
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) localStorage.setItem("pending_referral_code", refFromUrl);
  }, [searchParams]);

  // Post-login redirect. Reaguje na user state change (kluczowe dla native: po
  // OAuth Google na native, deep link wraca i NativeDeepLinkHandler robi
  // exchangeCodeForSession -> user state w supabase auth updateuje sie -> useAuth
  // emit -> ten useEffect re-runs -> navigate na wlasciwy ekran. Bez tego user
  // po wylogowaniu + ponowny login zostawal na /auth widoku, mimo ze byl zalogowany.
  useEffect(() => {
    if (isDraftMode) return;
    if (!user) return;
    if ((user as any).is_anonymous) return; // anonymous = traktuj jak guest, nie redirect
    let cancelled = false;
    (async () => {
      // Always check for business profile first - business users must not land on /home.
      // Wyjatki: hardcoded admins (Nat, Tomek) + draft profile (niedokonczony upgrade).
      const skipBusinessRedirect = isHardcodedAdmin(user.email);
      if (!skipBusinessRedirect) {
        const { data: bp } = await (supabase as any)
          .from("business_profiles")
          .select("place_id, id, is_draft")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (bp?.id && !bp.is_draft) {
          navigate(`/biznes/${bp.place_id ?? bp.id}`);
          return;
        }
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
          // /create generuje trase z dostarczonego state - od razu loading state, bez
          // cofania do StartingLocationPicker. Spread guest passes startingLocation,
          // numDays, likedPlacesData (z lat/lng), skippedPlaceNames, superLiked etc.
          navigate("/create", { state: guest });
          return;
        } catch {}
      }
      const returnTo = searchParams.get("return");
      navigate(returnTo || "/home");
    })();
    return () => { cancelled = true; };
  }, [user, navigate, isDraftMode, searchParams]);

  const handleBizRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizPlace.trim()) { toast.error("Podaj nazwę lokalu"); return; }
    setLoading(true);
    try {
      // Just submit the inquiry - no auth account yet.
      // Admin will invite the owner via Supabase after reviewing the claim.
      const { error: claimError } = await (supabase as any).from("business_claims").insert({
        contact_email: email,
        contact_phone: bizPhone.trim() || null,
        place_name_text: bizPlace.trim(),
        message: bizMessage.trim() || null,
        status: "pending",
      });
      if (claimError) throw claimError;

      posthog.capture("business_claim_submitted", { place_name: bizPlace.trim() });
      setBizDone(true);
    } catch (err: any) {
      posthog.captureException(err);
      toast.error(err.message || "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error("Podaj najpierw swój adres email"); return; }
    // Osobny resetLoading zeby button 'Zaloguj' nie pokazywal 'Logowanie...'.
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://trasa.travel/#/set-password",
      });
      if (error) throw error;
      toast.success("Link do resetowania hasła wysłany na " + email);
    } catch (err: any) {
      toast.error(err.message || "Błąd wysyłania emaila");
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      posthog.identify(data.user!.id, { email: data.user!.email });
      posthog.capture("user_signed_in", { business_mode: businessMode });

      // Check for business profile (covers both businessMode and regular login for biz accounts).
      // Hardcoded admins (Nat, Tomek) loguja sie konsumencko mimo posiadania biz profilu -
      // chyba ze swiadomie weszli z businessMode (zakladka "Panel Biznesowy").
      const skipBusinessRedirect = !businessMode && isHardcodedAdmin(data.user!.email);
      const { data: bp } = skipBusinessRedirect
        ? { data: null as { id?: string; place_id?: string | null; is_draft?: boolean } | null }
        : await (supabase as any)
            .from("business_profiles")
            .select("place_id, id, is_draft")
            .eq("owner_user_id", data.user!.id)
            .maybeSingle();
      if (bp?.id && !bp.is_draft) {
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
          // /create generuje trase z dostarczonego state - od razu loading state, bez
          // cofania do StartingLocationPicker. Spread guest passes startingLocation,
          // numDays, likedPlacesData (z lat/lng), skippedPlaceNames, superLiked etc.
          navigate("/create", { state: guest });
          return;
        } catch {}
      }

      const returnTo = searchParams.get("return");
      navigate(returnTo || "/home");
    } catch (error: any) {
      posthog.captureException(error);
      toast.error(error.message || t("errors.login"));
    } finally {
      setLoading(false);
    }
  };

  const [draftUpgradeDone, setDraftUpgradeDone] = useState(false);

  const handleDraftUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (password.length < 6) { toast.error("Hasło musi mieć co najmniej 6 znaków"); return; }
    setLoading(true);
    try {
      // Wymus odswiezenie sesji + jawnie pass auth header (supabase.functions.invoke
      // czasem gubi header dla anon sesji w niektorych browserach).
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (!freshSession?.access_token) {
        toast.error("Sesja wygasła. Odśwież stronę i spróbuj ponownie.");
        setLoading(false);
        return;
      }
      // Use server-side admin API to upgrade the anonymous account.
      // This skips Supabase's default "Confirm change of email" mail and
      // marks the email as confirmed so the user never lands on /set-password.
      // Function always returns 200 + envelope { ok, code, message } — read body directly.
      const { data: upgradeData, error: upgradeError } = await supabase.functions.invoke(
        "upgrade-business-account",
        {
          headers: { Authorization: `Bearer ${freshSession.access_token}` },
          body: { email: email.trim().toLowerCase(), password },
        },
      );
      if (upgradeError) {
        console.error("[handleDraftUpgrade] function invoke failed", upgradeError);
        toast.error("Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.");
        setLoading(false);
        return;
      }
      if (!upgradeData?.ok) {
        console.error("[handleDraftUpgrade] upgrade rejected", upgradeData);
        toast.error(upgradeData?.message ?? "Nie udało się utworzyć konta.");
        setLoading(false);
        return;
      }
      // Refresh the client session so the JWT includes the new email + claims
      await supabase.auth.refreshSession();
      // Promote the draft profile to a real one so the dashboard loads in live mode.
      // activated_at is the signal "fresh registration" - uzywane przez tour auto-start
      // (BusinessDashboard.tsx) zeby pokazac onboarding TYLKO swiezo zarejestrowanym firmom.
      const { error: promoteError } = await (supabase as any)
        .from("business_profiles")
        .update({ is_draft: false, activated_at: new Date().toISOString() })
        .eq("id", draftProfileId);
      if (promoteError) throw promoteError;
      // Fetch business name + place_id for the welcome email CTA
      const { data: bizProfile } = await (supabase as any)
        .from("business_profiles")
        .select("business_name, place_id")
        .eq("id", draftProfileId)
        .single();
      // Fire and forget — welcome email shouldn't block redirect
      supabase.functions.invoke("send-business-welcome", {
        body: {
          email: email.trim().toLowerCase(),
          business_name: bizProfile?.business_name ?? null,
          place_id: bizProfile?.place_id ?? draftProfileId,
        },
      }).catch((err) => console.error("[send-business-welcome]", err));
      // Clear draft key from localStorage — profile is now a real account
      localStorage.removeItem("draft_profile_id");
      setDraftUpgradeDone(true);
      // Navigate to their dashboard after short delay
      setTimeout(() => navigate(`/biznes/${draftProfileId}`), 1500);
    } catch (err: any) {
      toast.error(err.message || "Błąd zakładania konta");
    } finally {
      setLoading(false);
    }
  };

  const [signupDone, setSignupDone] = useState(false);

  const handleOAuth = async (provider: "apple" | "google") => {
    setLoading(true);
    try {
      const redirectTo = isNative
        ? "travel.trasa.app://auth/callback"
        : `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: isNative },
      });
      if (error) throw error;
      if (isNative && data?.url) {
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      }
      // Supabase redirects the browser - no further code runs here on success.
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
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
    if (password.length < 6) {
      toast.error("Hasło musi mieć co najmniej 6 znaków");
      return;
    }
    setLoading(true);
    try {
      const referralCode = localStorage.getItem("pending_referral_code") || null;
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            username: username.trim(),
            referral_code: referralCode,
          },
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
      posthog.capture("user_signed_up", { source: referralCode ? "referral" : "website" });
      setSignupDone(true);
    } catch (error: any) {
      posthog.captureException(error);
      toast.error(error.message || t("errors.register"));
    } finally {
      setLoading(false);
    }
  };

  if (isDraftMode) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="h-14 w-14 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 60%, #1d4ed8)" }} />
          {draftUpgradeDone ? (
            <div className="text-center space-y-2">
              <p className="text-2xl">🎉</p>
              <h1 className="text-xl font-black text-white">Konto założone!</h1>
              <p className="text-sm text-blue-300/70">{`Zaraz wrócimy do Twojego profilu...`}</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="inline-block mb-3 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
                  Panel Biznesowy
                </span>
                <h1 className="text-2xl font-black text-white leading-tight">
                  {`Twój profil jest prawie gotowy!`}
                </h1>
                <p className="text-sm text-blue-300/70 mt-2 leading-relaxed">
                  {`Podaj email i hasło, żeby na stałe zapisać Twój lokal w Trasie.`}
                </p>
              </div>
              <form onSubmit={handleDraftUpgrade} className="w-full space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-blue-200">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="twoj@email.pl"
                    className="w-full rounded-2xl border border-blue-700/60 bg-blue-900/50 px-4 py-3 text-sm text-white placeholder:text-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-blue-200">Hasło (min. 6 znaków)</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-blue-700/60 bg-blue-900/50 px-4 py-3 text-sm text-white placeholder:text-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-blue-900/40 disabled:opacity-60"
                >
                  {loading ? "Zakładam konto..." : "Zapisz profil i załóż konto →"}
                </button>
              </form>
              <button
                onClick={() => navigate(`/biznes/${draftProfileId}`)}
                className="text-sm text-blue-300/70 active:opacity-60"
              >
                Wróć do edycji
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

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
        ) : null}

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
          {hintMessage && (
            <div className="mb-5 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-200">
              <p className="text-sm text-foreground leading-snug">{hintMessage}</p>
            </div>
          )}

          {/* OAuth - Apple + Google */}
          <div className="flex flex-col gap-6 mb-5">
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-black text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
              aria-label="Kontynuuj z Apple"
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
              aria-label="Kontynuuj z Google"
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

          <p className="text-xs text-muted-foreground text-center mb-2 leading-relaxed">
            Konto zakładasz automatycznie przy pierwszym logowaniu. Miałeś&nbsp;już konto z&nbsp;hasłem? Użyj Google lub Apple z&nbsp;tym samym adresem - połączymy je&nbsp;automatycznie.
          </p>

          {/* Business link - subtle, at the bottom */}
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
