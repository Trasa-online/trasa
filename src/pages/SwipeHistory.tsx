import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Compass, Heart, ThumbsDown, X, ChevronRight, Star, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";

type Country = { code: string; flag: string; name: string; cities: string[] };
type ActiveCountryCode = "PL" | "HU" | "MT";

const COUNTRIES: Country[] = [
  { code: "PL", flag: "🇵🇱", name: "Polska", cities: ["Kraków", "Łódź", "Poznań", "Trójmiasto", "Warszawa", "Wrocław"] },
  { code: "HU", flag: "🇭🇺", name: "Węgry", cities: ["Budapeszt"] },
  { code: "MT", flag: "🇲🇹", name: "Malta", cities: ["Valletta"] },
];

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
  const location = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"liked" | "super_liked" | "skipped">("liked");
  const [detailPlace, setDetailPlace] = useState<any | null>(null);
  const [countryCode, setCountryCode] = useState<ActiveCountryCode>("PL");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode)!;
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Auto-select country/city when navigating from exploration
  useEffect(() => {
    const fromCity = (location.state as any)?.fromCity;
    if (!fromCity) return;
    const cityLower = fromCity.toLowerCase();
    for (const country of COUNTRIES) {
      const match = country.cities.find(c => c.toLowerCase() === cityLower);
      if (match) {
        setCountryCode(country.code as ActiveCountryCode);
        if (country.cities.length > 1) setSelectedCity(match);
        break;
      }
    }
  }, [location.state]);

  // Reset city when country changes
  const handleCountryChange = (code: ActiveCountryCode) => {
    setCountryCode(code);
    setSelectedCity(null);
    setCountryMenuOpen(false);
  };

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

  const countryCities = selectedCountry.cities;
  const activeCitiesLower = (selectedCity ? [selectedCity] : countryCities).map(c => c.toLowerCase());
  const countryReactions = reactions.filter((r: any) => activeCitiesLower.includes(r.city?.toLowerCase()));
  const filtered = countryReactions.filter((r: any) => r.reaction === tab);
  const likedCount = countryReactions.filter((r: any) => r.reaction === "liked").length;
  const skippedCount = countryReactions.filter((r: any) => r.reaction === "skipped").length;
  const superLikedCount = countryReactions.filter((r: any) => r.reaction === "super_liked").length;

  const byCity = filtered.reduce<Record<string, any[]>>((acc, p: any) => {
    if (!acc[p.city]) acc[p.city] = [];
    acc[p.city].push(p);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <h1 className="text-xl font-black tracking-tight pt-2 pb-4">Odkrywaj</h1>
      <p className="text-sm text-muted-foreground mb-2 -mt-2">Wybierz miejsca, z których stworzymy przyszłe plany.</p>

      {/* Explore CTA */}
      <button
        onClick={() => navigate("/plan", { state: { exploreMode: true } })}
        className="group w-full bg-card border border-border/40 rounded-3xl px-5 py-5 flex items-center gap-4 mb-5 active:scale-[0.98] transition-transform shadow-sm"
      >
        <div className="h-12 w-12 rounded-2xl bg-orange-600/10 flex items-center justify-center flex-shrink-0">
          <Compass className="h-6 w-6 text-orange-600" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-foreground font-bold text-base leading-tight">Odkrywaj miejsca</p>
          <p className="text-muted-foreground text-sm mt-0.5">Zaplanuj podróż do wybranego miasta</p>
        </div>
        <ChevronRight className="h-5 w-5 text-orange-600 flex-shrink-0 transition-transform duration-300 group-active:translate-x-1 group-hover:translate-x-1" />
      </button>

      {/* Country + City selectors */}
      <div className="flex gap-2 justify-start mb-4">
        {/* Country */}
        <div className="relative">
          <button
            onClick={() => { setCountryMenuOpen(o => !o); setCityMenuOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm text-sm font-semibold transition-colors active:bg-muted"
          >
            <span className="text-lg leading-none">{selectedCountry.flag}</span>
            <span>{selectedCountry.name}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", countryMenuOpen && "rotate-180")} />
          </button>
          {countryMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCountryMenuOpen(false)} />
              <div className="absolute top-full mt-2 z-20 bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden min-w-[180px]">
                {COUNTRIES.map(country => (
                  <button
                    key={country.code}
                    onClick={() => handleCountryChange(country.code as ActiveCountryCode)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-lg leading-none">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    {country.code === countryCode && <Check className="h-4 w-4 text-orange-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* City */}
        {countryCities.length > 1 && (
          <div className="relative">
            <button
              onClick={() => { setCityMenuOpen(o => !o); setCountryMenuOpen(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-sm text-sm font-semibold transition-colors active:bg-muted"
            >
              <span>{selectedCity ?? "Wszystkie"}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", cityMenuOpen && "rotate-180")} />
            </button>
            {cityMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCityMenuOpen(false)} />
                <div className="absolute top-full mt-2 z-20 bg-card border border-border/50 rounded-2xl shadow-lg overflow-hidden min-w-[160px]">
                  <button
                    onClick={() => { setSelectedCity(null); setCityMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <span className="flex-1">Wszystkie</span>
                    {selectedCity === null && <Check className="h-4 w-4 text-orange-600" />}
                  </button>
                  {countryCities.map(city => (
                    <button
                      key={city}
                      onClick={() => { setSelectedCity(city); setCityMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors text-left"
                    >
                      <span className="flex-1">{city}</span>
                      {selectedCity === city && <Check className="h-4 w-4 text-orange-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none -mx-4 px-4">
        <button
          onClick={() => setTab("liked")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 border",
            tab === "liked" ? "border-rose-500 text-rose-500 bg-rose-500/10" : "border-border/50 bg-card text-muted-foreground"
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", tab === "liked" && "fill-rose-500")} />
          Polubione
          {likedCount > 0 && (
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === "liked" ? "bg-rose-500/15" : "bg-muted")}>
              {likedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("super_liked")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 border",
            tab === "super_liked" ? "border-yellow-500 text-yellow-600 bg-yellow-500/10" : "border-border/50 bg-card text-muted-foreground"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", tab === "super_liked" && "fill-yellow-500 text-yellow-500")} />
          Super
          {superLikedCount > 0 && (
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === "super_liked" ? "bg-yellow-500/15" : "bg-muted")}>
              {superLikedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("skipped")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 border",
            tab === "skipped" ? "border-foreground/50 text-foreground bg-foreground/5" : "border-border/50 bg-card text-muted-foreground"
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Odrzucone
          {skippedCount > 0 && (
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", tab === "skipped" ? "bg-foreground/10" : "bg-muted")}>
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
            : tab === "super_liked"
            ? <><Star className="h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Brak super polubionych miejsc</p></>
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
                    <div
                      className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                      onClick={() => setDetailPlace(p)}
                    >
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xl">{CATEGORY_EMOJI[p.category ?? ""] ?? "📍"}</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailPlace(p)}>
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

      <PlaceSwiperDetail
        open={detailPlace !== null}
        onOpenChange={(v) => { if (!v) setDetailPlace(null); }}
        place={detailPlace ? {
          id: detailPlace.place_id ?? detailPlace.id,
          place_name: detailPlace.place_name,
          category: detailPlace.category,
          city: detailPlace.city,
          address: "",
          latitude: detailPlace.latitude ?? 0,
          longitude: detailPlace.longitude ?? 0,
          rating: 0,
          photo_url: detailPlace.photo_url ?? "",
          vibe_tags: [],
          description: "",
        } : null}
        city={detailPlace?.city}
        onLike={() => setDetailPlace(null)}
        onSkip={() => setDetailPlace(null)}
      />
    </div>
  );
};

export default SwipeHistory;
