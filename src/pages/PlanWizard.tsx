import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, X, Plus, Filter, Check, Star, MapPin, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { usePostHog } from "@posthog/react";
import CityPicker from "@/components/plan-wizard/CityPicker";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import StartingLocationPicker from "@/components/plan-wizard/StartingLocationPicker";
import PlaceSwiper, { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MAIN_CATEGORIES, getSubcategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

// Steps: 1=CityPicker, 2=FullCalendarPicker, 3=StartingLocationPicker, 4=PlaceSwiper.
// CategoryPicker (poprzednio step 3) zostal usuniety - kategorie filtruje sie teraz
// inline w TopBar (chip + drawer multi-select) w trakcie swipe'owania.
type Step = 1 | 2 | 3 | 4;

// Grupowanie matches po kategorii - spojne z GroupSession (parowanie grupowe).
const MATCH_CATEGORIES = [
  { label: "Kawiarnia",   emoji: "☕",  dbValues: ["cafe"] },
  { label: "Restauracja", emoji: "🍽️", dbValues: ["restaurant"] },
  { label: "Bar",         emoji: "🍺",  dbValues: ["bar"] },
  { label: "Kultura",     emoji: "🏛️", dbValues: ["museum", "monument"] },
  { label: "Natura",      emoji: "🌿",  dbValues: ["park", "viewpoint"] },
  { label: "Rozrywka",    emoji: "🎪",  dbValues: ["experience"] },
  { label: "Zakupy",      emoji: "🛍️", dbValues: ["shopping", "market"] },
];

const PlanWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const posthog = usePostHog();
  const returnState = location.state as { step?: number; city?: string; date?: string; likedPlaceNames?: string[]; skippedPlaceNames?: string[]; exploreMode?: boolean } | null;

  const initialStep: Step = (() => {
    const s = returnState?.step;
    if (s === 1 || s === 2 || s === 3 || s === 4) return s;
    return 1;
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [city, setCity] = useState(returnState?.city ?? "");
  const [date, setDate] = useState<Date | null>(returnState?.date ? new Date(returnState.date) : null);
  const [numDays, setNumDays] = useState(1);
  // startingLocation moze byc string (tylko nazwa, legacy) lub obiekt (z lat/lng).
  // Nowe StartingLocationPicker zwraca obiekt - pin startu pojawia sie na mapie.
  const [startingLocation, setStartingLocation] = useState<string | { name: string; latitude: number; longitude: number }>("");

  // Multi-select kategorii (puste = wszystkie)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  // Sortowanie: "default" lub "nearest" (od startingLocation - tylko gdy ustawione)
  const [sortMode, setSortMode] = useState<"default" | "nearest">("default");
  // Filtr diety - multi-select: vegan, vegetarian, gluten_free, lactose_free
  const [dietFilters, setDietFilters] = useState<string[]>([]);

  const allLikedNames: string[] = returnState?.likedPlaceNames ?? [];
  const allSkippedNames: string[] = returnState?.skippedPlaceNames ?? [];

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddPlace, setShowAddPlace] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const exploreMode = returnState?.exploreMode ?? false;

  // Step 4 tabs: "swipe" (Eksploruj) | "matches" (Dopasowania). Polubione miejsca
  // sa lifted z PlaceSwipera przez onLikedPlacesChange callback - PlaceSwiper trzyma
  // wlasny state, tu trzymamy snapshot dla zakładki Dopasowania.
  const [step4Tab, setStep4Tab] = useState<"swipe" | "matches">("swipe");
  const [likedSnapshot, setLikedSnapshot] = useState<MockPlace[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Wybor miejsc do trasy - mirror logiki z GroupSession matches tab (deselectedPlaces).
  // User domyslnie ma wszystko zaznaczone, moze odznaczyc miejsca ktorych nie chce w trasie.
  const [deselectedMatches, setDeselectedMatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (searchOpen) {
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const categoryLabel = useMemo(() => {
    const total = selectedCategories.length + dietFilters.length + (sortMode !== "default" ? 1 : 0);
    if (total === 0) return "Filtry";
    if (selectedCategories.length === 1 && total === 1) return getSubcategoryLabel(selectedCategories[0]) ?? "Wybrane";
    return `${total} ${total === 1 ? "filtr" : total < 5 ? "filtry" : "filtrów"}`;
  }, [selectedCategories, dietFilters, sortMode]);

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
    else if (step === 4) setStep(3);    // back to starting location
    else setStep((s) => (s - 1) as Step);
  };

  // CTA z Dopasowania - przekazuje tylko ZAZNACZONE miejsca (deselectedMatches
  // odejmowane od likedSnapshot). Spojne z GroupSession.matches gdzie host
  // odznacza miejsca przed stworzeniem trasy.
  const handleProceedFromMatches = () => {
    if (!date) return;
    const selected = likedSnapshot.filter(p => !deselectedMatches.has(p.place_name));
    if (selected.length === 0) return;

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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={handleBack}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
          aria-label="Wróć"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {searchOpen && step === 4 ? (
          <>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj miejsca…"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="h-9 w-9 flex items-center justify-center -mr-1 shrink-0 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </>
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
              Zakończ
            </button>
            <button
              onClick={() => setShowAddPlace(true)}
              className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
              aria-label="Dodaj miejsce"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 flex items-center justify-center shrink-0 text-foreground"
              aria-label="Szukaj"
            >
              <Search className="h-5 w-5" />
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
          <FullCalendarPicker onConfirm={(selectedDate, days) => {
            setDate(selectedDate);
            setNumDays(days);
            posthog.capture("plan_date_selected", { num_days: days });
            setStep(3);
          }} />
        )}
        {step === 3 && (
          <StartingLocationPicker
            city={city}
            onConfirm={(location) => {
              setStartingLocation(location);
              posthog.capture("plan_starting_location_selected", { city, has_location: !!location });
              setStep(4);
            }}
            onSkip={() => {
              setStartingLocation("");
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
                  Eksploruj
                </button>
                <button
                  onClick={() => setStep4Tab("matches")}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5",
                    step4Tab === "matches" ? "text-orange-600 border-b-2 border-orange-600" : "text-muted-foreground"
                  )}
                >
                  Dopasowania
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
                searchQuery={searchQuery}
                showAddPlace={showAddPlace}
                onAddPlaceClose={() => setShowAddPlace(false)}
                onSuggestPlace={() => setShowAddPlace(true)}
                exploreMode={exploreMode}
                onLikedPlacesChange={setLikedSnapshot}
                onSwitchToMatches={() => setStep4Tab("matches")}
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
                      <p className="font-bold">Brak polubionych miejsc</p>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                        Wróć do Eksploruj i wybierz miejsca, które chcesz mieć w&nbsp;trasie.
                      </p>
                      <button
                        onClick={() => setStep4Tab("swipe")}
                        className="py-3 px-6 rounded-full bg-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                      >
                        Eksploruj dalej
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
                            Odznacz miejsca, których nie chcesz w&nbsp;trasie
                          </p>
                          {Object.entries(grouped).map(([cat, items]) => {
                            const meta = MATCH_CATEGORIES.find(c => c.dbValues.includes(cat));
                            return (
                              <div key={cat}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                                  {meta ? `${meta.emoji} ${meta.label}` : cat}
                                </p>
                                <div className="space-y-2">
                                  {items.map((place) => {
                                    const isSelected = !deselectedMatches.has(place.place_name);
                                    return (
                                      <button
                                        key={place.id}
                                        onClick={() => { setDetailPlace(place); setDetailOpen(true); }}
                                        className={cn(
                                          "w-full flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all active:scale-[0.98]",
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
                                            {place.rating ? (
                                              <span className="flex items-center gap-0.5">
                                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                {place.rating}
                                              </span>
                                            ) : null}
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
                        Zaproponuj trasę z wybranych miejsc
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
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden" style={{ maxHeight: "85vh" }}>
          {/* X w wrapperze - shadcn [&>button]:hidden ukrywa direct child buttons, wrap broni przed tym */}
          <div>
            <button
              type="button"
              onClick={() => setCategoryDrawerOpen(false)}
              className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70 transition-colors shadow-sm"
              aria-label="Zamknij"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 mb-5 pr-12">
              <div>
                <p className="text-lg font-black">Filtry</p>
                <p className="text-xs text-muted-foreground mt-0.5">Domyślnie pokazujemy wszystkie miejsca. Możesz zawęzić wybór.</p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setSelectedCategories([]); setDietFilters([]); setSortMode("default"); }}
                  className="text-xs text-muted-foreground underline underline-offset-2 active:opacity-60 shrink-0"
                >
                  Wyczyść wszystko
                </button>
              )}
            </div>

            {/* Sortowanie */}
            <div className="mb-5">
              <p className="text-sm font-bold text-foreground mb-2">Sortuj</p>
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
                  Domyślnie
                </button>
                <button
                  onClick={() => setSortMode("nearest")}
                  disabled={typeof startingLocation === "string" || !startingLocation}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                    sortMode === "nearest"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-muted text-foreground border-transparent",
                    (typeof startingLocation === "string" || !startingLocation) && "opacity-40"
                  )}
                  title={(typeof startingLocation === "string" || !startingLocation) ? "Wybierz punkt startowy w kroku 3 aby aktywować" : ""}
                >
                  Od najbliższego
                  {sortMode === "nearest" && <Check className="inline h-3.5 w-3.5 ml-1" />}
                </button>
              </div>
            </div>

            {/* Dieta */}
            <div className="mb-5">
              <p className="text-sm font-bold text-foreground mb-2">Dieta</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "vegan", label: "Wegańskie", emoji: "🌱" },
                  { id: "vegetarian", label: "Wegetariańskie", emoji: "🥗" },
                  { id: "gluten_free", label: "Bez glutenu", emoji: "🌾" },
                  { id: "lactose_free", label: "Bez laktozy", emoji: "🥛" },
                ].map((diet) => {
                  const active = dietFilters.includes(diet.id);
                  return (
                    <button
                      key={diet.id}
                      onClick={() => toggleDiet(diet.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-muted text-foreground border-transparent"
                      )}
                    >
                      <span>{diet.emoji}</span>
                      <span>{diet.label}</span>
                      {active && <Check className="h-3.5 w-3.5 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-sm font-bold text-foreground mb-2">Kategorie</p>

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
              Wszystko
            </button>

            {/* Podkategorie pogrupowane wg MAIN_CATEGORIES */}
            <div className="space-y-4 mb-5">
              {MAIN_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{cat.emoji}</span>
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
              onClick={() => setCategoryDrawerOpen(false)}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
            >
              Pokaż miejsca
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlanWizard;
