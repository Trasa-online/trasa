import { resolveStored } from "@/components/PlacePhoto";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Kafelek miejsca w karcie feedu profilu / widoku "Twoje listy" (redesign 07/08).
// Zdjecie usera (jesli jest) w object-cover; inaczej ikona kategorii na peachy #fcede3
// (spojne z PlacePhoto, ZERO emoji). Nazwa miejsca w dole - biala na zdjeciu, ciemna na peachy.
const firstOf = (v: any): string | null =>
  Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null;

export function PlaceTile({ tile }: { tile: any }) {
  const stored = tile.image_url || firstOf(tile.images) || firstOf(tile.user_photo_urls) || tile.photo_url;
  const url = resolveStored(stored);
  const name = tile.place_name || "";
  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#fcede3]">
      {url ? (
        <>
          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <img src={categoryIconSrc(tile.category)} alt="" className="w-2/5 max-w-[52px] opacity-90" draggable={false} />
        </div>
      )}
      {name && (
        <span
          className={`absolute bottom-1.5 left-2 right-2 text-xs font-semibold leading-tight line-clamp-1 ${
            url ? "text-white drop-shadow-sm" : "text-foreground/80"
          }`}
        >
          {name}
        </span>
      )}
    </div>
  );
}
