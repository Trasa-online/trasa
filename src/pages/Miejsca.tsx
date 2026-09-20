import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import TabTopBar from "@/components/layout/TabTopBar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import { useTabSearch, TabSearchField, TabSearchResults } from "@/components/home/TabSearch";
import { useAuth } from "@/hooks/useAuth";
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
// UWAGA na wysokosc chrome: PlaceSwiper (zamrozony, CLAUDE.md) liczy wysokosc karty 9:16
// ze STALEGO chrome (TabTopBar 3.25rem + BottomNav). Nad swiperem NIE moze stanac nic poza
// TabTopBar - kazdy dodatkowy wiersz przesunie karte pod pasek nawigacji.
export default function Miejsca() {
  const { user } = useAuth();
  const location = useLocation();
  const search = useTabSearch();
  // "Biezace polozenie" z feedu/eksploracji -> wejscie tu z prosba o sortowanie od najblizszego.
  const [nearbyNonce, setNearbyNonce] = useState(() => ((location.state as any)?.nearby ? 1 : 0));
  useEffect(() => { if ((location.state as any)?.nearby) setNearbyNonce((n) => n + 1); }, [location.state]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabTopBar>
        <TabSearchField s={search} />
        {!search.open && user && !(user as any).is_anonymous && <NotificationsBell userId={user.id} />}
      </TabTopBar>
      {/* `scope` = pasek wyboru kraju i miasta nad wynikami (prosba Nat 2026-09-15). Tylko tu:
          w Eksploracji i na profilu szuka sie tresci, a nie miejsc w konkretnym miescie. */}
      {search.open && <TabSearchResults s={search} scope />}
      <div className={cn("flex-1 min-h-0 flex flex-col", search.open && "hidden")}>
        <ExploreSwiper city="all" active={!search.open} sortNearestNonce={nearbyNonce} />
      </div>
    </div>
  );
}
