import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QueueItem {
  id: string;
  business_name: string | null;
  main_category: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  description: string | null;
  gallery_urls: string[] | null;
  created_at: string;
  review_requested_at: string | null;
}

// Kolejka moderacji: wizytowki czekajace na akcept (moderation_status='pending',
// nie-drafty). Sort rosnaco po created_at = najdluzej czekajace na gorze (SLA).
export function useModerationQueue() {
  return useQuery({
    queryKey: ["moderation-queue"],
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select("id, business_name, main_category, city, phone, email, cover_image_url, logo_url, description, gallery_urls, created_at, review_requested_at")
        .eq("moderation_status", "pending")
        .eq("is_draft", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QueueItem[];
    },
    refetchInterval: 60_000,
  });
}

export function useModerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, action, reason }: { profileId: string; action: "approve" | "reject"; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-moderate-business", {
        body: { profile_id: profileId, action, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moderation-queue"] }),
  });
}
