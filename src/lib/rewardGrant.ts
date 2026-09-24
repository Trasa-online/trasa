import { supabase } from "@/integrations/supabase/client";

// NAGRODA PRZYZNANA RECZNIE (wpis w `frame_grants`, migracja 20260924b).
//
// Od 2026-09-24 zaproszenia do testow ida prosto na TestFlight, a ten adres nie przyjmuje
// parametrow - wiec licznik "N z 3" nie policzy juz nikogo, kogo tester realnie przyprowadzil.
// Do premiery nakladke-nagrode przyznajemy wiec RECZNIE i zawiadamiamy o tym banerem na
// profilu (`RewardThanksBanner`).
//
// ⛔ To NIE jest sciezka prezentow (`moonstars`, `banana`) - te maja wlasny pelnoekranowy
// arkusz (`FrameGiftSheet` + RPC `my_frame_gift`) i RPC nizej celowo je pomija.
//
// Jedno zapytanie na sesje, dwoch czytelnikow (baner + karta zaproszen) po TYM SAMYM kluczu -
// karta musi wiedziec, ze nie ma juz czego zdobywac, a baner, czy user o tym wie.

export type RewardGrant = { frame: string; seen: boolean } | null;

export const rewardGrantKey = (userId?: string | null) => ["reward-grant", userId] as const;

export async function fetchRewardGrant(): Promise<RewardGrant> {
  const { data, error } = await (supabase as any).rpc("my_reward_grant");
  if (error) { console.warn("[reward] my_reward_grant:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.frame) return null;
  return { frame: row.frame as string, seen: !!row.seen };
}

/** „Juz o tym wie" - ta sama kolumna i to samo RPC, co przy prezentach. */
export async function markRewardSeen(frame: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_frame_gift_seen", { p_frame: frame });
  if (error) console.warn("[reward] mark_frame_gift_seen:", error.message);
}
