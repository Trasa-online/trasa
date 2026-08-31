import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, differenceInCalendarDays, addDays, addMonths, subMonths } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface FullCalendarPickerProps {
  onConfirm: (date: Date, numDays: number) => void;
  /** Maksymalna dlugosc zakresu w dniach (domyslnie 3). */
  maxDays?: number;
  // allowPast: pozwala wybierac daty historyczne (np. zapis odbytego wyjazdu). Domyslnie
  // false = tylko dzis i przyszlosc (planowanie).
  allowPast?: boolean;
  // onClear: gdy podany, pokazuje przycisk "Wyczyść daty" (usuwa daty wyjazdu i zamyka).
  onClear?: () => void;
}

// Limit dlugosci zakresu. Domyslne 3 dni zostaja dla starego flow planowania; kreator
// wyjazdu i widok wyjazdu podnosza go propem (podzial miejsc na dni).
const DEFAULT_MAX_DAYS = 3;

const FullCalendarPicker = ({ onConfirm, allowPast = false, onClear, maxDays = DEFAULT_MAX_DAYS }: FullCalendarPickerProps) => {
  const [range, setRange] = useState<DateRange | undefined>();
  const [month, setMonth] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);

  const handleSelect = (newRange: DateRange | undefined) => {
    if (newRange?.from && newRange?.to) {
      const days = differenceInCalendarDays(newRange.to, newRange.from) + 1;
      if (days > maxDays) {
        setRange({ from: newRange.from, to: addDays(newRange.from, maxDays - 1) });
        return;
      }
    }
    setRange(newRange);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isCurrentMonth =
    month.getFullYear() === today.getFullYear() &&
    month.getMonth() === today.getMonth();
  const canGoPrev = allowPast || !isCurrentMonth;

  // Zakres lat do wyboru: historyczne (jesli allowPast) + kilka lat w przod.
  const currentYear = today.getFullYear();
  const minYear = allowPast ? currentYear - 12 : currentYear;
  const maxYear = currentYear + 2;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  const startDate = range?.from;
  const endDate = range?.to;
  const numDays = startDate && endDate
    ? differenceInCalendarDays(endDate, startDate) + 1
    : startDate ? 1 : 0;
  const nights = numDays - 1;

  const handleConfirm = () => {
    if (!startDate) return;
    onConfirm(startDate, numDays);
  };

  const singleDayMode = !!(range?.from && !range?.to);

  return (
    <div className="flex flex-col h-full">
      {/* Wlasny naglowek: miesiac + ROK (klik -> wybor roku) + nawigacja miesiacami. */}
      <div className="flex items-center justify-between px-4 pt-2 mb-3">
        <button
          onClick={() => { if (canGoPrev) setMonth(subMonths(month, 1)); }}
          disabled={!canGoPrev}
          aria-label="Poprzedni miesiąc"
          className="h-9 w-9 flex items-center justify-center rounded-full text-foreground disabled:opacity-20 active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowYearPicker((v) => !v)}
          className="flex items-center gap-1.5 text-2xl font-bold uppercase tracking-wider active:opacity-70"
        >
          {format(month, "LLLL yyyy", { locale: dateLocale() })}
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showYearPicker ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Następny miesiąc"
          className="h-9 w-9 flex items-center justify-center rounded-full text-foreground active:scale-90 transition-transform"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {showYearPicker ? (
        /* Wybor roku (grid) - klik ustawia rok, wraca do widoku miesiaca. */
        <div className="grid grid-cols-4 gap-2 px-4 pb-4">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { setMonth(new Date(y, month.getMonth(), 1)); setShowYearPicker(false); }}
              className={`py-3 rounded-2xl text-base font-semibold transition-colors ${y === month.getFullYear() ? "bg-foreground text-background" : "bg-muted text-foreground active:bg-muted/70"}`}
            >
              {y}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-2">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            disabled={allowPast ? undefined : (date) => date < today}
            fromDate={allowPast ? undefined : today}
            locale={dateLocale()}
            className="w-full"
            modifiers={{ singleDay: singleDayMode && range?.from ? [range.from] : [] }}
            modifiersClassNames={{ singleDay: "!rounded-full !w-10 !mx-auto" }}
            classNames={{
              months: "flex flex-col w-full",
              month: "w-full",
              caption: "hidden",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md flex-1 font-semibold text-[0.85rem] text-center py-2",
              row: "flex w-full mt-2",
              cell: "flex-1 text-center p-0 relative",
              day: "h-10 w-full rounded-full text-sm font-medium hover:bg-muted transition-colors aria-selected:opacity-100",
              day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
              day_range_start: "rounded-l-full rounded-r-none bg-foreground text-background",
              day_range_end: "rounded-r-full rounded-l-none bg-foreground text-background",
              day_range_middle: "rounded-none bg-foreground text-background aria-selected:bg-foreground aria-selected:text-background",
              day_today: "font-bold text-orange-600",
              day_outside: "opacity-30",
              day_disabled: "opacity-20 cursor-not-allowed",
            }}
          />
        </div>
      )}

      {/* Summary + akcje */}
      <div className="px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        {startDate ? (
          <div className="mb-3 text-center">
            {endDate && numDays > 1 ? (
              <>
                <p className="text-base font-semibold text-foreground">
                  {format(startDate, "d MMM", { locale: dateLocale() })}
                  {" - "}
                  {format(endDate, "d MMM yyyy", { locale: dateLocale() })}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {numDays} dni · {nights} {nights === 1 ? "noc" : nights < 5 ? "noce" : "nocy"}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">
                  {format(startDate, "d MMMM yyyy", { locale: dateLocale() })}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Kliknij drugi dzień, żeby wybrać zakres
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mb-3 text-center">
            <p className="text-sm text-muted-foreground">Wybierz dzień wyjazdu (max. {maxDays} dni)</p>
          </div>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!startDate}
          size="lg"
          className="w-full rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20 disabled:opacity-40"
        >
          Dalej
        </Button>

        {/* Wyczyść daty: jesli jest zaznaczenie -> resetuje je; inaczej (onClear) usuwa daty wyjazdu. */}
        {(range?.from || onClear) && (
          <button
            onClick={() => { if (range?.from) setRange(undefined); else onClear?.(); }}
            className="w-full mt-2 py-2.5 text-sm font-semibold text-muted-foreground active:text-foreground transition-colors"
          >
            {range?.from ? "Wyczyść zaznaczenie" : "Bez dat"}
          </button>
        )}
      </div>
    </div>
  );
};

export default FullCalendarPicker;
