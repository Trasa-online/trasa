import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showLabel?: boolean;
  showValue?: boolean;
  showReset?: boolean;
  className?: string;
}

const StarRating = ({
  rating,
  maxRating = 5,
  size = "sm",
  interactive = false,
  onRatingChange,
  showLabel = false,
  showValue = false,
  showReset = false,
  className,
}: StarRatingProps) => {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-7 w-7",
  };

  const handleStarClick = (starValue: number) => {
    if (!interactive) return;
    
    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    onRatingChange?.(starValue);
  };

  const handleReset = () => {
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }
    onRatingChange?.(0);
  };

  const displayRating = hoveredStar !== null ? hoveredStar : rating;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {showLabel && interactive && (
        <div className="text-center mb-2">
          <Label className="text-sm font-medium">Twoja ocena</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dotknij gwiazdki aby ocenić
          </p>
        </div>
      )}
      
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: maxRating }).map((_, index) => {
            const starValue = index + 1;
            const isFilled = starValue <= displayRating;

            return (
              <button
                key={index}
                type="button"
                disabled={!interactive}
                onClick={() => handleStarClick(starValue)}
                onMouseEnter={() => interactive && setHoveredStar(starValue)}
                onMouseLeave={() => interactive && setHoveredStar(null)}
                onTouchStart={() => interactive && setIsPressed(true)}
                onTouchEnd={() => interactive && setIsPressed(false)}
                className={cn(
                  "transition-all duration-150 ease-in-out",
                  interactive && "cursor-pointer",
                  interactive && "hover:scale-110 active:scale-95",
                  interactive && isPressed && "scale-95",
                  !interactive && "cursor-default"
                )}
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "transition-colors duration-150",
                    isFilled 
                      ? "fill-star text-star" 
                      : "fill-star-empty text-star-empty",
                    interactive && hoveredStar !== null && starValue <= hoveredStar && "fill-star text-star"
                  )}
                />
              </button>
            );
          })}
        </div>
        
        {showReset && interactive && rating > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-6 px-2 ml-2 text-muted-foreground hover:text-destructive"
          >
            Usuń
          </Button>
        )}
      </div>
      
      {showValue && rating > 0 && (
        <p className="text-sm text-center mt-2 animate-fade-in">
          Wybrano: <span className="font-semibold">{rating}/{maxRating} ⭐</span>
        </p>
      )}
    </div>
  );
};

export default StarRating;
