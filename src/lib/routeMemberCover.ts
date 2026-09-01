import { supabase } from "@/integrations/supabase/client";

// WLASNE rzeczy uczestnika w wyjezdzie (route_member_covers): okladka i notka o calym wyjezdzie. Host ustawia okladke wyjazdu
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

// ─── NOTKA O CALYM WYJEZDZIE, per uczestnik (2026-09-01) ─────────────────────
// Kazdy uczestnik pisze swoja i widzi ja u gory wyjazdu; notki pozostalych sa pod nia.
// Nie mylic z routes.description - to opis CALEGO wyjazdu, pisany przez hosta dla eksploracji.

export interface RouteMemberNote {
  user_id: string;
  note: string;
  username: string | null;
  avatar_url: string | null;
}

/** Notki uczestnikow tego wyjazdu (z profilem autora). Pusta notka nie jest zwracana. */
export async function fetchRouteMemberNotes(routeId: string): Promise<RouteMemberNote[]> {
  if (!routeId) return [];
  const { data, error } = await (supabase as any)
    .from("route_member_covers").select("user_id, note").eq("route_id", routeId).not("note", "is", null);
  if (error) { console.warn("[routeMemberCover] notes:", error.message); return []; }
  const rows = ((data ?? []) as any[]).filter((r) => String(r.note ?? "").trim());
  if (!rows.length) return [];
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  const { data: profs } = await (supabase as any)
    .from("profiles").select("id, username, avatar_url").in("id", rows.map((r) => r.user_id));
  for (const pr of (profs ?? []) as any[]) byId.set(pr.id, { username: pr.username, avatar_url: pr.avatar_url });
  return rows.map((r) => ({
    user_id: r.user_id,
    note: String(r.note).trim(),
    username: byId.get(r.user_id)?.username ?? null,
    avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
  }));
}

/** Zapis wlasnej notki o wyjezdzie. Pusta = kasujemy tresc (wiersz zostaje, bo moze niesc okladke). */
export async function setMyRouteNote(routeId: string, userId: string, note: string): Promise<boolean> {
  const value = note.trim() ? note.trim() : null;
  const { error } = await (supabase as any).from("route_member_covers")
    .upsert({ route_id: routeId, user_id: userId, note: value, updated_at: new Date().toISOString() },
            { onConflict: "route_id,user_id" });
  if (error) { console.warn("[routeMemberCover] setNote:", error.message); return false; }
  return true;
}
