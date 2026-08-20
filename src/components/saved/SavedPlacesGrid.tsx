import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PlaceTile } from "@/components/profile/PlaceTile";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { resolveStored } from "@/components/PlacePhoto";
import { inferCategoryFromName, categoryIconSrc } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, removeSavedPlaceById, addPlaceToList, type SavedPlace } from "@/lib/placeLists";

// Segment "Miejsca" w zakładce Zapisane (profil): siatka 3-kol zapisanych miejsc usera
// (agregat pozycji z prywatnych list "do zobaczenia"). Tap kafelka -> wizytówka.
export function SavedPlacesGrid() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailPin, setDetailPin] = useState<{ place: MockPlace; city: string; skip: boolean } | null>(null);

  const invalidateSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-places", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-place-names", user?.id] });
  };

  // #7: usun z zapisanych (odklik bookmarka). ZAWSZE toast + "Cofnij" (re-insert do tej samej listy).
  const handleUnsave = async (p: SavedPlace) => {
    await removeSavedPlaceById(p.id);
    invalidateSaved();
    // #1: pełna nazwa miejsca + miniaturka po lewej (zdjęcie usera albo ikona kategorii na peachy).
    const photo = resolveStored(p.photo_url);
    const thumb = photo
      ? <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
      : <span className="h-9 w-9 rounded-lg bg-[#fcede3] flex items-center justify-center shrink-0"><img src={categoryIconSrc(p.category)} alt="" className="w-1/2" /></span>;
    toast.success(p.place_name, {
      icon: thumb,
      description: "Usunięto z zapisanych",
      action: {
        label: "Cofnij",
        onClick: async () => {
          await addPlaceToList(p.collection_id, {
            place_name: p.place_name, category: p.category, address: p.address, description: p.short_desc,
            latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
            google_place_id: p.google_place_id, rating: p.rating,
          });
          invalidateSaved();
        },
      },
    });
  };

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
          <div key={p.id} className="relative">
            <button onClick={() => openDetail(p)} className="w-full active:opacity-90 transition-opacity">
              <PlaceTile showCity tile={{ photo_url: p.photo_url, category: p.category, place_name: p.place_name, city: p.city }} />
            </button>
            {/* #7: bookmark (wypelniony) - odklik = usun z zapisanych + toast z cofnij */}
            <button onClick={(e) => { e.stopPropagation(); void handleUnsave(p); }} aria-label="Usuń z zapisanych"
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Bookmark className="h-4 w-4 fill-[#F0A583] text-[#F0A583]" strokeWidth={2} />
            </button>
          </div>
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
