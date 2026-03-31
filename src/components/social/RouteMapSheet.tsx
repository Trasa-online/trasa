import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { useMemo } from "react";

interface MapPin {
  place_name: string;
  latitude?: number | null;
  longitude?: number | null;
  pin_order?: number | null;
}

interface RouteMapSheetProps {
  city: string;
  pins: MapPin[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RouteMapSheet({ city, pins, open, onOpenChange }: RouteMapSheetProps) {
  const validPins = pins.filter(p => p.latitude && p.longitude);

  const center = useMemo(() => {
    if (validPins.length === 0) return { lat: 52.2297, lng: 21.0122 };
    const avgLat = validPins.reduce((s, p) => s + p.latitude!, 0) / validPins.length;
    const avgLng = validPins.reduce((s, p) => s + p.longitude!, 0) / validPins.length;
    return { lat: avgLat, lng: avgLng };
  }, [validPins]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80dvh] flex flex-col p-0 rounded-t-2xl">
        <SheetHeader className="px-5 pt-4 pb-3 flex-shrink-0">
          <SheetTitle className="text-base">{city}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          {validPins.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Brak lokalizacji dla tej trasy
            </div>
          ) : (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <Map
                defaultCenter={center}
                defaultZoom={14}
                gestureHandling="greedy"
                disableDefaultUI
                mapId="feed-route-map"
                className="w-full h-full"
              >
                {validPins.map((pin, i) => (
                  <AdvancedMarker
                    key={i}
                    position={{ lat: pin.latitude!, lng: pin.longitude! }}
                  >
                    <div className="h-7 w-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shadow-md border-2 border-white">
                      {(pin.pin_order ?? i) + 1}
                    </div>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>
          )}
        </div>
        {validPins.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 py-3 flex-shrink-0 scrollbar-hide border-t border-border/30">
            {[...validPins]
              .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0))
              .map((pin, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 flex-shrink-0"
                >
                  <span className="h-4 w-4 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {(pin.pin_order ?? i) + 1}
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap">{pin.place_name}</span>
                </div>
              ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
