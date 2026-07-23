import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { usePostHog } from "@posthog/react";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { useDistanceReference } from "@/lib/distanceReference";
import { getTodayLikes } from "@/lib/exploreLikes";
import { cn } from "@/lib/utils";

// Swiper eksploracji (dawne /plan exploreMode) osadzony w widoku Eksploruj, zeby toggle
// feed<->swiper byl LOKALNY (seamless, bez zmiany trasy). Enkapsuluje PlaceSwiper +
// drawer filtrow (kategorie/sort/dieta). Filtry otwiera guzik w gornej belce eventem
// (trasa:explore-open-filters); licznik raportuje z powrotem (trasa:explore-filter-count).
// `active` = czy ten widok jest aktualnie pokazany (gatuje event listenery/dispatch, bo
// feed i swiper sa zamontowane rownolegle dla plynnego przelaczania).
export default function ExploreSwiper({ city, active }: { city: string; active: boolean }) {
  const { t } = useTranslation("plan");
  const posthog = usePostHog();
  const today = useMemo(() => new Date(), []);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dietFilters] = useState<string[]>([]); // dieta jeszcze wylaczona (toast)
  const [sortMode, setSortMode] = useState<"default" | "nearest">("default");
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);

  const distanceRef = useDistanceReference();
  const hasStartRef = !!distanceRef;
  const activeFilterCount = selectedCategories.length + dietFilters.length + (sortMode !== "default" ? 1 : 0);

  const initialLiked = useMemo(() => (city ? getTodayLikes(city).map((p) => p.place_name) : []), [city]);
  const toggleCategory = (id: string) =>
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Otwarcie filtrow z gornej belki (tylko gdy ten widok jest aktywny).
  useEffect(() => {
    if (!active) return;
    const openH = () => setCategoryDrawerOpen(true);
    window.addEventListener("trasa:explore-open-filters", openH);
    return () => window.removeEventListener("trasa:explore-open-filters", openH);
  }, [active]);
  // Raport licznika filtrow do belki (tylko gdy aktywny).
  useEffect(() => {
    if (active) window.dispatchEvent(new CustomEvent("trasa:explore-filter-count", { detail: activeFilterCount }));
  }, [active, activeFilterCount]);

  return (
    // pb dla fixed BottomNav (AppLayout) - karty swipera nie chowaja sie pod nawigacja.
    <div className="flex-1 flex flex-col overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <PlaceSwiper
        city={city || "Warszawa"}
        date={today}
        numDays={1}
        categoryFilter={selectedCategories.length > 0 ? selectedCategories : undefined}
        dietFilters={dietFilters.length > 0 ? dietFilters : undefined}
        sortByNearest={sortMode === "nearest"}
        initialLikedPlaceNames={initialLiked}
        exploreMode
      />

      {/* Drawer filtrow (kategorie / sort / dieta) - 1:1 z PlanWizard exploreMode */}
      <Sheet open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "85vh" }}>
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
                  onClick={() => { setSelectedCategories([]); setSortMode("default"); }}
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
                    sortMode === "default" ? "bg-foreground text-background border-foreground" : "bg-muted text-foreground border-transparent"
                  )}
                >
                  {t("sort_default")}
                </button>
                <button
                  onClick={() => setSortMode("nearest")}
                  disabled={!hasStartRef}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                    sortMode === "nearest" ? "bg-foreground text-background border-foreground" : "bg-muted text-foreground border-transparent",
                    !hasStartRef && "opacity-40"
                  )}
                  title={!hasStartRef ? t("sort_nearest_disabled_hint") : ""}
                >
                  {t("sort_nearest")}
                  {sortMode === "nearest" && <Check className="inline h-3.5 w-3.5 ml-1" />}
                </button>
              </div>
            </div>

            {/* Dieta (jeszcze niedostepna - toast) */}
            <div className="mb-5">
              <p className="text-sm font-bold text-foreground mb-2">{t("diet_label")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "vegan", label: t("diet_vegan"), emoji: "🌱" },
                  { id: "vegetarian", label: t("diet_vegetarian"), emoji: "🥗" },
                  { id: "gluten_free", label: t("diet_gluten_free"), emoji: "🌾" },
                  { id: "lactose_free", label: t("diet_lactose_free"), emoji: "🥛" },
                ].map((diet) => (
                  <button
                    key={diet.id}
                    onClick={() => { posthog?.capture?.("plan_diet_clicked_blocked", { diet: diet.id }); toast(t("diet_toast")); }}
                    className="flex items-center gap-1.5 pl-3 pr-2.5 py-2 rounded-full text-sm font-semibold border bg-muted/40 border-border/40 text-muted-foreground/60 active:scale-[0.96]"
                  >
                    <span className="opacity-50">{diet.emoji}</span>
                    <span>{diet.label}</span>
                    <span className="text-[10px] font-semibold opacity-70 ml-0.5">{t("diet_soon")}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm font-bold text-foreground mb-2">{t("categories_label")}</p>
            <button
              onClick={() => setSelectedCategories([])}
              className={cn(
                "mb-4 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96]",
                selectedCategories.length === 0 ? "bg-foreground text-background" : "bg-muted text-foreground"
              )}
            >
              {t("all")}
            </button>

            <div className="flex flex-col gap-6 mb-5">
              {MAIN_CATEGORIES.map((cat) => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{cat.emoji}</span>
                    <p className="text-sm font-bold text-foreground">{cat.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sub) => {
                      const on = selectedCategories.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => toggleCategory(sub.id)}
                          className={cn(
                            "flex items-center gap-1.5 pl-3 pr-2.5 py-2 rounded-full text-sm font-semibold transition-colors active:scale-[0.96] border",
                            on ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white text-foreground border-border/60"
                          )}
                        >
                          <span>{sub.emoji}</span>
                          <span>{sub.label}</span>
                          {on ? <Check className="h-3.5 w-3.5 ml-0.5 text-orange-600" /> : <Plus className="h-3.5 w-3.5 ml-0.5 text-muted-foreground/50" />}
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
    </div>
  );
}
