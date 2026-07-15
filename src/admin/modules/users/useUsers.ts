import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  is_anonymous: boolean;
  isBusiness: boolean;
  deleted: boolean;
}

// Lista kont (RPC admin_list_users = profiles JOIN auth.users) + flaga B2B
// (owner wizytowki) + flaga soft-delete (profiles.deleted_at).
export function useUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: users, error } = await (supabase as any).rpc("admin_list_users");
      if (error) throw error;
      const [ownersRes, delRes] = await Promise.all([
        (supabase as any).from("business_profiles").select("owner_user_id").not("owner_user_id", "is", null),
        (supabase as any).from("profiles").select("id").not("deleted_at", "is", null),
      ]);
      const bizSet = new Set((ownersRes.data ?? []).map((o: any) => o.owner_user_id));
      const delSet = new Set((delRes.data ?? []).map((d: any) => d.id));
      return (users ?? []).map((u: any) => ({
        ...u,
        isBusiness: bizSet.has(u.id),
        deleted: delSet.has(u.id),
      }));
    },
  });
}

export function useSoftDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-account", {
        body: { user_id: userId, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
