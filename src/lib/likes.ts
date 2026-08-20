import { supabase } from "@/integrations/supabase/client";

// Polubienia tras (tabela likes) i list (collection_likes). Powiadomienie ownera leci przez
// SECURITY DEFINER trigger (notify_route_like / notify_list_like) - nic z klienta.

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

export async function fetchListLike(collectionId: string, userId?: string | null): Promise<LikeState> {
  const [{ count }, mine] = await Promise.all([
    (supabase as any).from("collection_likes").select("*", { count: "exact", head: true }).eq("collection_id", collectionId),
    userId ? (supabase as any).from("collection_likes").select("collection_id").eq("collection_id", collectionId).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { count: count ?? 0, liked: !!(mine as any)?.data };
}

export async function toggleListLike(collectionId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await (supabase as any).from("collection_likes").delete().eq("collection_id", collectionId).eq("user_id", userId);
    if (error) { console.warn("[likes] unlike list:", error.message); return currentlyLiked; }
    return false;
  }
  const { error } = await (supabase as any).from("collection_likes").insert({ collection_id: collectionId, user_id: userId });
  if (error && !String(error.message).includes("duplicate")) { console.warn("[likes] like list:", error.message); return currentlyLiked; }
  return true;
}
