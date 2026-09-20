import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FollowProfile } from "@/hooks/useFollow";

// ZNAJOMY = WZAJEMNA OBSERWACJA (decyzja Nat 2026-09-17). Nie ma osobnego zapraszania:
// jesli obserwujesz kogos, kto obserwuje Ciebie, jestescie znajomymi. Zrodlem prawdy jest
// BAZA (`friend_ids` / `are_friends`, migracja 20260917a), a nie wyliczenie po stronie
// klienta - bo dokladnie tej samej funkcji uzywaja polityki RLS bramkujace tresc. Gdyby
// klient liczyl znajomych sam, predzej czy pozniej pokazalby liste inna niz ta, ktora
// naprawde otwiera zdjecia.
//
// ⚠️ WYKLUCZENIE (`friend_excludes`) jest CICHE i jednostronne: wypisujesz kogos ze swoich
// znajomych, nie przestajac go obserwowac. Odobserwowanie jest sygnalem publicznym (znikasz
// z jego listy obserwujacych) i spolecznie kosztownym, wiec nie moze byc jedynym sposobem
// odciecia komus dostepu do prywatnych zdjec.
//
// ⛔ To NIE jest `useFriends` z `src/hooks/useFriends.ts`. Tamten hook czyta STARA tabele
// `friendships` (model zaproszenie + akceptacja, porzucony 2026-07-26, 4 wiersze na prodzie).
// Nowy kod uzywa tego pliku; tamten zostaje wylacznie dla linku zapraszajacego `/dodaj/:code`.

export const friendIdsKey = (userId?: string | null) => ["friend-ids", userId] as const;
export const friendExcludesKey = (userId?: string | null) => ["friend-excludes", userId] as const;

/** Identyfikatory znajomych. Dla WLASNEJ listy baza odejmuje wykluczonych; dla cudzej nie -
 *  patrz komentarz przy `friend_ids` w migracji (inaczej z roznicy dalo by sie odczytac,
 *  kogo ktos wypisal). */
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

/** Kogo wykluczylem ze znajomych. Potrzebne tylko na WLASNYM profilu - do pokazania,
 *  ze ktos jest wypisany, i do cofniecia. */
export function useMyExcludes(userId: string | null | undefined) {
  return useQuery({
    queryKey: friendExcludesKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data } = await (supabase as any)
        .from("friend_excludes").select("other_id").eq("user_id", userId);
      return ((data as any[]) ?? []).map((r) => r.other_id as string);
    },
  });
}

export async function excludeFriend(otherId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await (supabase as any)
    .from("friend_excludes").insert({ user_id: user.id, other_id: otherId });
  // 23505 = juz wykluczony; idempotentne, jak przy obserwowaniu.
  if (error && (error as any).code !== "23505") throw error;
}

export async function unexcludeFriend(otherId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await (supabase as any)
    .from("friend_excludes").delete().eq("user_id", user.id).eq("other_id", otherId);
  if (error) throw error;
}
