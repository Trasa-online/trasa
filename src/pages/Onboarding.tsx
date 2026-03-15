import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Mic, MicOff } from "lucide-react";

const FOOD_PREFS = [
  { id: "vege", label: "Wegetarianin" },
  { id: "vegan", label: "Vegan" },
  { id: "coffee", label: "Coffee snob" },
  { id: "local_food", label: "Kuchnia lokalna" },
  { id: "street_food", label: "Street food" },
  { id: "fine_dining", label: "Fine dining" },
  { id: "lactose_free", label: "Bez laktozy" },
  { id: "gluten_free", label: "Bezglutenowo" },
];

const INTERESTS = [
  { id: "history", label: "Historia" },
  { id: "art", label: "Sztuka" },
  { id: "nature", label: "Natura" },
  { id: "shopping", label: "Zakupy" },
  { id: "nightlife", label: "Nocne życie" },
  { id: "photography", label: "Fotografia" },
  { id: "architecture", label: "Architektura" },
  { id: "music", label: "Muzyka" },
];

const TRAVEL_STYLE = [
  { id: "intensive", label: "Intensywnie" },
  { id: "relaxed", label: "Spokojnie" },
  { id: "family", label: "Rodzinnie" },
  { id: "romantic", label: "Romantycznie" },
  { id: "budget", label: "Budżetowo" },
  { id: "luxury", label: "Luksusowo" },
];

const INTRO_STEPS = [
  {
    title: "Cześć!",
    subtitle: "Jestem Trasa — Twój osobisty asystent odkrywania Krakowa.",
    speech: "Cześć! Jestem Trasa — Twój osobisty asystent odkrywania Krakowa.",
  },
  {
    title: "Rozmawiasz — AI planuje",
    subtitle: "Powiedz mi co chcesz zobaczyć. W kilka sekund ułożę plan dopasowany dokładnie do Ciebie.",
    speech: "Rozmawiasz naturalnie, a ja planuję idealny dzień dla Ciebie.",
  },
  {
    title: "Uczę się Twoich gustów",
    subtitle: "Po każdej podróży poznaję Cię lepiej. Rekomendacje stają się coraz celniejsze.",
    speech: "Po każdej podróży uczę się Twoich gustów i polecam coraz trafniej.",
  },
];

const PREFS_SPEECH =
  "Zanim zaczniemy — opowiedz mi trochę o sobie, a dopasujemy plan podróży specjalnie dla Ciebie!";

const Orb = ({
  isSpeaking,
  className,
  onTap,
}: {
  isSpeaking: boolean;
  className?: string;
  onTap?: () => void;
}) => (
  <button
    type="button"
    onClick={onTap}
    className={cn("relative focus:outline-none", className)}
    aria-label="Powtórz"
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
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  customItems: string[];
  onAddCustom: (val: string) => void;
  onRemoveCustom: (val: string) => void;
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
          placeholder="Inne..."
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
  const [step, setStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pl-PL";
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const currentSpeech = step < INTRO_STEPS.length ? INTRO_STEPS[step].speech : PREFS_SPEECH;

  // Best-effort auto-speak on desktop (iOS requires user gesture, handled in click handlers)
  useEffect(() => {
    const timer = setTimeout(() => speak(currentSpeech), 600);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  const handleToggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (isListening) {
      recogRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recog = new SR();
    recog.lang = "pl-PL";
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
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-12">
          <Orb
            isSpeaking={isSpeaking}
            className="h-32 w-32"
            onTap={() => speak(screen.speech)}
          />
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight mb-3">{screen.title}</h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
              {screen.subtitle}
            </p>
          </div>
        </div>

        <div className="px-6 pb-safe-4 pt-4 flex flex-col items-center gap-4">
          <Button
            onClick={() => { setStep(nextStep); speak(nextSpeech); }}
            className="w-full rounded-full font-semibold"
          >
            {step === INTRO_STEPS.length - 1 ? "Zacznijmy!" : "Dalej"}
          </Button>

          {step === 0 && (
            <button
              type="button"
              onClick={() => { setStep(INTRO_STEPS.length); speak(PREFS_SPEECH); }}
              className="text-sm text-muted-foreground py-1"
            >
              Pomiń
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
        <Orb isSpeaking={isSpeaking} className="h-24 w-24" onTap={() => speak(PREFS_SPEECH)} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32">
        <h1 className="text-2xl font-black tracking-tight mb-1">Opowiedz o sobie</h1>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Dopasujemy plan podróży do Twoich upodobań.
        </p>

        {/* Free text / voice input */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Opisz siebie własnymi słowami
          </p>
          <div className="relative">
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Np. lubię sztukę i dobrą kawę, podróżuję spokojnie i z aparatem..."
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 pr-12 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {hasSR && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={cn(
                  "absolute right-2.5 bottom-2.5 h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  isListening
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Lub wybierz tagi poniżej:</p>
        </div>

        <Section
          title="Jedzenie i napoje"
          items={FOOD_PREFS}
          selected={foodSelected}
          onToggle={(id) => toggle(setFoodSelected, id)}
          customItems={foodCustom}
          onAddCustom={(val) => setFoodCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setFoodCustom(prev => prev.filter(v => v !== val))}
        />

        <Section
          title="Co lubisz zwiedzać"
          items={INTERESTS}
          selected={interestsSelected}
          onToggle={(id) => toggle(setInterestsSelected, id)}
          customItems={interestsCustom}
          onAddCustom={(val) => setInterestsCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setInterestsCustom(prev => prev.filter(v => v !== val))}
        />

        <Section
          title="Jak zwykle podróżujesz?"
          items={TRAVEL_STYLE}
          selected={styleSelected}
          onToggle={(id) => toggle(setStyleSelected, id)}
          customItems={styleCustom}
          onAddCustom={(val) => setStyleCustom(prev => [...prev, val])}
          onRemoveCustom={(val) => setStyleCustom(prev => prev.filter(v => v !== val))}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-5 pt-4 pb-safe-4 flex flex-col gap-2">
        <Button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full rounded-full font-semibold"
        >
          {saving ? "Zapisuję..." : "Zacznij planować!"}
        </Button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="text-sm text-muted-foreground text-center py-1"
        >
          Pomiń
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
