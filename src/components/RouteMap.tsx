import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

interface Pin {
  latitude?: number;
  longitude?: number;
  place_name?: string;
  is_transport?: boolean;
  pin_order?: number;
}

interface RouteMapProps {
  pins: Pin[];
  className?: string;
}

const RouteMap = ({ pins, className = "" }: RouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    // Filter pins with valid coordinates
    const validPins = pins.filter(pin => pin.latitude && pin.longitude);

    // Default center (Warsaw) if no valid pins
    const defaultCenter: [number, number] = [21.0122, 52.2297];
    
    // Calculate center from pins
    let center: [number, number] = defaultCenter;
    if (validPins.length > 0) {
      const avgLng = validPins.reduce((sum, pin) => sum + (pin.longitude || 0), 0) / validPins.length;
      const avgLat = validPins.reduce((sum, pin) => sum + (pin.latitude || 0), 0) / validPins.length;
      center = [avgLng, avgLat];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: validPins.length === 1 ? 15 : validPins.length > 1 ? 12 : 3,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: false }),
      'top-right'
    );

    // Add markers for each pin
    validPins.forEach((pin, index) => {
      if (!pin.latitude || !pin.longitude || !map.current) return;

      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background: hsl(var(--primary));
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
      el.textContent = String(index + 1);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<p style="font-weight: 500; margin: 0;">${pin.place_name || `Punkt ${index + 1}`}</p>`)
        )
        .addTo(map.current);

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple pins
    if (validPins.length > 1 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      validPins.forEach(pin => {
        if (pin.latitude && pin.longitude) {
          bounds.extend([pin.longitude, pin.latitude]);
        }
      });
      map.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [pins]);

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[160px]" />
    </div>
  );
};

export default RouteMap;
