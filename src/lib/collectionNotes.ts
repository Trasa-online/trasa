import { supabase } from "@/integrations/supabase/client";
import type { PlaceNote } from "@/lib/placeNotes";

// NOTKI PER-UCZESTNIK W KOLEKCJI (prosba Nat 2026-09-15: "kazdy uczestnik widzi wszystkie
// notki"). Lustro `pin_ratings` z wyjazdow - tabela `discovery_item_notes`, jeden wiersz na
// (kolekcja, user, miejsce), migracja 20260915d.
//
// ⚠️ `discovery_items.short_desc` ZOSTAJE i dalej trzyma notke WLASCICIELA - czyta go sekcja
// „Od użytkowników" na wizytowce i mechanizm synchronizacji notek. NIE pisz tam z UI: zapis
// idzie WYLACZNIE tutaj, a trigger `propagate_place_note` sam rozsyla notke dalej (w tym do
// `short_desc`, gdy pisze wlasciciel). Dwa punkty zapisu rozjechalyby te dwa zrodla.

export const collectionNotesKey = (collectionId: string | null | undefined) =>
  ["collection-notes", collectionId ?? null] as const;

/** Wszystkie notki uczestnikow w kolekcji + profile autorow (awatar do dymka). */
export async function fetchCollectionNotes(collectionId: string): Promise<PlaceNote[]> {
  const { data, error } = await (supabase as any)
    .from("discovery_item_notes")
    .select("user_id, place_name, note")
    .eq("collection_id", collectionId);
  if (error) { console.warn("[collectionNotes] fetch:", error.message); return []; }
  const rows = ((data ?? []) as any[]).filter((r) => r.note && String(r.note).trim());
  if (!rows.length) return [];
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { username: p.username, avatar_url: p.avatar_url });
  }
  return rows.map((r) => ({
    user_id: r.user_id, place_name: r.place_name, note: r.note ?? "", verdict: null,
    username: byId.get(r.user_id)?.username ?? null, avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
  }));
}

/**
 * Zapis MOJEJ notki o miejscu w tej kolekcji. Pusta tresc = notka znika (kasujemy wiersz,
 * zeby pusty dymek nie zostawal na liscie).
 *
 * Upsert po (collection_id, user_id, place_note_key(place_name)) - nazwa miejsca bywa
 * zapisana roznie w roznych zrodlach, a indeks unikalny stoi na ZNORMALIZOWANEJ nazwie,
 * wiec `onConflict` po samych kolumnach by go nie trafil. Dlatego: najpierw probujemy
 * UPDATE po dopasowaniu znormalizowanym, a INSERT tylko gdy nic nie zaktualizowano.
 */
export async function saveCollectionNote(collectionId: string, userId: string, placeName: string, note: string): Promise<boolean> {
  const value = note.trim();
  const key = placeName.trim().toLowerCase();
  const { data: existing } = await (supabase as any)
    .from("discovery_item_notes")
    .select("id, place_name")
    .eq("collection_id", collectionId)
    .eq("user_id", userId);
  const hit = ((existing ?? []) as any[]).find((r) => String(r.place_name ?? "").trim().toLowerCase() === key);

  if (!value) {
    if (!hit) return true;
    const { error } = await (supabase as any).from("discovery_item_notes").delete().eq("id", hit.id);
    if (error) { console.warn("[collectionNotes] delete:", error.message); return false; }
    return true;
  }
  if (hit) {
    const { error } = await (supabase as any).from("discovery_item_notes")
      .update({ note: value, updated_at: new Date().toISOString() }).eq("id", hit.id);
    if (error) { console.warn("[collectionNotes] update:", error.message); return false; }
    return true;
  }
  const { error } = await (supabase as any).from("discovery_item_notes")
    .insert({ collection_id: collectionId, user_id: userId, place_name: placeName, note: value });
  if (error) { console.warn("[collectionNotes] insert:", error.message); return false; }
  return true;
}
