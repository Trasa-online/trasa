import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";
import { BrandIcon, LIST_ICON, BrandSearch } from "@/components/BrandIcon";
import PinnedSearchField from "@/components/layout/PinnedSearchField";
import { type SearchCat } from "@/components/home/SearchCategoryRow";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { haptics } from "@/hooks/useHaptics";
import { fetchPlaceCities, countriesOf, placeCitiesKey } from "@/lib/placeCities";

// Wyszukiwarka w KAZDEJ zakladce (prosba Nat 2026-09-11): Feed, Eksploruj i Miejsca maja
// te sama wyszukiwarke - jedno pole w belce, tryb wynikow ze strzalka powrotu, foldery
// kategorii i wyniki z DiscoveryFeed (searchOnly). Eksploruj ma wlasna belke (ExploreTopBar,
// zostaje jak byla); Feed i Miejsca biora stad hook + pole + panel wynikow, zeby logika byla
// jedna, a nie trzy razy przepisana.

export function useTabSearch(initial?: { open?: boolean; cat?: SearchCat }) {
  const [open, setOpen] = useState(initial?.open ?? false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<SearchCat>(initial?.cat ?? "all");
  // Zasieg geograficzny wyszukiwarki (prosba Nat 2026-09-15). Do tej pory szukalo sie po
  // CALEJ bazie naraz i trzeba bylo znac nazwe lokalu - czyli wiedziec z gory to, czego sie
  // szuka. Kraj i miasto zamieniaja wyszukiwarke w przegladanie: "pokaz mi miejsca w Krakowie"
  // dziala BEZ wpisywania frazy.
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openSearch = () => setOpen(true);
  const closeSearch = () => { setOpen(false); setQuery(""); setCat("all"); setCountry(null); setCity(null); inputRef.current?.blur(); };
  // Strzalka w belce: najpierw zdejmuje zasieg (miasto -> kraj), potem wychodzi z kategorii,
  // na koncu zamyka szukanie. Kazde tapniecie cofa DOKLADNIE jeden krok zawezenia.
  const back = () => {
    if (city) { setCity(null); return; }
    if (country) { setCountry(null); return; }
    if (cat !== "all") { setCat("all"); setQuery(""); return; }
    closeSearch();
  };
  // Tryb wynikow = pelny ekran: dolny pasek schowany (jak w Eksploracji), wraca po zamknieciu.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: open }));
  }, [open]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);
  // Foldery kategorii chowaja sie po wpisaniu frazy: pusta = przegladanie po kategoriach.
  const foldersVisible = open && query.trim().length === 0;
  return { open, query, setQuery, cat, setCat, country, setCountry, city, setCity, inputRef, openSearch, closeSearch, back, foldersVisible };
}
export type TabSearchState = ReturnType<typeof useTabSearch>;

/** Pole w belce: przypiete (Feed) albo tylko w trybie wynikow (Miejsca - patrz `TabSearchButton`).
 *  W trybie wynikow z przodu stoi strzalka powrotu, a pole dostaje cala belke. */
export function TabSearchField({ s, autoFocus }: { s: TabSearchState; autoFocus?: boolean }) {
  const { t } = useTranslation("explore");
  return (
    <>
      {s.open && (
        <button
          onClick={s.back}
          aria-label={t("search.close")}
          className="shrink-0 -ml-1 h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </button>
      )}
      <PinnedSearchField
        ref={s.inputRef}
        value={s.query}
        onChange={s.setQuery}
        onFocus={s.openSearch}
        autoFocus={autoFocus}
        placeholder={s.open ? t("search.placeholder_all") : t("common:buttons.search")}
        aria-label={t("common:buttons.search")}
      />
    </>
  );
}

/** Lupka w belce (Miejsca): otwiera tryb wynikow, w ktorym belka pokazuje juz tylko pole. */
export function TabSearchButton({ s }: { s: TabSearchState }) {
  const { t } = useTranslation("common");
  return (
    <button
      onClick={() => { haptics.light(); s.openSearch(); }}
      aria-label={t("buttons.search")}
      // Ten sam okragly ksztalt, co dzwonek obok (NotificationsBell) - jeden jezyk ikon w belce.
      className="relative shrink-0 h-9 w-9 flex items-center justify-center rounded-full bg-muted/70 border border-border/50 text-foreground active:scale-95 transition-transform"
    >
      <BrandSearch className="h-4 w-4" />
    </button>
  );
}

// Lista kategorii JEDNA POD DRUGA (prosba Nat 2026-09-11, wzor: wyszukiwarka FYI) zamiast
// rzedu folderow: ikona, nazwa, podtytul, strzalka. Tapniecie wchodzi w kategorie - wyniki
// tylko z niej (ludzie sami, wyjazdy same, listy same - kazda jako lista, nie siatka).
const CATS: { id: Exclude<SearchCat, "all">; labelKey: string; subKey: string }[] = [
  { id: "lists",  labelKey: "common:filters.lists",  subKey: "search.cat_sub_lists" },
  { id: "trips",  labelKey: "common:filters.trips",  subKey: "search.cat_sub_trips" },
  { id: "places", labelKey: "common:filters.places", subKey: "search.cat_sub_places" },
  { id: "people", labelKey: "common:filters.people", subKey: "search.cat_sub_people" },
];
function CatIcon({ id }: { id: SearchCat }) {
  if (id === "trips") return <img src="/spontaway-symbol.png" alt="" className="h-5 w-[22px] object-contain" />;
  if (id === "lists") return <BrandIcon src={LIST_ICON} className="h-5 w-5 text-foreground" />;
  if (id === "places") return <MapPin className="h-5 w-5 text-foreground" strokeWidth={2} />;
  return <Users className="h-5 w-5 text-foreground" strokeWidth={2} />;
}
export function SearchCategoryList({ onPick }: { onPick: (c: SearchCat) => void }) {
  const { t } = useTranslation("explore");
  return (
    <div className="px-4 pt-3">
      <p className="text-sm font-bold text-foreground">{t("search.categories_title")}</p>
      <div className="mt-2 divide-y divide-border/40">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => { haptics.selection(); onPick(c.id); }}
            className="flex w-full items-center gap-3.5 py-3.5 text-left active:bg-muted/40 transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><CatIcon id={c.id} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-tight text-foreground">{t(c.labelKey)}</span>
              <span className="block text-[12.5px] leading-snug text-muted-foreground">{t(c.subKey)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ScopeChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={() => { haptics.selection(); onClick(); }}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold whitespace-nowrap active:scale-95 transition-all ${
        active ? "bg-[#FDF184] text-[#5B2C06]" : "bg-secondary text-foreground"
      }`}
    >
      {label}{count != null && <span className="ml-1.5 font-semibold opacity-60 tabular-nums">{count}</span>}
    </button>
  );
}

/**
 * Wybor KRAJU i MIASTA w wyszukiwarce Miejsc (prosba Nat 2026-09-15).
 *
 * Lista jest budowana z BAZY (`placeCities`), wiec nie da sie wybrac miasta, w ktorym nie
 * mamy ani jednej wizytowki. Rzad miast pojawia sie DOPIERO po wybraniu kraju - inaczej
 * kilkanascie chipow z roznych krajow lezaloby obok siebie bez porzadku. Kraj z jednym
 * miastem od razu je zaznacza (klik w "Czechy" ma pokazac Prage, nie kazac klikac drugi raz).
 */
export function SearchScopeBar({ s }: { s: TabSearchState }) {
  const { t } = useTranslation("explore");
  const { data: cities = [] } = useQuery({ queryKey: placeCitiesKey, queryFn: fetchPlaceCities, staleTime: 60 * 60_000 });
  const countries = useMemo(() => countriesOf(cities), [cities]);
  const inCountry = useMemo(
    () => cities.filter((c) => c.country === s.country).sort((a, b) => b.count - a.count),
    [cities, s.country]);

  if (cities.length === 0) return null;

  const pickCountry = (name: string | null) => {
    s.setCountry(name);
    const only = name === null ? [] : cities.filter((c) => c.country === name);
    // Kraj z jednym miastem = wybor miasta jest oczywisty, wiec go nie wymuszamy klikiem.
    s.setCity(only.length === 1 ? only[0].city : null);
  };

  return (
    <div className="space-y-2 px-4 pt-3">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        <ScopeChip active={s.country === null} label={t("scope.everywhere")} onClick={() => pickCountry(null)} />
        {countries.map((c) => (
          <ScopeChip
            key={c.country ?? "_"}
            active={s.country === c.country}
            label={c.country ?? t("scope.other_countries")}
            count={c.count}
            onClick={() => pickCountry(c.country)}
          />
        ))}
      </div>
      {s.country !== null && inCountry.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <ScopeChip active={s.city === null} label={t("scope.all_cities")} onClick={() => s.setCity(null)} />
          {inCountry.map((c) => (
            <ScopeChip key={c.city} active={s.city === c.city} label={c.city} count={c.count} onClick={() => s.setCity(c.city)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tresc wyszukiwarki (bez wlasnego scrollera - Eksploruj i profil maja swoje):
 *  bez frazy i bez kategorii = lista kategorii; w kategorii bez frazy = jej naglowek + tresc
 *  kategorii; z fraza = wyniki (w kategorii albo we wszystkich). */
export function SearchPane({ query, cat, onCat, city = "all", scopeCity = null }: { query: string; cat: SearchCat; onCat: (c: SearchCat) => void; city?: string;
  /** Miasto wybrane w pasku zasiegu - zaweza wyniki i wlacza przegladanie BEZ frazy. */
  scopeCity?: string | null }) {
  const { t } = useTranslation("explore");
  const typing = query.trim().length > 0;
  // Wybrane miasto samo w sobie jest zapytaniem ("pokaz, co macie w Krakowie"), wiec zamiast
  // listy kategorii pokazujemy od razu miejsca - to jest sedno prosby "wyszukiwarka nie
  // spelnia swojej funkcji".
  const browsingCity = !typing && cat === "all" && !!scopeCity;
  if (!typing && cat === "all" && !scopeCity) return <SearchCategoryList onPick={onCat} />;
  const effCat: SearchCat = browsingCity ? "places" : cat;
  return (
    <div className="px-4">
      {!typing && (
        <div className="flex items-center gap-3 pt-3 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><CatIcon id={effCat} /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-tight text-foreground">{browsingCity ? scopeCity : t(`common:filters.${effCat}`)}</p>
            <p className="text-[12.5px] text-muted-foreground">{t(`search.cat_sub_${effCat}`)}</p>
          </div>
        </div>
      )}
      <DiscoveryFeed searchOnly active={false} city={city} searchCity={scopeCity ?? undefined} searchOpen searchQuery={query} searchCategory={effCat} />
    </div>
  );
}

/** Panel wynikow z wlasnym scrollerem - zastepuje tresc zakladki na czas szukania (Feed, Miejsca). */
export function TabSearchResults({ s, city = "all", scope = false }: { s: TabSearchState; city?: string;
  /** true = nad wynikami staje pasek wyboru kraju i miasta (zakladka Miejsca). */
  scope?: boolean }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))]" style={{ WebkitOverflowScrolling: "touch" }}>
      {scope && <SearchScopeBar s={s} />}
      <SearchPane query={s.query} cat={s.cat} onCat={s.setCat} city={city} scopeCity={scope ? s.city : null} />
    </div>
  );
}
