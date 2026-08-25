import { supabase } from "@/integrations/supabase/client";

// Notki miejsc MULTI-USER (2026-08-25): kazdy uczestnik wyjazdu widzi notki WSZYSTKICH innych
// uczestnikow (awatar + imie + tresc), tez w eksploracji. Zrodlo: tabela pin_ratings (route_id,
// user_id, place_name, note). RLS SELECT juz pozwala czytac wszystkie notki gdy routes.is_shared=true
// (trasy grupowe/opublikowane); dla prywatnych (solo draft) tylko wlasne - ale solo ma jednego autora.

export interface PlaceNote {
  route_id: string;
  user_id: string;
  place_name: string;
  note: string;
  username: string | null;
  avatar_url: string | null;
}

const nkey = (s: string) => String(s ?? "").toLowerCase().trim();

// Wszystkie notki uczestnikow dla podanych tras + profil autora (avatar/username). Zwraca plaska liste.
export async function fetchRouteNotesWithAuthors(routeIds: string[]): Promise<PlaceNote[]> {
  const ids = Array.from(new Set(routeIds.filter(Boolean)));
  if (!ids.length) return [];
  const { data, error } = await (supabase as any)
    .from("pin_ratings").select("route_id, user_id, place_name, note").in("route_id", ids).not("note", "is", null);
  if (error) { console.error("[placeNotes] fetch failed:", error.message); return []; }
  const rows = ((data ?? []) as any[]).filter((r) => r.note && String(r.note).trim());
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }
  return rows.map((r) => ({
    route_id: r.route_id, user_id: r.user_id, place_name: r.place_name, note: r.note,
    username: byId.get(r.user_id)?.username ?? null, avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
  }));
}

// Grupowanie notek po znormalizowanej nazwie miejsca -> Map<placeKey, PlaceNote[]>.
export function notesByPlace(notes: PlaceNote[]): Map<string, PlaceNote[]> {
  const m = new Map<string, PlaceNote[]>();
  for (const n of notes) {
    const k = nkey(n.place_name);
    const arr = m.get(k);
    if (arr) arr.push(n); else m.set(k, [n]);
  }
  return m;
}

export { nkey as placeNoteKey };
