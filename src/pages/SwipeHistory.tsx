import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Compass, Heart, ThumbsDown, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SwipeDiscovery from "@/components/discover/SwipeDiscovery";

const CITIES = ["Kraków", "Gdańsk", "Warszawa", "Wrocław", "Poznań", "Zakopane"];

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

const SwipeHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"liked" | "skipped">("liked");
  const [exploreCity, setExploreCity] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { data: reactions = [], isLoading } = useQuery({
    queryKey: ["place-reactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("user_place_reactions")
        .select("id, place_id, place_name, city, category, photo_url, reaction")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = reactions.find((r: any) => r.id === id);
      if (!current) return;
      const next = current.reaction === "liked" ? "skipped" : "liked";
      await (supabase as any).from("user_place_reactions").update({ reaction: next }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-reactions", user?.id] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("user_place_reactions").delete().eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["place-reactions", user?.id] }),
  });

  // Show SwipeDiscovery fullscreen when city selected
  if (exploreCity) {
    return (
      <SwipeDiscovery
        city={exploreCity}
        onDone={() => {
          setExploreCity(null);
          queryClient.invalidateQueries({ queryKey: ["place-reactions", user?.id] });
        }}
      />
    );
  }

  const filtered = reactions.filter((r: any) => r.reaction === tab);
  const likedCount = reactions.filter((r: any) => r.reaction === "liked").length;
  const skippedCount = reactions.filter((r: any) => r.reaction === "skipped").length;

  const byCity = filtered.reduce<Record<string, any[]>>((acc, p: any) => {
    if (!acc[p.city]) acc[p.city] = [];
    acc[p.city].push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
        <h1 className="text-xl font-black tracking-tight pt-2 pb-4">Eksploruj</h1>

        {/* Explore CTA */}
        <button
          onClick={() => navigate("/plan")}
          className="w-full bg-card border-2 border-orange-600 rounded-3xl px-5 py-5 flex items-center gap-4 mb-5 active:scale-[0.98] transition-transform"
        >
          <div className="h-12 w-12 rounded-2xl bg-orange-600/10 flex items-center justify-center flex-shrink-0">
            <Compass className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-foreground font-bold text-base leading-tight">Odkrywaj miejsca</p>
            <p className="text-muted-foreground text-sm mt-0.5">Przeglądaj i lajkuj polecane przez twórców</p>
          </div>
          <ChevronRight className="h-5 w-5 text-orange-600 flex-shrink-0" />
        </button>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("liked")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
              tab === "liked" ? "bg-rose-500 text-white" : "bg-card border border-border/50 text-muted-foreground"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", tab === "liked" && "fill-current")} />
            Polubione
            {likedCount > 0 && (
              <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === "liked" ? "bg-white/20" : "bg-muted")}>
                {likedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("skipped")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors",
              tab === "skipped" ? "bg-foreground text-background" : "bg-card border border-border/50 text-muted-foreground"
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Odrzucone
            {skippedCount > 0 && (
              <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === "skipped" ? "bg-white/20" : "bg-muted")}>
                {skippedCount}
              </span>
            )}
          </button>
        </div>

        {/* Places list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Ładowanie...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center gap-2">
            {tab === "liked"
              ? <><Heart className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Brak polubionych miejsc</p></>
              : <><ThumbsDown className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Brak odrzuconych miejsc</p></>
            }
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byCity).map(([city, cityPlaces]) => (
              <div key={city}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{city}</p>
                <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/20">
                  {cityPlaces.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 px-4">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        {p.photo_url
                          ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">{CATEGORY_EMOJI[p.category ?? ""] ?? "📍"}</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{p.place_name}</p>
                        {p.category && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground font-medium">
                            {CATEGORY_EMOJI[p.category]} {CATEGORY_LABEL[p.category] ?? p.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleMutation.mutate(p.id)}
                          className="h-8 px-2.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 active:bg-muted/70"
                        >
                          {p.reaction === "liked"
                            ? <><ThumbsDown className="h-3 w-3" /> Odrzuć</>
                            : <><Heart className="h-3 w-3" /> Polub</>}
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(p.id)}
                          className="h-8 w-8 rounded-full bg-muted text-muted-foreground/50 flex items-center justify-center active:bg-muted/70"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* City picker bottom sheet */}
      {cityPickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCityPickerOpen(false)} />
          <div className="relative mt-auto w-full bg-background rounded-t-3xl pb-safe">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <h2 className="text-lg font-bold mb-4">Wybierz miasto</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {CITIES.map(city => (
                  <button
                    key={city}
                    onClick={() => { setCityPickerOpen(false); setExploreCity(city); }}
                    className="rounded-2xl border border-border/50 bg-card py-3.5 text-sm font-semibold text-center active:bg-muted transition-colors"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SwipeHistory;
