import { useState, useEffect, useRef, useCallback } from "react";
import { avatarSrc } from "@/lib/avatar";
import { ArrowLeft, Check, Plus, Loader2 } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { requestAndRegisterNativePush } from "@/hooks/useNativePush";
import { requestLocation } from "@/hooks/useGeolocation";
import { grantConsent, denyConsent } from "@/lib/consent";
import TrasaLogo from "@/components/TrasaLogo";

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

const SOURCE_OPTS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "znajomi", label: "Od znajomych" },
  { id: "newonce", label: "newonce (radio/podcast)" },
  { id: "appstore", label: "App Store" },
  { id: "other", label: "Inne" },
];

const GOAL_OPTS = [
  { id: "odkrywanie", label: "Odkrywać nowe miejsca w mieście" },
  { id: "wyjazdy", label: "Planować wyjazdy i weekendy" },
  { id: "inspiracja", label: "Szukać inspiracji na wyjścia" },
  { id: "znajomi", label: "Podróżować ze znajomymi" },
  { id: "zapisywanie", label: "Zapisywać ulubione miejsca" },
  { id: "other", label: "Inne" },
];

const STEPS = ["welcome", "source", "goals", "username", "avatar", "notify", "location", "tracking"] as const;
type Step = typeof STEPS[number];
type UStatus = "idle" | "short" | "checking" | "ok" | "taken";

interface Props { onDone: () => void; }

const OnboardingFlow = ({ onDone }: Props) => {
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
  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<UStatus>("idle");
  const [savingU, setSavingU] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill z profilu (OAuth nadaje wstepny username/avatar/first_name).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username, avatar_url, first_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if ((data as any).username) setUsername(sanitizeUsername((data as any).username));
        if ((data as any).avatar_url) setAvatarUrl((data as any).avatar_url);
        if ((data as any).first_name) setFirstName((data as any).first_name);
      });
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
      toast.error("Nie udało się zapisać nazwy. Spróbuj ponownie.");
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
      if (upErr) { toast.error("Nie udało się wgrać zdjęcia."); return; }
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
    await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
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

  // CTA per krok
  const canNext =
    stepName === "welcome" ? true :
    stepName === "source" ? (!!source && (source !== "other" || sourceOther.trim().length > 0)) :
    stepName === "goals" ? (goals.length > 0 && (!goals.includes("other") || goalsOther.trim().length > 0)) :
    stepName === "username" ? (uStatus === "ok" && firstName.trim().length >= 2 && !savingU) :
    true; // avatar - opcjonalny

  const onPrimary = () => {
    if (stepName === "welcome" || stepName === "source" || stepName === "goals" || stepName === "avatar") goNext();
    else if (stepName === "username") saveUsername();
    else if (stepName === "notify") allowNotifications();
    else if (stepName === "location") allowLocation();
    else if (stepName === "tracking") acceptTracking();
  };

  const primaryLabel =
    stepName === "welcome" ? "Zaczynamy" :
    stepName === "notify" ? "Włącz powiadomienia" :
    stepName === "location" ? "Włącz lokalizację" :
    stepName === "tracking" ? "Zgadzam się" :
    "Dalej";

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
            <h2 className="text-2xl font-black mb-3 leading-tight">{nbsp("Cześć! Tu spontaway")}</h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-xs">
              {nbsp("speed dating z miastem. Odkrywaj trasy po mieście stworzone przez innych, zapisuj te które Cię inspirują i twórz własne. Pokażemy Ci to w kilka sekund.")}
            </p>
          </div>
        )}

        {stepName === "source" && (
          <>
            <div className="pt-6">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Skąd znasz spontaway?")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Wybierz jedno - pomoże nam docierać do kolejnych osób.")}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {SOURCE_OPTS.map((o) => {
                const active = source === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSource(o.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border text-[15px] font-semibold transition-colors flex items-center justify-between ${active ? "border-orange-500 bg-orange-50 text-foreground" : "border-border bg-white text-foreground"}`}
                  >
                    {o.label}
                    {active && <Check className="h-5 w-5 text-orange-600 shrink-0" />}
                  </button>
                );
              })}
              {source === "other" && (
                <input
                  autoFocus
                  value={sourceOther}
                  onChange={(e) => setSourceOther(e.target.value.slice(0, 80))}
                  placeholder="Wpisz, skąd znasz spontaway"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-orange-500/60"
                />
              )}
            </div>
          </>
        )}

        {stepName === "goals" && (
          <>
            <div className="pt-6">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("W jakim celu chcesz używać spontaway?")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Możesz zaznaczyć kilka.")}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {GOAL_OPTS.map((o) => {
                const active = goals.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleGoal(o.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border text-[15px] font-semibold transition-colors flex items-center justify-between ${active ? "border-orange-500 bg-orange-50 text-foreground" : "border-border bg-white text-foreground"}`}
                  >
                    {o.label}
                    {active && <Check className="h-5 w-5 text-orange-600 shrink-0" />}
                  </button>
                );
              })}
              {goals.includes("other") && (
                <input
                  autoFocus
                  value={goalsOther}
                  onChange={(e) => setGoalsOther(e.target.value.slice(0, 80))}
                  placeholder="Wpisz swój cel"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-[15px] outline-none focus:ring-2 focus:ring-orange-500/60"
                />
              )}
            </div>
          </>
        )}

        {stepName === "username" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Jak się nazywasz?")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Nazwa użytkownika będzie widoczna przy Twoich trasach.")}</p>
            </div>
            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 px-1">Imię</label>
                <div className="rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.slice(0, 40))}
                    autoCapitalize="words"
                    autoCorrect="off"
                    placeholder="Twoje imię"
                    className="w-full bg-transparent py-3.5 px-1 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <label className="block text-sm font-semibold">Nazwa użytkownika</label>
                  <span className="text-xs text-muted-foreground">{username.length}/{USERNAME_MAX}</span>
                </div>
                <div className="flex items-center rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                  <span className="text-muted-foreground text-lg select-none">@</span>
                  <input
                    value={username}
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
                  {uStatus === "ok" && <span className="text-green-600 font-medium">Nazwa dostępna</span>}
                  {uStatus === "taken" && <span className="text-red-600 font-medium">Ta nazwa jest już zajęta</span>}
                  {uStatus === "short" && <span className="text-muted-foreground">Minimum 2 znaki</span>}
                </div>
              </div>
            </div>
          </>
        )}

        {stepName === "avatar" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Dodaj swoje zdjęcie")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Nieobowiązkowe - ale trasy z awatarem budzą więcej zaufania.")}</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <button onClick={pickAvatar} className="relative active:scale-[0.98] transition-transform" aria-label="Wybierz zdjęcie">
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

        {stepName === "notify" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Bądź na bieżąco")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Włącz powiadomienia, żeby wiedzieć o nowych trasach i ważnych aktualizacjach. Zawsze możesz to wyłączyć w ustawieniach.")}</p>
            </div>
            <div className="flex-1" />
          </>
        )}

        {stepName === "location" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Miejsca blisko Ciebie")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Pozwól na dostęp do lokalizacji, żeby sortować miejsca według odległości od Ciebie. Nieobowiązkowe.")}</p>
            </div>
            <div className="flex-1" />
          </>
        )}

        {stepName === "tracking" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Pomóż nam ulepszać spontaway")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Zbieramy anonimowe dane o tym, jak korzystasz z aplikacji (np. które ekrany odwiedzasz), żeby ją rozwijać. Nie sprzedajemy Twoich danych. Zgodę zmienisz w każdej chwili w ustawieniach.")}</p>
            </div>
            <div className="flex-1" />
          </>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <button
          onClick={onPrimary}
          disabled={!canNext || permBusy || (stepName === "tracking" && finishing)}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: "linear-gradient(to right, #F4A259, #F9662B)" }}
        >
          {(savingU || permBusy || (stepName === "tracking" && finishing))
            ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            : primaryLabel}
        </button>
        {stepName === "avatar" && (
          <button onClick={goNext} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Pomiń</button>
        )}
        {(stepName === "notify" || stepName === "location") && (
          <button onClick={goNext} disabled={permBusy} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Nie teraz</button>
        )}
        {stepName === "tracking" && (
          <button onClick={declineTracking} disabled={finishing} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Nie teraz</button>
        )}
      </div>
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
