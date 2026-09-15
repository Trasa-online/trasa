import { supabase } from "@/integrations/supabase/client";

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
          // ⛔ NIE `route.city ?? null`: `group_sessions.city` jest TEXT **NOT NULL** (migracja
          // 20260403000001 i nikt tego nie poluzowal), a od 2026-09-10 nowe wyjazdy maja
          // `routes.city = NULL` - zasiegiem jest KRAJ, a kreator wybiera wylacznie kraje.
          // Wstawienie NULL konczylo sie bledem 23502, funkcja zwracala `ok:false`, a user
          // dostawal "Nie udalo sie zaprosic" - czyli od 10.09 nie dalo sie zaprosic NIKOGO
          // do zadnego nowo utworzonego wyjazdu (zgloszenie testerki 2026-09-15).
          // Pusty string zamiast nazwy kraju swiadomie: kolumna jest szczatkowa (czytalo ja
          // stare parowanie grupowe, zdjete 2026-08-06), a jedyne miejsce, ktore ja jeszcze
          // pokazuje (`ActiveTripsDashboard`), ma `s.name` z tytulem i pomija puste `city`.
          city: route.city ?? "",
          created_by: hostUserId,
          join_code: code,
          num_days: 1,
          // Trasa grupowa jest trwala - dlugi expiry (nie chcemy auto-wygaszenia linku).
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          ...(route.title ? { name: route.title } : {}),
        })
        .select("id")
        .single();
      if (error || !session) {
        // Bez tego logu poprzedni blad byl niediagnozowalny: user widzial samo "Nie udalo sie
        // zaprosic", a prawdziwy powod (naruszenie NOT NULL) nigdzie nie wychodzil.
        console.error("[groupInvite] group_sessions insert:", error?.message ?? "no row returned");
        return { ok: false, error: error?.message ?? "session insert failed" };
      }
      sessionId = session.id;
      // Host do members (self-insert dozwolony) + podpiecie trasy (owner update).
      // is_shared=true: trasa grupowa MUSI byc shared (brak RLS czlonkostwa na routes -> inaczej
      // zaproszeni jej nie odczytaja). Dotyczy tez draftow tworzonych z arkusza "Nowy wyjazd".
      await (supabase as any).from("group_session_members").insert({ session_id: sessionId, user_id: hostUserId });
      const { error: linkErr } = await (supabase as any).from("routes").update({ group_session_id: sessionId, is_shared: true }).eq("id", route.id);
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

    // Powiadomienie IN-APP (dzwonek) + push - jeden kanal przez trigger notify_push na wpisie
    // route_invite (SECURITY DEFINER RPC, bo klient nie ma INSERT na notifications).
    for (const uid of ids) {
      await (supabase as any).rpc("notify_route_invite", { p_route_id: route.id, p_user_id: uid });
    }

    return { ok: true, sessionId: sessionId! };
  } catch (e: any) {
    console.error("[groupInvite] inviteUsersToRoute failed:", e?.message ?? e);
    return { ok: false, error: e?.message };
  }
}
