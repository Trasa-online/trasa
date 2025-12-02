import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";

interface Pin {
  id?: string;
  place_name: string;
  address: string;
  description: string;
  image_url: string;
  images: string[];
  rating: number;
  pin_order: number;
  tags: string[];
  mentioned_users: string[];
  latitude?: number;
  longitude?: number;
}

interface DraggablePinListProps {
  pins: Pin[];
  onReorder: (pins: Pin[]) => void;
  onPinClick?: (index: number) => void;
  onPinRemove?: (index: number) => void;
  showRemoveButton?: boolean;
  compact?: boolean;
}

const DraggablePinList = ({
  pins,
  onReorder,
  onPinClick,
  onPinRemove,
  showRemoveButton = true,
  compact = false,
}: DraggablePinListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPins = [...pins];
    const [draggedPin] = newPins.splice(draggedIndex, 1);
    newPins.splice(dropIndex, 0, draggedPin);
    
    // Update pin_order for all pins
    const reorderedPins = newPins.map((pin, idx) => ({
      ...pin,
      pin_order: idx,
    }));

    onReorder(reorderedPins);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const filteredPins = pins.filter(p => p.address);

  return (
    <div className="space-y-3">
      {filteredPins.map((pin, index) => {
        const actualIndex = pins.findIndex(p => p.pin_order === pin.pin_order);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div
            key={pin.pin_order}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`border border-border rounded-lg ${compact ? 'p-3' : 'p-3'} bg-card transition-all ${
              isDragging ? 'opacity-50 scale-95' : ''
            } ${isDragOver ? 'border-primary border-2' : ''} ${
              onPinClick ? 'cursor-pointer hover:border-primary' : ''
            }`}
            onClick={() => onPinClick?.(actualIndex)}
          >
            <div className="flex items-start gap-3">
              <div 
                className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className={`flex-shrink-0 ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium`}>
                {index + 1}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{pin.place_name || pin.address}</p>
                  {pin.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-yellow-500">★</span>
                      <span>{pin.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{pin.address}</p>
                
                {pin.tags && pin.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pin.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {pin.tags.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        +{pin.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {!compact && pin.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{pin.description}</p>
                )}

                {!compact && pin.image_url && (
                  <div className="relative h-32 bg-muted rounded overflow-hidden mt-2">
                    <img src={pin.image_url} alt={pin.place_name} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {showRemoveButton && onPinRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinRemove(actualIndex);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraggablePinList;
