import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
  className?: string;
}

export default function FollowButton({ targetUserId, initialIsFollowing, className }: FollowButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  // Sync with prop when it changes (e.g. after query refetch)
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (isFollowing) {
        const { error } = await supabase.from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("followers")
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
      }
    },
    onMutate: () => {
      const wasFollowing = isFollowing;
      setIsFollowing(prev => !prev); // optimistic
      return { wasFollowing };
    },
    onError: (error, _, context) => {
      console.error("Follow error:", error);
      setIsFollowing(context?.wasFollowing ?? isFollowing); // revert
      toast.error("Nie udało się zaktualizować obserwowania");
    },
    onSuccess: (_, __, context) => {
      toast.success(context?.wasFollowing ? "Przestałeś obserwować" : "Obserwujesz!");
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["following-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-follow-counts", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
    },
  });

  if (!user || user.id === targetUserId) return null;

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={cn(
        "px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95",
        isFollowing
          ? "bg-muted text-foreground border border-border/50"
          : "bg-orange-600 text-white shadow-md shadow-orange-600/20",
        className
      )}
    >
      {isFollowing ? "Obserwujesz" : "Obserwuj"}
    </button>
  );
}
