import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const norm = (s: any) => String(s ?? "").toLowerCase().trim();

// Lead = miejsce BEZ konta biznesowego (business_profiles z owner_user_id), najczesciej
// dodawane do tresci userow (listy = discovery_items + wyjazdy = pins). Klucz = znormalizowana
// nazwa (pins.place_id trzyma nazwe, nie uuid -> nazwa jest jedynym wspolnym identyfikatorem).
export interface LeadPlace {
  key: string;
  place_name: string;
  city: string | null;
  category: string | null;
  photo_url: string | null;
  listCount: number;
  tripCount: number;
  total: number;
}
export interface LeadsData {
  places: LeadPlace[];
  kpis: { leadCount: number; totalAdds: number; listAdds: number; tripAdds: number; topCity: string | null };
}

export function useLeadPlaces() {
  return useQuery<LeadsData>({
    queryKey: ["lead-places"],
    refetchInterval: 120_000,
    queryFn: async () => {
      const [di, pn, bp] = await Promise.all([
        (supabase as any).from("discovery_items").select("place_name, city, category, photo_url"),
        (supabase as any).from("pins").select("place_name, category, photo_url"),
        (supabase as any).from("business_profiles").select("business_name").not("owner_user_id", "is", null),
      ]);
      const claimed = new Set((bp.data ?? []).map((b: any) => norm(b.business_name)));
      const map = new Map<string, LeadPlace>();
      const bump = (name: any, city: any, category: any, photo: any, kind: "list" | "trip") => {
        const key = norm(name);
        if (!key || claimed.has(key)) return; // ma konto biznesowe -> nie lead
        let e = map.get(key);
        if (!e) { e = { key, place_name: name, city: city ?? null, category: category ?? null, photo_url: photo ?? null, listCount: 0, tripCount: 0, total: 0 }; map.set(key, e); }
        if (!e.city && city) e.city = city;
        if (!e.photo_url && photo) e.photo_url = photo;
        if (!e.category && category) e.category = category;
        if (kind === "list") e.listCount++; else e.tripCount++;
        e.total++;
      };
      for (const r of di.data ?? []) bump(r.place_name, r.city, r.category, r.photo_url, "list");
      for (const r of pn.data ?? []) bump(r.place_name, null, r.category, r.photo_url, "trip");

      const places = [...map.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
      const listAdds = places.reduce((s, p) => s + p.listCount, 0);
      const tripAdds = places.reduce((s, p) => s + p.tripCount, 0);
      const cityCount: Record<string, number> = {};
      for (const p of places) if (p.city) cityCount[p.city] = (cityCount[p.city] ?? 0) + p.total;
      const topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { places, kpis: { leadCount: places.length, totalAdds: listAdds + tripAdds, listAdds, tripAdds, topCity } };
    },
  });
}
