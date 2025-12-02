import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Star, MapPin, Eye, Bookmark, ArrowRight, UtensilsCrossed, Coffee, ShoppingBag, Gift, Mountain, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RouteCardProps {
  route: any;
}

const RouteCard = ({ route }: RouteCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Sort pins by pin_order for consistent display
  const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
  
  // Use the rating stored in the database (calculated from attraction pins only)
  const averageRating = route.rating || 0;

  // Check if route is saved by current user
  const { data: isSaved = false } = useQuery({
    queryKey: ["is-saved", route.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("saved_routes")
        .select("*")
        .eq("route_id", route.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  // Save/unsave route mutation
  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from("saved_routes")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Save
        const { error } = await supabase
          .from("saved_routes")
          .insert({
            route_id: route.id,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-saved", route.id] });
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
      toast.success(isSaved ? "Usunięto z zapisanych" : "Zapisano trasę");
    },
    onError: () => {
      toast.error("Nie udało się zapisać trasy");
    },
  });

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Musisz być zalogowany");
      return;
    }
    saveRouteMutation.mutate();
  };

  const handleCardClick = () => {
    navigate(`/route/${route.id}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all duration-300 cursor-pointer group hover:shadow-lg"
    >
      {/* Header Section */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={route.profiles?.avatar_url} />
              <AvatarFallback className="text-xs">
                {route.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{route.profiles?.username}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(route.created_at), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saveRouteMutation.isPending}
            className="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          >
            <Bookmark className={`h-5 w-5 transition-all ${isSaved ? "fill-foreground" : ""}`} />
          </button>
        </div>

        {/* Title and Rating */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight flex-1 group-hover:text-foreground/90 transition-colors">
              {route.title}
            </h3>
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
              <Star className="h-4 w-4 fill-star text-star" />
              <span className="font-bold text-sm">{Math.round(averageRating * 10) / 10}</span>
            </div>
          </div>
          
          {route.description && (
            <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
              {route.description}
            </p>
          )}

          {/* Tags Section */}
          {(() => {
            const allTags = sortedPins.flatMap((pin: any) => pin.tags || []);
            const uniqueTags = Array.from(new Set(allTags));
            
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

            return uniqueTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/30">
                {uniqueTags.map((tag: string, idx: number) => {
                  const TagIcon = getTagIcon(tag);
                  return (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/search?tag=${encodeURIComponent(tag)}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    >
                      {TagIcon && <TagIcon className="h-3.5 w-3.5" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            ) : null;
          })()}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
            {sortedPins.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{sortedPins.length} {sortedPins.length === 1 ? 'przystanek' : 'przystanki'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pins Section */}
      {sortedPins.length > 0 && (
        <div className="divide-y divide-border/50">
          {sortedPins.slice(0, 3).map((pin: any, index: number) => (
            <div 
              key={pin.id} 
              className="p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex gap-3">
                {pin.image_url && (
                  <div className="flex-shrink-0 relative group/img">
                    <img
                      src={pin.image_url}
                      alt={pin.place_name}
                      className="w-20 h-20 object-cover rounded-lg ring-1 ring-border"
                    />
                    <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center ring-1 ring-border">
                      <span className="text-xs font-bold">{index + 1}</span>
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {!pin.image_url && (
                        <div className="bg-muted rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                          <span className="text-xs font-bold">{index + 1}</span>
                        </div>
                      )}
                      <h4 className="font-semibold text-sm leading-tight">{pin.place_name}</h4>
                    </div>
                    {pin.rating && (
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded flex-shrink-0">
                        <Star className="h-3 w-3 fill-star text-star" />
                        <span className="font-semibold text-xs">{pin.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                  {pin.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {pin.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Section */}
      <div className="p-3 bg-muted/20 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group/btn"
            >
              <Heart className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
              <span className="text-sm font-medium">{route.likes?.length || 0}</span>
            </button>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group/btn"
            >
              <MessageCircle className="h-4 w-4 group-hover/btn:scale-110 transition-transform" />
              <span className="text-sm font-medium">{route.comments?.length || 0}</span>
            </button>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">{route.views}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            <span>Zobacz trasę</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteCard;
