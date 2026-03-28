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
import RoutePlanTimeline from "./RoutePlanTimeline";
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

  const saveRoute = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    try {
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

      for (const day of plan.days) {
        const dayDate = startDate
          ? format(addDays(startDate, day.day_number - 1), "yyyy-MM-dd")
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
            end_date: plan.days.length === 1 && endDate ? format(endDate, "yyyy-MM-dd") : dayDate,
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

      // Submit to route_examples as candidate (silent background — never blocks user)
      const inferPersonality = (priorities: string[], pace: string) => {
        if (priorities.includes("museums") || priorities.includes("art")) return "kulturalny";
        if (priorities.includes("history")) return "historyczny";
        if (priorities.includes("cafes") || priorities.includes("coffee")) return "kawiarniany";
        if (priorities.includes("nightlife") || priorities.includes("bars")) return "nocny";
        if (priorities.includes("active") || pace === "active") return "aktywny";
        if (priorities.includes("shopping")) return "zakupowy";
        return "mix";
      };
      const personalityType = inferPersonality(preferences.priorities ?? [], preferences.pace ?? "mixed");
      const examplePins = plan.days[0]?.pins.map(p => ({
        place_name: p.place_name,
        category: p.category,
        suggested_time: p.suggested_time,
        duration_minutes: p.duration_minutes ?? 60,
        walking_time_from_prev: p.walking_time_from_prev ?? null,
        note: p.description ?? null,
      })) ?? [];
      supabase.from("route_examples" as any).insert({
        city: plan.city,
        title: `${plan.city} — ${personalityType}`,
        personality_type: personalityType,
        pins: examplePins,
        is_approved: false,
        is_rejected: false,
      }).then(() => {/* silent */});

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

  const allPins = plan.days.flatMap((d, di) =>
    d.pins.filter(p => p.latitude && p.longitude).map((p, pi) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      place_name: p.place_name,
      address: p.address,
      pin_order: plan.days.slice(0, di).reduce((s, dd) => s + dd.pins.length, 0) + pi,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-md h-[88vh] p-0 gap-0 [&>button]:hidden flex flex-col overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{dateTitle}</DialogTitle>
        </VisuallyHidden>

        {/* Header — fixed */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
          <h2 className="text-lg font-bold leading-tight pr-4">{dateTitle}</h2>
          <button onClick={handleGoBack} className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {allPins.length > 0 && (
            <div className="mx-5 mt-4">
              <RouteMap pins={allPins} className="h-40 rounded-2xl" />
            </div>
          )}
          <RoutePlanTimeline days={plan.days} totalDays={plan.days.length} />
        </div>

        {/* Buttons — fixed at bottom */}
        <div className="flex-shrink-0 flex flex-col gap-2.5 px-5 pt-3 pb-6 border-t border-border/40 bg-background">
          <button
            onClick={saveRoute}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-orange-500 text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Zapisuję...</>
            ) : (
              "Zapisz trasę →"
            )}
          </button>
          <button
            onClick={handleGoBack}
            disabled={saving}
            className="w-full py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground disabled:opacity-50"
          >
            Wróć do edycji
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteSummaryDialog;
