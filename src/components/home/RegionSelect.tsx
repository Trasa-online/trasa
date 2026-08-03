import { ChevronDown, Check, Lock, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { COUNTRIES } from "@/components/plan-wizard/CityPicker";
import { cn } from "@/lib/utils";

// Polaczony selektor KRAJ + MIASTO w jednym pillu (zamiast dwoch osobnych) - oszczedza
// szerokosc gornej belki eksploracji, zeby toggle Trasy|Miejsca + filtry + lupa sie miescily.
// Pill pokazuje aktualne miasto; dropdown grupuje miasta po kraju. Aktywny kraj (PL) ma
// wybieralne miasta (comingSoon = wyszarzone z klodka), zagraniczne kraje = naglowek z "wkrotce"
// (zapowiedz ekspansji, bez miast). Bez emoji-flag (zakaz emoji w UI).
export default function RegionSelect({
  city,
  onCityChange,
}: {
  city: string;
  onCityChange: (city: string) => void;
}) {
  const activeCountry = COUNTRIES.find((c) => !c.comingSoon) ?? COUNTRIES[0];
  const cur = city || "Warszawa";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 h-8 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[180px]"
          aria-label="Zmień kraj i miasto"
        >
          <MapPin className="h-3.5 w-3.5 text-orange-600 shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">{cur}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-2xl max-h-[60vh] overflow-y-auto min-w-[200px]">
        {COUNTRIES.map((country, idx) => {
          const countrySoon = !!country.comingSoon;
          return (
            <div key={country.code}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="flex items-center justify-between gap-2 py-1.5 text-xs font-bold text-foreground">
                <span className={cn(countrySoon && "text-muted-foreground")}>{country.name}</span>
                {countrySoon && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> wkrótce</span>
                )}
              </DropdownMenuLabel>
              {/* Miasta pokazujemy tylko dla aktywnego kraju - zagraniczne to sam naglowek z "wkrotce". */}
              {!countrySoon && country.cities.map((cityItem) => {
                const soon = !!cityItem.comingSoon;
                const selected = cityItem.name === cur;
                return (
                  <DropdownMenuItem
                    key={cityItem.name}
                    disabled={soon}
                    onSelect={(e) => { if (soon) { e.preventDefault(); return; } onCityChange(cityItem.name); }}
                    className={cn("gap-2 rounded-xl pl-3", soon ? "opacity-45 cursor-default" : "cursor-pointer")}
                  >
                    <span className={cn("flex-1", selected && "font-bold")}>{cityItem.name}</span>
                    {soon ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> wkrótce</span>
                    ) : selected ? (
                      <Check className="h-4 w-4 text-orange-600 shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
