import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";

// ── Swipe demo animation ──────────────────────────────────────────────────────

const SWIPE_CARDS = [
  { emoji: "🏰", name: "Wawel", city: "Kraków", liked: true },
  { emoji: "☕", name: "Kawiarnia Płyś", city: "Kraków", liked: true },
  { emoji: "🏛️", name: "Muzeum MOCAK", city: "Kraków", liked: false },
  { emoji: "🌊", name: "Molo w Sopocie", city: "Gdańsk", liked: true },
  { emoji: "🍕", name: "Pizzeria Dolabella", city: "Kraków", liked: true },
  { emoji: "🎨", name: "Galeria Bunkier Sztuki", city: "Kraków", liked: false },
];

type SwipePhase = "enter" | "show" | "exit";

const SwipeDemo = () => {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>("enter");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "enter") t = setTimeout(() => setPhase("show"), 420);
    else if (phase === "show") t = setTimeout(() => setPhase("exit"), 950);
    else t = setTimeout(() => { setIdx(i => (i + 1) % SWIPE_CARDS.length); setPhase("enter"); }, 460);
    return () => clearTimeout(t);
  }, [phase]);

  const card = SWIPE_CARDS[idx];

  const cardStyle: React.CSSProperties = (() => {
    if (phase === "enter") return {
      transform: "scale(0.86) translateY(18px)",
      opacity: 0,
      transition: "all 0.42s cubic-bezier(0.34,1.56,0.64,1)",
    };
    if (phase === "exit") return {
      transform: card.liked
        ? "scale(1.04) rotate(14deg) translateX(160%)"
        : "scale(1.04) rotate(-14deg) translateX(-160%)",
      opacity: 0,
      transition: "all 0.44s cubic-bezier(0.55,0,1,0.45)",
    };
    return {
      transform: "scale(1) rotate(0deg) translateX(0)",
      opacity: 1,
      transition: "all 0.42s cubic-bezier(0.34,1.56,0.64,1)",
    };
  })();

  return (
    <div className="relative h-52 w-44 mx-auto select-none">
      {/* Stack cards behind */}
      <div className="absolute inset-0 rounded-2xl bg-card border border-border/30 shadow-sm"
        style={{ transform: "scale(0.90) translateY(10px)", zIndex: 0 }} />
      <div className="absolute inset-0 rounded-2xl bg-card border border-border/40 shadow-sm"
        style={{ transform: "scale(0.95) translateY(5px)", zIndex: 1 }} />

      {/* Active card */}
      <div
        style={{ ...cardStyle, zIndex: 2, position: "absolute", inset: 0 }}
        className="rounded-2xl bg-card border border-border/60 shadow-lg flex flex-col items-center justify-center gap-3 p-5"
      >
        <div className="text-5xl">{card.emoji}</div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground leading-tight">{card.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{card.city}</p>
        </div>

        {/* Like / skip badge shown during exit */}
        {phase === "exit" && (
          <div className={cn(
            "absolute top-3 rounded-full px-2.5 py-1 text-xs font-black border-2",
            card.liked
              ? "right-3 bg-green-50 text-green-600 border-green-400"
              : "left-3 bg-red-50 text-red-500 border-red-400"
          )}>
            {card.liked ? "💛 TAK" : "✕ NIE"}
          </div>
        )}
      </div>

      {/* Thumb hint arrows */}
      <div className="absolute -bottom-7 left-0 right-0 flex justify-between px-2 text-[11px] text-muted-foreground/60 font-medium">
        <span>✕ pomiń</span>
        <span>polub 💛</span>
      </div>
    </div>
  );
};

const Orb = ({
  isSpeaking,
  className,
  onTap,
  ariaLabel,
}: {
  isSpeaking: boolean;
  className?: string;
  onTap?: () => void;
  ariaLabel: string;
}) => (
  <button
    type="button"
    onClick={onTap}
    className={cn("relative focus:outline-none", className)}
    aria-label={ariaLabel}
  >
    {isSpeaking && (
      <>
        <div
          className="absolute inset-0 rounded-full orb-ripple"
          style={{ background: "linear-gradient(135deg, #F9662B, #FF8C42, #D45113)", opacity: 0.3 }}
        />
        <div
          className="absolute inset-0 rounded-full orb-ripple-delay"
          style={{ background: "linear-gradient(135deg, #F9662B, #FF8C42, #D45113)", opacity: 0.15 }}
        />
      </>
    )}
    <div className={cn("w-full h-full rounded-full orb-gradient", isSpeaking && "orb-speaking")} />
  </button>
);

const Chip = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
      selected
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-foreground border-border hover:bg-muted"
    )}
  >
    {label}
  </button>
);

const Section = ({
  title,
  items,
  selected,
  onToggle,
  customItems,
  onAddCustom,
  onRemoveCustom,
  otherPlaceholder,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  customItems: string[];
  onAddCustom: (val: string) => void;
  onRemoveCustom: (val: string) => void;
  otherPlaceholder: string;
}) => {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !customItems.includes(trimmed)) {
      onAddCustom(trimmed);
    }
    setInputVal("");
    inputRef.current?.focus();
  };

  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={selected.has(item.id)}
            onClick={() => onToggle(item.id)}
          />
        ))}
        {customItems.map((val) => (
          <Chip
            key={val}
            label={val}
            selected
            onClick={() => onRemoveCustom(val)}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          ref={inputRef}
          placeholder={otherPlaceholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 h-9 text-sm bg-card"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputVal.trim()}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  const INTRO_STEPS = [
    {
      title: t("intro.step0.title"),
      subtitle: t("intro.step0.subtitle"),
      speech: t("intro.step0.speech"),
      visual: "orb" as const,
    },
    {
      title: t("intro.step1.title"),
      subtitle: t("intro.step1.subtitle"),
      speech: t("intro.step1.speech"),
      visual: "swipe" as const,
    },
    {
      title: t("intro.step2.title"),
      subtitle: t("intro.step2.subtitle"),
      speech: t("intro.step2.speech"),
      visual: "orb" as const,
    },
  ];

  const FOOD_PREFS = [
    { id: "vege", label: t("prefs.food.vege") },
    { id: "vegan", label: t("prefs.food.vegan") },
    { id: "coffee", label: t("prefs.food.coffee") },
    { id: "local_food", label: t("prefs.food.local_food") },
    { id: "street_food", label: t("prefs.food.street_food") },
    { id: "fine_dining", label: t("prefs.food.fine_dining") },
    { id: "lactose_free", label: t("prefs.food.lactose_free") },
    { id: "gluten_free", label: t("prefs.food.gluten_free") },
  ];

  const INTERESTS = [
    { id: "history", label: t("prefs.interests.history") },
    { id: "art", label: t("prefs.interests.art") },
    { id: "nature", label: t("prefs.interests.nature") },
    { id: "shopping", label: t("prefs.interests.shopping") },
    { id: "nightlife", label: t("prefs.interests.nightlife") },
    { id: "photography", label: t("prefs.interests.photography") },
    { id: "architecture", label: t("prefs.interests.architecture") },
    { id: "music", label: t("prefs.interests.music") },
  ];

  const TRAVEL_STYLE = [
    { id: "intensive", label: t("prefs.style.intensive") },
    { id: "relaxed", label: t("prefs.style.relaxed") },
    { id: "family", label: t("prefs.style.family") },
    { id: "romantic", label: t("prefs.style.romantic") },
    { id: "budget", label: t("prefs.style.budget") },
    { id: "luxury", label: t("prefs.style.luxury") },
  ];

  const PREFS_SPEECH = t("prefs_speech");

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<string>("");
  const isSpeaking = false;
  const [freeText, setFreeText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recogRef = useRef<any>(null);
  const [foodSelected, setFoodSelected] = useState<Set<string>>(new Set());
  const [interestsSelected, setInterestsSelected] = useState<Set<string>>(new Set());
  const [styleSelected, setStyleSelected] = useState<Set<string>>(new Set());
  const [foodCustom, setFoodCustom] = useState<string[]>([]);
  const [interestsCustom, setInterestsCustom] = useState<string[]>([]);
  const [styleCustom, setStyleCustom] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const speak = useCallback(async (_text: string) => {
    // Voice disabled
  }, []);



  const handleToggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recogRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recog = new SR();
    recog.lang = i18n.language === "pl" ? "pl-PL" : "en-US";
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (e: any) => {
      setFreeText(e.results[0][0].transcript);
    };
    recog.onend = () => setIsListening(false);
    recog.onerror = () => setIsListening(false);
    recog.start();
    recogRef.current = recog;
    setIsListening(true);
  };

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async (skip = false) => {
    setSaving(true);
    window.speechSynthesis.cancel();
    recogRef.current?.stop();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      await supabase.from("profiles").update({
        ...(firstName.trim() ? { first_name: firstName.trim() } as any : {}),
        ...(gender ? { gender } as any : {}),
        dietary_prefs: skip ? [] : [...Array.from(foodSelected), ...foodCustom],
        travel_interests: skip ? [] : [
          ...Array.from(interestsSelected),
          ...interestsCustom,
          ...Array.from(styleSelected),
          ...styleCustom,
          ...(freeText.trim() ? [freeText.trim()] : []),
        ],
        onboarding_completed: true,
      }).eq("id", user.id);

      queryClient.setQueryData(["profile", user.id], (old: any) =>
        old ? { ...old, onboarding_completed: true } : old
      );
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
    navigate("/");
  };

  // ── Intro screens (steps 0–2) ─────────────────────────────────────────────
  if (step < INTRO_STEPS.length) {
    const screen = INTRO_STEPS[step];
    const nextStep = step + 1;
    const nextSpeech = nextStep < INTRO_STEPS.length ? INTRO_STEPS[nextStep].speech : PREFS_SPEECH;

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-10">
          {screen.visual === "swipe" ? (
            <SwipeDemo />
          ) : (
            <Orb
              isSpeaking={isSpeaking}
              className="h-32 w-32"
              onTap={() => speak(screen.speech)}
              ariaLabel={t("orb_label")}
            />
          )}
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight mb-3">{screen.title}</h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
              {screen.subtitle}
            </p>
            {screen.visual === "swipe" && (
              <button
                type="button"
                onClick={() => speak(screen.speech)}
                className="mt-4 text-xs text-muted-foreground/60 underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                🔊 {t("orb_label")}
              </button>
            )}
          </div>
        </div>

        <div className="px-6 pb-safe-4 pt-4 flex flex-col items-center gap-4">
          <Button
            onClick={() => { setStep(nextStep); speak(nextSpeech); }}
            className="w-full rounded-full font-semibold"
          >
            {step === INTRO_STEPS.length - 1 ? t("lets_go") : tCommon("buttons.next")}
          </Button>

          {step === 0 && (
            <button
              type="button"
              onClick={() => { setStep(INTRO_STEPS.length); speak(PREFS_SPEECH); }}
              className="text-sm text-muted-foreground py-1"
            >
              {tCommon("buttons.skip")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Preferences screen ────────────────────────────────────────────────────
  const hasSR = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex justify-center pt-10 pb-2">
        <Orb isSpeaking={isSpeaking} className="h-24 w-24" onTap={() => speak(PREFS_SPEECH)} ariaLabel={t("orb_label")} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32">
        <h1 className="text-2xl font-black tracking-tight mb-1">{t("prefs.title")}</h1>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          {t("prefs.subtitle")}
        </p>

        {/* First name */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Jak masz na imię?
          </p>
          <Input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="np. Marta"
            className="bg-card"
          />
          <p className="text-xs text-muted-foreground mt-2">Używane tylko w rozmowie z asystentem AI.</p>
        </div>

        {/* Gender */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Płeć
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "female", label: "Kobieta" },
              { id: "male", label: "Mężczyzna" },
              { id: "nonbinary", label: "Niebinarna/y" },
              { id: "prefer_not", label: "Wolę nie podawać" },
            ].map(opt => (
              <Chip
                key={opt.id}
                label={opt.label}
                selected={gender === opt.id}
                onClick={() => setGender(gender === opt.id ? "" : opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Free text / voice input */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("prefs.free_text_label")}
          </p>
          <div className="relative">
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t("prefs.free_text_placeholder")}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 pr-12 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {hasSR && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={cn(
                  "absolute right-2.5 bottom-2.5 h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  isListening
                    ? "bg-orange-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("prefs.tags_label")}</p>
        </div>

        <Section
          title={t("prefs.food_section")}
          items={FOOD_PREFS}
          selected={foodSelected}
          onToggle={(id) => toggle(setFoodSelected, id)}
          customItems={foodCustom}
          onAddCustom={(val) => setFoodCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setFoodCustom(prev => prev.filter(v => v !== val))}
          otherPlaceholder={tCommon("other")}
        />

        <Section
          title={t("prefs.interests_section")}
          items={INTERESTS}
          selected={interestsSelected}
          onToggle={(id) => toggle(setInterestsSelected, id)}
          customItems={interestsCustom}
          onAddCustom={(val) => setInterestsCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setInterestsCustom(prev => prev.filter(v => v !== val))}
          otherPlaceholder={tCommon("other")}
        />

        <Section
          title={t("prefs.style_section")}
          items={TRAVEL_STYLE}
          selected={styleSelected}
          onToggle={(id) => toggle(setStyleSelected, id)}
          customItems={styleCustom}
          onAddCustom={(val) => setStyleCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setStyleCustom(prev => prev.filter(v => v !== val))}
          otherPlaceholder={tCommon("other")}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-5 pt-4 pb-safe-4 flex flex-col gap-2">
        <Button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full rounded-full font-semibold"
        >
          {saving ? tCommon("buttons.saving") : t("prefs.save_btn")}
        </Button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="text-sm text-muted-foreground text-center py-1"
        >
          {tCommon("buttons.skip")}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
