import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PlaceTile } from "@/components/profile/PlaceTile";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { resolveStored } from "@/components/PlacePhoto";
import { inferCategoryFromName } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, type SavedPlace } from "@/lib/placeLists";

// Segment "Miejsca" w zakładce Zapisane (profil): siatka 3-kol zapisanych miejsc usera
// (agregat pozycji z prywatnych list "do zobaczenia"). Tap kafelka -> wizytówka.
export function SavedPlacesGrid() {
  const { user } = useAuth();
  const [detailPin, setDetailPin] = useState<{ place: MockPlace; city: string; skip: boolean } | null>(null);

  const { data: places = [], isLoading } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  const openDetail = (p: SavedPlace) => setDetailPin({
    skip: !p.place_id,
    city: p.city ?? "",
    place: {
      id: p.place_id ?? p.google_place_id ?? p.place_name,
      place_name: p.place_name, category: (p.category ?? inferCategoryFromName(p.place_name) ?? "other") as any,
      city: p.city ?? "", address: p.address ?? "", latitude: p.latitude ?? 0, longitude: p.longitude ?? 0,
      rating: p.rating ?? 0, photo_url: resolveStored(p.photo_url) ?? "", vibe_tags: [], description: p.short_desc || "",
    } as MockPlace,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (places.length === 0) return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center text-orange-500">
        <MapPin className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-black">Brak zapisanych miejsc</p>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
          {`Zapisuj miejsca na później zakładką w eksploracji - pojawią się tutaj.`}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {places.map((p) => (
          <button key={p.id} onClick={() => openDetail(p)} className="active:opacity-90 transition-opacity">
            <PlaceTile showCity tile={{ photo_url: p.photo_url, category: p.category, place_name: p.place_name, city: p.city }} />
          </button>
        ))}
      </div>
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => { if (!o) setDetailPin(null); }}
        place={detailPin?.place ?? null}
        city={detailPin?.city ?? ""}
        skipGoogleFetch={detailPin?.skip ?? false}
      />
    </>
  );
}
