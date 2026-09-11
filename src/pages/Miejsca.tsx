import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import TabTopBar from "@/components/layout/TabTopBar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import ExploreSwiper from "@/components/home/ExploreSwiper";
import { useTabSearch, TabSearchField, TabSearchButton, TabSearchResults } from "@/components/home/TabSearch";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

// MIEJSCA - wlasna zakladka (IA 2026-09-11, makieta Nat). Do tej pory wizytowki miejsc
// siedzialy pod przelacznikiem Trasy|Miejsca w eksploracji, ktorego domyslna pozycja byly
// Trasy - czyli polowa produktu (i powierzchnia, na ktorej zarabiamy: wizytowki lokali)
// byla schowana. Teraz ma wlasne wejscie z dolnego paska.
//
// Drugi segment, "Wydarzenia" (od klientow biznesowych), jest w makiecie jako COMING SOON -
// nie ma jeszcze widoku, wiec zostaje sam napis; tapniecie mowi "wkrotce".
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
            <div className="flex items-center rounded-full bg-secondary p-0.5 shrink-0">
              <span className="h-8 px-3.5 flex items-center rounded-full bg-white text-foreground text-xs font-bold shadow-sm" aria-current="true">
                {t("places.tab_cards")}
              </span>
              <button
                type="button"
                onClick={() => { haptics.light(); toast(t("places.events_soon_toast")); }}
                className="h-8 px-3 flex items-center gap-1.5 rounded-full text-secondary-foreground/60 text-xs font-bold active:scale-95 transition-transform whitespace-nowrap"
              >
                {t("places.tab_events")}
                <span className="rounded-full bg-[#FDF184] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#5B2C06]">{t("places.soon")}</span>
              </button>
            </div>
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
