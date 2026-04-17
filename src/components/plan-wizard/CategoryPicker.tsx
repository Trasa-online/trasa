import { useState } from "react";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "restaurant", label: "Restauracje", emoji: "🍽️" },
  { value: "cafe", label: "Kawiarnie", emoji: "☕" },
  { value: "museum", label: "Muzea", emoji: "🏛️" },
  { value: "bar", label: "Bary", emoji: "🍺" },
  { value: "monument", label: "Zabytki", emoji: "🏰" },
  { value: "park", label: "Parki", emoji: "🌳" },
  { value: "gallery", label: "Galerie", emoji: "🖼️" },
  { value: "viewpoint", label: "Widoki", emoji: "🌅" },
  { value: "experience", label: "Rozrywka", emoji: "🎭" },
  { value: "shopping", label: "Zakupy", emoji: "🛍️" },
  { value: "club", label: "Kluby", emoji: "🎵" },
  { value: "market", label: "Targi", emoji: "🏪" },
];

interface CategoryPickerProps {
  onConfirm: (categories: string[]) => void;
}

const CategoryPicker = ({ onConfirm }: CategoryPickerProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (value: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full px-5 pt-6 pb-6 pb-safe-6">
      <div className="space-y-1 mb-6">
        <p className="text-3xl font-black leading-tight">Co Cię interesuje?</p>
        <p className="text-sm text-muted-foreground">
          Wybierz kategorie — pokażemy 20 miejsc z każdej.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.map(({ value, label, emoji }) => {
            const isSelected = selected.has(value);
            return (
              <button
                key={value}
                onClick={() => toggle(value)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.97] ${
                  isSelected
                    ? "border-primary bg-primary/8 text-foreground"
                    : "border-border/50 bg-card text-foreground"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-sm font-semibold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 space-y-3">
        <Button
          size="lg"
          disabled={selected.size === 0}
          onClick={() => onConfirm(Array.from(selected))}
          className="w-full rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20 disabled:opacity-40"
        >
          Dalej {selected.size > 0 ? `· ${selected.size} ${selected.size === 1 ? "kategoria" : selected.size < 5 ? "kategorie" : "kategorii"}` : ""}
        </Button>
        <button
          onClick={() => onConfirm(CATEGORIES.map(c => c.value))}
          className="w-full text-sm text-muted-foreground py-2 active:opacity-60 transition-opacity"
        >
          Pokaż wszystko
        </button>
      </div>
    </div>
  );
};

export default CategoryPicker;
