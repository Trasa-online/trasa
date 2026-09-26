import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandCheck, BrandPin } from "@/components/BrandIcon";
import { haptics } from "@/hooks/useHaptics";
import { askPermission } from "@/lib/permissionPrompts";
import { getReference, setGpsReference } from "@/lib/distanceReference";
import { mainCategoryLabel, placeCategoryLabel, MAIN_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BrandSearch } from "@/components/BrandIcon";
import { fetchPlaceCities, countriesOf, placeCitiesKey } from "@/lib/placeCities";
import { countryLabel } from "@/lib/tripCountries";

// FILTR ODLEGLOSCI w zakladce Miejsca (prosba Nat 2026-09-24: "filtrowanie po odleglosci
// miejsc ode mnie"). Dystans byl w apce od dawna - chip "2,5 km" na karcie i sortowanie
// "od najblizszego" - ale nie dalo sie powiedziec "pokaz mi TYLKO to, co mam pod reka".
//
// ⛔ Filtr NIE moze stanac nad swiperem: wysokosc karty 9:16 liczy sie ze STALEGO chrome
// (CLAUDE.md, zamrozony sizing PlaceSwiper), wiec kazdy dodatkowy wiersz zepchnalby karte
// pod dolny pasek. Dlatego wejscie to guzik w GORNEJ BELCE, a wybor - ten arkusz.
//
// ⚠️ Promien bez zgody na lokalizacje nic nie znaczy, wiec wybor sam o nia prosi - jawnie
// (`explicit`), bo to user wlasnie tapnal cos, co jej wymaga. Odmowa = zostaje "Dowolna".

/** Promienie w km. Skok jest ROSNACY (1-3-5-10-25), bo na dole skali chodzi o "tuz obok",
 *  a na gorze o "w tym miescie" - rowne kroki co 5 km daloby pol listy bez sensu. */
export const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;

const STORAGE_KEY = "spontaway_places_radius_v1";

/** Wybrany promien przezywa wyjscie z zakladki (i restart apki) - user ustawil go swiadomie
 *  i nie chce go klikac od nowa po kazdym wejsciu w wizytowke. */
export function loadRadius(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return RADIUS_OPTIONS.includes(n as any) ? n : null;
  } catch { return null; }
}

export function saveRadius(km: number | null) {
  try {
    if (km === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(km));
  } catch { /* prywatne okno / zablokowane dane - filtr zyje wtedy tylko do wyjscia */ }
}

// TYP MIEJSCA (prosba Nat 2026-09-26: „poza odlegloscia filtry kategorii - restauracje, atrakcje
// itd."). Zestaw chipow wziety z tego, co naprawde jest w bazie (restauracje i kawiarnie to
// ponad polowa wizytowek), a nie z calego drzewa kategorii - chip, pod ktorym nic nie ma, to
// pusty ekran. Id to podkategoria ALBO kategoria glowna; PlaceSwiper rozwija glowne na
// podkategorie sam (`getSubcategoryIds`). Wybor wielokrotny, laczony przez LUB.
export const CATEGORY_FILTERS = ["restaurant", "cafe", "bar", "bakery", "museum", "monument", "gallery", "attractions", "park", "viewpoint", "shopping", "entertainment"] as const;
const CATS_KEY = "spontaway_places_cats_v1";

export function loadCategories(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CATS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((c) => (CATEGORY_FILTERS as readonly string[]).includes(c)) : [];
  } catch { return []; }
}
export function saveCategories(cats: string[]) {
  try {
    if (!cats.length) localStorage.removeItem(CATS_KEY);
    else localStorage.setItem(CATS_KEY, JSON.stringify(cats));
  } catch { /* jak przy promieniu - filtr zyje wtedy tylko do wyjscia */ }
}
// KRAJ I MIASTO (prosba Nat 2026-09-26): NIE chipy, tylko selektor z wyszukiwarka - krajow
// i miast jest kilkadziesiat, rzad chipow bylby nie do przejrzenia. Wartosci z BAZY
// (`fetchPlaceCities`), wiec nie da sie wybrac miasta, w ktorym nie mamy wizytowek.
export type PlaceScope = { country: string | null; city: string | null };
const SCOPE_KEY = "spontaway_places_scope_v1";
export function loadScope(): PlaceScope {
  try {
    const raw = JSON.parse(localStorage.getItem(SCOPE_KEY) ?? "null");
    return { country: typeof raw?.country === "string" ? raw.country : null, city: typeof raw?.city === "string" ? raw.city : null };
  } catch { return { country: null, city: null }; }
}
export function saveScope(v: PlaceScope) {
  try {
    if (!v.country && !v.city) localStorage.removeItem(SCOPE_KEY);
    else localStorage.setItem(SCOPE_KEY, JSON.stringify(v));
  } catch { /* jak przy promieniu */ }
}
// Szukanie bez polskich znakow: „lodz" znajduje „Łódź".
const fold = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

const catLabel = (id: string) => MAIN_CATEGORIES.some((c) => c.id === id) ? mainCategoryLabel(id) : placeCategoryLabel(id);

export default function DistanceFilterSheet({ open, onOpenChange, value, onChange, categories, onCategoriesChange, scope, onScopeChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Aktywny promien w km albo null = bez ograniczenia. */
  value: number | null;
  onChange: (km: number | null) => void;
  /** Wybrane typy miejsc (puste = wszystkie). */
  categories: string[];
  onCategoriesChange: (cats: string[]) => void;
  /** Kraj i miasto (null = wszedzie). */
  scope: PlaceScope;
  onScopeChange: (v: PlaceScope) => void;
}) {
  const { t } = useTranslation("plan");
  // Podwidok selektora w TYM SAMYM arkuszu (drugi arkusz na arkuszu gubil gest zamkniecia).
  const [pick, setPick] = useState<null | "country" | "city">(null);
  const [q, setQ] = useState("");
  const { data: cities = [] } = useQuery({ queryKey: placeCitiesKey, queryFn: fetchPlaceCities, staleTime: 60 * 60_000, enabled: open });
  const countries = useMemo(
    () => countriesOf(cities).filter((c) => c.country !== null)
      .map((c) => ({ id: c.country!, label: countryLabel(c.country!), count: c.count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [cities]);
  const cityOptions = useMemo(
    () => cities.filter((c) => !scope.country || c.country === scope.country)
      .map((c) => ({ id: c.city, label: c.city, count: c.count, country: c.country }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl")),
    [cities, scope.country]);
  const openPick = (k: "country" | "city") => { haptics.light(); setQ(""); setPick(k); };
  const choosePick = (id: string | null) => {
    haptics.selection();
    if (pick === "country") {
      // Zmiana kraju czysci miasto spoza niego; kraj z JEDNYM miastem wybiera je od razu.
      const inC = id ? cities.filter((c) => c.country === id) : [];
      const keep = scope.city && inC.some((c) => c.city === scope.city) ? scope.city : null;
      onScopeChange({ country: id, city: keep ?? (inC.length === 1 ? inC[0].city : null) });
    } else {
      // Miasto samo ustawia swoj kraj - inaczej wiersz „Kraj" klamalby „Wszystkie".
      const c = id ? cities.find((x) => x.city === id) : null;
      onScopeChange({ country: id ? (c?.country ?? scope.country) : scope.country, city: id });
    }
    setPick(null);
  };

  // Od 2026-09-26 arkusz ma DWIE sekcje, wiec wybor promienia go juz nie zamyka - user moze
  // jeszcze zmienic typ miejsca. Zamyka guzik „Gotowe" albo gest.
  const choose = async (km: number | null) => {
    haptics.selection();
    if (km === null) { onChange(null); return; }
    // Punkt odniesienia juz jest (GPS albo punkt startowy) - filtrujemy od razu.
    if (getReference()) { onChange(km); return; }
    const res = await askPermission("location", "distance", { explicit: true });
    if (res !== "granted") return;          // odmowa: zostaje "Dowolna"
    await setGpsReference();
    if (!getReference()) return;            // GPS nie oddal pozycji - nie udajemy, ze filtr dziala
    onChange(km);
  };
  const toggleCat = (id: string) => {
    haptics.selection();
    onCategoriesChange(categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id]);
  };

  const Row = ({ km, label }: { km: number | null; label: string }) => {
    const active = value === km;
    return (
      <button
        onClick={() => void choose(km)}
        aria-pressed={active}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-transform active:scale-[0.99] ${
          active ? "bg-[#FDF184] text-[#5B2C06]" : "bg-muted/60 text-foreground"
        }`}
      >
        <BrandPin className={`h-4 w-4 shrink-0 ${active ? "text-[#5B2C06]" : "text-muted-foreground"}`} />
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        {active && <BrandCheck className="h-4 w-4 shrink-0" />}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) setPick(null); onOpenChange(v); }}>
      <SheetContent side="bottom" className="px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        {pick ? (() => {
          const opts = pick === "country" ? countries : cityOptions;
          const f = fold(q.trim());
          const shown = f ? opts.filter((o) => fold(o.label).includes(f) || fold(o.id).includes(f)) : opts;
          const current = pick === "country" ? scope.country : scope.city;
          const Item = ({ id, label, count }: { id: string | null; label: string; count?: number }) => (
            <button onClick={() => choosePick(id)} aria-pressed={current === id}
              className="flex w-full items-center gap-3 py-3.5 text-left border-b border-border/40 active:bg-muted/40">
              <span className="flex-1 text-[15px] font-semibold text-foreground">{label}</span>
              {count != null && <span className="text-[13px] text-muted-foreground tabular-nums">{count}</span>}
              {current === id && <BrandCheck className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
          return (
            <div className="flex flex-col min-h-[60dvh]">
              <div className="flex items-center gap-2 pr-8">
                <button onClick={() => setPick(null)} aria-label={t("place_filters.back")} className="-ml-2 h-9 w-9 flex items-center justify-center rounded-full active:bg-muted">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <SheetTitle className="text-lg font-black">{pick === "country" ? t("place_filters.country") : t("place_filters.city")}</SheetTitle>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-full bg-muted/70 border border-border/50 px-4">
                <BrandSearch className="h-4 w-4 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} autoCorrect="off"
                  placeholder={pick === "country" ? t("place_filters.search_country") : t("place_filters.search_city")}
                  className="flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground/60" />
              </div>
              <div className="mt-2">
                {!f && <Item id={null} label={pick === "country" ? t("place_filters.all_countries") : t("place_filters.all_cities")} />}
                {shown.map((o) => <Item key={o.id} id={o.id} label={o.label} count={o.count} />)}
                {f && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("place_filters.no_match")}</p>}
              </div>
            </div>
          );
        })() : (<>
        <div className="flex items-center justify-between pr-8">
          <SheetTitle className="text-lg font-black">{t("place_filters.title")}</SheetTitle>
          {(categories.length > 0 || value !== null || scope.country || scope.city) && (
            <button onClick={() => { haptics.light(); onCategoriesChange([]); onChange(null); onScopeChange({ country: null, city: null }); }} className="text-sm font-semibold text-primary active:opacity-70">
              {t("place_filters.clear")}
            </button>
          )}
        </div>
        {/* Kraj i miasto - selektory, nie chipy (patrz komentarz przy PlaceScope). */}
        <p className="mt-4 text-[13px] font-bold text-muted-foreground">{t("place_filters.where")}</p>
        <div className="mt-2 overflow-hidden rounded-2xl bg-muted/60">
          {(["country", "city"] as const).map((k, i) => {
            const val = k === "country" ? (scope.country ? countryLabel(scope.country) : t("place_filters.all_countries")) : (scope.city ?? t("place_filters.all_cities"));
            const set = k === "country" ? !!scope.country : !!scope.city;
            return (
              <button key={k} onClick={() => openPick(k)}
                className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted", i === 1 && "border-t border-border/50")}>
                <span className="text-[15px] font-semibold text-foreground">{k === "country" ? t("place_filters.country") : t("place_filters.city")}</span>
                <span className={cn("ml-auto truncate text-[14px]", set ? "font-bold text-[#5B2C06]" : "text-muted-foreground")}>{val}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] font-bold text-muted-foreground">{t("place_filters.type")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((id) => {
            const on = categories.includes(id);
            return (
              <button key={id} onClick={() => toggleCat(id)} aria-pressed={on}
                className={cn("rounded-full px-3.5 py-2 text-[13.5px] font-bold active:scale-95 transition-all",
                  on ? "bg-[#FDF184] text-[#5B2C06]" : "bg-secondary text-foreground")}>
                {catLabel(id)}
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-[13px] font-bold text-muted-foreground">{t("distance.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{t("distance.desc")}</p>
        <div className="mt-3 flex flex-col gap-2">
          <Row km={null} label={t("distance.any")} />
          {RADIUS_OPTIONS.map((km) => (
            <Row key={km} km={km} label={t("distance.up_to_km", { km })} />
          ))}
        </div>
        <button onClick={() => onOpenChange(false)} className="mt-5 h-12 w-full rounded-full bg-primary text-white text-[15px] font-bold active:scale-[0.98] transition-transform">
          {t("place_filters.done")}
        </button>
        </>)}
      </SheetContent>
    </Sheet>
  );
}
