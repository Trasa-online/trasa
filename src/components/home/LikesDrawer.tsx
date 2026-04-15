import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Heart, ThumbsDown, Trash2 } from "lucide-react";
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
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum",
  park: "Park", bar: "Bar", club: "Klub", monument: "Zabytek",
  gallery: "Galeria", market: "Targ", viewpoint: "Widok",
  shopping: "Zakupy", experience: "Rozrywka",
};

// ─── PlaceRow ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72;

function PlaceRow({
  place,
  onToggle,
  onRemove,
}: {
  place: PlaceReaction;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    isSwiping.current = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!isSwiping.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping.current = true;
    }

    if (isSwiping.current) {
      setOffsetX(Math.min(0, dx));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isSwiping.current && offsetX <= -SWIPE_THRESHOLD) {
      onRemove();
    } else {
      setOffsetX(0);
    }
    isSwiping.current = false;
  }, [offsetX, onRemove]);

  const handlePointerCancel = useCallback(() => {
    setOffsetX(0);
    isSwiping.current = false;
  }, []);

  const deleteReveal = Math.min(1, Math.abs(offsetX) / SWIPE_THRESHOLD);

  return (
    <div className="relative overflow-hidden">
      {/* Swipe-left delete background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end px-5 bg-destructive"
        style={{ opacity: deleteReveal, width: `${Math.max(56, Math.abs(offsetX))}px` }}
      >
        <Trash2 className="h-5 w-5 text-white" />
      </div>

      {/* Row content */}
      <div
        className="relative flex items-center gap-3 py-2.5 px-4 bg-background touch-pan-y select-none"
        style={{ transform: `translateX(${offsetX}px)`, transition: isSwiping.current ? "none" : "transform 0.2s ease" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Thumbnail */}
        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted flex-shrink-0">
          {place.photo_url ? (
            <img src={place.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              {CATEGORY_EMOJI[place.category ?? ""] ?? "📍"}
            </div>
          )}
        </div>

        {/* Name + category chip */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{place.place_name}</p>
          {place.category && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground font-medium">
              {CATEGORY_EMOJI[place.category]}
              {CATEGORY_LABEL[place.category] ?? place.category}
            </span>
          )}
        </div>

        {/* Move to other section */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onToggle}
          className="flex-shrink-0 h-8 px-2.5 rounded-full bg-muted flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground active:bg-muted/70"
        >
          {place.reaction === "liked"
            ? <><ThumbsDown className="h-3 w-3" /> Odrzuć</>
            : <><Heart className="h-3 w-3" /> Polub</>}
        </button>
      </div>
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
              tab === "liked" ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"
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
              tab === "skipped" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
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
                  <p className="text-xs text-muted-foreground">Przeglądaj miejsca i lajkuj to, co Cię kręci.</p>
                </>
              ) : (
                <>
                  <ThumbsDown className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground/70">Brak odrzuconych miejsc</p>
                  <p className="text-xs text-muted-foreground">Miejsca, które pominiesz podczas swipowania, pojawią się tutaj.</p>
                </>
              )}
            </div>
          ) : (
            Object.entries(byCity).map(([city, cityPlaces]) => (
              <div key={city} className="mb-4">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {city}
                </p>
                <div className="mx-4 rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/20">
                  {cityPlaces.map(p => (
                    <PlaceRow
                      key={p.id}
                      place={p}
                      onToggle={() => toggleMutation.mutate(p.id)}
                      onRemove={() => removeMutation.mutate(p.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
