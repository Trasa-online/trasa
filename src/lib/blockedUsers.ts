import { supabase } from "@/integrations/supabase/client";

// Blokowanie userow (wymog App Store, Guideline 1.2): zablokowany user znika z eksploracji,
// wyszukiwarki i profili osoby blokujacej. Filtr jest po stronie klienta - RLS nie moze tego
// zrobic, bo tresci sa publiczne dla wszystkich pozostalych.
export async function fetchBlockedIds(userId?: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const { data } = await (supabase as any).from("blocked_users").select("blocked_id").eq("blocker_id", userId);
    return new Set((data ?? []).map((r: any) => r.blocked_id).filter(Boolean));
  } catch (e) {
    console.warn("[blockedUsers] fetch:", e instanceof Error ? e.message : e);
    return new Set();
  }
}

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await (supabase as any).from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && String(error.code) !== "23505") {
    console.warn("[blockedUsers] block:", error.message);
    return false;
  }
  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await (supabase as any).from("blocked_users").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) { console.warn("[blockedUsers] unblock:", error.message); return false; }
  return true;
}

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await (supabase as any).from("blocked_users")
    .select("blocked_id").eq("blocker_id", blockerId).eq("blocked_id", blockedId).maybeSingle();
  return !!data;
}
