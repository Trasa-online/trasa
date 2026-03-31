import { useNavigate } from "react-router-dom";
import { MapPin, ExternalLink, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { CreatorPlan, CreatorPlaceItem } from "./CreatorPlanCard";

const CATEGORY_ICONS: Record<string, string> = {
  bar: "🍺", cafe: "☕", restaurant: "🍽️", viewpoint: "🌅",
  museum: "🏛️", park: "🌿", shopping: "🛍️", gallery: "🖼️",
  monument: "🏰", nightlife: "🌙",
};

const CATEGORY_LABELS: Record<string, string> = {
  bar: "Bar", cafe: "Kawiarnia", restaurant: "Restauracja", viewpoint: "Widok",
  museum: "Muzeum", park: "Park", shopping: "Zakupy", gallery: "Galeria",
  monument: "Zabytek", nightlife: "Nocne życie",
};

const PLATFORM_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  tiktok:    { label: "TikTok",    bg: "bg-black",    text: "text-white" },
  instagram: { label: "Instagram", bg: "bg-pink-600", text: "text-white" },
  youtube:   { label: "YouTube",   bg: "bg-red-600",  text: "text-white" },
};

interface CreatorPlanSheetProps {
  plan: (CreatorPlan & { places: CreatorPlaceItem[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonalize?: (plan: CreatorPlan & { places: CreatorPlaceItem[] }) => void;
}

export default function CreatorPlanSheet({ plan, open, onOpenChange, onPersonalize }: CreatorPlanSheetProps) {
  const navigate = useNavigate();

  if (!plan) return null;

  const platform = plan.creator_social_platform
    ? PLATFORM_BADGE[plan.creator_social_platform]
    : null;

  const sortedPlaces = [...plan.places].sort(
    (a, b) => (a.order_index ?? 99) - (b.order_index ?? 99)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90dvh] flex flex-col rounded-t-2xl p-0">

        {/* Hero image */}
        <div className="relative h-48 flex-shrink-0 overflow-hidden rounded-t-2xl">
          {plan.thumbnail_url ? (
            <img src={plan.thumbnail_url} alt={plan.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-600/20 to-violet-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          {/* Creator info overlay */}
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="flex items-center gap-2.5">
              {plan.creator_avatar_url ? (
                <img
                  src={plan.creator_avatar_url}
                  alt={plan.creator_handle}
                  className="h-10 w-10 rounded-full border-2 border-white/40 object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <span className="text-white font-bold">
                    {plan.creator_handle.replace("@", "").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="text-white font-semibold text-sm">{plan.creator_handle}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {platform && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${platform.bg} ${platform.text}`}>
                      {platform.label}
                    </span>
                  )}
                  {plan.num_days && (
                    <span className="text-white/70 text-xs">
                      {plan.num_days} {plan.num_days === 1 ? "dzień" : "dni"}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <MapPin className="h-3 w-3" />
                    {plan.city}
                  </span>
                </div>
              </div>
            </div>

            {/* Social link */}
            {plan.creator_social_url && (
              <a
                href={plan.creator_social_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 backdrop-blur-sm rounded-full p-2 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4 text-white" />
              </a>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            {/* Title */}
            <SheetTitle className="text-lg font-bold leading-snug mb-1">{plan.title}</SheetTitle>

            {/* Description */}
            {plan.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{plan.description}</p>
            )}

            {/* Tags */}
            {plan.tags && plan.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {plan.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs bg-muted rounded-full px-2.5 py-1 text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
              {plan.places.length} {plan.places.length === 1 ? "miejsce" : "miejsc"}
            </p>
          </div>

          {/* Places list */}
          <div className="px-4 space-y-2 pb-4">
            {sortedPlaces.map((place, idx) => (
              <div key={place.id} className="flex gap-3 rounded-xl overflow-hidden bg-muted/40 border border-border/30">
                {/* Place photo */}
                {place.photo_url ? (
                  <img
                    src={place.photo_url}
                    alt={place.place_name}
                    className="h-20 w-20 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-20 w-20 flex-shrink-0 bg-muted flex items-center justify-center text-2xl">
                    {CATEGORY_ICONS[place.category ?? ""] ?? "📍"}
                  </div>
                )}

                <div className="flex-1 min-w-0 py-2.5 pr-3">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-semibold leading-tight">{place.place_name}</p>
                    <span className="text-xs text-muted-foreground/50 shrink-0 mt-0.5">{idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {place.category && (
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[place.category] ?? place.category}
                      </span>
                    )}
                    {place.suggested_time && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground/70">
                        <Clock className="h-3 w-3" />
                        {place.suggested_time}
                      </span>
                    )}
                  </div>
                  {place.description && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                      {place.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-4 pb-safe flex-shrink-0 border-t border-border/40">
          <Button
            className="w-full bg-orange-600 hover:bg-orange-700 text-white border-0"
            size="lg"
            onClick={() => {
              onOpenChange(false);
              if (onPersonalize) {
                onPersonalize(plan);
              } else {
                navigate(`/create?creatorPlan=${plan.id}`);
              }
            }}
          >
            Personalizuj ten plan →
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
