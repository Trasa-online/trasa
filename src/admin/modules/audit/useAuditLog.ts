import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: number;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AuditFilters {
  action?: string;      // dokladny match action, "" = wszystkie
  actor?: string;       // dokladny match actor_email, "" = wszyscy
  targetType?: string;  // dokladny match target_type, "" = wszystkie
}

const PAGE_SIZE = 50;

// Append-only log operacji nieodwracalnych (admin_audit_log). Read-only:
// zapisuja tylko edge functions (service-role). RLS: admini SELECT.
export function useAuditLog(filters: AuditFilters, page: number) {
  return useQuery<{ rows: AuditEntry[]; total: number }>({
    queryKey: ["audit-log", filters, page],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("admin_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (filters.action) q = q.eq("action", filters.action);
      if (filters.actor) q = q.eq("actor_email", filters.actor);
      if (filters.targetType) q = q.eq("target_type", filters.targetType);

      const from = page * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditEntry[], total: count ?? 0 };
    },
    placeholderData: (prev) => prev, // plynna paginacja bez migotania
  });
}

// Rozne wartosci action / actor / target_type do dropdownow filtra.
// Osobne query (lekkie, distinct po stronie klienta z ostatnich 500 wpisow).
export function useAuditFacets() {
  return useQuery<{ actions: string[]; actors: string[]; targetTypes: string[] }>({
    queryKey: ["audit-facets"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("admin_audit_log")
        .select("action, actor_email, target_type")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const actions = new Set<string>();
      const actors = new Set<string>();
      const targetTypes = new Set<string>();
      for (const r of data ?? []) {
        if (r.action) actions.add(r.action);
        if (r.actor_email) actors.add(r.actor_email);
        if (r.target_type) targetTypes.add(r.target_type);
      }
      return {
        actions: [...actions].sort(),
        actors: [...actors].sort(),
        targetTypes: [...targetTypes].sort(),
      };
    },
  });
}

export const PAGE = PAGE_SIZE;
