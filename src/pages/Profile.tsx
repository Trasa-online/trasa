import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import TripFeedCard from "@/components/feed/TripFeedCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

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
      <PageHeader 
        title="Profil" 
        showBack 
        showBell 
        showSearch 
        unreadCount={unreadCount}
        rightAction={
          user?.id === userId ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
          ) : undefined
        }
      />
      
      <div className="p-4 space-y-4">

      {profile && (
        <div className="flex items-center gap-4 bg-muted/30 rounded-xl p-4 border border-border/50">
            <Avatar className="h-14 w-14 flex-shrink-0">
              <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
              <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold uppercase">{profile.username}</h2>
              
              {profile.bio && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>
              )}
              
              <div className="flex gap-4 mt-2">
                <button 
                  onClick={() => navigate(`/friends/${userId}`)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="text-sm font-semibold">{friendsCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">Friends</span>
                </button>
                <div className="hover:opacity-70 transition-opacity">
                  <span className="text-sm font-semibold">{routesCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">Routes</span>
                </div>
              </div>

              {user.id !== userId && (
                <Button
                  onClick={handleFollowToggle}
                  variant={isFollowing ? "outline" : "default"}
                  className="mt-3"
                  size="sm"
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {routes?.map((route) => (
          <TripFeedCard key={route.id} route={route} currentUserId={user?.id} />
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
