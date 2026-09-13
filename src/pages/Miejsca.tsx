import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TabTopBar from "@/components/layout/TabTopBar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import { useTabSearch, TabSearchField, TabSearchButton, TabSearchResults } from "@/components/home/TabSearch";
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
// Wyszukiwarka (prosba Nat 2026-09-11): lupka obok dzwonka. Po tapnieciu z belki znikaja
// przelacznik i ikony, a pole dostaje cala szerokosc; wyniki zastepuja swiper (ktory zostaje
// zamontowany, tylko schowany - po powrocie jest dokladnie tam, gdzie byl).
//
// UWAGA na wysokosc chrome: PlaceSwiper (zamrozony, CLAUDE.md) liczy wysokosc karty 9:16
// ze STALEGO chrome (TabTopBar 3.25rem + BottomNav). Nad swiperem NIE moze stanac nic poza
// TabTopBar - kazdy dodatkowy wiersz przesunie karte pod pasek nawigacji.
export default function Miejsca() {
  const { t } = useTranslation("explore");
  const { user } = useAuth();
  const location = useLocation();
  const search = useTabSearch();
  // "Biezace polozenie" z feedu/eksploracji -> wejscie tu z prosba o sortowanie od najblizszego.
  const [nearbyNonce, setNearbyNonce] = useState(() => ((location.state as any)?.nearby ? 1 : 0));
  useEffect(() => { if ((location.state as any)?.nearby) setNearbyNonce((n) => n + 1); }, [location.state]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TabTopBar>
        {search.open ? (
          <TabSearchField s={search} autoFocus />
        ) : (
          <>
            <h1 className="text-lg font-bold text-foreground shrink-0">{t("places.tab_cards")}</h1>
            <div className="flex-1" />
            <TabSearchButton s={search} />
            {user && !(user as any).is_anonymous && <NotificationsBell userId={user.id} />}
          </>
        )}
      </TabTopBar>
      {search.open && <TabSearchResults s={search} />}
      <div className={cn("flex-1 min-h-0 flex flex-col", search.open && "hidden")}>
        <ExploreSwiper city="all" active={!search.open} sortNearestNonce={nearbyNonce} />
      </div>
    </div>
  );
}
