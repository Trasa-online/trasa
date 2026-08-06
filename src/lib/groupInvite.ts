import { supabase } from "@/integrations/supabase/client";
import { sendGroupInvitePush, getCurrentHostName } from "@/lib/sendGroupInvitePush";

// Kod sesji grupowej (join_code) - kolumna group_sessions.join_code wymaga wartosci.
// Nie sluzy juz do deep-linku (zaproszony trafia prosto na trase /review-summary).
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export interface InviteRoute {
  id: string;
  city?: string | null;
  title?: string | null;
  group_session_id?: string | null;
}

// Zaproszenie userow do trasy:
// 1. Jesli trasa nie jest jeszcze grupowa (brak group_session_id) -> tworzy sesje grupowa
//    (host = ja), podpina trase (routes.group_session_id) i dodaje siebie do members.
// 2. Dodaje zaproszonych do members przez host-only RPC add_member_to_session (RLS: self-insert
//    only, wiec cudzych dodaje sie definer-RPC).
// 3. Oznacza trase jako "Nowa" dla zaproszonych (routes.new_for_users) + push.
// Zwraca ok + sessionId. Zaproszeni widza trase u siebie przez join group_session_members.
export async function inviteUsersToRoute(
  route: InviteRoute,
  inviteeIds: string[],
  hostUserId: string,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const ids = Array.from(new Set(inviteeIds.filter((id) => id && id !== hostUserId)));
  if (!ids.length) return { ok: true, sessionId: route.group_session_id ?? undefined };
  try {
    await (supabase as any).rpc("ensure_current_user_profile");

    let sessionId = route.group_session_id ?? null;

    if (!sessionId) {
      const code = generateJoinCode();
      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .insert({
          city: route.city ?? null,
          created_by: hostUserId,
          join_code: code,
          num_days: 1,
          // Trasa grupowa jest trwala - dlugi expiry (nie chcemy auto-wygaszenia linku).
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          ...(route.title ? { name: route.title } : {}),
        })
        .select("id")
        .single();
      if (error || !session) return { ok: false, error: error?.message ?? "session insert failed" };
      sessionId = session.id;
      // Host do members (self-insert dozwolony) + podpiecie trasy (owner update).
      await (supabase as any).from("group_session_members").insert({ session_id: sessionId, user_id: hostUserId });
      const { error: linkErr } = await (supabase as any).from("routes").update({ group_session_id: sessionId }).eq("id", route.id);
      if (linkErr) return { ok: false, error: linkErr.message };
    }

    // Dodaj zaproszonych (host-only RPC).
    for (const uid of ids) {
      await (supabase as any).rpc("add_member_to_session", { p_session_id: sessionId, p_user_id: uid });
    }

    // Badge "Nowa trasa" dla zaproszonych (owner update new_for_users).
    const { data: r } = await (supabase as any).from("routes").select("new_for_users").eq("id", route.id).maybeSingle();
    const cur: string[] = (r?.new_for_users as string[]) ?? [];
    const merged = Array.from(new Set([...cur, ...ids]));
    await (supabase as any).from("routes").update({ new_for_users: merged }).eq("id", route.id);

    // Push (best-effort) - deep-link prosto do wspoldzielonej trasy.
    const hostName = await getCurrentHostName();
    for (const uid of ids) {
      void sendGroupInvitePush({ targetUserId: uid, hostName, city: route.city ?? "", routeId: route.id });
    }

    return { ok: true, sessionId: sessionId! };
  } catch (e: any) {
    console.error("[groupInvite] inviteUsersToRoute failed:", e?.message ?? e);
    return { ok: false, error: e?.message };
  }
}
