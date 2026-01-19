import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import RouteCard from "@/components/route/RouteCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QuickNoteDialog } from "@/components/QuickNoteDialog";

const Feed = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader 
        title="TRASA" 
        showBell 
        showSearch 
        showQuickNote
        unreadCount={unreadCount}
        onQuickNoteClick={() => setQuickNoteOpen(true)}
      />
      
      <QuickNoteDialog 
        open={quickNoteOpen} 
        onOpenChange={setQuickNoteOpen} 
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
                  onClick={() => navigate(`/friends/${user.id}`)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="text-sm font-semibold">{friendsCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">Friends</span>
                </button>
                <Link 
                  to="/my-routes"
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="text-sm font-semibold">{routesCount}</span>
                  <span className="text-xs text-muted-foreground ml-1">Routes</span>
                </Link>
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
