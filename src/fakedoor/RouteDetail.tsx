import { useState } from "react";
import { ArrowLeft, Clock, MapPin, User } from "lucide-react";
import { nbsp } from "./text";
import { routeCover, placeThumb, type MockRoute } from "./mockRoutes";

function PlaceRow({ route, index, name, category, note }: { route: string; index: number; name: string; category: string; note: string }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="flex gap-3 py-4">
      <div className="relative shrink-0">
        <div className="h-16 w-16 overflow-hidden rounded-2xl" style={{ background: "#fcede3" }}>
          {imgOk && (
            <img
              src={placeThumb(route, index)}
              alt={name}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <span
          className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow"
          style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }}
        >
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-[#0E0E0E] truncate">{name}</h4>
        </div>
        <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-[#F9662B]" style={{ background: "#fcede3" }}>
          {category}
        </span>
        <p className="mt-1.5 text-sm leading-relaxed text-[#6b6b6b]">{nbsp(note)}</p>
      </div>
    </div>
  );
}

export default function RouteDetail({
  route,
  onBack,
  onUse,
}: {
  route: MockRoute;
  onBack: () => void;
  onUse: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="pb-28">
      {/* Hero */}
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:rounded-b-3xl" style={{ background: "#fcede3" }}>
        {imgOk && (
          <img
            src={routeCover(route.id)}
            alt={route.title}
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0) 55%)" }} />
        <button
          onClick={onBack}
          aria-label="Wróć"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur text-[#0E0E0E] shadow active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#0E0E0E]">{route.city}</span>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-white drop-shadow">{nbsp(route.title)}</h1>
        </div>
      </div>

      {/* Meta */}
      <div className="mx-auto max-w-lg px-4">
        <div className="mt-4 flex items-center gap-4 text-sm text-[#979797]">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} /> {route.duration}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} /> {route.places.length} miejsc
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User size={15} /> {route.author}
          </span>
        </div>

        {/* Notka autora */}
        <div className="mt-4 rounded-2xl p-4" style={{ background: "#fcede3" }}>
          <p className="text-[15px] leading-relaxed text-[#5a3d2b]">{nbsp(route.intro)}</p>
        </div>

        {/* Tagi */}
        <div className="mt-3 flex flex-wrap gap-2">
          {route.tags.map((t) => (
            <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              #{t}
            </span>
          ))}
        </div>

        {/* Miejsca */}
        <h2 className="mt-6 mb-1 text-lg font-extrabold text-[#0E0E0E]">Plan trasy</h2>
        <div className="divide-y divide-black/[0.06]">
          {route.places.map((p, i) => (
            <PlaceRow key={i} route={route.id} index={i} name={p.name} category={p.category} note={p.note} />
          ))}
        </div>
      </div>

      {/* Sticky CTA - GLOWNE drzwi */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/95 backdrop-blur px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto max-w-lg">
          <button
            onClick={onUse}
            className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg active:scale-[0.99] transition"
            style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}
          >
            Użyj tej trasy
          </button>
        </div>
      </div>
    </div>
  );
}
