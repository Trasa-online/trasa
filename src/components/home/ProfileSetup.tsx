import { useState, useEffect, useRef, useCallback } from "react";
import { avatarSrc } from "@/lib/avatar";
import { ArrowLeft, Check, Plus, Bell, Loader2 } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { requestAndRegisterNativePush } from "@/hooks/useNativePush";
import { ORIGIN_COUNTRIES, citiesForCountry } from "@/lib/locations";

// Polskie sieroty: po pojedynczych literach (a i o u w z) twarda spacja.
const nbsp = (s: string) => s.replace(/ ([aiouwzAIOUWZ]) /g, (_m, l) => " " + l + String.fromCharCode(160));

// Setup profilu po pierwszym zalogowaniu: username -> awatar (BEZ bio) -> powiadomienia.
// Osobny etap od intro-tour (HomeTour). Tlo #FEFEFE + pomaranczowy brand B2C
// (NIE ciemne/zolte z referencji - to brand innej apki).
const STEPS = ["username", "avatar", "origin", "notify"] as const;
type Step = typeof STEPS[number];

type UStatus = "idle" | "short" | "checking" | "ok" | "taken" | "invalid";

interface ProfileSetupProps { onDone: () => void; }

const sanitizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 24);
// Escape wildcardow ILIKE (_ i %), zeby porownanie bylo doslowne.
const escapeLike = (v: string) => v.replace(/[%_\\]/g, "\\$&");

const ProfileSetup = ({ onDone }: ProfileSetupProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const stepName: Step = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const [username, setUsername] = useState("");
  const [uStatus, setUStatus] = useState<UStatus>("idle");
  const [savingU, setSavingU] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [homeCountry, setHomeCountry] = useState("Polska");
  const [homeCity, setHomeCity] = useState("");
  const [savingOrigin, setSavingOrigin] = useState(false);

  const [notifLoading, setNotifLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Prefill z istniejacego profilu (OAuth nadaje wstepny username + ewentualny avatar).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if ((data as any).username) setUsername(sanitizeUsername((data as any).username));
        if ((data as any).avatar_url) setAvatarUrl((data as any).avatar_url);
      });
    // home_country/home_city osobnym selectem (best-effort) - gdyby kolumn jeszcze nie
    // bylo (przed migracja), nie psuje to prefilla username/avatar.
    (supabase as any).from("profiles").select("home_country, home_city").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (cancelled || !data) return;
        if (data.home_country) setHomeCountry(data.home_country);
        if (data.home_city) setHomeCity(data.home_city);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Walidacja + dostepnosc username (debounce). Wlasny username nie liczy sie jako zajety.
  useEffect(() => {
    if (stepName !== "username") return;
    const v = username.trim();
    if (v.length === 0) { setUStatus("idle"); return; }
    if (v.length < 2) { setUStatus("short"); return; }
    setUStatus("checking");
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", escapeLike(v))
          .neq("id", user?.id ?? "")
          .limit(1);
        if (error) { setUStatus("ok"); return; } // nie blokuj na bledzie sieci
        setUStatus(data && data.length > 0 ? "taken" : "ok");
      } catch { setUStatus("ok"); }
    }, 400);
    return () => clearTimeout(t);
  }, [username, stepName, user]);

  const goNext = () => { if (isLast) finish(); else setStep((s) => s + 1); };
  const goBack = () => { if (step > 0) setStep((s) => s - 1); };

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    if (user) {
      await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
    }
    onDone();
  }, [user, finishing, onDone]);

  // ── Username: zapis + dalej ──
  const saveUsername = async () => {
    if (!user || uStatus !== "ok" || savingU) return;
    setSavingU(true);
    const { error } = await supabase.from("profiles").update({ username: username.trim() } as any).eq("id", user.id);
    setSavingU(false);
    if (error) {
      // unique violation -> zajety
      if ((error as any).code === "23505") { setUStatus("taken"); return; }
      toast.error("Nie udało się zapisać nazwy");
      return;
    }
    goNext();
  };

  // ── Skąd jesteś: zapis kraj + miasto rodzime ──
  const saveOrigin = async () => {
    if (!user || savingOrigin) return;
    setSavingOrigin(true);
    const { error } = await (supabase as any).from("profiles")
      .update({ home_country: homeCountry || null, home_city: homeCity || null }).eq("id", user.id);
    setSavingOrigin(false);
    // Best-effort: gdyby kolumny jeszcze nie bylo (przed migracja), nie blokuj usera.
    if (error) console.warn("[ProfileSetup] zapis 'skąd jesteś' nieudany (uruchom migracje?):", error.message);
    goNext();
  };

  // ── Avatar: upload do bucketa "avatars" (jak TravelerProfile) ──
  const uploadBlob = async (blob: Blob, ext: string, contentType: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const fileName = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, blob, { upsert: true, contentType });
      if (upErr) { toast.error("Nie udało się przesłać zdjęcia"); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const busted = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: busted } as any).eq("id", user.id);
      setAvatarUrl(busted);
    } finally {
      setUploading(false);
    }
  };

  const pickAvatar = async () => {
    if (uploading) return;
    if (isNative) {
      try {
        const photo = await CapCamera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
          quality: 80,
          width: 600,
          height: 600,
        });
        if (!photo.webPath) return;
        const res = await fetch(photo.webPath);
        const blob = await res.blob();
        const ext = (photo.format || "jpeg").replace("jpg", "jpeg");
        await uploadBlob(blob, ext === "jpeg" ? "jpg" : ext, blob.type || `image/${ext}`);
      } catch { /* anulowano wybor */ }
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

  // ── Powiadomienia ──
  const allowNotifications = async () => {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      if (isNative) {
        const result = await requestAndRegisterNativePush(user?.id ?? null);
        if (result === "denied") {
          toast("Powiadomienia możesz włączyć później w ustawieniach", { icon: "🔔" });
        }
      } else if ("Notification" in window) {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
    } finally {
      setNotifLoading(false);
      finish();
    }
  };

  // CTA per krok
  const primaryDisabled =
    (stepName === "username" && uStatus !== "ok") ||
    (stepName === "username" && savingU) ||
    (stepName === "origin" && (!homeCity || savingOrigin)) ||
    (stepName === "notify" && (notifLoading || finishing));
  const primaryLabel =
    stepName === "username" ? "Dalej" :
    stepName === "avatar" ? "Dalej" :
    stepName === "origin" ? "Dalej" :
    "Pozwól na powiadomienia";
  const onPrimary =
    stepName === "username" ? saveUsername :
    stepName === "avatar" ? goNext :
    stepName === "origin" ? saveOrigin :
    allowNotifications;

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
        {/* placeholder symetrii do strzalki (zamiast Pomin - setup jest krotki i wymagany) */}
        <div className="h-9 w-9" />
      </div>

      {/* Tresc kroku */}
      <div key={step} className="flex-1 min-h-0 flex flex-col px-7 overflow-y-auto" style={{ animation: "onb-screenfade 0.3s ease-out" }}>
        {stepName === "username" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Wybierz nazwę użytkownika")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Twój @username jest unikalny. Później możesz go zmienić.")}</p>
            </div>
            <div className="mt-8">
              <div className="flex items-center rounded-2xl border border-border bg-white px-4 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
                <span className="text-muted-foreground text-lg select-none">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  placeholder="nazwa"
                  className="flex-1 bg-transparent py-3.5 px-1 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
                />
                {uStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {uStatus === "ok" && <Check className="h-5 w-5 text-green-600" />}
              </div>
              <div className="h-6 mt-2 px-1 text-sm">
                {uStatus === "ok" && <span className="text-green-600 font-medium">Nazwa dostępna</span>}
                {uStatus === "taken" && <span className="text-red-600 font-medium">Ta nazwa jest zajęta</span>}
                {uStatus === "short" && <span className="text-muted-foreground">Minimum 2 znaki</span>}
              </div>
            </div>
          </>
        )}

        {stepName === "avatar" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Dodaj zdjęcie profilowe")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Dzięki niemu znajomi łatwiej Cię rozpoznają. Możesz pominąć ten krok.")}</p>
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

        {stepName === "origin" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Skąd jesteś?")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Dzięki temu pokażemy, że polecasz miejsca jako lokals w swoim mieście.")}</p>
            </div>
            <div className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Kraj</label>
                <select
                  value={homeCountry}
                  onChange={(e) => { setHomeCountry(e.target.value); setHomeCity(""); }}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-orange-500/60"
                >
                  {ORIGIN_COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Miasto</label>
                <select
                  value={homeCity}
                  onChange={(e) => setHomeCity(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-orange-500/60"
                >
                  <option value="" disabled>Wybierz miasto</option>
                  {citiesForCountry(homeCountry).map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {stepName === "notify" && (
          <>
            <div className="pt-6 text-center">
              <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp("Bądź na bieżąco")}</h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp("Włącz powiadomienia, aby wiedzieć o dopasowaniach w grupie, nowych trasach i wiadomościach od znajomych.")}</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="h-32 w-32 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}>
                <Bell className="h-14 w-14 text-white" strokeWidth={2} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <button
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="w-full py-4 rounded-full text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: "linear-gradient(to right, #F4A259, #F9662B)" }}
        >
          {(savingU || savingOrigin || (stepName === "notify" && (notifLoading || finishing)))
            ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            : primaryLabel}
        </button>
        {/* sekundarne wyjscie tylko tam, gdzie krok jest opcjonalny */}
        {stepName === "avatar" && (
          <button onClick={goNext} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Pomiń</button>
        )}
        {stepName === "origin" && (
          <button onClick={goNext} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Pomiń</button>
        )}
        {stepName === "notify" && (
          <button onClick={finish} disabled={finishing} className="w-full py-3 mt-1 text-sm font-medium text-muted-foreground">Nie teraz</button>
        )}
      </div>
    </div>
  );
};

// Setup pokazujemy zalogowanemu userowi (NIE goscowi) ktory nie ukonczyl
// onboardingu. Goscie dostaja intro-tour (useHomeTour). Reset do testow:
// UPDATE profiles SET onboarding_completed=false WHERE id=... (patrz odpowiedz).
export const useProfileSetup = () => {
  const { user, isAnonymous } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!user || isAnonymous) return;
    let cancelled = false;
    supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data && !(data as any).onboarding_completed) setShowSetup(true);
      });
    return () => { cancelled = true; };
  }, [user, isAnonymous]);

  const finishSetup = () => {
    setShowSetup(false);
    if (user) supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", user.id);
  };

  return { showSetup, finishSetup };
};

export default ProfileSetup;
