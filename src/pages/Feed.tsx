import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Search } from "lucide-react";
import RouteCard from "@/components/route/RouteCard";
import PageTransition from "@/components/PageTransition";

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: routes } = useQuery({
    queryKey: ["feed-routes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          pins (*),
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <PageTransition>
      <AppLayout>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">TRASA</h1>
            <button
              onClick={() => navigate("/search")}
              className="p-2 hover:bg-accent rounded-lg"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Friends' Routes</h2>
            {routes?.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        </div>
      </AppLayout>
    </PageTransition>
  );
};

export default Feed;
