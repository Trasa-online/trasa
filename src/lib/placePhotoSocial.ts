// #3e + #6: zdjecia userow dodawane do MIEJSCA (galeria wizytowki) + lajki zdjec w galerii.
// place_photos: zdjecia usera przypisane do miejsca (place_key = stabilna tozsamosc).
// photo_likes: lajki dowolnego zdjecia w galerii (photo_ref = stabilny klucz).
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "place-photos";

// Stabilna tozsamosc miejsca dla place_photos: google_place_id -> 'nazwa|miasto' (lower).
export function placeKeyOf(opts: { googlePlaceId?: string | null; placeName?: string | null; city?: string | null }): string {
  const gp = (opts.googlePlaceId ?? "").trim();
  if (gp) return `gpid:${gp}`;
  const name = (opts.placeName ?? "").trim().toLowerCase();
  const city = (opts.city ?? "").trim().toLowerCase();
  return `nc:${name}|${city}`;
}

// Stabilny klucz lajka: zdjecie usera (#3e) -> 'pp:{id}', inne (Storage/B2B) -> URL.
export function photoRefForUserPhoto(placePhotoId: string): string {
  return `pp:${placePhotoId}`;
}

export interface PlacePhotoRow {
  id: string;
  photo_url: string;
  user_id: string;
  created_at: string;
}

// Zdjecia userow dla miejsca (najnowsze pierwsze).
export async function fetchPlacePhotos(placeKey: string): Promise<PlacePhotoRow[]> {
  if (!placeKey) return [];
  const { data, error } = await (supabase as any)
    .from("place_photos")
    .select("id, photo_url, user_id, created_at")
    .eq("place_key", placeKey)
    .order("created_at", { ascending: false });
  if (error) { console.warn("[placePhotoSocial] fetchPlacePhotos:", error.message); return []; }
  return (data ?? []) as PlacePhotoRow[];
}

// Upload zdjecia usera do miejsca: plik -> Storage (folder = uid) -> wiersz place_photos.
export async function uploadPlacePhoto(
  file: File,
  opts: { userId: string; placeKey: string; placeName: string; city?: string | null },
): Promise<PlacePhotoRow | null> {
  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    // Nazwa unikalna bez Date.now()/random (deterministyczna z tresci nie jest wymagana) -
    // uzywamy crypto.randomUUID (dostepne w WebView/przegladarce).
    const uid = opts.userId;
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (up.error) { console.warn("[placePhotoSocial] upload:", up.error.message); return null; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photo_url = pub.publicUrl;
    const { data, error } = await (supabase as any)
      .from("place_photos")
      .insert({ place_key: opts.placeKey, place_name: opts.placeName, city: opts.city ?? null, user_id: uid, photo_url })
      .select("id, photo_url, user_id, created_at")
      .single();
    if (error) { console.warn("[placePhotoSocial] insert:", error.message); return null; }
    return data as PlacePhotoRow;
  } catch (e: any) {
    console.warn("[placePhotoSocial] uploadPlacePhoto exception:", e?.message ?? e);
    return null;
  }
}

export async function deletePlacePhoto(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("place_photos").delete().eq("id", id);
  if (error) { console.warn("[placePhotoSocial] delete:", error.message); return false; }
  return true;
}

export interface LikeState { count: number; liked: boolean }

// Lajki dla zestawu zdjec: liczniki (RPC) + ktore polubil biezacy user.
export async function fetchPhotoLikes(refs: string[], userId?: string | null): Promise<Map<string, LikeState>> {
  const map = new Map<string, LikeState>();
  const uniq = Array.from(new Set(refs.filter(Boolean)));
  if (!uniq.length) return map;
  uniq.forEach((r) => map.set(r, { count: 0, liked: false }));
  try {
    const { data: counts } = await (supabase as any).rpc("photo_like_counts", { p_refs: uniq });
    for (const row of counts ?? []) {
      const cur = map.get(row.photo_ref) ?? { count: 0, liked: false };
      map.set(row.photo_ref, { ...cur, count: Number(row.cnt) || 0 });
    }
    if (userId) {
      const { data: mine } = await (supabase as any)
        .from("photo_likes").select("photo_ref").eq("user_id", userId).in("photo_ref", uniq);
      for (const row of mine ?? []) {
        const cur = map.get(row.photo_ref) ?? { count: 0, liked: false };
        map.set(row.photo_ref, { ...cur, liked: true });
      }
    }
  } catch (e: any) {
    console.warn("[placePhotoSocial] fetchPhotoLikes:", e?.message ?? e);
  }
  return map;
}

// Przelacz lajk (dodaj/usun). Zwraca NOWY stan liked. Idempotentne po stronie DB (PK ref+user).
export async function togglePhotoLike(ref: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await (supabase as any).from("photo_likes").delete().eq("photo_ref", ref).eq("user_id", userId);
    if (error) { console.warn("[placePhotoSocial] unlike:", error.message); return currentlyLiked; }
    return false;
  }
  const { error } = await (supabase as any).from("photo_likes").insert({ photo_ref: ref, user_id: userId });
  if (error && !error.message?.includes("duplicate")) { console.warn("[placePhotoSocial] like:", error.message); return currentlyLiked; }
  return true;
}
