import { useQueryClient } from "@tanstack/react-query";
import { PullToRefresh } from "@/components/PullToRefresh";
import CitySelect from "@/components/home/CitySelect";
import TabTopBar from "@/components/layout/TabTopBar";
import { useActiveCity } from "@/hooks/useActiveCity";
import { SavedRoutes } from "@/components/home/DiscoveryFeed";

// Zakladka Zapisane (bottom nav): selektor miasta w naglowku + zapisane TRASY od innych
// uzytkownikow (2026-07-26 pivot: zestawienia + zapisane miejsca zastapione trasami).
const LikedPlaces = () => {
  const queryClient = useQueryClient();
  const [city, setCity] = useActiveCity();

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

      <div className="flex-1 px-4 pt-3">
        <SavedRoutes city={city} />
      </div>
    </PullToRefresh>
  );
};

export default LikedPlaces;
