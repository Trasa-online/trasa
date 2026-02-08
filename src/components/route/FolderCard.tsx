import { useNavigate } from "react-router-dom";
import { Star, MapPin, FolderOpen, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RouteFolder } from "@/hooks/useFolders";

interface FolderCardProps {
  folder: RouteFolder;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  showActions?: boolean;
}

const FolderCard = ({ folder, onDelete, onEdit, showActions = true }: FolderCardProps) => {
  const navigate = useNavigate();
  
  const routes = folder.routes || [];
  const publishedRoutes = routes.filter((r: any) => r.status === "published");
  const sortedRoutes = routes.slice().sort((a: any, b: any) => (a.folder_order || 0) - (b.folder_order || 0));
  
  const totalPins = routes.reduce((acc: number, r: any) => acc + (r.pins?.length || 0), 0);
  
  // Average rating from all attraction pins across all routes
  const allRatings = routes.flatMap((r: any) => 
    (r.pins || [])
      .filter((p: any) => !p.is_transport && p.rating > 0)
      .map((p: any) => p.rating)
  );
  const avgRating = allRatings.length > 0 
    ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length 
    : 0;

  const MAX_DAY_CHIPS = 5;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all duration-300">
      {/* Cover image */}
      {folder.cover_image_url && (
        <div 
          className="h-32 bg-muted cursor-pointer"
          onClick={() => navigate(`/folder/${folder.id}`)}
        >
          <img 
            src={folder.cover_image_url} 
            alt={folder.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate(`/folder/${folder.id}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderOpen className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="text-base font-bold leading-tight truncate">
              {folder.name}
            </h3>
          </div>
          {avgRating > 0 && (
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
              <Star className="h-4 w-4 fill-star text-star" />
              <span className="font-bold text-sm">{(Math.round(avgRating * 10) / 10).toFixed(1)}</span>
            </div>
          )}
        </div>

        {folder.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
            {folder.description}
          </p>
        )}

        {/* Day chips */}
        {sortedRoutes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sortedRoutes.slice(0, MAX_DAY_CHIPS).map((route: any, idx: number) => (
              <span 
                key={route.id}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  route.status === 'published' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                Dzień {idx + 1}
              </span>
            ))}
            {sortedRoutes.length > MAX_DAY_CHIPS && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                +{sortedRoutes.length - MAX_DAY_CHIPS}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{routes.length} {routes.length === 1 ? 'trasa' : 'tras'}</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>{totalPins} {totalPins === 1 ? 'pinezka' : 'pinezek'}</span>
          </div>
          {publishedRoutes.length > 0 && publishedRoutes.length < routes.length && (
            <>
              <span>·</span>
              <span>{publishedRoutes.length} opubl.</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-3 bg-muted/20 border-t border-border/50">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/folder/${folder.id}`)}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Otwórz
            </Button>
            {onEdit && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onEdit(folder.id)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onDelete(folder.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderCard;
