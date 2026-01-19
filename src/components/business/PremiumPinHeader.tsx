import { Star, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BusinessData } from "./mockBusinessData";

interface PremiumPinHeaderProps {
  business: BusinessData;
  address: string;
}

const PremiumPinHeader = ({ business, address }: PremiumPinHeaderProps) => {
  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={business.cover_image_url}
          alt={business.business_name}
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Badges on cover */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <Badge className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold border-0 shadow-lg">
            ⭐ PREMIUM
          </Badge>
          {business.is_verified && (
            <Badge variant="secondary" className="bg-green-500/90 text-white border-0 gap-1 shadow-lg">
              <BadgeCheck className="h-3 w-3" />
              Zweryfikowano
            </Badge>
          )}
        </div>
      </div>

      {/* Business info below cover */}
      <div className="pt-4 px-4 pb-4 space-y-2">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{business.business_name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.floor(business.rating)
                      ? "fill-[hsl(var(--star))] text-[hsl(var(--star))]"
                      : star - 0.5 <= business.rating
                      ? "fill-[hsl(var(--star))]/50 text-[hsl(var(--star))]"
                      : "text-[hsl(var(--star-empty))]"
                  }`}
                />
              ))}
              <span className="font-semibold ml-1">{business.rating}</span>
            </div>
            <span className="text-muted-foreground text-sm">
              ({business.reviews_count} opinii)
            </span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="secondary" className="text-xs">
              {business.business_category}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground flex items-start gap-1.5">
          <span className="shrink-0">📍</span>
          {business.full_address || address}
        </p>
      </div>
    </div>
  );
};

export default PremiumPinHeader;
