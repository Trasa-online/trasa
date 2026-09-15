import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserLists, addPlaceToList, removePlaceFromList, listHasPlace, type PlaceForList } from "@/lib/placeLists";
import { resolveStored } from "@/components/PlacePhoto";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Odzapisanie miejsca jednym tapem (ponowne klikniecie bookmarka) - usuwa je ze WSZYSTKICH list
// usera zawierajacych to miejsce. ZAWSZE toast: miniaturka + pelna nazwa + "Cofnij" (re-dodaj).
// Wspoldzielone przez eksploracje, wizytowke i widoki trasy/listy.
export function useUnsavePlace() {
  const { t } = useTranslation("homeprofile");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-place-names", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-places", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user?.id] });
  };

  const thumb = (place: PlaceForList) => {
    const photo = resolveStored(place.photo_url);
    return photo
      ? <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
      : <span className="h-9 w-9 rounded-lg bg-[#fcede3] flex items-center justify-center shrink-0"><img src={categoryIconSrc(place.category)} alt="" className="w-1/2" /></span>;
  };

  return async (place: PlaceForList) => {
    if (!user || !place?.place_name) return;
    const lists = await fetchUserLists(user.id);
    const containing = lists.filter((l) => listHasPlace(l, place.place_name));
    if (!containing.length) return;
    for (const l of containing) await removePlaceFromList(l.id, place.place_name);
    invalidate();
    toast.success(place.place_name, {
      icon: thumb(place),
      description: t("saved.removed_toast"),
      action: {
        label: "Cofnij",
        onClick: async () => {
          for (const l of containing) await addPlaceToList(l.id, { ...place });
          invalidate();
        },
      },
    });
  };
}
