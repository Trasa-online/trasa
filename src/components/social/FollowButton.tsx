import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { BrandUserPlus } from "@/components/BrandIcon";

interface FollowButtonProps {
  targetUserId: string;
  /** Wartosc poczatkowa zanim doczyta sie realny stat (opcjonalna - komponent i tak sam pobiera). */
  initialIsFollowing?: boolean;
  className?: string;
  /** Sama ikona w kolku (profil publiczny, prosba Nat 2026-09-13): pomaranczowa z "dodaj osobe",
   *  gdy nie obserwujesz; szara z "ptaszkiem", gdy juz obserwujesz. Tekst zostaje w aria-label. */
  iconOnly?: boolean;
}

export default function FollowButton({ targetUserId, initialIsFollowing = false, className, iconOnly = false }: FollowButtonProps) {
  const { t } = useTranslation("social");
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
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
      if (!user) throw new Error(t("follow.no_session"));
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
      toast.error((error as any)?.message ?? t("follow.try_again"));
    },
    onSuccess: (_, follow) => {
      toast.success(follow ? t("follow.now_following") : t("follow.unfollowed"));
      queryClient.invalidateQueries({ queryKey: ["following-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-follow-counts", targetUserId] });
    },
  });

  if (!user || user.id === targetUserId) return null;

  if (iconOnly) {
    const label = isFollowing ? t("follow.following") : t("follow.follow");
    return (
      <button
        onClick={() => { if (isAnonymous) { openAuthDrawer({ mode: "register", hint: "follow" }); return; } mutation.mutate(!isFollowing); }}
        disabled={mutation.isPending}
        aria-label={label}
        aria-pressed={isFollowing}
        title={label}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-60",
          isFollowing ? "bg-muted text-foreground border border-border/50" : "bg-primary text-white shadow-sm",
          className,
        )}
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowing ? <UserCheck className="h-4 w-4" strokeWidth={2.4} /> : <BrandUserPlus className="h-4 w-4" strokeWidth={2.4} />}
      </button>
    );
  }

  return (
    <button
      onClick={() => { if (isAnonymous) { openAuthDrawer({ mode: "register", hint: "follow" }); return; } mutation.mutate(!isFollowing); }}
      disabled={mutation.isPending}
      className={cn(
        "px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-60",
        isFollowing
          ? "bg-muted text-foreground border border-border/50"
          : "bg-primary text-white",
        className
      )}
    >
      {mutation.isPending ? "…" : (isFollowing ? t("follow.following") : t("follow.follow"))}
    </button>
  );
}
