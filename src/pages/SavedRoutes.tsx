import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import RouteCard from "@/components/route/RouteCard";
import { Bookmark } from "lucide-react";

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
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-2xl font-bold">TRASA</h1>
        </div>

        {savedRoutes && savedRoutes.length > 0 ? (
          <div className="p-4 space-y-4">
            {savedRoutes.map((route: any) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 pt-32">
            <div className="flex items-center justify-center w-32 h-32 mb-6">
              <Bookmark className="w-20 h-20 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Brak zapisanych tras
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Zapisane trasy znajomych pojawią się tutaj
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SavedRoutes;
