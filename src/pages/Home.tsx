import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, Plus, Compass } from "lucide-react";
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
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Compass}
          title="Zaplanuj swoją podróż"
          description="Zaloguj się, żeby zacząć planować"
          actionLabel="Zaloguj się"
          onAction={() => navigate("/auth")}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile?.avatar_url || ""} />
          <AvatarFallback className="bg-muted text-foreground">
            {profile?.username?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-semibold">
            Cześć, {profile?.username || "Podróżniku"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Gdzie się wybierasz?
          </p>
        </div>
      </div>

      {/* Active trips */}
      {routesLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : activeRoutes && activeRoutes.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Aktywna podróż
          </h2>
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
        <div className="bg-muted/30 rounded-xl p-6 text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Compass className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium">Brak aktywnych podróży</p>
            <p className="text-xs text-muted-foreground mt-1">
              Zaplanuj swoją następną przygodę
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={() => navigate("/create")}
        size="lg"
        className="w-full"
      >
        <Plus className="h-5 w-5 mr-2" />
        Zaplanuj swoją podróż
      </Button>

      {/* Past trips */}
      {pastRoutes && pastRoutes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Twoje wcześniejsze trasy
          </h2>
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
      )}
    </div>
  );
};

export default Home;
