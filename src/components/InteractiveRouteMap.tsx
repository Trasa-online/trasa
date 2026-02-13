import { useState, useMemo, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_API_KEY, reverseGeocode } from '@/lib/googleMaps';

interface Pin {
  latitude?: number;
  longitude?: number;
  place_name?: string;
  address?: string;
  pin_order?: number;
}

interface NewPinData {
  latitude: number;
  longitude: number;
  place_name: string;
  address: string;
}

interface InteractiveRouteMapProps {
  pins: Pin[];
  className?: string;
  onPinAdd: (pinData: NewPinData) => void;
}

interface PendingPin {
  latitude: number;
  longitude: number;
  place_name: string;
  address: string;
}

const MapContent = ({ pins, onPinAdd, onMapClick }: {
  pins: Pin[];
  onPinAdd: (pinData: NewPinData) => void;
  onMapClick?: (e: google.maps.MapMouseEvent) => void;
}) => {
  const map = useMap();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude),
    [pins]
  );

  // Fit bounds when multiple pins
  useEffect(() => {
    if (!map || validPins.length <= 1) return;

    const bounds = new google.maps.LatLngBounds();
    validPins.forEach(pin => {
      if (pin.latitude && pin.longitude) {
        bounds.extend({ lat: pin.latitude, lng: pin.longitude });
      }
    });

    map.fitBounds(bounds, { padding: 40 });
    // Limit max zoom
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 14) {
        map.setZoom(14);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, validPins]);

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Remove previous pending pin
    setPendingPin(null);
    setIsLoading(true);

    try {
      // Reverse geocode
      const result = await reverseGeocode(lat, lng);

      if (result) {
        setPendingPin({
          latitude: lat,
          longitude: lng,
          place_name: result.placeName || result.fullAddress.split(',')[0],
          address: result.fullAddress
        });
      } else {
        setPendingPin({
          latitude: lat,
          longitude: lng,
          place_name: 'Nowe miejsce',
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setPendingPin({
        latitude: lat,
        longitude: lng,
        place_name: 'Nowe miejsce',
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPin = () => {
    if (!pendingPin) return;

    onPinAdd({
      latitude: pendingPin.latitude,
      longitude: pendingPin.longitude,
      place_name: pendingPin.place_name,
      address: pendingPin.address
    });

    setPendingPin(null);
  };

  const handleCancelPin = () => {
    setPendingPin(null);
  };

  return (
    <>
      {/* Existing pins */}
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

      {/* Selected pin info window */}
      {selectedPin !== null && validPins[selectedPin] && (
        <InfoWindow
          position={{
            lat: validPins[selectedPin].latitude!,
            lng: validPins[selectedPin].longitude!
          }}
          onCloseClick={() => setSelectedPin(null)}
        >
          <p style={{ fontWeight: 500, margin: 0 }}>
            {validPins[selectedPin].place_name || validPins[selectedPin].address || `Punkt ${selectedPin + 1}`}
          </p>
        </InfoWindow>
      )}

      {/* Pending pin (temporary marker) */}
      {pendingPin && (
        <>
          <AdvancedMarker
            position={{ lat: pendingPin.latitude, lng: pendingPin.longitude }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              background: 'hsl(var(--primary))',
              border: '3px solid white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              animation: isLoading ? 'pulse 1s infinite' : 'none'
            }}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </div>
          </AdvancedMarker>

          {!isLoading && (
            <InfoWindow
              position={{ lat: pendingPin.latitude, lng: pendingPin.longitude }}
              onCloseClick={handleCancelPin}
            >
              <div style={{ padding: '8px' }}>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>{pendingPin.place_name}</p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  {pendingPin.address}
                </p>
                <Button
                  onClick={handleAddPin}
                  size="sm"
                  className="w-full"
                >
                  Dodaj pin
                </Button>
              </div>
            </InfoWindow>
          )}
        </>
      )}
    </>
  );
};

const InteractiveRouteMap = ({ pins, className = "", onPinAdd }: InteractiveRouteMapProps) => {
  const validPins = useMemo(() =>
    pins.filter(pin => pin.latitude && pin.longitude),
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

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    // Map click is handled inside MapContent
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          mapId="roadmap"
          onClick={handleMapClick}
        >
          <MapContent pins={pins} onPinAdd={onPinAdd} />
        </Map>
      </APIProvider>
    </div>
  );
};

export default InteractiveRouteMap;
