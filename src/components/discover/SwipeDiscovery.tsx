import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SwipeCard, { type CreatorPlace } from "./SwipeCard";
import { Loader2, X, Heart } from "lucide-react";

interface SwipeDiscoveryProps {
  city: string;
  onDone: (likedPlaces: string[]) => void;
}

export default function SwipeDiscovery({ city, onDone }: SwipeDiscoveryProps) {
  const [cards, setCards] = useState<CreatorPlace[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedPlaces, setLikedPlaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const normalized = city.trim().toLowerCase();
      const { data } = await supabase
        .from("creator_places")
        .select("id, place_name, category, description, instagram_reel_url, creator_handle, photo_url")
        .ilike("city", normalized)
        .eq("is_active", true)
        .limit(5);

      if (!data || data.length === 0) {
        onDone([]);
        return;
      }
      setCards(data as CreatorPlace[]);
      setLoading(false);
    };
    fetch();
  }, [city, onDone]);

  const handleSwipe = (action: "like" | "skip") => {
    const card = cards[currentIndex];
    const newLiked = action === "like"
      ? [...likedPlaces, card.place_name]
      : likedPlaces;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      onDone(newLiked);
    } else {
      setLikedPlaces(newLiked);
      setCurrentIndex(nextIndex);
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const remaining = cards.length - currentIndex;

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-4 pb-3 flex-shrink-0">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Odkryj miejsca
          </p>
          <h1 className="text-lg font-bold">Polecane przez twórców</h1>
        </div>
        <button
          onClick={() => onDone([])}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          Pomiń
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center pb-3 flex-shrink-0">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < currentIndex ? "w-3 bg-foreground/30" :
              i === currentIndex ? "w-6 bg-foreground" :
              "w-3 bg-foreground/20"
            }`}
          />
        ))}
      </div>

      {/* Card stack */}
      <div className="flex-1 relative mx-4 mb-4">
        {cards.slice(currentIndex, currentIndex + 3).map((card, idx) => (
          <SwipeCard
            key={card.id}
            place={card}
            onSwipe={handleSwipe}
            active={idx === 0}
            stackIndex={idx}
          />
        ))}

        {remaining === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Wszystkie karty przejrzane</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-8 pb-safe flex-shrink-0 pb-6">
        <button
          onClick={() => handleSwipe("skip")}
          className="h-16 w-16 rounded-full border-2 border-border bg-card flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <X className="h-7 w-7 text-muted-foreground" />
        </button>
        <button
          onClick={() => handleSwipe("like")}
          className="h-16 w-16 rounded-full bg-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <Heart className="h-7 w-7 text-background fill-background" />
        </button>
      </div>
    </div>
  );
}
