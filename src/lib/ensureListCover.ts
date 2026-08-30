import { supabase } from "@/integrations/supabase/client";

// Miniatura wyjazdu w EKSPLORACJI (routes.list_cover_url). Bramka eksploracji jej wymaga -
// trasa bez niej nie pojawi sie w feedzie (patrz reference_content_ops_scripts). Gdy user nie
// wybral okladki recznie, losujemy ja z jego wlasnych zdjec z wyjazdu.
// ⛔ Nigdy ze zdjec Google - okladka ma byc tresci uzytkownikow (project_route_cover_own_photos_only).
export async function ensureListCover(routeId: string, poolUrls: string[]): Promise<string | null> {
  if (!routeId) return null;
  const { data: row } = await (supabase as any)
    .from("routes").select("list_cover_url").eq("id", routeId).maybeSingle();
  if (row?.list_cover_url) return row.list_cover_url as string;

  const pool = poolUrls.filter((u): u is string => typeof u === "string" && u.length > 0);
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const { error } = await (supabase as any).from("routes").update({ list_cover_url: pick }).eq("id", routeId);
  if (error) { console.warn("[ensureListCover]", error.message); return null; }
  return pick;
}
