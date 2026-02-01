import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Star, MessageSquare, ChevronLeft, ChevronRight, Eye, Heart, Send, Trash2, Pencil, X, Check, Trophy, Users, Route } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useCallback, useMemo } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { PinVisitDialog } from "@/components/route/PinVisitDialog";
import { toast } from "sonner";
import { getPinImage } from "@/lib/pinPlaceholders";
import RouteMap from "@/components/RouteMap";
import PremiumPinView from "@/components/business/PremiumPinView";
import { MOCK_BUSINESS_DATA, MOCK_PREMIUM_PIN_ID } from "@/components/business/mockBusinessData";
import { cn } from "@/lib/utils";
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

  // Fetch pin data with original creator
  const { data: pin, isLoading: pinLoading } = useQuery({
    queryKey: ["pin-details", pinId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("*, routes!inner(id, title, user_id, profiles:user_id(id, username, avatar_url)), original_creator:original_creator_id(id, username, avatar_url)")
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

  // Get canonical pin data if it exists
  const { data: canonicalPin, isLoading: canonicalPinLoading } = useQuery({
    queryKey: ["canonical-pin", pin?.canonical_pin_id],
    queryFn: async () => {
      if (!pin?.canonical_pin_id) return null;
      
      const { data, error } = await supabase
        .from("canonical_pins")
        .select(`
          *,
          discovered_by:discovered_by_user_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq("id", pin.canonical_pin_id)
        .single();

      if (error) {
        console.error('Error fetching canonical pin:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!pin?.canonical_pin_id
  });

  // Get all visits to this canonical pin (for aggregated stats)
  const { data: allCanonicalVisits = [], isLoading: canonicalVisitsLoading } = useQuery({
    queryKey: ["pin-all-visits", pin?.canonical_pin_id],
    queryFn: async () => {
      if (!pin?.canonical_pin_id) return [];
      
      const { data, error } = await supabase
        .from("pins")
        .select(`
          *,
          routes!inner (
            id,
            title,
            user_id,
            profiles:user_id (
              id,
              username,
              avatar_url
            )
          )
        `)
        .eq("canonical_pin_id", pin.canonical_pin_id)
        .order("visited_at", { ascending: false });

      if (error) {
        console.error('Error fetching canonical visits:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!pin?.canonical_pin_id
  });

  // Calculate statistics from all canonical visits
  const canonicalStats = useMemo(() => {
    if (!allCanonicalVisits || allCanonicalVisits.length === 0) {
      return {
        totalVisits: 0,
        averageRating: 0,
        ratingsCount: 0,
        uniqueRoutes: 0
      };
    }
    
    const validRatings = allCanonicalVisits.filter((v: any) => v.rating && v.rating > 0);
    const uniqueRouteIds = new Set(allCanonicalVisits.map((v: any) => v.routes.id));
    
    return {
      totalVisits: allCanonicalVisits.length,
      averageRating: validRatings.length > 0 
        ? validRatings.reduce((acc: number, v: any) => acc + v.rating, 0) / validRatings.length 
        : 0,
      ratingsCount: validRatings.length,
      uniqueRoutes: uniqueRouteIds.size
    };
  }, [allCanonicalVisits]);

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

  // Fetch pins from same location (other users who added this place)
  // Using ~150m radius (0.0015 degrees) for better matching
  const { data: sameLocationPins = [] } = useQuery({
    queryKey: ["same-location-pins", pin?.latitude, pin?.longitude, pinId],
    queryFn: async () => {
      if (!pin?.latitude || !pin?.longitude) return [];
      
      const lat = Number(pin.latitude);
      const lng = Number(pin.longitude);
      
      const { data, error } = await supabase
        .from("pins")
        .select(`
          id,
          place_name,
          rating,
          description,
          image_url,
          images,
          created_at,
          route_id,
          routes!inner(
            id, 
            title, 
            status, 
            user_id,
            profiles:user_id(id, username, avatar_url)
          )
        `)
        .gte("latitude", lat - 0.0015)
        .lte("latitude", lat + 0.0015)
        .gte("longitude", lng - 0.0015)
        .lte("longitude", lng + 0.0015)
        .eq("routes.status", "published")
        .neq("id", pinId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!pin?.latitude && !!pin?.longitude && !!pinId,
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

  // Check if this is a premium pin (mock for now)
  if (pinId === MOCK_PREMIUM_PIN_ID) {
    return (
      <PremiumPinView
        pin={{
          id: pin.id,
          address: pin.address,
          place_name: pin.place_name,
          latitude: pin.latitude,
          longitude: pin.longitude,
          pin_order: pin.pin_order,
          routes: {
            id: pin.routes.id,
            title: pin.routes.title
          }
        }}
        business={MOCK_BUSINESS_DATA}
      />
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
        <div
          className="relative aspect-video rounded-lg overflow-hidden cursor-pointer"
          onClick={() => pin.image_url && openLightbox(allImages, 0)}
        >
          <img
            src={getPinImage(pin)}
            alt={displayName || pin.address}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Pin Name & Address - right below image */}
        <div className="space-y-2">
          <h1 className="font-semibold text-lg">{displayName || pin.address}</h1>
          
          {displayName && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{pin.address}</span>
            </div>
          )}
          
          {/* Show discoverer badge if canonical pin exists */}
          {canonicalPin?.discovered_by && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground">
                Odkryte przez{" "}
                <Link to={`/profile/${canonicalPin.discovered_by.id}`} className="font-medium text-foreground hover:text-primary">
                  @{canonicalPin.discovered_by.username}
                </Link>
                {" "}· {format(new Date(canonicalPin.discovered_at), "d MMMM yyyy", { locale: pl })}
              </span>
            </div>
          )}
          
          {/* Show visit stats if there are multiple visits */}
          {canonicalStats.totalVisits > 1 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                {canonicalStats.totalVisits} {canonicalStats.totalVisits === 1 ? 'wizyta' : canonicalStats.totalVisits < 5 ? 'wizyty' : 'wizyt'}
              </div>
              {canonicalStats.uniqueRoutes > 1 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  W {canonicalStats.uniqueRoutes} trasach
                </div>
              )}
            </div>
          )}
          
          {pin.created_at && (
            <p className="text-xs text-muted-foreground">
              Dodano do tej trasy: {format(new Date(pin.created_at), "d MMM yyyy", { locale: pl })}
            </p>
          )}
        </div>

        {/* Pin Map Preview - below address, reduced size */}
        {pin.latitude && pin.longitude && (
          <RouteMap
            pins={[{ 
              latitude: pin.latitude, 
              longitude: pin.longitude, 
              place_name: displayName || pin.address,
              pin_order: pin.pin_order
            }]}
            className="h-[6.4rem]"
          />
        )}

        {/* Pin Info */}
        <div className="space-y-3">

          {/* Ratings Section */}
          <div className="space-y-3">
            {/* Aggregate rating from all canonical visits */}
            {canonicalStats.averageRating > 0 && (
              <div className="p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Średnia ocena użytkowników
                    <span className="text-xs ml-1">
                      ({canonicalStats.ratingsCount} {canonicalStats.ratingsCount === 1 ? 'ocena' : canonicalStats.ratingsCount < 5 ? 'oceny' : 'ocen'})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-lg font-semibold">{canonicalStats.averageRating.toFixed(1)}</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= Math.round(canonicalStats.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Original route author's rating */}
            {pin.rating && pin.rating > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ocena autora trasy:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= pin.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

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

        <Separator />

        {/* All Visits to This Location */}
        <div>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Odwiedzający
            {allCanonicalVisits.length > 0 && (
              <span className="text-muted-foreground font-normal text-sm">
                ({allCanonicalVisits.length})
              </span>
            )}
          </h2>

          {canonicalVisitsLoading ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Ładowanie wizyt...</span>
              </div>
            </div>
          ) : allCanonicalVisits.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Nikt jeszcze nie odwiedził tego miejsca
              </p>
              <p className="text-xs text-muted-foreground">
                Bądź pierwszą osobą, która doda to miejsce do swojej trasy!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allCanonicalVisits.map((visit: any) => {
                const routeProfile = visit.routes?.profiles;
                const route = visit.routes;
                const isCurrentUserVisit = visit.routes?.user_id === user?.id;
                
                return (
                  <div 
                    key={visit.id}
                    className={cn(
                      "p-3 rounded-xl border transition-colors",
                      isCurrentUserVisit 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-muted/40 border-border/50 hover:border-border"
                    )}
                  >
                    <div className="flex gap-3">
                      {/* Left: Photo or Avatar */}
                      {visit.image_url ? (
                        <div
                          className="shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ring-2 ring-background shadow-sm"
                          onClick={() => {
                            // Collect all visit images for lightbox
                            const visitImages = allCanonicalVisits
                              .filter((v: any) => v.image_url)
                              .map((v: any) => v.image_url);
                            const imageIndex = visitImages.indexOf(visit.image_url);
                            openLightbox(visitImages, Math.max(0, imageIndex));
                          }}
                        >
                          <img
                            src={visit.image_url}
                            alt={`Zdjęcie od ${routeProfile?.username}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <Link to={`/profile/${routeProfile?.id}`}>
                          <Avatar className="h-16 w-16 ring-2 ring-background shadow-sm">
                            <AvatarImage src={routeProfile?.avatar_url || ""} />
                            <AvatarFallback className="text-lg font-semibold">
                              {routeProfile?.username?.charAt(0).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      )}

                      {/* Right: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/profile/${routeProfile?.id}`}
                                className="font-semibold text-sm hover:text-primary line-clamp-1 transition-colors"
                              >
                                {routeProfile?.username || "Anonim"}
                              </Link>
                              {isCurrentUserVisit && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                  Ty
                                </span>
                              )}
                            </div>
                            <Link
                              to={`/route/${route?.id}`}
                              className="text-xs text-muted-foreground hover:text-primary line-clamp-1 block transition-colors"
                            >
                              Z trasy: {route?.title}
                            </Link>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(visit.visited_at || visit.created_at), "d MMMM yyyy", { locale: pl })}
                            </p>
                          </div>
                          
                          {/* Rating */}
                          {visit.rating && visit.rating > 0 && (
                            <div className="flex items-center gap-0.5 shrink-0 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                {visit.rating}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Description/Comment */}
                        {visit.description && (
                          <p className="text-xs text-foreground leading-relaxed mt-2 line-clamp-3">
                            {visit.description}
                          </p>
                        )}
                        
                        {/* Tags if any */}
                        {visit.tags && visit.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {visit.tags.slice(0, 3).map((tag: string, i: number) => (
                              <span 
                                key={i}
                                className="text-[10px] bg-secondary px-2 py-0.5 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
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

        {/* Routes Containing This Pin */}
        {allCanonicalVisits.length > 0 && (
          <>
            <Separator />
            
            <div>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Route className="h-5 w-5" />
                To miejsce w trasach
                <span className="text-muted-foreground font-normal text-sm">
                  ({canonicalStats.uniqueRoutes})
                </span>
              </h2>
              
              <div className="space-y-2">
                {/* Group visits by route and show unique routes */}
                {Array.from(
                  new Map(
                    allCanonicalVisits.map((visit: any) => [
                      visit.routes.id,
                      visit
                    ])
                  ).values()
                ).map((visit: any) => {
                  const route = visit.routes;
                  const routeProfile = visit.routes?.profiles;
                  const isCurrentRoute = route.id === pin.routes?.id;
                  
                  return (
                    <Link
                      key={route.id}
                      to={`/route/${route.id}`}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-muted/60",
                        isCurrentRoute
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/40 border-border/50 hover:border-border"
                      )}
                    >
                      {/* Route author avatar */}
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={routeProfile?.avatar_url || ""} />
                        <AvatarFallback className="text-sm font-medium">
                          {routeProfile?.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Route info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm line-clamp-1">
                            {route.title}
                          </span>
                          {isCurrentRoute && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
                              Aktualna trasa
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          by @{routeProfile?.username}
                        </span>
                      </div>
                      
                      {/* Arrow icon */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  );
                })}
              </div>
              
              {/* Summary text */}
              {canonicalStats.uniqueRoutes > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  To miejsce znajduje się w {canonicalStats.uniqueRoutes}{" "}
                  {canonicalStats.uniqueRoutes === 1 
                    ? 'trasie' 
                    : canonicalStats.uniqueRoutes < 5 
                      ? 'trasach' 
                      : 'trasach'
                  }
                </p>
              )}
            </div>
          </>
        )}

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
