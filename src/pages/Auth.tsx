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
import { TrasaLogo } from "@/components/TrasaLogo";
import { businessPanelPath } from "@/lib/businessRedirect";

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
          navigate(await businessPanelPath(user.id, bp));
          return;
        }
        // Kontekst biznesowy (zakladka Panel Biznesowy): NIGDY nie odbijaj na B2C /home.
        // Draft owner -> panel draft; brak wizytowki -> zostan na logowaniu z komunikatem.
        if (businessMode) {
          if (bp?.id) { navigate(await businessPanelPath(user.id, bp)); return; }
          toast.error("To konto nie jest jeszcze powiązane z wizytówką biznesową.");
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
      navigate(returnTo || "/eksploruj");
    })();
    return () => { cancelled = true; };
  }, [user, navigate, isDraftMode, searchParams]);

  const handleBizRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizPlace.trim()) { toast.error("Podaj nazwę lokalu"); return; }
    if (!email.trim()) { toast.error("Podaj adres email"); return; }
    setLoading(true);
    try {
      // Self-service: zaklada konto + wizytowke i wysyla mail aktywacyjny z linkiem
      // "ustaw haslo". Bez akceptacji admina. Logika po stronie edge function
      // register-business (service-role: generateLink invite + business_profiles + Resend).
      const { data, error: regError } = await supabase.functions.invoke("register-business", {
        body: {
          email: email.trim(),
          place_name: bizPlace.trim(),
          phone: bizPhone.trim() || undefined,
          message: bizMessage.trim() || undefined,
        },
      });
      if (regError) throw regError;
      if ((data as any)?.error) throw new Error((data as any).error);

      posthog.capture("business_registration_started", { place_name: bizPlace.trim() });
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
      // Biznes: reset musi wracac na /set-password-biznes (SetPassword forceBusiness ->
      // ustawia haslo -> panel biznesowy). B2C: /set-password (-> /home). Bez tego biznes
      // ladowal na konsumenckim set-password i konczyl na /home zamiast w panelu.
      // bizreset=1 w SEARCH (nie w hashu) - przezywa utrate fragmentu #/... podczas
      // mailowego round-tripu; GlobalAuthCallback czyta go i kieruje na biznesowy formularz.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: businessMode
          ? "https://trasa.travel/?bizreset=1#/set-password-biznes"
          : "https://trasa.travel/#/set-password",
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
      navigate(returnTo || "/eksploruj");
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
      // Zachowaj ?return= przed OAuth (web wraca na origin/ -> GlobalAuthCallback go odczyta).
      // Dzieki temu dolaczanie do sesji grupowej (/auth?return=/sesja/KOD) wraca do sesji.
      const returnTo = searchParams.get("return");
      try {
        if (returnTo) sessionStorage.setItem("trasa_post_login_redirect", returnTo);
      } catch { /* sessionStorage unavailable */ }
      // Cel powrotu doklejamy TEZ do redirectTo jako ?next= - przezywa round-trip OAuth
      // nawet gdy sessionStorage gubi sie (in-app browser, np. Messenger).
      const redirectTo = isNative
        ? "travel.trasa.app://auth/callback"
        : `${window.location.origin}/${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`;
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
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            username: username.trim(),
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
      posthog.capture("user_signed_up", { source: "website" });
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

  // ── B2B auth: jasny layout (logo lewy-gora, biala karta na srodku, toggle login/rejestracja).
  //    B2B branding = niebieski AKCENT (guziki/toggle), tlo jasne. Osobny early-return -
  //    B2C (ponizej) zostaje bez zmian. ──
  if (businessMode) {
    const goBack = () => {
      setBizDone(false);
      if (window.history.length > 1) navigate(-1);
      else navigate("/dla-firm");
    };
    const inputCls = "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500";
    return (
      <div
        className="min-h-screen flex flex-col bg-[#F4F4F5]"
        style={{ backgroundImage: "radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {/* Top bar: samo logo (lewy-gora) */}
        <div className="flex items-center px-5 sm:px-8 h-16 shrink-0">
          <button onClick={goBack} className="flex items-center gap-2 active:opacity-70" aria-label="Wróć">
            <TrasaLogo size={34} />
            <span className="text-sm font-black text-slate-800">trasa<span className="text-blue-600"> biznes</span></span>
          </button>
        </div>

        {/* Centered card */}
        <div className="flex-1 flex items-center justify-center px-5 pb-10">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-900/[0.06] border border-slate-100 p-7 sm:p-9">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-black text-slate-900 leading-tight">
                {bizMode === "login" ? "Zaloguj się do panelu" : "Zarejestruj swój lokal"}
              </h1>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {bizMode === "login"
                  ? "Wejdź na konto powiązane z Twoim lokalem."
                  : "Załóż konto i zarządzaj wizytówką lokalu na Trasie."}
              </p>
            </div>

            {/* Toggle */}
            <div className="flex rounded-2xl bg-slate-100 p-1 mb-6">
              <button
                onClick={() => setBizMode("login")}
                className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${bizMode === "login" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Zaloguj się
              </button>
              <button
                onClick={() => { setBizDone(false); setBizMode("register"); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${bizMode === "register" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Zarejestruj lokal
              </button>
            </div>

            {bizMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="biz-email" className="text-slate-700">{t("fields.email")}</Label>
                  <Input id="biz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("fields.email_placeholder")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-password" className="text-slate-700">{t("fields.password")}</Label>
                  <Input id="biz-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t("fields.password_placeholder")} className={inputCls} />
                </div>
                <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-xs text-blue-600 font-medium hover:underline disabled:opacity-60">
                  {resetLoading ? "Wysyłam..." : "Nie pamiętasz hasła?"}
                </button>
                <Button type="submit" className="w-full rounded-2xl py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base border-0" disabled={loading}>
                  {loading ? t("logging_in") : "Zaloguj się do panelu"}
                </Button>
              </form>
            ) : bizDone ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-4xl">📬</p>
                <p className="text-slate-900 font-bold text-lg">Sprawdź skrzynkę mailową</p>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {`Wysłaliśmy link aktywacyjny na `}<strong className="text-slate-700">{email}</strong>{`. Kliknij go, ustaw hasło i wejdź do panelu swojego lokalu.`}
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {`Nie widzisz maila? Sprawdź folder spam. Link jest ważny przez 24 godziny.`}
                </p>
                <button onClick={() => { setBizDone(false); setBizMode("login"); }} className="text-sm text-blue-600 font-medium underline pt-2">
                  Wróć do logowania
                </button>
              </div>
            ) : (
              <form onSubmit={handleBizRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="biz-place" className="text-slate-700">Nazwa lokalu</Label>
                  <Input id="biz-place" type="text" value={bizPlace} onChange={(e) => setBizPlace(e.target.value)} required placeholder="np. Kawiarnia Stara Kamienica, Kraków" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-reg-email" className="text-slate-700">{t("fields.email")}</Label>
                  <Input id="biz-reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("fields.email_placeholder")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-phone" className="text-slate-700">Telefon kontaktowy <span className="text-slate-400 font-normal">(opcjonalnie)</span></Label>
                  <Input id="biz-phone" type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="+48 600 000 000" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="biz-message" className="text-slate-700">Wiadomość <span className="text-slate-400 font-normal">(opcjonalnie)</span></Label>
                  <textarea id="biz-message" value={bizMessage} onChange={(e) => setBizMessage(e.target.value)} placeholder="Coś jeszcze, co chcesz nam powiedzieć..." rows={2}
                    className="w-full rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <Button type="submit" className="w-full rounded-2xl py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base border-0" disabled={loading}>
                  {loading ? "Zakładam konto..." : "Załóż konto biznesowe"}
                </Button>
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  {`Wyślemy link aktywacyjny na Twój email. Konto założysz od razu, bez czekania na akceptację.`}
                </p>
              </form>
            )}

            <p className="text-center text-xs text-slate-400 mt-6">
              {bizMode === "login" ? (
                <>Nie masz jeszcze konta?{" "}<button onClick={() => setBizMode("register")} className="text-blue-600 font-semibold hover:underline">Zarejestruj lokal</button></>
              ) : (
                <>Masz już konto?{" "}<button onClick={() => { setBizDone(false); setBizMode("login"); }} className="text-blue-600 font-semibold hover:underline">Zaloguj się</button></>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${businessMode ? "bg-blue-950" : "bg-background"}`}>
      {/* Hero - B2C: logo+tagline u gory, guziki na dole (mt-auto). B2B: wycentrowane. */}
      <div className={`flex-1 flex flex-col items-center px-6 pt-12 pb-6 ${businessMode ? "justify-center" : ""}`}>
        {/* Logo + naglowek + body. B2C: wycentrowane w pionie wzgledem strony (flex-1).
            B2B: czesc wycentrowanej sekcji (hero ma justify-center). */}
        <div className={`flex flex-col items-center ${businessMode ? "" : "flex-1 justify-center"}`}>
        {/* Logo mark - B2C: realne logo Trasy (orba). B2B: niebieska orba (branding biznesowy). */}
        {businessMode ? (
          <div
            className="w-14 h-14 rounded-full mb-4"
            style={{ background: "radial-gradient(circle at 35% 35%, #60a5fa, #2563eb 60%, #1d4ed8)" }}
          />
        ) : (
          <TrasaLogo size={80} className="mb-4" />
        )}
        {businessMode && <h1 className="text-4xl font-black tracking-tight mb-1.5 text-white">TRASA</h1>}
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
          <>
            <p className="text-foreground/70 text-center text-base font-bold mb-3">Odkrywaj i&nbsp;zwiedzaj</p>
            <p className="text-muted-foreground text-center text-sm max-w-[320px] leading-relaxed mb-7">
              Lokalne atrakcje - solo lub z&nbsp;grupą. Nie martwisz się planowaniem: gotowy plan dnia masz w&nbsp;kilka sekund, a&nbsp;wspomnienia zapisujesz, żeby dzielić się nimi z&nbsp;innymi.
            </p>
          </>
        )}
        </div>

        <div className="w-full max-w-sm">
          {businessMode ? (
            <>
              <button
                onClick={() => {
                  // Wyjdz z auth biznesowego do miejsca skad firma przyszla (landing dla firm),
                  // NIE przelaczaj na auth B2C (setBusinessMode(false) pokazywalo ekran konsumencki).
                  setBizDone(false);
                  if (window.history.length > 1) navigate(-1);
                  else navigate("/dla-firm");
                }}
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
                  <p className="text-4xl">📬</p>
                  <p className="text-white font-bold text-lg">Sprawdź skrzynkę mailową</p>
                  <p className="text-blue-300 text-sm leading-relaxed">
                    {`Wysłaliśmy link aktywacyjny na `}<strong>{email}</strong>{`. Kliknij go, ustaw hasło i wejdź do panelu swojego lokalu.`}
                  </p>
                  <p className="text-blue-400/60 text-xs leading-relaxed">
                    {`Nie widzisz maila? Sprawdź folder spam. Link jest ważny przez 24 godziny.`}
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
                    {loading ? "Zakładam konto..." : "Załóż konto biznesowe"}
                  </Button>
                  <p className="text-xs text-blue-400/60 text-center leading-relaxed">
                    {`Wyślemy link aktywacyjny na Twój email. Konto założysz od razu, bez czekania na akceptację.`}
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
          <div className="flex flex-col gap-2 mb-5">
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

          {/* Business link - tylko web (na natywnej apce panel biznesowy nie ma sensu) */}
          {!isNative && (
            <p className="text-xs text-muted-foreground text-center mt-6">
              Jesteś właścicielem lokalu?{" "}
              <button
                onClick={() => setBusinessMode(true)}
                className="underline text-foreground font-medium"
              >
                Zaloguj się do panelu
              </button>
            </p>
          )}
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
