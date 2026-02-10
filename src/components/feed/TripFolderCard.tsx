import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Heart, MessageCircle, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { getRelativeTime } from "@/lib/reviewHelpers";

interface TripFolderCardProps {
  folder: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    created_at: string;
    user_id: string;
  };
  routes: Array<{
    id: string;
    title: string;
    created_at: string;
    pins: Array<{
      id: string;
      place_name: string;
      address: string;
      image_url: string;
      images: string[];
      tags: string[];
      rating: number;
      pin_order: number;
      expectation_met: string | null;
      pros: string[];
      cons: string[];
      trip_role: string | null;
      one_liner: string;
      recommended_for: string[];
    }>;
    likes: Array<{ user_id: string }>;
    comments: Array<{ id: string }>;
  }>;
  author: {
    username: string;
    avatar_url: string | null;
  };
  currentUserId?: string;
}

function extractLocation(routes: TripFolderCardProps["routes"]): string | null {
  for (const route of routes) {
    for (const pin of route.pins || []) {
      if (!pin.address) continue;
      const parts = pin.address.split(",").map((s) => s.trim());
      if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
      return parts[parts.length - 1] || null;
    }
  }
  return null;
}

const TripFolderCard = ({ folder, routes, author, currentUserId }: TripFolderCardProps) => {
  const navigate = useNavigate();

  const allPins = routes.flatMap((r) => r.pins || []);
  const totalPins = allPins.length;

  // Hero image
  const heroImage =
    folder.cover_image_url ||
    allPins.find((p) => p.image_url || p.images?.length)?.image_url ||
    allPins.find((p) => p.images?.length)?.images?.[0] ||
    null;

  const location = extractLocation(routes);

  // Average rating
  const ratedPins = allPins.filter((p) => p.rating > 0);
  const avgRating = ratedPins.length > 0 ? ratedPins.reduce((s, p) => s + p.rating, 0) / ratedPins.length : 0;

  // Tags
  const allRecommended = [...new Set(allPins.flatMap((p) => p.recommended_for || []))];
  let tags = allRecommended.slice(0, 4);
  if (!tags.length) {
    const fallback = [...new Set(allPins.flatMap((p) => [...(p.pros || []), ...(p.tags || [])]))];
    tags = fallback.slice(0, 4);
  }

  // Preview routes (max 3)
  const previewRoutes = routes.slice(0, 3);
  const remainingRoutes = routes.length - previewRoutes.length;

  // "Dla kogo"
  const recFreq: Record<string, number> = {};
  allPins.forEach((p) => (p.recommended_for || []).forEach((r) => { recFreq[r] = (recFreq[r] || 0) + 1; }));
  const topRec = Object.entries(recFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  // Quality badges
  const badges: { emoji: string; label: string }[] = [];
  const pinsWithExpectation = allPins.filter((p) => p.expectation_met);
  if (totalPins > 0 && pinsWithExpectation.length / totalPins >= 0.8) {
    badges.push({ emoji: "✓", label: "Zweryfikowana podróż" });
  }
  if (totalPins >= 10) badges.push({ emoji: "📍", label: "Szczegółowa trasa" });

  // Totals
  const totalLikes = routes.reduce((s, r) => s + (r.likes?.length || 0), 0);
  const totalComments = routes.reduce((s, r) => s + (r.comments?.length || 0), 0);

  return (
    <div
      onClick={() => navigate(`/folder/${folder.id}`)}
      className="bg-background rounded-xl border border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* 1. Author header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={author.avatar_url || ""} alt={author.username} />
          <AvatarFallback className="text-xs">{author.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{author.username}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">{getRelativeTime(folder.created_at)}</span>
          </div>
          {location && (
            <p className="text-xs text-muted-foreground truncate">{location}</p>
          )}
        </div>
      </div>

      {/* 2. Hero image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt={folder.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <MapPin className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-16">
          <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 uppercase">
            {folder.name}
          </h3>
          <div className="flex gap-3 mt-1.5 text-xs text-white/80">
            <span>⏱ {routes.length} dni</span>
            <span>📍 {totalPins} miejsc</span>
            <span>🧭 {routes.length} tras</span>
            {avgRating > 0 && <span>⭐ {avgRating.toFixed(1)}</span>}
          </div>
        </div>
      </div>

      {/* 3. Tags */}
      {tags.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
              #{tag.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {/* 4. Mini-preview routes */}
      {previewRoutes.length > 0 && (
        <div className="px-4 py-2 space-y-1">
          {previewRoutes.map((route, idx) => (
            <div key={route.id} className="flex items-baseline gap-2 min-w-0">
              <span className="text-muted-foreground text-[8px] mt-1 flex-shrink-0">●</span>
              <span className="text-sm font-medium flex-shrink-0">Dzień {idx + 1}: {route.title}</span>
              <span className="text-muted-foreground text-sm">–</span>
              <span className="text-xs text-muted-foreground">{route.pins?.length || 0} miejsc</span>
            </div>
          ))}
          {remainingRoutes > 0 && (
            <p className="text-xs text-muted-foreground pl-4">i jeszcze {remainingRoutes} dni...</p>
          )}
        </div>
      )}

      {/* 5. Dla kogo */}
      {topRec.length > 0 && (
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground italic">
            Dla: {topRec.map((r) => r.toLowerCase()).join(", ")}
          </p>
        </div>
      )}

      {/* 6. Quality badges */}
      {badges.length > 0 && (
        <div className="px-4 py-1 flex gap-2">
          {badges.map((b) => (
            <span
              key={b.label}
              className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            >
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      )}

      {/* 7. Action footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Heart className="h-4 w-4" />
            <span className="font-medium">{totalLikes}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">{totalComments}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toast("Zapisywanie podróży – wkrótce!"); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default TripFolderCard;
