import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Search } from "lucide-react";
import PinnedSearchField from "@/components/layout/PinnedSearchField";
import SearchCategoryRow, { type SearchCat } from "@/components/home/SearchCategoryRow";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

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
  // Tryb wynikow = pelny ekran: dolny pasek schowany (jak w Eksploracji), wraca po zamknieciu.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: open }));
  }, [open]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);
  // Foldery kategorii chowaja sie po wpisaniu frazy: pusta = przegladanie po kategoriach.
  const foldersVisible = open && query.trim().length === 0;
  return { open, query, setQuery, cat, setCat, inputRef, openSearch, closeSearch, foldersVisible };
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
          onClick={s.closeSearch}
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

/** Panel wynikow: foldery kategorii (dopoki fraza pusta) + wyniki. Wlasny scroller - zastepuje
 *  tresc zakladki na czas szukania. */
export function TabSearchResults({ s, city = "all" }: { s: TabSearchState; city?: string }) {
  const { t } = useTranslation("explore");
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom,0px))]" style={{ WebkitOverflowScrolling: "touch" }}>
      <div
        className={cn(
          "overflow-hidden border-b border-border/40 transition-all duration-200 ease-out",
          s.foldersVisible ? "max-h-[160px] opacity-100 mb-4" : "max-h-0 opacity-0 border-b-0",
        )}
      >
        <p className="px-4 pt-3 text-sm font-bold text-foreground">{t("search.by_category")}</p>
        <SearchCategoryRow value={s.cat} onChange={s.setCat} />
        <div className="h-3" />
      </div>
      <div className="px-4">
        <DiscoveryFeed searchOnly active={false} city={city} searchOpen searchQuery={s.query} searchCategory={s.cat} />
      </div>
    </div>
  );
}
