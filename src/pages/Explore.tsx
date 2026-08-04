import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MapPin, Heart, Trash2, ArrowRight, ArrowLeft, Pencil, ListChecks, ChevronDown, Check, Search, X, Layers, Compass, Bookmark } from "lucide-react";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { fetchEnrichedPlace, type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { parseISO, isValid, format, isToday, isYesterday } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import HomeHeaderActions from "@/components/home/HomeHeaderActions";
import ExploreTopBar from "@/components/home/ExploreTopBar";
import TabTopBar from "@/components/layout/TabTopBar";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UNLOCKED_CITIES } from "@/components/plan-wizard/CityPicker";
import { getHistoryByCity, removeLikeFromCity, addLike, clearCity, updateLikePhoto, type ExploreCityGroup } from "@/lib/exploreLikes";
import { deferDelete } from "@/lib/deferDelete";
import { getSubcategoryLabel, subcategoryLabelLocalized } from "@/lib/categories";
import { getPhotoUrl } from "@/lib/placePhotos";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { PLANNING_DISABLED, GOOGLE_PLACE_DETAILS_DISABLED } from "@/lib/appMode";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

// Tworzenie zestawien odblokowane. Klik rejestrujemy w PostHog (funnel intent -> publikacja).
const trackCollectionCreate = (source: string) => {
  posthog.capture("collection_create_clicked", { source });
};

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


function formatGroupDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  if (isToday(d)) return "Dzisiaj";
  if (isYesterday(d)) return "Wczoraj";
  return format(d, "d MMMM yyyy", { locale: dateLocale() });
}

// Cache rozwiazanych zdjec (per sesja) - unika ponownych fetchy Google dla tego samego miejsca
// przy re-renderach/przelaczaniu filtrow. Persist do localStorage robi updateLikePhoto.
const resolvedThumbCache = new Map<string, string>();
const thumbInFlight = new Set<string>();

// Miniaturka zapisanego miejsca. Gdy like ma photo_url -> pokazuje od razu. Gdy NULL (miasta bez
// cache, np. Wroclaw - zdjecia tylko z Google w locie) -> lazy fetch z proxy, cache + backfill do
// localStorage, wiec kolejne wejscia sa juz z gotowa miniaturka (jednorazowy koszt per miejsce).
const SavedThumb = ({ p }: { p: any }) => {
  const [url, setUrl] = useState<string | null>(p.photo_url ?? null);

  useEffect(() => {
    if (p.photo_url) { setUrl(p.photo_url); return; }
    const key = `${p.city}:${p.place_name}`.toLowerCase();
    const cached = resolvedThumbCache.get(key);
    if (cached) { setUrl(cached); return; }
    if (!p.latitude || !p.longitude || thumbInFlight.has(key)) return;
    // Cięcie kosztów: nie wołamy płatnego Place Details tylko po miniaturkę. Zapisane
    // miejsca zwykle mają już photo_url; brakujące pokazują fallback (emoji/gradient).
    if (GOOGLE_PLACE_DETAILS_DISABLED) return;
    thumbInFlight.add(key);
    let cancelled = false;
    supabase.functions
      .invoke("google-places-proxy", { body: { placeName: p.place_name, latitude: p.latitude, longitude: p.longitude } })
      .then(({ data, error }: any) => {
        thumbInFlight.delete(key);
        if (error || !data?.result) return;
        const ref = data.result.photos?.[0]?.photo_reference;
        const resolved = ref ? getPhotoUrl(ref, 300, data.result.place_id) : null;
        if (!resolved) return;
        resolvedThumbCache.set(key, resolved);
        updateLikePhoto(p.city, p.place_name, resolved); // backfill na stale
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => { thumbInFlight.delete(key); });
    return () => { cancelled = true; };
  }, [p.photo_url, p.city, p.place_name, p.latitude, p.longitude]);

  if (url) return <img src={url} alt={p.place_name} className="w-full h-full object-cover" loading="lazy" />;
  // Empty-state: ikona kategorii na tle #fcede3 (zero Google, brak zdjecia usera).
  return (
    <div className="w-full h-full bg-[#fcede3] flex items-center justify-center">
      <img src={categoryIconSrc(p.category)} alt="" className="w-1/5 max-w-[32px] opacity-90" draggable={false} />
    </div>
  );
};

export const LikedTab = ({ selectMode = false, onExitSelection, city: controlledCity }: { selectMode?: boolean; onExitSelection?: () => void; city?: string } = {}) => {
  const { t } = useTranslation("explore");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  // Szczegol miejsca (pelna wizytowka) - tap w kafelek poza trybem zaznaczania.
  // Ten sam komponent co w swiperze (PlaceSwiperDetail): hero, opinie, godziny, menu z zoomem,
  // wydarzenia. Bazowy MockPlace budujemy od razu (szybkie otwarcie), a gdy miejsce ma UUID -
  // doczytujemy pelny profil biznesu (menu/galeria/eventy) i podmieniamy.
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const openDetail = (p: any) => {
    const base = {
      id: p.place_id ?? p.place_name,
      place_name: p.place_name,
      category: p.category,
      city: p.city,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
      photo_url: p.photo_url ?? undefined,
      rating: p.rating ?? undefined,
      description: p.description ?? undefined,
      address: p.address ?? undefined,
    } as unknown as MockPlace;
    setDetailPlace(base);
    if (p.place_id && UUID_RE.test(p.place_id)) {
      void fetchEnrichedPlace(p.place_id, todayStr).then((enriched) => {
        if (enriched) setDetailPlace((prev) => (prev && prev.id === base.id ? enriched : prev));
      });
    }
  };
  // Tryb zaznaczania: zbior wybranych nazw + zablokowane miasto (trasa = jedno miasto).
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [selectionCity, setSelectionCity] = useState<string | null>(null);
  // Wyjscie z trybu zaznaczania czysci wybor.
  useEffect(() => {
    if (!selectMode) { setSelectedNames(new Set()); setSelectionCity(null); }
  }, [selectMode]);
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
    return getHistoryByCity().sort((a, b) => b.places.length - a.places.length);
  }, [nonce]);

  // Wszystkie zapisane miejsca splaszczone (z miastem), najnowsze na gorze.
  const allPlaces = useMemo(
    () => groups.flatMap(g => g.places.map(p => ({ ...p, city: g.city })))
      .sort((a, b) => String(b.liked_at).localeCompare(String(a.liked_at))),
    [groups],
  );
  const cities = groups.map(g => g.city); // posortowane po liczbie polubien
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // Gdy wybrane miasto zniknie (usuniete ostatnie miejsce) - wroc na "Wszystkie".
  useEffect(() => {
    if (selectedCity !== "all" && !cities.includes(selectedCity)) setSelectedCity("all");
  }, [cities, selectedCity]);

  // Miasto sterowane z zewnatrz (naglowek Zapisanych) ma priorytet. "all" == wszystkie.
  const effectiveCity = controlledCity !== undefined ? controlledCity : selectedCity;
  const byCity = effectiveCity === "all"
    ? allPlaces
    : allPlaces.filter(p => (p.city ?? "").toLowerCase() === effectiveCity.toLowerCase());
  // Filtr po kategorii miejsca - MULTI-SELECT. Chipy z kategorii obecnych w zapisanych (per miasto).
  // Pusty zbior = wszystkie; inaczej pokazujemy miejsca z KTOREJKOLWIEK zaznaczonej kategorii.
  const availableCategories = Array.from(new Set(byCity.map(p => p.category).filter(Boolean))) as string[];
  const activeCats = new Set([...selectedCategories].filter(c => availableCategories.includes(c)));
  const byCat = activeCats.size === 0 ? byCity : byCity.filter(p => p.category && activeCats.has(p.category));
  const toggleCat = (cat: string) => setSelectedCategories(prev => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });
  const q = searchQuery.trim().toLowerCase();
  const visible = q
    ? byCat.filter(p => p.place_name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))
    : byCat;
  const totalLikes = allPlaces.length;

  // Usuwanie zapisanego miejsca z oknem "Cofnij" (deferDelete): znika od razu z listy,
  // DB reaction usuwana z odroczeniem; "Cofnij" przywraca wpis (re-add do localStorage).
  const handleRemove = (p: any) => {
    removeLikeFromCity(p.city, p.place_name);
    refresh();
    deferDelete({
      message: t("liked.removed", { defaultValue: "Usunięto z zapisanych" }),
      onUndo: () => {
        addLike(p.city, {
          place_name: p.place_name, category: p.category, place_id: p.place_id ?? null,
          latitude: p.latitude ?? null, longitude: p.longitude ?? null,
          photo_url: p.photo_url ?? null, address: p.address ?? null,
          rating: p.rating ?? null, description: p.description ?? null,
        });
        refresh();
      },
      commit: () => { if (user?.id) void removeReactionsFromDb(user.id, p.city, [p.place_name]); },
    });
  };

  if (totalLikes === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Bookmark className="h-9 w-9 text-muted-foreground" strokeWidth={2} />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-bold tracking-tight">{t("liked.empty_title")}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            {t("liked.empty_desc")}
          </p>
        </div>
        <button
          onClick={() => navigate("/plan", { state: { exploreMode: true } })}
          className="px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Compass className="h-4 w-4" />
          {t("liked.browse")}
        </button>
      </div>
    );
  }

  // Toggle zaznaczenia miejsca. Pierwsze zaznaczenie blokuje miasto - kolejne
  // miejsca z innego miasta sa niedostepne (trasa powstaje z jednego miasta).
  const toggleSelect = (p: { city: string; place_name: string }) => {
    if (selectionCity && p.city !== selectionCity) {
      toast.info(t("liked.other_city_locked", { city: selectionCity }));
      return;
    }
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(p.place_name)) next.delete(p.place_name);
      else next.add(p.place_name);
      // Ostatnie odznaczenie zwalnia blokade miasta.
      if (next.size === 0) setSelectionCity(null);
      else if (!selectionCity) setSelectionCity(p.city);
      return next;
    });
  };

  const handleBuildFromSelection = async () => {
    if (!selectionCity || selectedNames.size === 0) return;
    if (!user) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    const chosen = allPlaces.filter(p => p.city === selectionCity && selectedNames.has(p.place_name));
    onExitSelection?.();
    if (PLANNING_DISABLED) {
      // Tryb uproszczony: z zaznaczonych zapisanych tworzymy od razu WYJAZD (bez planowania).
      const id = await createWyjazdFromPlaces(user.id, selectionCity, selectionCity, chosen.map(p => ({
        place_name: p.place_name,
        category: p.category,
        address: (p as any).address ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        photo_url: p.photo_url ?? null,
        place_id: (p as any).place_id ?? null,
      })));
      if (id) navigate(`/review-summary?route=${id}&edit=1`);
      return;
    }
    navigate("/plan", { state: { step: 3, city: selectionCity, date: new Date().toISOString(), likedPlaceNames: chosen.map(p => p.place_name) } });
  };

  return (
    <div className="flex flex-col">
      {/* Pigulki miast - TYLKO w trybie niesterowanym. Gdy miasto pochodzi z naglowka
          (Zapisane), chowamy je (nie dublujemy selektora). */}
      {controlledCity === undefined && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 -mx-1 px-1">
          <button
            onClick={() => setSelectedCity("all")}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${selectedCity === "all" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border/60"}`}
          >
            {t("liked.all_cities")}
          </button>
          {cities.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors whitespace-nowrap ${selectedCity === city ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border/60"}`}
            >
              {city}
            </button>
          ))}
        </div>
      )}

      {/* Waska wyszukiwarka - filtruje po nazwie/opisie. */}
      <div className="pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("liked.search_placeholder")}
            className="w-full h-9 pl-9 pr-9 rounded-full bg-muted/60 border border-border/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition"
              aria-label={t("liked.search_clear")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filtr kategorii - chipy z kategorii obecnych w zapisanych (pokazuj gdy >1 kategoria). */}
      {availableCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 -mx-1 px-1">
          <button
            onClick={() => setSelectedCategories(new Set())}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${activeCats.size === 0 ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border/60"}`}
          >
            Wszystkie
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${activeCats.has(cat) ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border/60"}`}
            >
              {subcategoryLabelLocalized(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Hint trybu zaznaczania: trasa z jednego miasta */}
      {selectMode && (
        <div className="pb-3">
          <p className="text-xs text-muted-foreground bg-muted/60 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 shrink-0" />
            {t("liked.one_city_hint")}
          </p>
        </div>
      )}

      {/* Lista miejsc - jedno pod drugim (miniaturka + naglowek + opis 2 linie + tagi + ocena Google) */}
      <div className={cn("flex flex-col", selectMode && selectedNames.size > 0 && "pb-40")}>
        {visible.map((p) => {
          const checked = selectMode && selectedNames.has(p.place_name);
          const locked = selectMode && !!selectionCity && p.city !== selectionCity;
          const savedD = (p as any).liked_at ? parseISO((p as any).liked_at) : null;
          const savedLabel = savedD && isValid(savedD) ? format(savedD, "d MMM yyyy", { locale: dateLocale() }) : null;
          return (
          <div
            key={`${p.city}:${p.place_name}`}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(p)}
            className={cn(
              "flex gap-3 py-4 border-b border-border/15 -mx-2 px-2 rounded-2xl cursor-pointer active:bg-muted/40 transition-colors",
              locked && "opacity-40",
              selectMode && "border border-transparent",
              checked && "bg-primary/5 border-primary/30",
            )}
          >
            <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-muted shrink-0">
              <SavedThumb p={p} />
              {selectMode && (
                // Checkbox = osobny cel z powiekszonym hit-area (p-2.5). Kafel otwiera wizytowke,
                // dopiero tap w checkbox zaznacza (stopPropagation).
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(p); }}
                  aria-label="Zaznacz miejsce"
                  className="absolute top-0 left-0 p-2.5 z-10"
                >
                  <span className={cn(
                    "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm",
                    checked ? "bg-primary border-primary" : "bg-black/40 border-white/90 backdrop-blur-sm",
                  )}>
                    {checked && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                  </span>
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {/* Badge kategorii NAD nazwa (bez badge miasta) */}
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium border border-border/40">{subcategoryLabelLocalized(p.category)}</span>
                  <p className="text-sm font-bold leading-tight mt-1">{p.place_name}</p>
                </div>
                {!selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                    className="h-7 w-7 -mt-1 -mr-1 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 shrink-0"
                    aria-label={t("liked.remove_aria")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{p.description}</p>
              )}
              {savedLabel && (
                <div className="mt-2">
                  <span className="text-[11px] text-muted-foreground/70 min-w-0 truncate">Zapisano {savedLabel}</span>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Szczegol miejsca - pelna wizytowka (jak w swiperze). Bez CTA Like/Skip (brak onLike/onSkip). */}
      <PlaceSwiperDetail
        open={!!detailPlace}
        place={detailPlace}
        city={detailPlace?.city}
        referenceDate={todayStr}
        onOpenChange={(open) => !open && setDetailPlace(null)}
      />

      {/* Pasek akcji trybu zaznaczania - utworz trase z wybranych (jedno miasto) */}
      {selectMode && selectedNames.size > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] z-30 px-4">
          <button
            onClick={handleBuildFromSelection}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-transform"
          >
            {t("liked.build_route")}
            <span className="opacity-80">·</span>
            {t("liked.selected_count", { count: selectedNames.size })}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ── MyCollections ───────────────────────────────────────────────────────────
// Lista zestawien stworzonych przez zalogowanego usera (wejscie z karty "Zestawienia"
// w profilu / zakladka Zapisane). Tap w pozycje -> edycja. Pusty stan -> CTA "Stworz pierwsze".
export const MyCollections = () => {
  const { t } = useTranslation("explore");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Potwierdzenie usuniecia zestawienia (nieodwracalne -> walidacja "czy na pewno?").
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete || !user) return;
    setDeleting(true);
    try {
      await (supabase as any).from("discovery_items").delete().eq("collection_id", confirmDelete.id);
      const { error } = await (supabase as any).from("discovery_collections").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      toast.success(t("collections.toast_deleted"));
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["my-collections", user.id] });
    } catch (e: any) {
      toast.error(t("collections.toast_delete_error", { error: e?.message ?? t("collections.error_fallback") }));
    } finally {
      setDeleting(false);
    }
  };

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["my-collections", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, is_public, moderation_status, moderation_note")
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
            <p className="text-base font-black">{t("collections.empty_title")}</p>
            <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
              {t("collections.empty_desc")}
            </p>
          </div>
          <button
            onClick={() => { trackCollectionCreate("my_collections_empty"); navigate("/zestawienie/nowe"); }}
            className="mt-1 px-5 py-3 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
          >
            {t("collections.create")}
          </button>
        </div>
      ) : (
        collections.map((col: any) => (
          <div
            key={col.id}
            className="w-full flex items-center gap-3 rounded-3xl bg-card border border-border/50 p-3"
          >
            <button
              onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
            >
              {col.cover ? (
                <img src={col.cover} alt={col.title} className="h-16 w-16 rounded-2xl object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center shrink-0">
                  <ListChecks className="h-6 w-6 text-orange-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight truncate">{col.title || t("collections.untitled")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {[col.city, `${col.count} ${col.count === 1 ? t("collections.place_one") : col.count < 5 ? t("collections.place_few") : t("collections.place_many")}`].filter(Boolean).join(" · ")}
                  {col.is_public === false ? ` · ${t("collections.private")}` : ""}
                </p>
                {col.moderation_status === "pending" && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    ⏳ {t("collections.pending")}
                  </span>
                )}
                {col.moderation_status === "rejected" && (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                      {t("collections.rejected")}
                    </span>
                    {col.moderation_note && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug whitespace-pre-wrap">{t("collections.reason", { note: col.moderation_note })}</p>
                    )}
                  </div>
                )}
              </div>
            </button>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)}
                aria-label={t("collections.edit_aria")}
                className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground/60 active:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setConfirmDelete({ id: col.id, title: col.title || t("collections.untitled") })}
                aria-label={t("collections.delete_aria")}
                className="h-9 w-9 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Potwierdzenie usuniecia (nieodwracalne) */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black leading-snug">{t("collections.delete_title")}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("collections.delete_desc", { title: confirmDelete.title })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {t("collections.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-full bg-destructive text-white text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {deleting ? t("collections.deleting") : t("collections.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Polubione przeniesione na /home (ikona serca). Eksploruj = sam feed polecanych.
const Explore = () => {
  const { t } = useTranslation("explore");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  // Wejscie z profilu (karta "Zestawienia") -> pokaz liste zestawien usera zamiast feedu.
  const myCollections = (location.state as any)?.myCollections === true;
  // Selektor miasta w naglowku (zastapil tytul "Eksploruj"). Miasto niesione przy
  // przelaczaniu z/do Przegladaj (location.state), inaczej default "all" = WSZYSTKIE trasy
  // (bez filtra miasta). Dopiero po kliknieciu selektora user wybiera konkretne miasto.
  // Widok Miejsc pod "all" pokazuje wszystkie miejsca (PlaceSwiper pomija filtr miasta).
  const [exploreCity, setExploreCity] = useState<string>((location.state as any)?.city || "all");
  // Miasta ktore realnie maja trasy w eksploracji (do selektora, obok "Wszystkie").
  // Bramka jak w feedzie: is_shared + list_cover_url != null. Distinct po stronie klienta.
  const { data: routeCities = [] } = useQuery({
    queryKey: ["explore-route-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("city")
        .eq("is_shared", true)
        .not("title", "is", null)
        .not("list_cover_url", "is", null)
        .not("city", "is", null);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => { if (r.city) set.add(r.city as string); });
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
    },
    staleTime: 60_000,
  });
  // Licznik aktywnych filtrow (badge na guziku filtra w gornej belce). DiscoveryFeed
  // trzyma stan filtrow i raportuje liczbe przez event; belka jest o poziom wyzej.
  const [filterCount, setFilterCount] = useState(0);
  useEffect(() => {
    const onCount = (e: any) => setFilterCount(typeof e.detail === "number" ? e.detail : 0);
    window.addEventListener("trasa:explore-filter-count", onCount);
    return () => window.removeEventListener("trasa:explore-filter-count", onCount);
  }, []);
  // Toggle feed<->swiper LOKALNY (seamless). "browse" = swiper (dawne /plan exploreMode).
  const [view, setView] = useState<"feed" | "browse">((location.state as any)?.view === "browse" ? "browse" : "feed");
  // Swiper montujemy po pierwszym przejsciu i zostaje (kolejne przelaczenia natychmiastowe).
  const [hasBrowsed, setHasBrowsed] = useState(view === "browse");
  useEffect(() => { if (view === "browse") setHasBrowsed(true); }, [view]);
  // Wyszukiwarka w gornej belce: domyslnie zwinieta (lupa). Klik lupy -> pelna szerokosc.
  // Klik "x" -> powrot do domyslnej belki + wyczyszczenie zapytania. Stan trzymamy tu
  // (o poziom wyzej niz DiscoveryFeed), bo input renderuje sie w belce a wyniki w feedzie.
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedSearch, setFeedSearch] = useState("");
  const openSearch = () => { setView("feed"); setSearchOpen(true); };
  const closeSearch = () => { setSearchOpen(false); setFeedSearch(""); };
  // "Biezace polozenie" (DiscoveryFeed) -> przejdz na widok Miejsc posortowany od najblizszego.
  // Nonce rosnie z kazdym klikiem, zeby ExploreSwiper reagowal takze na ponowne klikniecie.
  const [nearbyNonce, setNearbyNonce] = useState(0);
  useEffect(() => {
    const h = () => { setSearchOpen(false); setFeedSearch(""); setView("browse"); setNearbyNonce((n) => n + 1); };
    window.addEventListener("trasa:explore-nearby", h);
    return () => window.removeEventListener("trasa:explore-nearby", h);
  }, []);
  // BottomNav (glassmorficzny) widoczny w OBU widokach - Miejsca (swiper) i Trasy (feed) -
  // dla spojnosci wg redesignu 2026-07-24. Ukrywamy tylko gdy szukamy (pelny ekran wynikow).
  // Karta swipera w exploreMode ma pb chroniace przed BottomNavem (patrz CLAUDE.md PlaceSwiper).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: searchOpen }));
  }, [view, searchOpen]);
  // Przy wyjsciu z Eksploracji zawsze przywroc BottomNav.
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Wspoldzielona belka (TabTopBar) - identyczna wysokosc 1:1 z Wyjazdy/Zapisane. */}
      <TabTopBar>
        {searchOpen && !myCollections ? (
          // Rozwinieta wyszukiwarka na CALA SZEROKOSC belki (lupa + input + "x").
          <div className="flex-1 flex items-center gap-2.5 px-4 h-10 rounded-full bg-muted/70 border border-border/50 min-w-0 focus-within:border-orange-400/60 focus-within:bg-background transition-colors">
            <Search className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              placeholder="Szukaj tras, miejsc na trasie..."
              className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <button
              onClick={closeSearch}
              aria-label="Zamknij wyszukiwanie"
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted active:scale-90 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : myCollections ? (
          <>
            <button
              onClick={() => { if (window.history.state?.idx > 0) navigate(-1); else navigate("/moj-profil"); }}
              className="h-9 w-9 -ml-1 flex items-center justify-center text-foreground shrink-0"
              aria-label={t("explore.back_aria")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{t("explore.collections_title")}</h1>
          </>
        ) : (
          <ExploreTopBar
            mode={view === "browse" ? "browse" : "explore"}
            city={exploreCity}
            cities={routeCities}
            onCityChange={setExploreCity}
            onModeChange={(m) => setView(m === "browse" ? "browse" : "feed")}
            onBack={() => setView("feed")}
            onOpenFilters={() => window.dispatchEvent(new CustomEvent("trasa:explore-open-filters"))}
            onOpenSearch={openSearch}
            activeFilterCount={filterCount}
          />
        )}
      </TabTopBar>

      {myCollections ? (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 min-h-0 flex flex-col pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex-1 px-4"><MyCollections /></div>
        </PullToRefresh>
      ) : (
        <>
          {/* Feed - zawsze zamontowany; ukryty gdy swiper (seamless toggle). */}
          <div className={cn("flex-1 min-h-0 flex flex-col", view !== "feed" && "hidden")}>
            {/* Snap tylko w trybie przegladania feedu. Przy wyszukiwaniu WYLACZAMY snap, zeby
                skroty/wyniki na gorze byly widoczne, a wizytowki zostawaly przewijalne pod spodem. */}
            <PullToRefresh onRefresh={handleRefresh} className={cn("flex-1 min-h-0 flex flex-col pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]", !searchOpen && "snap-y snap-mandatory scroll-pt-3")}>
              <div className="flex-1 px-4"><DiscoveryFeed city={exploreCity} active={view === "feed"} searchQuery={feedSearch} searchOpen={searchOpen} /></div>
            </PullToRefresh>
          </div>
          {/* Swiper - montowany po pierwszym przejsciu, potem zostaje (natychmiastowy toggle). */}
          {hasBrowsed && (
            <div className={cn("flex-1 min-h-0 flex flex-col", view !== "browse" && "hidden")}>
              <ExploreSwiper city={exploreCity} active={view === "browse"} sortNearestNonce={nearbyNonce} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Explore;
