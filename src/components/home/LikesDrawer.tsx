import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Heart, ThumbsDown, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaceReaction {
  id: string;
  place_id: string | null;
  place_name: string;
  city: string;
  category: string | null;
  photo_url: string | null;
  reaction: "liked" | "skipped";
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
};

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracje", cafe: "Kawiarnie", museum: "Muzea",
  park: "Parki", bar: "Bary", club: "Kluby", monument: "Zabytki",
  gallery: "Galerie", market: "Targi", viewpoint: "Widoki",
  shopping: "Zakupy", experience: "Rozrywka",
};

// ─── PlaceRow ─────────────────────────────────────────────────────────────────

function PlaceRow({
  place,
  onToggle,
  onRemove,
}: {
  place: PlaceReaction;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4">
      {/* Thumbnail */}
      <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
        {place.photo_url ? (
          <img src={place.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">
            {CATEGORY_EMOJI[place.category ?? ""] ?? "📍"}
          </div>
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{place.place_name}</p>
        {place.category && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {CATEGORY_EMOJI[place.category]} {CATEGORY_LABEL[place.category] ?? place.category}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Toggle reaction */}
        <button
          onClick={onToggle}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            place.reaction === "liked"
              ? "bg-rose-500/10 text-rose-500 active:bg-rose-500/20"
              : "bg-muted text-muted-foreground active:bg-muted/80"
          )}
          title={place.reaction === "liked" ? "Przenieś do odrzuconych" : "Przenieś do polubionych"}
        >
          {place.reaction === "liked"
            ? <Heart className="h-4 w-4 fill-current" />
            : <ThumbsDown className="h-4 w-4" />}
        </button>
        {/* Remove */}
        <button
          onClick={onRemove}
          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:bg-muted/80 transition-colors"
          title="Usuń"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── CategoryGroup ────────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  places,
  onToggle,
  onRemove,
}: {
  category: string;
  places: PlaceReaction[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t border-border/30 first:border-t-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-base">{CATEGORY_EMOJI[category] ?? "📍"}</span>
        <span className="text-xs font-semibold text-muted-foreground flex-1">
          {CATEGORY_LABEL[category] ?? category}
        </span>
        <span className="text-[11px] text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">
          {places.length}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="divide-y divide-border/20">
          {places.map(p => (
            <PlaceRow
              key={p.id}
              place={p}
              onToggle={() => onToggle(p.id)}
              onRemove={() => onRemove(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CitySection ──────────────────────────────────────────────────────────────

function CitySection({
  city,
  places,
  onToggle,
  onRemove,
}: {
  city: string;
  places: PlaceReaction[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  // Group by category within city
  const byCategory = places.reduce<Record<string, PlaceReaction[]>>((acc, p) => {
    const key = p.category ?? "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="mb-2">
      {/* City header */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <p className="text-sm font-bold flex-1">{city}</p>
        <span className="text-[11px] text-muted-foreground">{places.length} miejsc</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="rounded-2xl bg-card border border-border/50 overflow-hidden mx-4 mb-3">
          {Object.entries(byCategory).map(([category, catPlaces]) => (
            <CategoryGroup
              key={category}
              category={category}
              places={catPlaces}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LikesDrawer ──────────────────────────────────────────────────────────────

interface LikesDrawerProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function LikesDrawer({ open, onClose, userId }: LikesDrawerProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"liked" | "skipped">("liked");

  const { data: reactions = [], isLoading } = useQuery({
    queryKey: ["place-reactions", userId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_place_reactions")
        .select("id, place_id, place_name, city, category, photo_url, reaction")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return (data ?? []) as PlaceReaction[];
    },
    enabled: open && !!userId,
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = reactions.find(r => r.id === id);
      if (!current) return;
      const next = current.reaction === "liked" ? "skipped" : "liked";
      await (supabase as any)
        .from("user_place_reactions")
        .update({ reaction: next })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-reactions", userId] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("user_place_reactions")
        .delete()
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-reactions", userId] }),
  });

  const filtered = reactions.filter(r => r.reaction === tab);

  // Group by city
  const byCity = filtered.reduce<Record<string, PlaceReaction[]>>((acc, p) => {
    if (!acc[p.city]) acc[p.city] = [];
    acc[p.city].push(p);
    return acc;
  }, {});

  const likedCount = reactions.filter(r => r.reaction === "liked").length;
  const skippedCount = reactions.filter(r => r.reaction === "skipped").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative mt-auto w-full bg-background rounded-t-3xl flex flex-col overflow-hidden"
        style={{ height: "88dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center px-5 pb-3 pt-1">
          <h2 className="text-lg font-bold flex-1">Twoje miejsca</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pb-4">
          <button
            onClick={() => setTab("liked")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
              tab === "liked"
                ? "bg-rose-500 text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", tab === "liked" && "fill-current")} />
            Polubione
            {likedCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                tab === "liked" ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {likedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("skipped")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
              tab === "skipped"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Odrzucone
            {skippedCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                tab === "skipped" ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {skippedCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Ładowanie...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
              {tab === "liked" ? (
                <>
                  <Heart className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground/70">Brak polubionych miejsc</p>
                  <p className="text-xs text-muted-foreground">
                    Przeglądaj miejsca i lajkuj to, co Cię kręci.
                  </p>
                </>
              ) : (
                <>
                  <ThumbsDown className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground/70">Brak odrzuconych miejsc</p>
                  <p className="text-xs text-muted-foreground">
                    Miejsca, które pominiesz podczas swipowania, pojawią się tutaj.
                  </p>
                </>
              )}
            </div>
          ) : (
            Object.entries(byCity).map(([city, cityPlaces]) => (
              <CitySection
                key={city}
                city={city}
                places={cityPlaces}
                onToggle={(id) => toggleMutation.mutate(id)}
                onRemove={(id) => removeMutation.mutate(id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
