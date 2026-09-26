import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import TabTopBar from "@/components/layout/TabTopBar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import DistanceFilterSheet, { loadRadius, saveRadius, loadCategories, saveCategories, loadScope, saveScope, type PlaceScope } from "@/components/places/DistanceFilterSheet";
import { fetchPlaceCities, placeCitiesKey } from "@/lib/placeCities";
import { useTabSearch, TabSearchField, TabSearchResults, SearchScopeFilter } from "@/components/home/TabSearch";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { getSystemStatus } from "@/lib/permissionPrompts";
import { getReference, setGpsReference } from "@/lib/distanceReference";
import { cn } from "@/lib/utils";

// MIEJSCA - wlasna zakladka (IA 2026-09-11, makieta Nat). Do tej pory wizytowki miejsc
// siedzialy pod przelacznikiem Trasy|Miejsca w eksploracji, ktorego domyslna pozycja byly
// Trasy - czyli polowa produktu (i powierzchnia, na ktorej zarabiamy: wizytowki lokali)
// byla schowana. Teraz ma wlasne wejscie z dolnego paska.
//
// Segment "Wydarzenia (wkrotce)" USUNIETY z belki (prosba Nat 2026-09-13) - wraca razem
// z realnym widokiem wydarzen od klientow biznesowych. Zostaje sam tytul "Wizytowki".
//
// Wyszukiwarka: pole PRZYPIETE w belce (jak w Eksploracji; prosba Nat 2026-09-14 - wczesniej
// sama lupka obok dzwonka i tytul "Wizytowki"). Po tapnieciu w pole znika dzwonek, z przodu
// staje strzalka, a wyniki zastepuja swiper (ktory zostaje zamontowany, tylko schowany - po
// powrocie jest dokladnie tam, gdzie byl).
//
// FILTR ODLEGLOSCI (prosba Nat 2026-09-24) siedzi w BELCE, nie nad swiperem - patrz uwaga
// o wysokosci chrome nizej. Aktywny promien pokazujemy LICZBA ("3 km") zamiast ikony:
// filtr, ktorego stanu nie widac, kaze otwierac arkusz za kazdym razem, zeby sprawdzic,
// czemu miejsc jest tak malo.
//
// UWAGA na wysokosc chrome: PlaceSwiper (zamrozony, CLAUDE.md) liczy wysokosc karty 9:16
// ze STALEGO chrome (TabTopBar 3.25rem + BottomNav). Nad swiperem NIE moze stanac nic poza
// TabTopBar - kazdy dodatkowy wiersz przesunie karte pod pasek nawigacji.
export default function Miejsca() {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useTranslation("plan");
  const search = useTabSearch();
  // "Biezace polozenie" z feedu/eksploracji -> wejscie tu z prosba o sortowanie od najblizszego.
  const [nearbyNonce, setNearbyNonce] = useState(() => ((location.state as any)?.nearby ? 1 : 0));
  useEffect(() => { if ((location.state as any)?.nearby) setNearbyNonce((n) => n + 1); }, [location.state]);
  // Promien czytamy z localStorage przy montowaniu - zakladka montuje sie od nowa po kazdym
  // wejsciu w wizytowke, wiec stan w pamieci komponentu kasowalby filtr co chwile.
  const [radiusKm, setRadiusKm] = useState<number | null>(() => loadRadius());
  const [filterOpen, setFilterOpen] = useState(false);
  const applyRadius = (km: number | null) => { setRadiusKm(km); saveRadius(km); };
  // Typ miejsca (2026-09-26) - ten sam arkusz co promien, zapamietany tak samo.
  const [cats, setCats] = useState<string[]>(() => loadCategories());
  const applyCats = (next: string[]) => { setCats(next); saveCategories(next); };
  // Kraj i miasto (2026-09-26). Do swipera idzie LISTA miast: jedno wybrane albo wszystkie
  // miasta wybranego kraju (kraj nie jest kolumna w `places`, tylko wynika z miasta).
  const [scope, setScope] = useState<PlaceScope>(() => loadScope());
  const applyScope = (next: PlaceScope) => { setScope(next); saveScope(next); };
  const { data: placeCities = [] } = useQuery({ queryKey: placeCitiesKey, queryFn: fetchPlaceCities, staleTime: 60 * 60_000 });
  const cityScope = useMemo(() => {
    if (scope.city) return [scope.city];
    if (scope.country) return placeCities.filter((c) => c.country === scope.country).map((c) => c.city);
    return undefined;
  }, [scope, placeCities]);
  const activeFilters = cats.length + (scope.country ? 1 : 0) + (scope.city ? 1 : 0);

  // ⚠️ Zapamietany promien bez punktu odniesienia NIE FILTRUJE nic - a pigulka "3 km" w belce
  // twierdzilaby, ze filtr dziala. Dzieje sie tak po wyczyszczeniu danych albo na drugim
  // urzadzeniu (promien siedzi w localStorage, punkt GPS tez, ale moga sie rozjechac).
  // Gdy zgoda jest - odtwarzamy punkt po cichu; gdy jej nie ma - zdejmujemy filtr i mowimy,
  // dlaczego. Lepiej pokazac wszystkie miejsca niz udawac filtr.
  useEffect(() => {
    if (!radiusKm || getReference()) return;
    let alive = true;
    void (async () => {
      if ((await getSystemStatus("location")) === "granted") await setGpsReference();
      if (!alive || getReference()) return;
      applyRadius(null);
      toast(t("distance.need_location"));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabTopBar>
        <TabSearchField s={search} />
        {/* Kraj + miasto wyszukiwania pod JEDNYM guzikiem (2026-09-25) - wczesniej dwa rzedy chipow nad wynikami. */}
        {search.open && <SearchScopeFilter s={search} />}
        {!search.open && (
          <button
            onClick={() => { haptics.light(); setFilterOpen(true); }}
            aria-label={t("place_filters.aria")}
            className={cn(
              "relative shrink-0 h-9 flex items-center justify-center rounded-full border transition-colors",
              radiusKm || activeFilters
                ? "bg-[#FDF184] border-[#FDF184] text-[#5B2C06] text-xs font-bold"
                : "bg-muted/70 border-border/50 text-foreground",
              radiusKm ? "px-3 gap-1" : "w-9",
            )}
          >
            {/* Aktywny promien pokazujemy LICZBA (jak dotad), a liczbe wybranych typow - plakietka
                w rogu: filtr, ktorego stanu nie widac, kaze otwierac arkusz, zeby sprawdzic,
                czemu miejsc jest tak malo. */}
            {radiusKm ? t("distance.chip_km", { km: radiusKm }) : <SlidersHorizontal className="h-4 w-4" />}
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-[18px] text-center">{activeFilters}</span>
            )}
          </button>
        )}
        {!search.open && user && !(user as any).is_anonymous && <NotificationsBell userId={user.id} />}
      </TabTopBar>
      {/* `scope` = pasek wyboru kraju i miasta nad wynikami (prosba Nat 2026-09-15). Tylko tu:
          w Eksploracji i na profilu szuka sie tresci, a nie miejsc w konkretnym miescie. */}
      {search.open && <TabSearchResults s={search} scope />}
      <div className={cn("flex-1 min-h-0 flex flex-col", search.open && "hidden")}>
        <ExploreSwiper
          city="all"
          active={!search.open}
          sortNearestNonce={nearbyNonce}
          maxDistanceKm={radiusKm}
          categoryFilter={cats}
          cityScope={cityScope}
          onClearDistance={() => applyRadius(null)}
        />
      </div>
      <DistanceFilterSheet open={filterOpen} onOpenChange={setFilterOpen} value={radiusKm} onChange={applyRadius} categories={cats} onCategoriesChange={applyCats} scope={scope} onScopeChange={applyScope} />
    </div>
  );
}
