import { useQuery } from "@tanstack/react-query";
// Powiadomienia buduje hook poza drzewem Reacta, wiec siegamy po i18n bezposrednio.
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/lib/shareUrl";
import { sendClientPush, getCurrentUserName } from "@/lib/clientPush";

// Model przyjaciol (symetryczny). Patrz pamiec: project_friends_model.
// Wszystkie mutacje idą przez SECURITY DEFINER RPC (send_friend_request / accept /
// remove / befriend_via_invite). Tu hooki do odczytu + cienkie wrappery na akcje.

export interface FriendProfile {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

// ── Lista zaakceptowanych przyjaciol (dowolny kierunek relacji) ──
export function useFriends(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["friends", userId],
    enabled: !!userId,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data: rows } = await (supabase as any)
        .from("friendships")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted");
      const otherIds = [...new Set(((rows as any[]) ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))];
      if (!otherIds.length) return [];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", otherIds);
      return (profs as FriendProfile[]) ?? [];
    },
  });
}

// ── Przychodzace zaproszenia (ja = addressee, status pending) ──
export function useIncomingRequests(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["friend-requests-in", userId],
    enabled: !!userId,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data: rows } = await (supabase as any)
        .from("friendships")
        .select("requester_id")
        .eq("addressee_id", userId)
        .eq("status", "pending");
      const ids = [...new Set(((rows as any[]) ?? []).map((r) => r.requester_id))];
      if (!ids.length) return [];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", ids);
      return (profs as FriendProfile[]) ?? [];
    },
    refetchInterval: 30_000,
  });
}

export type FriendStatus = "none" | "pending_out" | "pending_in" | "friends" | "self";

// ── Status relacji z konkretnym userem (do przyciskow na profilu/searchu) ──
export function useFriendStatus(userId: string | null | undefined, otherId: string | null | undefined) {
  return useQuery({
    queryKey: ["friend-status", userId, otherId],
    enabled: !!userId && !!otherId,
    queryFn: async (): Promise<FriendStatus> => {
      if (userId === otherId) return "self";
      const { data } = await (supabase as any)
        .from("friendships")
        .select("requester_id, addressee_id, status")
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`)
        .maybeSingle();
      if (!data) return "none";
      if (data.status === "accepted") return "friends";
      return data.requester_id === userId ? "pending_out" : "pending_in";
    },
  });
}

// ── Moj invite_code + gotowy link zaproszeniowy ──
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

// ── Akcje (wrappery RPC) ──
// Po RPC odpalamy KLIENCKI push (functions.invoke z JWT usera). Trigger DB (pg_net, anon key)
// dostaje z send-push 401, wiec sam nie dostarcza pusha - dlatego robimy to tutaj.
export const sendFriendRequest = async (addresseeId: string) => {
  const res = await (supabase as any).rpc("send_friend_request", { p_addressee: addresseeId });
  const status = res?.data as string | undefined;
  if (!res?.error && (status === "requested" || status === "accepted")) {
    const me = await getCurrentUserName();
    if (status === "requested") {
      void sendClientPush({ userId: addresseeId, title: i18n.t("friends.request_title", { ns: "social" }), body: i18n.t("friends.request_body", { ns: "social", name: me }), url: "/moj-profil" });
    } else {
      // Byl juz rewers - RPC od razu zaakceptowal -> powiadom druga strone o nowym znajomym.
      void sendClientPush({ userId: addresseeId, title: i18n.t("friends.accept_title", { ns: "social" }), body: i18n.t("friends.accept_body", { ns: "social", name: me }), url: "/moj-profil" });
    }
  }
  return res;
};
export const acceptFriendRequest = async (requesterId: string) => {
  const res = await (supabase as any).rpc("accept_friend_request", { p_requester: requesterId });
  if (!res?.error && res?.data === true) {
    const me = await getCurrentUserName();
    void sendClientPush({ userId: requesterId, title: i18n.t("friends.accept_title", { ns: "social" }), body: i18n.t("friends.accept_body", { ns: "social", name: me }), url: "/moj-profil" });
  }
  return res;
};
export const removeFriend = (otherId: string) =>
  (supabase as any).rpc("remove_friend", { p_other: otherId });
export const befriendViaInvite = async (code: string) => {
  const res = await (supabase as any).rpc("befriend_via_invite", { p_code: code });
  const data = res?.data as { ok?: boolean; inviter?: string; already?: boolean } | undefined;
  if (!res?.error && data?.ok && data.inviter && !data.already) {
    const me = await getCurrentUserName();
    void sendClientPush({ userId: data.inviter, title: i18n.t("friends.accept_title", { ns: "social" }), body: i18n.t("friends.link_body", { ns: "social", name: me }), url: "/moj-profil" });
  }
  return res;
};
