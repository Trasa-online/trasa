import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PullToRefresh } from "@/components/PullToRefresh";
import CitySelect from "@/components/home/CitySelect";
import TabTopBar from "@/components/layout/TabTopBar";
import { useActiveCity } from "@/hooks/useActiveCity";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LikedTab } from "./Explore";

// Zakladka Zapisane (bottom nav): selektor miasta w naglowku + lista zapisanych miejsc.
const LikedPlaces = () => {
  const queryClient = useQueryClient();
  const { t: tE } = useTranslation("explore");
  // Tryb zaznaczania miejsc do trasy (wlaczany z menu trzech kropek).
  const [selectMode, setSelectMode] = useState(false);
  const [city, setCity] = useActiveCity();

  return (
    <PullToRefresh
      onRefresh={async () => { await queryClient.invalidateQueries(); }}
      className="flex-1 flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
    >
      {/* Naglowek: selektor miasta (jak na widoku glownym) + akcje */}
      <TabTopBar>
        <CitySelect city={city} onCityChange={setCity} allowAll />
        <div className="flex-1" />
        {selectMode ? (
          <button
            onClick={() => setSelectMode(false)}
            className="shrink-0 px-3 h-8 flex items-center rounded-full text-sm font-semibold text-primary active:bg-muted transition-colors"
          >
            {tE("liked.cancel_select")}
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={tE("liked.select_places")}
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => setSelectMode(true)} className="gap-2 rounded-xl cursor-pointer">
                <ListChecks className="h-4 w-4" />
                {tE("liked.select_places")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TabTopBar>

      {/* Toggle Miejsca|Zestawienia usunięty (2026-07-26) - Zapisane pokazują tylko
          zapisane miejsca. Zestawienia (SavedCollections) wstrzymane. */}
      <div className="flex-1 px-4 pt-3">
        <LikedTab selectMode={selectMode} onExitSelection={() => setSelectMode(false)} city={city} />
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
