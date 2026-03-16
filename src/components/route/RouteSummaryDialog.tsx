import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import type { PlanPin } from "./DayPinList";
import PlaceSwiper from "./PlaceSwiper";
import RouteMap from "@/components/RouteMap";

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

  const startDate = preferences.startDate ? new Date(preferences.startDate) : null;
  const endDate = startDate && preferences.numDays > 1
    ? addDays(startDate, preferences.numDays - 1)
    : startDate;

  const dateTitle = startDate
    ? endDate && endDate.getTime() !== startDate.getTime()
      ? `Twoja trasa ${format(startDate, "dd")}-${format(endDate, "dd.MM.yyyy")}`
      : `Twoja trasa ${format(startDate, "dd.MM.yyyy")}`
    : `Twoja trasa — ${plan.city}`;

  const saveRoute = useCallback(async (daysToSave: RoutePlan["days"]) => {
    if (!user || saving) return;
    setSaving(true);

    try {
      let folderId: string | null = null;

      if (daysToSave.length > 1) {
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

      for (const day of daysToSave) {
        const dayDate = startDate
          ? format(addDays(startDate, day.day_number - 1), "yyyy-MM-dd")
          : null;

        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({
            user_id: user.id,
            title: daysToSave.length > 1
              ? `${plan.city} — Dzień ${day.day_number}`
              : `${plan.city}`,
            city: plan.city,
            status: "draft",
            trip_type: "planning" as const,
            folder_id: folderId,
            folder_order: day.day_number - 1,
            day_number: day.day_number,
            start_date: dayDate,
            end_date: daysToSave.length === 1 && endDate ? format(endDate, "yyyy-MM-dd") : dayDate,
            pace: preferences.pace,
            priorities: preferences.priorities,
          })
          .select()
          .single();

        if (routeError) throw routeError;

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
              place_id: pin.place_id ?? null,
            }))
          );
          if (pinsError) throw pinsError;
        }

        await supabase.from("chat_sessions").insert([{
          route_id: route.id,
          user_id: user.id,
          messages: messages as any,
          current_phase: 7,
          completed_at: new Date().toISOString(),
        }]);
      }

      toast({ title: "Trasa zapisana! 🎉", description: `${plan.city}` });
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
  }, [user, saving, plan, preferences, messages, startDate, endDate, navigate, onOpenChange, toast]);

  const handleGoBack = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto p-0 gap-0 [&>button]:hidden">
        <VisuallyHidden>
          <DialogTitle>{dateTitle}</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-0">
          <h2 className="text-xl font-bold leading-tight pr-4">{dateTitle}</h2>
          <button
            onClick={handleGoBack}
            className="shrink-0 mt-0.5"
          >
            <X className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>

        <div className="h-px bg-border mx-5 mt-3" />

        {(() => {
          const allPins = plan.days.flatMap((d, di) =>
            d.pins.filter(p => p.latitude && p.longitude).map((p, pi) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              place_name: p.place_name,
              address: p.address,
              pin_order: plan.days.slice(0, di).reduce((s, dd) => s + dd.pins.length, 0) + pi,
            }))
          );
          return allPins.length > 0 ? (
            <div className="mx-5 mt-4">
              <RouteMap pins={allPins} className="aspect-[16/9] rounded-xl" />
            </div>
          ) : null;
        })()}

        {/* Swiper */}
        {saving ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Zapisuję trasę...</span>
          </div>
        ) : (
          <PlaceSwiper
            days={plan.days}
            totalDays={plan.days.length}
            onFinish={(keptDays) => saveRoute(keptDays)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RouteSummaryDialog;
