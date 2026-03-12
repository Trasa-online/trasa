import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
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

interface FullscreenMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pins: Pin[];
  title?: string;
}

const MapContent = ({ pins }: { pins: Pin[] }) => {
  const map = useMap();
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude)
      .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0)),
    [pins]
  );

  // Fit bounds when multiple pins
  useEffect(() => {
    if (!map || validPins.length <= 1) return;

    const bounds = new (window as any).google.maps.LatLngBounds();
    validPins.forEach(pin => {
      if (pin.latitude && pin.longitude) {
        bounds.extend({ lat: pin.latitude, lng: pin.longitude });
      }
    });

    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    // Limit max zoom
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 15) {
        map.setZoom(15);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, validPins]);

  const handlePinClick = (index: number) => {
    const pin = validPins[index];
    if (map && pin.latitude && pin.longitude) {
      map.panTo({ lat: pin.latitude, lng: pin.longitude });
      map.setZoom(16);
    }
  };

  return (
    <>
      {validPins.map((pin, index) => {
        if (!pin.latitude || !pin.longitude) return null;

        return (
          <AdvancedMarker
            key={`${pin.latitude}-${pin.longitude}-${index}`}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            onClick={() => setSelectedPin(index)}
          >
            <div style={{
              width: '36px',
              height: '36px',
              background: '#000',
              border: '3px solid white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer'
            }}>
              {index + 1}
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
          <div style={{ padding: '4px' }}>
            <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>
              {selectedPin + 1}. {validPins[selectedPin].place_name || validPins[selectedPin].address || `Punkt ${selectedPin + 1}`}
            </p>
            {validPins[selectedPin].address && validPins[selectedPin].place_name && (
              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                {validPins[selectedPin].address}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const FullscreenMapDialog = ({ open, onOpenChange, pins, title }: FullscreenMapDialogProps) => {
  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude)
      .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0)),
    [pins]
  );

  // Calculate center from pins
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-background via-background/80 to-transparent">
        <h2 className="font-semibold text-lg truncate pr-4">{title || "Mapa trasy"}</h2>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Pin list */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-background via-background/80 to-transparent">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {validPins.map((pin, index) => (
            <PinButton
              key={index}
              pin={pin}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 z-10">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            defaultCenter={center}
            defaultZoom={zoom}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            mapId="roadmap"
          >
            <MapContent pins={pins} />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};

// Separate component for pin buttons to use useMap hook
const PinButton = ({ pin, index }: { pin: Pin; index: number }) => {
  const map = useMap();

  const handleClick = () => {
    if (map && pin.latitude && pin.longitude) {
      map.panTo({ lat: pin.latitude, lng: pin.longitude });
      map.setZoom(16);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-full whitespace-nowrap hover:bg-muted transition-colors shrink-0"
    >
      <span className="w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-xs font-semibold">
        {index + 1}
      </span>
      <span className="text-sm font-medium max-w-[150px] truncate">
        {pin.place_name || pin.address || `Punkt ${index + 1}`}
      </span>
    </button>
  );
};
