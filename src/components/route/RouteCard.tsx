import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import StarRating from "./StarRating";
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
    <div
      onClick={() => navigate(`/route/${route.id}`)}
      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={route.profiles?.avatar_url} />
            <AvatarFallback>
              {route.profiles?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{route.profiles?.username}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(route.created_at), "MMM dd, yyyy")}
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-accent rounded-lg">
          <Bookmark className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{route.title}</h3>
          <StarRating rating={Math.round(averageRating * 10) / 10} />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {route.description}
        </p>
      </div>

      {route.pins?.length > 0 && (
        <div className="mt-4 space-y-3">
          {route.pins.slice(0, 3).map((pin: any, index: number) => (
            <div key={pin.id} className="flex gap-3">
              <div className="flex-shrink-0 relative">
                <img
                  src={pin.image_url || '/placeholder.svg'}
                  alt={pin.place_name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-background/90 rounded-full w-6 h-6 flex items-center justify-center">
                  <span className="text-xs font-semibold">{index + 1}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{pin.place_name}</h4>
                  {pin.rating && <StarRating rating={pin.rating} />}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{pin.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Heart className="h-5 w-5" />
          <span className="text-sm">24</span>
        </button>
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm">1</span>
        </button>
      </div>
    </div>
  );
};

export default RouteCard;
