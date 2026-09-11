import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import TabTopBar from "@/components/layout/TabTopBar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import ActiveTripBanner from "@/components/home/ActiveTripBanner";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import { useTabSearch, TabSearchField, TabSearchResults } from "@/components/home/TabSearch";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// FEED (IA 2026-09-11, makieta Nat): tresci od osob, ktore obserwujesz, jedno wydarzenie na
// ekranie (pelnoekranowe karty ze snapem - dokladnie ten uklad, ktory do tej pory mial caly
// feed eksploracji). Tresci "od calego swiata" poszly do zakladki Eksploruj (siatka),
// a wizytowki miejsc do zakladki Miejsca.
//
// Belka = SAMA wyszukiwarka na cala szerokosc + dzwonek (prosba Nat 2026-09-11; wczesniej
// logo i napis "Feed"). Tryb wynikow zastepuje feed panelem wynikow - ta sama wyszukiwarka,
// co w Eksploruj i Miejscach (TabSearch).
//
// Sama lista i jej zapytania zyja w DiscoveryFeed (prop `followingOnly`) - ten ekran tylko
// daje jej belke, baner aktywnego wyjazdu i przewijanie ze snapem.
export default function Feed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = useTabSearch();
  // Baner wyjazdu chowa sie po zjechaniu w dol i wraca na samej gorze (jak w eksploracji).
  const [scrolled, setScrolled] = useState(false);
  const handleRefresh = async () => { await queryClient.invalidateQueries(); };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabTopBar>
        <TabSearchField s={search} />
        {!search.open && user && !(user as any).is_anonymous && <NotificationsBell userId={user.id} />}
      </TabTopBar>

      {search.open ? (
        <TabSearchResults s={search} />
      ) : (
        <div className="relative flex-1 min-h-0 flex flex-col">
          {/* Nakladka (nie element ukladu) - patrz komentarz w Explore.tsx: baner nie moze
              ruszac wysokosci scrollera, bo snap przelicza sie od nowa i karty skacza. */}
          <div className={cn("absolute inset-x-0 top-0 z-30 transition-all duration-200 ease-out",
            scrolled ? "-translate-y-[130%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100")}>
            <ActiveTripBanner floating />
          </div>
          <PullToRefresh
            onRefresh={handleRefresh}
            onScroll={(top) => setScrolled(top > 8)}
            className="flex-1 min-h-0 flex flex-col pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] snap-y snap-mandatory scroll-pt-3"
          >
            <div className="flex-1 px-4">
              <DiscoveryFeed city="all" followingOnly />
            </div>
          </PullToRefresh>
        </div>
      )}
    </div>
  );
}
