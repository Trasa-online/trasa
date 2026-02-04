import { useEffect, useState, createContext, useContext } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Heart, Bookmark, MessageCircle, Send, Pencil, Trash2, X, Check, ImageIcon, Share2, Star, UtensilsCrossed, Coffee, ShoppingBag, Gift, Mountain, Waves } from "lucide-react";
import { getNoteTypeConfig, NoteType } from "@/lib/noteTypes";
import { getPinImage, getPinImagesForRoute } from "@/lib/pinPlaceholders";
import { PinVisitDialog } from "@/components/route/PinVisitDialog";
import { FullscreenMapDialog } from "@/components/route/FullscreenMapDialog";
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
import { ImageLightbox, useLightbox } from "@/components/ui/image-lightbox";

// Context for lightbox
const LightboxContext = createContext<{
  openLightbox: (images: string[], initialIndex?: number) => void;
}>({ openLightbox: () => {} });

// Component to display pin visitors (simplified - only show visitor count and avatars)
const PinVisitors = ({ pinId }: { pinId: string }) => {
  const { data: visitors = [] } = useQuery({
    queryKey: ["pin-visitors", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pin_visits")
        .select("user_id, rating, profiles:user_id (username, avatar_url)")
        .eq("pin_id", pinId);

      if (error) throw error;
      return data || [];
    },
  });

  const visitorCount = visitors.length;
  
  // Calculate average rating from visitors
  const visitorsWithRating = visitors.filter((v: any) => v.rating && v.rating > 0);
  const averageRating = visitorsWithRating.length > 0 
    ? visitorsWithRating.reduce((sum: number, v: any) => sum + v.rating, 0) / visitorsWithRating.length 
    : 0;

  if (visitorCount === 0) {
    return null;
  }

  const previewVisitors = visitors.slice(0, 3);

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex -space-x-1.5">
        {previewVisitors.map((visitor: any) => (
          <Avatar key={visitor.user_id} className="h-5 w-5 ring-2 ring-background">
            <AvatarImage src={visitor.profiles?.avatar_url || ""} />
            <AvatarFallback className="text-[8px] bg-muted">
              {visitor.profiles?.username?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        ))}
        {visitorCount > 3 && (
          <div className="h-5 w-5 ring-2 ring-background rounded-full bg-muted flex items-center justify-center">
            <span className="text-[8px] font-bold">+{visitorCount - 3}</span>
          </div>
        )}
      </div>
      
      {averageRating > 0 && (
        <div className="flex items-center gap-0.5 text-xs">
          <Star className="h-3 w-3 fill-star text-star" />
          <span className="font-medium">{averageRating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};

// Component to display pins with notes
const RouteNotesDisplay = ({ pins, pinNotes, currentUserId }: { pins: any[]; pinNotes: any[]; currentUserId: string }) => {
  const [hiddenNoteImages, setHiddenNoteImages] = useStateLocal<Set<string>>(new Set());
  const lightbox = useContext(LightboxContext);

  const toggleNoteImage = (noteId: string) => {
    setHiddenNoteImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const sortedPins = pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
  
  // Get images for all pins ensuring no consecutive placeholders are the same
  const pinImages = getPinImagesForRoute(sortedPins);
  
  // Group notes by pin_id
  const notesByPinId = new Map<string, any[]>();
  pinNotes?.forEach((note: any) => {
    const existing = notesByPinId.get(note.pin_id) || [];
    notesByPinId.set(note.pin_id, [...existing, note].sort((a, b) => a.note_order - b.note_order));
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <h3 className="text-base font-semibold">
          Przystanki ({pins?.length || 0})
        </h3>
      </div>
      
      <div className="divide-y divide-border/50">
        {sortedPins.map((pin: any, index: number) => {
          const pinNotesForThis = notesByPinId.get(pin.id) || [];

          return (
            <div key={pin.id}>
              <div className="p-4">
                <div className="flex gap-3">
                  <div 
                    className="flex-shrink-0 relative cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (pin.image_url) {
                        const allImages = sortedPins.filter((p: any) => p.image_url).map((p: any) => p.image_url);
                        const idx = allImages.indexOf(pin.image_url);
                        lightbox.openLightbox(allImages, idx >= 0 ? idx : 0);
                      }
                    }}
                  >
                    <img
                      src={pinImages[index]}
                      alt={pin.place_name || pin.address}
                      className="w-20 h-20 object-cover rounded-lg ring-1 ring-border"
                    />
                    <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center ring-1 ring-border">
                      <span className="text-xs font-bold">{index + 1}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link to={`/pin/${pin.id}`} className="hover:text-primary transition-colors">
                          <h4 className="font-semibold text-sm leading-tight">
                            {pin.place_name || pin.address}
                          </h4>
                        </Link>
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
                    <PinVisitors pinId={pin.id} />
                  </div>
                </div>
              </div>
              
              {/* Display notes for this pin */}
              {pinNotesForThis.length > 0 && (
                <div className="mx-4 mb-4 space-y-2">
                  {pinNotesForThis.map((note: any) => {
                    const isImageHidden = hiddenNoteImages.has(note.id);
                    const noteConfig = getNoteTypeConfig(note.note_type as NoteType);
                    const Icon = noteConfig.icon;
                    
                    return (
                      <div key={note.id} className={`p-2 border rounded-lg ${noteConfig.bgColor} ${noteConfig.borderColor}`}>
                        <div className="flex items-start gap-2">
                          <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${noteConfig.iconColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-[10px] font-medium ${noteConfig.labelColor}`}>{noteConfig.label}</p>
                              {note.image_url && (
                                <button
                                  type="button"
                                  onClick={() => toggleNoteImage(note.id)}
                                  className={`flex items-center gap-0.5 text-[9px] ${noteConfig.labelColor} hover:opacity-80`}
                                >
                                  <ImageIcon className="h-3 w-3" />
                                  <span>{isImageHidden ? 'pokaż' : 'ukryj'}</span>
                                </button>
                              )}
                            </div>
                            {note.text && (
                              <p className="text-xs text-foreground leading-relaxed mt-0.5">{note.text}</p>
                            )}
                            {note.image_url && !isImageHidden && (
                              <div 
                                className="mt-2 relative h-20 w-28 rounded-lg overflow-hidden ring-1 ring-border cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => lightbox.openLightbox([note.image_url])}
                              >
                                <img src={note.image_url} alt="Notatka" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
  
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const { lightboxState, openLightbox, setLightboxOpen } = useLightbox();
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

      // Fetch pin notes - now linked to pins
      const pinIds = data.pins?.map((p: any) => p.id) || [];
      let pinNotes: any[] = [];
      if (pinIds.length > 0) {
        const { data: notes } = await supabase
          .from("route_notes")
          .select("*")
          .in("pin_id", pinIds);
        pinNotes = notes || [];
      }

      return { ...data, pin_notes: pinNotes };
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
    refetchInterval: 30000, // Fallback polling every 30 seconds
  });

  // Supabase Realtime subscription for instant like updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`route-likes-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `route_id=eq.${id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["route-likes", id] });
          queryClient.invalidateQueries({ queryKey: ["route-card-likes", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

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

  // Scroll to comments section if hash is #comments
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#comments") {
      setTimeout(() => {
        const commentsSection = document.getElementById("comments");
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    }
  }, [location.hash, comments]);

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

  // Collect all images for lightbox
  const allRouteImages = (route.pins || [])
    .filter((p: any) => p.image_url)
    .sort((a: any, b: any) => a.pin_order - b.pin_order)
    .map((p: any) => p.image_url);

  return (
    <LightboxContext.Provider value={{ openLightbox }}>
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold flex-1">Szczegóły trasy</h1>
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
          <h2 className="text-xl font-bold leading-tight mb-3">{route.title}</h2>
          {route.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {route.description}
            </p>
          )}
          
          {/* Tags Section */}
          {(() => {
            const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
            const allTags = sortedPins.flatMap((pin: any) => pin.tags || []);
            const uniqueTags = Array.from(new Set(allTags)) as string[];
            
            const getTagIcon = (tag: string) => {
              const tagLower = tag.toLowerCase();
              if (tagLower === 'restauracja' || tagLower === 'jedzenie') return UtensilsCrossed;
              if (tagLower === 'kawiarnia' || tagLower === 'kawa' || tagLower === 'herbata') return Coffee;
              if (tagLower === 'zakupy') return ShoppingBag;
              if (tagLower === 'pamiątki') return Gift;
              if (tagLower === 'góry') return Mountain;
              if (tagLower === 'morze') return Waves;
              return null;
            };

            const MAX_VISIBLE_TAGS = 6;
            const displayTags = tagsExpanded ? uniqueTags : uniqueTags.slice(0, MAX_VISIBLE_TAGS);
            const remainingCount = uniqueTags.length - MAX_VISIBLE_TAGS;

            return uniqueTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/30 transition-all duration-300">
                {displayTags.map((tag: string, idx: number) => {
                  const TagIcon = getTagIcon(tag);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-secondary text-secondary-foreground"
                    >
                      {TagIcon && <TagIcon className="h-3.5 w-3.5" />}
                      <span>{tag}</span>
                    </span>
                  );
                })}
                {remainingCount > 0 && !tagsExpanded && (
                  <button
                    onClick={() => setTagsExpanded(true)}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    +{remainingCount}
                  </button>
                )}
                {tagsExpanded && remainingCount > 0 && (
                  <button
                    onClick={() => setTagsExpanded(false)}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    Zwiń
                  </button>
                )}
              </div>
            ) : null;
          })()}
        </div>

        {/* Route Map */}
        {route.pins && route.pins.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <RouteMap 
              pins={route.pins.sort((a: any, b: any) => a.pin_order - b.pin_order)}
              className="h-48"
              onClick={() => setShowFullscreenMap(true)}
              showExpandButton
            />
          </div>
        )}

        {/* Pins Section */}
        <RouteNotesDisplay 
          pins={route.pins}
          pinNotes={route.pin_notes}
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
        </div>

        <div id="comments" className="space-y-4 scroll-mt-20">
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


      <FullscreenMapDialog
        open={showFullscreenMap}
        onOpenChange={setShowFullscreenMap}
        pins={route.pins?.sort((a: any, b: any) => a.pin_order - b.pin_order) || []}
        title={route.title}
      />

      <ImageLightbox
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        open={lightboxState.open}
        onOpenChange={setLightboxOpen}
      />
    </div>
    </LightboxContext.Provider>
  );
};

export default RouteDetails;
