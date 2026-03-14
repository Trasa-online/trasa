import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AddPlaceSheet from "./AddPlaceSheet";

interface Pin {
  id: string;
  place_name: string;
  pin_order: number;
  suggested_time?: string | null;
}

interface RouteEditorProps {
  routeId: string;
  initialPins: Pin[];
  dayLabel: string;
  dateLabel?: string | null;
  canReview: boolean;
  onStartReview: () => void;
}

const RouteEditor = ({ routeId, initialPins, dayLabel, dateLabel, canReview, onStartReview }: RouteEditorProps) => {
  const [pins, setPins] = useState<Pin[]>(() =>
    [...initialPins].sort((a, b) => a.pin_order - b.pin_order)
  );
  const [addOpen, setAddOpen] = useState(false);

  const sorted = [...pins].sort((a, b) => a.pin_order - b.pin_order);

  const moveUp = useCallback(async (pinId: string) => {
    const s = [...pins].sort((a, b) => a.pin_order - b.pin_order);
    const idx = s.findIndex(p => p.id === pinId);
    if (idx <= 0) return;
    const pinA = s[idx];
    const pinB = s[idx - 1];
    setPins(prev => prev.map(p => {
      if (p.id === pinA.id) return { ...p, pin_order: pinB.pin_order };
      if (p.id === pinB.id) return { ...p, pin_order: pinA.pin_order };
      return p;
    }));
    await Promise.all([
      supabase.from("pins").update({ pin_order: pinB.pin_order }).eq("id", pinA.id),
      supabase.from("pins").update({ pin_order: pinA.pin_order }).eq("id", pinB.id),
    ]);
  }, [pins]);

  const moveDown = useCallback(async (pinId: string) => {
    const s = [...pins].sort((a, b) => a.pin_order - b.pin_order);
    const idx = s.findIndex(p => p.id === pinId);
    if (idx >= s.length - 1) return;
    const pinA = s[idx];
    const pinB = s[idx + 1];
    setPins(prev => prev.map(p => {
      if (p.id === pinA.id) return { ...p, pin_order: pinB.pin_order };
      if (p.id === pinB.id) return { ...p, pin_order: pinA.pin_order };
      return p;
    }));
    await Promise.all([
      supabase.from("pins").update({ pin_order: pinB.pin_order }).eq("id", pinA.id),
      supabase.from("pins").update({ pin_order: pinA.pin_order }).eq("id", pinB.id),
    ]);
  }, [pins]);

  const deletePin = useCallback(async (pinId: string) => {
    const pin = pins.find(p => p.id === pinId);
    if (!pin) return;
    setPins(prev => prev.filter(p => p.id !== pinId));
    let undone = false;
    toast(`Usunięto „${pin.place_name}"`, {
      duration: 4000,
      action: {
        label: "Cofnij",
        onClick: () => {
          undone = true;
          setPins(prev => [...prev, pin].sort((a, b) => a.pin_order - b.pin_order));
        },
      },
    });
    setTimeout(async () => {
      if (!undone) await supabase.from("pins").delete().eq("id", pinId);
    }, 4200);
  }, [pins]);

  const addPin = useCallback(async (name: string, details?: { full_address?: string; latitude?: number; longitude?: number }) => {
    const maxOrder = pins.length > 0 ? Math.max(...pins.map(p => p.pin_order)) : 0;
    const newOrder = maxOrder + 1;
    const tempId = `temp-${Date.now()}`;
    setPins(prev => [...prev, { id: tempId, place_name: name, pin_order: newOrder }]);
    const { data, error } = await supabase
      .from("pins")
      .insert({
        route_id: routeId,
        place_name: name,
        pin_order: newOrder,
        address: details?.full_address ?? null,
        latitude: details?.latitude ?? null,
        longitude: details?.longitude ?? null,
        was_spontaneous: true,
      })
      .select("id, place_name, pin_order, suggested_time")
      .single();
    if (error || !data) {
      setPins(prev => prev.filter(p => p.id !== tempId));
      toast.error("Nie udało się dodać miejsca");
      return;
    }
    setPins(prev => prev.map(p => p.id === tempId ? data : p));
    toast.success(`Dodano „${name}"`);
  }, [pins, routeId]);

  return (
    <div className="bg-muted/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{dayLabel}</p>
        {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
      </div>

      <div className="space-y-1 mb-3">
        {sorted.map((pin, idx) => (
          <div
            key={pin.id}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2.5 transition-opacity",
              pin.id.startsWith("temp-") ? "opacity-50 bg-muted/40" : "bg-background/60"
            )}
          >
            <span className="text-xs text-muted-foreground w-4 shrink-0 text-center font-medium">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium leading-tight truncate">{pin.place_name}</p>
              {pin.suggested_time && (
                <p className="text-[11px] text-muted-foreground">{pin.suggested_time}</p>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => moveUp(pin.id)}
                disabled={idx === 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveDown(pin.id)}
                disabled={idx === sorted.length - 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deletePin(pin.id)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Brak miejsc — dodaj pierwsze!</p>
        )}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-sm mb-3"
      >
        <Plus className="h-3.5 w-3.5" />
        Dodaj miejsce
      </button>

      {canReview && (
        <Button
          onClick={onStartReview}
          size="sm"
          className="w-full rounded-full text-sm font-medium"
        >
          Opowiedz o dniu
        </Button>
      )}

      <AddPlaceSheet open={addOpen} onOpenChange={setAddOpen} onAdd={addPin} />
    </div>
  );
};

export default RouteEditor;
