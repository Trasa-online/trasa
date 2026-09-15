// Czat z lokalami po naszej stronie. Watek = LOKAL (business_profile_id), wiec siec z trzema
// kawiarniami ma trzy osobne rozmowy - pytanie o menu w jednej nie dotyczy pozostalych.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MessageThread {
  business_profile_id: string;
  business_name: string | null;
  city: string | null;
  logo_url: string | null;
  last_body: string | null;
  last_sender: "business" | "admin" | null;
  last_at: string | null;
  unread: number;
  total: number;
}

export interface ThreadMessage {
  id: string;
  business_profile_id: string;
  sender: "business" | "admin";
  author_user_id: string | null;
  body: string;
  created_at: string;
}

/** Lista rozmow - tylko lokale, ktore cokolwiek napisaly (albo my do nich). */
export function useMessageThreads() {
  return useQuery<MessageThread[]>({
    queryKey: ["admin-message-threads"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_message_threads");
      if (error) throw error;
      return (data ?? []) as MessageThread[];
    },
  });
}

export function useThread(businessProfileId: string | null) {
  return useQuery<ThreadMessage[]>({
    queryKey: ["admin-thread", businessProfileId],
    enabled: !!businessProfileId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("business_messages")
        .select("id, business_profile_id, sender, author_user_id, body, created_at")
        .eq("business_profile_id", businessProfileId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ThreadMessage[];
    },
  });
}

export function useSendReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessProfileId, body }: { businessProfileId: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("business_messages").insert({
        business_profile_id: businessProfileId,
        sender: "admin",
        author_user_id: user?.id ?? null,
        body: body.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-thread", vars.businessProfileId] });
      qc.invalidateQueries({ queryKey: ["admin-message-threads"] });
    },
  });
}

/** Otwarcie watku = przeczytany. Strone wylicza baza z roli, nie ufamy parametrowi z klienta. */
export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (businessProfileId: string) => {
      await (supabase as any).rpc("mark_business_thread_read", { p_business_id: businessProfileId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-message-threads"] }),
  });
}

/** Licznik do nawigacji: ile rozmow czeka na naszą odpowiedź. */
export function useUnreadThreads() {
  const threads = useMessageThreads();
  return threads.data?.filter((t) => t.unread > 0).length ?? 0;
}
