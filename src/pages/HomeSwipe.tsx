import { useState, useEffect, useMemo, useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MapPin, ChevronDown, Check, Lock, X, Bell, Shield, Heart, Users } from "lucide-react";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import ActiveTrip from "@/pages/ActiveTrip";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import HomeTour, { useHomeTour } from "@/components/home/HomeTour";
import ProfileSetup, { useProfileSetup } from "@/components/home/ProfileSetup";
import { MAIN_CATEGORIES, getSubcategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { isHardcodedAdmin } from "@/lib/admins";

const FILTERS_STORAGE_KEY = "trasa_home_filters";
// Po odrzuceniu propozycji trasy z polubionych - nie pokazuj jej juz nigdy (per urzadzenie).
const ROUTE_PROMPT_DISMISSED_KEY = "trasa_home_route_prompt_dismissed_v1";

type AvailableCity = { name: string; available: boolean };

// Aktywne: Warszawa + Trójmiasto (Gdańsk/Sopot/Gdynia + wszystkie). Reszta locked. 1:1 z CityPicker.
const AVAILABLE_CITIES: AvailableCity[] = [
  { name: "Warszawa", available: true },
  { name: "Gdańsk", available: true },
  { name: "Sopot", available: true },
  { name: "Gdynia", available: true },
  { name: "Trójmiasto", available: true },
  { name: "Kraków", available: false },
  { name: "Łódź", available: false },
  { name: "Poznań", available: false },
  { name: "Wrocław", available: false },
];

interface StoredFilters {
  city: string;
  categories: string[]; // empty = all
}

function readFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.city === "string") {
        // Back-compat: old format used single `category: string`
        if (Array.isArray(parsed.categories)) return { city: parsed.city, categories: parsed.categories.filter((c: any) => typeof c === "string") };
        if (typeof parsed.category === "string") return { city: parsed.city, categories: parsed.category ? [parsed.category] : [] };
      }
    }
  } catch { /* unavailable */ }
  return { city: "Warszawa", categories: [] };
}

function writeFilters(f: StoredFilters) {
  try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(f)); } catch { /* unavailable */ }
}

const HomeSwipe = () => {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isHardcodedAdmin(user?.email);
  const { open: openAuthDrawer } = useAuthDrawer();
  const isGuest = !user || isAnonymous;
  const { showTour, dismissTour } = useHomeTour(isGuest);
  const { showSetup, finishSetup } = useProfileSetup();
  // Zalogowany nowy user: najpierw intro (czym jest apka + solo/grupowo), potem setup profilu.
  const [introSeen, setIntroSeen] = useState(false);
  const [filters, setFilters] = useState<StoredFilters>(() => readFilters());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showRoutePrompt, setShowRoutePrompt] = useState(false);
  const [likedExplore, setLikedExplore] = useState<{ place_name: string }[]>([]);
  const routePromptShownRef = useRef(false);
  const queryClient = useQueryClient();

  // Aktywna trasa usera -> /home pokazuje ja rozwinieta (zamiast swipera). Najnowsza
  // planning/ongoing. Gosc/anon nie ma zapisanych tras (enabled:false -> swiper).
  const { data: activeRouteId } = useQuery({
    queryKey: ["home-active-route", user?.id],
    queryFn: async () => {
      if (!user || isAnonymous) return null;
      const { data } = await supabase
        .from("routes")
        .select("id")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return ((data as any)?.id ?? null) as string | null;
    },
    enabled: !!user && !isAnonymous,
    staleTime: 30_000,
  });

  // Po polubieniu ~4 miejsc proponujemy stworzenie trasy (raz na sesje; po odrzuceniu nigdy
  // wiecej - flaga w localStorage). onLikedPlacesChange z PlaceSwiper raportuje liste polubionych.
  const handleExploreLikesChange = (places: { place_name: string }[]) => {
    setLikedExplore(places);
    if (!isGuest && places.length >= 4 && !routePromptShownRef.current && !localStorage.getItem(ROUTE_PROMPT_DISMISSED_KEY)) {
      routePromptShownRef.current = true;
      setShowRoutePrompt(true);
    }
  };
  const startRouteFromLiked = (mode: "solo" | "group") => {
    setShowRoutePrompt(false);
    const likedPlaceNames = likedExplore.map((p) => p.place_name).filter(Boolean);
    if (mode === "solo") {
      navigate("/plan", { state: { step: 3, city: filters.city, date: new Date().toISOString(), likedPlaceNames } });
    } else {
      navigate("/sesja/nowa");
    }
  };
  const dismissRoutePrompt = () => {
    setShowRoutePrompt(false);
    try { localStorage.setItem(ROUTE_PROMPT_DISMISSED_KEY, "1"); } catch { /* ignore */ }
  };

  // Powiadomienia tylko dla zalogowanych non-anon (anon nie ma rekordow w notifications)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .neq("type", "group_match");
      return count ?? 0;
    },
    enabled: !!user && !isAnonymous,
    refetchInterval: 30_000,
  });

  // Realtime: instant badge update on new notification
  useEffect(() => {
    if (!user || isAnonymous) return;
    const channel = supabase
      .channel(`homeswipe-notif-badge-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAnonymous]);

  useEffect(() => { writeFilters(filters); }, [filters]);

  const todayDate = useMemo(() => new Date(), []);

  const categoryLabel = useMemo(() => {
    if (filters.categories.length === 0) return "Wszystko";
    if (filters.categories.length === 1) return getSubcategoryLabel(filters.categories[0]) ?? "Wybrane";
    return `${filters.categories.length} kategorie`;
  }, [filters.categories]);

  const toggleCategory = (id: string) => {
    setFilters((f) => {
      const has = f.categories.includes(id);
      return { ...f, categories: has ? f.categories.filter(c => c !== id) : [...f.categories, id] };
    });
  };

  // Logged-in: dopoki nie wiemy czy jest aktywna trasa - spinner (zamiast mignac swiperem).
  if (!isGuest && activeRouteId === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin" />
      </div>
    );
  }
  // Ma aktywna trase -> pokaz ja rozwinieta na ekranie glownym (nie swiper, nie kafelek).
  if (activeRouteId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <ActiveTrip routeId={activeRouteId} embedded />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {showTour && <HomeTour onDone={dismissTour} />}
      {showSetup && !introSeen && <HomeTour lastLabel="Dalej" onDone={() => setIntroSeen(true)} />}
      {showSetup && introSeen && <ProfileSetup onDone={finishSetup} />}
      {/* Sticky top bar: 'Zaloguj sie' (gosc) lub Bell (zalogowany non-anon) po lewej +
          filter chip po prawej */}
      <div className="shrink-0 bg-background px-4 pt-3 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {isGuest ? (
            <button
              onClick={() => openAuthDrawer({ mode: "login" })}
              className="text-xs font-semibold text-orange-600 px-3 py-2 rounded-full hover:bg-orange-50 active:scale-[0.97] transition-all"
            >
              Zaloguj się
            </button>
          ) : (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative h-9 w-9 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
              aria-label="Powiadomienia"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 min-w-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {!isGuest && (
            <button
              onClick={() => navigate("/polubione")}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
              aria-label="Polubione miejsca"
              title="Polubione"
            >
              <Heart className="h-5 w-5" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="h-9 w-9 flex items-center justify-center text-blue-600 active:scale-90 transition-transform"
              aria-label="Panel admina"
              title="Panel admina"
            >
              <Shield className="h-5 w-5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-full"
        >
          <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {filters.city}
            <span className="text-muted-foreground font-normal"> · </span>
            {categoryLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </div>

      {/* Notifications drawer */}
      {notifOpen && user && !isAnonymous && (
        <NotificationsDrawer
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          userId={user.id}
        />
      )}

      {/* Swiper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PlaceSwiper
          key={`${filters.city}-${filters.categories.join(",")}`}
          city={filters.city}
          date={todayDate}
          numDays={1}
          categoryFilter={filters.categories}
          exploreMode
          onLikedPlacesChange={handleExploreLikesChange}
        />
      </div>

      {/* Filter drawer (city + categories multi-select) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "85dvh" }}>
          {/* Close button - wrapped w div, zeby shadcn'owy [&>button]:hidden nie ukrywal naszego.
              Shadcn renderuje wlasny <SheetPrimitive.Close> jako bezposrednie dziecko SheetContent;
              nasz X w wrapperze omija ten selector. */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70 transition-colors shadow-sm"
              aria-label="Zamknij"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 mb-5 pr-12">
              <div>
                <p className="text-lg font-black">Co przeglądasz</p>
                <p className="text-xs text-muted-foreground mt-0.5">Wybierz miasto i&nbsp;kategorie miejsc.</p>
              </div>
              {filters.categories.length > 0 && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
                  className="text-xs text-muted-foreground underline underline-offset-2 active:opacity-60 shrink-0"
                >
                  Wyczyść
                </button>
              )}
            </div>

            {/* Miasto */}
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Miasto</p>
            <div className="flex flex-col gap-1 mb-6">
              {AVAILABLE_CITIES.map((c) => {
                const active = c.name === filters.city;
                const disabled = !c.available;
                return (
                  <button
                    key={c.name}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setFilters((f) => ({ ...f, city: c.name }));
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors",
                      active
                        ? "bg-orange-50 border border-orange-200"
                        : disabled
                          ? "opacity-40"
                          : "bg-card active:bg-muted border border-border/30"
                    )}
                  >
                    <span className="text-sm font-semibold">{c.name}</span>
                    {active && <Check className="h-4 w-4 text-orange-600" />}
                    {disabled && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Wkrótce
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Kategorie - multi-select pogrupowany po MAIN_CATEGORIES */}
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Kategorie</p>
              <p className="text-[10px] text-muted-foreground">możesz zaznaczyć kilka</p>
            </div>

            {/* "Wszystko" - reset filter */}
            <button
              onClick={() => setFilters((f) => ({ ...f, categories: [] }))}
              className={cn(
                "mb-4 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                filters.categories.length === 0
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              Wszystko
            </button>

            {/* Grupowane podkategorie - kazda main category jako naglowek + chipsy podkategorii */}
            <div className="space-y-4 mb-4">
              {MAIN_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{cat.emoji}</span>
                    <p className="text-sm font-bold text-foreground">{cat.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sub) => {
                      const active = filters.categories.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => toggleCategory(sub.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                            active
                              ? "bg-foreground text-background border-foreground"
                              : "bg-muted text-foreground border-transparent"
                          )}
                        >
                          <span>{sub.emoji}</span>
                          <span>{sub.label}</span>
                          {active && <Check className="h-3.5 w-3.5 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDrawerOpen(false)}
              className="w-full py-3.5 mt-2 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
            >
              Pokaż miejsca
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Propozycja stworzenia trasy po polubieniu ~4 miejsc (raz; po "Nie teraz" - nigdy wiecej) */}
      {showRoutePrompt && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={dismissRoutePrompt}
        >
          <div className="w-full max-w-sm bg-background rounded-3xl shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Heart className="h-6 w-6 text-orange-600 fill-orange-600" />
              </div>
              <p className="text-lg font-black leading-tight">
                {`Masz już ${likedExplore.length} ${likedExplore.length === 1 ? "polubione miejsce" : likedExplore.length < 5 ? "polubione miejsca" : "polubionych miejsc"}!`}
              </p>
              <p className="text-sm text-muted-foreground leading-snug">{"Stworzyć z nich trasę?"}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => startRouteFromLiked("solo")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
              >
                <MapPin className="h-4 w-4" /> Trasa solo
              </button>
              <button
                onClick={() => startRouteFromLiked("group")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                <Users className="h-4 w-4" /> Trasa grupowa
              </button>
              <button
                onClick={dismissRoutePrompt}
                className="w-full py-2.5 rounded-2xl text-muted-foreground font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Nie teraz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSwipe;
