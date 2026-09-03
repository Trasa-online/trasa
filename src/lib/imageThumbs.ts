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
import { prepareImageForUpload } from "@/lib/imageCompression";

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
