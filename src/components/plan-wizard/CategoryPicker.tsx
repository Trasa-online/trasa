const CATEGORIES = [
  { value: "restaurant", label: "Restauracje", emoji: "🍽️" },
  { value: "cafe",       label: "Kawiarnie",   emoji: "☕" },
  { value: "museum",     label: "Muzea",       emoji: "🏛️" },
  { value: "bar",        label: "Bary",        emoji: "🍺" },
  { value: "monument",   label: "Zabytki",     emoji: "🏰" },
  { value: "park",       label: "Parki",       emoji: "🌳" },
  { value: "gallery",    label: "Galerie",     emoji: "🖼️" },
  { value: "viewpoint",  label: "Widoki",      emoji: "🌅" },
  { value: "experience", label: "Rozrywka",    emoji: "🎭" },
  { value: "shopping",   label: "Zakupy",      emoji: "🛍️" },
  { value: "club",       label: "Kluby",       emoji: "🎵" },
  { value: "market",     label: "Targi",       emoji: "🏪" },
];

export { CATEGORIES };

interface CategoryPickerProps {
  onSelect: (category: string) => void;
  onShowAll: () => void;
  visitedCategories?: string[];
  likedCount?: number;
}

const CategoryPicker = ({ onSelect, onShowAll, visitedCategories = [], likedCount = 0 }: CategoryPickerProps) => {
  const isReturn = visitedCategories.length > 0;

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

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.map(({ value, label, emoji }) => {
            const visited = visitedCategories.includes(value);
            return (
              <button
                key={value}
                onClick={() => onSelect(value)}
                className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.97] ${
                  visited
                    ? "border-primary/30 bg-primary/5 text-foreground/60"
                    : "border-border/50 bg-card text-foreground"
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className="text-sm font-semibold leading-tight">{label}</span>
                {visited && (
                  <span className="absolute top-2 right-2 text-[10px] text-primary font-bold">✓</span>
                )}
              </button>
            );
          })}
        </div>
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
