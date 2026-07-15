import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  let q = (supabase as any).from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count ?? 0;
}

export interface OpsMetrics {
  moderation: { pending: number; approved: number; rejected: number; medianMs: number | null };
  funnel: { profiles: number; approved: number; active: number };
  accounts: { total: number; business: number; consumer: number };
}

// Metryki z naszej bazy (niezawodne, bez zaleznosci od PostHog).
export function useOpsMetrics() {
  return useQuery<OpsMetrics>({
    queryKey: ["ops-metrics"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [pending, approved, rejected, profilesBiz, activeBiz, accountsTotal] = await Promise.all([
        count("business_profiles", (q) => q.eq("moderation_status", "pending").eq("is_draft", false)),
        count("business_profiles", (q) => q.eq("moderation_status", "approved")),
        count("business_profiles", (q) => q.eq("moderation_status", "rejected")),
        count("business_profiles", (q) => q.eq("is_draft", false)),
        count("business_profiles", (q) => q.eq("is_active", true)),
        count("profiles"),
      ]);

      // Konta biznesowe = distinct owner_user_id w business_profiles.
      const { data: owners } = await (supabase as any)
        .from("business_profiles").select("owner_user_id").not("owner_user_id", "is", null);
      const business = new Set((owners ?? []).map((o: any) => o.owner_user_id)).size;

      // Mediana czasu do decyzji (moderated_at - created_at) dla zmoderowanych.
      const { data: mod } = await (supabase as any)
        .from("business_profiles")
        .select("created_at, moderated_at")
        .in("moderation_status", ["approved", "rejected"])
        .not("moderated_at", "is", null)
        .limit(1000);
      const durs = (mod ?? [])
        .map((r: any) => new Date(r.moderated_at).getTime() - new Date(r.created_at).getTime())
        .filter((d: number) => d >= 0)
        .sort((a: number, b: number) => a - b);
      const medianMs = durs.length ? durs[Math.floor(durs.length / 2)] : null;

      return {
        moderation: { pending, approved, rejected, medianMs },
        funnel: { profiles: profilesBiz, approved, active: activeBiz },
        accounts: { total: accountsTotal, business, consumer: Math.max(0, accountsTotal - business) },
      };
    },
  });
}

// KPI produktowe z PostHog (edge admin-analytics). Degraduje gracefully.
export function useProductKpis(rangeDays: number) {
  return useQuery({
    queryKey: ["product-kpis", rangeDays],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-analytics", { body: { range_days: rangeDays } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
  });
}
