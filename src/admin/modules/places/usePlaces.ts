import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Foto na subdomenie admina: pelny URL / storage -> bezposrednio; goly ref
// Google -> proxy na GLOWNEJ domenie (admin.spontaway.com nie ma /api/place-photo).
export function adminPhotoUrl(photoUrl: string | null | undefined, w = 400): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//.test(photoUrl) || photoUrl.startsWith("/storage/")) return photoUrl;
  return `https://spontaway.com/api/place-photo?ref=${encodeURIComponent(photoUrl)}&w=${w}`;
}

export interface PlaceRow {
  id: string;
  place_name: string;
  city: string | null;
  category: string | null;
  photo_url: string | null;
  claimed: boolean;
}

export function usePlaces(search: string, city: string) {
  return useQuery<PlaceRow[]>({
    queryKey: ["places-explorer", search, city],
    queryFn: async () => {
      let q = (supabase as any).from("places").select("id, place_name, city, category, photo_url")
        .eq("is_active", true).order("place_name").limit(60);
      if (search.trim()) q = q.ilike("place_name", `%${search.trim()}%`);
      if (city) q = q.eq("city", city);
      const { data: rows } = await q;
      const ids = (rows ?? []).map((r: any) => r.id);
      const { data: biz } = await (supabase as any).from("business_profiles").select("place_id").in("place_id", ids.length ? ids : ["_none_"]);
      const claimed = new Set((biz ?? []).map((b: any) => b.place_id));
      return (rows ?? []).map((r: any) => ({ ...r, claimed: claimed.has(r.id) }));
    },
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
