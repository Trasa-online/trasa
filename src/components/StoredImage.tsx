import { resolveStored } from "@/components/PlacePhoto";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";

// Zdjecie z naszego Storage w MALEJ ramce (kafelek, siatka galerii, miniatura przy miejscu).
//
// Po co osobny komponent: kafelek 76-84 px ciagnal ORYGINAL - srednio 1-3 MB na sztuke.
// Szesc zdjec przy jednym miejscu to bylo kilkanascie MB, wiec na telefonie zdjecia albo
// ladowaly sie bardzo dlugo, albo wcale (zgloszenie Nat 2026-09-06). Tu idzie zapisana
// miniatura `.thumb` (45-70 kB) z lancuchem awaryjnym miniatura -> oryginal, bo zdjecia
// wgrane przed wprowadzeniem miniatur swojej moga nie miec.
//
// `size` = szerokosc ramki w px CSS. Powyzej ~400 px lancuch sam oddaje oryginal
// (miniatura bylaby rozmyta) - patrz [imageUrl.ts](../lib/imageUrl.ts).
// Podglad pelnoekranowy NIE uzywa tego komponentu - tam chcemy pelna rozdzielczosc.
export default function StoredImage({ url, size, className, alt = "", onClick, role, title }: {
  url: string | null | undefined;
  size: number;
  className?: string;
  alt?: string;
  onClick?: () => void;
  role?: string;
  title?: string;
}) {
  const { src, failed, onError } = useImageWithFallback(resolveStored(url), size);
  if (!src || failed) return null;
  return (
    <img src={src} alt={alt} title={title} role={role} loading="lazy" onClick={onClick} onError={onError} className={className} />
  );
}
