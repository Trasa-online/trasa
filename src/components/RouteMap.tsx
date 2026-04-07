import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMaps';

// Colors per day (day 1 = orange, day 2 = blue, day 3 = green, day 4+ = purple)
const DAY_COLORS = ['#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#d97706'];
function dayColor(dayNumber: number) {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}

interface Pin {
  latitude?: number;
  longitude?: number;
  place_name?: string;
  address?: string;
  is_transport?: boolean;
  pin_order?: number;
  day_number?: number;
}

interface RouteMapProps {
  pins: Pin[];
  className?: string;
  onClick?: () => void;
  showExpandButton?: boolean;
  onPinClick?: (pin: Pin) => void;
}

// Draws dashed polylines per day using Google Maps Polyline overlay
function DayPolylines({ validPins }: { validPins: Pin[] }) {
  const map = useMap();
  const polylinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !(window as any).google) return;

    // Clear previous polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    // Group pins by day
    const byDay = new Map<number, Pin[]>();
    for (const pin of validPins) {
      const d = pin.day_number ?? 1;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(pin);
    }

    // Draw one polyline per day
    byDay.forEach((pins, dayNum) => {
      if (pins.length < 2) return;
      const path = pins
        .filter(p => p.latitude && p.longitude)
        .map(p => ({ lat: p.latitude!, lng: p.longitude! }));
      if (path.length < 2) return;

      const polyline = new (window as any).google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: dayColor(dayNum),
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.7,
            strokeColor: dayColor(dayNum),
            strokeWeight: 2.5,
            scale: 4,
          },
          offset: '0',
          repeat: '16px',
        }],
        map,
      });
      polylinesRef.current.push(polyline);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, validPins]);

  return null;
}

const MapContent = ({ validPins, onPinClick }: { validPins: Pin[]; onPinClick?: (pin: Pin) => void }) => {
  const map = useMap();
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  const isMultiDay = useMemo(() => {
    const days = new Set(validPins.map(p => p.day_number ?? 1));
    return days.size > 1;
  }, [validPins]);

  // Fit bounds when multiple pins
  useEffect(() => {
    if (!map || validPins.length <= 1) return;

    const bounds = new (window as any).google.maps.LatLngBounds();
    validPins.forEach(pin => {
      if (pin.latitude && pin.longitude) {
        bounds.extend({ lat: pin.latitude, lng: pin.longitude });
      }
    });

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    const listener = (window as any).google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 14) map.setZoom(14);
    });

    return () => {
      (window as any).google.maps.event.removeListener(listener);
    };
  }, [map, validPins]);

  // Per-day counter for numbering within each day
  const pinNumberByDay = useMemo(() => {
    const counters = new Map<number, number>();
    return validPins.map(pin => {
      const d = pin.day_number ?? 1;
      const n = (counters.get(d) ?? 0) + 1;
      counters.set(d, n);
      return n;
    });
  }, [validPins]);

  return (
    <>
      <DayPolylines validPins={validPins} />

      {validPins.map((pin, index) => {
        if (!pin.latitude || !pin.longitude) return null;
        const dayNum = pin.day_number ?? 1;
        const color = isMultiDay ? dayColor(dayNum) : '#000';
        const label = isMultiDay ? pinNumberByDay[index] : (pin.pin_order !== undefined ? pin.pin_order + 1 : index + 1);

        return (
          <AdvancedMarker
            key={`${pin.latitude}-${pin.longitude}-${index}`}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onClick={() => { setSelectedPin(index); onPinClick?.(pin); }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              background: color,
              border: '2px solid white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '11px',
              fontWeight: '700',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}>
              {label}
            </div>
          </AdvancedMarker>
        );
      })}

      {selectedPin !== null && validPins[selectedPin] && (
        <InfoWindow
          position={{
            lat: validPins[selectedPin].latitude!,
            lng: validPins[selectedPin].longitude!,
          }}
          onCloseClick={() => setSelectedPin(null)}
        >
          <p style={{ fontWeight: 500, margin: 0 }}>
            {validPins[selectedPin].place_name ||
             validPins[selectedPin].address ||
             `Punkt ${(validPins[selectedPin].pin_order !== undefined ? validPins[selectedPin].pin_order! + 1 : selectedPin + 1)}`}
            {(validPins[selectedPin].day_number ?? 1) > 1 && (
              <span style={{ color: dayColor(validPins[selectedPin].day_number!), marginLeft: 6, fontSize: 11 }}>
                Dzień {validPins[selectedPin].day_number}
              </span>
            )}
          </p>
        </InfoWindow>
      )}
    </>
  );
};

const RouteMap = memo(function RouteMap({
  pins,
  className = "",
  onClick,
  showExpandButton = false,
  onPinClick,
}: RouteMapProps) {
  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude),
    [pins]
  );

  const center = useMemo(() => {
    if (validPins.length === 0) return { lat: 52.2297, lng: 21.0122 };
    const avgLat = validPins.reduce((sum, pin) => sum + (pin.latitude || 0), 0) / validPins.length;
    const avgLng = validPins.reduce((sum, pin) => sum + (pin.longitude || 0), 0) / validPins.length;
    return { lat: avgLat, lng: avgLng };
  }, [validPins]);

  const zoom = useMemo(() => {
    if (validPins.length === 0) return 3;
    if (validPins.length === 1) return 15;
    return 12;
  }, [validPins.length]);

  // Day legend (shown only for multi-day)
  const days = useMemo(() => {
    const set = new Set<number>();
    validPins.forEach(p => { if (p.day_number) set.add(p.day_number); });
    return [...set].sort((a, b) => a - b);
  }, [validPins]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-border ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="w-full h-full min-h-[160px]">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            defaultCenter={center}
            defaultZoom={zoom}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            mapId="roadmap"
          >
            <MapContent validPins={validPins} onPinClick={onPinClick} />
          </Map>
        </APIProvider>
      </div>

      {/* Per-day color legend */}
      {days.length > 1 && (
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-10">
          {days.map(d => (
            <div
              key={d}
              className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold border border-border/50"
            >
              <div className="h-2 w-2 rounded-full" style={{ background: dayColor(d) }} />
              Dzień {d}
            </div>
          ))}
        </div>
      )}

      {showExpandButton && onClick && (
        <button
          className="absolute top-2 left-2 p-2 bg-background/90 backdrop-blur-sm rounded-md border border-border shadow-sm hover:bg-background transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  const prevKey = prevProps.pins
    .filter(p => p.latitude && p.longitude)
    .map(p => `${p.latitude},${p.longitude},${p.pin_order},${p.day_number}`)
    .join('|');
  const nextKey = nextProps.pins
    .filter(p => p.latitude && p.longitude)
    .map(p => `${p.latitude},${p.longitude},${p.pin_order},${p.day_number}`)
    .join('|');

  return prevKey === nextKey &&
         prevProps.className === nextProps.className &&
         prevProps.showExpandButton === nextProps.showExpandButton;
});

export default RouteMap;
