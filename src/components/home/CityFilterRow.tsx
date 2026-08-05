import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Wiersz wyboru miasta w sheecie "Filtry" (Eksploracja). Zastapil selektor miast z gornej
// belki (2026-08-05) - toggle Trasy|Miejsca przejal jego miejsce, a wybor miasta zszedl
// pod guzik Filtry. "Wszystkie" (city === "all") = bez filtra miasta. Lista `cities` to
// realne miasta z trescia (trasy dla feedu / miejsca dla swipera).
export default function CityFilterRow({
  city,
  cities = [],
  onChange,
  label = "Miasto",
}: {
  city: string;
  cities?: string[];
  onChange: (city: string) => void;
  label?: string;
}) {
  const cur = city || "all";
  // Bez miast do wyboru nie ma czego renderowac (samo "Wszystkie" bez sensu).
  if (cities.length === 0) return null;

  const Pill = ({ value, text }: { value: string; text: string }) => {
    const on = cur === value;
    return (
      <button
        onClick={() => onChange(value)}
        className={cn(
          "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border whitespace-nowrap",
          on ? "bg-foreground text-background border-foreground" : "bg-white text-foreground border-border/60",
        )}
      >
        <span>{text}</span>
        {on && <Check className="h-3.5 w-3.5" />}
      </button>
    );
  };

  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-foreground mb-2">{label}</p>
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        <Pill value="all" text="Wszystkie" />
        {cities.map((c) => (
          <Pill key={c} value={c} text={c} />
        ))}
      </div>
    </div>
  );
}
