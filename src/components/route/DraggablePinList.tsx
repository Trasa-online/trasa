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
    <div className="space-y-2">
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
            className={`border border-border rounded-lg p-2.5 bg-card transition-all ${
              isDragging ? 'opacity-50 scale-[0.98]' : ''
            } ${isDragOver ? 'border-primary border-2' : ''} ${
              onPinClick ? 'cursor-pointer hover:border-primary' : ''
            }`}
            onClick={() => onPinClick?.(actualIndex)}
          >
            <div className="flex items-start gap-2">
              <div 
                className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none mt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/60" />
              </div>

              <div className={`flex-shrink-0 ${compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium`}>
                {index + 1}
              </div>
              
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{pin.place_name || pin.address}</p>
                  {pin.rating > 0 && (
                    <div className="flex items-center gap-0.5 text-xs flex-shrink-0">
                      <span className="text-yellow-500">★</span>
                      <span>{pin.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                {pin.address !== pin.place_name && (
                  <p className="text-[11px] text-muted-foreground truncate">{pin.address}</p>
                )}
                
                {pin.tags && pin.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pin.tags.slice(0, compact ? 3 : 4).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                        {tag}
                      </Badge>
                    ))}
                    {pin.tags.length > (compact ? 3 : 4) && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                        +{pin.tags.length - (compact ? 3 : 4)}
                      </Badge>
                    )}
                  </div>
                )}

                {!compact && pin.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{pin.description}</p>
                )}

                {!compact && pin.image_url && (
                  <div className="relative h-24 bg-muted rounded overflow-hidden mt-1.5">
                    <img src={pin.image_url} alt={pin.place_name} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {showRemoveButton && onPinRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinRemove(actualIndex);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
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
