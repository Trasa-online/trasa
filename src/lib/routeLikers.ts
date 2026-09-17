import { supabase } from "@/integrations/supabase/client";

// KTO POLUBIL WYJAZD. Autor i uczestnicy nie moga polubic wlasnego wyjazdu (trigger
// `guard_like_not_own_trip`, migracja 20260917c), wiec serce przy tytule znaczy dla nich
// co innego niz dla goscia: nie jest przelacznikiem, tylko wejsciem do tej listy.
//
// `likes` ma publiczny SELECT, wiec nie potrzeba tu zadnego RPC - ale profile czytamy
// osobnym zapytaniem, bo `profiles` ma kolumnowe granty i `select("*")` by sie wywalil.

export interface Liker {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
  avatar_frame: string | null;
  avatar_frame_color: string | null;
}

export const routeLikersKey = (routeId?: string | null) => ["route-likers", routeId] as const;

export async function fetchRouteLikers(routeId: string): Promise<Liker[]> {
  const { data: rows, error } = await (supabase as any)
    .from("likes").select("user_id, created_at")
    .eq("route_id", routeId).order("created_at", { ascending: false });
  if (error) { console.warn("[routeLikers] likes:", error.message); return []; }
  const ids = [...new Set(((rows as any[]) ?? []).map((r) => r.user_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: profs } = await (supabase as any)
    .from("profiles").select("id, username, first_name, avatar_url, avatar_frame, avatar_frame_color").in("id", ids);
  const byId = new Map<string, Liker>(((profs as Liker[]) ?? []).map((p) => [p.id, p]));
  // Kolejnosc z `likes` (najnowsze na gorze), nie z `profiles` - `in(...)` nie gwarantuje zadnej.
  return ids.map((id) => byId.get(id)).filter((p): p is Liker => !!p);
}
