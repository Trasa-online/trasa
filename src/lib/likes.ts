import { supabase } from "@/integrations/supabase/client";

// Polubienia TRAS (tabela likes). Powiadomienie ownera leci przez SECURITY DEFINER trigger
// (notify_route_like) - nic z klienta.
//
// LISTY MIEJSC NIE MAJA POLUBIEN (decyzja Nat 2026-09-01) - zostaje sam zapis listy, bo to on
// niesie intencje ("chce tam wrocic") i to on buduje powiadomienia o nowych miejscach. Serce
// przy liscie bylo drugim, slabszym sygnalem obok zakladki i tylko rozmywalo obraz.
// Tabela collection_likes i kolumna discovery_collections.likes_count zostaja w bazie z danymi
// historycznymi - nic juz do nich nie pisze ani z nich nie czyta.

export interface LikeState { count: number; liked: boolean }

export async function fetchRouteLike(routeId: string, userId?: string | null): Promise<LikeState> {
  const [{ count }, mine] = await Promise.all([
    (supabase as any).from("likes").select("*", { count: "exact", head: true }).eq("route_id", routeId),
    userId ? (supabase as any).from("likes").select("route_id").eq("route_id", routeId).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { count: count ?? 0, liked: !!(mine as any)?.data };
}

export async function toggleRouteLike(routeId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await (supabase as any).from("likes").delete().eq("route_id", routeId).eq("user_id", userId);
    if (error) { console.warn("[likes] unlike route:", error.message); return currentlyLiked; }
    return false;
  }
  const { error } = await (supabase as any).from("likes").insert({ route_id: routeId, user_id: userId });
  if (error && !String(error.message).includes("duplicate")) { console.warn("[likes] like route:", error.message); return currentlyLiked; }
  return true;
}
