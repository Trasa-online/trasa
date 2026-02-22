import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Pin {
  id: string;
  place_name: string;
  pin_order: number;
  suggested_time?: string | null;
}

interface TripCheckinSectionProps {
  routeId: string;
  pins: Pin[];
  onComplete: (routeId: string) => void;
}

const TripCheckinSection = ({ routeId, pins, onComplete }: TripCheckinSectionProps) => {
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const sortedPins = [...pins].sort((a, b) => a.pin_order - b.pin_order);
  const isVisited = (pinId: string) => !!visited[pinId];

  const togglePin = (pinId: string) => {
    setVisited(prev => ({ ...prev, [pinId]: !isVisited(pinId) }));
  };

  const checkedCount = sortedPins.filter(p => isVisited(p.id)).length;

  const handleContinue = async () => {
    setSaving(true);
    try {
      await Promise.all(
        sortedPins.map((pin) =>
          supabase.from("pins").update({ was_skipped: !isVisited(pin.id) }).eq("id", pin.id)
        )
      );
    } catch (err) {
      console.error("Failed to save pin visits:", err);
    }
    setSaving(false);
    onComplete(routeId);
  };

  return (
    <div className="mt-2 rounded-xl bg-muted/60 p-4">
      <p className="text-sm font-medium mb-1">Które miejsca odwiedziłeś?</p>
      <p className="text-xs text-muted-foreground mb-3">
        {checkedCount}/{sortedPins.length} ukończone · Odznacz odwiedzone
      </p>

      <div className="space-y-0">
        {sortedPins.map((pin, idx) => {
          const checked = isVisited(pin.id);
          const isLast = idx === sortedPins.length - 1;
          return (
            <button
              key={pin.id}
              onClick={() => togglePin(pin.id)}
              className="w-full flex items-start gap-3 text-left py-2.5"
            >
              {/* Stepper: number circle + line */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                    checked
                      ? "bg-foreground text-background"
                      : "bg-transparent border-2 border-border text-muted-foreground"
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                {!isLast && (
                  <div className="w-px flex-1 min-h-[20px] bg-border/60 my-1" />
                )}
              </div>

              {/* Place name */}
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={cn(
                  "text-[13px] font-medium leading-tight",
                  checked && "line-through text-muted-foreground"
                )}>
                  {pin.place_name}
                </p>
              </div>

              {/* Checkbox + time on right */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <div
                  className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                    checked
                      ? "border-foreground bg-foreground"
                      : "border-border bg-card"
                  )}
                >
                  {checked && <Check className="h-3 w-3 text-background" />}
                </div>
                {pin.suggested_time && (
                  <span className="text-[10px] text-muted-foreground">
                    {pin.suggested_time}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleContinue}
        disabled={saving}
        size="sm"
        className="w-full rounded-full text-sm font-medium mt-3"
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Zapisuję...</>
        ) : (
          "Dalej — opowiedz o dniu"
        )}
      </Button>
    </div>
  );
};

export default TripCheckinSection;
