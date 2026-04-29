import { Clock } from "lucide-react";
import { BusinessData } from "./mockBusinessData";

interface BusinessHoursProps {
  business: BusinessData;
}

const DAYS_MAP: { [key: string]: string } = {
  mon: "Poniedziałek",
  tue: "Wtorek",
  wed: "Środa",
  thu: "Czwartek",
  fri: "Piątek",
  sat: "Sobota",
  sun: "Niedziela"
};

const DAYS_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const BusinessHours = ({ business }: BusinessHoursProps) => {
  const now = new Date();
  const currentDay = DAYS_ORDER[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const todayHours = business.opening_hours[currentDay];
  const isOpen = todayHours && !('closed' in todayHours) && 
    currentTime >= todayHours.open && currentTime <= todayHours.close;

  return (
    <div className="mx-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Godziny otwarcia
        </h3>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
          isOpen 
            ? "bg-green-500/10 text-green-600" 
            : "bg-red-500/10 text-red-500"
        }`}>
          {isOpen ? "● Otwarte" : "● Zamknięte"}
        </span>
      </div>

      <div className="space-y-1">
        {DAYS_ORDER.map((day) => {
          const hours = business.opening_hours[day];
          const isToday = day === currentDay;
          const isClosed = hours && 'closed' in hours;

          return (
            <div
              key={day}
              className={`flex justify-between py-1.5 px-2 rounded text-sm ${
                isToday ? "bg-primary/5 font-medium" : ""
              }`}
            >
              <span className={isToday ? "text-primary" : "text-muted-foreground"}>
                {DAYS_MAP[day]}
                {isToday && " (dziś)"}
              </span>
              <span className={isClosed ? "text-muted-foreground" : ""}>
                {isClosed 
                  ? "Zamknięte" 
                  : hours && !('closed' in hours) 
                    ? `${hours.open} - ${hours.close}`
                    : "-"
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BusinessHours;
