import { useEffect, useState } from "react";
import { thumbUrl } from "@/lib/imageUrl";

// Lancuch zrodel dla jednego zdjecia: miniatura -> oryginal -> porazka.
//
// Po co: od 2026-09-03 miniatury sa PLIKAMI zapisanymi przy wgrywaniu, a nie transformacja
// w locie ([imageThumbs.ts](../lib/imageThumbs.ts)). Zdjecie wgrane wczesniej moze swojej
// miniatury nie miec, gdyby backfill go nie objal - wtedy adres miniatury zwroci 404 i bez
// tego hooka user zobaczylby placeholder zamiast realnego zdjecia. Spadamy wiec na oryginal:
// ciezszy, ale zawsze istnieje.
//
// Swiadomie NIE wracamy tu do transformacji w locie - to ta platna funkcja, ktora wlasnie
// przestajemy uzywac, a po przekroczeniu limitu i tak oddaje blad.

export function useImageWithFallback(full: string | null | undefined, size: number) {
  // 0 = miniatura, 1 = oryginal, 2 = nie udalo sie nic
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  // Nowe zdjecie w tym samym komponencie (np. przewijanie listy) zaczyna od miniatury.
  useEffect(() => setStage(0), [full]);

  const src = stage === 0 ? thumbUrl(full, size) : stage === 1 ? (full ?? null) : null;

  return {
    src,
    failed: stage === 2 || !src,
    onError: () => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s)),
  };
}
