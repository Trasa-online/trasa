import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  date?: string | null;
  dayNumber?: number;
}

const TripCheckinSection = ({ routeId, pins, onComplete, date, dayNumber }: TripCheckinSectionProps) => {
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const sortedPins = [...pins].sort((a, b) => a.pin_order - b.pin_order);
  const isVisited = (pinId: string) => !!visited[pinId];

  const togglePin = (pinId: string) => {
    setVisited(prev => ({ ...prev, [pinId]: !isVisited(pinId) }));
  };

  const checkedCount = sortedPins.filter(p => isVisited(p.id)).length;
  const allChecked = sortedPins.length > 0 && checkedCount === sortedPins.length;

  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const handleContinueClick = () => {
    if (checkedCount === 0) {
      setConfirmEmpty(true);
      return;
    }
    handleContinue();
  };

  const handleContinue = async () => {
    setConfirmEmpty(false);
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

  const dayLabel = dayNumber ? `Dzień ${dayNumber}` : "Dzisiaj";
  const dateLabel = date ? format(new Date(date), "dd.MM.yyyy") : null;

  // Gate: active only 1 hour after last pin's suggested_time
  const lastPin = sortedPins[sortedPins.length - 1];
  const unlockTime = (() => {
    if (!lastPin?.suggested_time || !date) return null;
    const [h, m] = lastPin.suggested_time.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const t = new Date(date + "T00:00:00");
    t.setHours(h + 1, m, 0, 0);
    return t;
  })();
  const isUnlocked = !unlockTime || new Date() >= unlockTime;
  const unlockLabel = unlockTime
    ? `${String(unlockTime.getHours()).padStart(2, "0")}:${String(unlockTime.getMinutes()).padStart(2, "0")}`
    : null;

  return (
    <div className="bg-muted/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{dayLabel}</p>
        {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
      </div>

      {allChecked ? (
        /* Congratulation state */
        <div className="text-center py-2">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-semibold">Super! Odwiedziłeś wszystkie miejsca.</p>
          <p className="text-xs text-muted-foreground mt-1">Chcesz o nich opowiedzieć?</p>
          <Button
            onClick={handleContinue}
            disabled={saving || !isUnlocked}
            size="sm"
            className="w-full rounded-full text-sm font-medium mt-4"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Zapisuję...</>
            ) : !isUnlocked ? (
              `Dostępne od ${unlockLabel}`
            ) : (
              "Opowiadam o dniu!"
            )}
          </Button>
        </div>
      ) : (
        /* Checklist */
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {checkedCount}/{sortedPins.length} ukończone · Zaznacz odwiedzone miejsca
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

                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className={cn(
                      "text-[13px] font-medium leading-tight",
                      checked && "line-through text-muted-foreground"
                    )}>
                      {pin.place_name}
                    </p>
                  </div>

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
            onClick={handleContinueClick}
            disabled={saving || !isUnlocked}
            size="sm"
            className="w-full rounded-full text-sm font-medium mt-3"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Zapisuję...</>
            ) : !isUnlocked ? (
              `Dostępne od ${unlockLabel}`
            ) : (
              "Dalej — opowiedz o dniu"
            )}
          </Button>
        </>
      )}

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nie zaznaczyłeś żadnego miejsca</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz kontynuować? Wszystkie miejsca zostaną oznaczone jako pominięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Wróć</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinue}>Kontynuuj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TripCheckinSection;
