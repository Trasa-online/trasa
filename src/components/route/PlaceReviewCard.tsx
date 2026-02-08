import { useState, useCallback } from "react";
import { MapPin, Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  { value: "must_see" as const, emoji: "⭐", label: "Punkt obowiązkowy", description: "Nie można tego ominąć" },
  { value: "nice_addition" as const, emoji: "➕", label: "Fajny dodatek", description: "Warto, jeśli masz czas" },
  { value: "skippable" as const, emoji: "🔁", label: "Można pominąć", description: "Nie straciłbyś wiele" },
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
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150",
              isSelected
                ? "bg-foreground text-background border-foreground scale-105"
                : "bg-background text-foreground border-border hover:border-foreground/50"
            )}
          >
            {isSelected && <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
            {option}
          </button>
        );
      })}
      {/* Custom chips already added */}
      {selected
        .filter((s) => !options.includes(s))
        .map((custom) => (
          <button
            key={custom}
            type="button"
            onClick={() => onToggle(custom)}
            className="px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 bg-foreground text-background border-foreground scale-105"
          >
            <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {custom}
          </button>
        ))}
      {allowCustom && !showCustomInput && (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          className="px-3 py-1.5 rounded-full border border-dashed border-border text-sm text-muted-foreground hover:border-foreground/50 hover:text-foreground transition-all duration-150 flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Coś innego
        </button>
      )}
      {allowCustom && showCustomInput && (
        <div className="flex items-center gap-1.5">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Wpisz..."
            className="h-8 w-32 text-sm"
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
          <button
            type="button"
            onClick={handleAddCustom}
            className="p-1.5 rounded-md hover:bg-muted text-foreground"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setCustomValue("");
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

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
    <div className="space-y-5 pb-32">
      {/* 1. HEADER */}
      <div className="bg-muted/30 rounded-xl p-4">
        <h2 className="text-xl font-bold text-foreground">
          {isNotPlanning ? "Jak było w tym miejscu?" : "Co planujesz w tym miejscu?"}
        </h2>
        {(dayContext || totalPins) && (
          <p className="text-sm text-muted-foreground mt-1">
            {dayContext && <span>{dayContext} · </span>}
            {totalPins && <span>Pinezka {pinIndex + 1} z {totalPins}</span>}
          </p>
        )}
      </div>

      {/* 2. PLACE CARD */}
      <div className="bg-background border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          {pin.image_url && (
            <img
              src={pin.image_url}
              alt={pin.place_name}
              className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{pin.place_name || pin.address}</p>
            {pin.tags?.[0] && (
              <Badge variant="secondary" className="text-[10px] mt-1">
                {pin.tags[0]}
              </Badge>
            )}
          </div>
        </div>
        {pin.address && pin.address !== pin.place_name && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{pin.address}</span>
          </div>
        )}
      </div>

      {/* 3. EXPECTATIONS */}
      {isNotPlanning && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Czy to miejsce spełniło Twoje oczekiwania?
          </h3>
          <div className="flex gap-3">
            {EXPECTATION_OPTIONS.map((opt) => {
              const isSelected = pin.expectation_met === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    onUpdate("expectation_met", isSelected ? null : opt.value)
                  }
                  className={cn(
                    "flex-1 min-h-[72px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-150",
                    isSelected
                      ? opt.selectedClasses
                      : "border-border bg-background hover:border-foreground/30"
                  )}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. PROS */}
      {isNotPlanning && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Co było na plus?</h3>
            <p className="text-xs text-muted-foreground">(możesz wybrać kilka)</p>
          </div>
          <ChipSelector
            options={PROS_OPTIONS}
            selected={pin.pros || []}
            onToggle={(v) => handleChipToggle("pros", v)}
            allowCustom
          />
        </section>
      )}

      {/* 5. CONS */}
      {isNotPlanning && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">A co mogło być lepsze?</h3>
            <Badge variant="secondary" className="text-[10px]">opcjonalne</Badge>
          </div>
          <ChipSelector
            options={CONS_OPTIONS}
            selected={pin.cons || []}
            onToggle={(v) => handleChipToggle("cons", v)}
            allowCustom
          />
        </section>
      )}

      {/* 6. TRIP ROLE */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {isNotPlanning
            ? "Jaką rolę miało to miejsce w Twojej podróży?"
            : "Jaką rolę ma mieć to miejsce?"}
        </h3>
        <div className="flex flex-col gap-2">
          {TRIP_ROLE_OPTIONS.map((opt) => {
            const isSelected = pin.trip_role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onUpdate("trip_role", isSelected ? null : opt.value)
                }
                className={cn(
                  "w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all duration-150 text-left",
                  isSelected
                    ? "border-foreground bg-muted/50"
                    : "border-border bg-background hover:border-foreground/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{opt.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-foreground flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 7. ONE LINER */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Jedno zdanie od Ciebie</h3>
          <Badge variant="secondary" className="text-[10px]">opcjonalne</Badge>
        </div>
        <div className="relative">
          <Textarea
            value={pin.one_liner || ""}
            onChange={(e) => {
              if (e.target.value.length <= 300) {
                onUpdate("one_liner", e.target.value);
              }
            }}
            placeholder="Wpadliśmy tu po zwiedzaniu, bo było blisko – dobre jedzenie, ale drugi raz bym nie planował specjalnie."
            className="resize-none min-h-[60px]"
            rows={2}
          />
          <p className="text-[10px] text-muted-foreground text-right mt-1">
            {(pin.one_liner || "").length}/300
          </p>
        </div>
      </section>

      {/* 8. RECOMMENDED FOR */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Dla kogo polecasz?</h3>
          <Badge variant="secondary" className="text-[10px]">opcjonalne</Badge>
        </div>
        <ChipSelector
          options={RECOMMENDED_FOR_OPTIONS}
          selected={pin.recommended_for || []}
          onToggle={(v) => handleChipToggle("recommended_for", v)}
        />
      </section>
    </div>
  );
};

export default PlaceReviewCard;
