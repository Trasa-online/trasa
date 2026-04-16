import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { MapPin, Clock, ArrowLeft, Sparkles } from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶", other: "📍",
};

export default function SharedRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["shared-route", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos")
        .eq("id", id as string)
        .eq("is_shared", true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!id,
  });

  const { data: pins = [] } = useQuery({
    queryKey: ["shared-route-pins", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pins")
        .select("id, place_name, address, category, suggested_time, images, image_url, pin_order, description")
        .eq("route_id", id!)
        .order("pin_order");
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  if (routeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Ładowanie...</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">🗺️</p>
        <p className="text-lg font-bold">Trasa niedostępna</p>
        <p className="text-sm text-muted-foreground">Ten link mógł wygasnąć lub trasa nie jest publiczna.</p>
        <button onClick={() => navigate("/")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">
          Wróć do Trasa
        </button>
      </div>
    );
  }

  const heroPhoto = route.review_photos?.[0];
  const dateLabel = route.start_date
    ? format(new Date(route.start_date), "d MMMM yyyy", { locale: pl })
    : "";
  const cityLabel = route.city || "Podróż";
  const dayLabel = route.day_number ? `Dzień ${route.day_number}` : "";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">

      {/* Hero */}
      <div className="relative w-full aspect-[4/5] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-8xl opacity-20">🗺️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />

        {/* Back */}
        <div className="absolute left-0 right-0 flex items-center px-4"
          style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => navigate("/")}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          {/* Shared badge */}
          <span className="ml-3 text-xs font-semibold text-white/80 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Trasa polecana
          </span>
        </div>

        {/* City + date */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          {dateLabel && <p className="text-white/70 text-sm mb-1">{dateLabel}</p>}
          <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm">{cityLabel}</h1>
          {dayLabel && <p className="text-white/70 text-base font-medium mt-0.5">{dayLabel}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">

        {/* AI highlight */}
        {route.ai_highlight && (
          <div className="px-5 pt-6 pb-5 border-b border-border/30">
            <p className="text-[22px] font-bold leading-snug text-foreground">
              „{route.ai_highlight}"
            </p>
          </div>
        )}

        {/* AI summary */}
        {route.ai_summary && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <p className="text-sm text-foreground/70 leading-relaxed">{route.ai_summary}</p>
          </div>
        )}

        {/* Places */}
        {pins.length > 0 && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Miejsca w tej trasie
            </p>
            <div className="space-y-3">
              {pins.map((pin: any, i: number) => {
                const thumb = pin.images?.[0] ?? pin.image_url ?? null;
                return (
                  <div key={pin.id} className="flex items-center gap-3">
                    {/* Number */}
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {i + 1}
                    </div>
                    {/* Thumbnail */}
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          {CATEGORY_EMOJI[pin.category] ?? "📍"}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{pin.place_name}</p>
                      {pin.suggested_time && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {pin.suggested_time}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* User photos (rest) */}
        {(route.review_photos?.length ?? 0) > 1 && (
          <div className="pt-5 pb-5 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-5">Zdjęcia</p>
            <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
              {route.review_photos.slice(1).map((url: string) => (
                <div key={url} className="flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden shadow-sm">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attribution */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Stworzone z pomocą <span className="font-semibold text-foreground">Trasa</span></span>
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-3 bg-background/90 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={() => navigate(`/plan?city=${encodeURIComponent(cityLabel)}`)}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-primary/25"
        >
          Zaplanuj podobną trasę w {cityLabel}
        </button>
      </div>
    </div>
  );
}
