import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Foto na subdomenie admina: pelny URL / storage -> bezposrednio; goly ref
// Google -> proxy na GLOWNEJ domenie (admin.spontaway.com nie ma /api/place-photo).
export function adminPhotoUrl(photoUrl: string | null | undefined, w = 400): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//.test(photoUrl) || photoUrl.startsWith("/storage/")) return photoUrl;
  return `https://spontaway.com/api/place-photo?ref=${encodeURIComponent(photoUrl)}&w=${w}`;
}

// Klucz zdjec usera w `place_photos` = znormalizowana NAZWA miejsca ("nm:<nazwa>"),
// bo pins.place_id trzyma nazwe, nie uuid - to jedyny wspolny identyfikator obu swiatow.
export const placePhotoKey = (name: string | null | undefined) => `nm:${String(name ?? "").toLowerCase().trim()}`;

/**
 * Zdjecia uzytkownikow per miejsce (cala tabela - na 15.09.2026 to 272 wiersze).
 * Panel potrzebuje ich, bo `places.photo_url` jest puste dla 887 z 994 aktywnych miejsc,
 * a aplikacja i tak pokazuje wtedy zdjecie usera. Bez tego lista w panelu klamie:
 * operatorka widzi "brak zdjecia" przy lokalu, ktory w apce ma pieć zdjec.
 */
export function useUserPlacePhotos() {
  return useQuery<Record<string, string>>({
    queryKey: ["place-photos-map"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("place_photos")
        .select("place_key, photo_url, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      const map: Record<string, string> = {};
      // Najnowsze zdjecie wygrywa: idziemy od najswiezszych i nie nadpisujemy.
      for (const r of data ?? []) if (r.place_key && r.photo_url && !map[r.place_key]) map[r.place_key] = r.photo_url;
      return map;
    },
  });
}

export interface PlaceRow {
  id: string;
  place_name: string;
  city: string | null;
  category: string | null;
  photo_url: string | null;
  claimed: boolean;
  /** Skad wzielo sie zdjecie: wiersz miejsca, galeria miejsca albo zdjecie uzytkownika. */
  photoFrom: "place" | "gallery" | "user" | null;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function usePlaces(search: string, city: string) {
  const photos = useUserPlacePhotos();
  const userPhotos = photos.data;

  return useQuery<PlaceRow[]>({
    // Mapa zdjec siedzi w kluczu, zeby lista przemalowala sie, gdy dojedzie.
    queryKey: ["places-explorer", search, city, !!userPhotos],
    queryFn: async () => {
      let q = (supabase as any).from("places").select("id, place_name, city, category, photo_url, gallery_urls, google_place_id, latitude, longitude")
        .eq("is_active", true).order("place_name").limit(60);
      if (search.trim()) q = q.ilike("place_name", `%${search.trim()}%`);
      if (city) q = q.eq("city", city);
      const { data: rows } = await q;

      const ids = (rows ?? []).map((r: any) => r.id);
      const { data: biz } = await (supabase as any).from("business_profiles").select("place_id").in("place_id", ids.length ? ids : ["_none_"]);
      const claimed = new Set((biz ?? []).map((b: any) => b.place_id));

      // Miejsca bez zdjecia w wierszu i bez galerii: probujemy zdjec uzytkownikow po nazwie,
      // a na koncu pinow (ktos dodal zdjecie w wyjezdzie, ale nie doszlo do place_photos).
      const missing = (rows ?? []).filter((r: any) => !r.photo_url && !(r.gallery_urls?.length) && !userPhotos?.[placePhotoKey(r.place_name)]);
      const pinPhotos: Record<string, string> = {};
      if (missing.length) {
        const { data: pins } = await (supabase as any)
          .from("pins").select("place_name, photo_url, image_url, images")
          .in("place_name", missing.map((r: any) => r.place_name))
          .limit(300);
        for (const p of pins ?? []) {
          const url = (Array.isArray(p.images) && p.images[0]) || p.image_url || p.photo_url;
          const k = String(p.place_name ?? "").toLowerCase().trim();
          if (url && !pinPhotos[k]) pinPhotos[k] = url;
        }
      }

      return (rows ?? []).map((r: any) => {
        const gallery = Array.isArray(r.gallery_urls) ? r.gallery_urls.find(Boolean) : null;
        const user = userPhotos?.[placePhotoKey(r.place_name)] ?? pinPhotos[String(r.place_name ?? "").toLowerCase().trim()] ?? null;
        const photo_url = r.photo_url || gallery || user || null;
        const photoFrom: PlaceRow["photoFrom"] = r.photo_url ? "place" : gallery ? "gallery" : user ? "user" : null;
        return {
          id: r.id, place_name: r.place_name, city: r.city, category: r.category,
          photo_url, photoFrom, claimed: claimed.has(r.id),
          google_place_id: r.google_place_id ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
        };
      });
    },
  });
}

/**
 * Dociaga zdjecie z Google i ZAPISUJE je w `places.photo_url` (edge `cache-place-photo`:
 * jedno pobranie, dwa rozmiary do Storage, staly URL w wierszu).
 *
 * ⚠️ To platne wywolanie Google, dlatego jest RECZNE i pojedyncze - lista nigdy nie robi
 * tego sama za 60 wierszy naraz. Zysk jest trwaly: zdjecie ladnie siedzi w bazie i widzi
 * je tez aplikacja, nie tylko panel.
 */
export function useFetchPlacePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (place: PlaceRow) => {
      const { data, error } = await supabase.functions.invoke("cache-place-photo", {
        body: {
          place_name: place.place_name,
          city: place.city ?? undefined,
          latitude: place.latitude ?? undefined,
          longitude: place.longitude ?? undefined,
          place_id: place.google_place_id ?? undefined,
          target_table: "places",
          target_id: place.id,
        },
      });
      if (error) throw error;
      const url = (data as any)?.photo_url ?? null;
      if (!url) throw new Error((data as any)?.reason === "rate_limited"
        ? "Dzienny limit wywołań Google wyczerpany - spróbuj jutro."
        : "Google nie ma zdjęcia dla tego miejsca.");
      return url as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["places-explorer"] }),
  });
}

export function useCities() {
  return useQuery<string[]>({
    queryKey: ["places-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("places").select("city").eq("is_active", true).limit(2000);
      return [...new Set((data ?? []).map((r: any) => r.city).filter(Boolean))].sort() as string[];
    },
  });
}

export function usePlaceAnalytics(placeId: string | null, rangeDays: number) {
  return useQuery({
    queryKey: ["place-analytics", placeId, rangeDays],
    enabled: !!placeId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("posthog-analytics", {
        body: { place_id: placeId, range_days: rangeDays, include_recent: true },
      });
      if (error) throw error;
      return data as any;
    },
  });
}
