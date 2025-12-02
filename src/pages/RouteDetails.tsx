import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Heart, Bookmark, MessageCircle, Send, Pencil, Trash2, X, Check } from "lucide-react";
import StarRating from "@/components/route/StarRating";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import RouteMap from "@/components/RouteMap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RouteDetails = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

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

  // Increment view count when route is loaded
  useEffect(() => {
    const incrementViews = async () => {
      if (route?.id) {
        await supabase.rpc('increment_route_views', { route_id: route.id });
      }
    };
    
    incrementViews();
  }, [route?.id]);

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

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-comments"] });
      setDeletingCommentId(null);
      toast({ title: "Komentarz usunięty" });
    },
  });

  const handleDeleteClick = (commentId: string) => {
    setDeletingCommentId(commentId);
  };

  const confirmDelete = () => {
    if (deletingCommentId) {
      deleteCommentMutation.mutate(deletingCommentId);
    }
  };

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { error } = await supabase
        .from("comments")
        .update({ content })
        .eq("id", commentId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-comments"] });
      setEditingCommentId(null);
      setEditingContent("");
      toast({ title: "Komentarz zaktualizowany" });
    },
  });

  const startEditingComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditingContent(content);
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditingContent("");
  };

  if (loading || !user || !route) return null;

  // Use the rating stored in the database (calculated from attraction pins only)
  const avgRating = route.rating || 0;

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
          <button 
            onClick={() => navigate(`/profile/${route.user_id}`)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={route.profiles?.avatar_url} />
              <AvatarFallback>
                {route.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-medium">{route.profiles?.username}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(route.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            className="p-2 hover:bg-accent rounded-lg"
          >
            <Bookmark
              className={`h-6 w-6 ${isSaved ? "fill-foreground" : ""}`}
            />
          </button>
        </div>

        {/* Route Header with Title and Rating */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold leading-tight flex-1">{route.title}</h2>
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
              <StarRating rating={Math.round(avgRating * 10) / 10} size="sm" />
            </div>
          </div>
          {route.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {route.description}
            </p>
          )}
        </div>

        {/* Route Map */}
        {route.pins && route.pins.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <RouteMap 
              pins={route.pins.sort((a: any, b: any) => a.pin_order - b.pin_order)}
              className="h-48"
            />
          </div>
        )}

        {/* Pins Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-base font-semibold">
              Przystanki ({route.pins?.length || 0})
            </h3>
          </div>
          
          <div className="divide-y divide-border/50">
            {route.pins
              ?.sort((a: any, b: any) => a.pin_order - b.pin_order)
              .map((pin: any, index: number) => (
                <div key={pin.id} className="p-4">
                  <div className="flex gap-3">
                    {pin.image_url ? (
                      <div className="flex-shrink-0 relative">
                        <img
                          src={pin.image_url}
                          alt={pin.place_name || pin.address}
                          className="w-20 h-20 object-cover rounded-lg ring-1 ring-border"
                        />
                        <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center ring-1 ring-border">
                          <span className="text-xs font-bold">{index + 1}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-20 h-20 bg-muted rounded-lg flex items-center justify-center ring-1 ring-border">
                        <span className="text-xl font-bold">{index + 1}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {pin.image_url && (
                            <div className="bg-muted rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ring-1 ring-border hidden">
                              <span className="text-xs font-bold">{index + 1}</span>
                            </div>
                          )}
                          <h4 className="font-semibold text-sm leading-tight">
                            {pin.place_name || pin.address}
                          </h4>
                        </div>
                        {!pin.is_transport && pin.rating && (
                          <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded flex-shrink-0">
                            <StarRating rating={pin.rating || 0} size="sm" />
                          </div>
                        )}
                      </div>
                      {pin.place_name && pin.address !== pin.place_name && (
                        <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                      )}
                      {!pin.place_name && (
                        <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                      )}
                      {pin.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          {pin.description}
                        </p>
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
          <h3 className="text-lg font-semibold">Komentarze</h3>
          {comments?.map((c: any) => {
            const commentLikesCount = commentLikes?.filter(
              (like) => like.comment_id === c.id
            ).length || 0;
            const isCommentLiked = commentLikes?.some(
              (like) => like.comment_id === c.id && like.user_id === user?.id
            );
            const isOwner = c.user_id === user?.id;
            const isEditing = editingCommentId === c.id;

            return (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={c.profiles?.avatar_url} />
                  <AvatarFallback>
                    {c.profiles?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {c.profiles?.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "HH:mm")}
                    </p>
                    {isOwner && !isEditing && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => startEditingComment(c.id, c.content)}
                          className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c.id)}
                          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => updateCommentMutation.mutate({ commentId: c.id, content: editingContent })}
                        disabled={!editingContent.trim()}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm mb-1">{c.content}</p>
                  )}
                  <button
                    onClick={() => commentLikeMutation.mutate(c.id)}
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
              placeholder="Napisz komentarz..."
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

      <AlertDialog open={!!deletingCommentId} onOpenChange={(open) => !open && setDeletingCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń komentarz</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten komentarz? Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RouteDetails;
