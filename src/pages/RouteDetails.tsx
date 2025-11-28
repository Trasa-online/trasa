import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Heart, Bookmark, MessageCircle, Send } from "lucide-react";
import StarRating from "@/components/route/StarRating";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const RouteDetails = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: route } = useQuery({
    queryKey: ["route-details", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          pins (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: likes } = useQuery({
    queryKey: ["route-likes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("*")
        .eq("route_id", id);

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: comments } = useQuery({
    queryKey: ["route-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles:user_id (username, avatar_url)")
        .eq("route_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: commentLikes } = useQuery({
    queryKey: ["comment-likes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comment_likes")
        .select("*");

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: isSaved } = useQuery({
    queryKey: ["is-saved", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_routes")
        .select("*")
        .eq("route_id", id)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!id && !!user,
  });

  const isLiked = likes?.some((like) => like.user_id === user?.id);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("route_id", id)
          .eq("user_id", user?.id);
      } else {
        await supabase
          .from("likes")
          .insert({ route_id: id, user_id: user?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-likes"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await supabase
          .from("saved_routes")
          .delete()
          .eq("route_id", id)
          .eq("user_id", user?.id);
      } else {
        await supabase
          .from("saved_routes")
          .insert({ route_id: id, user_id: user?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-saved"] });
      toast({ title: isSaved ? "Usunięto z zapisanych" : "Zapisano trasę" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("comments")
        .insert({ route_id: id, user_id: user?.id, content: comment });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-comments"] });
      setComment("");
    },
  });

  const commentLikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const isLiked = commentLikes?.some(
        (like) => like.comment_id === commentId && like.user_id === user?.id
      );

      if (isLiked) {
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user?.id);
      } else {
        await supabase
          .from("comment_likes")
          .insert({ comment_id: commentId, user_id: user?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-likes"] });
    },
  });

  if (loading || !user || !route) return null;

  const avgRating =
    route.pins?.length > 0
      ? route.pins.reduce((acc: number, pin: any) => acc + (pin.rating || 0), 0) /
        route.pins.length
      : 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-4 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold">Route Details</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={route.profiles?.avatar_url} />
              <AvatarFallback>
                {route.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{route.profiles?.username}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(route.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            className="p-2 hover:bg-accent rounded-lg"
          >
            <Bookmark
              className={`h-6 w-6 ${isSaved ? "fill-foreground" : ""}`}
            />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">{route.title}</h2>
            <StarRating rating={Math.round(avgRating * 10) / 10} size="md" />
          </div>
          {route.description && (
            <p className="text-muted-foreground">{route.description}</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            Stops ({route.pins?.length || 0})
          </h3>
          <div className="space-y-4">
            {route.pins
              ?.sort((a: any, b: any) => a.pin_order - b.pin_order)
              .map((pin: any, index: number) => (
                <div
                  key={pin.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      {pin.image_url ? (
                        <img
                          src={pin.image_url}
                          alt={pin.place_name}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-2xl font-bold">
                            {index + 1}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold">{pin.place_name}</h4>
                        <StarRating rating={pin.rating || 0} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {pin.address}
                      </p>
                      {pin.description && (
                        <p className="text-sm">{pin.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-4 py-4 border-y border-border">
          <button
            onClick={() => likeMutation.mutate()}
            className="flex items-center gap-2"
          >
            <Heart
              className={`h-6 w-6 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            <span>{likes?.length || 0}</span>
          </button>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <span>{comments?.length || 0}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Comments</h3>
          {comments?.map((comment: any) => {
            const commentLikesCount = commentLikes?.filter(
              (like) => like.comment_id === comment.id
            ).length || 0;
            const isCommentLiked = commentLikes?.some(
              (like) => like.comment_id === comment.id && like.user_id === user?.id
            );

            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profiles?.avatar_url} />
                  <AvatarFallback>
                    {comment.profiles?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {comment.profiles?.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "HH:mm")}
                    </p>
                  </div>
                  <p className="text-sm mb-1">{comment.content}</p>
                  <button
                    onClick={() => commentLikeMutation.mutate(comment.id)}
                    className="flex items-center gap-1 text-xs hover:text-red-500"
                  >
                    <Heart
                      className={`h-3 w-3 ${
                        isCommentLiked ? "fill-red-500 text-red-500" : ""
                      }`}
                    />
                    {commentLikesCount > 0 && <span>{commentLikesCount}</span>}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
            />
            <Button
              size="icon"
              onClick={() => comment.trim() && commentMutation.mutate()}
              disabled={!comment.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteDetails;
