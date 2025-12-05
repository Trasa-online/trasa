import { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFjaWFzMzQiLCJhIjoiY21pbmgxeWUzMjI0czNqc2Y0ZGl4Nnp6diJ9.iYtSuDlTEsCGTfuyNJzpmg";

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

export const FullscreenMapDialog = ({ open, onOpenChange, pins, title }: FullscreenMapDialogProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!open || !mapContainer.current) return;

    // Small delay to ensure dialog is fully rendered
    const timeout = setTimeout(() => {
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
        zoom: validPins.length === 1 ? 15 : validPins.length > 1 ? 12 : 3,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: false }),
        'top-right'
      );

      // Add markers
      validPins.forEach((pin, index) => {
        if (!pin.latitude || !pin.longitude || !map.current) return;

        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.cssText = `
          width: 36px;
          height: 36px;
          background: #000;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        `;
        el.textContent = String(index + 1);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([pin.longitude, pin.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 4px;">
                  <p style="font-weight: 600; margin: 0 0 4px 0;">${index + 1}. ${pin.place_name || pin.address || `Punkt ${index + 1}`}</p>
                  ${pin.address && pin.place_name ? `<p style="font-size: 12px; color: #666; margin: 0;">${pin.address}</p>` : ''}
                </div>
              `)
          )
          .addTo(map.current);

        markersRef.current.push(marker);
      });

      // Fit bounds
      if (validPins.length > 1 && map.current) {
        const bounds = new mapboxgl.LngLatBounds();
        validPins.forEach(pin => {
          if (pin.latitude && pin.longitude) {
            bounds.extend([pin.longitude, pin.latitude]);
          }
        });
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [open, pins]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 gap-0 border-0 rounded-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background/90 to-transparent">
          <h2 className="font-semibold text-lg truncate pr-4">{title || "Mapa trasy"}</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 bg-background/90 backdrop-blur-sm rounded-full border border-border shadow-sm hover:bg-background transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pin list */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-background/95 to-transparent">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {pins
              .filter(pin => pin.latitude && pin.longitude)
              .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0))
              .map((pin, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (map.current && pin.latitude && pin.longitude) {
                      map.current.flyTo({
                        center: [pin.longitude, pin.latitude],
                        zoom: 16,
                        duration: 1000
                      });
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-full whitespace-nowrap hover:bg-muted transition-colors shrink-0"
                >
                  <span className="w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium max-w-[150px] truncate">
                    {pin.place_name || pin.address || `Punkt ${index + 1}`}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainer} className="w-full h-full" />
      </DialogContent>
    </Dialog>
  );
};
