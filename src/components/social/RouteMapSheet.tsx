import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";
import { useMemo, useState, useEffect, useRef } from "react";

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

function MapContent({ validPins, selectedIndex, onMarkerClick }: {
  validPins: MapPin[];
  selectedIndex: number | null;
  onMarkerClick: (i: number) => void;
}) {
  const map = useMap();

  // Fit bounds on mount
  useEffect(() => {
    if (!map || validPins.length === 0) return;
    if (validPins.length === 1) {
      map.setCenter({ lat: validPins[0].latitude!, lng: validPins[0].longitude! });
      map.setZoom(15);
      return;
    }
    const bounds = new (window as any).google.maps.LatLngBounds();
    validPins.forEach(p => bounds.extend({ lat: p.latitude!, lng: p.longitude! }));
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, validPins]);

  // Pan to selected pin
  useEffect(() => {
    if (!map || selectedIndex === null) return;
    const p = validPins[selectedIndex];
    if (p?.latitude && p?.longitude) {
      map.panTo({ lat: p.latitude, lng: p.longitude });
    }
  }, [map, selectedIndex, validPins]);

  return (
    <>
      {validPins.map((pin, i) => {
        const isSelected = selectedIndex === i;
        const label = (pin.pin_order ?? i) + 1;
        return (
          <AdvancedMarker
            key={i}
            position={{ lat: pin.latitude!, lng: pin.longitude! }}
            onClick={() => onMarkerClick(i)}
          >
            <div
              className="flex items-center justify-center rounded-full font-bold shadow-lg border-2 transition-all duration-200"
              style={{
                width: isSelected ? 36 : 28,
                height: isSelected ? 36 : 28,
                fontSize: isSelected ? 13 : 11,
                backgroundColor: isSelected ? "#ea580c" : "#fff",
                color: isSelected ? "#fff" : "#ea580c",
                borderColor: "#ea580c",
                zIndex: isSelected ? 10 : 1,
              }}
            >
              {label}
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

export default function RouteMapSheet({ city, pins, open, onOpenChange }: RouteMapSheetProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const sortedPins = useMemo(
    () => [...pins].filter(p => p.latitude && p.longitude).sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0)),
    [pins]
  );

  const center = useMemo(() => {
    if (sortedPins.length === 0) return { lat: 52.2297, lng: 21.0122 };
    const avgLat = sortedPins.reduce((s, p) => s + p.latitude!, 0) / sortedPins.length;
    const avgLng = sortedPins.reduce((s, p) => s + p.longitude!, 0) / sortedPins.length;
    return { lat: avgLat, lng: avgLng };
  }, [sortedPins]);

  // Reset selection when sheet closes
  useEffect(() => {
    if (!open) setSelectedIndex(null);
  }, [open]);

  // Scroll selected chip into view
  useEffect(() => {
    if (selectedIndex !== null) {
      chipRefs.current[selectedIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedIndex]);

  const handleChipClick = (i: number) => {
    setSelectedIndex(prev => prev === i ? null : i);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80dvh] flex flex-col p-0 rounded-t-2xl overflow-hidden">
        <SheetHeader className="px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/20">
          <SheetTitle className="text-base font-bold">{city}</SheetTitle>
        </SheetHeader>

        {/* Map */}
        <div className="flex-1 overflow-hidden">
          {sortedPins.length === 0 ? (
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
                <MapContent
                  validPins={sortedPins}
                  selectedIndex={selectedIndex}
                  onMarkerClick={handleChipClick}
                />
              </Map>
            </APIProvider>
          )}
        </div>

        {/* Chips */}
        {sortedPins.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto px-4 py-3 flex-shrink-0 scrollbar-hide border-t border-border/20"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
          >
            {sortedPins.map((pin, i) => {
              const isSelected = selectedIndex === i;
              const label = (pin.pin_order ?? i) + 1;
              return (
                <button
                  key={i}
                  ref={el => { chipRefs.current[i] = el; }}
                  onClick={() => handleChipClick(i)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 flex-shrink-0 transition-all duration-200 active:scale-95 ${isSelected ? "bg-primary" : "bg-muted"}`}
                >
                  <span
                    className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-colors duration-200"
                    style={{
                      backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "#ea580c",
                      color: "#fff",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${isSelected ? "text-white" : "text-foreground/80"}`}
                  >
                    {pin.place_name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
