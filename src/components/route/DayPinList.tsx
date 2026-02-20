import { X, GripVertical, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanPin {
  place_name: string;
  address: string;
  description: string;
  suggested_time: string;
  category: string;
  latitude: number;
  longitude: number;
  day_number: number;
}

interface DayPinListProps {
  dayNumber: number;
  totalDays: number;
  pins: PlanPin[];
  onRemovePin: (dayNumber: number, pinIndex: number) => void;
}

const categoryIcons: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  museum: "🏛️",
  park: "🌳",
  viewpoint: "👀",
  shopping: "🛍️",
  nightlife: "🌙",
  monument: "🏛️",
  church: "⛪",
  market: "🏪",
  bar: "🍺",
  gallery: "🎨",
};

const DayPinList = ({ dayNumber, totalDays, pins, onRemovePin }: DayPinListProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground px-1">
        Dzień {dayNumber} z {totalDays}
      </h3>
      <div className="space-y-1.5">
        {pins.map((pin, index) => (
          <div
            key={index}
            className="flex items-start gap-2 bg-muted/50 rounded-xl p-3 group"
          >
            <div className="flex-shrink-0 mt-0.5 text-muted-foreground/40">
              <GripVertical className="h-4 w-4" />
            </div>
            
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{categoryIcons[pin.category] || "📍"}</span>
                <span className="text-sm font-medium text-foreground truncate">
                  {pin.place_name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {pin.description}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {pin.suggested_time}
              </div>
              <button
                onClick={() => onRemovePin(dayNumber, index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DayPinList;
