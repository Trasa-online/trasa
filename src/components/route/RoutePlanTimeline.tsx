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
          <div className="relative pl-6 space-y-0">
            {day.pins.map((pin, idx) => (
              <div key={idx} className="relative flex items-start pb-4">
                {/* Dot */}
                <div className="absolute left-[-18px] top-2 w-3 h-3 rounded-full bg-muted-foreground/40" />
                {/* Dashed line */}
                {idx < day.pins.length - 1 && (
                  <div className="absolute left-[-13px] top-5 bottom-0 w-px border-l border-dashed border-muted-foreground/30" />
                )}
                {/* Content */}
                <div className="flex-1 flex items-start justify-between gap-3 min-w-0 border-b border-border/40 pb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{pin.place_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {pin.description || ""}
                    </p>
                  </div>
                  <span className="text-sm font-mono text-foreground shrink-0">
                    {pin.suggested_time || "00:00"}
                  </span>
                </div>
              </div>
            ))}
            {/* End dot */}
            <div className="absolute left-[-18px] bottom-0 w-3 h-3 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoutePlanTimeline;
