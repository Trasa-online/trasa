import { useState, useEffect, useRef, useCallback } from "react";
import { avatarSrc } from "@/lib/avatar";
import { ArrowLeft, Check, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { requestAndRegisterNativePush } from "@/hooks/useNativePush";
import { requestLocation } from "@/hooks/useGeolocation";
import { grantConsent, denyConsent } from "@/lib/consent";
import { TRIP_COUNTRIES, citiesForCountry, countryForCity } from "@/lib/tripCountries";
import TrasaLogo from "@/components/TrasaLogo";
import { CategoryIcon } from "@/components/CategoryIcon";
import { cn } from "@/lib/utils";
import { uploadThumb } from "@/lib/imageThumbs";

// Limit slow (np. dla pola "Inne").
const capWords = (v: string, n = 10) => {
  const parts = v.split(/\s+/);
  return parts.length > n ? parts.slice(0, n).join(" ") : v;
};

// Przykladowe miejsca (ilustracja na ekranie lokalizacji - UI listy miejsc z aplikacji).
// Realne warszawskie lokale (z bazy places) - dla autentycznosci podgladu.
const SAMPLE_NEARBY = [
  { name: "Prodiż Warszawski", cat: "restaurant", dist: "0,4 km" },   // i18n-ignore: nazwa wlasna lokalu
  { name: "5 ciastek", cat: "cafe", dist: "0,8 km" },                 // i18n-ignore: nazwa wlasna lokalu
  { name: "Same Krafty", cat: "bar", dist: "1,2 km" },                // i18n-ignore: nazwa wlasna lokalu
];

// Onboarding Czesc A (po pierwszym logowaniu, real user): welcome -> 2 pytania ankietowe
// (opcje + "inne") -> profil (nazwa uzytkownika max 20 znakow + zdjecie). Po ukonczeniu
// ustawia profiles.onboarding_completed = true i odpala coach-marki (Czesc B) flaga localStorage.
// Wzorzec pelnoekranowy 1:1 z ProfileSetup (tlo #FEFEFE, gradient CTA, pasek postepu).

// Polskie sieroty: po pojedynczych literach twarda spacja.
const nbsp = (s: string) => s.replace(/ ([aiouwzAIOUWZ]) /g, (_m, l) => " " + l + String.fromCharCode(160));

const USERNAME_MAX = 20;
const sanitizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX);
const escapeLike = (v: string) => v.replace(/[%_\\]/g, "\\$&");

// Sygnal dla Czesci B (coach-marki): OnboardingProvider startuje tour gdy widzi ten klucz.
export const COACH_PENDING_KEY = "spontaway_coach_pending";

// Etykiety trzymamy jako KLUCZE, nie gotowy tekst - te stale zyja poza komponentem,
// wiec nie ma tu hooka t(); tlumaczenie dokleja sie przy renderze.
const SOURCE_OPTS = [
  { id: "instagram", labelKey: "sources.instagram" },
  { id: "tiktok", labelKey: "sources.tiktok" },
  { id: "znajomi", labelKey: "sources.friends" },
  { id: "newonce", labelKey: "sources.newonce" },
  { id: "appstore", labelKey: "sources.appstore" },
  { id: "other", labelKey: "sources.other" },
];

const GOAL_OPTS = [
  { id: "odkrywanie", labelKey: "goals.discover" },
  { id: "wyjazdy", labelKey: "goals.plan_trips" },
  { id: "inspiracja", labelKey: "goals.inspiration" },
  { id: "znajomi", labelKey: "goals.with_friends" },
  { id: "zapisywanie", labelKey: "goals.save_places" },
  { id: "other", labelKey: "goals.other" },
];

const STEPS = ["welcome", "source", "goals", "username", "avatar", "home", "notify", "location", "tracking"] as const;
type Step = typeof STEPS[number];
type UStatus = "idle" | "short" | "checking" | "ok" | "taken";

interface Props { onDone: () => void; }

const OnboardingFlow = ({ onDone }: Props) => {
  const { t } = useTranslation("onboarding");
  const { t: tCat } = useTranslation("categories");
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const stepName: Step = STEPS[step];

  // Ankieta
  const [source, setSource] = useState<string | null>(null);
  const [sourceOther, setSourceOther] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [goalsOther, setGoalsOther] = useState("");

  // Profil
  const [firstName, setFirstName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<UStatus>("idle");
  const [savingU, setSavingU] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  // Gdy pole "Inne" (input) jest w fokusie -> chowamy guzik t("cta.next") (nie zaslania klawiatury).
  // Guzik CTA chowamy, gdy kursor stoi w JAKIMKOLWIEK polu tekstowym - klawiatura podnosi
  // uklad i guzik ladowal na polu, ktore user wlasnie wypelnia (zgloszenie Nat 2026-09-06).
  const [inputFocused, setInputFocused] = useState(false);
  const focusProps = { onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false) };
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill z profilu (OAuth nadaje wstepny username/avatar/first_name).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username, avatar_url, first_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        // Nazwy uzytkownika CELOWO nie podstawiamy z profilu (prosba Nat 2026-09-06):
        // OAuth wstawia tam automat typu "user_3f2a1b" albo adres maila, a user i tak
        // musi ja swiadomie wybrac - pole ma byc puste, nie do wyczyszczenia.
        if ((data as any).avatar_url) setAvatarUrl((data as any).avatar_url);
        if ((data as any).first_name) setFirstName((data as any).first_name);
      });
    // home_city osobno (best-effort - kolumna moze wymagac migracji, nie psuj prefilla).
    (supabase as any).from("profiles").select("home_city").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (cancelled || !data?.home_city) return;
        setHomeCity(data.home_city);
        // Kraj wyliczamy z miasta, inaczej lista miast bylaby pusta mimo wypelnionego profilu.
        const c = countryForCity(data.home_city);
        if (c) setHomeCountry(c);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Dostepnosc username (debounce). Wlasny username nie liczy sie jako zajety.
  useEffect(() => {
    if (stepName !== "username") return;
    const v = username.trim();
    if (v.length === 0) { setUStatus("idle"); return; }
    if (v.length < 2) { setUStatus("short"); return; }
    setUStatus("checking");
    const tmr = setTimeout(async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("id")
          .ilike("username", escapeLike(v)).neq("id", user?.id ?? "").limit(1);
        if (error) { setUStatus("ok"); return; }
        setUStatus(data && data.length > 0 ? "taken" : "ok");
      } catch { setUStatus("ok"); }
    }, 400);
    return () => clearTimeout(tmr);
  }, [username, stepName, user]);

  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const toggleGoal = (id: string) =>
    setGoals((g) => g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);

  // Zapis username + imie (krok "username").
  const saveUsername = async () => {
    if (!user || uStatus !== "ok" || savingU) return;
    setSavingU(true);
    const { error } = await supabase.from("profiles")
      .update({ username: username.trim(), first_name: firstName.trim() || null } as any)
      .eq("id", user.id);
    setSavingU(false);
    if (error) {
      if ((error as any).code === "23505") { setUStatus("taken"); return; }
      toast.error(t("toast.name_failed"));
      return;
    }
    goNext();
  };

  // Avatar -> bucket "avatars" (1:1 z ProfileSetup).
  const uploadBlob = async (blob: Blob, ext: string, contentType: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const fileName = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, blob, { upsert: true, contentType });
      await uploadThumb("avatars", fileName, blob);
      if (upErr) { toast.error(t("toast.photo_failed")); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const busted = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: busted } as any).eq("id", user.id);
      setAvatarUrl(busted);
    } finally { setUploading(false); }
  };

  const pickAvatar = async () => {
    if (uploading) return;
    if (isNative) {
      try {
        const photo = await CapCamera.getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Photos, quality: 80, width: 600, height: 600 });
        if (!photo.webPath) return;
        const blob = await (await fetch(photo.webPath)).blob();
        const ext = (photo.format || "jpeg").replace("jpg", "jpeg");
        await uploadBlob(blob, ext === "jpeg" ? "jpg" : ext, blob.type || `image/${ext}`);
      } catch { /* anulowano */ }
    } else {
      fileRef.current?.click();
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    await uploadBlob(f, ext, f.type || "image/jpeg");
  };

  // Finalizacja: zapis ankiety (best-effort), onboarding_completed, sygnal coach-marków.
  const finish = useCallback(async () => {
    if (!user || finishing) return;
    setFinishing(true);
    // Ankieta -> onboarding_responses (best-effort: gdyby tabeli jeszcze nie bylo, nie blokuj).
    try {
      await (supabase as any).from("onboarding_responses").upsert({
        user_id: user.id,
        referral_source: source,
        referral_other: source === "other" ? (sourceOther.trim() || null) : null,
        goals,
        goals_other: goals.includes("other") ? (goalsOther.trim() || null) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch (e) { console.warn("[onboarding] zapis ankiety nieudany (uruchom migracje?):", e); }
    // PostHog (dziala tylko po opt-in zgody cookie).
    try {
      (window as any).posthog?.capture?.("onboarding_completed", {
        source, goals,
      });
    } catch { /* ignore */ }
    await supabase.from("profiles").update({ onboarding_completed: true, terms_accepted_at: new Date().toISOString() } as any).eq("id", user.id);
    // Sygnal dla Czesci B (coach-marki): flaga + event, ktory OnboardingProvider lapie.
    try { localStorage.setItem(COACH_PENDING_KEY, "1"); } catch { /* unavailable */ }
    onDone();
    try { window.dispatchEvent(new CustomEvent("spontaway:start-coach")); } catch { /* ignore */ }
  }, [user, finishing, source, sourceOther, goals, goalsOther, onDone]);

  // ── Zgody / uprawnienia ──
  const allowNotifications = async () => {
    if (permBusy) return;
    setPermBusy(true);
    try {
      if (isNative) await requestAndRegisterNativePush(user?.id ?? null);
      else if ("Notification" in window) { try { await Notification.requestPermission(); } catch { /* ignore */ } }
    } finally { setPermBusy(false); goNext(); }
  };

  const allowLocation = async () => {
    if (permBusy) return;
    setPermBusy(true);
    try { await requestLocation(); } catch { /* odmowa/blad - nie blokuj */ } finally { setPermBusy(false); goNext(); }
  };

  // Zgoda na analityke: opt-in/opt-out PostHog (+ zapis do profilu przez consent.ts).
  const acceptTracking = async () => {
    if (finishing) return;
    try { await grantConsent(); } catch { /* ignore */ }
    finish();
  };
  const declineTracking = async () => {
    if (finishing) return;
    try { denyConsent(); } catch { /* ignore */ }
    finish();
  };

  // Akceptacja regulaminu (EULA) - wymog App Store dla aplikacji z trescia od uzytkownikow.
  // Bez zaznaczenia nie da sie przejsc dalej; date zapisujemy w profiles.terms_accepted_at.
  const [termsAccepted, setTermsAccepted] = useState(false);

  // CTA per krok
  const canNext =
    stepName === "welcome" ? termsAccepted :
    stepName === "source" ? (!!source && (source !== "other" || sourceOther.trim().length > 0)) :
    stepName === "goals" ? (goals.length > 0 && (!goals.includes("other") || goalsOther.trim().length > 0)) :
    stepName === "username" ? (uStatus === "ok" && firstName.trim().length >= 2 && !savingU) :
    true; // avatar - opcjonalny

  // Zapis miasta zamieszkania (best-effort - kolumna home_city moze wymagac migracji).
  const saveHomeCity = async () => {
    if (user && homeCity.trim()) {
      try { await (supabase as any).from("profiles").update({ home_city: homeCity.trim() }).eq("id", user.id); }
      catch { /* migracja jeszcze niewklejona - nie blokuj */ }
    }
    goNext();
  };

  const onPrimary = () => {
    if (stepName === "welcome" || stepName === "source" || stepName === "goals" || stepName === "avatar") goNext();
    else if (stepName === "username") saveUsername();
    else if (stepName === "home") saveHomeCity();
    else if (stepName === "notify") allowNotifications();
    else if (stepName === "location") allowLocation();
    else if (stepName === "tracking") acceptTracking();
  };

  const primaryLabel =
    stepName === "welcome" ? t("cta.start") :
    stepName === "notify" ? t("cta.enable_notifications") :
    stepName === "location" ? t("cta.enable_location") :
    stepName === "tracking" ? t("cta.agree") :
    t("cta.next");

  return (
    <div className="fixed inset-0 z-[71] bg-[#FEFEFE] flex flex-col">
      <style>{`@keyframes onb-screenfade{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* Top: wstecz + pasek postepu */}
      <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button
          onClick={goBack}
          aria-label="Wstecz"
          disabled={step === 0}
          className={`h-9 w-9 -ml-1 flex items-center justify-center rounded-full text-foreground active:bg-muted ${step === 0 ? "opacity-0 pointer-events-none" : ""}`}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-orange-600 rounded-full transition-all duration-300" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="h-9 w-9" />
      </div>

      {/* Tresc kroku */}
      <div key={step} className="flex-1 min-h-0 flex flex-col px-7 overflow-y-auto" style={{ animation: "onb-screenfade 0.3s ease-out" }}>
        {stepName === "welcome" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <TrasaLogo size={84} className="mb-6" />
            <h2 className="text-2xl font-black mb-3 leading-tight">{nbsp(t("welcome.title"))}</h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs">
              {nbsp(t("welcome.body"))}
            </p>
            {/* Akceptacja regulaminu - wymog App Store (Guideline 1.2) przy tresciach userow. */}
            <button
              type="button"
              onClick={() => setTermsAccepted((v) => !v)}
              className="mt-8 flex items-start gap-3 text-left max-w-xs active:opacity-70 transition-opacity"
            >
              <span className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${termsAccepted ? "bg-orange-600 border-orange-600" : "border-border bg-background"}`}>
                {termsAccepted && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[13px] text-muted-foreground leading-relaxed">
                {/* Zdanie z DWOMA linkami w srodku - <Trans>, bo szyk zdania i miejsce linkow
                    rozni sie miedzy jezykami; sklejanie kawalkow po polsku dawaloby po
                    angielsku bezsens. */}
                <Trans
                  i18nKey="terms.consent"
                  ns="onboarding"
                  components={{
                    terms: <Link to="/terms" onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground underline" />,
                    privacy: <Link to="/privacy" onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground underline" />,
                  }}
                />
              </span>
            </button>
          </div>
        )}

        {stepName === "source" && (
          <>
            <div className="pt-6">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("source.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("source.desc"))}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {SOURCE_OPTS.map((o) => {
                const active = source === o.id;
                if (o.id === "other" && active) {
                  return (
                    <div key={o.id} className="w-full rounded-2xl border-2 border-orange-500 bg-white px-4 py-3 flex items-center gap-2">
                      <input
                        autoFocus
                        value={sourceOther}
                        onChange={(e) => setSourceOther(capWords(e.target.value, 10))}
                        {...focusProps}
                        placeholder={t("source.other_placeholder")}
                        className="flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
                      />
                      <span className="h-6 w-6 rounded-full bg-orange-600 flex items-center justify-center shrink-0"><Check className="h-4 w-4 text-white" strokeWidth={3} /></span>
                    </div>
                  );
                }
                return (
                  <button
                    key={o.id}
                    onClick={() => setSource(o.id)}
                    className="w-full text-left px-4 py-3.5 rounded-2xl border border-border bg-white text-foreground text-[15px] font-semibold flex items-center justify-between active:scale-[0.99] transition-transform"
                  >
                    <span>{t(o.labelKey)}</span>
                    <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", active ? "bg-orange-600 border-orange-600" : "border-muted-foreground/30")}>
                      {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {stepName === "goals" && (
          <>
            <div className="pt-6">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("goals.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("goals.desc"))}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {GOAL_OPTS.map((o) => {
                const active = goals.includes(o.id);
                if (o.id === "other" && active) {
                  return (
                    <div key={o.id} className="w-full rounded-2xl border-2 border-orange-500 bg-white px-4 py-3 flex items-center gap-2">
                      <input
                        autoFocus
                        value={goalsOther}
                        onChange={(e) => setGoalsOther(capWords(e.target.value, 10))}
                        {...focusProps}
                        placeholder={t("goals.other_placeholder")}
                        className="flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
                      />
                      <button onClick={() => toggleGoal(o.id)} aria-label="Odznacz" className="h-6 w-6 rounded-md bg-orange-600 flex items-center justify-center shrink-0"><Check className="h-4 w-4 text-white" strokeWidth={3} /></button>
                    </div>
                  );
                }
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleGoal(o.id)}
                    className="w-full text-left px-4 py-3.5 rounded-2xl border border-border bg-white text-foreground text-[15px] font-semibold flex items-center justify-between active:scale-[0.99] transition-transform"
                  >
                    <span>{t(o.labelKey)}</span>
                    <span className={cn("h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors", active ? "bg-orange-600 border-orange-600" : "border-muted-foreground/30")}>
                      {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {stepName === "username" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("name.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("name.desc"))}</p>
            </div>
            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 px-1">{t("name.first_label")}</label>
                <div className="rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                  <input
                    value={firstName}
                    {...focusProps}
                    onChange={(e) => setFirstName(e.target.value.slice(0, 40))}
                    autoCapitalize="words"
                    autoCorrect="off"
                    placeholder={t("name.first_placeholder")}
                    className="w-full bg-transparent py-3.5 px-1 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <label className="block text-sm font-semibold">{t("name.username_label")}</label>
                  <span className="text-xs text-muted-foreground">{username.length}/{USERNAME_MAX}</span>
                </div>
                <div className="flex items-center rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                  <span className="text-muted-foreground text-lg select-none">@</span>
                  <input
                    value={username}
                    {...focusProps}
                    onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={USERNAME_MAX}
                    placeholder="nazwa"
                    className="flex-1 bg-transparent py-3.5 px-1 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                  {uStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {uStatus === "ok" && <Check className="h-5 w-5 text-green-600" />}
                </div>
                <div className="h-6 mt-2 px-1 text-sm">
                  {uStatus === "ok" && <span className="text-green-600 font-medium">{t("name.username_free")}</span>}
                  {uStatus === "taken" && <span className="text-red-600 font-medium">{t("name.username_taken")}</span>}
                  {uStatus === "short" && <span className="text-muted-foreground">Minimum 2 znaki</span>}
                </div>
              </div>
            </div>
          </>
        )}

        {stepName === "avatar" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("photo.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("photo.desc"))}</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <button onClick={pickAvatar} className="relative active:scale-[0.98] transition-transform" aria-label={t("photo.pick")}>
                <div className="h-40 w-40 rounded-full overflow-hidden flex items-center justify-center bg-orange-100">
                  <img src={avatarSrc(avatarUrl)} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="absolute bottom-1 right-1 h-12 w-12 rounded-full bg-orange-600 border-4 border-[#FEFEFE] flex items-center justify-center shadow-md">
                  {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />}
                </div>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </>
        )}

        {stepName === "home" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("city.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("city.desc"))}</p>
            </div>
            {/* Kraj -> miasta z listy (prosba Nat 2026-09-06). Wolne pole zostawialo literowki
                i warianty ("wawa", "Warszawa "), przez ktore podpowiadanie tras po miescie
                nie mialo sie z czym zgodzic. Lista miast jest skrocona, wiec zostaje tez
                mozliwosc wpisania recznie. */}
            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 px-1">{t("city.country_label")}</label>
                <div className="rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                  <select
                    value={homeCountry}
                    onChange={(e) => { setHomeCountry(e.target.value); setHomeCity(""); }}
                    className="w-full bg-transparent py-3.5 px-1 text-lg outline-none text-foreground appearance-none"
                  >
                    <option value="">{t("city.country_placeholder")}</option>
                    {TRIP_COUNTRIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 px-1">{t("city.city_label")}</label>
                {!homeCountry ? (
                  <p className="px-1 text-sm text-muted-foreground">{t("city.city_hint")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {citiesForCountry(homeCountry).map((c) => {
                        const on = homeCity === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setHomeCity(on ? "" : c)}
                            className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors active:scale-[0.97] ${
                              on ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white text-foreground border-border"}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-4 px-1 text-xs text-muted-foreground">{t("city.not_listed")}</p>
                    <div className="mt-2 rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                      <input
                        value={citiesForCountry(homeCountry).includes(homeCity) ? "" : homeCity}
                        {...focusProps}
                        onChange={(e) => setHomeCity(e.target.value.slice(0, 60))}
                        autoCapitalize="words"
                        autoCorrect="off"
                        placeholder={t("city.city_manual_placeholder")}
                        className="w-full bg-transparent py-3.5 px-1 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {stepName === "notify" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-black mb-3 leading-tight">{nbsp(t("notify.title"))}</h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs">{nbsp(t("notify.desc"))}</p>
          </div>
        )}

        {stepName === "location" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("location.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(t("location.desc"))}</p>
            </div>
            {/* Podglad listy miejsc (UI listy z aplikacji) - ilustracja "posortowane po odleglosci". */}
            <div className="mt-6 flex flex-col gap-2.5">
              {SAMPLE_NEARBY.map((p) => (
                <div key={p.name} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2.5">
                  <div className="h-12 w-12 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                    <CategoryIcon category={p.cat} className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{tCat(`sub.${p.cat}`)}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">{p.dist}</span>
                </div>
              ))}
            </div>
            <div className="flex-1" />
          </>
        )}

        {stepName === "tracking" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(t("tracking.title"))}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Zbieramy anonimowe dane o tym, jak korzystasz z aplikacji (np. które ekrany odwiedzasz), żeby ją rozwijać. Nie sprzedajemy Twoich danych. Zgodę zmienisz w każdej chwili w ustawieniach.")}</p>
            </div>
            {/* Placeholder ikony - nat doda custom ikone do tego widoku. */}
            <div className="flex-1 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-[#fcede3] flex items-center justify-center">
                <img src="/Ikona_Eksploracja.svg" alt="" className="h-11 w-11" draggable={false} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* CTA - solidny pomaranczowy guzik (bez gradientu). Chowany gdy input "Inne" w fokusie. */}
      {!inputFocused && (
      <div className="px-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <button
          onClick={onPrimary}
          disabled={!canNext || permBusy || (stepName === "tracking" && finishing)}
          className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {(savingU || permBusy || (stepName === "tracking" && finishing))
            ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            : primaryLabel}
        </button>
        {stepName === "avatar" && (
          <button onClick={goNext} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">{t("cta.skip")}</button>
        )}
        {(stepName === "notify" || stepName === "location") && (
          <button onClick={goNext} disabled={permBusy} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">{t("cta.not_now")}</button>
        )}
        {stepName === "tracking" && (
          <button onClick={declineTracking} disabled={finishing} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">{t("cta.not_now")}</button>
        )}
      </div>
      )}
    </div>
  );
};

// Bramka: pokazuj Czesc A zalogowanemu (real, nie-anon) userowi na NATIVE, ktory nie
// ukonczyl onboardingu (profiles.onboarding_completed falsy). Web B2C jest za waitlista.
export function useOnboardingGate() {
  const { user, isAnonymous } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user || isAnonymous || !isNative) { setShow(false); return; }
    let cancelled = false;
    supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data && !(data as any).onboarding_completed) setShow(true);
      });
    return () => { cancelled = true; };
  }, [user, isAnonymous]);
  return { show, hide: useCallback(() => setShow(false), []) };
}

export default OnboardingFlow;
