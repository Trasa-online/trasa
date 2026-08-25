import { supabase } from "@/integrations/supabase/client";

// Licznik nieprzeczytanych wiadomosci czatu (tabela trip_chat_reads). Nieprzeczytane = wiadomosci
// INNYCH po last_read_at usera. markChatRead = user otworzyl/czyta czat -> last_read_at = teraz.

export async function fetchUnreadChatCount(routeId: string, userId: string): Promise<number> {
  const { data: read } = await (supabase as any).from("trip_chat_reads")
    .select("last_read_at").eq("route_id", routeId).eq("user_id", userId).maybeSingle();
  const lastRead = read?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { count } = await (supabase as any).from("trip_messages")
    .select("id", { count: "exact", head: true })
    .eq("route_id", routeId).neq("user_id", userId).gt("created_at", lastRead);
  return count ?? 0;
}

export async function markChatRead(routeId: string, userId: string): Promise<void> {
  await (supabase as any).from("trip_chat_reads")
    .upsert({ route_id: routeId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "route_id,user_id" });
}
