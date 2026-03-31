import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { MapPin, Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RouteCommentsSheet from "./RouteCommentsSheet";

interface FeedRoute {
  id: string;
  city: string;
  created_at: string;
  ai_summary?: string | null;
  review_photos?: string[] | null;
  likes?: { user_id: string }[];
  comments?: { id: string }[];
}

interface FeedActor {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

interface FeedActivityCardProps {
  route: FeedRoute;
  actor: FeedActor;
}

export default function FeedActivityCard({ route, actor }: FeedActivityCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const displayName = actor.first_name || actor.username || "Ktoś";
  const timeAgo = formatDistanceToNow(new Date(route.created_at), { addSuffix: false, locale: pl });
  const photos = route.review_photos ?? [];

  const likedBy = (route.likes ?? []).map(l => l.user_id);
  const likeCount = likedBy.length;
  const isLiked = !!user && likedBy.includes(user.id);
  const commentCount = (route.comments ?? []).length;

  const likeMutation = useMutation({
    mutationFn: async (liked: boolean) => {
      if (!user) throw new Error("Brak sesji");
      if (liked) {
        const { error } = await supabase.from("likes").insert({ route_id: route.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").delete()
          .eq("route_id", route.id).eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: ["social-feed-v2", user?.id] });
      queryClient.setQueryData<any>(["social-feed-v2", user?.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.route.id !== route.id ? item : {
              ...item,
              route: {
                ...item.route,
                likes: liked
                  ? [...(item.route.likes ?? []), { user_id: user!.id }]
                  : (item.route.likes ?? []).filter((l: any) => l.user_id !== user!.id),
              },
            }
          ),
        };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
    },
  });

  const goToProfile = () => actor.username && navigate(`/profil/${actor.username}`);
  const goToRoute = () => navigate(`/route/${route.id}`);

  return (
    <>
      <div className="flex gap-3 px-4 py-4">
        {/* Left: avatar + thread line */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <button onClick={goToProfile}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={actor.avatar_url || ""} />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="w-px flex-1 min-h-[24px] bg-border/50" />
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 pb-1">
          {/* Header */}
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <button onClick={goToProfile} className="font-semibold text-sm leading-tight hover:underline truncate">
              {displayName}
            </button>
            <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
          </div>

          {/* City */}
          <button onClick={goToRoute} className="flex items-center gap-1 mb-1.5">
            <MapPin className="h-3 w-3 text-orange-600 flex-shrink-0" />
            <span className="text-sm font-medium">{route.city}</span>
          </button>

          {/* Summary */}
          {route.ai_summary && (
            <p className="text-sm text-foreground/80 leading-relaxed mb-2.5 line-clamp-3">
              {route.ai_summary}
            </p>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div className={`grid gap-1.5 mb-3 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {photos.slice(0, 2).map((url, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-muted aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-5 mt-2">
            <button
              onClick={() => user && likeMutation.mutate(!isLiked)}
              className="flex items-center gap-1.5 transition-colors"
              disabled={!user || likeMutation.isPending}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
              {likeCount > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{likeCount}</span>
              )}
            </button>

            <button
              onClick={() => setCommentsOpen(true)}
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <MessageCircle className="h-5 w-5" />
              {commentCount > 0 && (
                <span className="text-xs tabular-nums">{commentCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <RouteCommentsSheet
        routeId={route.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </>
  );
}
