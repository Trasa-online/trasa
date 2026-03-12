import { memo, useMemo, useState, useEffect } from 'react';
import { Maximize2 } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMaps';

interface Pin {
  latitude?: number;
  longitude?: number;
  place_name?: string;
  address?: string;
  is_transport?: boolean;
  pin_order?: number;
}

interface RouteMapProps {
  pins: Pin[];
  className?: string;
  onClick?: () => void;
  showExpandButton?: boolean;
}

/**
 * Inner map component that uses Google Maps hooks
 */
const MapContent = ({ validPins }: { validPins: Pin[] }) => {
  const map = useMap();
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  // Calculate center from pins
  const center = useMemo(() => {
    if (validPins.length === 0) {
      return { lat: 52.2297, lng: 21.0122 }; // Warsaw
    }
    const avgLat = validPins.reduce((sum, pin) => sum + (pin.latitude || 0), 0) / validPins.length;
    const avgLng = validPins.reduce((sum, pin) => sum + (pin.longitude || 0), 0) / validPins.length;
    return { lat: avgLat, lng: avgLng };
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
    // Limit max zoom
    const listener = (window as any).google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 14) {
        map.setZoom(14);
      }
    });

    return () => {
      (window as any).google.maps.event.removeListener(listener);
    };
  }, [map, validPins]);

  return (
    <>
      {validPins.map((pin, index) => {
        if (!pin.latitude || !pin.longitude) return null;

        const pinNumber = pin.pin_order !== undefined ? pin.pin_order + 1 : index + 1;

        return (
          <AdvancedMarker
            key={`${pin.latitude}-${pin.longitude}-${index}`}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onClick={() => setSelectedPin(index)}
          >
            <div style={{
              width: '28px',
              height: '28px',
              background: '#000',
              border: '2px solid white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer'
            }}>
              {pinNumber}
            </div>
          </AdvancedMarker>
        );
      })}

      {selectedPin !== null && validPins[selectedPin] && (
        <InfoWindow
          position={{
            lat: validPins[selectedPin].latitude!,
            lng: validPins[selectedPin].longitude!
          }}
          onCloseClick={() => setSelectedPin(null)}
        >
          <p style={{ fontWeight: 500, margin: 0 }}>
            {validPins[selectedPin].place_name ||
             validPins[selectedPin].address ||
             `Punkt ${(validPins[selectedPin].pin_order !== undefined ? validPins[selectedPin].pin_order! + 1 : selectedPin + 1)}`}
          </p>
        </InfoWindow>
      )}
    </>
  );
};

/**
 * Memoized RouteMap component using Google Maps.
 * Only re-renders when pins actually change (coordinates/order).
 */
const RouteMap = memo(function RouteMap({
  pins,
  className = "",
  onClick,
  showExpandButton = false
}: RouteMapProps) {
  // Memoize valid pins to prevent unnecessary recalculations
  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude),
    [pins]
  );

  // Calculate initial center and zoom
  const center = useMemo(() => {
    if (validPins.length === 0) {
      return { lat: 52.2297, lng: 21.0122 }; // Warsaw
    }
    const avgLat = validPins.reduce((sum, pin) => sum + (pin.latitude || 0), 0) / validPins.length;
    const avgLng = validPins.reduce((sum, pin) => sum + (pin.longitude || 0), 0) / validPins.length;
    return { lat: avgLat, lng: avgLng };
  }, [validPins]);

  const zoom = useMemo(() => {
    if (validPins.length === 0) return 3;
    if (validPins.length === 1) return 15;
    return 12;
  }, [validPins.length]);

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
            <MapContent validPins={validPins} />
          </Map>
        </APIProvider>
      </div>
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
  // Custom comparison: only re-render if pins coordinates/order changed
  const prevKey = prevProps.pins
    .filter(p => p.latitude && p.longitude)
    .map(p => `${p.latitude},${p.longitude},${p.pin_order}`)
    .join('|');
  const nextKey = nextProps.pins
    .filter(p => p.latitude && p.longitude)
    .map(p => `${p.latitude},${p.longitude},${p.pin_order}`)
    .join('|');

  return prevKey === nextKey &&
         prevProps.className === nextProps.className &&
         prevProps.showExpandButton === nextProps.showExpandButton;
});

export default RouteMap;
