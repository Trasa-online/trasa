import { supabase } from "@/integrations/supabase/client";

// Push zaproszenia do sesji grupowej wysylany Z KLIENTA (functions.invoke doklada JWT
// zalogowanego usera). WAZNE: send-push wymaga service-role albo JWT usera - trigger DB
// (pg_net z anon key) dostaje 401, wiec push MUSI isc z klienta (host jest zalogowany).
// send_group_invite RPC robi tylko in-app notyfikacje; delivery push = ten helper.

export interface GroupInvitePushParams {
  targetUserId: string;
  hostName: string;
  city: string;
  joinCode: string;
}

export async function sendGroupInvitePush(params: GroupInvitePushParams): Promise<void> {
  const { targetUserId, hostName, city, joinCode } = params;
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        user_id: targetUserId,
        title: "Zaproszenie do sesji 🗺️",
        body: `${hostName} zaprasza Cię do trasy po ${city}`,
        url: `/sesja/${joinCode}`,
      },
    });
  } catch {
    // best-effort - blad pusha nie blokuje flow zaproszenia
  }
}

// Pomocnicze: pobiera hostName (first_name lub username) aktualnego usera.
export async function getCurrentHostName(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return "Ktoś";
  const { data: prof } = await supabase
    .from("profiles")
    .select("first_name, username")
    .eq("id", user.id)
    .single();
  return (prof as { first_name?: string; username?: string } | null)?.first_name
    ?? (prof as { first_name?: string; username?: string } | null)?.username
    ?? "Ktoś";
}
