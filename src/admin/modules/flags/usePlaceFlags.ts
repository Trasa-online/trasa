import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlagRow {
  id: string;
  place_id: string;
  user_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  place: {
    place_name: string;
    photo_url: string | null;
    city: string | null;
    address: string | null;
    google_place_id: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export const REASON_LABEL: Record<string, string> = {
  bad_photo: "Złe / nieaktualne zdjęcie",
  wrong_category: "Zła kategoria",
  closed: "Zamknięte / nie istnieje",
  wrong_data: "Błędne dane (adres, godziny)",
  inappropriate: "Treść niezgodna",
  other: "Inne",
};

// Kolejka moderacji: otwarte zgłoszenia (pending/reviewing), najdłużej czekające na górze.
export function usePlaceFlags() {
  return useQuery({
    queryKey: ["place-flags-queue"],
    queryFn: async (): Promise<FlagRow[]> => {
      const { data, error } = await (supabase as any)
        .from("place_flags")
        .select("id, place_id, user_id, reason, note, status, created_at, place:places(place_name, photo_url, city, address, google_place_id, latitude, longitude)")
        .in("status", ["pending", "reviewing"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FlagRow[];
    },
  });
}

// Rozwiąż / odrzuć zgłoszenie.
export function useResolveFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: "resolved" | "dismissed"; resolution?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("place_flags").update({
        status,
        resolution: resolution ?? null,
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-flags-queue"] }),
  });
}

// "Wyczyść zdjęcie + re-fetch": usuwa pliki z bucketu place-photos-cache (Storage),
// zeruje places.photo_url, wywołuje cache-place-photo (fresh) i zamyka flagę jako resolved.
export function useClearPhotoAndResolve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: FlagRow) => {
      const place = f.place;
      if (!place) throw new Error("brak miejsca");
      const marker = "/place-photos-cache/";
      // aktualny URL (może być świeższy niż w joinie)
      const { data: cur } = await (supabase as any).from("places").select("photo_url").eq("id", f.place_id).single();
      const url: string | null = cur?.photo_url ?? place.photo_url ?? null;
      if (url && url.includes(marker)) {
        const file800 = url.slice(url.indexOf(marker) + marker.length).split("?")[0];
        const file400 = file800.replace("_800.jpg", "_400.jpg");
        await supabase.storage.from("place-photos-cache").remove([file800, file400]);
      }
      await (supabase as any).from("places").update({ photo_url: null, photo_cached_at: null }).eq("id", f.place_id);
      // fresh re-fetch (cache-place-photo nie znajdzie plików -> pobierze z Google na nowo)
      await supabase.functions.invoke("cache-place-photo", {
        body: {
          place_name: place.place_name,
          city: place.city,
          latitude: place.latitude,
          longitude: place.longitude,
          place_id: place.google_place_id,
          target_table: "places",
          target_id: f.place_id,
        },
      });
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("place_flags").update({
        status: "resolved",
        resolution: "zdjęcie wyczyszczone + re-fetch",
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      }).eq("id", f.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["place-flags-queue"] }),
  });
}
