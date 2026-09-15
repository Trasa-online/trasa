import { useState, useEffect, useMemo } from "react";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { getTodayLikes } from "@/lib/exploreLikes";

// Swiper eksploracji (dawne /plan exploreMode) osadzony w widoku Eksploruj, zeby toggle
// feed<->swiper byl LOKALNY (seamless, bez zmiany trasy).
//
// FILTRY USUNIETE 2026-09-10 (decyzja Nat): drawer kategorii / sortowania / miasta zniknal
// razem z guzikiem filtrow w gornej belce. Zostaje sam strumien miejsc; jedyne sterowanie
// to "biezace polozenie" (sortNearestNonce) podawane z zewnatrz.
export default function ExploreSwiper({ city, active, sortNearestNonce = 0 }: { city: string; active?: boolean; sortNearestNonce?: number }) {
  const today = useMemo(() => new Date(), []);
  const [sortMode, setSortMode] = useState<"default" | "nearest">("default");

  // "Biezace polozenie" (Explore) -> wymus sort od najblizszego. Nonce rosnie z kazdym klikiem.
  useEffect(() => {
    if (sortNearestNonce > 0) setSortMode("nearest");
  }, [sortNearestNonce]);

  const initialLiked = useMemo(() => (city ? getTodayLikes(city).map((p) => p.place_name) : []), [city]);

  return (
    // BottomNav ukryty w tym widoku (Explore dispatchuje hide-bottomnav) -> swiper na pelny
    // ekran, bez dolnego paddingu (peek nastepnej karty siega samego dolu).
    <div className="flex-1 flex flex-col overflow-hidden">
      <PlaceSwiper
        city={city || "Warszawa"}
        date={today}
        numDays={1}
        sortByNearest={sortMode === "nearest"}
        initialLikedPlaceNames={initialLiked}
        exploreMode
      />

    </div>
  );
}
