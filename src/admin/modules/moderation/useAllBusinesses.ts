import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BizRow {
  id: string;
  business_name: string | null;
  main_category: string | null;
  city: string | null;
  is_active: boolean;
  moderation_status: string;
  place_id: string | null;
  owner_user_id: string | null;
  created_at: string;
}

// Wszystkie wizytowki (nie-drafty) - do zarzadzania (edycja/publikacja/usuwanie).
export function useAllBusinesses() {
  return useQuery<BizRow[]>({
    queryKey: ["all-businesses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select("id, business_name, main_category, city, is_active, moderation_status, place_id, owner_user_id, created_at")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BizRow[];
    },
  });
}

// Edycja pol (odwracalne) - przez RLS admina bezposrednio.
export function useEditBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BizRow> }) => {
      const { error } = await (supabase as any).from("business_profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-businesses"] }),
  });
}

// Usuniecie (destrukcyjne) - przez edge admin-delete-business (super_admin + audit).
export function useDeleteBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, reason }: { profileId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-business", {
        body: { profile_id: profileId, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-businesses"] });
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
    },
  });
}
