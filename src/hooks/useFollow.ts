import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Asymetryczny model follow (tabela followers: follower_id -> following_id). 1-klik, bez
// akceptacji. SELECT publiczny, wiec liczniki/listy dzialaja dla dowolnego usera.
// Zastapil symetryczny model 'friendships' (patrz migracja 20260726_switch_to_follow_model).

export interface FollowProfile {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

// Liczniki: obserwujacych (following_id = user) + obserwowanych (follower_id = user).
export function useFollowCounts(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        (supabase as any).from("followers").select("*", { count: "exact", head: true }).eq("following_id", userId),
        (supabase as any).from("followers").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
  });
}

// Lista: "followers" = kto obserwuje userId; "following" = kogo userId obserwuje.
export function useFollowList(userId: string | null | undefined, kind: "followers" | "following") {
  return useQuery({
    queryKey: ["follow-list", userId, kind],
    enabled: !!userId,
    queryFn: async (): Promise<FollowProfile[]> => {
      const idCol = kind === "followers" ? "follower_id" : "following_id";
      const matchCol = kind === "followers" ? "following_id" : "follower_id";
      const { data: rows } = await (supabase as any).from("followers").select(idCol).eq(matchCol, userId);
      const ids = [...new Set(((rows as any[]) ?? []).map((r) => r[idCol]))];
      if (!ids.length) return [];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, username, first_name, avatar_url").in("id", ids);
      return (profs as FollowProfile[]) ?? [];
    },
  });
}

// Czy myId obserwuje targetId.
export function useIsFollowing(myId: string | null | undefined, targetId: string | null | undefined) {
  return useQuery({
    queryKey: ["is-following", myId, targetId],
    enabled: !!myId && !!targetId && myId !== targetId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("followers")
        .select("follower_id")
        .eq("follower_id", myId)
        .eq("following_id", targetId)
        .maybeSingle();
      return !!data;
    },
  });
}

export async function followUser(targetId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await (supabase as any).from("followers").insert({ follower_id: user.id, following_id: targetId });
  // 23505 = juz obserwuje (unikalny PK) - traktujemy jak sukces (idempotentne).
  if (error && (error as any).code !== "23505") throw error;
}

export async function unfollowUser(targetId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await (supabase as any)
    .from("followers").delete().eq("follower_id", user.id).eq("following_id", targetId);
  if (error) throw error;
}
