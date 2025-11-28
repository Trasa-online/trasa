import { useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { ArrowLeft } from "lucide-react";
import RouteCard from "@/components/route/RouteCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: friendsCount } = useQuery({
    queryKey: ["friends-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId!);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: routesCount } = useQuery({
    queryKey: ["user-routes-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("routes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("status", "published");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: routes } = useQuery({
    queryKey: ["user-routes", userId],
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
        .eq("user_id", userId!)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("*")
        .eq("follower_id", user!.id)
        .eq("following_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!userId && user.id !== userId,
  });

  const handleFollowToggle = async () => {
    if (!user || !userId) return;

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);
    } else {
      await supabase
        .from("followers")
        .insert({
          follower_id: user.id,
          following_id: userId,
        });
    }

    // Refetch
    window.location.reload();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-accent rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">Profil</h1>
        </div>

        {profile && (
          <div className="flex flex-col items-center py-4 space-y-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
              <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <h2 className="text-lg font-semibold uppercase">{profile.username}</h2>
            
            {profile.bio && (
              <p className="text-center text-sm text-muted-foreground">{profile.bio}</p>
            )}
            
            <div className="flex gap-6 pt-1">
              <div className="text-center">
                <div className="text-lg font-semibold">{friendsCount}</div>
                <div className="text-xs text-muted-foreground">Friends</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{routesCount}</div>
                <div className="text-xs text-muted-foreground">Routes</div>
              </div>
            </div>

            {user.id !== userId && (
              <Button
                onClick={handleFollowToggle}
                variant={isFollowing ? "outline" : "default"}
                className="mt-2"
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>
        )}

        <div className="space-y-4">
          {routes?.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
          {!routes?.length && (
            <p className="text-center text-muted-foreground py-8">
              Brak opublikowanych tras
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
