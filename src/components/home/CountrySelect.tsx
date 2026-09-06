import { ChevronDown, Check, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { COUNTRIES } from "@/components/plan-wizard/CityPicker";
import { cn } from "@/lib/utils";

// Selektor kraju (pill z dropdownem) obok selektora miasta. Na razie aktywna TYLKO "Polska".
// Zagraniczne kraje pokazujemy WYSZARZONE (comingSoon) - sygnal "wkrotce", bez mozliwosci wyboru.
// Bez flag-emoji (zakaz emoji w UI) - same nazwy krajow. Wybor kraju nie zmienia jeszcze
// niczego funkcjonalnie (jest tylko PL) - to zapowiedz ekspansji.
export default function CountrySelect() {
  const { t } = useTranslation("explore");
  const active = COUNTRIES.find((c) => !c.comingSoon) ?? COUNTRIES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[140px]"
          aria-label={t("country.change")}
        >
          <span className="text-sm font-bold text-foreground truncate">{active.name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl max-h-[60vh] overflow-y-auto">
        {COUNTRIES.map((c) => {
          const soon = !!c.comingSoon;
          return (
            <DropdownMenuItem
              key={c.code}
              disabled={soon}
              onSelect={(e) => { if (soon) e.preventDefault(); }}
              className={cn("gap-2 rounded-xl", soon ? "opacity-45 cursor-default" : "cursor-pointer")}
            >
              <span className={cn("flex-1", c.code === active.code && "font-bold")}>{c.name}</span>
              {soon ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" />{t("country.soon")}</span>
              ) : c.code === active.code ? (
                <Check className="h-4 w-4 text-orange-600 shrink-0" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
