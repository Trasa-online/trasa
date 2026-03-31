import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
  className?: string;
}

export default function FollowButton({ targetUserId, initialIsFollowing, className }: FollowButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isFollowing) {
        await supabase.from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
      } else {
        await supabase.from("followers")
          .insert({ follower_id: user.id, following_id: targetUserId });
      }
    },
    onMutate: () => {
      setIsFollowing(prev => !prev); // optimistic
    },
    onError: () => {
      setIsFollowing(prev => !prev); // revert
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["following-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
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
