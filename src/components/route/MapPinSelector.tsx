import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import InteractiveRouteMap from '@/components/InteractiveRouteMap';

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

interface MapPinSelectorProps {
  existingPins: Pin[];
  onPinSelect: (pinData: NewPinData) => void;
}

const MapPinSelector = ({ existingPins, onPinSelect }: MapPinSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handlePinAdd = (pinData: NewPinData) => {
    onPinSelect(pinData);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex-shrink-0 w-10 h-10 rounded-md border border-input bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
        title="Wybierz na mapie"
      >
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-none">
          <div className="relative w-full h-full">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
              <div className="flex items-center justify-between max-w-lg mx-auto">
                <h2 className="font-semibold">Wybierz lokalizację na mapie</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  Anuluj
                </button>
              </div>
            </div>

            {/* Fullscreen Map */}
            <InteractiveRouteMap
              pins={existingPins}
              className="w-full h-full rounded-none border-none"
              onPinAdd={handlePinAdd}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapPinSelector;
