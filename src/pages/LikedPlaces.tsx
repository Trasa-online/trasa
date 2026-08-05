import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import CitySelect from "@/components/home/CitySelect";
import TabTopBar from "@/components/layout/TabTopBar";
import { useActiveCity } from "@/hooks/useActiveCity";
import { SavedRoutes } from "@/components/home/DiscoveryFeed";
import { LikedTab } from "@/pages/Explore";
import { cn } from "@/lib/utils";

// Zakladka Zapisane (bottom nav): selektor miasta w naglowku + segmentowy toggle
// Miejsca | Trasy (2026-08-05). "Miejsca" = zapisane miejsca (LikedTab, localStorage
// polubienia). "Trasy" = zapisane trasy od innych (saved_routes) + zapisane zestawienia.
// Oba filtrowane wspolnym miastem z naglowka.
type SavedTab = "places" | "routes";

const LikedPlaces = () => {
  const queryClient = useQueryClient();
  const [city, setCity] = useActiveCity();
  const [tab, setTab] = useState<SavedTab>("places");

  return (
    <PullToRefresh
      onRefresh={async () => { await queryClient.invalidateQueries(); }}
      className="flex-1 flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
    >
      {/* Naglowek: selektor miasta (jak na widoku glownym) */}
      <TabTopBar>
        <CitySelect city={city} onCityChange={setCity} allowAll />
        <div className="flex-1" />
      </TabTopBar>

      {/* Segmentowy toggle Miejsca | Trasy */}
      <div className="px-4 pt-3">
        <div className="flex p-1 bg-secondary rounded-full">
          {([
            { id: "places", label: "Miejsca" },
            { id: "routes", label: "Trasy" },
          ] as { id: SavedTab; label: string }[]).map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                "flex-1 h-9 rounded-full text-sm font-bold transition-colors active:scale-[0.98]",
                tab === s.id ? "bg-background text-foreground shadow-sm" : "text-secondary-foreground/70",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pt-3">
        {tab === "places"
          ? <LikedTab city={city} />
          : <SavedRoutes city={city} />}
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
