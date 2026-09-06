import { ChevronDown, Check, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Selektor regionu dla eksploracji w jednym pillu (oszczedza szerokosc belki).
// Domyslnie "Wszystkie" (city === "all") = wszystkie trasy bez filtra miasta. Po kliknieciu
// dropdown pokazuje "Wszystkie" + realne miasta ktore maja trasy (prop `cities`, distinct z
// tabeli routes). Bez statycznej listy krajow/miast - listujemy tylko to, co ma tresc.
export const ALL_CITIES = "all";

export default function RegionSelect({
  city,
  cities = [],
  onCityChange,
}: {
  city: string;
  cities?: string[];
  onCityChange: (city: string) => void;
}) {
  const { t } = useTranslation("explore");
  const cur = city || ALL_CITIES;
  const isAll = cur === ALL_CITIES;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 h-8 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[180px]"
          aria-label={t("region.pick_city")}
        >
          {/* Globus przy "Wszystkie" usuniety (2026-08-04) - ikona pinezki tylko dla konkretnego miasta. */}
          {!isAll && <MapPin className="h-3.5 w-3.5 text-orange-600 shrink-0" />}
          <span className="text-sm font-bold text-foreground truncate">{isAll ? t("region.all") : cur}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl max-h-[60vh] overflow-y-auto min-w-[200px]">
        <DropdownMenuItem
          onSelect={() => onCityChange(ALL_CITIES)}
          className="gap-2 rounded-xl cursor-pointer pl-3"
        >
          <span className={cn("flex-1", isAll && "font-bold")}>{t("region.all")}</span>
          {isAll && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
        </DropdownMenuItem>

        {cities.length > 0 && <DropdownMenuSeparator />}

        {cities.map((c) => {
          const selected = c === cur;
          return (
            <DropdownMenuItem
              key={c}
              onSelect={() => onCityChange(c)}
              className="gap-2 rounded-xl cursor-pointer pl-3"
            >
              <span className={cn("flex-1", selected && "font-bold")}>{c}</span>
              {selected && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
