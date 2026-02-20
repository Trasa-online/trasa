import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, PlusCircle, Compass, Settings } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const Home = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
        .select("*, pins(count)")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .eq("status", "draft")
        .order("created_at", { ascending: false });
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-muted px-4 py-4 flex items-center justify-center">
          <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon={Compass}
            title="Zaplanuj swoją podróż"
            description="Zaloguj się, żeby zacząć planować"
            actionLabel="Zaloguj się"
            onAction={() => navigate("/auth")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <header className="bg-muted px-4 py-4 flex items-center justify-between">
        <div className="w-8" />
        <h1 className="text-2xl font-black tracking-tight">TRASA</h1>
        <button
          onClick={() => navigate("/settings")}
          className="p-1 text-foreground/70 hover:text-foreground transition-colors"
        >
          <Settings className="h-6 w-6" />
        </button>
      </header>

      {/* Content */}
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
        </div>

        {/* Active routes */}
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-2">Twoje aktywne trasy</h3>
          {routesLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : activeRoutes && activeRoutes.length > 0 ? (
            <div className="space-y-2">
              {activeRoutes.map((route: any) => (
                <button
                  key={route.id}
                  onClick={() => navigate(`/route/${route.id}`)}
                  className="w-full text-left bg-muted/50 rounded-xl p-4 flex items-center justify-between hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{route.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {route.city || "Trasa"} • {route.pins?.[0]?.count || 0} miejsc
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Brak aktywnych tras. Zaplanuj swoją podróż i zobacz swoje aktywne trasy tutaj.
            </p>
          )}
        </section>

        {/* Past routes */}
        <section>
          <h3 className="text-lg font-bold mb-2">Twoje wcześniejsze trasy</h3>
          {pastRoutes && pastRoutes.length > 0 ? (
            <div className="space-y-2">
              {pastRoutes.map((route: any) => (
                <button
                  key={route.id}
                  onClick={() => navigate(`/route/${route.id}`)}
                  className="w-full text-left bg-muted/30 rounded-xl p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
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

      {/* Sticky bottom CTA */}
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
    </div>
  );
};

export default Home;
