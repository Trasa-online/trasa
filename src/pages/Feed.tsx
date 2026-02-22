import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import TripFeedCard from "@/components/feed/TripFeedCard";
import TripFolderCard from "@/components/feed/TripFolderCard";
import TripFeedCardSkeleton from "@/components/feed/TripFeedCardSkeleton";
import { Button } from "@/components/ui/button";

const STALE_MINUTES = 5;
const TABS = ["Wszystko", "Obserwowani", "Popularne", "Blisko mnie"] as const;
type Tab = typeof TABS[number];

type FeedItem =
  | { type: "folder"; data: any; sortDate: string }
  | { type: "route"; data: any; sortDate: string };

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Wszystko");

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

  const { data: feedFolders } = useQuery({
    queryKey: ["feed-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_folders")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          routes (
            id, title, created_at, status, folder_order,
            pins (id, place_name, address, image_url, images, tags, rating, pin_order, expectation_met, pros, cons, trip_role, one_liner, recommended_for),
            likes (user_id),
            comments (id)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter((folder) => folder.routes?.some((r: any) => r.status === "published"))
        .map((folder) => ({
          ...folder,
          routes: (folder.routes || [])
            .filter((r: any) => r.status === "published")
            .sort((a: any, b: any) => (a.folder_order || 0) - (b.folder_order || 0)),
        }));
    },
    enabled: !!user,
  });

  // Fetch followed user IDs
  const { data: followedIds } = useQuery({
    queryKey: ["followed-ids", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user!.id);

      if (error) throw error;
      return data?.map((f) => f.following_id) || [];
    },
    enabled: !!user && activeTab === "Obserwowani",
  });

  // notifications removed

  const feedItems = useMemo(() => {
    if (!routes || feedFolders === undefined) return undefined;

    const routeIdsInFolders = new Set<string>();
    (feedFolders || []).forEach((folder) => {
      folder.routes?.forEach((r: any) => routeIdsInFolders.add(r.id));
    });

    const standaloneRoutes = routes.filter((r) => !routeIdsInFolders.has(r.id));

    const items: FeedItem[] = [
      ...(feedFolders || []).map((folder) => ({
        type: "folder" as const,
        data: folder,
        sortDate: folder.updated_at || folder.created_at,
      })),
      ...standaloneRoutes.map((route) => ({
        type: "route" as const,
        data: route,
        sortDate: route.updated_at || route.created_at,
      })),
    ];

    items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    return items;
  }, [routes, feedFolders]);

  const filteredItems = useMemo(() => {
    if (!feedItems) return undefined;

    switch (activeTab) {
      case "Obserwowani":
        if (!followedIds) return undefined;
        return feedItems.filter((item) => {
          const userId = item.data.user_id;
          return followedIds.includes(userId);
        });
      case "Popularne":
        return [...feedItems].sort((a, b) => {
          const aLikes =
            a.type === "folder"
              ? a.data.routes.reduce((sum: number, r: any) => sum + (r.likes?.length || 0), 0)
              : a.data.likes?.length || 0;
          const bLikes =
            b.type === "folder"
              ? b.data.routes.reduce((sum: number, r: any) => sum + (r.likes?.length || 0), 0)
              : b.data.likes?.length || 0;
          return bLikes - aLikes;
        });
      default:
        return feedItems;
    }
  }, [feedItems, activeTab, followedIds]);

  const handleTabClick = (tab: Tab) => {
    if (tab === "Blisko mnie") {
      toast("Wkrótce! Włącz lokalizację, by zobaczyć trasy w okolicy");
      return;
    }
    setActiveTab(tab);
  };

  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_MINUTES * 60 * 1000;
  const isLoading = routesLoading || feedFolders === undefined;

  if (loading || !user) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="TRASA"
      />

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              activeTab === tab
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 pt-0 space-y-4">
        {isFetching && !isLoading && (
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

        {isLoading || filteredItems === undefined ? (
          <div className="space-y-4">
            <TripFeedCardSkeleton />
            <TripFeedCardSkeleton />
            <TripFeedCardSkeleton />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-muted rounded-full p-4 mb-4">
              <MapPin className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {activeTab === "Obserwowani" ? "Brak tras od obserwowanych" : "Brak podróży w feedzie"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[260px]">
              {activeTab === "Obserwowani"
                ? "Zacznij obserwować podróżników, aby zobaczyć ich trasy tutaj"
                : "Zacznij obserwować innych podróżników, aby zobaczyć ich trasy"}
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/search")}>
              Odkrywaj
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) =>
              item.type === "folder" ? (
                <TripFolderCard
                  key={`folder-${item.data.id}`}
                  folder={item.data}
                  routes={item.data.routes}
                  author={item.data.profiles}
                  currentUserId={user.id}
                />
              ) : (
                <TripFeedCard
                  key={`route-${item.data.id}`}
                  route={item.data}
                  currentUserId={user.id}
                />
              )
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Feed;
