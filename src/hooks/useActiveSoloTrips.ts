import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Aktywne trasy SOLO (planning/ongoing, bez grupy). Dedupe po folderze (trasa wielodniowa =
// jeden wpis, reprezentant = DZIEN 1 / najnizszy day_number) + zakres dat folderu (_dateMin/Max).
// Wspolny hook: ten sam queryKey w HomeSwipe (selector) i ActiveTripsDashboard (render) -> jeden
// cache, spojne dane.
export function useActiveSoloTrips(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["home-active-solo", userId],
    queryFn: async () => {
      if (!userId) return [] as any[];
      const { data } = await (supabase as any)
        .from("routes")
        .select("*, pins(*)")
        .eq("user_id", userId)
        .in("trip_type", ["planning", "ongoing"])
        .order("created_at", { ascending: false });
      const solo = ((data as any[]) || []).filter((r) => !r.group_session_id);
      const byTrip = new Map<string, any>();
      const range = new Map<string, { min: string | null; max: string | null }>();
      for (const r of solo) {
        const key = r.folder_id ?? r.id;
        const cur = byTrip.get(key);
        if (!cur || (r.day_number ?? 999) < (cur.day_number ?? 999)) byTrip.set(key, r);
        const rg = range.get(key) ?? { min: null, max: null };
        if (r.start_date) {
          if (!rg.min || r.start_date < rg.min) rg.min = r.start_date;
          if (!rg.max || r.start_date > rg.max) rg.max = r.start_date;
        }
        if (r.end_date && (!rg.max || r.end_date > rg.max)) rg.max = r.end_date;
        range.set(key, rg);
      }
      return [...byTrip.entries()].map(([key, r]) => ({ ...r, _dateMin: range.get(key)!.min, _dateMax: range.get(key)!.max }));
    },
    enabled: !!userId,
  });
}
