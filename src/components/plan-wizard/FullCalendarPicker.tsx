import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { pl } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface FullCalendarPickerProps {
  onConfirm: (date: Date, numDays: number) => void;
}

const MAX_DAYS = 3;

const FullCalendarPicker = ({ onConfirm }: FullCalendarPickerProps) => {
  const [range, setRange] = useState<DateRange | undefined>();
  const [month, setMonth] = useState(new Date());

  const handleSelect = (newRange: DateRange | undefined) => {
    if (newRange?.from && newRange?.to) {
      const days = differenceInCalendarDays(newRange.to, newRange.from) + 1;
      if (days > MAX_DAYS) {
        setRange({ from: newRange.from, to: addDays(newRange.from, MAX_DAYS - 1) });
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-2">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          disabled={(date) => date < today}
          fromDate={today}
          locale={pl}
          className="w-full"
          classNames={{
            months: "flex flex-col w-full",
            month: "w-full",
            caption: "flex justify-center pt-1 relative items-center mb-4",
            caption_label: "text-2xl font-bold uppercase tracking-wider",
            nav: "space-x-1 flex items-center",
            nav_button: "h-9 w-9 bg-transparent p-0 text-xl font-bold",
            nav_button_previous: `absolute left-1 opacity-20 ${isCurrentMonth ? "cursor-not-allowed pointer-events-none" : "hover:opacity-100"}`,
            nav_button_next: "absolute right-1 opacity-70 hover:opacity-100",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-semibold text-[0.85rem] text-center py-2",
            row: "flex w-full mt-2",
            cell: "flex-1 text-center p-0 relative",
            day: "h-10 w-full rounded-full text-sm font-medium hover:bg-muted transition-colors aria-selected:opacity-100",
            day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
            day_range_start: "rounded-l-full rounded-r-none bg-foreground text-background",
            day_range_end: "rounded-r-full rounded-l-none bg-foreground text-background",
            day_range_middle: "rounded-none bg-foreground/10 text-foreground aria-selected:bg-foreground/10 aria-selected:text-foreground",
            day_today: "font-bold text-orange-600",
            day_outside: "opacity-30",
            day_disabled: "opacity-20 cursor-not-allowed",
          }}
        />
      </div>

      {/* Summary */}
      <div className="px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        {startDate ? (
          <div className="mb-3 text-center">
            {endDate && numDays > 1 ? (
              <>
                <p className="text-base font-semibold text-foreground">
                  {format(startDate, "d MMM", { locale: pl })}
                  {" — "}
                  {format(endDate, "d MMM yyyy", { locale: pl })}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {numDays} {numDays < 5 ? "dni" : "dni"} · {nights} {nights === 1 ? "noc" : nights < 5 ? "noce" : "nocy"}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">
                  {format(startDate, "d MMMM yyyy", { locale: pl })}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Kliknij drugi dzień, żeby wybrać zakres
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mb-3 text-center">
            <p className="text-sm text-muted-foreground">Wybierz dzień wyjazdu (max. {MAX_DAYS} dni)</p>
          </div>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!startDate}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20 disabled:opacity-40"
        >
          Dalej
        </Button>
      </div>
    </div>
  );
};

export default FullCalendarPicker;
