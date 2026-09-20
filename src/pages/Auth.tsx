import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTranslation, Trans } from "react-i18next";
import { usePostHog } from "@posthog/react";
import { isInternalAnalyticsAccount } from "@/lib/internalAccounts";
import { isHardcodedAdmin } from "@/lib/admins";
import { isNative } from "@/lib/platform";
import WelcomeDeck from "@/components/auth/WelcomeDeck";
import { Browser } from "@capacitor/browser";
import { useAuth } from "@/hooks/useAuth";
import { TrasaLogo } from "@/components/TrasaLogo";
import { businessPanelPath } from "@/lib/businessRedirect";

type Mode = "login" | "register";
type BizMode = "login" | "register";

// USP aplikacji na ekranie logowania (auto-rotujaca karuzela). NBSP ( ) po
// pojedynczych literach - regula polskich sierot.
// Etykiety jako KLUCZE - stala zyje poza komponentem, wiec nie ma tu hooka t();
// tlumaczenie dokleja sie przy renderze karuzeli.
const AUTH_USP = [
  { titleKey: "intro.discover_title", descKey: "intro.discover_desc" },
  { titleKey: "intro.create_title", descKey: "intro.create_desc" },
  { titleKey: "intro.save_title", descKey: "intro.save_desc" },
] as const;

function AuthUspCarousel() {
  const { t } = useTranslation("auth");
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % AUTH_USP.length), 3800);
    return () => clearInterval(id);
  }, []);
  const cur = AUTH_USP[i];
  return (
    <div key={i} className="animate-auth-fade w-full max-w-sm mx-auto text-center px-2">
      <p className="font-display text-2xl font-extrabold leading-tight text-[#5B2C06]">{t(cur.titleKey)}</p>
      <p className="mt-2.5 text-sm leading-relaxed text-[#5B2C06]/75 max-w-[300px] mx-auto">{t(cur.descKey)}</p>
    </div>
  );
}

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
  // Domyslnie LANDING z rejestracja (wariant C2): i "zaloguj sie", i "zarejestruj sie"
  // prowadza w to samo miejsce. Wyjatek: ?return= = odbilismy kogos z chronionego adresu
  // panelu, czyli wracajacego wlasciciela - jemu od razu logowanie, nie oferta.
  const [bizMode, setBizMode] = useState<BizMode>(() => (searchParams.get("return") ? "login" : "register"));
  const [bizExpanded, setBizExpanded] = useState(false); // hero: pokazano nazwe lokalu + telefon
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
    ? t("hint.journal")
    : hint === "settings"
      ? t("hint.settings")
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
          toast.error(t("biz.no_profile"));
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
    if (!bizPlace.trim()) { toast.error(t("biz.need_name")); return; }
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
      toast.error(err.message || t("error.signup"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error(t("error.need_email")); return; }
    // Osobny resetLoading zeby button 'Zaloguj' nie pokazywal 'Logowanie...'.
    setResetLoading(true);
    try {
      // B2B: wlasny mail resetu przez edge function (send-business-password-reset).
      // Generuje token serwerowo (token-hash) i sam sklada link -> NIE wymaga PKCE
      // verifiera, wiec dziala tez gdy link otworzy sie w Safari (nie w apce). To fix
      // natywnego resetu + niebieski branding B2B. B2C zostaje na wbudowanym Supabase.
      if (businessMode) {
        const { error } = await supabase.functions.invoke("send-business-password-reset", {
          body: { email: email.trim() },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: "https://spontaway.com/?recovery=1",
        });
        if (error) throw error;
      }
      toast.success(t("toast.reset_sent_to", { email }));
    } catch (err: any) {
      toast.error(err.message || t("error.email_send"));
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

      // Konto zespolu: wylacz capture zamiast identify (lib/internalAccounts).
      if (isInternalAnalyticsAccount(data.user!.email)) posthog.opt_out_capturing();
      else {
        posthog.identify(data.user!.id, { email: data.user!.email });
        posthog.capture("user_signed_in", { business_mode: businessMode });
      }

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
        toast.error(t("biz.no_dashboard"));
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
    if (password.length < 6) { toast.error(t("error.password_short")); return; }
    setLoading(true);
    try {
      // Wymus odswiezenie sesji + jawnie pass auth header (supabase.functions.invoke
      // czasem gubi header dla anon sesji w niektorych browserach).
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (!freshSession?.access_token) {
        toast.error(t("error.session_expired"));
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
        toast.error(t("error.network"));
        setLoading(false);
        return;
      }
      if (!upgradeData?.ok) {
        console.error("[handleDraftUpgrade] upgrade rejected", upgradeData);
        toast.error(upgradeData?.message ?? t("error.account_create"));
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
      toast.error(err.message || t("error.account_create_title"));
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
        toast.error(t("error.provider_not_configured", { provider: provider === "apple" ? "Apple" : "Google" }));
      } else {
        toast.error(err.message || t("error.signin"));
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
      toast.error(t("error.need_first_name"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("error.password_short"));
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
          toast.error(t("error.password_weak"));
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
              <h1 className="text-xl font-black text-white">{t("biz.account_created")}</h1>
              <p className="text-sm text-blue-300/70">{t("claim.returning")}</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="inline-block mb-3 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
                  Panel Biznesowy
                </span>
                <h1 className="text-2xl font-black text-white leading-tight">
                  {t("claim.almost_ready")}
                </h1>
                <p className="text-sm text-blue-300/70 mt-2 leading-relaxed">
                  {t("claim.desc")}
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
                    className="w-full rounded-2xl border border-blue-700/60 bg-blue-900/50 px-4 py-3 text-sm text-white placeholder:text-blue-400/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-blue-200">{t("password_placeholder")}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-blue-700/60 bg-blue-900/50 px-4 py-3 text-sm text-white placeholder:text-blue-400/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-lg shadow-blue-900/40 disabled:opacity-60"
                >
                  {loading ? t("claim.creating") : t("claim.submit")}
                </button>
              </form>
              <button
                onClick={() => navigate(`/biznes/${draftProfileId}`)}
                className="text-sm text-blue-300/70 active:opacity-60"
              >{t("back_to_edit")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── B2B auth = LANDING Z REJESTRACJA (wariant C2 z Figmy, wybor Nat 2026-09-14) ──
  //    Wejscie "zaloguj sie" i "zarejestruj sie" prowadzi w TO SAMO miejsce: zolte hero
  //    z obietnica i polem email. Logowanie chowa sie pod "Mam juz konto" (wariant C1) -
  //    research portali partnerskich (DoorDash Merchants, Faire, Robinhood, Boords) mowi,
  //    ze powrot do panelu ma byc szybki, a zalozenie konta dostaje przestrzen i argumenty.
  //    Wyjatek: gdy odbilismy kogos z chronionego adresu panelu (?return=), to wracajacy
  //    wlasciciel - jemu pokazujemy od razu logowanie, nie ofertę.
  //    Kolory: marka (zolte hero, pomaranczowe CTA). Niebieski zszedl razem z panelem.
  if (businessMode) {
    const goBack = () => {
      setBizDone(false);
      goBackOr(navigate, "/dla-firm");
    };
    const inputCls = "h-12 rounded-2xl bg-[#F4F2EF] border-[#E4DFD9] text-slate-900 placeholder:text-[#8A8079] focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40";
    const showLogin = bizMode === "login";

    // Krok 1 hero = sam email (jak w makiecie). Po "Załóż konto" dosypujemy nazwę lokalu
    // i telefon - register-business potrzebuje nazwy, a trzy pola w hero zabijały lekkość.
    const heroSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) { toast.error(t("bizland.need_email")); return; }
      if (!bizExpanded) { setBizExpanded(true); return; }
      handleBizRegister(e);
    };

    return (
      <div className="min-h-screen flex flex-col bg-[#FEFEFE]">
        {/* ── Belka: sam znak. Guzik „Mam już konto / Dodaj lokal" ZDJĘTY 2026-09-14 -
               po dodaniu przełącznika w hero robił dokładnie to samo co on, tylko pod inną
               nazwą (dwa guziki obok siebie, jedna akcja). Przełączanie żyje w hero. ── */}
        <header className="flex items-center px-5 sm:px-8 lg:px-12 h-16 sm:h-20 shrink-0">
          <button onClick={goBack} className="flex items-center gap-2 active:opacity-70" aria-label={t("back")}>
            <TrasaLogo size={30} />
            <span className="text-sm font-black text-slate-900">spontaway<span className="text-primary"> biznes</span></span>
          </button>
        </header>

        {/* ── JEDNA strona: hero zostaje, zmienia się tylko treść formularza.
               Przełącznik rejestracja/logowanie siedzi nad formularzem, więc lokal nigdy
               nie wychodzi z tego widoku (prośba Nat 2026-09-14 - wcześniej logowanie
               wyrzucało na pustą białą stronę z samotną kartą). ── */}
        <>
            <section className="bg-[#FDF184]">
              <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 py-10 sm:py-14 lg:py-16
                              grid gap-10 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center">
                {/* Treść */}
                <div className="max-w-xl">
                  <h1 className="font-brand text-[#5B2C06] leading-[1.08] text-[34px] sm:text-[44px] lg:text-[52px]">
                    {showLogin
                      ? t("bizland.login_title")
                      : <>{t("bizland.hero_title_1")}<br />{t("bizland.hero_title_2")}</>}
                  </h1>
                  <p className="mt-4 text-[15px] sm:text-[17px] leading-relaxed text-[#6B3A0F] max-w-[42ch]">
                    {showLogin ? t("biz.signin_desc") : t("bizland.hero_sub")}
                  </p>

                  {/* Przełącznik: rejestracja | logowanie. Aktywny = brąz marki, żeby nie
                      konkurował z pomarańczowym CTA tuż pod spodem. */}
                  <div className="mt-6 inline-flex rounded-full bg-white/70 border border-[#EAD9A8] p-1">
                    {([
                      { id: "register", label: t("bizland.tab_register") },
                      { id: "login", label: t("bizland.tab_login") },
                    ] as const).map((tab) => {
                      const active = (tab.id === "login") === showLogin;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setBizDone(false); setBizExpanded(false); setBizMode(tab.id); }}
                          aria-pressed={active}
                          className={`px-4 sm:px-5 h-10 rounded-full text-[13px] sm:text-sm font-bold transition-colors ${
                            active ? "bg-[#5B2C06] text-white" : "text-[#6B3A0F] hover:text-[#5B2C06]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {showLogin ? (
                    /* ── Logowanie: pola w tym samym miejscu co formularz rejestracji ── */
                    <form onSubmit={handleLogin} className="mt-5 max-w-[520px] space-y-2.5">
                      <input
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        placeholder={t("fields.email_placeholder")} aria-label={t("fields.email")}
                        className="w-full h-14 rounded-full bg-white border border-[#EAD9A8] px-5 text-[15px] text-slate-900
                                   placeholder:text-[#8A8079] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      <input
                        type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                        placeholder={t("fields.password_placeholder")} aria-label={t("fields.password")}
                        className="w-full h-14 rounded-full bg-white border border-[#EAD9A8] px-5 text-[15px] text-slate-900
                                   placeholder:text-[#8A8079] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <button type="button" onClick={handleForgotPassword} disabled={resetLoading}
                          className="text-[13px] text-[#6B3A0F] font-semibold underline underline-offset-2 disabled:opacity-60">
                          {resetLoading ? t("sending") : t("forgot_password")}
                        </button>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full sm:w-auto h-14 rounded-full bg-primary hover:bg-primary/90 px-8 text-white font-bold text-[15px]
                                   active:scale-[0.98] transition-transform disabled:opacity-60">
                        {loading ? t("logging_in") : t("biz.signin_title")}
                      </button>
                    </form>
                  ) : bizDone ? (
                    /* Po wysłaniu linku aktywacyjnego - w tym samym miejscu co formularz */
                    <div className="mt-5 rounded-3xl bg-white/80 border border-[#EAD9A8] p-5 sm:p-6 max-w-[520px]">
                      <p className="text-[17px] font-black text-[#5B2C06]">{t("check_inbox")}</p>
                      <p className="text-sm text-[#6B3A0F] mt-2 leading-relaxed">
                        <Trans i18nKey="biz.activation_sent_full" ns="auth" values={{ email }}
                          components={{ b: <strong className="text-[#5B2C06]" /> }} />
                      </p>
                      <p className="text-xs text-[#6B3A0F]/70 mt-2 leading-relaxed">{t("biz.activation_hint")}</p>
                      <button onClick={() => { setBizDone(false); setBizExpanded(false); setBizMode("login"); }}
                        className="text-[13px] text-primary font-bold underline mt-3">{t("back_to_signin")}</button>
                    </div>
                  ) : (
                    <form onSubmit={heroSubmit} className="mt-5 max-w-[520px]">
                      {/* Krok 1: email + CTA obok siebie (na telefonie jeden pod drugim) */}
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                          placeholder={t("bizland.hero_email_placeholder")} aria-label={t("fields.email")}
                          // ⛔ `flex-1` TYLKO od `sm`: kontener jest na telefonie kolumna, a w kolumnie
                          // flex-1 steruje WYSOKOSCIA, nie szerokoscia - `h-14` przegrywalo z
                          // `flex-basis: 0%` i pole zgniatalo sie do 20 px (zgloszenie Nat 2026-09-15).
                          className="w-full shrink-0 sm:flex-1 h-14 rounded-full bg-white border border-[#EAD9A8] px-5 text-[15px] text-slate-900
                                     placeholder:text-[#8A8079] outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        />
                        <button type="submit" disabled={loading}
                          className="h-14 shrink-0 rounded-full bg-primary hover:bg-primary/90 px-7 text-white font-bold text-[15px]
                                     active:scale-[0.98] transition-transform disabled:opacity-60">
                          {loading ? t("claim.creating") : (bizExpanded ? t("bizland.hero_cta") : t("bizland.hero_cta_next"))}
                        </button>
                      </div>

                      {/* Krok 2: nazwa lokalu + telefon (register-business wymaga nazwy) */}
                      {bizExpanded && (
                        <div className="mt-3 rounded-3xl bg-white/80 border border-[#EAD9A8] p-4 sm:p-5 space-y-3">
                          <p className="text-[13px] font-semibold text-[#6B3A0F]">{t("bizland.step_details")}</p>
                          <div className="space-y-1.5">
                            <Label htmlFor="biz-place" className="text-[13px] font-semibold text-[#3F3833]">{t("biz.venue_name")}</Label>
                            <Input id="biz-place" type="text" value={bizPlace} onChange={(e) => setBizPlace(e.target.value)} required
                              placeholder={t("biz.venue_placeholder")} className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="biz-phone" className="text-[13px] font-semibold text-[#3F3833]">
                              {t("biz.phone")} <span className="text-[#8A8079] font-normal">{t("biz.optional")}</span>
                            </Label>
                            <Input id="biz-phone" type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)}
                              placeholder="+48 600 000 000" className={inputCls} />
                          </div>
                        </div>
                      )}
                    </form>
                  )}

                  {/* Dowody - argumenty za założeniem konta, więc tylko przy rejestracji */}
                  {!showLogin && (
                    <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[#6B3A0F]">
                      {[t("bizland.proof_free"), t("bizland.proof_fast"), t("bizland.proof_cancel")].map((txt) => (
                        <li key={txt} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />{txt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Grafika: karta wizytówki unosi się góra-dół (prośba Nat). Na telefonie nad
                    treścią byłaby ścianą, więc siedzi pod nią i jest węższa. */}
                <div className="order-last flex justify-center lg:justify-end">
                  <img
                    src="/B2B_mockup.png"
                    alt={t("bizland.hero_alt")}
                    className="animate-biz-float w-[260px] sm:w-[360px] md:w-[440px] lg:w-full lg:max-w-[460px] h-auto select-none"
                    draggable={false}
                  />
                </div>
              </div>
            </section>

            {/* ── USP w stylu landingu B2C (prośba Nat 2026-09-14): żółte karty, nagłówek
                   w Sigmarze na pomarańczowo, pod nim krótkie zdanie w brązie.
                   KOLEJNOSC WE WSZYSTKICH KARTACH: najpierw grafika, pod nia tytul i copy
                   (prosba Nat 2026-09-15). Wczesniej srodkowa karta miala tytul NAD grafika
                   za makieta marketingowa - w rzedzie trzech kart czytalo sie to jak blad
                   skladu, bo wzrok skakal gora-dol-gora.
                   Grafiki: mockupy z landingu B2C - pokazują, co podróżny robi z lokalem. ── */}
            <section className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12 py-10 sm:py-14 lg:py-16">
              <ul className="grid gap-4 sm:gap-5 md:grid-cols-3">
                {([
                  { img: "/mockup_odkrywaj.png", t: "usp1" },
                  { img: "/mockup_listy.png", t: "usp2" },
                  { img: "/mockup_dziel_sie.png", t: "usp3" },
                ] as const).map((u) => (
                  <li key={u.img} className="rounded-[32px] bg-[#FDF184] p-6 sm:p-7 flex flex-col gap-5">
                    {/* Stała wysokość kadru - trzy mockupy mają różne proporcje i bez tego
                        rząd kart byłby poszarpany. */}
                    <div className="h-[168px] sm:h-[180px] flex items-center justify-center">
                      <img src={u.img} alt={t(`bizland.${u.t}_alt`)} loading="lazy"
                        className="max-h-full max-w-full w-auto object-contain select-none" draggable={false} />
                    </div>
                    <div className="mt-auto">
                      <h2 className="font-brand text-primary leading-[1.15] text-[21px] lg:text-[25px] whitespace-pre-line">
                        {t(`bizland.${u.t}_title`)}
                      </h2>
                      <p className="mt-2 text-[14px] leading-snug text-[#5B2C06]/85">{t(`bizland.${u.t}_body`)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
        </>
      </div>
    );
  }

  // B2C: ekran powitalny w barwach marki (propozycja Nat 2026-09-14): ZOLTE tlo #FDF184,
  // brazowy tekst #5B2C06, u gory tasujaca sie talia okladek miejsc ze zdjeciami userow
  // (WelcomeDeck), nizej naglowek Sigmar + tagline, auto-rotujaca karuzela USP i guziki OAuth
  // przypiete na dole. B2B ma osobny early-return powyzej. Poprzednia wersja (biel + dryfujace
  // pomaranczowe plamy) zastapiona 2026-09-14.
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#FDF184] text-[#5B2C06]">
      {/* Tresc */}
      <div className="relative z-10 flex flex-1 flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        {/* Gora: talia okladek + naglowek + tagline */}
        <WelcomeDeck className="mt-2" />
        <div className="flex flex-col items-center text-center pt-3">
          {/* Sam naglowek - claim "speed dating z miastem" zdjety z tego ekranu (prosba Nat 2026-09-14). */}
          <h1 className="font-brand text-[2rem] leading-[1.1] tracking-tight text-[#5B2C06]">
            {t("welcome.headline")}
          </h1>
        </div>

        {/* Srodek: karuzela USP */}
        <div className="flex flex-1 items-center justify-center py-6">
          <AuthUspCarousel />
        </div>

        {/* Dol: OAuth + stopka */}
        <div className="w-full max-w-sm mx-auto">
          {hintMessage && (
            <div className="mb-5 px-4 py-3 rounded-2xl bg-white/70 border border-[#5B2C06]/10">
              <p className="text-sm text-[#5B2C06] leading-snug">{hintMessage}</p>
            </div>
          )}

          {/* OAuth - Apple + Google */}
          <div className="flex flex-col gap-2.5 mb-4">
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 bg-black text-white font-semibold text-sm shadow-lg shadow-black/10 active:scale-[0.98] transition-transform disabled:opacity-60"
              aria-label={t("welcome.apple")}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              {t("welcome.apple")}
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 bg-white border border-[#5B2C06]/10 text-foreground font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60"
              aria-label={t("welcome.google")}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t("welcome.google")}
            </button>
          </div>

          {/* Business link - tylko web (na natywnej apce panel biznesowy nie ma sensu) */}
          {!isNative && (
            <p className="text-xs text-[#5B2C06]/75 text-center mt-4">
              {t("biz.are_you_owner")}{" "}
              <button
                onClick={() => setBusinessMode(true)}
                className="underline text-[#5B2C06] font-medium"
              >{t("biz.signin_title")}</button>
            </p>
          )}

          <p className="text-center text-xs text-[#5B2C06]/75 mt-4">
            <Link to="/terms" className="underline">{t("terms")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
