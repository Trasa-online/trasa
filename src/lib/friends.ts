import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FollowProfile } from "@/hooks/useFollow";

// ZNAJOMOSC WYMAGA ZGODY (decyzja Nat 2026-09-22, migracja `20260922b_friend_requests`):
// zaproszenie -> akceptacja albo odmowa. Do 22.09 znajomy = wzajemna obserwacja, wiec
// odwzajemnienie z grzecznosci samo dawalo komus dostep do tresci "tylko dla znajomych".
//
// Trzy rzeczy, ktore wynikaja z modelu i trzeba je znac, czytajac ten plik:
//   * WYSLANIE zaproszenia zaklada tez OBSERWACJE - gdy druga strona odmowi, zostaje dokladnie
//     to i nic wiecej (prosba Nat). Akceptacja dokłada obserwacje w druga strone.
//   * ODMOWA jest CICHA: brak powiadomienia, a polityka SELECT chowa odrzucony wiersz przed
//     zapraszajacym, wiec jego ekran po prostu wraca do "Dodaj do znajomych".
//   * Zrodlem prawdy jest BAZA (`friend_ids` / `are_friends`) - tej samej funkcji uzywaja
//     polityki RLS bramkujace zdjecia dla znajomych. Klient nie liczy znajomych sam.
//
// ⛔ Wykluczenia (`friend_excludes`) nie ma juz w apce: przy jawnej relacji wypisanie sie to
// zwykle `remove_friend`. Tabela zostaje w bazie dla starszych buildow z TestFlight.

export const friendIdsKey = (userId?: string | null) => ["friend-ids", userId] as const;
export const friendStatusKey = (myId?: string | null, otherId?: string | null) =>
  ["friend-status", myId, otherId] as const;
export const friendRequestsKey = (userId?: string | null) => ["friend-requests-in", userId] as const;

/** Stan relacji widziany MOIMI oczami. `pending_in` = ktos czeka na moja odpowiedz. */
export type FriendStatus = "none" | "pending_out" | "pending_in" | "friends" | "self";

/** Odswiez wszystko, co zalezy od znajomosci. Jedno miejsce, bo klucze siedza w czterech
 *  ekranach (profil wlasny i publiczny, arkusz ludzi, podpowiedzi przy zapraszaniu). */
export function invalidateFriends(qc: QueryClient, myId?: string | null) {
  qc.invalidateQueries({ queryKey: ["friend-ids"] });
  qc.invalidateQueries({ queryKey: ["friend-list"] });
  qc.invalidateQueries({ queryKey: ["friend-status"] });
  qc.invalidateQueries({ queryKey: friendRequestsKey(myId) });
  qc.invalidateQueries({ queryKey: ["follow-list"] });
  qc.invalidateQueries({ queryKey: ["follow-counts"] });
  qc.invalidateQueries({ queryKey: ["following-ids", myId] });
  qc.invalidateQueries({ queryKey: ["is-following"] });
}

/** Identyfikatory znajomych (relacje zaakceptowane, dowolny kierunek zaproszenia). */
export function useFriendIds(userId: string | null | undefined) {
  return useQuery({
    queryKey: friendIdsKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).rpc("friend_ids", { p_user: userId });
      if (error) { console.warn("[friends] friend_ids:", error.message); return []; }
      return ((data as any[]) ?? []).map((r) => (typeof r === "string" ? r : r?.friend_ids ?? r));
    },
  });
}

/** Znajomi z profilami - do listy w arkuszu. Ten sam ksztalt danych, co `useFollowList`,
 *  zeby wiersz osoby byl jednym komponentem, a nie dwoma prawie takimi samymi. */
export function useFriendList(userId: string | null | undefined) {
  const ids = useFriendIds(userId);
  return useQuery({
    queryKey: ["friend-list", userId, (ids.data ?? []).join(",")],
    enabled: !!userId && !ids.isLoading,
    queryFn: async (): Promise<FollowProfile[]> => {
      const list = ids.data ?? [];
      if (!list.length) return [];
      const { data } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", list);
      return (data as FollowProfile[]) ?? [];
    },
  });
}

/** Zaproszenia CZEKAJACE NA MOJA ODPOWIEDZ. Czytamy wprost z tabeli - polityka
 *  "see own friendships" i tak pokazuje wylacznie moje wiersze. */
export function useIncomingFriendRequests(userId: string | null | undefined) {
  return useQuery({
    queryKey: friendRequestsKey(userId),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<FollowProfile[]> => {
      const { data: rows } = await (supabase as any)
        .from("friendships").select("requester_id")
        .eq("addressee_id", userId).eq("status", "pending");
      const ids = [...new Set(((rows as any[]) ?? []).map((r) => r.requester_id as string))];
      if (!ids.length) return [];
      const { data } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", ids);
      return (data as FollowProfile[]) ?? [];
    },
  });
}

/** Stan relacji z jedna osoba - do guzika na jej profilu. */
export function useFriendStatus(myId: string | null | undefined, otherId: string | null | undefined) {
  return useQuery({
    queryKey: friendStatusKey(myId, otherId),
    enabled: !!myId && !!otherId,
    queryFn: async (): Promise<FriendStatus> => {
      if (myId === otherId) return "self";
      // ⚠️ Wartosci w `.or()` MUSZA byc w cudzyslowie - przecinek w srodku nawiasu rozbija
      // filtr PostgREST i po cichu oddaje pustke (pamiec: feedback_postgrest_or_filter_quoting).
      const { data } = await (supabase as any)
        .from("friendships").select("requester_id, status")
        .or(`and(requester_id.eq."${myId}",addressee_id.eq."${otherId}"),and(requester_id.eq."${otherId}",addressee_id.eq."${myId}")`)
        .maybeSingle();
      if (!data) return "none";
      if (data.status === "accepted") return "friends";
      // 'declined' u zapraszajacego jest niewidoczne (polityka SELECT), wiec tu moze przyjsc
      // wylacznie odmowa, ktora TO JA wystawilam - a dla mnie znaczy ona "brak relacji".
      if (data.status !== "pending") return "none";
      return data.requester_id === myId ? "pending_out" : "pending_in";
    },
  });
}

// ── akcje ──────────────────────────────────────────────────────────────────────
// ⛔ Push idzie z TRIGGERA bazy (`notify_push` na `notifications`), nie z klienta. Do 22.09
// stal tu jeszcze `sendClientPush` z komentarzem, ze trigger dostaje 401 - to nieprawda od
// migracji `20260827_notify_push_trigger_secret`, wiec kazdy push szedl podwojnie.

export type SendRequestResult =
  | "requested" | "accepted" | "pending" | "already_friends" | "guest_not_allowed" | "unavailable" | "error";

export async function sendFriendRequest(addresseeId: string): Promise<SendRequestResult> {
  const { data, error } = await (supabase as any).rpc("send_friend_request", { p_addressee: addresseeId });
  if (error) { console.warn("[friends] send:", error.message); return "error"; }
  return (data as SendRequestResult) ?? "error";
}

/** `true` = odpowiedz zapisana; `false` = zaproszenia juz nie ma (odpowiedziano gdzie indziej). */
export async function respondToFriendRequest(requesterId: string, accept: boolean): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .rpc("respond_to_friend_request", { p_requester: requesterId, p_accept: accept });
  if (error) { console.warn("[friends] respond:", error.message); return false; }
  return (data as any)?.ok !== false;
}

/** Jedno wejscie na "cofam zaproszenie" i "usuwam ze znajomych". NIE odobserwowuje. */
export async function removeFriend(otherId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("remove_friend", { p_other: otherId });
  if (error) { console.warn("[friends] remove:", error.message); return false; }
  return data !== false;
}
