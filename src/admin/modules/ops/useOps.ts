import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BugReport {
  id: string;
  user_id: string | null;
  description: string;
  screenshot_url: string | null;
  status: string | null;
  source: string | null; // 'user' | 'business'
  created_at: string;
  reporter?: { username: string | null; first_name: string | null } | null;
}

export interface CityDemand {
  city: string;
  count: number;
}

// Bug reports od userow + nazwa zglaszajacego (osobny fetch profiles).
export function useBugReports() {
  return useQuery<BugReport[]>({
    queryKey: ["bug-reports"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: bugs, error } = await (supabase as any)
        .from("bug_reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const uids = [...new Set((bugs ?? []).map((b: any) => b.user_id).filter(Boolean))];
      const { data: profs } = uids.length
        ? await (supabase as any).from("profiles").select("id, username, first_name").in("id", uids)
        : { data: [] };
      const map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      return (bugs ?? []).map((b: any) => ({ ...b, reporter: map[b.user_id] ?? null }));
    },
  });
}

export function useResolveBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "open" }) => {
      const { error } = await (supabase as any).from("bug_reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bug-reports"] }),
  });
}

// Zapotrzebowanie na miasta (agregacja city_requests po nazwie, malejaco).
export function useCityDemand() {
  return useQuery<CityDemand[]>({
    queryKey: ["city-demand"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("city_requests").select("city_name");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const c = (r.city_name ?? "").trim();
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      }
      return Object.entries(counts).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
    },
  });
}
