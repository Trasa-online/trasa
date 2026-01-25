import { useEffect, useRef, memo, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

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
 * Memoized RouteMap component with lazy loading of mapbox-gl.
 * Only re-renders when pins actually change (coordinates/order).
 */
const RouteMap = memo(function RouteMap({ 
  pins, 
  className = "", 
  onClick, 
  showExpandButton = false 
}: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const mapboxglRef = useRef<any>(null);

  // Memoize valid pins to prevent unnecessary recalculations
  const validPins = useMemo(() => 
    pins.filter(pin => pin.latitude && pin.longitude),
    [pins]
  );

  // Create a stable key for pins to detect actual changes
  const pinsKey = useMemo(() => 
    validPins.map(p => `${p.latitude},${p.longitude},${p.pin_order}`).join('|'),
    [validPins]
  );

  // Lazy load mapbox-gl
  useEffect(() => {
    let isMounted = true;
    
    const loadMapbox = async () => {
      if (mapboxglRef.current) {
        setMapboxLoaded(true);
        return;
      }
      
      try {
        const mapboxgl = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        
        if (isMounted) {
          mapboxglRef.current = mapboxgl.default;
          setMapboxLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load mapbox-gl:', error);
      }
    };

    loadMapbox();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and update map
  useEffect(() => {
    if (!mapContainer.current || !mapboxLoaded || !mapboxglRef.current) return;

    const mapboxgl = mapboxglRef.current;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    // Default center (Warsaw) if no valid pins
    const defaultCenter: [number, number] = [21.0122, 52.2297];
    
    // Calculate center from pins
    let center: [number, number] = defaultCenter;
    if (validPins.length > 0) {
      const avgLng = validPins.reduce((sum, pin) => sum + (pin.longitude || 0), 0) / validPins.length;
      const avgLat = validPins.reduce((sum, pin) => sum + (pin.latitude || 0), 0) / validPins.length;
      center = [avgLng, avgLat];
    }

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: validPins.length === 1 ? 15 : validPins.length > 1 ? 12 : 3,
    });

    mapRef.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: false }),
      'top-right'
    );

    // Add markers for each pin
    validPins.forEach((pin, index) => {
      if (!pin.latitude || !pin.longitude || !mapRef.current) return;

      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background: #000;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      // Use pin_order if available, otherwise fall back to index + 1
      const pinNumber = pin.pin_order !== undefined ? pin.pin_order + 1 : index + 1;
      el.textContent = String(pinNumber);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<p style="font-weight: 500; margin: 0;">${pin.place_name || pin.address || `Punkt ${pinNumber}`}</p>`)
        )
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });

    // Fit bounds when multiple pins
    if (validPins.length > 1 && mapRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      validPins.forEach(pin => {
        if (pin.latitude && pin.longitude) {
          bounds.extend([pin.longitude, pin.latitude]);
        }
      });
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxLoaded, pinsKey]); // Use pinsKey instead of validPins for stable dependency

  return (
    <div 
      className={`relative rounded-lg overflow-hidden border border-border ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div ref={mapContainer} className="w-full h-full min-h-[160px]">
        {!mapboxLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {showExpandButton && onClick && (
        <button 
          className="absolute top-2 left-2 p-2 bg-background/90 backdrop-blur-sm rounded-md border border-border shadow-sm hover:bg-background transition-colors"
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
