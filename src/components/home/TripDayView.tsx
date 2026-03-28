import { useState, useMemo } from "react";
import { ChevronRight, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlaceDetailSheet from "./PlaceDetailSheet";
import RouteMap from "@/components/RouteMap";

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
  pins: Pin[];
  dayLabel: string;
  dateLabel?: string | null;
  onStartReview: () => void;
}

const isEvening = () => new Date().getHours() >= 17;

const TripDayView = ({ pins, dayLabel, dateLabel, onStartReview }: TripDayViewProps) => {
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  const sortedPins = [...pins].sort((a, b) => a.pin_order - b.pin_order);
  const evening = isEvening();

  const pinsWithCoords = sortedPins.filter(p => p.latitude && p.longitude);

  const googleMapsUrl = useMemo(() => {
    if (pinsWithCoords.length === 0) return null;
    if (pinsWithCoords.length === 1) {
      const p = pinsWithCoords[0];
      return `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
    }
    const origin = `${pinsWithCoords[0].latitude},${pinsWithCoords[0].longitude}`;
    const dest = `${pinsWithCoords[pinsWithCoords.length - 1].latitude},${pinsWithCoords[pinsWithCoords.length - 1].longitude}`;
    const waypoints = pinsWithCoords.slice(1, -1)
      .map(p => `${p.latitude},${p.longitude}`)
      .join("|");
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
    return waypoints ? `${base}&waypoints=${waypoints}` : base;
  }, [pinsWithCoords]);

  return (
    <div className="bg-muted/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{dayLabel}</p>
        {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
      </div>

      {/* Map + Google Maps link */}
      {pinsWithCoords.length > 0 && (
        <div className="mb-3 space-y-2">
          <RouteMap pins={sortedPins} className="h-48 rounded-xl" />
          <a
            href={googleMapsUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-background/60 border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Map className="h-3.5 w-3.5" />
            Otwórz trasę w Google Maps ({pinsWithCoords.length} {pinsWithCoords.length === 1 ? "punkt" : "punktów"})
          </a>
        </div>
      )}

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
        {evening ? (
          <Button
            onClick={onStartReview}
            size="sm"
            className="w-full rounded-full text-sm font-medium"
          >
            Przejdź do podsumowania
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
