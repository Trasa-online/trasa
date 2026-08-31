import { supabase } from "@/integrations/supabase/client";

// Wlasna okladka wyjazdu per UCZESTNIK (route_member_covers). Host ustawia okladke wyjazdu
// (routes.list_cover_url) i to ona reprezentuje wyjazd w EKSPLORACJI; kazdy uczestnik moze
// dodatkowo wybrac SWOJE zdjecie, ktore widzi u siebie (karta na profilu, hero w widoku wyjazdu).
// Wybor jednej osoby nie zmienia widoku pozostalych. Brak wiersza = fallback na okladke hosta.

/** Okladki wybrane przez danego usera dla zestawu wyjazdow: route_id -> cover_url. */
export async function fetchRouteCoversFor(userId: string, routeIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = routeIds.filter(Boolean);
  if (!userId || !ids.length) return map;
  const { data, error } = await (supabase as any)
    .from("route_member_covers").select("route_id, cover_url")
    .eq("user_id", userId).in("route_id", ids);
  if (error) { console.warn("[routeMemberCover] fetch:", error.message); return map; }
  for (const r of data ?? []) map.set(r.route_id, r.cover_url);
  return map;
}

export async function setMyRouteCover(routeId: string, userId: string, coverUrl: string): Promise<boolean> {
  const { error } = await (supabase as any).from("route_member_covers")
    .upsert({ route_id: routeId, user_id: userId, cover_url: coverUrl, updated_at: new Date().toISOString() },
            { onConflict: "route_id,user_id" });
  if (error) { console.warn("[routeMemberCover] set:", error.message); return false; }
  return true;
}

export async function clearMyRouteCover(routeId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any).from("route_member_covers")
    .delete().eq("route_id", routeId).eq("user_id", userId);
  if (error) console.warn("[routeMemberCover] clear:", error.message);
}
