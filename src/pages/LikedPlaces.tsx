import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PullToRefresh } from "@/components/PullToRefresh";
import CitySelect from "@/components/home/CitySelect";
import TabTopBar from "@/components/layout/TabTopBar";
import { SavedCollections } from "@/components/home/DiscoveryFeed";
import { useActiveCity } from "@/hooks/useActiveCity";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LikedTab } from "./Explore";

// Zakladka Zapisane (bottom nav): selektor miasta w naglowku + toggle Miejsca | Zestawienia.
const LikedPlaces = () => {
  const queryClient = useQueryClient();
  const { t: tE } = useTranslation("explore");
  // Tryb zaznaczania miejsc do trasy (wlaczany z menu trzech kropek).
  const [selectMode, setSelectMode] = useState(false);
  const [tab, setTab] = useState<"places" | "collections">("places");
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
              <DropdownMenuItem onClick={() => { setTab("places"); setSelectMode(true); }} className="gap-2 rounded-xl cursor-pointer">
                <ListChecks className="h-4 w-4" />
                {tE("liked.select_places")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TabTopBar>

      {/* Toggle Miejsca | Zestawienia - szybkie przejscie do konkretnego widoku */}
      <div className="px-4 pt-3">
        <div className="flex items-center rounded-full bg-secondary p-0.5 text-sm font-bold">
          <button
            onClick={() => { setTab("places"); setSelectMode(false); }}
            className={cn("flex-1 py-2 rounded-full transition-colors", tab === "places" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            Miejsca
          </button>
          <button
            onClick={() => { setTab("collections"); setSelectMode(false); }}
            className={cn("flex-1 py-2 rounded-full transition-colors", tab === "collections" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            Zestawienia
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pt-3">
        {tab === "places" ? (
          <LikedTab selectMode={selectMode} onExitSelection={() => setSelectMode(false)} city={city} />
        ) : (
          <SavedCollections />
        )}
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
