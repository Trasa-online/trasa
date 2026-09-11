import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, FileText, MapPin, Search, Users } from "lucide-react";
import PinnedSearchField from "@/components/layout/PinnedSearchField";
import { type SearchCat } from "@/components/home/SearchCategoryRow";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { haptics } from "@/hooks/useHaptics";

// Wyszukiwarka w KAZDEJ zakladce (prosba Nat 2026-09-11): Feed, Eksploruj i Miejsca maja
// te sama wyszukiwarke - jedno pole w belce, tryb wynikow ze strzalka powrotu, foldery
// kategorii i wyniki z DiscoveryFeed (searchOnly). Eksploruj ma wlasna belke (ExploreTopBar,
// zostaje jak byla); Feed i Miejsca biora stad hook + pole + panel wynikow, zeby logika byla
// jedna, a nie trzy razy przepisana.

export function useTabSearch(initial?: { open?: boolean; cat?: SearchCat }) {
  const [open, setOpen] = useState(initial?.open ?? false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<SearchCat>(initial?.cat ?? "all");
  const inputRef = useRef<HTMLInputElement>(null);
  const openSearch = () => setOpen(true);
  const closeSearch = () => { setOpen(false); setQuery(""); setCat("all"); inputRef.current?.blur(); };
  // Strzalka w belce: z wnetrza kategorii wraca do listy kategorii, z listy - zamyka szukanie.
  const back = () => { if (cat !== "all") { setCat("all"); setQuery(""); } else closeSearch(); };
  // Tryb wynikow = pelny ekran: dolny pasek schowany (jak w Eksploracji), wraca po zamknieciu.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: open }));
  }, [open]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);
  // Foldery kategorii chowaja sie po wpisaniu frazy: pusta = przegladanie po kategoriach.
  const foldersVisible = open && query.trim().length === 0;
  return { open, query, setQuery, cat, setCat, inputRef, openSearch, closeSearch, back, foldersVisible };
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
      className="relative shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-foreground active:scale-95 transition-transform"
    >
      <Search className="h-4 w-4" />
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
  if (id === "lists") return <FileText className="h-5 w-5 text-foreground" strokeWidth={2} />;
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

/** Tresc wyszukiwarki (bez wlasnego scrollera - Eksploruj i profil maja swoje):
 *  bez frazy i bez kategorii = lista kategorii; w kategorii bez frazy = jej naglowek + tresc
 *  kategorii; z fraza = wyniki (w kategorii albo we wszystkich). */
export function SearchPane({ query, cat, onCat, city = "all" }: { query: string; cat: SearchCat; onCat: (c: SearchCat) => void; city?: string }) {
  const { t } = useTranslation("explore");
  const typing = query.trim().length > 0;
  if (!typing && cat === "all") return <SearchCategoryList onPick={onCat} />;
  return (
    <div className="px-4">
      {!typing && (
        <div className="flex items-center gap-3 pt-3 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary"><CatIcon id={cat} /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-tight text-foreground">{t(`common:filters.${cat}`)}</p>
            <p className="text-[12.5px] text-muted-foreground">{t(`search.cat_sub_${cat}`)}</p>
          </div>
        </div>
      )}
      <DiscoveryFeed searchOnly active={false} city={city} searchOpen searchQuery={query} searchCategory={cat} />
    </div>
  );
}

/** Panel wynikow z wlasnym scrollerem - zastepuje tresc zakladki na czas szukania (Feed, Miejsca). */
export function TabSearchResults({ s, city = "all" }: { s: TabSearchState; city?: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))]" style={{ WebkitOverflowScrolling: "touch" }}>
      <SearchPane query={s.query} cat={s.cat} onCat={s.setCat} city={city} />
    </div>
  );
}
