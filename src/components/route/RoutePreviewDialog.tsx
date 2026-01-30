import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Bookmark, MapPin, Star } from "lucide-react";
import { format } from "date-fns";
import { getPinImagesForRoute } from "@/lib/pinPlaceholders";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Pin {
  id?: string;
  place_name: string;
  address: string;
  description: string;
  image_url: string;
  images: string[];
  rating: number;
  pin_order: number;
  tags: string[];
  latitude?: number;
  longitude?: number;
}

interface RoutePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pins: Pin[];
  username?: string;
  avatarUrl?: string;
}

const RoutePreviewDialog = ({
  open,
  onOpenChange,
  title,
  description,
  pins,
  username = "Ty",
  avatarUrl,
}: RoutePreviewDialogProps) => {
  const validPins = pins.filter(p => p.address);
  const sortedPins = validPins.slice().sort((a, b) => a.pin_order - b.pin_order);
  const pinImages = getPinImagesForRoute(sortedPins);
  
  // Calculate average rating from pins with ratings > 0
  const ratedPins = validPins.filter(p => p.rating > 0);
  const averageRating = ratedPins.length > 0
    ? ratedPins.reduce((sum, p) => sum + p.rating, 0) / ratedPins.length
    : 0;

  // Collect unique tags from all pins
  const allTags = [...new Set(validPins.flatMap(p => p.tags || []))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="text-base">Podgląd trasy w feedzie</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(85vh-60px)]">
          <div className="p-4 space-y-4">
            {/* Route Card Preview */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              {/* Header */}
              <div className="p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>{username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{username}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(), "d MMM yyyy")}
                  </p>
                </div>
              </div>

              {/* Image Grid */}
              {sortedPins.length > 0 && (
                <div className="relative">
                  <div className={`grid gap-0.5 ${
                    sortedPins.length === 1 ? 'grid-cols-1' :
                    sortedPins.length === 2 ? 'grid-cols-2' :
                    sortedPins.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                  }`}>
                    {sortedPins.slice(0, 4).map((pin, idx) => (
                      <div
                        key={idx}
                        className={`relative aspect-square overflow-hidden ${
                          sortedPins.length === 3 && idx === 0 ? 'col-span-2 row-span-2 aspect-square' : ''
                        }`}
                      >
                        <img
                          src={pinImages[idx] || '/placeholder.svg'}
                          alt={pin.place_name}
                          className="w-full h-full object-cover"
                        />
                        {sortedPins.length > 4 && idx === 3 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              +{sortedPins.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Pin count badge */}
                  <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    <span>{sortedPins.length} {sortedPins.length === 1 ? 'punkt' : 'punktów'}</span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base line-clamp-2">
                    {title || "Bez nazwy"}
                  </h3>
                  {averageRating > 0 && (
                    <div className="flex items-center gap-1 text-sm flex-shrink-0">
                      <Star className="h-4 w-4 fill-star text-star" />
                      <span className="font-medium">{averageRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                
                {description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {description}
                  </p>
                )}

                {/* Tags */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allTags.slice(0, 4).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {allTags.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{allTags.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Heart className="h-5 w-5" />
                  <span className="text-xs">0</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs">0</span>
                </div>
                <div className="ml-auto">
                  <Bookmark className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              Tak będzie wyglądać Twoja trasa w feedzie po opublikowaniu
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RoutePreviewDialog;
