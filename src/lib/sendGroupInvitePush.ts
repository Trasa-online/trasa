import { supabase } from "@/integrations/supabase/client";

// Jednolite zrodlo treści push notification "Nowe zaproszenie".
// Wszystkie miejsca wysyłające zaproszenie do sesji grupowej (CreateGroupSession,
// GroupSession waiting-invite, GroupSession friend-invite-modal) wołają TYLKO ten
// helper - dzieki temu treść jest spójna w jednym miejscu.
//
// Caller musi pobrać hostName wcześniej (np. raz dla batcha zaproszeń) - helper
// nie robi dodatkowego query do profiles.

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
        title: "Nowe zaproszenie",
        body: `${hostName} zaprasza Cię do trasy po ${city}`,
        url: `/sesja/${joinCode}`,
      },
    });
  } catch {
    // best-effort - push fail nie blokuje flow zaproszenia
  }
}

// Pomocnicze: pobiera hostName (first_name lub username) dla aktualnego usera.
// Uzywany w miejscach gdzie nie mamy jeszcze pobranego profilu.
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
