import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2, Map as MapIcon, BookOpen, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import RoutePreviewModal from "@/components/route/RoutePreviewModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import TripDayView from "@/components/home/TripDayView";
import HomeTour from "@/components/home/HomeTour";
import CreatorPlanCard from "@/components/home/CreatorPlanCard";
import CreatorPlanSheet from "@/components/home/CreatorPlanSheet";
import type { CreatorPlan, CreatorPlaceItem } from "@/components/home/CreatorPlanCard";


const Home = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"aktywne" | "next-up">("aktywne");
  const [previewRoute, setPreviewRoute] = useState<any>(null);
  const [deletingTrip, setDeletingTrip] = useState<any>(null);
  const [showTour, setShowTour] = useState(searchParams.get("tour") === "1");
  const [selectedPlan, setSelectedPlan] = useState<(CreatorPlan & { places: CreatorPlaceItem[] }) | null>(null);

  const handleTourDone = () => {
    setShowTour(false);
    setSearchParams({}, { replace: true });
  };

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

  const { data: creatorPlans = [] } = useQuery({
    queryKey: ["creator-plans"],
    queryFn: async () => {
      const { data: plans } = await supabase
        .from("creator_plans")
        .select("id, creator_handle, city, title, video_url, thumbnail_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!plans?.length) return [];
      const { data: places } = await supabase
        .from("creator_places")
        .select("id, place_name, category, plan_id")
        .in("plan_id", plans.map(p => p.id))
        .eq("is_active", true);
      return plans.map(plan => ({
        ...plan,
        places: (places ?? []).filter(pl => pl.plan_id === plan.id),
      })) as (CreatorPlan & { places: CreatorPlaceItem[] })[];
    },
  });

  const { data: journalRoutes } = useQuery({
    queryKey: ["journal-routes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("id, title, city, start_date, ai_summary, ai_highlight, ai_tip, chat_status")
        .eq("user_id", user.id)
        .eq("chat_status", "completed")
        .not("ai_summary", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });


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
      toast.success("Podróż została usunięta");
    } catch (err) {
      console.error("Delete trip error:", err);
      toast.error("Nie udało się usunąć podróży");
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

  // ── Onboarding dla niezalogowanych ──
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-4xl mb-3">🗺️</p>
          <h2 className="text-2xl font-black tracking-tight mb-2">Twój osobisty przewodnik podróży</h2>
          <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
            Planuj trasy z pomocą AI, odhaczaj miejsca w trakcie podróży i prowadź dziennik z każdego dnia.
          </p>
        </div>

        <div className="w-full space-y-3 mb-8">
          <div className="flex items-start gap-3 rounded-xl bg-card border border-border/60 p-4">
            <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
            <div>
              <p className="text-sm font-semibold">Planer z AI</p>
              <p className="text-xs text-muted-foreground mt-0.5">Powiedz dokąd jedziesz — AI zaproponuje trasę z prawdziwymi miejscami i godzinami.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-card border border-border/60 p-4">
            <MapIcon className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
            <div>
              <p className="text-sm font-semibold">Trasa na mapie</p>
              <p className="text-xs text-muted-foreground mt-0.5">Zobacz wszystkie miejsca na mapie, odhaczaj odwiedzone i dostosowuj plan w locie.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-card border border-border/60 p-4">
            <BookOpen className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
            <div>
              <p className="text-sm font-semibold">Dziennik podróży</p>
              <p className="text-xs text-muted-foreground mt-0.5">Po każdym dniu porozmawiaj z AI o tym, co przeżyłeś. Zapisujemy to jako Twoje wspomnienie.</p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-2">
          <Button
            onClick={() => navigate("/auth?tab=register")}
            size="lg"
            className="w-full rounded-full text-base font-medium"
          >
            Zarejestruj się — to bezpłatne
          </Button>
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            size="lg"
            className="w-full rounded-full text-base font-medium bg-card"
          >
            Mam już konto — zaloguj się
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/terms" className="underline">Regulamin i Polityka Prywatności</Link>
        </p>
      </div>
    );
  }

  const trips = getActiveTrips();

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const activeTrips = trips.filter(t => !t.startDate || new Date(t.startDate) <= todayMidnight);
  const upcomingTrips = trips.filter(t => t.startDate && new Date(t.startDate) > todayMidnight);

  // Accent colors cycling per trip/journal entry
  const ACCENTS = [
    { bar: "bg-blue-500", dot: "bg-blue-400" },
    { bar: "bg-violet-500", dot: "bg-violet-400" },
    { bar: "bg-amber-400", dot: "bg-amber-400" },
    { bar: "bg-emerald-500", dot: "bg-emerald-400" },
    { bar: "bg-rose-500", dot: "bg-rose-400" },
    { bar: "bg-cyan-500", dot: "bg-cyan-400" },
  ];

  const PRIORITY_LABEL: Record<string, string> = {
    good_food: "Jedzenie", nice_views: "Widoki", long_walks: "Spacery",
    museums: "Muzea", nightlife: "Nocne życie", shopping: "Zakupy",
    local_vibes: "Klimaty", photography: "Foto",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-28 max-w-lg mx-auto w-full">

        {/* Avatar + Name */}
        <Link
          to="/moj-profil"
          className="flex flex-col items-center pt-8 pb-6 w-full"
        >
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 text-2xl font-bold">
              {profile?.username?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-3 text-xl font-bold tracking-tight">
            {profile?.username || "Podróżnik"}
          </h2>
        </Link>

        {/* Creator Plans */}
        {creatorPlans.length > 0 && (
          <section className="mb-7 -mx-5">
            <h3 className="text-base font-bold px-5 mb-3">Plany twórców</h3>
            <div className="flex gap-3 overflow-x-auto px-5 pb-1 snap-x snap-mandatory scrollbar-none">
              {creatorPlans.map(plan => (
                <CreatorPlanCard
                  key={plan.id}
                  plan={plan}
                  onClick={() => setSelectedPlan(plan)}
                />
              ))}
            </div>
          </section>
        )}
        <CreatorPlanSheet
          plan={selectedPlan}
          open={!!selectedPlan}
          onOpenChange={open => { if (!open) setSelectedPlan(null); }}
        />

        {/* Tabs */}
        <div className="flex border-b border-border/40 mb-5" data-tour="trips">
          {(["aktywne", "next-up"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tab === "aktywne" ? "Aktywne plany" : "Next up"}
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
                    .map(p => PRIORITY_LABEL[p] ?? p)
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
                                <p className="text-[11px] text-muted-foreground mt-0.5">Punkty na trasie: {trip.pinCount}</p>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingTrip(trip); }}
                            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            aria-label="Usuń podróż"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {trip.routes
                          .filter((r: any) => r.chat_status !== "completed" && (r.pins || []).length > 0)
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
                                dayLabel={trip.routes.length > 1 ? `Dzień ${route.day_number || 1}` : "Plan"}
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
              <p className="text-muted-foreground text-sm">Brak aktywnych tras. Zaplanuj swoją podróż!</p>
            )}

            {/* Journal — 2-column grid */}
            {journalRoutes && journalRoutes.length > 0 && (
              <div className="mt-8" data-tour="journal">
                <h3 className="text-base font-bold mb-3">Dziennik podróży</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {journalRoutes.map((route: any, idx: number) => {
                    const accent = ACCENTS[idx % ACCENTS.length];
                    return (
                      <div key={route.id} className="rounded-2xl bg-card border border-border/50 p-3.5">
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold leading-tight truncate">{route.city || route.title}</p>
                            {route.start_date && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {format(new Date(route.start_date), "dd/MM/yy")}
                              </p>
                            )}
                          </div>
                          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1 ml-2 ${accent.dot}`} />
                        </div>
                        {route.ai_summary && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 mt-1">
                            {route.ai_summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Next Up tab */}
        {activeTab === "next-up" && (
          <section className="mb-8">
            {routesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full rounded-2xl" />
              </div>
            ) : upcomingTrips.length > 0 ? (
              <div className="space-y-4">
                {upcomingTrips.map((trip, idx) => {
                  const accent = ACCENTS[idx % ACCENTS.length];
                  const daysUntil = differenceInDays(new Date(trip.startDate!), todayMidnight);
                  const allPins = trip.routes
                    .flatMap((r: any) => (r.pins || []) as any[])
                    .sort((a: any, b: any) => (a.pin_order || 0) - (b.pin_order || 0));
                  const visiblePins = allPins.slice(0, 6);
                  const extra = allPins.length - visiblePins.length;
                  return (
                    <div key={trip.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                      <div className="flex">
                        <div className={`w-1 flex-shrink-0 ${accent.bar}`} />
                        <div className="flex-1 min-w-0 px-4 pt-3 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <p className="text-[11px] font-medium text-orange-500 mb-0.5">
                                Za {daysUntil} {daysUntil === 1 ? "dzień" : "dni"}
                              </p>
                              <p className="text-sm font-bold leading-tight">{trip.city}</p>
                            </div>
                            <button
                              onClick={() => setDeletingTrip(trip)}
                              className="p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
                              aria-label="Usuń podróż"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Place chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {visiblePins.map((pin: any) => (
                              <span
                                key={pin.id}
                                className="text-[11px] bg-muted rounded-full px-2.5 py-1 text-foreground/70 leading-none"
                              >
                                {pin.place_name}
                              </span>
                            ))}
                            {extra > 0 && (
                              <span className="text-[11px] bg-muted rounded-full px-2.5 py-1 text-muted-foreground leading-none">
                                +{extra} więcej
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center gap-2">
                <p className="text-sm font-medium">Brak nadchodzących podróży</p>
                <p className="text-xs text-muted-foreground">Zaplanuj kolejną przygodę!</p>
              </div>
            )}
          </section>
        )}

      </div>

      {/* CTA — warm orange */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/20 px-5 pt-3 pb-safe-4" data-tour="cta">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={() => navigate("/create")}
            size="lg"
            className="w-full rounded-full text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-lg shadow-orange-500/20"
          >
            Dodaj plan podróży
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

      {showTour && <HomeTour onDone={handleTourDone} />}

      {/* Delete trip confirmation */}
      <AlertDialog open={!!deletingTrip} onOpenChange={(open) => !open && setDeletingTrip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć podróż?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć podróż{deletingTrip ? ` „${deletingTrip.city}"` : ""}? Wszystkie trasy i pinezki zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTrip && handleDeleteTrip(deletingTrip)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Home;
