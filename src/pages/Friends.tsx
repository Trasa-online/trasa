import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Friends = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useParams<{ userId: string }>();
  const isOwnProfile = user?.id === userId;

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

  const { data: friends } = useQuery({
    queryKey: ["friends-list", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select(`
          following_id,
          profiles:following_id (username, avatar_url, id)
        `)
        .eq("follower_id", userId!);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (followingId: string) => {
      const { error } = await supabase
        .from("followers")
        .delete()
        .eq("follower_id", user!.id)
        .eq("following_id", followingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends-list", userId] });
      queryClient.invalidateQueries({ queryKey: ["friends-count", userId] });
      toast.success("Odobserwowano");
    },
    onError: () => {
      toast.error("Nie udało się odobserwować");
    },
  });

  if (loading || !user) return null;

  return (
    <AppLayout>
      <PageHeader 
        title="Friends" 
        showBack
      />
      
      <div className="p-4">
        {profile && (
          <p className="text-sm text-muted-foreground mb-4">
            @{profile.username}
          </p>
        )}

        <div className="space-y-3">
          {friends?.map((friend: any) => (
            <div
              key={friend.profiles.id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors"
            >
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => navigate(`/profile/${friend.profiles.id}`)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={friend.profiles.avatar_url || ""} />
                  <AvatarFallback>
                    {friend.profiles.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium">{friend.profiles.username}</p>
              </div>

              {isOwnProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unfollowMutation.mutate(friend.profiles.id)}
                  disabled={unfollowMutation.isPending}
                >
                  Unfollow
                </Button>
              )}
            </div>
          ))}

          {!friends?.length && (
            <p className="text-center text-muted-foreground py-12">
              Brak znajomych
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Friends;
