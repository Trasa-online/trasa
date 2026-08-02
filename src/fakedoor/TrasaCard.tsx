import { useState } from "react";
import { Bookmark, ChevronUp, MapPin, Building2 } from "lucide-react";
import { nbsp } from "./text";
import MiniMap from "./MiniMap";
import { AuthorAvatar } from "./avatars";
import { routeCover, type MockRoute } from "./mockRoutes";

// Immersyjna, pelnoekranowa karta trasy - odwzorowanie TrasaBigCard z apki
// natywnej (DiscoveryFeed): okladka na cale tlo, ciemny gradient, mini-mapka
// w prawym-gornym rogu, autor + miasto + liczba miejsc, mocny tytul, tagi,
// stack bialych okraglych guzikow (zapisz + rozwin) w prawym-dolnym rogu.

const countLabel = (n: number) => `${n} ${n === 1 ? "miejsce" : n < 5 ? "miejsca" : "miejsc"}`;

export default function TrasaCard({
  route,
  saved,
  onOpen,
  onSave,
}: {
  route: MockRoute;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div
      className="relative w-full shrink-0 snap-start snap-always overflow-hidden rounded-3xl bg-[#e8e2dc] shadow-sm"
      style={{ height: "calc(100dvh - 148px)", minHeight: 430, maxHeight: 720 }}
    >
      {imgOk ? (
        <img
          src={routeCover(route.id)}
          alt={route.title}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }} />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.28))" }} />

      {/* Tap na kafel = otworz trase */}
      <button onClick={onOpen} aria-label={route.title} className="absolute inset-0" />

      {/* Mini-mapka trasy - prawy gorny rog */}
      <div className="absolute right-3 top-3 z-20 h-24 w-24 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/85">
        <MiniMap seed={route.id} className="h-full w-full" />
      </div>

      {/* Prawy dolny stack: zapisz + rozwin */}
      <div className="absolute bottom-4 right-3 z-10 flex flex-col items-center gap-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          aria-label="Zapisz"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg transition-transform active:scale-90"
        >
          <Bookmark size={20} className={saved ? "fill-[#0E0E0E] text-[#0E0E0E]" : "text-[#0E0E0E]"} strokeWidth={2} />
        </button>
        <button
          onClick={onOpen}
          aria-label="Rozwiń"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg transition-transform active:scale-90"
        >
          <ChevronUp size={20} className="text-[#0E0E0E]" strokeWidth={2.5} />
        </button>
      </div>

      {/* Dolny-lewy opis */}
      <div className="pointer-events-none absolute bottom-6 left-0 right-[3.25rem] z-10 px-5">
        <div className="mb-1.5 flex items-center gap-3 text-[13px] font-semibold text-white [text-shadow:_0_1px_3px_rgb(0_0_0_/_40%)]">
          <span className="flex items-center gap-1.5">
            <AuthorAvatar seed={route.author} name={route.author} size={20} className="ring-1 ring-white/40" />
            {route.author}
          </span>
          <span className="flex items-center gap-1"><Building2 size={15} />{route.city}</span>
          <span className="flex items-center gap-1"><MapPin size={15} />{countLabel(route.places.length)}</span>
        </div>
        <p className="text-2xl font-black leading-tight text-white line-clamp-2 [text-shadow:_0_2px_6px_rgb(0_0_0_/_45%)]">
          {nbsp(route.title)}
        </p>
        <p className="mt-1.5 text-sm leading-snug text-white/85 line-clamp-2 [text-shadow:_0_1px_3px_rgb(0_0_0_/_45%)]">
          {nbsp(route.intro)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {route.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium capitalize text-white/85 backdrop-blur-sm">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
