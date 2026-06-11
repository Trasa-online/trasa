import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl } from "@/lib/placePhotos";

export const PLACE_CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶",
};

// Pelny URL (cache/storage/http) uzywamy bezposrednio; surowy photo_reference
// przepuszczamy przez proxy getPhotoUrl.
export const resolveStored = (img: string | null | undefined): string | null => {
  if (!img) return null;
  return /^(https?:|\/api\/|\/storage\/|blob:|data:)/.test(img) ? img : getPhotoUrl(img);
};

// Zdjecie miejsca: stored (image_url/images) albo fallback do Google Places (jak
// w kreatorze trasy). Dzieki temu pins bez wlasnego zdjecia dostaja zdjecie z
// Google zamiast samej emoji.
export function PlacePhoto({ pin, className, emojiClass }: { pin: any; className?: string; emojiClass?: string }) {
  const stored = pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null) || pin.photo_url;
  const [url, setUrl] = useState<string | null>(resolveStored(stored));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    supabase.functions
      .invoke("google-places-proxy", {
        body: { placeName: pin.place_name, latitude: pin.latitude || undefined, longitude: pin.longitude || undefined },
      })
      .then(({ data }: any) => {
        const ref = data?.result?.photos?.[0]?.photo_reference;
        if (ref && !cancelled) { const u = getPhotoUrl(ref, 800); if (u) setUrl(u); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.place_name]);

  if (url && !failed) {
    return <img src={url} alt="" className={className} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${className ?? ""} flex items-center justify-center bg-muted ${emojiClass ?? "text-xl"}`}>
      {PLACE_CATEGORY_EMOJI[pin.category] ?? "📍"}
    </div>
  );
}
