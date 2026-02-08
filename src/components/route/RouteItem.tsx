import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, Star, Eye } from "lucide-react";
import PinReviewBadges from "@/components/route/PinReviewBadges";

interface RouteItemProps {
  route: any;
  onDelete: (routeId: string) => void;
}

const RouteItem = ({ route, onDelete }: RouteItemProps) => {
  const navigate = useNavigate();
  const [pinsExpanded, setPinsExpanded] = useState(false);
  const MAX_VISIBLE_PINS = 4;

  const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];

  const attractionPins = sortedPins.filter((pin: any) => !pin.is_transport && pin.rating !== null);
  const avgRating =
    attractionPins.length > 0
      ? attractionPins.reduce((acc: number, pin: any) => acc + pin.rating, 0) / attractionPins.length
      : 0;

  const displayPins = pinsExpanded ? sortedPins : sortedPins.slice(0, MAX_VISIBLE_PINS);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all duration-300">
      <div
        className="p-4 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate(`/route/${route.id}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-bold leading-tight flex-1">{route.title}</h3>
          <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
            <Star className="h-4 w-4 fill-star text-star" />
            <span className="font-bold text-sm">{Math.round(avgRating * 10) / 10}</span>
          </div>
        </div>
        {route.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-2">{route.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {sortedPins.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>{sortedPins.length} {sortedPins.length === 1 ? 'przystanek' : 'przystanki'}</span>
            </div>
          )}
        </div>
      </div>

      {sortedPins.length > 0 && (
        <div className="divide-y divide-border/50">
          {displayPins.map((pin: any, index: number) => (
            <div key={pin.id}>
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/route/${route.id}`)}
              >
                <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <span className="text-sm font-medium flex-1 truncate">{pin.place_name || pin.address}</span>
                {pin.rating > 0 && (
                  <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded">
                    <Star className="h-3 w-3 fill-star text-star" />
                    <span className="text-xs font-semibold">{pin.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="px-3 pb-2">
                <PinReviewBadges pin={pin} />
              </div>
            </div>
          ))}
          {sortedPins.length > MAX_VISIBLE_PINS && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPinsExpanded(!pinsExpanded);
              }}
              className="w-full p-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {pinsExpanded ? "Zwiń" : `Pokaż +${sortedPins.length - MAX_VISIBLE_PINS} więcej`}
            </button>
          )}
        </div>
      )}

      <div className="p-3 bg-muted/20 border-t border-border/50">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => navigate(`/route/${route.id}`)}>
            <Eye className="h-4 w-4 mr-2" />
            Zobacz
          </Button>
          <Button variant="default" className="flex-1" onClick={() => navigate(`/edit/${route.id}`)}>
            Edytuj
          </Button>
          <Button variant="outline" size="icon" onClick={() => onDelete(route.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RouteItem;
