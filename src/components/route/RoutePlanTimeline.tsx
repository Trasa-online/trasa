interface TimelinePin {
  place_name: string;
  description?: string | null;
  suggested_time?: string | null;
}

interface DayData {
  day_number: number;
  pins: TimelinePin[];
}

interface RoutePlanTimelineProps {
  days: DayData[];
  totalDays: number;
}

const RoutePlanTimeline = ({ days, totalDays }: RoutePlanTimelineProps) => {
  return (
    <div className="px-5 py-4 space-y-6">
      {days.map((day) => (
        <div key={day.day_number}>
          {totalDays > 1 && (
            <h3 className="text-lg font-bold mb-3">
              Dzień #{day.day_number} z {totalDays}
            </h3>
          )}
          <div className="space-y-0">
            {day.pins.map((pin, idx) => {
              const isLast = idx === day.pins.length - 1;
              return (
                <div key={idx} className="flex items-start gap-3 py-2.5">
                  {/* Stepper: number circle + line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold bg-transparent border-2 border-border text-muted-foreground">
                      {idx + 1}
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 min-h-[20px] bg-border/60 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] font-medium leading-tight">{pin.place_name}</p>
                    {pin.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pin.description}</p>
                    )}
                  </div>
                  {/* Time */}
                  {pin.suggested_time && (
                    <span className="text-xs text-muted-foreground shrink-0 pt-1">
                      {pin.suggested_time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoutePlanTimeline;
