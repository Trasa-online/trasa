import { MapPin } from "lucide-react";

export interface CreatorPlan {
  id: string;
  creator_handle: string;
  city: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

export interface CreatorPlaceItem {
  id: string;
  place_name: string;
  category: string | null;
}

interface CreatorPlanCardProps {
  plan: CreatorPlan & { places: CreatorPlaceItem[] };
  onClick: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  bar: "🍺", cafe: "☕", restaurant: "🍽️", viewpoint: "🌅",
  museum: "🏛️", park: "🌿", shopping: "🛍️", gallery: "🖼️",
  monument: "🏰", nightlife: "🌙",
};

export default function CreatorPlanCard({ plan, onClick }: CreatorPlanCardProps) {
  const visible = plan.places.slice(0, 3);
  const extra = plan.places.length - visible.length;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-64 rounded-2xl overflow-hidden bg-card border border-border/50 text-left active:scale-95 transition-transform snap-start"
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-muted overflow-hidden">
        {plan.thumbnail_url ? (
          <img
            src={plan.thumbnail_url}
            alt={plan.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
          <span className="text-white text-xs font-medium opacity-90">{plan.creator_handle}</span>
          <span className="flex items-center gap-0.5 text-white text-xs opacity-75">
            <MapPin className="h-3 w-3" />
            {plan.city}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm font-semibold line-clamp-1 mb-2">{plan.title}</p>
        <div className="space-y-1">
          {visible.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{CATEGORY_ICONS[p.category ?? ""] ?? "📍"}</span>
              <span className="line-clamp-1">{p.place_name}</span>
            </div>
          ))}
          {extra > 0 && (
            <p className="text-xs text-muted-foreground/60">+ {extra} więcej →</p>
          )}
        </div>
      </div>
    </button>
  );
}
