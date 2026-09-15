import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchSavedPlaceNames, normalizePlaceName } from "@/lib/placeLists";

// Stan "zapisane": zbior znormalizowanych nazw miejsc zapisanych przez usera w dowolnej liscie.
// Do wskazania na ikonie bookmark (karta/wiersz trasy/wizytowka). Invaliduj klucz
// ["saved-place-names", userId] po zmianie zapisow (SavePlaceSheet / moveToVisited).
export function useSavedPlaces() {
  const { user } = useAuth();
  const { data: savedNames } = useQuery({
    queryKey: ["saved-place-names", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => fetchSavedPlaceNames(user!.id),
  });
  const set = savedNames ?? new Set<string>();
  return {
    savedNames: set,
    isSaved: (placeName?: string | null) => !!placeName && set.has(normalizePlaceName(placeName)),
  };
}
