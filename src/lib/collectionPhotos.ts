import { supabase } from "@/integrations/supabase/client";

// ZDJECIA PER-UCZESTNIK W KOLEKCJI (prosba Nat 2026-09-15: "kazdy uczestnik widzi swoje
// zdjecie z awatarem, zeby bylo wiadomo kto co wrzucil"). Lustro `pinPhotos.ts` z wyjazdow -
// tabela `discovery_item_photos`, migracja 20260915e.
//
// ⚠️ `discovery_items.images[]` ZOSTAJE i nadal zapisuje je WLASCICIEL - czytaja te tablice
// okladki kafelkow i most do `place_photos`. Ta tabela jest zrodlem prawdy dla WIDOKU
// kolekcji (kto co wrzucil); zdjecie wspoltworcy do `images[]` nie trafia, bo tablica nie
// ma miejsca na autora, a okladka kolekcji nalezy do wlasciciela.

export interface CollectionPhoto {
  id: string;
  place_name: string;
  user_id: string | null;
  url: string;
  avatar_url: string | null;
  username: string | null;
}

export const collectionPhotosKey = (collectionId: string | null | undefined) =>
  ["collection-photos", collectionId ?? null] as const;

const nkey = (s: string) => String(s ?? "").toLowerCase().trim();

export async function fetchCollectionPhotos(collectionId: string): Promise<CollectionPhoto[]> {
  const { data, error } = await (supabase as any)
    .from("discovery_item_photos")
    .select("id, place_name, user_id, url, created_at")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: true });
  if (error) { console.warn("[collectionPhotos] fetch:", error.message); return []; }
  const rows = (data ?? []) as any[];
  const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const byId = new Map<string, { avatar_url: string | null; username: string | null }>();
  if (uids.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, avatar_url, username").in("id", uids);
    for (const p of (profs ?? []) as any[]) byId.set(p.id, { avatar_url: p.avatar_url, username: p.username });
  }
  return rows.map((r) => ({
    id: r.id, place_name: r.place_name, user_id: r.user_id, url: r.url,
    avatar_url: r.user_id ? (byId.get(r.user_id)?.avatar_url ?? null) : null,
    username: r.user_id ? (byId.get(r.user_id)?.username ?? null) : null,
  }));
}

/** Zdjecia pogrupowane po ZNORMALIZOWANEJ nazwie miejsca - ta sama regula co przy notkach. */
export function photosByPlace(photos: CollectionPhoto[]): Map<string, CollectionPhoto[]> {
  const m = new Map<string, CollectionPhoto[]>();
  for (const p of photos) {
    const k = nkey(p.place_name);
    const arr = m.get(k);
    if (arr) arr.push(p); else m.set(k, [p]);
  }
  return m;
}

export async function addCollectionPhoto(collectionId: string, placeName: string, userId: string, url: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("discovery_item_photos")
    .insert({ collection_id: collectionId, place_name: placeName, user_id: userId, url });
  if (error) { console.warn("[collectionPhotos] add:", error.message); return false; }
  return true;
}

/** Kasuje autor zdjecia albo wlasciciel kolekcji - rozstrzyga RLS, nie klient. */
export async function removeCollectionPhoto(photoId: string): Promise<boolean> {
  const { error } = await (supabase as any).from("discovery_item_photos").delete().eq("id", photoId);
  if (error) { console.warn("[collectionPhotos] remove:", error.message); return false; }
  return true;
}

export { nkey as collectionPhotoKey };
