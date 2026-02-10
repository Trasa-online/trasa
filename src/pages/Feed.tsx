import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import TripFeedCard from "@/components/feed/TripFeedCard";
import TripFeedCardSkeleton from "@/components/feed/TripFeedCardSkeleton";
import { Button } from "@/components/ui/button";

const STALE_MINUTES = 5;

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: routes, isLoading: routesLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
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

  // Check if data is stale (older than 5 minutes)
  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_MINUTES * 60 * 1000;

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
        {/* Refresh banner when data is stale or refetching indicator */}
        {isFetching && !routesLoading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Odświeżanie...</span>
          </div>
        )}
        {isStale && !isFetching && routes && routes.length > 0 && (
          <button
            onClick={() => refetch()}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Odśwież feed</span>
          </button>
        )}

        {routesLoading ? (
          <div className="space-y-4">
            <TripFeedCardSkeleton />
            <TripFeedCardSkeleton />
            <TripFeedCardSkeleton />
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
