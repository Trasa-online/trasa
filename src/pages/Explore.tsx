import { useMemo, useState, useEffect, useRef } from "react";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { PullToRefresh } from "@/components/PullToRefresh";
import { haptics } from "@/hooks/useHaptics";
import { track } from "@/lib/analytics";
import { MapPin, Heart, Trash2, ArrowRight, ArrowLeft, Pencil, ListChecks, ChevronDown, ChevronRight, Check, Search, X, Layers, Compass, Bookmark, Plus, Folder, FileText, Users } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { fetchEnrichedPlace, type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { resolveStored } from "@/components/PlacePhoto";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc } from "@/lib/avatar";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { parseISO, isValid, format, isToday, isYesterday } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import HomeHeaderActions from "@/components/home/HomeHeaderActions";
import ExploreTopBar from "@/components/home/ExploreTopBar";
import TabTopBar from "@/components/layout/TabTopBar";
import ActiveTripBanner from "@/components/home/ActiveTripBanner";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UNLOCKED_CITIES } from "@/components/plan-wizard/CityPicker";
import { getHistoryByCity, removeLikeFromCity, addLike, clearCity, updateLikePhoto, type ExploreCityGroup } from "@/lib/exploreLikes";
import { deferDelete } from "@/lib/deferDelete";
import { getSubcategoryLabel, subcategoryLabelLocalized } from "@/lib/categories";
import { inferCategoryFromName } from "@/lib/placeCategoryIcon";
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
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
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

      {/* Szczegol miejsca - pelna wizytowka (jak w swiperze), z zapisem miejsca do listy. */}
      <PlaceSwiperDetail
        open={!!detailPlace}
        place={detailPlace}
        city={detailPlace?.city}
        referenceDate={todayStr}
        onOpenChange={(open) => !open && setDetailPlace(null)}
        onLike={detailPlace ? () => setSavePlace({
          place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
          city: detailPlace.city || null, latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
          photo_url: detailPlace.photo_url || null, place_id: null,
        }) : undefined}
      />
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={savePlace?.city ?? ""} />

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
export const MyCollections = ({ showCreate = true }: { showCreate?: boolean } = {}) => {
  const { t } = useTranslation("explore");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Potwierdzenie usuniecia zestawienia (nieodwracalne -> walidacja "czy na pewno?").
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const confirmDrag = useDragToDismiss({ onDismiss: () => setConfirmDelete(null) });
  const [deleting, setDeleting] = useState(false);
  // Accordion: ktora lista jest rozwinieta (podglad miejsc). Null = wszystkie zwiniete.
  const [expanded, setExpanded] = useState<string | null>(null);
  // Wizytowka miejsca z podgladu (tap w wiersz) - jak w SharedList.
  const [detailPin, setDetailPin] = useState<{ place: MockPlace; city: string | null; skip: boolean } | null>(null);
  // Zapis miejsca z wizytowki do wlasnych list (bookmark na hero + CTA na dole).
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);

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
        .select("id, title, city, description, is_public, moderation_status, moderation_note, cover_url, list_cover_url, list_status, author_avatar, author_name")
        .eq("user_id", user!.id)
        .eq("kind", "ranking")
        // Twoje listy = publiczne POLECAJKI (visited). Prywatne "Do zobaczenia" (to_visit) są
        // w Zapisane→Miejsca, nie tutaj.
        .eq("list_status", "visited")
        .order("updated_at", { ascending: false });
      if (!cols?.length) return [] as any[];
      const ids = cols.map((c: any) => c.id);
      // Pelne itemy do podgladu (accordion w stylu widoku trasy - RoutePlaceRow).
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, place_id, place_name, category, address, latitude, longitude, rating, google_place_id, photo_url, short_desc, order_index")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });
      return cols.map((c: any) => {
        const own = (items ?? []).filter((i: any) => i.collection_id === c.id);
        // Miniatura kafelka = miniatura eksploracji (list_cover_url) -> okladka listy (cover_url)
        // -> zdjecie pierwszego miejsca.
        const cover = c.list_cover_url ?? c.cover_url ?? own.find((i: any) => i.photo_url)?.photo_url ?? null;
        return { ...c, items: own, count: own.length, cover };
      });
    },
  });

  const openPlace = (pin: any, city: string | null) => setDetailPin({
    skip: !pin.place_id,
    city,
    place: {
      id: pin.place_id ?? pin.google_place_id ?? pin.place_name,
      place_name: pin.place_name, category: (pin.category ?? inferCategoryFromName(pin.place_name) ?? "other") as any,
      city: city ?? "", address: pin.address ?? "", latitude: pin.latitude ?? 0, longitude: pin.longitude ?? 0,
      rating: pin.rating ?? 0, photo_url: resolveStored(pin.photo_url) ?? "", vibe_tags: [], description: "",
    } as MockPlace,
  });
  const openGoogle = (pin: any, city: string | null) => {
    const q = encodeURIComponent([pin.place_name, pin.address, city].filter(Boolean).join(", "));
    const pid = typeof pin.google_place_id === "string" && pin.google_place_id.trim() ? `&query_place_id=${encodeURIComponent(pin.google_place_id.trim())}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${pid}`, "_blank", "noopener,noreferrer");
  };

  const countLabel = (n: number) => `${n} ${n === 1 ? t("collections.place_one") : n < 5 ? t("collections.place_few") : t("collections.place_many")}`;

  return (
    <div className="space-y-3">
      {/* Osobny guzik "Nowa lista" - wprost do tworzenia listy. Ukryty w hubie "Robocze"
          (showCreate=false), gdzie "+" tworzenia jest juz w naglowku (zbedny duplikat). */}
      {showCreate && (
        <button
          onClick={() => { trackCollectionCreate("my_collections_header"); navigate("/zestawienie/nowe"); }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-white text-sm font-bold active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("collections.create_new", "Nowa lista miejsc")}
        </button>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-3xl bg-muted/40 animate-pulse" />)}
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
        </div>
      ) : (
        (() => {
        // Blok listy (redesign 08): avatar + eyebrow statusu + tytul + siatka kafelkow miejsc.
        // Tap w blok -> pelny widok listy (/lista/:id). Kosz (usuwanie) w rogu.
        const renderCol = (col: any) => {
          const title = col.title || t("collections.untitled");
          const eyebrow = t("feed.recommend", "Odwiedzone");
          const initial = (col.author_name || title || "?").charAt(0).toUpperCase();
          return (
            <div key={col.id} className="relative">
              <button
                onClick={() => navigate(`/lista/${col.id}`)}
                className="w-full text-left block active:opacity-95 transition-opacity"
              >
                <div className="flex items-center gap-2.5 pr-8">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={avatarSrc(col.author_avatar)} className="object-cover bg-orange-100" />
                    <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-xs">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">{eyebrow}</p>
                    <p className="text-lg font-bold leading-tight line-clamp-1 text-foreground">{title}</p>
                  </div>
                </div>
                {col.items.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                    {col.items.slice(0, 6).map((it: any, i: number) => <PlaceTile key={it.id ?? i} tile={it} aspect="aspect-square" />)}
                  </div>
                )}
                {/* Status moderacji: "pending" NIE pokazywany userowi (straszy). Tylko rejected. */}
                {col.moderation_status === "rejected" && (
                  <span className="mt-2 inline-flex w-fit items-center text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-2 py-0.5">{t("collections.rejected")}</span>
                )}
              </button>
              <button
                onClick={() => setConfirmDelete({ id: col.id, title })}
                aria-label={t("collections.delete_aria")}
                className="absolute top-0 right-0 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/40 active:text-destructive active:scale-90 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        };
        return <div className="space-y-7">{collections.map(renderCol)}</div>;
        })()
      )}

      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => { if (!o) setDetailPin(null); }}
        place={detailPin?.place ?? null}
        city={detailPin?.city ?? ""}
        skipGoogleFetch={detailPin?.skip ?? false}
        onLike={detailPin?.place ? () => setSavePlace({
          place_name: detailPin.place.place_name, category: detailPin.place.category ?? null,
          address: detailPin.place.address || null, city: detailPin.city || null,
          latitude: detailPin.place.latitude ?? null, longitude: detailPin.place.longitude ?? null,
          photo_url: detailPin.place.photo_url || null, place_id: null,
        }) : undefined}
      />
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={savePlace?.city ?? ""} />

      {/* Potwierdzenie usuniecia (nieodwracalne) */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            {...confirmDrag.dragProps}
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
// ── Wyszukiwarka: kategorie (redesign wg Figmy "NEW - Eksploracja — wyszukiwarka") ──────
// Cztery karty 90px nad polem wyszukiwania. Aktywna: peachy tlo + pomaranczowa obwodka.
// "Wyjazdy" ma znak marki (spontaway), reszta ikony Lucide (regula z CLAUDE.md: tylko Lucide).
export type SearchCat = "all" | "lists" | "trips" | "places" | "people";

const SEARCH_CATS: { id: SearchCat; label: string; icon: "folder" | "file" | "brand" | "pin" | "people" }[] = [
  { id: "all", label: "Wszystko", icon: "folder" },
  { id: "lists", label: "Listy", icon: "file" },
  { id: "trips", label: "Wyjazdy", icon: "brand" },
  { id: "places", label: "Miejsca", icon: "pin" },
  { id: "people", label: "Ludzie", icon: "people" },
];

function SearchCategoryRow({ value, onChange }: { value: SearchCat; onChange: (c: SearchCat) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-3 pb-1 shrink-0">
      {SEARCH_CATS.map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => { haptics.selection(); onChange(c.id); }}
            aria-pressed={on}
            className="flex-1 min-w-0 flex flex-col items-center gap-1 active:scale-[0.97] transition-transform"
          >
            <span className={`w-full h-[76px] rounded-[10px] border flex items-center justify-center transition-colors ${on ? "border-[#F0A583] bg-orange-100/30" : "border-border bg-transparent"}`}>
              {c.icon === "brand" ? (
                <img src="/spontaway-symbol.png" alt="" className="h-6 w-[27px] object-contain" />
              ) : c.icon === "folder" ? (
                <Folder className={`h-6 w-6 ${on ? "text-[#F0A583]" : "text-foreground"}`} strokeWidth={1.8} />
              ) : c.icon === "file" ? (
                <FileText className="h-6 w-6 text-foreground" strokeWidth={1.8} />
              ) : c.icon === "people" ? (
                <Users className="h-6 w-6 text-foreground" strokeWidth={1.8} />
              ) : (
                <MapPin className="h-6 w-6 text-foreground" fill="currentColor" strokeWidth={0} />
              )}
            </span>
            <span className="text-xs font-medium text-foreground leading-4 truncate">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

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
        .eq("status", "published")
        .eq("hidden_by_admin", false)
        .not("title", "is", null)
        .not("list_cover_url", "is", null)
        .not("city", "is", null);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => { if (r.city) set.add(r.city as string); });
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
    },
    staleTime: 60_000,
  });
  // Miasta ktore realnie maja miejsca (do wyboru miasta w sheecie Filtry, widok Miejsca).
  // Distinct po stronie klienta z aktywnych miejsc.
  const { data: placeCities = [] } = useQuery({
    queryKey: ["explore-place-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("city")
        .eq("is_active", true)
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
  // Pole wyszukiwania jest PRZYPIETE w belce (2026-09-06) - `searchOpen` znaczy juz tylko
  // "pokazuj wyniki zamiast feedu", a nie "rozwin pole".
  const [searchOpen, setSearchOpen] = useState((location.state as any)?.openSearch === true);
  const [feedSearch, setFeedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Kategoria wyszukiwania (redesign 2026-08-31, Figma "NEW - Eksploracja — wyszukiwarka"):
  // Wszystko | Listy | Wyjazdy | Miejsca. Wybor kategorii dziala tez BEZ frazy - wtedy
  // pokazujemy zawartosc tej kategorii (tryb przegladania, decyzja Nat).
  const [searchCat, setSearchCat] = useState<SearchCat>("all");
  const openSearch = () => { setView("feed"); setSearchOpen(true); };
  const closeSearch = () => { setSearchOpen(false); setFeedSearch(""); setSearchCat("all"); searchInputRef.current?.blur(); };
  // Wejscie z profilu (przypiete pole w naglowku profilu) - ustaw kursor w polu od razu.
  useEffect(() => {
    if ((location.state as any)?.openSearch !== true) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // Foldery kategorii chowaja sie po wpisaniu frazy (prosba Nat 2026-09-06 po testach):
  // pusta fraza = przegladanie po kategoriach, wpisana = same wyniki.
  const foldersVisible = searchOpen && !myCollections && feedSearch.trim().length === 0;
  // "Biezace polozenie" (DiscoveryFeed) -> przejdz na widok Miejsc posortowany od najblizszego.
  // Nonce rosnie z kazdym klikiem, zeby ExploreSwiper reagowal takze na ponowne klikniecie.
  const [nearbyNonce, setNearbyNonce] = useState(0);
  // Lejek eksploracji - wejscie na ekran (raz na mount).
  useEffect(() => { track("explore_opened", { city: exploreCity, mode: view }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = () => { setSearchOpen(false); setFeedSearch(""); setView("browse"); setNearbyNonce((n) => n + 1); };
    window.addEventListener("trasa:explore-nearby", h);
    return () => window.removeEventListener("trasa:explore-nearby", h);
  }, []);
  // Coach-marki (onboarding) przelaczaja widok, zeby user widzial zmiane zakladki pod banerem.
  useEffect(() => {
    const h = (e: any) => { const v = e?.detail; if (v === "browse" || v === "feed") setView(v); };
    window.addEventListener("trasa:explore-set-view", h);
    return () => window.removeEventListener("trasa:explore-set-view", h);
  }, []);
  // BottomNav (glassmorficzny) widoczny w OBU widokach - Miejsca (swiper) i Trasy (feed) -
  // dla spojnosci wg redesignu 2026-07-24. Ukrywamy tylko gdy szukamy (pelny ekran wynikow).
  // Karta swipera w exploreMode ma pb chroniace przed BottomNavem (patrz CLAUDE.md PlaceSwiper).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: searchOpen }));
  }, [view, searchOpen]);
  // Przy wyjsciu z Eksploracji zawsze przywroc BottomNav.
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);

  // Czy feed jest odscrollowany od gory - od tego zalezy widocznosc banera wyjazdu.
  // Prog 8 px, zeby baner nie migal przy mikroruchach palca.
  const [feedScrolled, setFeedScrolled] = useState(false);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Wspoldzielona belka (TabTopBar) - identyczna wysokosc 1:1 z Wyjazdy/Zapisane.
          Wyszukiwarka jest PRZYPIETA w tej belce (2026-09-06, po testach z userami):
          pole stoi na stale obok toggle'a, a nie chowa sie pod lupa. Belka NIE znika przy
          szukaniu - zmienia sie tylko jej zawartosc (toggle -> strzalka powrotu), wiec
          wysokosc chrome zostaje stala (wazne dla karty 9:16 w swiperze - CLAUDE.md). */}
      <TabTopBar>
        {myCollections ? (
          <>
            <button
              onClick={() => goBackOr(navigate, "/moj-profil")}
              className="h-9 w-9 -ml-1 flex items-center justify-center text-foreground shrink-0"
              aria-label={t("explore.back_aria")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="flex-1 min-w-0 text-lg font-bold truncate">{t("explore.collections_title")}</h1>
            <button
              onClick={() => { trackCollectionCreate("twoje_listy_header"); navigate("/zestawienie/nowe"); }}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/70 text-primary text-sm font-bold active:scale-[0.97] transition-transform"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("collections.create_new", "Nowa lista miejsc")}
            </button>
          </>
        ) : (
          <ExploreTopBar
            mode={view === "browse" ? "browse" : "explore"}
            onModeChange={(m) => setView(m === "browse" ? "browse" : "feed")}
            onOpenFilters={() => window.dispatchEvent(new CustomEvent("trasa:explore-open-filters"))}
            onOpenSearch={openSearch}
            onCloseSearch={closeSearch}
            searchOpen={searchOpen}
            searchValue={feedSearch}
            onSearchChange={setFeedSearch}
            searchInputRef={searchInputRef}
            activeFilterCount={filterCount}
          />
        )}
      </TabTopBar>

      {/* Foldery kategorii - pod przypieta belka. Widoczne dopoki fraza jest pusta;
          po wpisaniu zwijaja sie animacja i zostaja same wyniki (2026-09-06). */}
      {searchOpen && !myCollections && (
        <div
          className={cn(
            "shrink-0 overflow-hidden border-b border-border/40 transition-all duration-200 ease-out",
            foldersVisible ? "max-h-[160px] opacity-100" : "max-h-0 opacity-0 border-b-0",
          )}
        >
          <p className="px-4 pt-3 text-sm font-bold text-foreground">{`Szukaj według kategorii`}</p>
          <SearchCategoryRow value={searchCat} onChange={setSearchCat} />
          <div className="h-3" />
        </div>
      )}

      {myCollections ? (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 min-h-0 flex flex-col pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex-1 px-4"><MyCollections showCreate={false} /></div>
        </PullToRefresh>
      ) : (
        <>
          {/* Skrot do wyjazdu "w trakcie" / roboczego - TYLKO w widoku feedu. W trybie kart miejsc
              (swiper) NIE renderujemy go: wysokosc karty 9:16 jest wyliczana ze stalego chrome i
              dolozenie paska rozjechaloby zamrozony layout (CLAUDE.md - PlaceSwiper sizing). */}
          {/* Feed - zawsze zamontowany; ukryty gdy swiper (seamless toggle). */}
          <div className={cn("relative flex-1 min-h-0 flex flex-col", view !== "feed" && "hidden")}>
            {/* Skrot do wyjazdu "w trakcie" / roboczego - NAKLADKA przyklejona pod gorna belka.
                Chowa sie po scrollu w dol, wraca na samej gorze (prosba Nat 2026-09-01).
                Dlaczego nakladka, a nie element ukladu - dwa poprzednie podejscia sie wylozyly:
                  1) nad scrollerem, chowany zwijaniem wysokosci -> gorna krawedz listy jechala w
                     gore W TRAKCIE gestu i snap przeliczal sie od nowa: karty skakaly;
                  2) w srodku scrollera -> nie skakal, ale spychal pierwsza karte o swoja wysokosc,
                     wiec jej dol wchodzil pod plywajacy BottomNav.
                Nakladka nie zajmuje miejsca w ukladzie, wiec karta ma pelna wysokosc i wlasciwa
                pozycje, a pojawianie sie i znikanie banera nie rusza NICZEGO pod spodem - nie ma
                czym skoczyc. Wezszy o mapke w prawym gornym rogu karty, zeby jej nie zaslaniac.
                W trybie kart miejsc (swiper) banera nie ma: wysokosc karty 9:16 liczy sie ze
                stalego chrome (CLAUDE.md - zamrozony layout PlaceSwiper). */}
            <div className={cn("absolute inset-x-0 top-0 z-30 transition-all duration-200 ease-out",
              feedScrolled ? "-translate-y-[130%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100")}>
              <ActiveTripBanner floating />
            </div>
            {/* Snap tylko w trybie przegladania feedu. Przy wyszukiwaniu WYLACZAMY snap, zeby
                skroty/wyniki na gorze byly widoczne, a wizytowki zostawaly przewijalne pod spodem. */}
            <PullToRefresh onRefresh={handleRefresh} onScroll={(top) => setFeedScrolled(top > 8)} className={cn("flex-1 min-h-0 flex flex-col pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]", !searchOpen && "snap-y snap-mandatory scroll-pt-3")}>
              <div className="flex-1 px-4"><DiscoveryFeed city={exploreCity} cities={routeCities} onCityChange={setExploreCity} active={view === "feed"} searchQuery={feedSearch} searchOpen={searchOpen} searchCategory={searchCat} /></div>
            </PullToRefresh>
          </div>
          {/* Swiper - montowany po pierwszym przejsciu, potem zostaje (natychmiastowy toggle). */}
          {hasBrowsed && (
            <div className={cn("flex-1 min-h-0 flex flex-col", view !== "browse" && "hidden")}>
              <ExploreSwiper city={exploreCity} cities={placeCities} onCityChange={setExploreCity} active={view === "browse"} sortNearestNonce={nearbyNonce} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Explore;
