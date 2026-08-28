import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Skrot do "mojego" wyjazdu na gorze eksploracji. Priorytet: wyjazd W TRAKCIE (trip_type='ongoing'),
// a gdy takiego nie ma - najswiezszy ROBOCZY (status != 'published'; obejmuje etap propozycji oraz
// zakonczony, ale jeszcze nieopublikowany wyjazd). Bierzemy wlasne trasy ORAZ grupowe, do ktorych
// user jest zaproszony (group_session_members) - uczestnik tez ma wracac jednym tapnieciem.
export interface TripShortcut {
  id: string;
  title: string | null;
  city: string | null;
  cover: string | null;
  stage: "ongoing" | "draft";
}

const SEL = "id, title, city, trip_type, status, is_shared, cover_url, list_cover_url, created_at, updated_at, user_id, group_session_id";

export function useTripShortcut(userId: string | null | undefined) {
  return useQuery<TripShortcut | null>({
    queryKey: ["trip-shortcut", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [ownRes, memberRes] = await Promise.all([
        (supabase as any).from("routes").select(SEL).eq("user_id", userId)
          .order("updated_at", { ascending: false }).limit(20),
        (supabase as any).from("group_session_members").select("session_id").eq("user_id", userId),
      ]);
      const sessionIds = ((memberRes.data ?? []) as any[]).map((m) => m.session_id).filter(Boolean);
      let groupRows: any[] = [];
      if (sessionIds.length) {
        const { data } = await (supabase as any).from("routes").select(SEL)
          .in("group_session_id", sessionIds).neq("user_id", userId).eq("is_shared", true)
          .order("updated_at", { ascending: false }).limit(20);
        groupRows = (data ?? []) as any[];
      }
      const rows = [...((ownRes.data ?? []) as any[]), ...groupRows];
      if (!rows.length) return null;

      const newest = (a: any, b: any) =>
        String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? ""));
      const ongoing = rows.filter((r) => r.trip_type === "ongoing").sort(newest);
      const drafts = rows.filter((r) => r.trip_type !== "ongoing" && r.status !== "published").sort(newest);
      const pick = ongoing[0] ?? drafts[0];
      if (!pick) return null;

      return {
        id: pick.id,
        title: pick.title ?? null,
        city: pick.city ?? null,
        cover: pick.cover_url ?? pick.list_cover_url ?? null,
        stage: pick.trip_type === "ongoing" ? "ongoing" : "draft",
      };
    },
  });
}
