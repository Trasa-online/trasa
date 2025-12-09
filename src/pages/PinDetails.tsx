import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Star, MessageSquare, ChevronLeft, ChevronRight, Eye, Heart, Send, Trash2, Pencil, X, Check } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useCallback } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { PinVisitDialog } from "@/components/route/PinVisitDialog";
import { toast } from "sonner";
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

// Component for visit card with likes and comments
const VisitCard = ({
  visit,
  pinId,
  allImages,
  openLightbox,
  likesCount,
  isLiked,
  comments,
  user,
  onLike,
  onComment,
  onDeleteComment,
  onEditComment,
  isOwnVisit,
  onEditVisit,
  onDeleteVisit,
}: {
  visit: any;
  pinId: string;
  allImages: string[];
  openLightbox: (images: string[], index: number) => void;
  likesCount: number;
  isLiked: boolean;
  comments: any[];
  user: any;
  onLike: () => void;
  onComment: (content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  isOwnVisit?: boolean;
  onEditVisit?: () => void;
  onDeleteVisit?: () => void;
}) => {
  const [commentInput, setCommentInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const handleSubmitComment = () => {
    if (!commentInput.trim()) return;
    onComment(commentInput);
    setCommentInput("");
    // Ensure comments section stays open after adding comment
    setShowComments(true);
  };

  const handleStartEdit = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editingContent.trim() || !editingCommentId) return;
    onEditComment(editingCommentId, editingContent);
    setEditingCommentId(null);
    setEditingContent("");
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent("");
  };

  return (
    <div className="p-3 bg-muted/40 rounded-xl border border-border/50">
      {/* Horizontal layout like reference */}
      <div className="flex gap-3">
        {/* Left: Image */}
        {visit.image_url ? (
          <div
            className="shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => {
              const imageIndex = allImages.indexOf(visit.image_url);
              openLightbox(allImages, imageIndex >= 0 ? imageIndex : 0);
            }}
          >
            <img
              src={visit.image_url}
              alt={`Zdjęcie od ${visit.profiles?.username}`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="shrink-0 w-20 h-20 rounded-lg bg-gradient-to-br from-muted via-muted/80 to-muted/50 flex items-center justify-center">
            <Link to={`/profile/${visit.profiles?.id}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={visit.profiles?.avatar_url || ""} />
                <AvatarFallback className="text-sm">
                  {visit.profiles?.username?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        )}

        {/* Right: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/profile/${visit.profiles?.id}`}
                className="font-semibold text-sm hover:text-primary line-clamp-1"
              >
                {visit.profiles?.username || "Anonim"}
              </Link>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(visit.created_at), "d MMM yyyy", { locale: pl })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {visit.rating && visit.rating > 0 && (
                <div className="flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{visit.rating.toFixed(1)}</span>
                </div>
              )}
              {isOwnVisit && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onEditVisit}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={onDeleteVisit}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {visit.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
              {visit.description}
            </p>
          )}
        </div>
      </div>

      {/* Like and Comment actions */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
        <button
          onClick={onLike}
          disabled={!user}
          className={`flex items-center gap-1 text-xs transition-colors ${
            isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          } disabled:opacity-50`}
        >
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-red-500" : ""}`} />
          <span>{likesCount > 0 ? likesCount : ""}</span>
        </button>
        
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{comments.length > 0 ? comments.length : ""}</span>
        </button>
      </div>

      {/* Comment input - always visible for logged users */}
      {user && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
          <Input
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Dodaj komentarz..."
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleSubmitComment}
            disabled={!commentInput.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Comments list - expandable */}
      {showComments && comments.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/30 space-y-2">
          {comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-2 text-xs">
              <Link to={`/profile/${comment.profiles?.id}`}>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={comment.profiles?.avatar_url || ""} />
                  <AvatarFallback className="text-[8px]">
                    {comment.profiles?.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </Link>
              {editingCommentId === comment.id ? (
                <div className="flex-1 flex gap-1">
                  <Input
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="h-6 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveEdit();
                      } else if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="text-primary hover:text-primary/80 p-0.5"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{comment.profiles?.username}</span>
                    <span className="text-muted-foreground ml-1">{comment.content}</span>
                  </div>
                  {user?.id === comment.user_id && (
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => handleStartEdit(comment)}
                        className="text-muted-foreground hover:text-primary p-0.5"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PinDetails = () => {
  const { pinId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Fetch pin data
  const { data: pin, isLoading: pinLoading } = useQuery({
    queryKey: ["pin-details", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("*, routes!inner(id, title, user_id, profiles:user_id(username, avatar_url))")
        .eq("id", pinId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!pinId,
  });

  // Fetch all pins from the same route for navigation
  const { data: routePins = [] } = useQuery({
    queryKey: ["route-pins", pin?.routes?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("id, pin_order, place_name, address")
        .eq("route_id", pin?.routes?.id)
        .order("pin_order", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!pin?.routes?.id,
  });

  // Fetch pin visits/ratings
  const { data: visits = [] } = useQuery({
    queryKey: ["pin-visits-details", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pin_visits")
        .select("*, profiles:user_id(id, username, avatar_url)")
        .eq("pin_id", pinId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!pinId,
  });

  // Fetch visit likes
  const { data: visitLikes = [] } = useQuery({
    queryKey: ["visit-likes", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_likes")
        .select("*")
        .eq("visit_pin_id", pinId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!pinId,
  });

  // Fetch visit comments
  const { data: visitComments = [] } = useQuery({
    queryKey: ["visit-comments", pinId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from("visit_comments")
        .select("*")
        .eq("visit_pin_id", pinId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!commentsData || commentsData.length === 0) return [];

      // Fetch profiles for comment authors
      const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      return commentsData.map((c: any) => ({
        ...c,
        profiles: profilesMap.get(c.user_id) || null,
      }));
    },
    enabled: !!pinId,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({ visitPinId, visitUserId }: { visitPinId: string; visitUserId: string }) => {
      const isLiked = visitLikes.some(
        (l: any) => l.visit_pin_id === visitPinId && l.visit_user_id === visitUserId && l.user_id === user?.id
      );

      if (isLiked) {
        await supabase
          .from("visit_likes")
          .delete()
          .eq("visit_pin_id", visitPinId)
          .eq("visit_user_id", visitUserId)
          .eq("user_id", user?.id);
      } else {
        await supabase.from("visit_likes").insert({
          visit_pin_id: visitPinId,
          visit_user_id: visitUserId,
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-likes", pinId] });
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: async ({ visitPinId, visitUserId, content }: { visitPinId: string; visitUserId: string; content: string }) => {
      const { error } = await supabase.from("visit_comments").insert({
        visit_pin_id: visitPinId,
        visit_user_id: visitUserId,
        user_id: user?.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-comments", pinId] });
      toast.success("Dodano komentarz");
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("visit_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-comments", pinId] });
      toast.success("Usunięto komentarz");
    },
  });

  // Edit comment mutation
  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { error } = await supabase
        .from("visit_comments")
        .update({ content: content.trim() })
        .eq("id", commentId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-comments", pinId] });
      toast.success("Zaktualizowano komentarz");
    },
  });

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Find current pin index and prev/next pins
  const currentPinIndex = routePins.findIndex((p: any) => p.id === pinId);
  const prevPin = currentPinIndex > 0 ? routePins[currentPinIndex - 1] : null;
  const nextPin = currentPinIndex < routePins.length - 1 ? routePins[currentPinIndex + 1] : null;

  // Swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && nextPin) {
      navigate(`/pin/${nextPin.id}`);
    } else if (isRightSwipe && prevPin) {
      navigate(`/pin/${prevPin.id}`);
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  }, [nextPin, prevPin, navigate]);

  // Check if current user has already rated
  const currentUserVisit = visits.find((v: any) => v.user_id === user?.id);
  const hasVisited = !!currentUserVisit;

  if (pinLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!pin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Pin nie został znaleziony</p>
          <button onClick={() => navigate(-1)} className="text-primary mt-2">
            Wróć
          </button>
        </div>
      </div>
    );
  }

  const displayName = pin.place_name && pin.place_name !== pin.address ? pin.place_name : null;
  const visitorsWithRating = visits.filter((v: any) => v.rating && v.rating > 0);
  const averageRating = visitorsWithRating.length > 0
    ? visitorsWithRating.reduce((sum: number, v: any) => sum + v.rating, 0) / visitorsWithRating.length
    : 0;

  // Collect all images for lightbox
  const allImages: string[] = [];
  if (pin.image_url) allImages.push(pin.image_url);
  if (pin.images?.length) allImages.push(...pin.images.filter((img: string) => img));
  visits.forEach((v: any) => {
    if (v.image_url) allImages.push(v.image_url);
  });

  return (
    <div 
      className="min-h-screen bg-background pb-20"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(`/route/${pin.routes.id}`)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <Link
              to={`/route/${pin.routes.id}`}
              className="text-xs text-muted-foreground hover:text-primary truncate block"
            >
              Z trasy: {pin.routes.title}
            </Link>
          </div>
        </div>
      </div>

      {/* Pin Navigation */}
      {routePins.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            disabled={!prevPin}
            onClick={() => prevPin && navigate(`/pin/${prevPin.id}`)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Poprzedni</span>
          </Button>
          
          <span className="text-xs text-muted-foreground">
            Pin {currentPinIndex + 1} z {routePins.length}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            disabled={!nextPin}
            onClick={() => nextPin && navigate(`/pin/${nextPin.id}`)}
            className="gap-1"
          >
            <span className="hidden sm:inline">Następny</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Pin Image */}
        {pin.image_url ? (
          <div
            className="relative aspect-video rounded-lg overflow-hidden cursor-pointer"
            onClick={() => openLightbox(allImages, 0)}
          >
            <img
              src={pin.image_url}
              alt={displayName || pin.address}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-muted via-muted/80 to-muted/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="p-4 rounded-full bg-background/60 backdrop-blur-sm">
                <MapPin className="h-10 w-10 text-muted-foreground" />
              </div>
            </div>
          </div>
        )}

        {/* Pin Name & Address - right below image */}
        <div className="space-y-1">
          <h1 className="font-semibold text-lg">{displayName || pin.address}</h1>
          {displayName && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{pin.address}</span>
            </div>
          )}
          {pin.created_at && (
            <p className="text-xs text-muted-foreground">
              Dodano: {format(new Date(pin.created_at), "d MMM yyyy", { locale: pl })}
            </p>
          )}
        </div>

        {/* Pin Info */}
        <div className="space-y-3">

          {/* Author's Rating */}
          {pin.rating && pin.rating > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ocena autora:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${star <= pin.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Average User Rating */}
          {averageRating > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Średnia ocena użytkowników:</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{averageRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">
                  ({visitorsWithRating.length} {visitorsWithRating.length === 1 ? 'ocena' : visitorsWithRating.length < 5 ? 'oceny' : 'ocen'})
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          {pin.description && (
            <p className="text-sm leading-relaxed">{pin.description}</p>
          )}

          {/* Tags */}
          {pin.tags && pin.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pin.tags.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Rate Button - only show if user hasn't rated yet */}
        {user && !hasVisited && (
          <div className="flex justify-center">
            <Button
              onClick={() => setShowVisitDialog(true)}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Star className="h-4 w-4 mr-2" />
              Dodaj coś od siebie
            </Button>
          </div>
        )}

        <Separator />

        {/* User Ratings Section */}
        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Oceny użytkowników ({visits.length})
          </h2>

          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak ocen od użytkowników. Bądź pierwszy!
            </p>
          ) : (
            <div className="space-y-3">
              {visits.map((visit: any) => {
                const visitLikesCount = visitLikes.filter(
                  (l: any) => l.visit_pin_id === pinId && l.visit_user_id === visit.user_id
                ).length;
                const isLiked = visitLikes.some(
                  (l: any) => l.visit_pin_id === pinId && l.visit_user_id === visit.user_id && l.user_id === user?.id
                );
                const comments = visitComments.filter(
                  (c: any) => c.visit_user_id === visit.user_id
                );

                const isOwnVisit = user?.id === visit.user_id;

                return (
                  <VisitCard
                    key={visit.user_id}
                    visit={visit}
                    pinId={pinId || ""}
                    allImages={allImages}
                    openLightbox={openLightbox}
                    likesCount={visitLikesCount}
                    isLiked={isLiked}
                    comments={comments}
                    user={user}
                    onLike={() => likeMutation.mutate({ visitPinId: pinId || "", visitUserId: visit.user_id })}
                    onComment={(content) => commentMutation.mutate({ visitPinId: pinId || "", visitUserId: visit.user_id, content })}
                    onDeleteComment={(commentId) => deleteCommentMutation.mutate(commentId)}
                    onEditComment={(commentId, content) => editCommentMutation.mutate({ commentId, content })}
                    isOwnVisit={isOwnVisit}
                    onEditVisit={() => setShowVisitDialog(true)}
                    onDeleteVisit={() => setShowDeleteDialog(true)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      {/* Visit Dialog */}
      {user && (
        <PinVisitDialog
          open={showVisitDialog}
          onOpenChange={setShowVisitDialog}
          pinId={pinId || ""}
          pinName={displayName || pin.address}
          userId={user.id}
          existingVisit={hasVisited ? {
            image_url: currentUserVisit.image_url,
            description: currentUserVisit.description,
            rating: currentUserVisit.rating,
          } : null}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń ocenę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć swoją ocenę? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await supabase
                  .from("pin_visits")
                  .delete()
                  .eq("pin_id", pinId)
                  .eq("user_id", user?.id);
                queryClient.invalidateQueries({ queryKey: ["pin-visits-details", pinId] });
                toast.success("Usunięto ocenę");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default PinDetails;
