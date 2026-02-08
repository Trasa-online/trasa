import { useState, useCallback } from "react";
import { MapPin, Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
  note_type: string;
}

interface Pin {
  id?: string;
  place_name: string;
  address: string;
  description: string;
  image_url: string;
  images: string[];
  rating: number;
  pin_order: number;
  tags: string[];
  latitude?: number;
  longitude?: number;
  notes: PinNote[];
  expectation_met: "yes" | "average" | "no" | null;
  pros: string[];
  cons: string[];
  trip_role: "must_see" | "nice_addition" | "skippable" | null;
  one_liner: string;
  recommended_for: string[];
}

interface PlaceReviewCardProps {
  pin: Pin;
  pinIndex: number;
  totalPins?: number;
  dayContext?: string;
  onUpdate: (field: keyof Pin, value: any) => void;
  tripType: "planning" | "ongoing" | "completed";
}

const PROS_OPTIONS = ["Jedzenie", "Atmosfera", "Widok", "Lokalizacja", "Cena", "Obsługa"];
const CONS_OPTIONS = ["Tłoczno", "Nie warte ceny", "Słaba organizacja", "Trudno trafić", "Rozczarowujące jedzenie"];
const RECOMMENDED_FOR_OPTIONS = ["Solo", "Para", "Rodzina", "Budżetowo", "Slow travel", "Foodie"];

const EXPECTATION_OPTIONS = [
  { value: "yes" as const, emoji: "😊", label: "Tak", selectedClasses: "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-500" },
  { value: "average" as const, emoji: "😐", label: "Średnio", selectedClasses: "bg-amber-100 border-amber-500 dark:bg-amber-900/30 dark:border-amber-500" },
  { value: "no" as const, emoji: "😕", label: "Nie", selectedClasses: "bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-500" },
];

const TRIP_ROLE_OPTIONS = [
  { value: "must_see" as const, emoji: "⭐", label: "Punkt obowiązkowy" },
  { value: "nice_addition" as const, emoji: "➕", label: "Fajny dodatek" },
  { value: "skippable" as const, emoji: "🔁", label: "Można pominąć" },
];

const ChipSelector = ({
  options,
  selected,
  onToggle,
  allowCustom = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  allowCustom?: boolean;
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleAddCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onToggle(trimmed);
    }
    setCustomValue("");
    setShowCustomInput(false);
  };

  return (
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
      {selected
        .filter((s) => !options.includes(s))
        .map((custom) => (
          <button
            key={custom}
            type="button"
            onClick={() => onToggle(custom)}
            className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-foreground text-background transition-all duration-150"
          >
            <Check className="inline h-3 w-3 mr-1 -mt-0.5" />
            {custom}
          </button>
        ))}
      {allowCustom && !showCustomInput && (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          className="px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/30 text-[13px] text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all duration-150 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Inne
        </button>
      )}
      {allowCustom && showCustomInput && (
        <div className="flex items-center gap-1">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Wpisz..."
            className="h-7 w-28 text-[13px] rounded-full px-3"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              } else if (e.key === "Escape") {
                setShowCustomInput(false);
                setCustomValue("");
              }
            }}
          />
          <button type="button" onClick={handleAddCustom} className="p-1 rounded-full hover:bg-muted">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setShowCustomInput(false); setCustomValue(""); }}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

const SectionLabel = ({ children, required = false, optional = false }: { children: React.ReactNode; required?: boolean; optional?: boolean }) => (
  <div className="flex items-center gap-2">
    <h3 className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
      {children}
    </h3>
    {required && <span className="text-[11px] text-destructive font-medium">*</span>}
    {optional && (
      <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
        Opcjonalnie
      </span>
    )}
  </div>
);

const PlaceReviewCard = ({
  pin,
  pinIndex,
  totalPins,
  dayContext,
  onUpdate,
  tripType,
}: PlaceReviewCardProps) => {
  const isNotPlanning = tripType !== "planning";

  const handleChipToggle = useCallback(
    (field: "pros" | "cons" | "recommended_for", value: string) => {
      const current = pin[field] || [];
      const isSelected = current.includes(value);
      onUpdate(
        field,
        isSelected ? current.filter((v) => v !== value) : [...current, value]
      );
    },
    [pin, onUpdate]
  );

  return (
    <div className="space-y-6 pb-4">
      {/* Place card - minimal */}
      <div className="flex items-center gap-3">
        {pin.image_url && (
          <img
            src={pin.image_url}
            alt={pin.place_name}
            className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{pin.place_name || pin.address}</p>
          {pin.address && pin.address !== pin.place_name && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {pin.address}
            </p>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Expectations */}
      {isNotPlanning && (
        <section className="space-y-2.5">
          <SectionLabel>Spełniło oczekiwania?</SectionLabel>
          <div className="flex gap-2">
            {EXPECTATION_OPTIONS.map((opt) => {
              const isSelected = pin.expectation_met === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate("expectation_met", isSelected ? null : opt.value)}
                  className={cn(
                    "flex-1 py-3 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all duration-150",
                    isSelected
                      ? opt.selectedClasses
                      : "border-border bg-background hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-[11px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Pros */}
      {isNotPlanning && (
        <section className="space-y-2.5">
          <SectionLabel>Co było na plus?</SectionLabel>
          <ChipSelector
            options={PROS_OPTIONS}
            selected={pin.pros || []}
            onToggle={(v) => handleChipToggle("pros", v)}
            allowCustom
          />
        </section>
      )}

      {/* Cons */}
      {isNotPlanning && (
        <section className="space-y-2.5">
          <SectionLabel optional>Co mogło być lepsze?</SectionLabel>
          <ChipSelector
            options={CONS_OPTIONS}
            selected={pin.cons || []}
            onToggle={(v) => handleChipToggle("cons", v)}
            allowCustom
          />
        </section>
      )}

      {/* Trip role */}
      <section className="space-y-2.5">
        <SectionLabel>
          {isNotPlanning ? "Rola w podróży" : "Planowana rola"}
        </SectionLabel>
        <div className="flex flex-col gap-1.5">
          {TRIP_ROLE_OPTIONS.map((opt) => {
            const isSelected = pin.trip_role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate("trip_role", isSelected ? null : opt.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-lg border flex items-center justify-between transition-all duration-150 text-left",
                  isSelected
                    ? "border-foreground bg-muted/50"
                    : "border-border bg-background hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{opt.emoji}</span>
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-foreground flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* One liner */}
      <section className="space-y-2.5">
        <SectionLabel optional>Jedno zdanie od Ciebie</SectionLabel>
        <div>
          <Textarea
            value={pin.one_liner || ""}
            onChange={(e) => {
              if (e.target.value.length <= 300) {
                onUpdate("one_liner", e.target.value);
              }
            }}
            placeholder="Twoje krótkie wrażenie z tego miejsca..."
            className="resize-none min-h-[52px] text-sm border-muted-foreground/20 focus:border-foreground"
            rows={2}
          />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">
            {(pin.one_liner || "").length}/300
          </p>
        </div>
      </section>

      {/* Recommended for - REQUIRED */}
      <section className="space-y-2.5">
        <SectionLabel required>Dla kogo polecasz?</SectionLabel>
        <ChipSelector
          options={RECOMMENDED_FOR_OPTIONS}
          selected={pin.recommended_for || []}
          onToggle={(v) => handleChipToggle("recommended_for", v)}
          allowCustom
        />
        {(pin.recommended_for || []).length === 0 && (
          <p className="text-[11px] text-destructive">Wybierz przynajmniej jedną opcję</p>
        )}
      </section>
    </div>
  );
};

export default PlaceReviewCard;
