import { MapPin } from "lucide-react";

export interface CreatorPlan {
  id: string;
  creator_handle: string;
  creator_avatar_url: string | null;
  creator_social_url: string | null;
  creator_social_platform: string | null;
  city: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  num_days: number | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

export interface CreatorPlaceItem {
  id: string;
  place_name: string;
  category: string | null;
  photo_url: string | null;
  description: string | null;
  suggested_time: string | null;
  order_index: number | null;
}

interface CreatorPlanCardProps {
  plan: CreatorPlan & { places: CreatorPlaceItem[] };
  onClick: () => void;
}

const PLATFORM_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  tiktok:    { label: "TikTok",    bg: "bg-black",        text: "text-white" },
  instagram: { label: "Instagram", bg: "bg-pink-600",     text: "text-white" },
  youtube:   { label: "YouTube",   bg: "bg-red-600",      text: "text-white" },
};

const CATEGORY_ICONS: Record<string, string> = {
  bar: "🍺", cafe: "☕", restaurant: "🍽️", viewpoint: "🌅",
  museum: "🏛️", park: "🌿", shopping: "🛍️", gallery: "🖼️",
  monument: "🏰", nightlife: "🌙",
};

export default function CreatorPlanCard({ plan, onClick }: CreatorPlanCardProps) {
  const photoPlaces = plan.places
    .filter(p => p.photo_url)
    .sort((a, b) => (a.order_index ?? 99) - (b.order_index ?? 99))
    .slice(0, 4);

  const platform = plan.creator_social_platform
    ? PLATFORM_BADGE[plan.creator_social_platform]
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl overflow-hidden bg-card border border-border/50 text-left active:scale-[0.99] transition-transform"
    >
      {/* Hero image */}
      <div className="relative h-52 overflow-hidden">
        {plan.thumbnail_url ? (
          <img
            src={plan.thumbnail_url}
            alt={plan.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-violet-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* City badge — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
          <MapPin className="h-3 w-3 text-white/80" />
          <span className="text-white text-xs font-medium">{plan.city}</span>
        </div>

        {/* Creator badge — bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2.5">
          {plan.creator_avatar_url ? (
            <img
              src={plan.creator_avatar_url}
              alt={plan.creator_handle}
              className="h-9 w-9 rounded-full border-2 border-white/40 object-cover shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">
                {plan.creator_handle.replace("@", "").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{plan.creator_handle}</p>
            {platform && (
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-sm mt-0.5 ${platform.bg} ${platform.text}`}>
                {platform.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold leading-snug flex-1">{plan.title}</h3>
          {plan.num_days && (
            <span className="shrink-0 text-xs text-muted-foreground mt-0.5">
              {plan.num_days} {plan.num_days === 1 ? "dzień" : "dni"}
            </span>
          )}
        </div>

        {/* Description */}
        {plan.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">
            {plan.description}
          </p>
        )}

        {/* Tags */}
        {plan.tags && plan.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {plan.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                className="text-[11px] bg-muted rounded-full px-2.5 py-0.5 text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Place photo strip — or emoji fallback */}
        {photoPlaces.length > 0 ? (
          <div className="flex gap-1.5 h-14">
            {photoPlaces.map(p => (
              <div key={p.id} className="flex-1 min-w-0 rounded-lg overflow-hidden relative">
                <img src={p.photo_url!} alt={p.place_name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5">
            {plan.places.slice(0, 4).map(p => (
              <div
                key={p.id}
                className="flex-1 min-w-0 h-14 rounded-lg bg-muted flex items-center justify-center text-xl"
              >
                {CATEGORY_ICONS[p.category ?? ""] ?? "📍"}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div className="px-4 pb-4">
        <div className="w-full text-center text-xs font-semibold text-orange-500 py-2 rounded-xl border border-orange-500/30 bg-orange-500/5">
          Personalizuj plan →
        </div>
      </div>
    </button>
  );
}
