import { useEffect, useMemo, useState } from "react";
import { thumbUrl } from "@/lib/imageUrl";

// Lancuch zrodel dla jednego zdjecia: miniatura -> oryginal -> porazka (placeholder).
//
// Po co: od 2026-09-03 miniatury sa PLIKAMI zapisanymi przy wgrywaniu
// ([imageThumbs.ts](../lib/imageThumbs.ts)). Zdjecie wgrane wczesniej moze swojej miniatury
// nie miec - wtedy jej adres zwroci 404 i bez tego hooka user zobaczylby placeholder zamiast
// realnego zdjecia. Spadamy wiec na oryginal: ciezszy, ale zawsze istnieje.
//
// WAZNE (blad 2026-09-04): `thumbUrl` przepuszcza bez zmian wszystko, co nie jest plikiem
// w naszym Storage - a wiec takze proxy zdjec Google (`/api/place-photo`). Dla takich adresow
// oba etapy lancucha byly IDENTYCZNE, wiec po bledzie ustawialismy ten sam `src`; przegladarka
// nie ponawia wtedy ladowania ani nie zglasza kolejnego bledu i lancuch stawal w miejscu na
// zepsutym obrazku. Objaw: ikona "?" zamiast ikony kategorii przy miejscach, ktorych
// referencja zdjecia Google wygasla. Dlatego zrodla sa teraz DEDUPLIKOWANE.
//
// Swiadomie NIE wracamy tu do transformacji w locie - to platna funkcja, ktora wlasnie
// przestajemy uzywac, a po przekroczeniu limitu i tak oddaje blad.

export function useImageWithFallback(full: string | null | undefined, size: number) {
  const sources = useMemo(() => {
    const candidates = [thumbUrl(full, size), full ?? null];
    return candidates.filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i);
  }, [full, size]);

  const [idx, setIdx] = useState(0);

  // Nowe zdjecie w tym samym komponencie (np. przewijanie listy) zaczyna od miniatury.
  useEffect(() => setIdx(0), [full]);

  const src = sources[idx] ?? null;

  return {
    src,
    failed: !src,
    onError: () => setIdx((i) => i + 1),
  };
}
