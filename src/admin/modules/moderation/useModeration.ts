import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QueueItem {
  id: string;
  business_name: string | null;
  main_category: string | null;
  city: string | null;
  street: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  cover_image_url: string | null;
  cover_video_url: string | null;
  logo_url: string | null;
  description: string | null;
  gallery_urls: string[] | null;
  tags: string[] | null;
  subcategories: string[] | null;
  opening_hours: unknown | null;
  activated_at: string | null;
  created_at: string;
  review_requested_at: string | null;
}

export type Completeness = "not_started" | "in_progress" | "ready";

// Status kompletnosci wizytowki (co biznes uzupelnil, poza nazwa/tel/email
// z rejestracji). not_started = nic nie ruszyl (tylko zalogowany); ready =
// ma rdzen (zdjecie + kategoria + opis); reszta = in_progress.
export function completeness(i: QueueItem): Completeness {
  const hasPhoto = !!(i.cover_image_url || i.cover_video_url || i.logo_url || (i.gallery_urls?.length));
  const hasCategory = !!i.main_category;
  const hasDesc = !!(i.description && i.description.trim().length >= 10);
  const hasTags = !!(i.tags?.length || i.subcategories?.length);
  const hasHours = !!i.opening_hours;
  const hasAddress = !!(i.street || i.city || i.address);
  const hasWebsite = !!i.website;
  const filled = [hasPhoto, hasCategory, hasDesc, hasTags, hasHours, hasAddress, hasWebsite].filter(Boolean).length;
  if (filled === 0) return "not_started";
  if (hasPhoto && hasCategory && hasDesc) return "ready";
  return "in_progress";
}

// Kolejka moderacji: wizytowki czekajace na akcept (moderation_status='pending',
// nie-drafty). Sort rosnaco po created_at = najdluzej czekajace na gorze (SLA).
export function useModerationQueue() {
  return useQuery({
    queryKey: ["moderation-queue"],
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await (supabase as any)
        .from("business_profiles")
        .select("id, business_name, main_category, city, street, address, phone, email, website, cover_image_url, cover_video_url, logo_url, description, gallery_urls, tags, subcategories, opening_hours, activated_at, created_at, review_requested_at")
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
