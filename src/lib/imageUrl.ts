// Miniatury przez transformacje obrazow Supabase (plan Pro).
//
// Problem, ktory to rozwiazuje: apka wyswietlala ORYGINALY w miniaturkach - kafelek na karcie
// profilu ma 74 px, miniatura przy miejscu 64x96 px, a pobierany plik wazyl srednio 2,4 MB
// (pomiar produkcji 2026-09-01). Jedno przewiniecie profilu z 20 kafelkami to bylo ~40 MB
// transferu: z pakietu danych uzytkownika, z baterii i z limitu egressu projektu.
//
// Storage podaje ten sam plik pod dwoma sciezkami:
//   /storage/v1/object/public/<bucket>/<path>          - oryginal
//   /storage/v1/render/image/public/<bucket>/<path>    - przeskalowany w locie (+ cache CDN)
// Pomiar na najciezszym pliku w bazie: 9,77 MB -> 248 kB przy width=200. 39x mniej.

const PUBLIC_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/**
 * Zwraca URL miniatury o zadanej szerokosci. Dotyka WYLACZNIE publicznych URL-i Supabase
 * Storage - wszystko inne (proxy zdjec Google `/api/place-photo`, data:, blob:, obce hosty)
 * przepuszcza bez zmian, bo tam transformacja nie istnieje.
 *
 * @param size dluzszy bok ramki w px CSS. Podawaj rozmiar DOCELOWY - funkcja sama mnozy przez 2
 *             na ekrany Retina i dopina `resize=contain`, wiec proporcje zostaja zachowane.
 */
export function thumbUrl(url: string | null | undefined, size: number): string | null {
  if (!url) return null;
  if (!url.includes(PUBLIC_SEGMENT)) return url;
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
