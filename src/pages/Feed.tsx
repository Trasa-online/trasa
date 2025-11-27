import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Search, Bell } from "lucide-react";
import RouteCard from "@/components/route/RouteCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: friendsCount } = useQuery({
    queryKey: ["friends-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", user!.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: routesCount } = useQuery({
    queryKey: ["user-routes-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("routes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

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
    <AppLayout>
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">TRASA</h1>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-accent rounded-lg">
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate("/search")}
              className="p-2 hover:bg-accent rounded-lg"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>

        {profile && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
              <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <h2 className="text-xl font-bold uppercase">{profile.username}</h2>
            
            {profile.bio && (
              <p className="text-center text-muted-foreground">{profile.bio}</p>
            )}
            
            <div className="flex gap-8 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold">{friendsCount}</div>
                <div className="text-sm text-muted-foreground">Friends</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{routesCount}</div>
                <div className="text-sm text-muted-foreground">Routes</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {routes?.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Feed;
