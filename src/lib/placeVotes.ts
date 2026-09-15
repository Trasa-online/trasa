import { supabase } from "@/integrations/supabase/client";

// Glosowanie na miejsca (tabela place_votes, migracja 20260826e). Kazdy uczestnik = 1 glos/miejsce;
// host widzi liczbe glosow przy "Wybierz miejsca". count = wszyscy, voted = czy JA glosowalem.
export interface PlaceVoteInfo { count: number; voted: boolean; }

const nkey = (s: string) => String(s ?? "").toLowerCase().trim();

export async function fetchPlaceVotes(routeId: string, userId: string | null): Promise<Map<string, PlaceVoteInfo>> {
  const m = new Map<string, PlaceVoteInfo>();
  const { data, error } = await (supabase as any).from("place_votes").select("place_name, user_id").eq("route_id", routeId);
  if (error) { console.error("[placeVotes] fetch:", error.message); return m; }
  for (const r of (data ?? []) as any[]) {
    const k = nkey(r.place_name);
    const cur = m.get(k) ?? { count: 0, voted: false };
    cur.count += 1;
    if (userId && r.user_id === userId) cur.voted = true;
    m.set(k, cur);
  }
  return m;
}

export async function toggleVote(routeId: string, placeName: string, userId: string, voted: boolean): Promise<boolean> {
  if (voted) {
    const { error } = await (supabase as any).from("place_votes").delete()
      .eq("route_id", routeId).eq("user_id", userId).eq("place_name", placeName);
    if (error) { console.error("[placeVotes] unvote:", error.message); return false; }
  } else {
    const { error } = await (supabase as any).from("place_votes").insert({ route_id: routeId, place_name: placeName, user_id: userId });
    if (error) { console.error("[placeVotes] vote:", error.message); return false; }
  }
  return true;
}

export { nkey as placeVoteKey };
