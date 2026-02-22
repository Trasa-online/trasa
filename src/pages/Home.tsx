import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronRight, PlusCircle, Trash2, Map as MapIcon, BookOpen, Sparkles, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import RoutePreviewModal from "@/components/route/RoutePreviewModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import TripCheckinSection from "@/components/home/TripCheckinSection";

const Home = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewRoute, setPreviewRoute] = useState<any>(null);
  const [deletingTrip, setDeletingTrip] = useState<any>(null);

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

  const { data: pastRoutes } = useQuery({
    queryKey: ["past-routes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("*, pins(count)")
        .eq("user_id", user.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10);
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

  // Find today's route for a trip that needs checkin
  const getTodayRoute = (trip: any) => {
    if (!trip.startDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripStart = new Date(trip.startDate);
    tripStart.setHours(0, 0, 0, 0);
    if (today < tripStart) return null;

    const dayDiff = Math.floor((today.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));
    const targetDayNumber = dayDiff + 1;
    const route = trip.routes.find((r: any) => (r.day_number || 1) === targetDayNumber);
    const candidate = route || trip.routes[trip.routes.length - 1];
    if (candidate && candidate.chat_status !== "completed") {
      return candidate;
    }
    return null;
  };

  // Find any route with pending review (for manual entry)
  const getPendingReviewRoute = (trip: any) => {
    return trip.routes.find((r: any) => r.chat_status !== "completed" && (r.pins || []).length > 0) || null;
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

  const handleCheckinComplete = (routeId: string) => {
    navigate(`/day-review?route=${routeId}`);
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
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-5 py-4 flex items-center justify-center">
          <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="text-center mb-10">
            <p className="text-4xl mb-3">🗺️</p>
            <h2 className="text-2xl font-black tracking-tight mb-2">Twój osobisty planer podróży</h2>
            <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
              Planuj trasy z pomocą AI, odhaczaj miejsca w trakcie podróży i prowadź dziennik z każdego dnia.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3 mb-10">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
              <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
              <div>
                <p className="text-sm font-semibold">Planer z AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">Powiedz dokąd jedziesz — AI zaproponuje trasę z prawdziwymi miejscami i godzinami.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
              <MapIcon className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
              <div>
                <p className="text-sm font-semibold">Trasa na mapie</p>
                <p className="text-xs text-muted-foreground mt-0.5">Zobacz wszystkie miejsca na mapie, odhaczaj odwiedzone i dostosowuj plan w locie.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
              <BookOpen className="h-5 w-5 shrink-0 mt-0.5 text-foreground/70" />
              <div>
                <p className="text-sm font-semibold">Dziennik podróży</p>
                <p className="text-xs text-muted-foreground mt-0.5">Po każdym dniu porozmawiaj z AI o tym, co przeżyłeś. Zapisujemy to jako Twoje wspomnienie.</p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-2">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="w-full rounded-full text-base font-medium"
            >
              Zacznij planować
            </Button>
            <button
              onClick={() => navigate("/auth")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Mam już konto — zaloguj się
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-5">
          <Link to="/terms" className="underline">Regulamin i Polityka Prywatności</Link>
        </p>
      </div>
    );
  }

  const trips = getActiveTrips();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-24 max-w-lg mx-auto w-full">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center pt-10 pb-8">
          <Avatar className="h-28 w-28 border-2 border-muted">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-muted text-foreground text-2xl">
              {profile?.username?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-4 text-2xl font-black tracking-tight uppercase">
            {profile?.username || "Podróżnik"}
          </h2>
          {profile?.bio && (
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-[260px]">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Active trips */}
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-3">Aktywna podróż</h3>
          {routesLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : trips.length > 0 ? (
            <div className="space-y-3">
              {trips.map((trip) => {
                const dateStr = trip.startDate
                  ? trip.endDate && trip.endDate !== trip.startDate
                    ? `${format(new Date(trip.startDate), "dd")}-${format(new Date(trip.endDate), "dd/MM/yyyy")}`
                    : format(new Date(trip.startDate), "dd/MM/yyyy")
                  : "";
                const priorityLabels = (trip.priorities as string[]).slice(0, 4).join(" / ");
                const todayRoute = getTodayRoute(trip);
                const pendingRoute = getPendingReviewRoute(trip);

                return (
                  <div key={trip.id}>
                    <div className="relative rounded-xl border border-border bg-card hover:bg-card/90 transition-colors">
                      <button
                        onClick={() => handleTripClick(trip)}
                        className="w-full text-left p-4 pr-12"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-base font-bold">{trip.city}</p>
                            {priorityLabels && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {priorityLabels}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            {dateStr && (
                              <p className="text-sm font-medium">{dateStr}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Punkty na trasie: {trip.pinCount}
                            </p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingTrip(trip); }}
                        className="absolute top-4 right-3 p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Usuń podróż"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Inline checkin for today's route (auto-triggered) */}
                    {todayRoute && todayRoute.pins?.length > 0 && (
                      <TripCheckinSection
                        routeId={todayRoute.id}
                        pins={(todayRoute.pins as any[]).map((p: any) => ({
                          id: p.id,
                          place_name: p.place_name,
                          pin_order: p.pin_order,
                          suggested_time: p.suggested_time,
                        }))}
                        onComplete={handleCheckinComplete}
                      />
                    )}

                    {/* Manual review button — when no auto-checkin but there's a pending route */}
                    {!todayRoute && pendingRoute && (
                      <button
                        onClick={() => navigate(`/day-review?route=${pendingRoute.id}`)}
                        className="mt-2 w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Oceń dzień podróży
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Brak aktywnych tras. Zaplanuj swoją podróż!
            </p>
          )}
        </section>

        {/* Journal — completed day reviews */}
        {journalRoutes && journalRoutes.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-bold mb-3">Dziennik podróży</h3>
            <div className="space-y-3">
              {journalRoutes.map((route: any) => (
                <div key={route.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{route.city || route.title}</p>
                      {route.start_date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(route.start_date), "dd.MM.yyyy")}
                        </p>
                      )}
                    </div>
                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  {route.ai_summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      {route.ai_summary}
                    </p>
                  )}
                  {route.ai_highlight && (
                    <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium">Najlepszy moment: </span>
                      <span className="text-muted-foreground">{route.ai_highlight}</span>
                    </div>
                  )}
                  {route.ai_tip && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Tip: </span>{route.ai_tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past routes */}
        <section>
          <h3 className="text-lg font-bold mb-2">Twoje wcześniejsze trasy</h3>
          {pastRoutes && pastRoutes.length > 0 ? (
            <div className="space-y-2">
              {pastRoutes.map((route: any) => (
                <button
                  key={route.id}
                  onClick={() => navigate(`/route/${route.id}`)}
                  className="w-full text-left bg-card rounded-xl p-3 flex items-center justify-between hover:bg-card/90 transition-colors border border-border"
                >
                  <div>
                    <p className="text-sm font-medium">{route.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {route.city || ""} • {route.pins?.[0]?.count || 0} miejsc
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nie masz jeszcze pokonanych tras
            </p>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-foreground px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={() => navigate("/create")}
            variant="outline"
            size="lg"
            className="w-full bg-background text-foreground border-border rounded-full text-base font-medium"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Zaplanuj swoją podróż
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
