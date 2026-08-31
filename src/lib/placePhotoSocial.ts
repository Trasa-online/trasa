// #3e + #6: zdjecia userow dodawane do MIEJSCA (galeria wizytowki) + lajki zdjec w galerii.
// place_photos: zdjecia usera przypisane do miejsca (place_key = stabilna tozsamosc).
// photo_likes: lajki dowolnego zdjecia w galerii (photo_ref = stabilny klucz).
import { supabase } from "@/integrations/supabase/client";
import { moderateImageUrl } from "@/lib/imageModeration";

const BUCKET = "place-photos";

// Stabilna, GLOBALNA tozsamosc miejsca dla place_photos: google_place_id -> sama nazwa (lower).
// WAZNE: klucz NIE zawiera miasta - miejsce akumuluje zdjecia userow niezaleznie od kontekstu
// (lista globalna city="", trasa w innym miescie itp.). Dzieki temu okladka miejsca jest spojna
// wszedzie (wizja: miejsce zbiera zdjecia -> losowa okladka -> zacheta do przejecia przez biznes).
// Parametr `city` zostaje w sygnaturze dla zgodnosci call-site'ow, ale jest IGNOROWANY.
export function placeKeyOf(opts: { googlePlaceId?: string | null; placeName?: string | null; city?: string | null }): string {
  const gp = (opts.googlePlaceId ?? "").trim();
  if (gp) return `gpid:${gp}`;
  const name = (opts.placeName ?? "").trim().toLowerCase();
  return `nm:${name}`;
}

// Stabilny klucz lajka: zdjecie usera (#3e) -> 'pp:{id}', inne (Storage/B2B) -> URL.
export function photoRefForUserPhoto(placePhotoId: string): string {
  return `pp:${placePhotoId}`;
}

// Kandydujace klucze miejsca (pin/item) do dopasowania place_photos. Sprawdzamy DWA:
// gpid:{google_place_id} oraz nm:{nazwa} - wizytowka zapisuje zdjecie pod jednym z nich
// (MockPlace z tworzenia czesto nie ma google_place_id -> nm:). Miasto ignorowane (klucz globalny).
export function pinCoverKeys(pin: { google_place_id?: string | null; place_name?: string | null }, _city?: string | null): string[] {
  const nm = placeKeyOf({ googlePlaceId: null, placeName: pin.place_name });
  const gp = pin.google_place_id ? placeKeyOf({ googlePlaceId: pin.google_place_id, placeName: pin.place_name }) : null;
  return gp ? [gp, nm] : [nm];
}

// Stabilny "losowy" wybor okladki miejsca sposrod jego zdjec (deterministyczny per klucz -
// nie migocze przy renderach, ale rozklada okladke miedzy roznych userow zamiast zawsze
// najnowszego). Wizja: miejsce z wieloma zdjeciami -> losowa okladka -> zacheta do przejecia
// profilu przez biznes. Zwraca URL lub null.
function hashIndex(s: string, n: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return n > 0 ? h % n : 0;
}
export function pickPlaceCover(map: Map<string, string[]> | undefined | null, keys: string[]): string | null {
  if (!map) return null;
  for (const k of keys) {
    const urls = map.get(k);
    if (urls && urls.length) return urls[hashIndex(k, urls.length)];
  }
  return null;
}

// #3: dedup galerii po TRESCI. Hash (sha256) zdjecia pozwala scalic ten sam plik wgrany dwoma
// kanalami (review_photos vs group_trip_photos = rozne URL, identyczna zawartosc).
export async function sha256OfFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function upsertPhotoHash(url: string, sha256: string): Promise<void> {
  try { await (supabase as any).from("photo_hashes").upsert({ url, sha256 }, { onConflict: "url" }); }
  catch (e: any) { console.warn("[placePhotoSocial] upsertPhotoHash:", e?.message ?? e); }
}
export async function fetchPhotoHashes(urls: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const uniq = Array.from(new Set(urls.filter(Boolean)));
  if (!uniq.length) return m;
  try {
    const { data } = await (supabase as any).from("photo_hashes").select("url, sha256").in("url", uniq);
    for (const r of data ?? []) m.set(r.url, r.sha256);
  } catch (e: any) { console.warn("[placePhotoSocial] fetchPhotoHashes:", e?.message ?? e); }
  return m;
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

// Batch: dla zestawu place_key zwraca mape place_key -> zdjecia userow (najnowsze pierwsze).
// Do okladek miejsc w tworzeniu trasy / galerii (bez N zapytan).
export async function fetchPlacePhotosForKeys(keys: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  if (!uniq.length) return map;
  const { data, error } = await (supabase as any)
    .from("place_photos")
    .select("place_key, photo_url, created_at")
    .in("place_key", uniq)
    .order("created_at", { ascending: false });
  if (error) { console.warn("[placePhotoSocial] fetchPlacePhotosForKeys:", error.message); return map; }
  for (const row of data ?? []) {
    const arr = map.get(row.place_key) ?? [];
    arr.push(row.photo_url);
    map.set(row.place_key, arr);
  }
  return map;
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
    // SafeSearch (Vision) PRZED wpisem do galerii - odrzucone zdjecie kasujemy ze Storage,
    // zeby nie zostal osierocony plik. Brak klucza / blad = przepuszczamy (fail-open).
    if (await moderateImageUrl(photo_url, "place_photo", { place_key: opts.placeKey, place_name: opts.placeName, city: opts.city ?? null }) === "rejected") {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      throw new Error("MODERATION_REJECTED");
    }
    const { data, error } = await (supabase as any)
      .from("place_photos")
      .insert({ place_key: opts.placeKey, place_name: opts.placeName, city: opts.city ?? null, user_id: uid, photo_url })
      .select("id, photo_url, user_id, created_at")
      .single();
    if (error) { console.warn("[placePhotoSocial] insert:", error.message); return null; }
    return data as PlacePhotoRow;
  } catch (e: any) {
    if (e?.message === "MODERATION_REJECTED") throw e;   // rozroznialny blad -> wlasciwy komunikat
    console.warn("[placePhotoSocial] uploadPlacePhoto exception:", e?.message ?? e);
    return null;
  }
}

// Podepnij ISTNIEJACE zdjecie (juz w Storage, np. wgrane do pozycji listy w buckecie route-images)
// do galerii MIEJSCA. Dzieki temu zdjecie dodane przy miejscu na liscie widac tez w jego wizytowce
// i na okladkach (place_photos to jedyne zrodlo "zdjec userow" dla miejsca).
// Idempotentne: ten sam URL nie zostanie dopisany drugi raz.
export async function linkPhotoToPlace(opts: {
  userId: string; placeKey: string; placeName: string; city?: string | null; photoUrl: string;
}): Promise<void> {
  if (!opts.placeKey || !opts.photoUrl) return;
  try {
    const { data: existing } = await (supabase as any)
      .from("place_photos").select("id").eq("place_key", opts.placeKey).eq("photo_url", opts.photoUrl).maybeSingle();
    if (existing?.id) return;
    const { error } = await (supabase as any).from("place_photos").insert({
      place_key: opts.placeKey, place_name: opts.placeName, city: opts.city ?? null,
      user_id: opts.userId, photo_url: opts.photoUrl,
    });
    if (error) console.warn("[placePhotoSocial] linkPhotoToPlace:", error.message);
  } catch (e) {
    console.warn("[placePhotoSocial] linkPhotoToPlace exception:", e instanceof Error ? e.message : e);
  }
}

// Odepnij zdjecie od miejsca po URL (usuniecie zdjecia z pozycji listy). Kasuje TYLKO wiersz
// wskazanego usera - cudze zdjecia miejsca zostaja nietkniete.
export async function unlinkPhotoFromPlace(opts: { userId: string; placeKey: string; photoUrl: string }): Promise<void> {
  if (!opts.placeKey || !opts.photoUrl) return;
  try {
    await (supabase as any).from("place_photos").delete()
      .eq("place_key", opts.placeKey).eq("photo_url", opts.photoUrl).eq("user_id", opts.userId);
  } catch (e) {
    console.warn("[placePhotoSocial] unlinkPhotoFromPlace:", e instanceof Error ? e.message : e);
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
