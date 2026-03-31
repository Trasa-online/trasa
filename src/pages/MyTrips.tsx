import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import RoutePreviewModal from "@/components/route/RoutePreviewModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import TripDayView from "@/components/home/TripDayView";
import UpcomingTripCard from "@/components/home/UpcomingTripCard";
import PlaceDetailSheet from "@/components/home/PlaceDetailSheet";
import { useTranslation } from "react-i18next";

const ACCENTS = [
  { bar: "bg-blue-500" },
  { bar: "bg-violet-500" },
  { bar: "bg-amber-400" },
  { bar: "bg-emerald-500" },
  { bar: "bg-rose-500" },
  { bar: "bg-cyan-500" },
];

const MyTrips = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation("common");

  const [activeTab, setActiveTab] = useState<"aktywne" | "next-up">("aktywne");
  const [previewRoute, setPreviewRoute] = useState<any>(null);
  const [deletingTrip, setDeletingTrip] = useState<any>(null);
  const [selectedNextUpPin, setSelectedNextUpPin] = useState<any>(null);

  const { data: activeRoutes, isLoading: routesLoading } = useQuery({
    queryKey: ["active-routes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("*, pins(*)")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Auto-activate trips whose start_date has arrived
  useEffect(() => {
    if (!activeRoutes || !user) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const toActivate = (activeRoutes as any[]).filter(
      r => r.trip_type === "planning" && r.start_date && r.start_date <= todayStr
    );
    if (toActivate.length === 0) return;
    supabase.from("routes").update({ trip_type: "ongoing" }).in("id", toActivate.map(r => r.id))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes-orb"] });
      });
  }, [activeRoutes, user, queryClient]);

  const getTrips = () => {
    if (!activeRoutes) return [];
    return (activeRoutes as any[]).map(route => ({
      id: route.id,
      city: route.city || "Trasa",
      startDate: route.start_date || null,
      endDate: route.start_date || null,
      priorities: route.priorities || [],
      pinCount: (route.pins || []).length,
      routes: [route],
    }));
  };

  const handleTripClick = (trip: any) => {
    const days = trip.routes.map((r: any) => ({
      day_number: r.day_number || 1,
      route_id: r.id,
      chat_status: r.chat_status || "none",
      title: r.title,
      start_date: r.start_date,
      pins: (r.pins || []).sort((a: any, b: any) => a.pin_order - b.pin_order).map((p: any) => ({
        place_name: p.place_name,
        description: p.description,
        suggested_time: p.suggested_time,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        category: p.category,
      })),
    }));
    setPreviewRoute({ days, city: trip.city, startDate: trip.startDate, endDate: trip.endDate });
  };

  const handleDeleteTrip = async (trip: any) => {
    setDeletingTrip(null);
    const previousRoutes = queryClient.getQueryData<any[]>(["active-routes", user?.id]);
    queryClient.setQueryData(["active-routes", user?.id], (old: any[] | undefined) =>
      (old ?? []).filter(r => !trip.routes.some((tr: any) => tr.id === r.id))
    );
    let undone = false;
    toast.success(`Usunięto trasę „${trip.city}"`, {
      duration: 5000,
      action: {
        label: "Cofnij",
        onClick: () => {
          undone = true;
          queryClient.setQueryData(["active-routes", user?.id], previousRoutes);
          toast.success("Trasa przywrócona");
        },
      },
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        for (const route of trip.routes) {
          await supabase.from("pins").delete().eq("route_id", route.id);
          await supabase.from("routes").delete().eq("id", route.id);
        }
        if (trip.routes[0]?.folder_id) {
          await supabase.from("route_folders").delete().eq("id", trip.routes[0].folder_id);
        }
      } catch {
        queryClient.setQueryData(["active-routes", user?.id], previousRoutes);
        toast.error(t("toast_delete_error"));
      }
    }, 5200);
  };

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const trips = getTrips();
  const activeTrips = trips.filter(tr => !tr.startDate || differenceInDays(new Date(tr.startDate), todayMidnight) <= 0);
  const upcomingTrips = trips.filter(tr => tr.startDate && differenceInDays(new Date(tr.startDate), todayMidnight) > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">

        {/* Header */}
        <div className="px-5 pt-2 pb-0 max-w-lg mx-auto">
          <h1 className="text-xl font-black tracking-tight pt-3 pb-2">Moje trasy</h1>

          {/* Tabs */}
          <div className="flex border-b border-border/40 mb-5">
            {(["aktywne", "next-up"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {tab === "aktywne" ? t("tabs.active") : t("tabs.upcoming")}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 max-w-lg mx-auto">
          {/* Aktywne */}
          {activeTab === "aktywne" && (
            <section>
              {routesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : activeTrips.length > 0 ? (
                <div className="space-y-2.5">
                  {activeTrips.map((trip, idx) => {
                    const accent = ACCENTS[idx % ACCENTS.length];
                    const dateStr = trip.startDate
                      ? trip.endDate && trip.endDate !== trip.startDate
                        ? `${format(new Date(trip.startDate), "dd")}-${format(new Date(trip.endDate), "dd/MM/yy")}`
                        : format(new Date(trip.startDate), "dd/MM/yy")
                      : "";
                    const priorityLabels = (trip.priorities as string[])
                      .slice(0, 3)
                      .map(p => t(`priorities.${p}`, { defaultValue: p }))
                      .join(" · ");
                    return (
                      <div key={trip.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden flex">
                        <div className={`w-1 flex-shrink-0 ${accent.bar}`} />
                        <div className="flex-1 min-w-0">
                          <div className="relative">
                            <button onClick={() => handleTripClick(trip)} className="w-full text-left px-4 py-3 pr-10">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold leading-tight">{trip.city}</p>
                                  {priorityLabels && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{priorityLabels}</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {dateStr && <p className="text-xs font-medium tabular-nums">{dateStr}</p>}
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("points_on_route", { count: trip.pinCount })}</p>
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingTrip(trip); }}
                              className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label={t("delete_aria")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {trip.routes
                            .filter((r: any) => (r.pins || []).length > 0)
                            .sort((a: any, b: any) => (a.day_number || 0) - (b.day_number || 0))
                            .map((route: any) => (
                              <div key={route.id} className="border-t border-border/50">
                                <TripDayView
                                  pins={(route.pins as any[]).map((p: any) => ({
                                    id: p.id,
                                    place_name: p.place_name,
                                    pin_order: p.pin_order,
                                    suggested_time: p.suggested_time,
                                    address: p.address,
                                    latitude: p.latitude,
                                    longitude: p.longitude,
                                  }))}
                                  dayLabel={trip.routes.length > 1 ? t("day_label", { number: route.day_number || 1 }) : t("plan_label")}
                                  dateLabel={route.start_date ? format(new Date(route.start_date), "dd.MM.yyyy") : null}
                                  date={route.start_date ?? null}
                                  onStartReview={() => navigate(`/day-review?route=${route.id}`)}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("empty_active")}</p>
              )}
            </section>
          )}

          {/* Nadchodzące */}
          {activeTab === "next-up" && (
            <section>
              {routesLoading ? (
                <Skeleton className="h-48 w-full rounded-2xl" />
              ) : upcomingTrips.length > 0 ? (
                <div className="space-y-8">
                  {upcomingTrips.map((trip) => (
                    <UpcomingTripCard
                      key={trip.id}
                      trip={trip}
                      onDelete={() => setDeletingTrip(trip)}
                      onPinTap={setSelectedNextUpPin}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-center gap-2">
                  <p className="text-sm font-medium">{t("empty_upcoming")}</p>
                  <p className="text-xs text-muted-foreground">{t("empty_upcoming_cta")}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {selectedNextUpPin && (
        <PlaceDetailSheet
          pin={selectedNextUpPin}
          open={!!selectedNextUpPin}
          onOpenChange={(open) => !open && setSelectedNextUpPin(null)}
        />
      )}

      {previewRoute && (
        <RoutePreviewModal
          open={!!previewRoute}
          onOpenChange={(open) => !open && setPreviewRoute(null)}
          days={previewRoute.days}
          city={previewRoute.city}
          startDate={previewRoute.startDate}
          endDate={previewRoute.endDate}
        />
      )}

      <AlertDialog open={!!deletingTrip} onOpenChange={(open) => !open && setDeletingTrip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_trip_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_trip_desc", { city: deletingTrip?.city ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTrip && handleDeleteTrip(deletingTrip)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tCommon("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyTrips;
