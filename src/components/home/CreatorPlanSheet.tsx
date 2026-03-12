import { useNavigate } from "react-router-dom";
import { ExternalLink, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

interface CreatorPlanSheetProps {
  plan: (CreatorPlan & { places: CreatorPlaceItem[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatorPlanSheet({ plan, open, onOpenChange }: CreatorPlanSheetProps) {
  const navigate = useNavigate();

  if (!plan) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] flex flex-col rounded-t-2xl p-0">
        {/* Thumbnail header */}
        {plan.thumbnail_url && (
          <div className="relative h-40 flex-shrink-0 overflow-hidden rounded-t-2xl">
            <img src={plan.thumbnail_url} alt={plan.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white font-bold text-lg line-clamp-2">{plan.title}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-white/80 text-sm">{plan.creator_handle}</span>
                <span className="flex items-center gap-1 text-white/60 text-xs">
                  <MapPin className="h-3 w-3" />
                  {plan.city}
                </span>
              </div>
            </div>
            {plan.video_url && (
              <a
                href={plan.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 right-3 bg-black/50 rounded-full p-1.5"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4 text-white" />
              </a>
            )}
          </div>
        )}

        {!plan.thumbnail_url && (
          <SheetHeader className="px-4 pt-4 flex-shrink-0">
            <SheetTitle>{plan.title}</SheetTitle>
            <p className="text-sm text-muted-foreground">{plan.creator_handle} · {plan.city}</p>
          </SheetHeader>
        )}

        {/* Places list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
            {plan.places.length} {plan.places.length === 1 ? "miejsce" : "miejsc"}
          </p>
          {plan.places.map((place, idx) => (
            <div key={place.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
              <span className="text-2xl flex-shrink-0">{CATEGORY_ICONS[place.category ?? ""] ?? "📍"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{place.place_name}</p>
                {place.category && (
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[place.category] ?? place.category}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground/50 flex-shrink-0">{idx + 1}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="p-4 pb-safe flex-shrink-0 border-t border-border/40">
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              onOpenChange(false);
              navigate(`/create?creatorPlan=${plan.id}`);
            }}
          >
            Zaplanuj podróż z tym planem
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
