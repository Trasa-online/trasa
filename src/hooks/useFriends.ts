import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/lib/shareUrl";

// ⚠️ To NIE jest warstwa znajomosci - ta mieszka w `src/lib/friends.ts` (zaproszenie ->
// akceptacja, migracja `20260922b_friend_requests`). Tutaj zostal wylacznie LINK ZAPRASZAJACY
// `/dodaj/<kod>`: wejscie w niego jest zgoda obu stron naraz (jedna wystawila link, druga
// w niego weszla), wiec omija krok akceptacji.
//
// Do 22.09 stal tu drugi, rownolegly komplet hookow do tej samej relacji - efekt porzucenia
// modelu `friendships` w lipcu i wrocenia do niego teraz. Jeden byt, jeden plik.

export function useMyInviteCode(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-invite-code", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string | null> => {
      // [H3] wlasny invite_code przez RPC (kolumna nie jest juz publicznie czytelna).
      const { data: rows } = await (supabase as any).rpc("get_my_profile");
      const row = Array.isArray(rows) ? rows[0] : rows;
      return (row?.invite_code as string) ?? null;
    },
  });
}

export const inviteLinkFromCode = (code: string) => buildShareUrl(`/dodaj/${code}`);

/** Zwraca `{ ok, inviter, already }` albo `{ ok:false, reason }`. Push o nowym znajomym
 *  wysyla TRIGGER bazy (`notify_push`), nie klient. */
export const befriendViaInvite = (code: string) =>
  (supabase as any).rpc("befriend_via_invite", { p_code: code });
