import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Star, MapPin, Eye } from "lucide-react";
import { format } from "date-fns";

interface RouteCardProps {
  route: any;
}

const RouteCard = ({ route }: RouteCardProps) => {
  const navigate = useNavigate();
  const averageRating =
    route.pins?.length > 0
      ? route.pins.reduce((acc: number, pin: any) => acc + (pin.rating || 0), 0) /
        route.pins.length
      : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={route.profiles?.avatar_url} />
            <AvatarFallback>
              {route.profiles?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{route.profiles?.username}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(route.created_at), "MMM dd, yyyy")}
            </p>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/route/${route.id}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <Eye className="h-4 w-4" />
          <span className="text-sm">View</span>
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{route.title}</h3>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-star text-star" />
            <span className="font-medium text-sm">{Math.round(averageRating * 10) / 10}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {route.description}
        </p>
        {route.pins?.length > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <MapPin className="h-3.5 w-3.5" />
            <MapPin className="h-3.5 w-3.5" />
            <span className="text-xs ml-1">{route.pins.length} stops</span>
          </div>
        )}
      </div>

      {route.pins?.length > 0 && (
        <div className="space-y-2.5">
          {route.pins.slice(0, 3).map((pin: any, index: number) => (
            <div key={pin.id} className="flex gap-3 bg-muted/30 rounded-lg p-2.5">
              <div className="flex-shrink-0 relative">
                <img
                  src={pin.image_url || '/placeholder.svg'}
                  alt={pin.place_name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="absolute top-1.5 left-1.5 bg-background/90 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-xs font-normal">{index + 1}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <h4 className="font-semibold text-sm leading-tight">{pin.place_name}</h4>
                  {pin.rating && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 fill-star text-star" />
                      <span className="font-medium text-xs">{pin.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{pin.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-4">
        <button 
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Heart className="h-4 w-4" />
          <span className="text-sm">{route.likes?.length || 0}</span>
        </button>
        <button 
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{route.comments?.length || 0}</span>
        </button>
      </div>
    </div>
  );
};

export default RouteCard;
