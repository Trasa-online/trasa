import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UNLOCKED_CITIES } from "@/components/plan-wizard/CityPicker";
import { cn } from "@/lib/utils";

// Wspoldzielony selektor miasta (pill z dropdownem) - ten sam wyglad na Eksploruj,
// Wyjazdach i Zapisanych. allowAll dodaje opcje "Wszystkie" (dla widokow agregujacych,
// gdzie nie chcemy chowac tresci z innych miast). Wartosc "all" == wszystkie miasta.
export const ALL_CITIES = "all";

export default function CitySelect({
  city,
  onCityChange,
  allowAll = false,
  allLabel = "Wszystkie",
}: {
  city: string;
  onCityChange: (city: string) => void;
  allowAll?: boolean;
  allLabel?: string;
}) {
  const { t } = useTranslation("explore");
  const cur = city || (allowAll ? ALL_CITIES : "Warszawa");
  const label = cur === ALL_CITIES ? allLabel : cur;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[180px]"
          aria-label={t("city.change")}
        >
          <span className="text-sm font-bold text-foreground truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl max-h-[60vh] overflow-y-auto">
        {allowAll && (
          <DropdownMenuItem onClick={() => onCityChange(ALL_CITIES)} className="gap-2 rounded-xl cursor-pointer">
            <span className={cn("flex-1", cur === ALL_CITIES && "font-bold")}>{allLabel}</span>
            {cur === ALL_CITIES && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
          </DropdownMenuItem>
        )}
        {UNLOCKED_CITIES.map((c) => (
          <DropdownMenuItem key={c} onClick={() => onCityChange(c)} className="gap-2 rounded-xl cursor-pointer">
            <span className={cn("flex-1", c === cur && "font-bold")}>{c}</span>
            {c === cur && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
