import { useCallback } from "react";
import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PlaceCategory } from "@/lib/googleMaps";

// ─── Types ───

interface ExperiencePanelProps {
  placeType: PlaceCategory;
  coreDecision: string | null;
  selectedTags: string[];
  timingTag: string | null;
  optionalNote: string;
  onCoreDecisionChange: (value: string | null) => void;
  onTagsChange: (tags: string[]) => void;
  onTimingTagChange: (value: string | null) => void;
  onNoteChange: (note: string) => void;
}

interface CoreOption {
  value: string;
  label: string;
  emoji: string;
  selectedClasses: string;
}

interface TypeConfig {
  title: string;
  icon: string;
  section1Label: string;
  coreOptions: CoreOption[];
  section2Label: string;
  tagOptions: string[];
  section3Type: 'single' | 'freetext';
  section3Label: string;
  section3Options?: { value: string; label: string }[];
  section3Placeholder?: string;
}

// ─── Type Configurations ───

const TYPE_CONFIGS: Record<Exclude<PlaceCategory, 'other'>, TypeConfig> = {
  accommodation: {
    title: "Jak sprawdziło się to miejsce jako baza?",
    icon: "🏨",
    section1Label: "Czy to dobra baza na tę podróż?",
    coreOptions: [
      { value: "IDEAL_BASE", label: "Idealna baza", emoji: "🏠", selectedClasses: "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600" },
      { value: "OK_BASE", label: "OK baza", emoji: "👌", selectedClasses: "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600" },
      { value: "LOGISTICS_PROBLEM", label: "Problem logistyczny", emoji: "⚠️", selectedClasses: "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600" },
    ],
    section2Label: "Kluczowe czynniki",
    tagOptions: [
      "Dobra lokalizacja", "Blisko transportu", "Cicho", "Głośno",
      "Wygodny sen", "Dobra cena", "Dobre śniadanie", "Trudny check-in",
      "Daleko od wszystkiego"
    ],
    section3Type: 'freetext',
    section3Label: "Notatka",
    section3Placeholder: "Co sprawiło, że to miejsce się sprawdziło (lub nie)?",
  },
  attraction: {
    title: "Czy było warte czasu?",
    icon: "🎭",
    section1Label: "Czy warto poświęcić czas?",
    coreOptions: [
      { value: "MUST_VISIT", label: "Must visit", emoji: "⭐", selectedClasses: "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600" },
      { value: "WORTH_IF_TIME", label: "Warto jeśli czas", emoji: "👍", selectedClasses: "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600" },
      { value: "CAN_SKIP", label: "Można pominąć", emoji: "⏭️", selectedClasses: "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600" },
    ],
    section2Label: "Doświadczenie",
    tagOptions: [
      "Długa wizyta", "Krótka wizyta", "Długie kolejki", "Dobra cena",
      "Drogo", "Tłoczno", "Zależne od pogody", "Wymaga rezerwacji",
      "Dobre dla dzieci"
    ],
    section3Type: 'single',
    section3Label: "Kiedy najlepiej pasuje?",
    section3Options: [
      { value: "START_OF_DAY", label: "Początek dnia" },
      { value: "MID_DAY", label: "W ciągu dnia" },
      { value: "EVENING", label: "Wieczorem" },
      { value: "BAD_WEATHER_OPTION", label: "Na złą pogodę" },
    ],
  },
  food: {
    title: "Jak wpasowało się w plan?",
    icon: "🍽️",
    section1Label: "Czy wpasowało się w trasę?",
    coreOptions: [
      { value: "PERFECT_FIT", label: "Idealne", emoji: "✨", selectedClasses: "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600" },
      { value: "OK_FIT", label: "OK", emoji: "👌", selectedClasses: "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600" },
      { value: "DISRUPTED_PLAN", label: "Zaburzyło plan", emoji: "😤", selectedClasses: "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600" },
    ],
    section2Label: "Charakter i logistyka",
    tagOptions: [
      "Szybka obsługa", "Wymaga rezerwacji", "Długie czekanie", "Szybki przystanek",
      "Długi wieczór", "Dobre solo", "Dobre w grupie", "Dobre między zwiedzaniem"
    ],
    section3Type: 'single',
    section3Label: "Kiedy byłeś?",
    section3Options: [
      { value: "MORNING", label: "Rano" },
      { value: "LUNCH", label: "Lunch" },
      { value: "AFTERNOON", label: "Popołudnie" },
      { value: "DINNER", label: "Kolacja" },
      { value: "LATE_EVENING", label: "Późny wieczór" },
    ],
  },
  shopping: {
    title: "Jaką rolę odegrało to miejsce?",
    icon: "🛍️",
    section1Label: "Planowane czy spontaniczne?",
    coreOptions: [
      { value: "PLANNED", label: "Planowane", emoji: "📋", selectedClasses: "bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-600" },
      { value: "SPONTANEOUS", label: "Spontaniczne", emoji: "✨", selectedClasses: "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600" },
      { value: "NECESSITY", label: "Konieczność", emoji: "🛒", selectedClasses: "bg-muted border-muted-foreground/40" },
    ],
    section2Label: "Typ zakupów",
    tagOptions: [
      "Lokalne produkty", "Pamiątki turystyczne", "Wysoka jakość",
      "Drogo", "Szybki przystanek", "Wrócę tu"
    ],
    section3Type: 'single',
    section3Label: "Czy zmieniło plan dnia?",
    section3Options: [
      { value: "YES", label: "Tak" },
      { value: "NO", label: "Nie" },
    ],
  },
  transport: {
    title: "Jak działało logistycznie?",
    icon: "🚆",
    section1Label: "Czy było sprawnie?",
    coreOptions: [
      { value: "VERY_SMOOTH", label: "Bardzo sprawnie", emoji: "✅", selectedClasses: "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600" },
      { value: "OK", label: "OK", emoji: "👌", selectedClasses: "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600" },
      { value: "PROBLEMATIC", label: "Problematyczne", emoji: "⚠️", selectedClasses: "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600" },
    ],
    section2Label: "Wskaźniki tarcia",
    tagOptions: [
      "Długie kolejki", "Dużo schodów", "Mylące oznakowanie",
      "Łatwa przesiadka", "Trudne z bagażem", "Dobrze zorganizowane"
    ],
    section3Type: 'freetext',
    section3Label: "Notatka",
    section3Placeholder: "Co powinni wiedzieć inni?",
  },
};

// ─── Main Component ───

const ExperiencePanel = ({
  placeType,
  coreDecision,
  selectedTags,
  timingTag,
  optionalNote,
  onCoreDecisionChange,
  onTagsChange,
  onTimingTagChange,
  onNoteChange,
}: ExperiencePanelProps) => {
  if (placeType === 'other') return null;

  const config = TYPE_CONFIGS[placeType];

  const handleTagToggle = useCallback((tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }, [selectedTags, onTagsChange]);

  return (
    <div className="space-y-8 pb-6">
      {/* Section 1: Core Decision */}
      <section className="space-y-3">
        <p className="text-[15px] font-medium text-foreground">
          {config.section1Label}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {config.coreOptions.map((opt) => {
            const isSelected = coreDecision === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCoreDecisionChange(isSelected ? null : opt.value)}
                className={cn(
                  "py-4 rounded-xl border-[1.5px] flex flex-col items-center gap-1.5 transition-all duration-150",
                  isSelected
                    ? opt.selectedClasses
                    : "border-border bg-background hover:bg-muted/50"
                )}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-[12px] font-medium text-center leading-tight px-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Tags */}
      <section className="space-y-3">
        <p className="text-[15px] font-medium text-foreground">
          {config.section2Label}
        </p>
        <div className="flex flex-wrap gap-2">
          {config.tagOptions.map((option) => {
            const isSelected = selectedTags.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleTagToggle(option)}
                className={cn(
                  "h-9 px-4 rounded-lg text-[14px] font-medium transition-all duration-150 flex items-center gap-1.5",
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-foreground hover:bg-muted"
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                {option}
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Timing or Free Text */}
      <section className="space-y-3">
        <p className="text-[15px] font-medium text-foreground">
          {config.section3Label}
        </p>

        {config.section3Type === 'single' && config.section3Options && (
          <div className="flex flex-wrap gap-2">
            {config.section3Options.map((opt) => {
              const isSelected = timingTag === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTimingTagChange(isSelected ? null : opt.value)}
                  className={cn(
                    "h-9 px-4 rounded-lg border-[1.5px] flex items-center gap-2 transition-all duration-150 text-[14px] font-medium",
                    isSelected
                      ? "border-foreground bg-muted/50"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {config.section3Type === 'freetext' && (
          <div>
            <Textarea
              value={optionalNote}
              onChange={(e) => {
                if (e.target.value.length <= 300) {
                  onNoteChange(e.target.value);
                }
              }}
              placeholder={config.section3Placeholder}
              className="resize-none min-h-[80px] text-[14px] rounded-xl border-border/60 focus:border-foreground/40 bg-muted/30 placeholder:text-muted-foreground/50"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground/60 text-right mt-1">
              {optionalNote.length}/300
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExperiencePanel;
