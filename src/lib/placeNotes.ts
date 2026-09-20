import { supabase } from "@/integrations/supabase/client";

// Notki miejsc MULTI-USER (2026-08-25): kazdy uczestnik wyjazdu widzi notki WSZYSTKICH innych
// uczestnikow (awatar + imie + tresc), tez w eksploracji. Zrodlo: tabela pin_ratings (route_id,
// user_id, place_name, note). RLS SELECT juz pozwala czytac wszystkie notki gdy routes.is_shared=true
// (trasy grupowe/opublikowane); dla prywatnych (solo draft) tylko wlasne - ale solo ma jednego autora.

export interface PlaceNote {
  /** Trasa, z ktorej pochodzi notka. Brak = notka z KOLEKCJI (discovery_item_notes, 2026-09-15). */
  route_id?: string;
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
  // Liczy sie tylko wiersz z TRESCIA notki - werdykty zniknely z apki 2026-09-13.
  const rows = ((data ?? []) as any[]).filter((r) => r.note && String(r.note).trim());
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
//   2) discovery_items.short_desc z kolekcji PUBLICZNYCH i zaakceptowanych (moderation).
// Prywatne wyjazdy (robocze, grupowe przed publikacja) i prywatna kolekcja "Ogolne" NIE trafiaja
// tutaj - notka staje sie widoczna dopiero, gdy user swiadomie opublikuje trase/kolekcje.
// Dopasowanie po NAZWIE miejsca (tak samo jak notesByPlace) - place_name jest w obu tabelach.
// JEDNA notka na OSOBE (decyzja Nat 2026-09-13): notka usera o miejscu jest wspolna dla
// wszystkich jego kolekcji i wyjazdow (migracja 20260913f synchronizuje ja triggerami), wiec
// tutaj dedupujemy po user_id, a nazwe i awatar bierzemy z profilu - to samo zrodlo dla obu
// tabel (wczesniej kolekcja podawala author_name "Natalia", trasa username "nyszje" i ta sama
// osoba wygladala na dwie).
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

  // Jedna notka na osobe: pierwszy napotkany wiersz usera wygrywa (po synchronizacji wszystkie
  // jego wiersze niosa te sama tresc; wyjazd przed kolekcja tylko dla stalej kolejnosci).
  type Row = { user_id: string; note: string; source: "trip" | "list"; author_name?: string | null; author_avatar?: string | null };
  const rows: Row[] = [
    ...(trips as any[]).map((r) => ({ user_id: String(r.user_id ?? ""), note: String(r.note ?? ""), source: "trip" as const })),
    ...(lists as any[]).map((r) => {
      const c = r.discovery_collections ?? {};
      return { user_id: String(c.user_id ?? ""), note: String(r.short_desc ?? ""), source: "list" as const, author_name: c.author_name, author_avatar: c.author_avatar };
    }),
  ].filter((r) => r.note.trim());
  const byUser = new Map<string, Row>();
  for (const r of rows) if (!byUser.has(r.user_id || r.note)) byUser.set(r.user_id || r.note, r);

  // Profil (username/avatar) jednym zapytaniem dla WSZYSTKICH autorow - kolekcja i trasa maja
  // wtedy te sama nazwe przy tej samej osobie; author_name/author_avatar z kolekcji to zapas.
  const uids = Array.from(byUser.keys()).filter((u) => UUID_RE.test(u));
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }

  return Array.from(byUser.values()).slice(0, 12).map((r, i) => ({
    key: `${r.source[0]}-${r.user_id || "x"}-${i}`,
    note: r.note,
    username: byId.get(r.user_id)?.username ?? r.author_name ?? null,
    avatar_url: byId.get(r.user_id)?.avatar_url ?? r.author_avatar ?? null,
    source: r.source,
  }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
