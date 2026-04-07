import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { pl } from "date-fns/locale";
import type { PlanPin } from "./DayPinList";
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
  groupSession?: { sessionId: string; otherMemberIds: string[] };
}

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🔭", shopping: "🛍️", experience: "🎪",
  walk: "🚶", church: "⛪", nightlife: "🌙",
};

const RouteSummaryDialog = ({
  open,
  onOpenChange,
  plan,
  preferences,
  messages,
  groupSession,
}: RouteSummaryDialogProps) => {
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const startDate = preferences.startDate ? new Date(preferences.startDate) : null;
  const endDate = startDate && preferences.numDays > 1
    ? addDays(startDate, preferences.numDays - 1)
    : startDate;

  const dateLabel = startDate
    ? format(startDate, "d MMM yyyy", { locale: pl })
    : null;

  const totalPins = plan.days.reduce((s, d) => s + d.pins.length, 0);
  const isMultiDay = plan.days.length > 1;

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

        const routePayload = {
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
          is_shared: false,
          ...(groupSession ? { group_session_id: groupSession.sessionId } : {}),
        };

        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ user_id: user.id, ...routePayload })
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

        // Save the same route for all other group session participants
        if (groupSession?.otherMemberIds?.length && day.day_number === 1) {
          for (const memberId of groupSession.otherMemberIds) {
            const { data: memberRoute } = await supabase
              .from("routes")
              .insert({ user_id: memberId, ...routePayload })
              .select("id")
              .single();
            if (memberRoute && day.pins.length > 0) {
              await supabase.from("pins").insert(
                day.pins.map((pin, idx) => ({
                  route_id: memberRoute.id,
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
            }
          }
        }
      }

      // Submit to route_examples as candidate (silent)
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
      }).then(() => {});

      toast.success("Trasa zapisana! 🎉", { description: plan.city });
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Błąd zapisu", { description: "Spróbuj ponownie." });
    } finally {
      setSaving(false);
    }
  }, [user, saving, plan, preferences, messages, startDate, endDate, navigate, onOpenChange, toast]);

  const allMapPins = plan.days.flatMap((d) =>
    d.pins.filter(p => p.latitude && p.longitude && p.latitude !== 0).map((p, pi) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      place_name: p.place_name,
      address: p.address,
      pin_order: pi,
      day_number: d.day_number,
    }))
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-3xl p-0 flex flex-col [&>button]:hidden"
      >
        <VisuallyHidden>
          <SheetTitle>{plan.city}</SheetTitle>
        </VisuallyHidden>

        {/* Handle */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between px-5 pb-4">
          <div>
            <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-0.5">Twoja trasa</p>
            <h2 className="text-2xl font-black leading-tight">{plan.city}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              {dateLabel && <span>{dateLabel}</span>}
              {dateLabel && <span>·</span>}
              <span>{totalPins} miejsc</span>
              {isMultiDay && <><span>·</span><span>{plan.days.length} dni</span></>}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Map */}
          {allMapPins.length > 0 && (
            <div className="px-5 mb-5">
              <RouteMap pins={allMapPins} className="h-44 rounded-2xl" />
            </div>
          )}

          {/* Timeline */}
          <div className="px-5 pb-4 space-y-6">
            {plan.days.map((day) => (
              <div key={day.day_number}>
                {isMultiDay && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 px-2.5 rounded-full bg-foreground flex items-center">
                      <span className="text-[11px] font-bold text-background">Dzień {day.day_number}</span>
                    </div>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                )}
                <div className="space-y-0">
                  {day.pins.map((pin, idx) => {
                    const isLast = idx === day.pins.length - 1;
                    return (
                      <div key={idx} className="flex items-start gap-3.5">
                        {/* Stepper */}
                        <div className="flex flex-col items-center shrink-0 pt-0.5">
                          <div className="h-7 w-7 rounded-full bg-orange-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm shadow-orange-600/30">
                            {idx + 1}
                          </div>
                          {!isLast && (
                            <div className="w-px flex-1 min-h-[28px] bg-border/50 my-1" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-sm">{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>
                                <p className="text-[15px] font-semibold leading-tight truncate">{pin.place_name}</p>
                              </div>
                              {pin.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{pin.description}</p>
                              )}
                              {pin.walking_time_from_prev && (
                                <p className="text-[11px] text-muted-foreground/60 mt-1">🚶 {pin.walking_time_from_prev}</p>
                              )}
                            </div>
                            {pin.suggested_time && (
                              <span className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                                {pin.suggested_time}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed bottom buttons */}
        <div className="flex-shrink-0 px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] border-t border-border/30 bg-background space-y-2.5">
          <button
            onClick={saveRoute}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 active:scale-[0.98] transition-transform"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Zapisuję...</>
              : "Zapisz trasę →"
            }
          </button>
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl border border-border text-sm font-medium text-muted-foreground disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            Wróć do edycji
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RouteSummaryDialog;
