import { useState } from "react";
import { Trash2, GripVertical, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanPin {
  place_name: string;
  address: string;
  description: string;
  suggested_time: string;
  category: string;
  latitude: number;
  longitude: number;
  day_number: number;
}

interface DayPinListProps {
  dayNumber: number;
  totalDays: number;
  pins: PlanPin[];
  onRemovePin: (dayNumber: number, pinIndex: number) => void;
  onReorderPins?: (dayNumber: number, pins: PlanPin[]) => void;
  onPinClick?: (pin: PlanPin) => void;
  onAddPin?: (dayNumber: number) => void;
}

const categoryLabels: Record<string, string> = {
  restaurant: "restauracja",
  cafe: "kawiarnia",
  museum: "muzeum",
  park: "park",
  viewpoint: "punkt widokowy",
  shopping: "zakupy",
  nightlife: "życie nocne",
  monument: "zabytek",
  church: "kościół",
  market: "targ",
  bar: "bar",
  gallery: "galeria",
};

const DayPinList = ({
  dayNumber,
  totalDays,
  pins,
  onRemovePin,
  onReorderPins,
  onPinClick,
  onAddPin,
}: DayPinListProps) => {
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

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !onReorderPins) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPins = [...pins];
    const [dragged] = newPins.splice(draggedIndex, 1);
    newPins.splice(dropIndex, 0, dragged);
    onReorderPins(dayNumber, newPins);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          Dzień #{dayNumber} z {totalDays}
        </h3>
        {onAddPin && (
          <button
            onClick={() => onAddPin(dayNumber)}
            className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {pins.map((pin, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={index}
              draggable={!!onReorderPins}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 bg-muted/50 rounded-xl p-3 transition-all",
                isDragging && "opacity-40 scale-[0.97]",
                isDragOver && "ring-2 ring-foreground/20",
                onPinClick && "cursor-pointer active:scale-[0.98]"
              )}
              onClick={() => onPinClick?.(pin)}
            >
              {/* Drag handle */}
              <div
                className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Number badge */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">
                  {pin.place_name}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {categoryLabels[pin.category]
                    ? `Kategoria (${categoryLabels[pin.category]})`
                    : pin.description}
                </p>
              </div>

              {/* Time */}
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
                {pin.suggested_time || "00:00"}
              </div>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePin(dayNumber, index);
                }}
                className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayPinList;
