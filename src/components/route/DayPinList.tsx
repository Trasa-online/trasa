import { Reorder, useDragControls } from "framer-motion";
import { Trash2, GripVertical, Plus, Footprints, RefreshCw, ChevronUp, ChevronDown, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanPin {
  place_name: string;
  address: string;
  description: string;
  suggested_time: string;
  duration_minutes?: number;
  category: string;
  latitude: number;
  longitude: number;
  day_number: number;
  walking_time_from_prev?: string | null;
  distance_from_prev?: string | null;
  place_id?: string | null;
  pros?: string[];
  cons?: string[];
  photoUrl?: string;
  creator?: {
    platform: "youtube" | "tiktok" | "instagram";
    name: string;
    thumbnailUrl: string;
    postUrl: string;
  };
  creators?: {
    platform: "youtube" | "tiktok" | "instagram";
    name: string;
    thumbnailUrl: string;
    postUrl: string;
    description?: string;
  }[];
}

interface DayPinListProps {
  dayNumber: number;
  totalDays: number;
  pins: PlanPin[];
  onRemovePin: (dayNumber: number, pinIndex: number) => void;
  onReorderPins?: (dayNumber: number, pins: PlanPin[]) => void;
  onPinClick?: (pin: PlanPin) => void;
  onAddPin?: (dayNumber: number) => void;
  onAlternatives?: (pin: PlanPin, pinIndex: number) => void;
  onMoveToDay?: (fromDay: number, pinIndex: number, toDay: number) => void;
}

const categoryLabels: Record<string, string> = {
  restaurant: "Restauracja",
  cafe: "Kawiarnia",
  museum: "Muzeum",
  park: "Park",
  viewpoint: "Widok",
  shopping: "Zakupy",
  nightlife: "Nocne życie",
  monument: "Zabytek",
  church: "Kościół",
  market: "Targ",
  bar: "Bar",
  gallery: "Galeria",
  walk: "Spacer",
};

// Wnetrze wizytowki pinu (wspolne dla wersji reorderowalnej i nie). `dragHandle` to opcjonalny
// uchwyt drag (GripVertical) wstrzykiwany tylko w trybie reorder.
interface PinRowProps {
  pin: PlanPin;
  index: number;
  pins: PlanPin[];
  dayNumber: number;
  totalDays: number;
  onRemovePin: DayPinListProps["onRemovePin"];
  onReorderPins?: DayPinListProps["onReorderPins"];
  onPinClick?: DayPinListProps["onPinClick"];
  onAlternatives?: DayPinListProps["onAlternatives"];
  onMoveToDay?: DayPinListProps["onMoveToDay"];
  dragHandle?: React.ReactNode;
}

const PinRowContent = ({
  pin, index, pins, dayNumber, totalDays,
  onRemovePin, onReorderPins, onPinClick, onAlternatives, onMoveToDay, dragHandle,
}: PinRowProps) => {
  const walkInfo = pin.walking_time_from_prev || pin.distance_from_prev;
  return (
    <>
      {/* Walking connector - shown before each pin except the first */}
      {index > 0 && walkInfo && (
        <div className="flex items-center gap-1.5 pl-[52px] py-1 text-[11px] text-muted-foreground/60">
          <Footprints className="h-3 w-3 shrink-0" />
          {pin.walking_time_from_prev && <span>{pin.walking_time_from_prev}</span>}
          {pin.walking_time_from_prev && pin.distance_from_prev && <span>·</span>}
          {pin.distance_from_prev && <span>{pin.distance_from_prev}</span>}
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-2 bg-card rounded-2xl p-3 transition-colors border border-border/40",
          onPinClick && "cursor-pointer active:scale-[0.98]"
        )}
        onClick={() => onPinClick?.(pin)}
      >
        {/* Reorder: chevrony (gora/dol) ZOSTAJA + uchwyt drag (przeciaganie na dotyk). */}
        {onReorderPins && (
          <div className="flex-shrink-0 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-0">
              <button
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  const newPins = [...pins];
                  [newPins[index], newPins[index - 1]] = [newPins[index - 1], newPins[index]];
                  onReorderPins(dayNumber, newPins);
                }}
                aria-label="W górę"
                className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={index === pins.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  const newPins = [...pins];
                  [newPins[index], newPins[index + 1]] = [newPins[index + 1], newPins[index]];
                  onReorderPins(dayNumber, newPins);
                }}
                aria-label="W dół"
                className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            {dragHandle}
          </div>
        )}

        {/* Number badge */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {pin.place_name}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {categoryLabels[pin.category] && (
              <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                {categoryLabels[pin.category]}
              </span>
            )}
            {pin.description && (
              <p className="text-xs text-muted-foreground truncate">
                {pin.description}
              </p>
            )}
          </div>
        </div>

        {/* Czas trwania (bez godzin - usuniete jako zbedne) */}
        {pin.duration_minutes ? (
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground/60">
              {pin.duration_minutes} min
            </span>
          </div>
        ) : null}

        {/* Alternatives */}
        {onAlternatives && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlternatives(pin, index);
            }}
            className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
            title="Pokaż alternatywy"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Move to day - only for multi-day trips */}
        {onMoveToDay && totalDays > 1 && (
          <div className="flex-shrink-0 flex flex-col gap-0.5">
            {Array.from({ length: totalDays }, (_, i) => i + 1)
              .filter((d) => d !== dayNumber)
              .map((targetDay) => (
                <button
                  key={targetDay}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveToDay(dayNumber, index, targetDay);
                  }}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted px-1 py-0.5 rounded transition-colors"
                  title={`Przenieś do dnia ${targetDay}`}
                >
                  <MoveRight className="h-3 w-3" />
                  <span>D{targetDay}</span>
                </button>
              ))}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemovePin(dayNumber, index);
          }}
          className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </>
  );
};

// Element listy z przeciaganiem (framer-motion Reorder). Drag startuje TYLKO z uchwytu
// (GripVertical) przez useDragControls + dragListener=false, zeby tap w wizytowke i
// klikniecia w przyciski (chevrony/kosz) dzialaly normalnie. HTML5 draggable nie dziala
// w iOS WebView - framer-motion dziala na dotyk.
const DayPinReorderItem = (props: PinRowProps) => {
  const controls = useDragControls();
  const dragHandle = (
    <div
      onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }}
      onClick={(e) => e.stopPropagation()}
      className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5"
      style={{ touchAction: "none" }}
      aria-label="Przeciągnij, aby zmienić kolejność"
    >
      <GripVertical className="h-4 w-4" />
    </div>
  );
  return (
    <Reorder.Item
      as="div"
      value={props.pin}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 0.98, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}
    >
      <PinRowContent {...props} dragHandle={dragHandle} />
    </Reorder.Item>
  );
};

const DayPinList = ({
  dayNumber,
  totalDays,
  pins,
  onRemovePin,
  onReorderPins,
  onPinClick,
  onAddPin,
  onAlternatives,
  onMoveToDay,
}: DayPinListProps) => {
  const pinKey = (pin: PlanPin, index: number) => `${pin.place_id ?? pin.place_name}-${index}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          {totalDays > 1 ? `Dzień ${dayNumber} z ${totalDays}` : "Plan dnia"}
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

      {onReorderPins ? (
        <Reorder.Group
          as="div"
          axis="y"
          values={pins}
          onReorder={(newPins) => onReorderPins(dayNumber, newPins as PlanPin[])}
          className="space-y-0"
        >
          {pins.map((pin, index) => (
            <DayPinReorderItem
              key={pinKey(pin, index)}
              pin={pin}
              index={index}
              pins={pins}
              dayNumber={dayNumber}
              totalDays={totalDays}
              onRemovePin={onRemovePin}
              onReorderPins={onReorderPins}
              onPinClick={onPinClick}
              onAlternatives={onAlternatives}
              onMoveToDay={onMoveToDay}
            />
          ))}
        </Reorder.Group>
      ) : (
        <div className="space-y-0">
          {pins.map((pin, index) => (
            <PinRowContent
              key={pinKey(pin, index)}
              pin={pin}
              index={index}
              pins={pins}
              dayNumber={dayNumber}
              totalDays={totalDays}
              onRemovePin={onRemovePin}
              onPinClick={onPinClick}
              onAlternatives={onAlternatives}
              onMoveToDay={onMoveToDay}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DayPinList;
