import { useState, useEffect } from "react";
import { MAIN_CATEGORIES, type MainCategory, type Subcategory } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";

export { MAIN_CATEGORIES as CATEGORIES };

interface CategoryPickerProps {
  onSelect: (category: string) => void;
  onShowAll: () => void;
  visitedCategories?: string[];
  likedCount?: number;
}

const CategoryPicker = ({ onSelect, onShowAll, visitedCategories = [], likedCount = 0 }: CategoryPickerProps) => {
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [categories, setCategories] = useState<MainCategory[]>(MAIN_CATEGORIES);
  const isReturn = visitedCategories.length > 0;

  useEffect(() => {
    (supabase as any).from("approved_subcategories").select("id, label, emoji, main_category_id").then(({ data }: { data: any[] | null }) => {
      if (!data?.length) return;
      setCategories(MAIN_CATEGORIES.map(cat => {
        const extras: Subcategory[] = data
          .filter(s => s.main_category_id === cat.id)
          .map(s => ({ id: s.id, label: s.label, emoji: s.emoji }));
        return extras.length ? { ...cat, subcategories: [...cat.subcategories, ...extras] } : cat;
      }));
    });
  }, []);

  const handleMainClick = (id: string) => {
    setSelectedMain(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full px-5 pt-6 pb-6 pb-safe-6">
      <div className="space-y-1 mb-6">
        <p className="text-3xl font-black leading-tight">
          {isReturn ? "Co teraz?" : "Co Cię interesuje?"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isReturn
            ? `${likedCount} miejsc wybranych · wybierz kolejną kategorię`
            : "Wybierz kategorię — pokażemy 20 losowych miejsc."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5">
        {categories.map(cat => {
          const isActive = selectedMain === cat.id;
          const visited = visitedCategories.some(v =>
            cat.subcategories.some(s => s.id === v) || v === cat.id
          );

          return (
            <div key={cat.id}>
              <button
                onClick={() => handleMainClick(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                  isActive
                    ? "border-primary bg-primary/5 text-foreground"
                    : visited
                    ? "border-primary/30 bg-primary/5 text-foreground/60"
                    : "border-border/50 bg-card text-foreground"
                }`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.hint}</p>
                </div>
                {visited && !isActive && (
                  <span className="text-[10px] text-primary font-bold shrink-0">✓</span>
                )}
                <span className={`text-muted-foreground transition-transform shrink-0 ${isActive ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {isActive && (
                <div className="mt-1.5 pl-2 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex flex-wrap gap-2 px-2">
                    {cat.subcategories.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => onSelect(sub.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors active:scale-[0.96]"
                      >
                        <span>{sub.emoji}</span>
                        <span>{sub.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => onSelect(cat.id)}
                    className="w-full text-left px-4 py-2 text-sm font-semibold text-primary rounded-xl hover:bg-primary/5 transition-colors"
                  >
                    Pokaż wszystkie z tej kategorii →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4">
        <button
          onClick={onShowAll}
          className="w-full text-sm text-muted-foreground py-2 active:opacity-60 transition-opacity"
        >
          {isReturn ? "Wygeneruj trasę z wybranych miejsc →" : "Pokaż wszystko bez filtrowania"}
        </button>
      </div>
    </div>
  );
};

export default CategoryPicker;
