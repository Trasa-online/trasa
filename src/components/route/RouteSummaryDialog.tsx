import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { PlanPin } from "./DayPinList";

interface RoutePlan {
  city: string;
  days: {
    day_number: number;
    pins: PlanPin[];
  }[];
}

interface TripPreferences {
  numDays: number;
  pace: string;
  priorities: string[];
  startDate: string | null;
  planningMode: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RouteSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: RoutePlan;
  preferences: TripPreferences;
  messages: ChatMessage[];
}

const RouteSummaryDialog = ({
  open,
  onOpenChange,
  plan,
  preferences,
  messages,
}: RouteSummaryDialogProps) => {
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const totalPins = plan.days.reduce((sum, d) => sum + d.pins.length, 0);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Create folder for multi-day trips
      let folderId: string | null = null;

      if (plan.days.length > 1) {
        const { data: folder, error: folderError } = await supabase
          .from("route_folders")
          .insert({
            user_id: user.id,
            name: `${plan.city} — ${preferences.numDays} dni`,
            is_trip: true,
            num_days: preferences.numDays,
          })
          .select()
          .single();

        if (folderError) throw folderError;
        folderId = folder.id;
      }

      // Create routes + pins per day
      for (const day of plan.days) {
        const startDate = preferences.startDate
          ? new Date(preferences.startDate)
          : null;
        const dayDate = startDate
          ? new Date(startDate.getTime() + (day.day_number - 1) * 86400000)
              .toISOString()
              .split("T")[0]
          : null;

        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({
            user_id: user.id,
            title: plan.days.length > 1
              ? `${plan.city} — Dzień ${day.day_number}`
              : `${plan.city}`,
            city: plan.city,
            status: "draft",
            trip_type: "planning" as const,
            folder_id: folderId,
            folder_order: day.day_number - 1,
            day_number: day.day_number,
            start_date: dayDate,
            pace: preferences.pace,
            priorities: preferences.priorities,
          })
          .select()
          .single();

        if (routeError) throw routeError;

        // Insert pins
        if (day.pins.length > 0) {
          const { error: pinsError } = await supabase.from("pins").insert(
            day.pins.map((pin, idx) => ({
              route_id: route.id,
              place_name: pin.place_name,
              address: pin.address,
              description: pin.description,
              pin_order: idx,
              latitude: pin.latitude,
              longitude: pin.longitude,
              suggested_time: pin.suggested_time,
              category: pin.category,
              original_creator_id: user.id,
            }))
          );

          if (pinsError) throw pinsError;
        }

        // Save chat session
        await supabase.from("chat_sessions").insert([{
          route_id: route.id,
          user_id: user.id,
          messages: messages as any,
          current_phase: 7,
          completed_at: new Date().toISOString(),
        }]);
      }

      toast({ title: "Trasa zapisana! 🎉", description: `${plan.city} — ${totalPins} miejsc` });
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Błąd zapisu",
        description: "Nie udało się zapisać trasy. Spróbuj ponownie.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            📍 {plan.city}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {totalPins} miejsc
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {plan.days.length} {plan.days.length === 1 ? "dzień" : "dni"}
            </div>
          </div>

          {/* Timeline per day */}
          {plan.days.map((day) => (
            <div key={day.day_number} className="space-y-2">
              {plan.days.length > 1 && (
                <h3 className="text-sm font-semibold">Dzień {day.day_number}</h3>
              )}
              <div className="relative pl-6 space-y-3">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                
                {day.pins.map((pin, idx) => (
                  <div key={idx} className="relative flex items-start gap-3">
                    {/* Dot */}
                    <div className="absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full bg-foreground border-2 border-background" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {pin.suggested_time}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {pin.place_name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pin.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4"
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Zapisuję...
            </>
          ) : (
            "Dodaj trasę"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default RouteSummaryDialog;
