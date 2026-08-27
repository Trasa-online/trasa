import { useState, useRef, useEffect, useMemo } from "react";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, X, Plus, Filter, Check, MapPin, ArrowRight, ChevronDown, Layers, Compass, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/components/OnboardingGuide";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { expandCity } from "@/lib/cities";
import { usePostHog } from "@posthog/react";
import { toast } from "sonner";
import CityPicker, { UNLOCKED_CITIES } from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { Calendar } from "@/components/ui/calendar";
import { dateLocale } from "@/lib/dateLocale";
import StartingLocationPicker from "@/components/plan-wizard/StartingLocationPicker";
import PlaceSwiper, { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import ExploreTopBar from "@/components/home/ExploreTopBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MAIN_CATEGORIES, getSubcategoryLabel, subcategoryLabelLocalized } from "@/lib/categories";
import { setStartReference, markAskedForCity, tryResolveOnSite, useDistanceReference } from "@/lib/distanceReference";
import { getTodayLikes } from "@/lib/exploreLikes";
import { saveDraft, removeDraft } from "@/lib/draftRoutes";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// Steps: 1=CityPicker, 2=FullCalendarPicker, 3=StartingLocationPicker, 4=PlaceSwiper.
// CategoryPicker (poprzednio step 3) zostal usuniety - kategorie filtruje sie teraz
// inline w TopBar (chip + drawer multi-select) w trakcie swipe'owania.
type Step = 1 | 2 | 3 | 4;

// Grupowanie matches po kategorii - spojne z GroupSession (parowanie grupowe).
const MATCH_CATEGORIES = [
  { id: "cafe",         emoji: "☕",  dbValues: ["cafe"] },
  { id: "restaurant",   emoji: "🍽️", dbValues: ["restaurant"] },
  { id: "bar",          emoji: "🍺",  dbValues: ["bar"] },
  { id: "culture",      emoji: "🏛️", dbValues: ["museum", "monument"] },
  { id: "nature",       emoji: "🌿",  dbValues: ["park", "viewpoint"] },
  { id: "entertainment", emoji: "🎪", dbValues: ["experience"] },
  { id: "shopping",     emoji: "🛍️", dbValues: ["shopping", "market"] },
];

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const { active: onboardingActive } = useOnboarding();
  const posthog = usePostHog();
  const { t } = useTranslation("plan");
  const returnState = location.state as { step?: number; city?: string; date?: string; numDays?: number; startingLocation?: string | { name: string; latitude: number; longitude: number }; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; exploreMode?: boolean; wyjazdMode?: boolean; fromRoute?: boolean } | null;

  const exploreMode = returnState?.exploreMode ?? false;
  // Tryb WYJAZDU: miasto + daty -> swiper miejsc -> zamiast planu AI tworzymy wyjazd
  // (routes + pins) z polubionych i ladujemy w dzienniku jako wpis/pocztowka.
  const wyjazdMode = returnState?.wyjazdMode ?? false;

  const initialStep: Step = (() => {
    const s = returnState?.step;
    if (s === 1 || s === 2 || s === 3 || s === 4) return s;
    // exploreMode ("Przegladaj") pomija wybor miasta - od razu swiper (domyslnie Warszawa).
    return exploreMode ? 4 : 1;
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [city, setCity] = useState(returnState?.city ?? (exploreMode ? "Warszawa" : ""));
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : (exploreMode ? new Date() : null));
  const [numDays, setNumDays] = useState(returnState?.numDays ?? 1);
  // startingLocation moze byc string (tylko nazwa, legacy) lub obiekt (z lat/lng).
  // Nowe StartingLocationPicker zwraca obiekt - pin startu pojawia sie na mapie.
  const [startingLocation, setStartingLocation] = useState<string | { name: string; latitude: number; longitude: number }>(returnState?.startingLocation ?? "");
  // Step 3: auto-detect on-site. "resolving" -> loader, "map" -> mapa punktu startu (planujesz),
  // "sheet" -> jawne pytanie "Jestes juz w miescie?" (brak zgody GPS).
  const [step3Mode, setStep3Mode] = useState<"resolving" | "map">("resolving");

  // Multi-select kategorii (puste = wszystkie)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  // Sortowanie: "default" lub "nearest" (od punktu odniesienia - tylko gdy ustawiony)
  const [sortMode, setSortMode] = useState<"default" | "nearest">("default");
  // Punkt odniesienia do sortowania "od najbliższego". To samo źródło prawdy którego
  // używa swiper (getReference). Ustawiany przez OBIE ścieżki kroku 3: StartingLocationPicker
  // (mapa). startingLocation (lokalny stan) ustawia tylko ta ścieżka, więc gate'owanie
  // przycisku na nim psuło sort, gdy punkt odniesienia przyszedł z GPS.
  const distanceRef = useDistanceReference();
  const hasStartRef = !!distanceRef;
  // Filtr diety - multi-select: vegan, vegetarian, gluten_free, lactose_free
  const [dietFilters, setDietFilters] = useState<string[]>([]);

  // Polubione do "Dopasowań" = przekazane ze stanu (reuse prompt) + DZISIEJSZE polubienia
  // z eksploracji DLA WYBRANEGO MIASTA. Wczesniej reuse szedl tylko z BottomNav po zgadnietym
  // mescie (getActiveHomeCity), wiec po "Przegladaj miejsca" w innym miescie polubione nie
  // wskakiwaly do Dopasowan. Merge po realnie wybranym miescie naprawia to (pokazuja sie od razu).
  // Zapisane miejsca z dzisiejszej eksploracji DLA WYBRANEGO MIASTA wlaczamy do widoku
  // "Zapisane" AUTOMATYCZNIE (bez popupu). User odznacza tam czego nie chce - zamiast
  // wczesniejszego modala "wykorzystac polubione?".
  const todayLikesForCity = useMemo(() => (city ? getTodayLikes(city) : []), [city]);

  // Miejsca JUZ UZYTE w wyjazdach usera dla tego miasta (piny istniejacych tras). Przy tworzeniu
  // NOWEGO wyjazdu wykluczamy je - user dostaje swieze miejsca (swiper + zapisane), a nie te,
  // ktore juz wykorzystal w poprzednim wyjezdzie.
  const { data: usedPlaceNames = [] } = useQuery({
    queryKey: ["wyjazd-used-places", user?.id, city],
    queryFn: async () => {
      if (!user?.id || !city) return [] as string[];
      const { data: routes } = await (supabase as any)
        .from("routes").select("id").eq("user_id", user.id).in("city", expandCity(city));
      const ids = (routes ?? []).map((r: any) => r.id);
      if (!ids.length) return [] as string[];
      const { data: pins } = await (supabase as any)
        .from("pins").select("place_name").in("route_id", ids);
      return Array.from(new Set((pins ?? []).map((p: any) => p.place_name))) as string[];
    },
    enabled: !!user?.id && !!city && wyjazdMode,
    staleTime: 30_000,
  });
  const usedSet = useMemo(() => new Set(usedPlaceNames.map((n) => n.toLowerCase())), [usedPlaceNames]);

  const allLikedNames: string[] = useMemo(() => {
    const fromState = returnState?.likedPlaceNames ?? [];
    const fromExplore = todayLikesForCity.map((l) => l.place_name);
    const merged = Array.from(new Set([...fromState, ...fromExplore]));
    return wyjazdMode ? merged.filter((n) => !usedSet.has(n.toLowerCase())) : merged;
  }, [returnState?.likedPlaceNames, todayLikesForCity, wyjazdMode, usedSet]);
  const allSkippedNames: string[] = useMemo(
    () => Array.from(new Set([...(returnState?.skippedPlaceNames ?? []), ...(wyjazdMode ? usedPlaceNames : [])])),
    [returnState?.skippedPlaceNames, wyjazdMode, usedPlaceNames],
  );

  const [showAddPlace, setShowAddPlace] = useState(false);
  // Istniejaca aktywna trasa dla wybranego miasta+daty (hybryda: pytamy kontynuuj/nowa).
  const [dupTrip, setDupTrip] = useState<{ id: string; city: string; start_date: string } | null>(null);
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const dupDrag = useDragToDismiss({ onDismiss: () => setDupTrip(null) });
  // Edycja daty z poziomu swipera (klik w "miasto · DD MMM") - sheet z kalendarzem.
  const [editDateOpen, setEditDateOpen] = useState(false);

  // Step 4 tabs: "swipe" (Eksploruj) | "matches" (Dopasowania). Polubione miejsca
  // sa lifted z PlaceSwipera przez onLikedPlacesChange callback - PlaceSwiper trzyma
  // wlasny state, tu trzymamy snapshot dla zakładki Dopasowania.
  const [step4Tab, setStep4Tab] = useState<"swipe" | "matches">("swipe");
  const [likedSnapshot, setLikedSnapshot] = useState<MockPlace[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Trasa robocza: auto-zapis gdy user ma miasto + datę + ≥1 polubienie, ale jeszcze nie
  // wygenerował trasy. Debounce 800ms. Wraca jako karta "Dokończ trasę" na home (ActiveTripsDashboard).
  // Nie w exploreMode (HomeSwipe bez intencji trasy). Usuwany po stworzeniu trasy (RouteSummaryDialog).
  useEffect(() => {
    if (exploreMode || wyjazdMode || !city || !date) return;
    // Pusta trasa (0 polubien) nie ma sensu jako robocza - usun ew. istniejacy draft dla miasta.
    if (likedSnapshot.length === 0) { removeDraft(city); return; }
    const t = setTimeout(() => {
      saveDraft({
        city,
        date: date.toISOString(),
        numDays,
        startingLocation: startingLocation || undefined,
        likedPlaceNames: likedSnapshot.map((p) => p.place_name),
      });
    }, 800);
    return () => clearTimeout(t);
  }, [exploreMode, city, date, numDays, startingLocation, likedSnapshot]);
  // Wybor miejsc do trasy - mirror logiki z GroupSession matches tab (deselectedPlaces).
  // User domyslnie ma wszystko zaznaczone, moze odznaczyc miejsca ktorych nie chce w trasie.
  const [deselectedMatches, setDeselectedMatches] = useState<Set<string>>(new Set());

  // Step 3 (solo): ZAWSZE pokazujemy mape wyboru punktu startu - nawet gdy user jest
  // w swoim miescie (on-site). Wczesniej on-site pomijalo mape i szlo prosto do swipera;
  // teraz user zawsze wskazuje skad startuje (mapa pre-fill'uje GPS gdy dostepny).
  // tryResolveOnSite wolamy tylko dla efektu ubocznego (cache GPS -> pre-fill pinezki).
  useEffect(() => {
    if (step !== 3 || !city) return;
    setStep3Mode("resolving");
    let cancelled = false;
    (async () => {
      await tryResolveOnSite(city);
      if (cancelled) return;
      setStep3Mode("map");
    })();
    return () => { cancelled = true; };
  }, [step, city]);

  const categoryLabel = useMemo(() => {
    const total = selectedCategories.length + dietFilters.length + (sortMode !== "default" ? 1 : 0);
    if (total === 0) return t("filters");
    if (selectedCategories.length === 1 && total === 1) return subcategoryLabelLocalized(selectedCategories[0]);
    const form = total === 1 ? "one" : total < 5 ? "few" : "many";
    return t(`filters_count_${form}`, { count: total });
  }, [selectedCategories, dietFilters, sortMode, t]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((c) => c !== id) : [...prev, id];
      posthog.capture("plan_category_toggled", { category: id, selected: !has, total_selected: next.length });
      return next;
    });
  };

  const toggleDiet = (id: string) => {
    setDietFilters((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((c) => c !== id) : [...prev, id];
      posthog.capture("plan_diet_toggled", { diet: id, selected: !has });
      return next;
    });
  };

  // Total active filter count - dla badge na chipie filtru
  const activeFilterCount = selectedCategories.length + dietFilters.length + (sortMode !== "default" ? 1 : 0);

  const handleBack = () => {
    if (step === 1) navigate("/");
    // Parowanie (step 4): z "Dopasowania" wracaj najpierw do "Eksploruj", nie skacz do step 3.
    else if (step === 4 && step4Tab === "matches") setStep4Tab("swipe");
    // Step 3 to auto-resolvujacy krok posredni (loader/mapa/sheet) - NIE jest celem cofania.
    // exploreMode pomija wybor miasta (od razu swiper) - chevron wraca do feedu Eksploruj.
    // Solo: wracamy do kalendarza, pomijajac mape punktu startu (auto-resolve odpalalby
    // sie ponownie i albo bouncowal do step 4, albo pokazywal niespodziewana mape).
    else if (step === 4) { if (exploreMode) navigate("/eksploruj"); else setStep(2); }
    else if (step === 3) setStep(2);
    else setStep((s) => (s - 1) as Step);
  };

  // CTA z Dopasowania - przekazuje tylko ZAZNACZONE miejsca (deselectedMatches
  // odejmowane od likedSnapshot). Spojne z GroupSession.matches gdzie host
  // odznacza miejsca przed stworzeniem trasy.
  const handleProceedFromMatches = async () => {
    if (!date) return;
    const selected = likedSnapshot.filter(p => !deselectedMatches.has(p.place_name));
    if (selected.length === 0) return;

    // Tryb WYJAZDU: bez kulminacji w planie AI. Tworzymy wyjazd (routes + pins) z polubionych
    // + wybrane miasto/daty i otwieramy edytor wpisu (ReviewSummary, tryb edycji - stepper).
    if (wyjazdMode) {
      // Podczas onboardingu (fejk-konto anon) tworzenie wyjazdu dziala realnie - bez blokady.
      if ((!user || isAnonymous) && !onboardingActive) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
      const pad = (n: number) => String(n).padStart(2, "0");
      const startISO = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const end = new Date(date); end.setDate(end.getDate() + Math.max(0, numDays - 1));
      const endISO = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
      const id = await createWyjazdFromPlaces(user.id, city, city, selected.map((p) => ({
        place_name: p.place_name,
        category: p.category as string,
        address: (p as { address?: string | null }).address ?? null,
        description: p.description ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        photo_url: p.photo_url ?? null,
        place_id: (p as { id?: string | null }).id ?? null,
      })), { start_date: startISO, end_date: endISO });
      if (id) navigate(`/review-summary?route=${id}&edit=1`);
      return;
    }

    // Continuation flow detect - jesli user wszedl tu z "Polub wiecej miejsc"
    // CTA w AddPinSheet (PlanChat), AddPinSheet zapisal aktualny plan + previous
    // likes w localStorage. Teraz mergujemy wszystko i pass initialPlan do
    // CreateRoute zeby PlanChatExperience extended istniejacy plan zamiast
    // generowac nowy od zera (bug feedback 2026-06-03).
    let continueState: any = null;
    try {
      const raw = localStorage.getItem("trasa_continue_route");
      if (raw) {
        continueState = JSON.parse(raw);
        // 1h TTL - po dluzszym czasie ignoruj (user mogl porzucic flow)
        if (continueState.savedAt && Date.now() - continueState.savedAt > 3_600_000) {
          continueState = null;
        }
        localStorage.removeItem("trasa_continue_route");
      }
    } catch { /* unavailable */ }

    const selectedNames = selected.map((p) => p.place_name);
    const mergedNames = continueState
      ? Array.from(new Set([...(continueState.previousLikedNames ?? []), ...selectedNames]))
      : selectedNames;

    const routeState = {
      city: continueState?.city ?? city,
      date: continueState?.date ?? date.toISOString(),
      numDays: continueState?.numDays ?? numDays,
      startingLocation: continueState?.startingLocation ?? (startingLocation || undefined),
      likedPlaceNames: mergedNames,
      skippedPlaceNames: [] as string[],
      likedPlacesData: selected.map((p) => ({
        place_name: p.place_name,
        category: p.category as string,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      superLikedPlaceNames: [] as string[],
      // KLUCZOWE - jesli continuation, przekazujemy istniejacy plan jako initial
      // (CreateRoute -> PlanChatExperience uses initialPlan), plus flag zeby
      // PlanChat wywolal plan-route w extend mode (zachowac dni z miejscami,
      // wypelnic puste nowymi).
      ...(continueState ? {
        initialPlan: continueState.currentPlan,
        continuationMode: true,
      } : {}),
    };
    if (!user || isAnonymous) {
      try { localStorage.setItem("trasa_guest_plan", JSON.stringify(routeState)); } catch { /* unavailable */ }
      openAuthDrawer({ mode: "register", hint: "save_route" });
      return;
    }
    navigate("/create", { state: routeState });
  };

  const toggleMatchSelection = (placeName: string) => {
    setDeselectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(placeName)) next.delete(placeName);
      else next.add(placeName);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Modal "wykorzystać polubione?" usunięty - zapisane z dziś wpadają automatycznie
          do zakładki "Zapisane", gdzie user odznacza czego nie chce. */}

      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          data-ob="wizard-back"
          onClick={handleBack}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {step === 4 && exploreMode ? (
          <ExploreTopBar
            mode="browse"
            city={city || "Warszawa"}
            onCityChange={(c) => { if (c !== city) { setCity(c); posthog.capture("plan_city_selected", { city: c, explore_mode: true }); } }}
            onOpenFilters={() => setCategoryDrawerOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        ) : step === 4 ? (
          <>
            {/* Akcje + chip filtru kategorii - chip ostatni (po prawej) */}
            <div className="flex-1" />
            <button
              onClick={() => {
                if (!user || isAnonymous) {
                  try {
                    localStorage.setItem("trasa_guest_plan", JSON.stringify({
                      city,
                      date: date?.toISOString() ?? null,
                      likedPlaceNames: allLikedNames,
                    }));
                  } catch { /* unavailable */ }
                  openAuthDrawer({ mode: "register", hint: "save_route" });
                  return;
                }
                navigate("/home");
              }}
              className="text-sm text-muted-foreground font-medium px-2 py-1"
            >
              {t("finish")}
            </button>
            <button
              onClick={() => setShowAddPlace(true)}
              className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
              aria-label={t("add_place")}
            >
              <Plus className="h-5 w-5" />
            </button>
            {/* Chip filtru - na prawym koncu */}
            <button
              onClick={() => setCategoryDrawerOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/60 active:scale-[0.97] transition-transform max-w-[140px]"
            >
              <Filter className="h-3.5 w-3.5 text-orange-600 shrink-0" />
              <span className="text-sm font-semibold text-foreground truncate">{categoryLabel}</span>
            </button>
          </>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {step === 1 && (
          <CityPicker onConfirm={(selectedCity) => {
            setCity(selectedCity);
            posthog.capture("plan_city_selected", { city: selectedCity, explore_mode: exploreMode });
            if (exploreMode) { setDate(new Date()); setStep(4); }
            else setStep(2);
          }} />
        )}
        {step === 2 && (
          <FullCalendarPicker onConfirm={async (selectedDate, days) => {
            setDate(selectedDate);
            setNumDays(days);
            posthog.capture("plan_date_selected", { num_days: days });
            // Hybryda: jesli user ma juz aktywna trase dla tego miasta+daty - zapytaj
            // (kontynuuj istniejaca / stworz osobna) ZANIM zacznie wybierac miejsca.
            if (user && !isAnonymous && city) {
              const pad = (n: number) => String(n).padStart(2, "0");
              const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`;
              const { data } = await (supabase as any)
                .from("routes")
                .select("id, city, start_date")
                .eq("user_id", user.id)
                .eq("city", city)
                .eq("start_date", dateStr)
                .in("trip_type", ["planning", "ongoing"])
                .is("group_session_id", null)
                .limit(1);
              if (data?.length) { setDupTrip(data[0]); return; }
            }
            // Wyjazd: pomijamy krok punktu startowego (bez optymalizacji trasy) - od razu swiper.
            if (wyjazdMode) { markAskedForCity(city); setStep(4); return; }
            setStep(3);
          }} />
        )}
        {step === 3 && step3Mode === "resolving" && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {step === 3 && step3Mode === "map" && (
          <StartingLocationPicker
            city={city}
            onConfirm={(location) => {
              setStartingLocation(location);
              // Punkt startu = wspolny punkt odniesienia (chip "od startu" + sort). Oznacz
              // miasto jako "zapytane", zeby swiper w kroku 4 nie pytal ponownie.
              setStartReference({ lat: location.latitude, lng: location.longitude });
              markAskedForCity(city);
              posthog.capture("plan_starting_location_selected", { city, has_location: !!location });
              setStep(4);
            }}
            onSkip={() => {
              setStartingLocation("");
              markAskedForCity(city);
              posthog.capture("plan_starting_location_skipped", { city });
              setStep(4);
            }}
          />
        )}
        {step === 4 && date && (
          <>
            {/* Tabs - tylko w solo (nie w exploreMode = HomeSwipe-like). exploreMode
                renderuje swiper bezposrednio bez tabow. */}
            {!exploreMode && (
              <div className="flex border-b border-border/20 shrink-0">
                <button
                  onClick={() => setStep4Tab("swipe")}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-semibold transition-colors",
                    step4Tab === "swipe" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"
                  )}
                >
                  {t("tab_explore")}
                </button>
                <button
                  onClick={() => setStep4Tab("matches")}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5",
                    step4Tab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"
                  )}
                >
                  {t("tab_saved")}
                  {likedSnapshot.length > 0 && (
                    <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {likedSnapshot.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Eksploruj (swiper) - zawsze zamontowany zeby state liked/skip nie zostal
                stracony przy zmianie tabki. Ukryty przez display:none gdy nie aktywny. */}
            <div className={cn("flex-1 flex flex-col overflow-hidden", step4Tab !== "swipe" && "hidden")}>
              <PlaceSwiper
                city={city}
                date={date}
                numDays={numDays}
                startingLocation={startingLocation}
                categoryFilter={selectedCategories.length > 0 ? selectedCategories : undefined}
                dietFilters={dietFilters.length > 0 ? dietFilters : undefined}
                sortByNearest={sortMode === "nearest"}
                initialLikedPlaceNames={allLikedNames}
                initialSkippedPlaceNames={allSkippedNames}
                showAddPlace={showAddPlace}
                onAddPlaceClose={() => setShowAddPlace(false)}
                onSuggestPlace={() => setShowAddPlace(true)}
                exploreMode={exploreMode}
                onLikedPlacesChange={setLikedSnapshot}
                onSwitchToMatches={() => setStep4Tab("matches")}
                onEditDate={() => setEditDateOpen(true)}
              />
            </div>

            {/* Dopasowania - lista polubionych z checkbox'ami i CTA na koncu (mirror
                GroupSession.matches tab UI). User moze odznaczyc miejsca ktorych
                NIE chce w trasie - CTA pokazuje liczbe AKTUALNIE wybranych. */}
            {step4Tab === "matches" && !exploreMode && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                  {likedSnapshot.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                      <p className="text-4xl">🤔</p>
                      <p className="font-bold">{t("saved_empty_title")}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                        {t("saved_empty_desc")}
                      </p>
                      <button
                        onClick={() => setStep4Tab("swipe")}
                        className="py-3 px-6 rounded-full bg-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                      >
                        {t("saved_empty_cta")}
                      </button>
                    </div>
                  ) : (
                    (() => {
                      // Grupowanie polubionych po kategorii - jak w parowaniu grupowym.
                      const grouped = likedSnapshot.reduce<Record<string, MockPlace[]>>((acc, p) => {
                        const key = (p.category as string) || "inne";
                        (acc[key] ??= []).push(p);
                        return acc;
                      }, {});
                      return (
                        <div className="space-y-5">
                          <p className="text-xs text-muted-foreground px-1">
                            {t("saved_deselect_hint")}
                          </p>
                          {Object.entries(grouped).map(([cat, items]) => {
                            const meta = MATCH_CATEGORIES.find(c => c.dbValues.includes(cat));
                            return (
                              <div key={cat}>
                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                                  {meta ? <><CategoryIcon category={meta.id} className="h-3.5 w-3.5 shrink-0" />{t(`match_cat.${meta.id}`)}</> : cat}
                                </p>
                                <div className="space-y-2">
                                  {items.map((place) => {
                                    const isSelected = !deselectedMatches.has(place.place_name);
                                    return (
                                      <button
                                        key={place.id}
                                        onClick={() => { setDetailPlace(place); setDetailOpen(true); }}
                                        className={cn(
                                          "w-full flex items-center gap-3 rounded-2xl border bg-secondary p-3 text-left transition-all active:scale-[0.98]",
                                          isSelected ? "border-border/40" : "border-border/20 opacity-50"
                                        )}
                                      >
                                        {place.photo_url ? (
                                          <img src={place.photo_url} alt={place.place_name} className="h-14 w-14 rounded-2xl object-cover shrink-0" />
                                        ) : (
                                          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                                            <MapPin className="h-5 w-5 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-sm leading-tight truncate">{place.place_name}</p>
                                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                            {place.address && <span className="truncate">{place.address.split(",")[0]}</span>}
                                          </div>
                                        </div>
                                        {/* Checkbox - click stopuje propagacje zeby tap na nim NIE
                                            otwieral detail sheet, tylko toggleowal selekcje. */}
                                        <div
                                          onClick={(e) => { e.stopPropagation(); toggleMatchSelection(place.place_name); }}
                                          className={cn(
                                            "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                            isSelected ? "bg-primary border-orange-600" : "border-border/60 bg-background"
                                          )}
                                        >
                                          {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* CTA - zapisz trase z WYBRANYCH polubionych */}
                {(() => {
                  const selectedCount = likedSnapshot.filter(p => !deselectedMatches.has(p.place_name)).length;
                  if (selectedCount === 0) return null;
                  return (
                    <div className="px-4 pb-safe-4 pt-2 shrink-0 border-t border-border/20 flex gap-2">
                      <button
                        onClick={handleProceedFromMatches}
                        className="flex-1 py-3 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                      >
                        {wyjazdMode ? "Stwórz wyjazd" : t("saved_cta")}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })()}

                {/* Detail sheet - podglad polubionego miejsca */}
                <PlaceSwiperDetail
                  open={detailOpen}
                  onOpenChange={setDetailOpen}
                  place={detailPlace}
                  city={city}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Category filter drawer - multi-select grouped by main category */}
      <Sheet open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "85vh" }}>
          {/* X w wrapperze - shadcn [&>button]:hidden ukrywa direct child buttons, wrap broni przed tym */}
          <div>
            <button
              type="button"
              onClick={() => setCategoryDrawerOpen(false)}
              className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70 transition-colors shadow-sm"
              aria-label={t("close")}
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex items-center justify-between gap-3 mb-5 pr-12">
              <div>
                <p className="text-lg font-black">{t("filters")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("filters_subtitle")}</p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setSelectedCategories([]); setDietFilters([]); setSortMode("default"); }}
                  className="text-xs text-muted-foreground underline underline-offset-2 active:opacity-60 shrink-0"
                >
                  {t("filters_clear_all")}
                </button>
              )}
            </div>

            {/* Sortowanie */}
            <div className="mb-5">
              <p className="text-sm font-bold text-foreground mb-2">{t("sort_label")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSortMode("default")}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                    sortMode === "default"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-muted text-foreground border-transparent"
                  )}
                >
                  {t("sort_default")}
                </button>
                <button
                  onClick={() => setSortMode("nearest")}
                  disabled={!hasStartRef}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                    sortMode === "nearest"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-muted text-foreground border-transparent",
                    !hasStartRef && "opacity-40"
                  )}
                  title={!hasStartRef ? t("sort_nearest_disabled_hint") : ""}
                >
                  {t("sort_nearest")}
                  {sortMode === "nearest" && <Check className="inline h-3.5 w-3.5 ml-1" />}
                </button>
              </div>
            </div>

            {/* Dieta */}
            <div className="mb-5">
              <p className="text-sm font-bold text-foreground mb-2">{t("diet_label")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "vegan", label: t("diet_vegan"), emoji: "🌱" },
                  { id: "vegetarian", label: t("diet_vegetarian"), emoji: "🥗" },
                  { id: "gluten_free", label: t("diet_gluten_free"), emoji: "🌾" },
                  { id: "lactose_free", label: t("diet_lactose_free"), emoji: "🥛" },
                ].map((diet) => {
                  // TYMCZASOWO wyszarzone - filtry diety jeszcze niedostepne (toast na klik).
                  return (
                    <button
                      key={diet.id}
                      onClick={() => {
                        posthog?.capture?.("plan_diet_clicked_blocked", { diet: diet.id });
                        toast(t("diet_toast"));
                      }}
                      className="flex items-center gap-1.5 pl-3 pr-2.5 py-2 rounded-full text-sm font-semibold border bg-muted/40 border-border/40 text-muted-foreground/60 active:scale-[0.96]"
                    >
                      <span className="opacity-50">{diet.emoji}</span>
                      <span>{diet.label}</span>
                      <span className="text-[10px] font-semibold opacity-70 ml-0.5">{t("diet_soon")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-sm font-bold text-foreground mb-2">{t("categories_label")}</p>

            {/* "Wszystko" - reset */}
            <button
              onClick={() => setSelectedCategories([])}
              className={cn(
                "mb-4 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                selectedCategories.length === 0
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              {t("all")}
            </button>

            {/* Podkategorie wg MAIN_CATEGORIES - "zawieszone" sekcje (bez bialych ramek),
                rozdzielone spacingiem. Chip: ikona + tekst + plus/check (orange gdy wybrany). */}
            <div className="flex flex-col gap-6 mb-5">
              {MAIN_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryIcon category={cat.id} className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-bold text-foreground">{cat.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sub) => {
                      const active = selectedCategories.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => toggleCategory(sub.id)}
                          className={cn(
                            "flex items-center gap-1.5 pl-3 pr-2.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                            active
                              ? "bg-orange-50 border-orange-300 text-orange-700"
                              : "bg-white text-foreground border-border/60"
                          )}
                        >
                          <CategoryIcon category={sub.id} className="h-4 w-4 shrink-0" />
                          <span>{sub.label}</span>
                          {active
                            ? <Check className="h-3.5 w-3.5 ml-0.5 text-orange-600" />
                            : <Plus className="h-3.5 w-3.5 ml-0.5 text-muted-foreground/50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCategoryDrawerOpen(false)}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
            >
              {t("show_places")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edycja daty z poziomu swipera (klik w "miasto · DD MMM") */}
      <Sheet open={editDateOpen} onOpenChange={setEditDateOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden" style={{ maxHeight: "85vh" }}>
          <div className="px-5 pt-5 pb-3">
            <p className="text-lg font-black">{t("edit_date_title")}</p>
          </div>
          <div className="flex justify-center pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={(d) => { if (d) { setDate(d); setEditDateOpen(false); } }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              locale={dateLocale()}
              className="rounded-2xl"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Hybryda - masz juz trase dla tego miasta+daty: kontynuuj / nowa */}
      {dupTrip && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDupTrip(null)}
        >
          <div
            {...dupDrag.dragProps}
            className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black leading-snug">{t("dup_title", { city: dupTrip.city })}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("dup_desc")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setDupTrip(null); navigate("/home"); }}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                {t("dup_continue")}
              </button>
              <button
                onClick={() => { setDupTrip(null); setStep(3); }}
                className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                {t("dup_create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanWizard;
