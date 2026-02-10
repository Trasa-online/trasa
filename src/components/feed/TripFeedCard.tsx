import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Heart, MessageCircle, Bookmark } from "lucide-react";

interface TripFeedCardProps {
  route: {
    id: string;
    title: string;
    description: string;
    created_at: string;
    trip_type: string;
    rating: number;
    status: string;
    profiles: { username: string; avatar_url: string | null };
    pins: Array<{
      id: string;
      place_name: string;
      address: string;
      image_url: string;
      images: string[];
      tags: string[];
      rating: number;
      expectation_met: string | null;
      pros: string[];
      cons: string[];
      trip_role: string | null;
      one_liner: string;
      recommended_for: string[];
    }>;
    likes: Array<{ user_id: string }>;
    comments: Array<{ id: string }>;
  };
  currentUserId?: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "przed chwilą";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dni temu`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} tyg. temu`;
  const months = Math.floor(days / 30);
  return `${months} mies. temu`;
}

function extractLocation(pins: TripFeedCardProps["route"]["pins"]): string | null {
  if (!pins.length) return null;
  const addr = pins[0].address;
  if (!addr) return null;
  const parts = addr.split(",").map((s) => s.trim());
  // Take last 1-2 parts as country/city
  if (parts.length >= 2) return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  return parts[parts.length - 1] || null;
}

const TripFeedCard = ({ route, currentUserId }: TripFeedCardProps) => {
  const navigate = useNavigate();
  const pins = route.pins || [];

  // Hero image
  const heroPin = pins.find((p) => p.image_url || p.images?.length);
  const heroImage = heroPin?.image_url || heroPin?.images?.[0] || null;

  // Location from first pin
  const location = extractLocation(pins);

  // Tags: unique recommended_for from all pins, fallback to pros/tags
  const allRecommended = [...new Set(pins.flatMap((p) => p.recommended_for || []))];
  let tags = allRecommended.slice(0, 4);
  if (!tags.length) {
    const fallback = [...new Set(pins.flatMap((p) => [...(p.pros || []), ...(p.tags || [])]))];
    tags = fallback.slice(0, 4);
  }

  // Mini-preview: prioritize must_see, max 3
  const mustSee = pins.filter((p) => p.trip_role === "must_see");
  const rest = pins.filter((p) => p.trip_role !== "must_see");
  const previewPins = [...mustSee, ...rest].slice(0, 3);
  const remainingCount = pins.length - previewPins.length;

  // "Dla kogo" - top 3 recommended_for by frequency
  const recFreq: Record<string, number> = {};
  pins.forEach((p) => (p.recommended_for || []).forEach((r) => { recFreq[r] = (recFreq[r] || 0) + 1; }));
  const topRec = Object.entries(recFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  // Quality badges
  const badges: { emoji: string; label: string }[] = [];
  const allHaveExpectation = pins.length > 0 && pins.every((p) => p.expectation_met);
  if (allHaveExpectation) badges.push({ emoji: "✓", label: "Zweryfikowana podróż" });
  if (pins.length >= 5) badges.push({ emoji: "📍", label: "Szczegółowa trasa" });
  const shownBadges = badges.slice(0, 2);

  // Average rating
  const avgRating = route.rating || 0;

  // Like state
  const isLiked = currentUserId ? route.likes?.some((l) => l.user_id === currentUserId) : false;
  const isOwnRoute = currentUserId === (route as any).user_id;

  const handleCardClick = () => navigate(`/route/${route.id}`);

  return (
    <div
      onClick={handleCardClick}
      className="bg-background rounded-xl border border-border/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* 1. Author header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={route.profiles?.avatar_url || ""} alt={route.profiles?.username} />
          <AvatarFallback className="text-xs">{route.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{route.profiles?.username}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">{relativeTime(route.created_at)}</span>
          </div>
          {location && (
            <p className="text-xs text-muted-foreground truncate">{location}</p>
          )}
        </div>
        {!isOwnRoute && currentUserId && (
          <button
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent flex-shrink-0"
          >
            Obserwuj
          </button>
        )}
      </div>

      {/* 2. Hero image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt={route.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <MapPin className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-16">
          <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 uppercase">
            {route.title}
          </h3>
          <div className="flex gap-3 mt-1.5 text-xs text-white/80">
            <span>📍 {pins.length} miejsc</span>
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

      {/* 4. Mini-preview */}
      {previewPins.length > 0 && (
        <div className="px-4 py-2 space-y-1">
          {previewPins.map((pin) => (
            <div key={pin.id} className="flex items-baseline gap-2 min-w-0">
              <span className="text-muted-foreground text-[8px] mt-1 flex-shrink-0">●</span>
              <span className="text-sm font-medium flex-shrink-0">{pin.place_name}</span>
              {pin.one_liner && (
                <>
                  <span className="text-muted-foreground text-sm">–</span>
                  <span className="text-sm text-muted-foreground truncate">{pin.one_liner}</span>
                </>
              )}
            </div>
          ))}
          {remainingCount > 0 && (
            <p className="text-xs text-muted-foreground pl-4">i jeszcze {remainingCount} miejsc...</p>
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
      {shownBadges.length > 0 && (
        <div className="px-4 py-1 flex gap-2">
          {shownBadges.map((b) => (
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
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Heart className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
            <span>{route.likes?.length || 0}</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{route.comments?.length || 0}</span>
          </button>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default TripFeedCard;
