import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  // useQuery subscribes to the cache - component re-renders on setQueryData
  const { data: followingIds } = useQuery<string[]>({
    queryKey: ["following-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
      return (data ?? []).map(r => r.following_id as string);
    },
    enabled: !!user,
    staleTime: 0,
  });
  const isFollowing = followingIds != null
    ? followingIds.includes(targetUserId)
    : initialIsFollowing;

  const mutation = useMutation({
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
    onMutate: async (follow) => {
      // Cancel any in-flight refetch - otherwise it would overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["following-ids", user?.id] });
      const previous = queryClient.getQueryData<string[]>(["following-ids", user?.id]);
      queryClient.setQueryData<string[]>(["following-ids", user?.id], (old = []) =>
        follow ? [...old, targetUserId] : old.filter(id => id !== targetUserId)
      );
      return { previous };
    },
    onError: (error, _follow, context) => {
      // Revert to snapshot taken before optimistic update
      queryClient.setQueryData(["following-ids", user?.id], context?.previous);
      toast.error((error as any)?.message ?? "Spróbuj ponownie");
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
          : "bg-primary text-white shadow-md shadow-primary/20",
        className
      )}
    >
      {mutation.isPending ? "…" : (isFollowing ? "Obserwujesz" : "Obserwuj")}
    </button>
  );
}
