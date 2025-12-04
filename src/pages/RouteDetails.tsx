import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Heart, Bookmark, MessageCircle, Send, Pencil, Trash2, X, Check, Sparkles, ImageIcon, Footprints, Share2, Image, Users, ChevronDown, ChevronUp, Star } from "lucide-react";
import { ShareImageDialog } from "@/components/route/ShareImageDialog";
import { PinVisitDialog } from "@/components/route/PinVisitDialog";
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
import { useState as useStateLocal } from "react";

// Component to display pin visitors
const PinVisitors = ({ pinId, pinName, currentUserId }: { pinId: string; pinName: string; currentUserId: string }) => {
  const [isExpanded, setIsExpanded] = useStateLocal(false);
  const [showVisitDialog, setShowVisitDialog] = useStateLocal(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: visitors = [] } = useQuery({
    queryKey: ["pin-visitors", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pin_visits")
        .select("user_id, created_at, image_url, description, rating, profiles:user_id (username, avatar_url)")
        .eq("pin_id", pinId);

      if (error) throw error;
      return data || [];
    },
  });

  const currentUserVisit = visitors.find((v: any) => v.user_id === currentUserId);
  const hasVisited = !!currentUserVisit;

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pin_visits")
        .delete()
        .eq("pin_id", pinId)
        .eq("user_id", currentUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pin-visitors", pinId] });
      queryClient.invalidateQueries({ queryKey: ["route-pin-visitors"] });
      toast({ title: "Usunięto z odwiedzonych" });
    },
  });

  const visitorCount = visitors.length;

  if (visitorCount === 0) {
    return (
      <>
        <button
          onClick={() => setShowVisitDialog(true)}
          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-all hover:scale-105 active:scale-95"
        >
          <Users className="h-3.5 w-3.5" />
          <span>Byłem tu</span>
        </button>
        <PinVisitDialog
          open={showVisitDialog}
          onOpenChange={setShowVisitDialog}
          pinId={pinId}
          pinName={pinName}
          userId={currentUserId}
          existingVisit={null}
        />
      </>
    );
  }

  const visitorsWithImages = visitors.filter((v: any) => v.image_url);
  const imageCount = visitorsWithImages.length;
  const previewVisitors = visitors.slice(0, 3);
  const firstImage = visitorsWithImages[0]?.image_url;

  return (
    <div className="mt-2">
      {/* Collapsed preview with avatars, image thumbnail and counts */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <div className="flex items-center gap-2">
          {/* Visitor avatars */}
          <div className="flex -space-x-1.5">
            {previewVisitors.map((visitor: any) => (
              <Avatar key={visitor.user_id} className="h-5 w-5 ring-2 ring-background">
                <AvatarImage src={visitor.profiles?.avatar_url || ""} />
                <AvatarFallback className="text-[8px] bg-muted">
                  {visitor.profiles?.username?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          
          {/* Image thumbnail with count */}
          {firstImage && (
            <div className="relative">
              <img
                src={firstImage}
                alt="Zdjęcie z odwiedzin"
                className="h-6 w-6 rounded object-cover"
              />
              {imageCount > 1 && (
                <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">+{imageCount}</span>
                </div>
              )}
            </div>
          )}
          
          <span className="font-medium">
            {visitorCount} {visitorCount === 1 ? 'osoba' : visitorCount < 5 ? 'osoby' : 'osób'}
          </span>
        </div>
        
        <div className="ml-auto flex items-center gap-1">
          {!hasVisited && (
            <span className="text-[10px] text-primary font-medium">Też tu byłem</span>
          )}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {visitors.map((visitor: any) => (
            <div
              key={visitor.user_id}
              className="p-3 bg-muted/40 rounded-xl border border-border/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={visitor.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-[10px]">
                    {visitor.profiles?.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{visitor.profiles?.username || "Anonim"}</span>
                {visitor.rating && (
                  <div className="flex items-center gap-0.5 ml-auto">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= visitor.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {visitor.image_url && (
                <div className="mb-2 rounded-lg overflow-hidden">
                  <img
                    src={visitor.image_url}
                    alt="Zdjęcie z odwiedzin"
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}
              
              {visitor.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {visitor.description}
                </p>
              )}
              
              {visitor.user_id === currentUserId && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVisitDialog(true);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMutation.mutate();
                    }}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Usuń
                  </button>
                </div>
              )}
            </div>
          ))}
          
          {!hasVisited && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVisitDialog(true);
              }}
              className="w-full py-2 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
            >
              + Też tu byłem
            </button>
          )}
        </div>
      )}
      
      <PinVisitDialog
        open={showVisitDialog}
        onOpenChange={setShowVisitDialog}
        pinId={pinId}
        pinName={pinName}
        userId={currentUserId}
        existingVisit={currentUserVisit ? {
          image_url: currentUserVisit.image_url,
          description: currentUserVisit.description,
          rating: currentUserVisit.rating,
        } : null}
      />
    </div>
  );
};

// Component to display pins with notes
const RouteNotesDisplay = ({ pins, routeNotes, currentUserId }: { pins: any[]; routeNotes: any[]; currentUserId: string }) => {
  const [expandedNoteImages, setExpandedNoteImages] = useStateLocal<Set<number>>(new Set());

  const toggleNoteImage = (index: number) => {
    setExpandedNoteImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const sortedPins = pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
  const notesMap = new Map(routeNotes?.map((n: any) => [n.after_pin_index, n]) || []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <h3 className="text-base font-semibold">
          Przystanki ({pins?.length || 0})
        </h3>
      </div>
      
      <div className="divide-y divide-border/50">
        {sortedPins.map((pin: any, index: number) => {
          const noteAfterThis = notesMap.get(index);
          const isImageExpanded = expandedNoteImages.has(index);

          return (
            <div key={pin.id}>
              <div className="p-4">
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
                    
                    {/* Pin visitors section */}
                    <PinVisitors pinId={pin.id} pinName={pin.place_name || pin.address} currentUserId={currentUserId} />
                  </div>
                </div>
              </div>
              
              {/* Display note after this pin */}
              {noteAfterThis && (
                <div className="mx-4 mb-4 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Ciekawe na trasie</p>
                        {noteAfterThis.image_url && (
                          <button
                            type="button"
                            onClick={() => toggleNoteImage(index)}
                            className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                          >
                            <ImageIcon className="h-3 w-3" />
                            <span>{isImageExpanded ? 'ukryj' : 'pokaż'}</span>
                          </button>
                        )}
                      </div>
                      {noteAfterThis.text && (
                        <p className="text-xs text-foreground leading-relaxed mt-0.5">{noteAfterThis.text}</p>
                      )}
                      {noteAfterThis.image_url && isImageExpanded && (
                        <div className="mt-2 relative h-20 w-28 rounded-lg overflow-hidden ring-1 ring-border">
                          <img src={noteAfterThis.image_url} alt="Notatka" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  const [deletingRoute, setDeletingRoute] = useState(false);
  const [showShareImageDialog, setShowShareImageDialog] = useState(false);
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

      // Fetch route notes separately
      const { data: notes } = await supabase
        .from("route_notes")
        .select("*")
        .eq("route_id", id);

      return { ...data, route_notes: notes || [] };
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

  const { data: saveCount = 0 } = useQuery({
    queryKey: ["save-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("saved_routes")
        .select("*", { count: "exact", head: true })
        .eq("route_id", id!);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  // Query for unique users who visited any pin on this route
  const { data: routePinVisitors = [] } = useQuery({
    queryKey: ["route-pin-visitors", id],
    queryFn: async () => {
      if (!route?.pins) return [];
      
      const pinIds = route.pins.map((p: any) => p.id);
      if (pinIds.length === 0) return [];

      const { data, error } = await supabase
        .from("pin_visits")
        .select("user_id, profiles:user_id (username, avatar_url)")
        .in("pin_id", pinIds);

      if (error) throw error;
      
      // Get unique users
      const uniqueUsers = new Map();
      data?.forEach((visit: any) => {
        if (!uniqueUsers.has(visit.user_id)) {
          uniqueUsers.set(visit.user_id, visit);
        }
      });
      
      return Array.from(uniqueUsers.values());
    },
    enabled: !!id && !!route?.pins,
  });

  const hasUserVisitedAnyPin = routePinVisitors.some((v: any) => v.user_id === user?.id);

  const { data: isCompleted = false } = useQuery({
    queryKey: ["is-completed", id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("route_completions")
        .select("*")
        .eq("route_id", id!)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!id && !!user,
  });

  const { data: completionCount = 0 } = useQuery({
    queryKey: ["completion-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("route_completions")
        .select("*", { count: "exact", head: true })
        .eq("route_id", id!);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
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
      queryClient.invalidateQueries({ queryKey: ["save-count", id] });
      toast({ title: isSaved ? "Usunięto z zapisanych" : "Zapisano trasę" });
    },
  });

  const completionMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      if (isCompleted) {
        const { error } = await supabase
          .from("route_completions")
          .delete()
          .eq("route_id", id!)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("route_completions")
          .insert({
            route_id: id!,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-completed", id] });
      queryClient.invalidateQueries({ queryKey: ["completion-count", id] });
      toast({ title: isCompleted ? "Cofnięto oznaczenie" : "Oznaczono jako przejdzoną!" });
    },
    onError: () => {
      toast({ title: "Nie udało się oznaczyć trasy", variant: "destructive" });
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

  const deleteRouteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-routes-published"] });
      queryClient.invalidateQueries({ queryKey: ["my-routes-draft"] });
      toast({ title: "Trasa została usunięta" });
      navigate("/my-routes");
    },
  });

  if (loading || !user || !route) return null;

  const isOwner = route.user_id === user.id;

  // Use the rating stored in the database (calculated from attraction pins only)
  const avgRating = route.rating || 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-4 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex-1">Szczegóły trasy</h1>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/edit/${route.id}`)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edytuj
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDeletingRoute(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
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
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const url = `${window.location.origin}/route/${route.id}`;
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: route.title,
                      text: route.description || `Sprawdź trasę: ${route.title}`,
                      url: url,
                    });
                  } catch (err) {
                    await navigator.clipboard.writeText(url);
                    toast({ title: "Link skopiowany do schowka" });
                  }
                } else {
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Link skopiowany do schowka" });
                }
              }}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Share2 className="h-6 w-6" />
            </button>
            <button
              onClick={() => setShowShareImageDialog(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Generuj obrazek"
            >
              <Image className="h-6 w-6" />
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Bookmark
                className={`h-6 w-6 ${isSaved ? "fill-foreground" : ""}`}
              />
            </button>
          </div>
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
        <RouteNotesDisplay 
          pins={route.pins}
          routeNotes={route.route_notes}
          currentUserId={user.id}
        />

        <div className="flex items-center gap-5 py-4 border-y border-border">
          <button
            onClick={() => likeMutation.mutate()}
            className="flex items-center gap-2 text-muted-foreground hover:text-red-500 transition-all duration-200"
          >
            <Heart
              className={`h-[18px] w-[18px] transition-transform hover:scale-110 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            <span className="text-sm font-semibold tabular-nums">{likes?.length || 0}</span>
          </button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageCircle className="h-[18px] w-[18px]" />
            <span className="text-sm font-semibold tabular-nums">{comments?.length || 0}</span>
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            className={`flex items-center gap-2 transition-all duration-200 ${isSaved ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Bookmark className={`h-[18px] w-[18px] transition-transform hover:scale-110 ${isSaved ? "fill-foreground" : ""}`} />
            <span className="text-sm font-semibold tabular-nums">{saveCount}</span>
          </button>
          <div
            className={`flex items-center gap-2 transition-all duration-200 ${hasUserVisitedAnyPin ? "text-primary" : "text-muted-foreground"}`}
            title={`${routePinVisitors.length} ${routePinVisitors.length === 1 ? 'osoba odwiedziła' : 'osób odwiedziło'} miejsca na trasie`}
          >
            <Footprints className={`h-[18px] w-[18px] ${hasUserVisitedAnyPin ? "fill-primary" : ""}`} />
            <span className="text-sm font-semibold tabular-nums">{routePinVisitors.length}</span>
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

      <AlertDialog open={deletingRoute} onOpenChange={setDeletingRoute}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń trasę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć tę trasę? Wszystkie dane, piny i komentarze zostaną usunięte. Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteRouteMutation.mutate()} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń trasę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareImageDialog
        open={showShareImageDialog}
        onOpenChange={setShowShareImageDialog}
        route={{
          id: route.id,
          title: route.title,
          description: route.description,
          pins: route.pins,
        }}
      />
    </div>
  );
};

export default RouteDetails;
