import { getPhotoUrl } from "@/lib/placePhotos";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";

// Pelny URL (cache/storage/http) uzywamy bezposrednio; surowy photo_reference
// przepuszczamy przez proxy getPhotoUrl.
export const resolveStored = (img: string | null | undefined): string | null => {
  if (!img) return null;
  return /^(https?:|\/api\/|\/storage\/|blob:|data:)/.test(img) ? img : getPhotoUrl(img);
};

// Zdjecie miejsca: stored (image_url/images/photo_url usera). Gdy brak - placeholder:
// ikona kategorii na peachy tle #fcede3 (spojne z reszta aplikacji). ZERO emoji, ZERO
// Google (zdjecia miejsc pochodza ze zdjec userow z tras). Prop `emojiClass` zostaje w
// sygnaturze dla kompatybilnosci call-site'ow, ale nie jest juz uzywany.
export function PlacePhoto({ pin, className, width }: { pin: any; className?: string; emojiClass?: string;
  /** Docelowa szerokosc w px - zdjecie leci wtedy przez transformacje Storage zamiast oryginalu.
      Bez tego (np. podglad pelnoekranowy) pobieramy plik w pelnej rozdzielczosci. */
  width?: number }) {
  // Zdjecia usera z miejsca (obojetnie ktorym kanalem dodane): pins.images (edytor trasy)
  // + pins.user_photo_urls (aktywny wyjazd). Zdjecie usera ZAWSZE przed placeholderem;
  // ikona+peachy tlo dopiero gdy BRAK jakiegokolwiek zdjecia.
  const firstOf = (v: any): string | null => (Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null);
  const stored = pin.image_url || firstOf(pin.images) || firstOf(pin.user_photo_urls) || pin.photo_url;
  const full = resolveStored(stored);
  // width podane = kafelek/lista, wiec najpierw miniatura. Bez width (podglad pelnoekranowy)
  // od razu oryginal.
  const { src, failed, onError } = useImageWithFallback(full, width ?? Number.MAX_SAFE_INTEGER);

  if (src && !failed) {
    return <img src={src} alt="" className={className} onError={onError} />;
  }
  return (
    <div className={`${className ?? ""} flex items-center justify-center bg-[#fcede3]`}>
      <img src={categoryIconSrc(pin.category)} alt="" className="w-2/5 max-w-[56px] opacity-90" draggable={false} />
    </div>
  );
}
