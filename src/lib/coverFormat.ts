// Format okladki wyjazdu (decyzja Nat 2026-09-13): okladka w eksploracji i na kartach profilu
// musi byc PIONOWA - 3:4 albo 9:16. Panoramy (poziome zdjecia) w mozaice eksploracji robily
// sie malutkie i psuly rytm siatki, wiec zamiast kadrowac je po cichu, nie pozwalamy ich
// wybrac: user od razu dostaje komunikat i wybiera inne zdjecie.
//
// Prog = szerokosc / wysokosc. 3:4 to 0,75, 9:16 to 0,5625; zapas do 0,8 lapie zdjecia
// z telefonu po lekkim przycieciu. Kwadrat (1,0) i wszystko szersze odpada.
export const COVER_MAX_RATIO = 0.8;

/** Proporcje zdjecia (szer/wys) po zaladowaniu; null gdy nie da sie go wczytac. */
export function imageRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Czy zdjecie nadaje sie na okladke. Gdy nie da sie go zmierzyc (blad sieci), NIE blokujemy -
 *  komunikat o formacie przy zdjeciu, ktorego nie widac, bylby mylacy. */
export async function isPortraitCover(url: string): Promise<boolean> {
  const r = await imageRatio(url);
  return r === null || r <= COVER_MAX_RATIO;
}
