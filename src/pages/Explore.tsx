import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Heart, Trash2, ArrowRight, Compass } from "lucide-react";
import { parseISO, isValid, format, isToday, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { getHistory, removeLike, clearGroup, type ExploreLikeGroup } from "@/lib/exploreLikes";
import { getSubcategoryLabel, MAIN_CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { cn } from "@/lib/utils";

type Tab = "feed" | "liked";

const CATEGORY_EMOJI: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  MAIN_CATEGORIES.forEach(cat => cat.subcategories.forEach(sub => { map[sub.id] = sub.emoji; }));
  return map;
})();

function formatGroupDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  if (isToday(d)) return "Dzisiaj";
  if (isYesterday(d)) return "Wczoraj";
  return format(d, "d MMMM yyyy", { locale: pl });
}

const LikedTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  // Force re-render after mutations
  const [, setNonce] = useState(0);
  const refresh = () => setNonce((n) => n + 1);

  const groups = useMemo<ExploreLikeGroup[]>(() => {
    // Sort by date descending (most recent first)
    return [...getHistory()].sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalLikes = groups.reduce((sum, g) => sum + g.places.length, 0);

  if (totalLikes === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <Heart className="h-7 w-7 text-orange-600" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-bold tracking-tight">Brak polubionych miejsc</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            Wracaj na główną i&nbsp;przeglądaj miejsca. Te&nbsp;które polubisz pojawią się tutaj.
          </p>
        </div>
        <button
          onClick={() => navigate("/home")}
          className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-transform shadow-md shadow-orange-500/20"
        >
          Przeglądaj miejsca
        </button>
      </div>
    );
  }

  const handleCreateRoute = (group: ExploreLikeGroup) => {
    if (!user) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    navigate("/plan", {
      state: {
        step: 3,
        city: group.city,
        date: new Date().toISOString(),
        likedPlaceNames: group.places.map((p) => p.place_name),
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={`${group.date}-${group.city}`} className="rounded-3xl bg-card border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight">{formatGroupDate(group.date)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{group.city}</span>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{group.places.length} {group.places.length === 1 ? "miejsce" : group.places.length < 5 ? "miejsca" : "miejsc"}</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (!confirm(`Usunąć wszystkie polubione z ${formatGroupDate(group.date).toLowerCase()} (${group.city})?`)) return;
                clearGroup(group.date, group.city);
                refresh();
              }}
              className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 shrink-0"
              aria-label="Usuń grupę"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Places list */}
          <div className="flex flex-col">
            {group.places.map((p) => (
              <div
                key={p.place_name}
                className="flex items-center gap-3 px-4 py-2.5 border-t border-border/20"
              >
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.place_name} className="h-11 w-11 rounded-xl object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center text-lg shrink-0">
                    {CATEGORY_EMOJI[p.category] ?? "📍"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">{p.place_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {getSubcategoryLabel(p.category) ?? p.category}
                  </p>
                </div>
                <button
                  onClick={() => { removeLike(group.date, group.city, p.place_name); refresh(); }}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 shrink-0"
                  aria-label="Usuń"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* CTA */}
          {group.places.length > 0 && (
            <div className="px-4 py-3 border-t border-border/20">
              <button
                onClick={() => handleCreateRoute(group)}
                className="w-full py-2.5 rounded-full bg-foreground text-background font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                Stwórz trasę z tych miejsc
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const Explore = () => {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="flex-1 flex flex-col pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <div className="px-4 mb-3">
        <h1 className="text-xl font-black tracking-tight pt-2">Eksploruj</h1>
        <p className="text-xs text-muted-foreground mt-1">Polecane miejsca, trasy i&nbsp;Twoje polubione.</p>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex rounded-2xl bg-muted p-1">
          <button
            onClick={() => setTab("feed")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-2xl transition-all",
              tab === "feed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Compass className="h-4 w-4" />
            Polecane
          </button>
          <button
            onClick={() => setTab("liked")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-2xl transition-all",
              tab === "liked" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Heart className="h-4 w-4" />
            Polubione
          </button>
        </div>
      </div>

      <div className="flex-1 px-4">
        {tab === "feed" ? <DiscoveryFeed /> : <LikedTab />}
      </div>
    </div>
  );
};

export default Explore;
