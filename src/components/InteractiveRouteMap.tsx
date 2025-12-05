import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

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

const InteractiveRouteMap = ({ pins, className = "", onPinAdd }: InteractiveRouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPin, setPendingPin] = useState<NewPinData | null>(null);

  const reverseGeocode = async (lng: number, lat: number): Promise<{ placeName: string; fullAddress: string } | null> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=poi,address,place,locality&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const placeName = feature.text || '';
        const fullAddress = feature.place_name || '';
        return { placeName, fullAddress };
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
    const { lng, lat } = e.lngLat;
    
    // Remove previous temp marker and popup
    tempMarkerRef.current?.remove();
    popupRef.current?.remove();
    
    setIsLoading(true);
    setPendingPin(null);
    
    // Add temporary marker
    const tempEl = document.createElement('div');
    tempEl.style.cssText = `
      width: 32px;
      height: 32px;
      background: hsl(var(--primary));
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      animation: pulse 1.5s infinite;
    `;
    tempEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    
    tempMarkerRef.current = new mapboxgl.Marker(tempEl)
      .setLngLat([lng, lat])
      .addTo(map.current!);
    
    // Reverse geocode
    const result = await reverseGeocode(lng, lat);
    setIsLoading(false);
    
    if (result) {
      const pinData: NewPinData = {
        latitude: lat,
        longitude: lng,
        place_name: result.placeName,
        address: result.fullAddress,
      };
      setPendingPin(pinData);
      
      // Create popup with add button
      const popupContent = document.createElement('div');
      popupContent.style.cssText = 'padding: 8px; min-width: 200px;';
      popupContent.innerHTML = `
        <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${result.placeName || 'Nowa lokalizacja'}</p>
        <p style="color: #666; margin: 0 0 12px 0; font-size: 12px; line-height: 1.4;">${result.fullAddress}</p>
        <button id="add-pin-btn" style="
          width: 100%;
          padding: 8px 16px;
          background: #000;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Dodaj pin
        </button>
      `;
      
      popupRef.current = new mapboxgl.Popup({ offset: 25, closeButton: true })
        .setLngLat([lng, lat])
        .setDOMContent(popupContent)
        .addTo(map.current!);
      
      // Handle add button click
      const addBtn = popupContent.querySelector('#add-pin-btn');
      addBtn?.addEventListener('click', () => {
        onPinAdd(pinData);
        tempMarkerRef.current?.remove();
        popupRef.current?.remove();
        setPendingPin(null);
      });
      
      popupRef.current.on('close', () => {
        tempMarkerRef.current?.remove();
        setPendingPin(null);
      });
    } else {
      // No geocoding result - still allow adding with coordinates only
      const pinData: NewPinData = {
        latitude: lat,
        longitude: lng,
        place_name: '',
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      };
      setPendingPin(pinData);
      
      const popupContent = document.createElement('div');
      popupContent.style.cssText = 'padding: 8px; min-width: 180px;';
      popupContent.innerHTML = `
        <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">Nowa lokalizacja</p>
        <p style="color: #666; margin: 0 0 12px 0; font-size: 12px;">${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        <button id="add-pin-btn" style="
          width: 100%;
          padding: 8px 16px;
          background: #000;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Dodaj pin
        </button>
      `;
      
      popupRef.current = new mapboxgl.Popup({ offset: 25, closeButton: true })
        .setLngLat([lng, lat])
        .setDOMContent(popupContent)
        .addTo(map.current!);
      
      const addBtn = popupContent.querySelector('#add-pin-btn');
      addBtn?.addEventListener('click', () => {
        onPinAdd(pinData);
        tempMarkerRef.current?.remove();
        popupRef.current?.remove();
        setPendingPin(null);
      });
      
      popupRef.current.on('close', () => {
        tempMarkerRef.current?.remove();
        setPendingPin(null);
      });
    }
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const validPins = pins.filter(pin => pin.latitude && pin.longitude);
    const defaultCenter: [number, number] = [21.0122, 52.2297];
    
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
      zoom: validPins.length === 1 ? 15 : validPins.length > 1 ? 12 : 5,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: false }),
      'top-right'
    );

    // Add click handler
    map.current.on('click', handleMapClick);

    // Add markers for existing pins
    validPins.forEach((pin, index) => {
      if (!pin.latitude || !pin.longitude || !map.current) return;

      const el = document.createElement('div');
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
      el.textContent = String(index + 1);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<p style="font-weight: 500; margin: 0;">${pin.place_name || pin.address || `Punkt ${index + 1}`}</p>`)
        )
        .addTo(map.current);

      markersRef.current.push(marker);
    });

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
      tempMarkerRef.current?.remove();
      popupRef.current?.remove();
      map.current?.remove();
    };
  }, [pins]);

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border ${className}`}>
      <div ref={mapContainer} className="w-full h-full min-h-[200px]" />
      
      {/* Instruction overlay */}
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
        <div className="bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-sm border border-border">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Kliknij na mapie, aby dodać pin</span>
        </div>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs flex items-center gap-2 shadow-sm border border-border">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Szukam miejsca...</span>
        </div>
      )}
      
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default InteractiveRouteMap;
