import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Star, MessageSquare, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { PinVisitDialog } from "@/components/route/PinVisitDialog";

const PinDetails = () => {
  const { pinId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showVisitDialog, setShowVisitDialog] = useState(false);

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

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Find current pin index and prev/next pins
  const currentPinIndex = routePins.findIndex((p: any) => p.id === pinId);
  const prevPin = currentPinIndex > 0 ? routePins[currentPinIndex - 1] : null;
  const nextPin = currentPinIndex < routePins.length - 1 ? routePins[currentPinIndex + 1] : null;

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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(`/route/${pin.routes.id}`)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentPinIndex + 1}/{routePins.length}
              </span>
              <h1 className="font-semibold truncate">
                {displayName || pin.address}
              </h1>
            </div>
            <Link
              to={`/route/${pin.routes.id}`}
              className="text-xs text-muted-foreground hover:text-primary truncate block"
            >
              z trasy: {pin.routes.title}
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

      <div className="p-4 space-y-6">
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

        {/* Pin Info */}
        <div className="space-y-3">
          {displayName && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">{pin.address}</span>
            </div>
          )}

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

        {/* Rate Button */}
        {user && (
          <div className="flex justify-center">
            <Button
              onClick={() => setShowVisitDialog(true)}
              variant={hasVisited ? "outline" : "default"}
              className={hasVisited ? "border-border" : "bg-foreground text-background hover:bg-foreground/90"}
            >
              {hasVisited ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Edytuj ocenę
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Dodaj coś od siebie
                </>
              )}
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
            <div className="space-y-4">
              {visits.map((visit: any) => (
                <div key={visit.user_id} className="bg-muted/30 rounded-lg p-4 space-y-3">
                  {/* User Header */}
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${visit.profiles?.id}`}>
                      <Avatar className="h-10 w-10 ring-2 ring-background">
                        <AvatarImage src={visit.profiles?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10">
                          {visit.profiles?.username?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/profile/${visit.profiles?.id}`}
                        className="font-medium text-sm hover:text-primary truncate block"
                      >
                        {visit.profiles?.username || "Nieznany użytkownik"}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(visit.created_at).toLocaleDateString("pl-PL", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Rating */}
                    {visit.rating && visit.rating > 0 && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= visit.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visit Photo */}
                  {visit.image_url && (
                    <div
                      className="relative aspect-video rounded-lg overflow-hidden cursor-pointer"
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
                  )}

                  {/* Visit Description */}
                  {visit.description && (
                    <p className="text-sm leading-relaxed">{visit.description}</p>
                  )}
                </div>
              ))}
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
    </div>
  );
};

export default PinDetails;
