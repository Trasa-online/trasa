import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface FullCalendarPickerProps {
  onConfirm: (date: Date) => void;
}

const FullCalendarPicker = ({ onConfirm }: FullCalendarPickerProps) => {
  const [selected, setSelected] = useState<Date | undefined>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center px-2">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          disabled={(date) => date < today}
          locale={pl}
          className="w-full"
          classNames={{
            months: "flex flex-col w-full",
            month: "w-full",
            caption: "flex justify-center pt-1 relative items-center mb-4",
            caption_label: "text-2xl font-bold uppercase tracking-wider",
            nav: "space-x-1 flex items-center",
            nav_button: "h-9 w-9 bg-transparent p-0 opacity-70 hover:opacity-100 text-xl font-bold",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-semibold text-[0.85rem] text-center py-2",
            row: "flex w-full mt-2",
            cell: "flex-1 text-center p-0",
            day: "h-10 w-full rounded-full text-sm font-medium hover:bg-muted transition-colors aria-selected:opacity-100",
            day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background rounded-full",
            day_today: "font-bold text-orange-500",
            day_outside: "opacity-30",
            day_disabled: "opacity-20 cursor-not-allowed",
          }}
        />
      </div>

      {selected && (
        <div className="px-5 pb-2 text-center">
          <p className="text-sm text-muted-foreground">
            Wybrana data:{" "}
            <span className="font-semibold text-foreground">
              {format(selected, "d MMMM yyyy", { locale: pl })}
            </span>
          </p>
        </div>
      )}

      <div className="px-5 pb-safe-4 pb-6">
        <Button
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          size="lg"
          className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20 disabled:opacity-40"
        >
          Dalej
        </Button>
      </div>
    </div>
  );
};

export default FullCalendarPicker;
