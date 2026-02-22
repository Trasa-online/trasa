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
  const isVisited = (pinId: string) => visited[pinId] !== false;

  const togglePin = (pinId: string) => {
    setVisited(prev => ({ ...prev, [pinId]: !isVisited(pinId) }));
  };

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
    <div className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-4">
      <p className="text-sm font-medium mb-1">Które miejsca odwiedziłeś?</p>
      <p className="text-xs text-muted-foreground mb-3">
        Odznacz pominięte — zapytamy o nie w rozmowie.
      </p>

      <div className="space-y-2">
        {sortedPins.map((pin, idx) => {
          const checked = isVisited(pin.id);
          return (
            <button
              key={pin.id}
              onClick={() => togglePin(pin.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                checked
                  ? "border-border/20 bg-background"
                  : "border-dashed border-border/30 bg-muted/10 opacity-50"
              )}
            >
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                  checked
                    ? "border-foreground bg-foreground"
                    : "border-border/50 bg-transparent"
                )}
              >
                {checked && <Check className="h-3 w-3 text-background" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-[13px] font-medium",
                  !checked && "line-through text-muted-foreground"
                )}>
                  {idx + 1}. {pin.place_name}
                </p>
              </div>
              {pin.suggested_time && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {pin.suggested_time}
                </span>
              )}
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
