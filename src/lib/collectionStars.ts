// Gwiazdki („wyroznienia") przy miejscach kolekcji PER UCZESTNIK (2026-09-20, migracja
// `20260920b_collection_item_stars`). Jeden wiersz na (kolekcja, user, miejsce) - klucz
// miejsca = znormalizowana nazwa (`place_note_key`), jak przy notkach.
// `discovery_items.is_top` znaczy odtad „gwiazdka WLASCICIELA" i utrzymuje je trigger -
// klient (takze wlasciciel) pisze WYLACZNIE tutaj.
import { supabase } from "@/integrations/supabase/client";

export type CollectionStar = { user_id: string; place_name: string };

export const collectionStarsKey = (collectionId: string | null | undefined) => ["collection-stars", collectionId ?? ""];

export const starKey = (name: string | null | undefined) => String(name ?? "").trim().toLowerCase();

export async function fetchCollectionStars(collectionId: string): Promise<CollectionStar[]> {
  const { data, error } = await (supabase as any)
    .from("discovery_item_stars").select("user_id, place_name").eq("collection_id", collectionId);
  if (error) { console.warn("[collectionStars] fetch:", error.message); return []; }
  return (data ?? []) as CollectionStar[];
}

export async function setCollectionStar(collectionId: string, userId: string, placeName: string, on: boolean): Promise<boolean> {
  if (on) {
    // Indeks unikalny jest FUNKCYJNY (place_note_key), wiec `upsert(onConflict)` nie ma czego
    // wskazac - duplikat (23505) traktujemy jak sukces: gwiazdka juz stoi.
    const { error } = await (supabase as any).from("discovery_item_stars")
      .insert({ collection_id: collectionId, user_id: userId, place_name: placeName });
    if (error && error.code !== "23505") { console.warn("[collectionStars] set:", error.message); return false; }
    return true;
  }
  const safe = placeName.replace(/[\\%_]/g, (m: string) => "\\" + m);
  const { error } = await (supabase as any).from("discovery_item_stars")
    .delete().eq("collection_id", collectionId).eq("user_id", userId).ilike("place_name", safe);
  if (error) { console.warn("[collectionStars] unset:", error.message); return false; }
  return true;
}
