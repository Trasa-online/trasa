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

  // Read directly from cache — stays in sync without useEffect fights
  const cached = queryClient.getQueryData<string[]>(["following-ids", user?.id]);
  const isFollowing = cached != null
    ? cached.includes(targetUserId)
    : initialIsFollowing;

  const mutation = useMutation({
    // Pass the intended action as a variable to avoid stale closure on isFollowing
    mutationFn: async (follow: boolean) => {
      if (!user) throw new Error("Brak sesji");
      if (follow) {
        const { error } = await supabase.from("followers")
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
      }
    },
    onMutate: (follow) => {
      // Optimistically update the cache directly — no local useState
      queryClient.setQueryData<string[]>(["following-ids", user?.id], (old = []) =>
        follow ? [...old, targetUserId] : old.filter(id => id !== targetUserId)
      );
    },
    onError: (error, follow) => {
      // Revert cache on error
      queryClient.setQueryData<string[]>(["following-ids", user?.id], (old = []) =>
        follow ? old.filter(id => id !== targetUserId) : [...old, targetUserId]
      );
      toast.error("Błąd: " + (error as any)?.message ?? "Spróbuj ponownie");
    },
    onSuccess: (_, follow) => {
      toast.success(follow ? "Obserwujesz!" : "Przestałeś obserwować");
      queryClient.invalidateQueries({ queryKey: ["following-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-follow-counts", targetUserId] });
    },
  });

  if (!user || user.id === targetUserId) return null;

  return (
    <button
      onClick={() => mutation.mutate(!isFollowing)}
      disabled={mutation.isPending}
      className={cn(
        "px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-60",
        isFollowing
          ? "bg-muted text-foreground border border-border/50"
          : "bg-orange-600 text-white shadow-md shadow-orange-600/20",
        className
      )}
    >
      {mutation.isPending ? "…" : (isFollowing ? "Obserwujesz" : "Obserwuj")}
    </button>
  );
}
