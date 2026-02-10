import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import TripFeedCard from "@/components/feed/TripFeedCard";
import { Button } from "@/components/ui/button";

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["feed-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          pins (id, place_name, address, image_url, images, tags, rating, pin_order, expectation_met, pros, cons, trip_role, one_liner, recommended_for),
          likes (user_id),
          comments (id)
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader 
        title="TRASA" 
        showBell 
        showSearch
        unreadCount={unreadCount}
      />
      
      <div className="p-4 space-y-4">
        {routesLoading ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted animate-pulse h-[300px]" />
            <div className="rounded-xl bg-muted animate-pulse h-[280px]" />
            <div className="rounded-xl bg-muted animate-pulse h-[280px]" />
          </div>
        ) : routes && routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-muted rounded-full p-4 mb-4">
              <MapPin className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">Brak podróży w feedzie</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[260px]">
              Zacznij obserwować innych podróżników, aby zobaczyć ich trasy
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/search")}>
              Odkrywaj
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {routes?.map((route) => (
              <TripFeedCard key={route.id} route={route} currentUserId={user.id} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Feed;
