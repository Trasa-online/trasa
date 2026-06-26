import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MapPin, Heart, Trash2, ArrowRight, Plus, ArrowLeft, Pencil, ListChecks } from "lucide-react";
import { parseISO, isValid, format, isToday, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { getHistoryByCity, removeLikeFromCity, clearCity, type ExploreCityGroup } from "@/lib/exploreLikes";
import { getSubcategoryLabel, MAIN_CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Usuwa reactions z DB dla zalogowanego usera zeby miejsca wrocily do swipera
// (PlaceSwiper filtruje queue po user_place_reactions). Bez tego po usunieciu
// polubienia z localStorage, miejsce nadal jest "polubione" w DB i swiper je pomija.
// Best-effort - failure (np. RLS, brak siec) nie blokuje UI flow.
async function removeReactionsFromDb(userId: string, city: string, placeNames: string[]) {
  if (!placeNames.length) return;
  try {
    await (supabase as any)
      .from("user_place_reactions")
      .delete()
      .eq("user_id", userId)
      .ilike("city", city)
      .in("place_name", placeNames);
  } catch (err) {
    console.warn("[Explore] removeReactionsFromDb failed:", err);
  }
}

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

export const LikedTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  // Force re-render after mutations + przy fokusie na tab (lajki dodawane w PlaceSwiper
  // przez localStorage - useEffect ponizej odswieza nonce gdy user wraca do tab).
  const [nonce, setNonce] = useState(0);
  const refresh = () => setNonce((n) => n + 1);

  // Refresh przy mount + visibilitychange (gdy user wraca z innego tab w przegladarce
  // albo z innego ekranu w aplikacji). localStorage nie ma natywnego eventu w tej
  // samej zakladce, ale focus/visibility lapie powrot.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const groups = useMemo<ExploreCityGroup[]>(() => {
    // Zestawienie per MIASTO (nie per dzien). Najwiecej polubien na gorze.
    return getHistoryByCity().sort((a, b) => b.places.length - a.places.length);
  }, [nonce]);

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

  const handleCreateRoute = (group: ExploreCityGroup) => {
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
        <div key={group.city} className="rounded-3xl bg-card border border-border/50 overflow-hidden">
          {/* Header - miasto */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
                {group.city}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {group.places.length} {group.places.length === 1 ? "polubione miejsce" : group.places.length < 5 ? "polubione miejsca" : "polubionych miejsc"}
              </p>
            </div>
            <button
              onClick={() => {
                if (!confirm(`Usunąć wszystkie polubione z ${group.city}?`)) return;
                const placeNames = group.places.map(p => p.place_name);
                clearCity(group.city);
                if (user?.id) void removeReactionsFromDb(user.id, group.city, placeNames);
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
                  onClick={() => {
                    removeLikeFromCity(group.city, p.place_name);
                    if (user?.id) void removeReactionsFromDb(user.id, group.city, [p.place_name]);
                    refresh();
                  }}
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
            <div className="px-4 py-3 border-t border-border/20 space-y-2">
              <button
                onClick={() => handleCreateRoute(group)}
                className="w-full py-2.5 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                Stwórz trasę z tych miejsc
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigate(`/zestawienie/nowe?from=liked&city=${encodeURIComponent(group.city)}`)}
                className="w-full py-2.5 rounded-full border border-orange-600 text-orange-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                Stwórz zestawienie z tych miejsc
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── MyCollections ───────────────────────────────────────────────────────────
// Lista zestawien stworzonych przez zalogowanego usera (wejscie z karty "Zestawienia"
// w profilu). Tap w pozycje -> edycja. Pusty stan -> CTA "Stworz pierwsze".
const MyCollections = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["my-collections", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, is_public")
        .eq("user_id", user!.id)
        .eq("kind", "ranking")
        .order("updated_at", { ascending: false });
      if (!cols?.length) return [] as any[];
      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("collection_id, photo_url")
        .in("collection_id", ids);
      return cols.map((c: any) => {
        const own = (items ?? []).filter((i: any) => i.collection_id === c.id);
        return { ...c, count: own.length, cover: own.find((i: any) => i.photo_url)?.photo_url ?? null };
      });
    },
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-3xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-orange-50/40 flex flex-col items-center text-center gap-3 px-6 py-10">
          <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <ListChecks className="h-6 w-6 text-orange-600" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-black">Brak zestawień</p>
            <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
              Stwórz swoją pierwszą kolekcję ulubionych miejsc i&nbsp;podziel się nią z&nbsp;innymi.
            </p>
          </div>
          <button
            onClick={() => navigate("/zestawienie/nowe")}
            className="mt-1 px-5 py-3 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
          >
            Stwórz zestawienie
          </button>
        </div>
      ) : (
        collections.map((col: any) => (
          <button
            key={col.id}
            onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)}
            className="w-full flex items-center gap-3 rounded-3xl bg-card border border-border/50 p-3 text-left active:scale-[0.99] transition-transform"
          >
            {col.cover ? (
              <img src={col.cover} alt={col.title} className="h-16 w-16 rounded-2xl object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center shrink-0">
                <ListChecks className="h-6 w-6 text-orange-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight truncate">{col.title || "Bez tytułu"}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {[col.city, `${col.count} ${col.count === 1 ? "miejsce" : col.count < 5 ? "miejsca" : "miejsc"}`].filter(Boolean).join(" · ")}
                {col.is_public === false ? " · prywatne" : ""}
              </p>
            </div>
            <Pencil className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>
        ))
      )}
    </div>
  );
};

// Polubione przeniesione na /home (ikona serca). Eksploruj = sam feed polecanych.
const Explore = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  // Wejscie z profilu (karta "Zestawienia") -> pokaz liste zestawien usera zamiast feedu.
  const myCollections = (location.state as any)?.myCollections === true;

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="flex-1 flex flex-col pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <div className="px-4 pb-3 mb-3 flex items-start justify-between gap-3 border-b border-border/40">
        {myCollections ? (
          <div className="flex items-center gap-2.5 pt-2">
            <button
              onClick={() => navigate("/eksploruj", { replace: true, state: null })}
              className="h-9 w-9 -ml-1 flex items-center justify-center text-foreground shrink-0"
              aria-label="Wróć do eksploracji"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-display font-extrabold tracking-tight">Twoje zestawienia</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Kolekcje miejsc, które stworzyłeś.</p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-display font-extrabold tracking-tight pt-2">Eksploruj</h1>
            <p className="text-xs text-muted-foreground mt-1">Polecane miejsca, trasy i&nbsp;zestawienia.</p>
          </div>
        )}
        <button
          onClick={() => navigate("/zestawienie/nowe")}
          className="shrink-0 mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary text-white text-xs font-bold active:scale-[0.97] transition-transform shadow-sm shadow-orange-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Zestawienie
        </button>
      </div>

      <div className="flex-1 px-4">
        {myCollections ? <MyCollections /> : <DiscoveryFeed />}
      </div>
    </PullToRefresh>
  );
};

export default Explore;
