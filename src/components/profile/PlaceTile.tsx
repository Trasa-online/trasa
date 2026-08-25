import { resolveStored } from "@/components/PlacePhoto";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Kafelek miejsca w karcie feedu profilu / widoku "Twoje listy" (redesign 07/08).
// Zdjecie usera (jesli jest) w object-cover; inaczej ikona kategorii na peachy #fcede3
// (spojne z PlacePhoto, ZERO emoji). Nazwa miejsca w dole - biala na zdjeciu, ciemna na peachy.
const firstOf = (v: any): string | null =>
  Array.isArray(v) ? (v.find((x) => typeof x === "string" && x) ?? null) : null;

// aspect: klasa proporcji kafelka. Domyslnie PIONOWY prostokat 2:3 (redesign 2026-08-25). Kontekst,
// ktory chce inny ksztalt (np. Eksploruj - gesta siatka), moze nadpisac (aspect="aspect-square").
export function PlaceTile({ tile, showCity, aspect = "aspect-[2/3]" }: { tile: any; showCity?: boolean; aspect?: string }) {
  // Zdjecie usera: wlasne z pinu/elementu (image_url/images/user_photo_urls/photo_url), a gdy
  // brak - okladka ze zdjec userow dodanych do MIEJSCA w wizytowce (place_photos, tile._cover).
  const stored = tile.image_url || firstOf(tile.images) || firstOf(tile.user_photo_urls) || tile.photo_url;
  const url = resolveStored(stored) ?? resolveStored(tile._cover);
  const name = tile.place_name || "";
  const city = showCity ? (tile.city || "") : "";
  return (
    <div className={`relative ${aspect} rounded-2xl overflow-hidden bg-[#fcede3]`}>
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
      {(name || city) && (
        <div className="absolute bottom-1.5 left-2 right-2">
          {name && (
            <span className={`block text-xs font-semibold leading-tight line-clamp-1 ${url ? "text-white drop-shadow-sm" : "text-foreground/80"}`}>
              {name}
            </span>
          )}
          {city && (
            <span className={`block text-[10px] leading-tight line-clamp-1 ${url ? "text-white/85 drop-shadow-sm" : "text-foreground/50"}`}>
              {city}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
