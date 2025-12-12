import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Bookmark } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompactRouteCardProps {
  route: any;
}

const CompactRouteCard = ({ route }: CompactRouteCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Sort pins by pin_order for consistent display
  const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
  
  // Use the rating stored in the database
  const averageRating = route.rating || 0;

  // Get first pin image as thumbnail
  const thumbnailImage = sortedPins.find((pin: any) => pin.image_url)?.image_url;

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
        const { error } = await supabase
          .from("saved_routes")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_routes")
          .insert({ route_id: route.id, user_id: user.id });
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
      className="flex gap-3 p-3 bg-card border border-border rounded-xl hover:border-foreground/20 transition-all duration-200 cursor-pointer group"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 relative">
        {thumbnailImage ? (
          <img
            src={thumbnailImage}
            alt={route.title}
            className="w-20 h-20 object-cover rounded-lg ring-1 ring-border"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-muted via-muted/80 to-muted/50 ring-1 ring-border/50 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
        {/* Pin count badge */}
        <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-bold">{sortedPins.length}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 group-hover:text-foreground/80 transition-colors">
              {route.title}
            </h3>
            <button
              onClick={handleSave}
              disabled={saveRouteMutation.isPending}
              className="p-1 hover:bg-accent rounded transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Bookmark className={`h-4 w-4 transition-all ${isSaved ? "fill-foreground" : ""}`} />
            </button>
          </div>
          
          {route.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {route.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 ring-1 ring-border">
              <AvatarImage src={route.profiles?.avatar_url} />
              <AvatarFallback className="text-[8px]">
                {route.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
              {route.profiles?.username}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {averageRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-star text-star" />
                <span className="text-xs font-semibold">{averageRating.toFixed(1)}</span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(route.created_at), "dd MMM")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactRouteCard;
