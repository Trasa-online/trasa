import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FeedRoute {
  id: string;
  city: string;
  created_at: string;
  ai_summary?: string | null;
  review_photos?: string[] | null;
}

interface FeedActor {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

interface FeedActivityCardProps {
  route: FeedRoute;
  actor: FeedActor;
}

export default function FeedActivityCard({ route, actor }: FeedActivityCardProps) {
  const navigate = useNavigate();
  const displayName = actor.first_name || actor.username || "Ktoś";
  const timeAgo = formatDistanceToNow(new Date(route.created_at), { addSuffix: false, locale: pl });
  const photos = route.review_photos ?? [];

  const goToProfile = () => actor.username && navigate(`/profil/${actor.username}`);
  const goToRoute = () => navigate(`/route/${route.id}`);

  return (
    <div className="flex gap-3 px-4 py-4">
      {/* Left column: avatar + thread line */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <button onClick={goToProfile}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={actor.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="w-px flex-1 min-h-[24px] bg-border/50" />
      </div>

      {/* Right column: content */}
      <div className="flex-1 min-w-0 pb-2">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <button onClick={goToProfile} className="font-semibold text-sm leading-tight hover:underline truncate">
            {displayName}
          </button>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>

        {/* City */}
        <div className="flex items-center gap-1 mb-1.5">
          <MapPin className="h-3 w-3 text-orange-600 flex-shrink-0" />
          <span className="text-sm font-medium">{route.city}</span>
        </div>

        {/* Summary */}
        {route.ai_summary && (
          <p className="text-sm text-foreground/80 leading-relaxed mb-2.5 line-clamp-3">
            {route.ai_summary}
          </p>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className={`grid gap-1.5 mb-3 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {photos.slice(0, 2).map((url, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-muted aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={goToRoute}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Zobacz trasę →
        </button>
      </div>
    </div>
  );
}
