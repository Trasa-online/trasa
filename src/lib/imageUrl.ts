// Miniatury zdjec z Supabase Storage.
//
// Problem, ktory to rozwiazuje: apka wyswietlala ORYGINALY w miniaturkach - kafelek na karcie
// profilu ma 74 px, miniatura przy miejscu 64x96 px, a pobierany plik wazyl srednio 2,4 MB
// (pomiar produkcji 2026-09-01). Jedno przewiniecie profilu z 20 kafelkami to bylo ~40 MB
// transferu: z pakietu danych uzytkownika, z baterii i z limitu egressu projektu.
//
// Storage podaje ten sam plik pod dwoma sciezkami:
//   /storage/v1/object/public/<bucket>/<path>          - oryginal
//   /storage/v1/render/image/public/<bucket>/<path>    - przeskalowany w locie (+ cache CDN)
//
// UWAGA (2026-09-03): druga sciezka to platna funkcja liczona od OBRAZOW ZRODLOWYCH (100 w
// planie, potem naliczane), wiec licznik rosnie z liczba zdjec w bazie, a nie z ruchem. Po
// przekroczeniu Supabase ja BLOKUJE i miniatury przestaja sie ladowac. Dlatego domyslna
// sciezka to teraz miniatura zapisana obok pliku przy wgrywaniu ([imageThumbs.ts]), a
// transformacja w locie zostaje wylacznie jako awaryjne zapasowe zrodlo dla zdjec, ktore
// swojej miniatury nie maja (np. wgranych zanim to powstalo, gdyby backfill ich nie objal).

import { THUMB_SIDE, THUMB_SUFFIX } from "@/lib/imageThumbs";

const PUBLIC_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/** Czy to publiczny adres pliku w naszym Storage (tylko takie umiemy przerabiac). */
function isStorageObjectUrl(url: string): boolean {
  return url.includes(PUBLIC_SEGMENT);
}

/**
 * Adres miniatury zapisanej obok oryginalu przy wgrywaniu. Nic nie kosztuje i nie podlega
 * zadnym limitom - to zwykly plik. Zwraca `url` bez zmian dla wszystkiego, co nie jest
 * publicznym plikiem Storage (proxy zdjec Google `/api/place-photo`, data:, blob:, obce hosty).
 */
export function thumbUrl(url: string | null | undefined, size = 0): string | null {
  if (!url) return null;
  if (!isStorageObjectUrl(url)) return url;
  // Miniatura ma staly rozmiar (THUMB_SIDE). Dla ramek wiekszych niz polowa tej wartosci
  // (czyli powyzej ~400 px CSS na ekranie 2x) bylaby juz rozmyta, wiec oddajemy oryginal -
  // ten od 2026-09-03 i tak jest ograniczany przy wgrywaniu do 1600 px.
  if (size > THUMB_SIDE / 2) return url;
  const [base, query] = url.split("?");
  const thumb = `${base}${THUMB_SUFFIX}`;
  // Cache-buster z oryginalu (np. ?v=... przy podmianie awatara) musi zostac, inaczej po
  // zmianie zdjecia profilowego widac stara miniature z cache CDN.
  return query ? `${thumb}?${query}` : thumb;
}

/**
 * Zapasowe zrodlo: transformacja w locie. Uzywaj WYLACZNIE w `onError` po nieudanej
 * miniaturze - kazde uzycie dokłada obraz do platnego licznika transformacji.
 *
 * @param size dluzszy bok ramki w px CSS. Podawaj rozmiar DOCELOWY - funkcja sama mnozy przez 2
 *             na ekrany Retina i dopina `resize=contain`, wiec proporcje zostaja zachowane.
 */
export function renderUrl(url: string | null | undefined, size: number): string | null {
  if (!url) return null;
  if (!isStorageObjectUrl(url)) return url;
  const [base, query] = url.split("?");
  // *2 na gestosc pikseli telefonu; 1600 to gorna granica, wyzej nie ma juz zysku dla oka,
  // a rosna czas transformacji i rachunek za transfer.
  const box = Math.min(Math.round(size * 2), 1600);
  const rendered = base.replace(PUBLIC_SEGMENT, RENDER_SEGMENT);
  // UWAGA: sam `width` NIE skaluje wysokosci - Storage oddaje wtedy obraz przyciety do szerokosci,
  // z ORYGINALNA wysokoscia (zmierzone: zdjecie 1179x2556 -> 160x2556, 357 kB zamiast 24 kB).
  // Dopiero para width+height z resize=contain daje prawdziwa miniature mieszczaca sie w ramce,
  // z zachowaniem proporcji. quality 70: przy zdjeciach z telefonu roznicy nie widac.
  const params = `width=${box}&height=${box}&resize=contain&quality=70`;
  return query ? `${rendered}?${query}&${params}` : `${rendered}?${params}`;
}
