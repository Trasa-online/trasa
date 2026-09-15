import { supabase } from "@/integrations/supabase/client";
import { imageRatio, COVER_MAX_RATIO } from "@/lib/coverFormat";

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
  const pick = await pickPortraitCover(pool);
  const { error } = await (supabase as any).from("routes").update({ list_cover_url: pick }).eq("id", routeId);
  if (error) { console.warn("[ensureListCover]", error.message); return null; }
  return pick;
}

/**
 * Losowa okladka z puli, ale NAJPIERW sposrod pionowych (3:4 / 9:16 - regula z lib/coverFormat).
 * Mierzymy do 8 kandydatow naraz; gdy zadne nie jest pionowe (albo nie da sie ich wczytac),
 * losujemy z calej puli - auto-okladka nie moze zostawic wyjazdu bez miniatury.
 */
export async function pickPortraitCover(pool: string[]): Promise<string> {
  const sample = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
  const ratios = await Promise.all(sample.map((u) => imageRatio(u)));
  const portrait = sample.filter((_, i) => ratios[i] !== null && (ratios[i] as number) <= COVER_MAX_RATIO);
  const from = portrait.length ? portrait : pool;
  return from[Math.floor(Math.random() * from.length)];
}
