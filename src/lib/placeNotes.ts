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
  /** Werdykt autora o miejscu (id z PLACE_VERDICT_TAGS) - pokazywany przy jego notce. */
  verdict?: string | null;
  username: string | null;
  avatar_url: string | null;
}

const nkey = (s: string) => String(s ?? "").toLowerCase().trim();

// Wszystkie notki uczestnikow dla podanych tras + profil autora (avatar/username). Zwraca plaska liste.
export async function fetchRouteNotesWithAuthors(routeIds: string[]): Promise<PlaceNote[]> {
  const ids = Array.from(new Set(routeIds.filter(Boolean)));
  if (!ids.length) return [];
  const { data, error } = await (supabase as any)
    .from("pin_ratings").select("route_id, user_id, place_name, note, verdict").in("route_id", ids);
  if (error) { console.error("[placeNotes] fetch failed:", error.message); return []; }
  // Wiersz liczy sie, gdy niesie notke ALBO werdykt - samo klikniecie chipa tez jest wypowiedzia.
  const rows = ((data ?? []) as any[]).filter((r) => (r.note && String(r.note).trim()) || r.verdict);
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }
  return rows.map((r) => ({
    route_id: r.route_id, user_id: r.user_id, place_name: r.place_name, note: r.note ?? "", verdict: r.verdict ?? null,
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

// ─── Notki o MIEJSCU (wizytowka, sekcja "Od użytkowników") ────────────────────
// Zbiera notki userow o danym miejscu z DWOCH publicznych zrodel:
//   1) pin_ratings.note z tras OPUBLIKOWANYCH (status='published'),
//   2) discovery_items.short_desc z list PUBLICZNYCH i zaakceptowanych (moderation).
// Prywatne wyjazdy (robocze, grupowe przed publikacja) i prywatna lista "Ogolne" NIE trafiaja
// tutaj - notka staje sie widoczna dopiero, gdy user swiadomie opublikuje trase/liste.
// Dopasowanie po NAZWIE miejsca (tak samo jak notesByPlace) - place_name jest w obu tabelach.
export interface PlaceUserNote {
  key: string;
  note: string;
  username: string | null;
  avatar_url: string | null;
  source: "trip" | "list";
}

// Escape %/_ - inaczej nazwa typu "Cafe 100%" dziala jak wzorzec LIKE i dociaga cudze miejsca.
const likeSafe = (s: string) => String(s ?? "").replace(/[\\%_]/g, (m) => "\\" + m);

export async function fetchPlaceNotes(placeName: string): Promise<PlaceUserNote[]> {
  const name = String(placeName ?? "").trim();
  if (!name) return [];
  const safe = likeSafe(name);

  const [trips, lists] = await Promise.all([
    (supabase as any)
      .from("pin_ratings")
      .select("note, user_id, created_at, routes!inner(status)")
      .eq("routes.status", "published")
      .ilike("place_name", safe)
      .not("note", "is", null)
      .limit(30)
      .then(({ data, error }: any) => { if (error) { console.warn("[placeNotes] trips:", error.message); return []; } return (data ?? []) as any[]; }),
    (supabase as any)
      .from("discovery_items")
      .select("short_desc, discovery_collections!inner(user_id, is_public, moderation_status, author_name, author_avatar)")
      .eq("discovery_collections.is_public", true)
      .neq("discovery_collections.moderation_status", "rejected") // soft-moderacja: liczy sie tylko odrzucenie
      .ilike("place_name", safe)
      .not("short_desc", "is", null)
      .limit(30)
      .then(({ data, error }: any) => { if (error) { console.warn("[placeNotes] lists:", error.message); return []; } return (data ?? []) as any[]; }),
  ]);

  // Autorzy notek z tras - profil (username/avatar) doczytany jednym zapytaniem.
  const uids = Array.from(new Set(trips.map((r: any) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }

  const out: PlaceUserNote[] = [];
  const seen = new Set<string>();
  const push = (n: PlaceUserNote) => {
    const dedup = `${n.username ?? ""}|${n.note.trim().toLowerCase()}`;
    if (!n.note.trim() || seen.has(dedup)) return;
    seen.add(dedup);
    out.push(n);
  };
  for (const r of trips as any[]) {
    push({
      key: `t-${r.user_id}-${out.length}`, note: String(r.note),
      username: byId.get(r.user_id)?.username ?? null, avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
      source: "trip",
    });
  }
  for (const r of lists as any[]) {
    const c = r.discovery_collections ?? {};
    push({
      key: `l-${c.user_id ?? "x"}-${out.length}`, note: String(r.short_desc),
      username: c.author_name ?? null, avatar_url: c.author_avatar ?? null, source: "list",
    });
  }
  return out.slice(0, 12);
}
