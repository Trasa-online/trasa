import { useState } from "react";
import { getPhotoUrl } from "@/lib/placePhotos";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

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
export function PlacePhoto({ pin, className }: { pin: any; className?: string; emojiClass?: string }) {
  const stored = pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null) || pin.photo_url;
  const url = resolveStored(stored);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return <img src={url} alt="" className={className} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${className ?? ""} flex items-center justify-center bg-[#fcede3]`}>
      <img src={categoryIconSrc(pin.category)} alt="" className="w-2/5 max-w-[56px] opacity-90" draggable={false} />
    </div>
  );
}
