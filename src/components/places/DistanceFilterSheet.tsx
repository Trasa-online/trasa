import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandCheck, BrandPin } from "@/components/BrandIcon";
import { haptics } from "@/hooks/useHaptics";
import { askPermission } from "@/lib/permissionPrompts";
import { getReference, setGpsReference } from "@/lib/distanceReference";
import { mainCategoryLabel, placeCategoryLabel, MAIN_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

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
const catLabel = (id: string) => MAIN_CATEGORIES.some((c) => c.id === id) ? mainCategoryLabel(id) : placeCategoryLabel(id);

export default function DistanceFilterSheet({ open, onOpenChange, value, onChange, categories, onCategoriesChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Aktywny promien w km albo null = bez ograniczenia. */
  value: number | null;
  onChange: (km: number | null) => void;
  /** Wybrane typy miejsc (puste = wszystkie). */
  categories: string[];
  onCategoriesChange: (cats: string[]) => void;
}) {
  const { t } = useTranslation("plan");

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between pr-8">
          <SheetTitle className="text-lg font-black">{t("place_filters.title")}</SheetTitle>
          {(categories.length > 0 || value !== null) && (
            <button onClick={() => { haptics.light(); onCategoriesChange([]); onChange(null); }} className="text-sm font-semibold text-primary active:opacity-70">
              {t("place_filters.clear")}
            </button>
          )}
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
      </SheetContent>
    </Sheet>
  );
}
