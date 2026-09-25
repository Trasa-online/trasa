import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

// FILTRY POD JEDNYM GUZIKIEM (prosba Nat 2026-09-25). Do tego dnia arkusz wyroznionych miejsc
// i wyszukiwarka Miejsc mialy nad trescia DWA-TRZY rzedy przewijanych chipow (kraj, miasto,
// typ) - zanim user zobaczyl pierwszy wynik, mial przed soba sciane pigulek. Teraz jest jeden
// okragly guzik z ikona filtrow (ten sam ksztalt co dzwonek i filtr odleglosci w belce),
// licznik aktywnych filtrow na nim, a chipy siedza w panelu, ktory otwiera.
//
// Chipy w panelu ZAWIJAJA SIE (flex-wrap), nie przewijaja w bok: w panelu jest na nie
// miejsce, a poziomy scroll chowal czesc opcji za krawedzia.

export type FilterOption = { id: string; label: string; count?: number };
export type FilterGroup = {
  id: string;
  title: string;
  allLabel: string;
  options: FilterOption[];
  value: string | null;
  onChange: (v: string | null) => void;
};

export function FilterButton({ activeCount, onClick, className }: { activeCount: number; onClick: () => void; className?: string }) {
  const { t } = useTranslation("common");
  const on = activeCount > 0;
  return (
    <button
      type="button"
      onClick={() => { haptics.light(); onClick(); }}
      aria-label={on ? t("filters_sheet.aria_active", { count: activeCount }) : t("filters_sheet.aria")}
      className={cn(
        "relative shrink-0 h-9 w-9 flex items-center justify-center rounded-full border active:scale-95 transition-transform",
        on ? "bg-[#FDF184] border-[#FDF184] text-[#5B2C06]" : "bg-muted/70 border-border/50 text-foreground",
        className,
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {on && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-[18px] text-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}

export function FilterSheet({ open, onOpenChange, groups, resultCount }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: FilterGroup[];
  /** Ile wynikow zostanie po filtrach - pokazujemy na guziku zamykajacym ("Pokaz 12"). */
  resultCount?: number;
}) {
  const { t } = useTranslation("common");
  const visible = groups.filter((g) => g.options.length > 0);
  const anyActive = visible.some((g) => g.value !== null);
  const clear = () => { haptics.light(); visible.forEach((g) => g.onChange(null)); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] max-h-[82dvh] flex flex-col">
        <div className="flex items-center justify-between pr-8">
          <SheetTitle className="text-lg font-black">{t("filters_sheet.title")}</SheetTitle>
          {anyActive && (
            <button onClick={clear} className="text-sm font-semibold text-primary active:opacity-70">{t("filters_sheet.clear")}</button>
          )}
        </div>
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto space-y-5 pb-2">
          {visible.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-[13px] font-bold text-muted-foreground">{g.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: "", label: g.allLabel } as FilterOption, ...g.options].map((o) => {
                  const active = (o.id || null) === g.value;
                  return (
                    <button
                      key={o.id || "_all"}
                      onClick={() => { haptics.selection(); g.onChange(o.id || null); }}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-[13.5px] font-bold active:scale-95 transition-all",
                        active ? "bg-[#FDF184] text-[#5B2C06]" : "bg-secondary text-foreground",
                      )}
                    >
                      {o.label}
                      {o.count != null && <span className={cn("ml-1.5 font-semibold", active ? "text-[#5B2C06]/60" : "text-muted-foreground")}>{o.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="mt-3 h-12 w-full rounded-full bg-primary text-white text-[15px] font-bold active:scale-[0.98] transition-transform"
        >
          {resultCount != null ? t("filters_sheet.show", { count: resultCount }) : t("filters_sheet.done")}
        </button>
      </SheetContent>
    </Sheet>
  );
}
