// Miniatury generowane PRZY WGRYWANIU, zamiast przerabiania oryginalu w locie.
//
// Skad zmiana (2026-09-03): miniatury szly przez transformacje obrazow Supabase
// (`/storage/v1/render/image/...`). Dzialalo swietnie - 2,4 MB spadalo do ~250 kB - ale
// Supabase liczy je od OBRAZOW ZRODLOWYCH: 100 w planie, potem platne. Przy 190 zdjeciach
// bylismy juz 90 ponad limit, a licznik rosnie z kazdym nowym zdjeciem w bazie, nie z ruchem.
// Po przekroczeniu Supabase blokuje transformacje - czyli miniatury po prostu przestaja sie
// ladowac. Przy kilku tysiacach zdjec po premierze to kilkadziesiat dolarow miesiecznie za
// cos, co da sie zrobic raz, w momencie wgrywania.
//
// Model docelowy: obok kazdego pliku lezy jego miniatura pod ta sama sciezka + sufiks
// `.thumb`. Ten sam folder, wiec polityki RLS (scope per user) obejmuja ja automatycznie.
// Klient sklada adres miniatury deterministycznie, bez pytania bazy - patrz `thumbUrl`
// w [imageUrl.ts](./imageUrl.ts).

import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload, renderVariants } from "@/lib/imageCompression";

/** Sufiks sciezki miniatury. BEZ rozszerzenia - format niesie naglowek content-type,
 *  a `prepareImageForUpload` oddaje WebP albo JPEG zaleznie od wsparcia przegladarki. */
export const THUMB_SUFFIX = ".thumb";

/** Dluzszy bok miniatury. 800 px pokrywa ramki do ~400 px CSS na ekranie o podwojnej
 *  gestosci pikseli, czyli wszystkie kafelki i listy w apce. Wieksze widoki (hero, podglad
 *  pelnoekranowy) biora oryginal - patrz `thumbUrl`. */
export const THUMB_SIDE = 800;

const THUMB_QUALITY = 0.7;

export function thumbPathFor(path: string): string {
  return `${path}${THUMB_SUFFIX}`;
}

/**
 * Wrzuca miniature obok oryginalu. Best-effort: blad NIE moze wywrocic wgrywania zdjecia,
 * bo brak miniatury tylko obniza jakosc doswiadczenia (klient spadnie na oryginal), a brak
 * zdjecia to utrata tresci uzytkownika.
 *
 * @param path sciezka ORYGINALU w buckecie (bez sufiksu) - dokladnie ta, ktora poszla do `upload()`
 * @param source plik zrodlowy; moze byc juz skompresowany, miniatura i tak schodzi do 400 px
 */
export async function uploadThumb(bucket: string, path: string, source: File | Blob): Promise<void> {
  try {
    const file =
      source instanceof File
        ? source
        : new File([source], "source.jpg", { type: source.type || "image/jpeg" });
    const thumb = await prepareImageForUpload(file, THUMB_SIDE, THUMB_QUALITY);
    const { error } = await supabase.storage.from(bucket).upload(thumbPathFor(path), thumb, {
      contentType: thumb.type || "image/jpeg",
      upsert: true,
    });
    if (error) console.warn(`[imageThumbs] ${bucket}/${path}: ${error.message}`);
  } catch (e) {
    console.warn("[imageThumbs]", (e as Error)?.message ?? e);
  }
}

/**
 * Wgrywa zdjecie RAZEM z miniatura: jedno dekodowanie, dwa rownolegle wyslania (2026-09-08).
 *
 * Zastepuje wzorzec `upload(...)` + `uploadThumb(...)`, ktory dekodowal zdjecie dwa razy
 * i czekal na dwa wyslania po kolei. Przy zdjeciu z aparatu to byla roznica rzedu kilkunastu
 * sekund NA JEDNO ZDJECIE.
 *
 * Miniatura jest best-effort: jej blad nie przewraca wgrywania (klient spadnie na oryginal),
 * ale blad oryginalu owszem - brak zdjecia to utrata tresci uzytkownika.
 *
 * @returns `{ error }` oryginalu - taki sam ksztalt, jaki oddaje `storage.upload`
 */
/** Zdjecie + jego miniatura z JEDNEGO dekodowania. Rozdzielone od wyslania, bo czesc
 *  ekranow liczy sciezke z TRESCI gotowego bloba (SHA-256) i musi go miec wczesniej. */
export async function renderForUpload(
  file: File, maxSide = 1600, quality = 0.8,
): Promise<{ full: Blob; thumb: Blob }> {
  const [full, thumb] = await renderVariants(file, [
    { maxSide, quality },
    { maxSide: THUMB_SIDE, quality: THUMB_QUALITY },
  ]);
  return { full, thumb };
}

/** Wysyla oryginal i miniature ROWNOLEGLE. Miniatura jest best-effort: jej blad nie przewraca
 *  wgrywania (klient spadnie na oryginal), blad oryginalu owszem - to utrata tresci usera. */
export async function uploadPair(
  bucket: string, path: string, full: Blob, thumb: Blob, upsert = false,
): Promise<{ error: { message: string } | null }> {
  const [mainRes, thumbRes] = await Promise.all([
    supabase.storage.from(bucket).upload(path, full, {
      contentType: full.type || "image/jpeg", upsert, cacheControl: "31536000",
    }),
    supabase.storage.from(bucket).upload(thumbPathFor(path), thumb, {
      contentType: thumb.type || "image/jpeg", upsert: true, cacheControl: "31536000",
    }),
  ]);
  if (thumbRes.error) console.warn(`[imageThumbs] miniatura ${bucket}/${path}: ${thumbRes.error.message}`);
  return { error: mainRes.error ? { message: mainRes.error.message } : null };
}

/**
 * Wgrywa zdjecie RAZEM z miniatura: jedno dekodowanie, dwa rownolegle wyslania (2026-09-08).
 *
 * Zastepuje wzorzec `upload(...)` + `uploadThumb(...)`, ktory dekodowal zdjecie dwa razy
 * i czekal na dwa wyslania po kolei. Przy zdjeciu z aparatu (12 Mpix) to byla roznica rzedu
 * kilkunastu sekund NA JEDNO ZDJECIE.
 *
 * @returns `{ error }` oryginalu - taki sam ksztalt, jaki oddaje `storage.upload`
 */
export async function uploadWithThumb(
  bucket: string,
  path: string,
  file: File,
  opts?: { maxSide?: number; quality?: number; upsert?: boolean },
): Promise<{ error: { message: string } | null }> {
  const { full, thumb } = await renderForUpload(file, opts?.maxSide ?? 1600, opts?.quality ?? 0.8);
  return uploadPair(bucket, path, full, thumb, opts?.upsert ?? false);
}
