import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2, BookOpen, Sparkles, Mic } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import RoutePreviewModal from "@/components/route/RoutePreviewModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import TripDayView from "@/components/home/TripDayView";
import PlaceDetailSheet from "@/components/home/PlaceDetailSheet";
import JournalTab from "@/components/home/JournalTab";
import { useTranslation } from "react-i18next";


const Home = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("home");
  const { t: tCommon } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<"aktywne" | "next-up" | "dziennik">("aktywne");
  const [previewRoute, setPreviewRoute] = useState<any>(null);
  const [deletingTrip, setDeletingTrip] = useState<any>(null);
  const [selectedNextUpPin, setSelectedNextUpPin] = useState<any>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Redirect to onboarding if user hasn't completed it yet (handles email confirmation flow)
  useEffect(() => {
    if (!authLoading && user && profile !== undefined && (profile as any)?.onboarding_completed === false) {
      navigate("/onboarding");
    }
  }, [authLoading, user, profile, navigate]);

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

  // Auto-activate trips whose start_date has arrived (trip_type: planning → ongoing)
  useEffect(() => {
    if (!activeRoutes || !user) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const toActivate = (activeRoutes as any[]).filter(
      r => r.trip_type === "planning" && r.start_date && r.start_date <= todayStr
    );
    if (toActivate.length === 0) return;
    supabase
      .from("routes")
      .update({ trip_type: "ongoing" })
      .in("id", toActivate.map(r => r.id))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes-orb"] });
      });
  }, [activeRoutes, user, queryClient]);




  // Group active routes by folder for multi-day trips
  const getActiveTrips = () => {
    if (!activeRoutes) return [];

    const folderMap = new Map<string | null, any[]>();
    activeRoutes.forEach((route: any) => {
      const key = route.folder_id || route.id;
      if (!folderMap.has(key)) folderMap.set(key, []);
      folderMap.get(key)!.push(route);
    });

    return Array.from(folderMap.values()).map(routes => {
      routes.sort((a: any, b: any) => (a.day_number || 0) - (b.day_number || 0));
      const first = routes[0];
      const allPins = routes.flatMap((r: any) => r.pins || []);
      const priorities = first.priorities || [];

      const dates = routes.map((r: any) => r.start_date).filter(Boolean).sort();
      const startDate = dates[0] || null;
      const endDate = dates[dates.length - 1] || startDate;

      return {
        id: first.folder_id || first.id,
        city: first.city || "Trasa",
        startDate,
        endDate,
        priorities,
        pinCount: allPins.length,
        routes,
      };
    });
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

    setPreviewRoute({
      days,
      city: trip.city,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
  };

  const handleDeleteTrip = async (trip: any) => {
    try {
      for (const route of trip.routes) {
        await supabase.from("pins").delete().eq("route_id", route.id);
        await supabase.from("routes").delete().eq("id", route.id);
      }
      if (trip.routes[0]?.folder_id) {
        await supabase.from("route_folders").delete().eq("id", trip.routes[0].folder_id);
      }
      queryClient.invalidateQueries({ queryKey: ["active-routes"] });
      toast.success(t("toast_deleted"));
    } catch (err) {
      console.error("Delete trip error:", err);
      toast.error(t("toast_delete_error"));
    }
    setDeletingTrip(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-6 max-w-lg mx-auto">
          <Skeleton className="h-10 w-full" />
          <div className="flex flex-col items-center gap-3 pt-8">
            <Skeleton className="h-28 w-28 rounded-full" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Landing page dla niezalogowanych ──
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto w-full">
        {/* Logo + headline */}
        <div className="text-center mb-10">
          <div className="h-16 w-16 rounded-full orb-gradient mx-auto mb-6" />
          <h1 className="text-3xl font-black tracking-tight mb-3">TRASA</h1>
          <p className="text-lg font-semibold mb-2">{t("landing.tagline")}</p>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto leading-relaxed">
            {t("landing.description")}
          </p>
        </div>

        {/* Feature cards */}
        <div className="w-full space-y-2.5 mb-10">
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature1_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature1_desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <Mic className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature2_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature2_desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <BookOpen className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature3_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature3_desc")}</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="w-full space-y-2">
          <Button
            onClick={() => navigate("/auth?tab=register")}
            size="lg"
            className="w-full rounded-full text-base font-semibold"
          >
            {t("landing.start_free")}
          </Button>
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            size="lg"
            className="w-full rounded-full text-base font-medium bg-card"
          >
            {t("landing.login")}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          <Link to="/terms" className="underline">{t("landing.terms")}</Link>
        </p>
      </div>
    );
  }

  const trips = getActiveTrips();

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  // Use differenceInDays to avoid UTC/local-timezone mismatch: daysUntil===0 → active today
  const activeTrips = trips.filter(tr => !tr.startDate || differenceInDays(new Date(tr.startDate), todayMidnight) <= 0);
  const upcomingTrips = trips.filter(tr => tr.startDate && differenceInDays(new Date(tr.startDate), todayMidnight) > 0);

  // Accent colors cycling per trip/journal entry
  const ACCENTS = [
    { bar: "bg-blue-500", dot: "bg-blue-400" },
    { bar: "bg-violet-500", dot: "bg-violet-400" },
    { bar: "bg-amber-400", dot: "bg-amber-400" },
    { bar: "bg-emerald-500", dot: "bg-emerald-400" },
    { bar: "bg-rose-500", dot: "bg-rose-400" },
    { bar: "bg-cyan-500", dot: "bg-cyan-400" },
  ];

  const CATEGORY_DOT_COLORS: Record<string, string> = {
    restaurant: "bg-orange-400",
    cafe: "bg-amber-400",
    museum: "bg-blue-500",
    monument: "bg-violet-400",
    walk: "bg-emerald-400",
    viewpoint: "bg-sky-400",
    nightlife: "bg-purple-500",
    shopping: "bg-pink-400",
    church: "bg-stone-400",
    gallery: "bg-rose-400",
    park: "bg-green-400",
    bar: "bg-yellow-400",
    market: "bg-lime-400",
    transport: "bg-gray-400",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-28 max-w-lg mx-auto w-full">

        {/* Admin shortcut — visible only for Natalia */}
        {user?.email === "natalia@trasa.app" && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => navigate("/admin/routes")}
              className="text-xs bg-orange-500/10 text-orange-600 font-semibold px-3 py-1.5 rounded-full"
            >
              🗺️ Trasy wzorcowe
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border/40 mb-5 mt-3" data-tour="trips">
          {(["aktywne", "next-up", "dziennik"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tab === "aktywne" ? t("tabs.active") : tab === "next-up" ? t("tabs.upcoming") : "Dziennik"}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Aktywne plany tab */}
        {activeTab === "aktywne" && (
          <section className="mb-8">
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
                                routeId={route.id}
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

        {/* Next Up tab */}
        {activeTab === "next-up" && (
          <section className="mb-8">
            {routesLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : upcomingTrips.length > 0 ? (
              <div className="space-y-6">
                {upcomingTrips.map((trip) => {
                  const daysUntil = differenceInDays(new Date(trip.startDate!), todayMidnight);
                  const isMultiDay = trip.routes.length > 1;
                  const sortedRoutes = [...trip.routes].sort((a: any, b: any) => (a.day_number || 0) - (b.day_number || 0));
                  return (
                    <div key={trip.id}>
                      {/* Trip header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] font-medium text-orange-500">
                            {daysUntil === 1 ? t("days_until_one", { count: daysUntil }) : t("days_until_many", { count: daysUntil })}
                          </p>
                          <p className="text-lg font-bold leading-tight">{trip.city}</p>
                        </div>
                        <button
                          onClick={() => setDeletingTrip(trip)}
                          className="p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={t("delete_aria")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Per-day sections */}
                      <div className="space-y-4">
                        {sortedRoutes.map((route: any) => {
                          const dayPins = [...(route.pins || [])].sort((a: any, b: any) => (a.pin_order || 0) - (b.pin_order || 0));
                          if (dayPins.length === 0) return null;
                          return (
                            <div key={route.id}>
                              {isMultiDay && (
                                <p className="text-xs font-semibold text-muted-foreground mb-2 px-0.5">
                                  {t("day_label", { number: route.day_number || 1 })}
                                </p>
                              )}
                              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-4 snap-x snap-mandatory scrollbar-orange">
                                {dayPins.map((pin: any, pIdx: number) => {
                                  const catColor = CATEGORY_DOT_COLORS[pin.category as string] ?? "bg-gray-400";
                                  const catLabel = t(`categories.${pin.category}`, { defaultValue: t("categories.place", { defaultValue: "Miejsce" }) });
                                  return (
                                    <button
                                      key={pIdx}
                                      onClick={() => setSelectedNextUpPin(pin)}
                                      className="shrink-0 w-48 rounded-2xl bg-card border border-border/50 p-3.5 text-left shadow-sm snap-start"
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold leading-tight flex-1 line-clamp-2">{pin.place_name}</p>
                                        <div className={`h-5 w-5 rounded-full shrink-0 mt-0.5 ${catColor}`} />
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">{catLabel}</p>
                                      {pin.description && (
                                        <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{pin.description}</p>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center gap-2">
                <p className="text-sm font-medium">{t("empty_upcoming")}</p>
                <p className="text-xs text-muted-foreground">{t("empty_upcoming_cta")}</p>
              </div>
            )}
          </section>
        )}

        {/* Dziennik tab */}
        {activeTab === "dziennik" && <JournalTab userId={user.id} />}

      </div>

      {/* CTA — warm orange */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/20 px-5 pt-3 pb-safe-4" data-tour="cta">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={() => navigate("/plan")}
            size="lg"
            className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20"
          >
            {t("add_plan")}
          </Button>
        </div>
      </div>

      {/* Route preview modal */}
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


      {selectedNextUpPin && (
        <PlaceDetailSheet
          pin={selectedNextUpPin}
          open={!!selectedNextUpPin}
          onOpenChange={(open) => !open && setSelectedNextUpPin(null)}
        />
      )}

      {/* Delete trip confirmation */}
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

export default Home;
