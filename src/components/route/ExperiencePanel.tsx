import { useState, useCallback } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
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
      { value: "IDEAL_BASE", label: "Idealna baza", emoji: "🏠", selectedClasses: "bg-green-100 border-green-500 dark:bg-green-900/30" },
      { value: "OK_BASE", label: "OK baza", emoji: "👌", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30" },
      { value: "LOGISTICS_PROBLEM", label: "Problem logistyczny", emoji: "⚠️", selectedClasses: "bg-red-100 border-red-500 dark:bg-red-900/30" },
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
      { value: "MUST_VISIT", label: "Must visit", emoji: "⭐", selectedClasses: "bg-green-100 border-green-500 dark:bg-green-900/30" },
      { value: "WORTH_IF_TIME", label: "Warto jeśli czas", emoji: "👍", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30" },
      { value: "CAN_SKIP", label: "Można pominąć", emoji: "⏭️", selectedClasses: "bg-red-100 border-red-500 dark:bg-red-900/30" },
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
      { value: "PERFECT_FIT", label: "Idealne", emoji: "✨", selectedClasses: "bg-green-100 border-green-500 dark:bg-green-900/30" },
      { value: "OK_FIT", label: "OK", emoji: "👌", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30" },
      { value: "DISRUPTED_PLAN", label: "Zaburzyło plan", emoji: "😤", selectedClasses: "bg-red-100 border-red-500 dark:bg-red-900/30" },
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
      { value: "PLANNED", label: "Planowane", emoji: "📋", selectedClasses: "bg-blue-100 border-blue-500 dark:bg-blue-900/30" },
      { value: "SPONTANEOUS", label: "Spontaniczne", emoji: "✨", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30" },
      { value: "NECESSITY", label: "Konieczność", emoji: "🛒", selectedClasses: "bg-muted border-muted-foreground/50" },
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
      { value: "VERY_SMOOTH", label: "Bardzo sprawnie", emoji: "✅", selectedClasses: "bg-green-100 border-green-500 dark:bg-green-900/30" },
      { value: "OK", label: "OK", emoji: "👌", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30" },
      { value: "PROBLEMATIC", label: "Problematyczne", emoji: "⚠️", selectedClasses: "bg-red-100 border-red-500 dark:bg-red-900/30" },
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

// ─── Reusable UI Components ───

const SectionLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <div className="flex items-center gap-2">
    <h3 className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
      {children}
    </h3>
    {required && <span className="text-[11px] text-destructive font-medium">*</span>}
  </div>
);

const ChipSelector = ({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((option) => {
      const isSelected = selected.includes(option);
      return (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(option)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150",
            isSelected
              ? "bg-foreground text-background"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
        >
          {isSelected && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
          {option}
        </button>
      );
    })}
  </div>
);

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
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{config.icon}</span>
        <h2 className="text-lg font-semibold">{config.title}</h2>
      </div>

      <div className="h-px bg-border" />

      {/* Section 1: Core Decision (Required) */}
      <section className="space-y-2.5">
        <SectionLabel required>{config.section1Label}</SectionLabel>
        <div className="flex gap-2">
          {config.coreOptions.map((opt) => {
            const isSelected = coreDecision === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCoreDecisionChange(isSelected ? null : opt.value)}
                className={cn(
                  "flex-1 py-3 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all duration-150",
                  isSelected
                    ? opt.selectedClasses
                    : "border-border bg-background hover:border-muted-foreground/30"
                )}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-[11px] font-medium text-center leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Tags (Multi-select) */}
      <section className="space-y-2.5">
        <SectionLabel>{config.section2Label}</SectionLabel>
        <ChipSelector
          options={config.tagOptions}
          selected={selectedTags}
          onToggle={handleTagToggle}
        />
      </section>

      {/* Section 3: Timing or Free Text */}
      <section className="space-y-2.5">
        <SectionLabel>{config.section3Label}</SectionLabel>

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
                    "px-4 py-2 rounded-lg border flex items-center gap-2 transition-all duration-150 text-sm",
                    isSelected
                      ? "border-foreground bg-muted/50 font-medium"
                      : "border-border bg-background hover:border-muted-foreground/30"
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
              className="resize-none min-h-[52px] text-sm border-muted-foreground/20 focus:border-foreground"
              rows={2}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">
              {optionalNote.length}/300
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExperiencePanel;
