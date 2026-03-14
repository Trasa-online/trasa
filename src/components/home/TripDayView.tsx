import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlaceDetailSheet from "./PlaceDetailSheet";

interface Pin {
  id: string;
  place_name: string;
  pin_order: number;
  suggested_time?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface TripDayViewProps {
  routeId: string;
  pins: Pin[];
  dayLabel: string;
  dateLabel?: string | null;
  onStartReview: () => void;
}

const isEvening = () => new Date().getHours() >= 17;

const TripDayView = ({ routeId, pins, dayLabel, dateLabel, onStartReview }: TripDayViewProps) => {
  const navigate = useNavigate();
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  const sortedPins = [...pins].sort((a, b) => a.pin_order - b.pin_order);
  const evening = isEvening();

  return (
    <div className="bg-muted/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{dayLabel}</p>
        {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
      </div>

      {/* Read-only pin list */}
      <div className="space-y-1 mb-3">
        {sortedPins.map((pin, idx) => (
          <button
            key={pin.id}
            onClick={() => setSelectedPin(pin)}
            className="w-full flex items-center gap-3 rounded-xl bg-background/60 px-3 py-2.5 text-left hover:bg-background/90 active:bg-background transition-colors"
          >
            <span className="text-xs text-muted-foreground w-4 shrink-0 text-center font-medium">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium leading-tight truncate">{pin.place_name}</p>
              {pin.suggested_time && (
                <p className="text-[11px] text-muted-foreground">{pin.suggested_time}</p>
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </button>
        ))}
        {sortedPins.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Brak miejsc w planie.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={() => navigate(`/edit-plan?route=${routeId}`)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Popraw trasę
        </button>

        {evening ? (
          <Button
            onClick={onStartReview}
            size="sm"
            className="w-full rounded-full text-sm font-medium"
          >
            Opowiedz o dniu
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-0.5">
            "Opowiedz o dniu" dostępne od 17:00
          </p>
        )}
      </div>

      {selectedPin && (
        <PlaceDetailSheet
          pin={selectedPin}
          open={!!selectedPin}
          onOpenChange={(open) => !open && setSelectedPin(null)}
        />
      )}
    </div>
  );
};

export default TripDayView;
