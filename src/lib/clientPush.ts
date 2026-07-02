import { supabase } from "@/integrations/supabase/client";

// Push dla akcji usera wysylany Z KLIENTA (functions.invoke doklada JWT usera).
// send-push wymaga JWT zalogowanego usera albo service-role; trigger DB (pg_net z anon key)
// dostaje 401, wiec push MUSI isc z klienta. Aktor akcji (zapraszajacy / akceptujacy /
// kopiujacy trase) jest zawsze zalogowany, wiec ma wazny JWT.

export async function sendClientPush(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke("send-push", {
      body: { user_id: params.userId, title: params.title, body: params.body, url: params.url ?? "/" },
    });
  } catch {
    // best-effort - blad pusha nie blokuje akcji
  }
}

// Nazwa wyswietlana aktualnego usera (first_name -> username -> "Ktoś").
export async function getCurrentUserName(): Promise<string> {
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
