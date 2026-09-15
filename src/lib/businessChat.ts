// Czat lokal <-> spontaway (2026-09-15).
//
// Do tej pory „Napisz do nas" wrzucalo zgloszenie do `bug_reports` i tyle: lokal nie wiedzial,
// czy ktos to przeczytal, a odpowiedz szla mailem, poza produktem. To jest rozmowa - jeden
// watek NA LOKAL, ten sam po obu stronach (panel lokalu i panel ops).
import { supabase } from "@/integrations/supabase/client";

export interface BizMessage {
  id: string;
  business_profile_id: string;
  sender: "business" | "admin";
  author_user_id: string | null;
  body: string;
  created_at: string;
}

export async function fetchThread(businessProfileId: string): Promise<BizMessage[]> {
  const { data, error } = await (supabase as any)
    .from("business_messages")
    .select("id, business_profile_id, sender, author_user_id, body, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) { console.warn("[businessChat] fetchThread:", error.message); return []; }
  return (data ?? []) as BizMessage[];
}

/** `sender` NIE jest parametrem z zewnatrz - RLS i tak by go odrzucila, ale niech kod nie kusi. */
export async function sendAsBusiness(businessProfileId: string, body: string): Promise<BizMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  // Kod bledu, nie zdanie - tekst dla lokalu sklada warstwa UI, ktora ma tlumaczenia.
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await (supabase as any)
    .from("business_messages")
    .insert({ business_profile_id: businessProfileId, sender: "business", author_user_id: user.id, body: body.trim() })
    .select("id, business_profile_id, sender, author_user_id, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as BizMessage;
}

export async function markThreadRead(businessProfileId: string): Promise<void> {
  await (supabase as any).rpc("mark_business_thread_read", { p_business_id: businessProfileId });
}

/** Liczba nieprzeczytanych ODPOWIEDZI od nas - to ona zapala kropke w belce panelu. */
export async function unreadForOwner(businessProfileId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("business_unread_for_owner", { p_business_id: businessProfileId });
  if (error) return 0;
  return Number(data ?? 0);
}
