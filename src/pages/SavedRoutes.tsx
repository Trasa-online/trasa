import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import RouteCard from "@/components/route/RouteCard";
import { Bookmark } from "lucide-react";

const SavedRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: savedRoutes } = useQuery({
    queryKey: ["saved-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_routes")
        .select(`
          route_id,
          routes (
            *,
            profiles:user_id (username, avatar_url),
            pins (*),
            likes (user_id),
            comments (id)
          )
        `)
        .eq("user_id", user?.id);

      if (error) throw error;
      return data.map((item) => item.routes);
    },
    enabled: !!user,
  });

  if (loading || !user) return null;

  return (
    <AppLayout>
      <PageHeader 
        title="TRASA" 
        showBell 
        showSearch
        unreadCount={unreadCount}
      />
      
      {savedRoutes && savedRoutes.length > 0 ? (
        <div className="p-4 space-y-4">
          {savedRoutes.map((route: any) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="flex items-center justify-center w-24 h-24 mb-4">
            <Bookmark className="w-16 h-16 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold mb-2 text-center">
            Brak zapisanych tras
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Zapisane trasy znajomych pojawią się tutaj
          </p>
        </div>
      )}
    </AppLayout>
  );
};

export default SavedRoutes;
