import { useState } from "react";
import { X, MapPin, ExternalLink } from "lucide-react";
import { nbsp } from "./text";
import { placeIconSrc, categoryGroup } from "./placeIcon";
import MiniMap from "./MiniMap";
import { placeThumb, type MockPlace } from "./mockRoutes";

// Wizytowka miejsca - bottom sheet (odwzorowanie PlaceSwiperDetail z apki):
// hero 4:3, tytul, lokalizacja, kategoria, opis, tagi, "Na mapie" + Google Maps.

export default function PlaceSheet({
  place,
  routeId,
  index,
  city,
  tags,
  onClose,
}: {
  place: MockPlace;
  routeId: string;
  index: number;
  city: string;
  tags: string[];
  onClose: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${city}`)}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center" style={{ background: "rgba(14,14,14,0.45)" }} onClick={onClose}>
      <div
        className="flex h-[96dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-white"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Hero 4:3 */}
          <div className="relative aspect-[4/3] w-full" style={{ background: "#fcede3" }}>
            {imgOk ? (
              <img
                src={placeThumb(routeId, index * 10 + 3)}
                alt={place.name}
                onError={() => setImgOk(false)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <img src={placeIconSrc(place.category)} alt="" className="h-20 w-20 opacity-90" />
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {city}
            </span>
            <button
              onClick={onClose}
              aria-label="Zamknij"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0E0E0E] shadow backdrop-blur active:scale-95"
            >
              <X size={19} />
            </button>
          </div>

          <div className="px-5 pb-8 pt-5">
            <h1 className="text-2xl font-black leading-tight text-[#0E0E0E]">{nbsp(place.name)}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#979797]">
              <MapPin size={14} className="shrink-0" /> {city}
            </p>

            {/* Kategoria */}
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#fcede3" }}>
                <img src={placeIconSrc(place.category)} alt="" className="h-5 w-5" />
              </span>
              <span className="text-sm text-[#979797]">
                {categoryGroup(place.category)} <span className="font-bold text-[#0E0E0E]">{place.category}</span>
              </span>
            </div>

            {/* Opis */}
            <h2 className="mt-6 text-lg font-extrabold text-[#0E0E0E]">Opis miejsca</h2>
            <p className="mt-1.5 leading-relaxed text-[#5a5a5a]">{nbsp(place.note)}</p>

            {/* Tagi */}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.slice(0, 4).map((tg) => (
                  <span key={tg} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {tg}
                  </span>
                ))}
              </div>
            )}

            {/* Na mapie */}
            <div className="mt-7 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#0E0E0E]">Na mapie</h2>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-[#0E0E0E] active:scale-95"
              >
                <MapPin size={14} /> Zobacz w Google Maps <ExternalLink size={13} className="text-[#979797]" />
              </a>
            </div>
            <div className="mt-3 aspect-[16/10] w-full overflow-hidden rounded-2xl ring-1 ring-black/[0.06]">
              <MiniMap seed={`${routeId}-${place.name}`} className="h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
