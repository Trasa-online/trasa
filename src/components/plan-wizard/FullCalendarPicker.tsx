import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";

interface FullCalendarPickerProps {
  onConfirm: (date: Date, numDays: number) => void;
}

const FullCalendarPicker = ({ onConfirm }: FullCalendarPickerProps) => {
  const [selected, setSelected] = useState<Date | undefined>();
  const [month, setMonth] = useState(new Date());
  const [numDays, setNumDays] = useState(1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isCurrentMonth =
    month.getFullYear() === today.getFullYear() &&
    month.getMonth() === today.getMonth();

  const nights = numDays - 1;

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-4" style={{ height: 420 }}>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
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
            cell: "flex-1 text-center p-0",
            day: "h-10 w-full rounded-full text-sm font-medium hover:bg-muted transition-colors aria-selected:opacity-100",
            day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background rounded-full",
            day_today: "font-bold text-orange-600",
            day_outside: "opacity-30",
            day_disabled: "opacity-20 cursor-not-allowed",
          }}
        />
      </div>

      {/* Number of days selector */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Liczba dni</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {numDays === 1
                ? "Jednodniowy wypad"
                : `${numDays} dni · ${nights} ${nights === 1 ? "noc" : nights < 5 ? "noce" : "nocy"}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNumDays(d => Math.max(1, d - 1))}
              disabled={numDays <= 1}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-30 active:bg-muted transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xl font-bold w-5 text-center">{numDays}</span>
            <button
              onClick={() => setNumDays(d => Math.min(7, d + 1))}
              disabled={numDays >= 7}
              className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-30 active:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="px-5 pb-2 text-center">
          <p className="text-sm text-muted-foreground">
            {format(selected, "d MMMM yyyy", { locale: pl })}
            {numDays > 1 && (
              <span className="font-semibold text-foreground">
                {" — "}{numDays} {numDays < 5 ? "dni" : "dni"}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="px-5 pb-safe-4 pb-6">
        <Button
          onClick={() => selected && onConfirm(selected, numDays)}
          disabled={!selected}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-lg shadow-orange-600/20 disabled:opacity-40"
        >
          Dalej
        </Button>
      </div>
    </div>
  );
};

export default FullCalendarPicker;
