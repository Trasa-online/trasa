import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import RouteCard from "@/components/route/RouteCard";

const SavedRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{savedRoutes?.length || 0} zapisane trasy</h1>

        <div className="space-y-4">
          {savedRoutes?.map((route: any) => (
            <RouteCard key={route.id} route={route} />
          ))}
          {savedRoutes?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nie masz jeszcze zapisanych tras
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SavedRoutes;
