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
  const timeAgo = formatDistanceToNow(new Date(route.created_at), { addSuffix: true, locale: pl });

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
      {/* Actor row */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <button onClick={() => actor.username && navigate(`/profil/${actor.username}`)}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={actor.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-tight">
            <button
              onClick={() => actor.username && navigate(`/profil/${actor.username}`)}
              className="font-semibold hover:underline"
            >
              {displayName}
            </button>
            <span className="text-muted-foreground"> dodał(a) trasę</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
        </div>
      </div>

      {/* City pill */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="h-3.5 w-3.5 text-orange-600" />
          <span className="text-base font-bold">{route.city}</span>
        </div>
        {route.ai_summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
            {route.ai_summary}
          </p>
        )}
        <button
          onClick={() => navigate(`/route/${route.id}`)}
          className="w-full py-2 rounded-xl bg-muted text-sm font-semibold text-foreground active:bg-muted/70 transition-colors"
        >
          Zobacz trasę →
        </button>
      </div>
    </div>
  );
}
