import { useState } from "react";
import { ArrowLeft, Bookmark, Building2, Calendar, Footprints, LayoutList, LayoutGrid } from "lucide-react";
import { nbsp } from "./text";
import { fdTrack } from "./analytics";
import { AuthorAvatar } from "./avatars";
import { placeIconSrc } from "./placeIcon";
import PlaceSheet from "./PlaceSheet";
import MiniMap from "./MiniMap";
import { BRAND } from "./theme";
import { routeCover, type MockRoute, type MockPlace } from "./mockRoutes";

const countLabel = (n: number) => `${n} ${n === 1 ? "miejsce" : n < 5 ? "miejsca" : "miejsc"}`;

type Tab = "miejsca" | "galeria" | "mapa";
type ViewMode = "list" | "card";

function GoogleButton({ query }: { query: string }) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label="Zobacz w Google Maps"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[15px] font-bold shadow-sm active:scale-90"
      style={{ color: "#4285F4" }}
    >
      G
    </a>
  );
}

function PlaceThumb({ routeId, index, category, big }: { routeId: string; index: number; category: string; big?: boolean }) {
  const s = big ? "h-full w-full" : "h-16 w-16";
  return (
    <div className={`relative ${s} shrink-0 overflow-hidden rounded-2xl`} style={{ background: "#fcede3" }}>
      <div className="flex h-full w-full items-center justify-center">
        <img src={placeIconSrc(category)} alt="" className={big ? "h-14 w-14" : "h-8 w-8"} />
      </div>
      <span
        className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow"
        style={{ background: BRAND }}
      >
        {index + 1}
      </span>
    </div>
  );
}

function PlaceCard({
  route,
  place,
  index,
  onOpen,
}: {
  route: MockRoute;
  place: MockPlace;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen} className="w-full rounded-2xl bg-[#f4f4f5] p-3 text-left transition active:scale-[0.99]">
      <div className="flex items-center gap-3">
        <PlaceThumb routeId={route.id} index={index} category={place.category} />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold leading-snug text-[#0E0E0E]">{nbsp(place.name)}</h4>
          <span className="mt-1 inline-block rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#0E0E0E]">
            {place.category}
          </span>
        </div>
        <GoogleButton query={`${place.name} ${route.city}`} />
      </div>
      <div className="mt-3 border-t border-black/[0.06] pt-2.5">
        <p className="text-xs font-semibold text-[#0E0E0E]">Notka autora</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[#8a8a8a]">{nbsp(place.note)}</p>
      </div>
    </button>
  );
}

export default function RouteDetail({
  route,
  onBack,
  onUse,
  onPlan,
}: {
  route: MockRoute;
  onBack: () => void;
  onUse: () => void;
  onPlan: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [tab, setTab] = useState<Tab>("miejsca");
  const [view, setView] = useState<ViewMode>("list");
  const [openPlace, setOpenPlace] = useState<{ place: MockPlace; index: number } | null>(null);

  const selectPlace = (place: MockPlace, index: number) => {
    fdTrack("fd_open_place", { route: route.id, place: place.name, city: route.city });
    setOpenPlace({ place, index });
  };

  return (
    <div className="pb-32">
      {/* Hero */}
      <div className="relative aspect-[16/12] w-full overflow-hidden" style={{ background: "#fcede3" }}>
        {imgOk && (
          <img
            src={routeCover(route.id)}
            alt={route.title}
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0) 35%)" }} />
        <button
          onClick={onBack}
          aria-label="Wróć"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="px-5">
        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[#0E0E0E]">
          <span className="flex items-center gap-1.5 font-semibold">
            <AuthorAvatar seed={route.author} name={route.author} size={22} /> {route.author}
          </span>
          <span className="flex items-center gap-1 text-[#979797]">
            <Building2 size={15} /> {route.city}
          </span>
          <span className="flex items-center gap-1 text-[#979797]">
            <Footprints size={15} /> {countLabel(route.places.length)}
          </span>
        </div>

        {/* Title */}
        <h1 className="mt-3 text-3xl font-black leading-tight text-[#0E0E0E]">{nbsp(route.title)}</h1>

        {/* Duration */}
        <p className="mt-2 flex items-center gap-2 text-[15px] text-[#0E0E0E]">
          <Calendar size={16} className="text-[#979797]" /> Plan na {route.duration}
        </p>

        {/* Intro */}
        <p className="mt-3 leading-relaxed text-[#6b6b6b]">{nbsp(route.intro)}</p>

        {/* Tabs */}
        <div className="mt-5 flex rounded-full bg-[#f0f0f1] p-1">
          {(["miejsca", "galeria", "mapa"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full py-2 text-sm font-bold capitalize transition ${
                tab === t ? "bg-white text-[#0E0E0E] shadow-sm" : "text-[#979797]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab: Miejsca */}
        {tab === "miejsca" && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#0E0E0E]">Miejsca</h2>
              <div className="flex rounded-full bg-[#f0f0f1] p-0.5">
                <button
                  onClick={() => setView("list")}
                  aria-label="Lista"
                  className={`flex h-8 w-9 items-center justify-center rounded-full transition ${view === "list" ? "bg-white shadow-sm text-[#0E0E0E]" : "text-[#979797]"}`}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setView("card")}
                  aria-label="Karty"
                  className={`flex h-8 w-9 items-center justify-center rounded-full transition ${view === "card" ? "bg-white shadow-sm text-[#0E0E0E]" : "text-[#979797]"}`}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>

            {view === "list" ? (
              <div className="space-y-3">
                {route.places.map((p, i) => (
                  <PlaceCard key={i} route={route} place={p} index={i} onOpen={() => selectPlace(p, i)} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {route.places.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => selectPlace(p, i)}
                    className="rounded-2xl bg-[#f4f4f5] p-3 text-left transition active:scale-[0.99]"
                  >
                    <div className="aspect-square w-full">
                      <PlaceThumb routeId={route.id} index={i} category={p.category} big />
                    </div>
                    <h4 className="mt-2 line-clamp-1 font-bold text-[#0E0E0E]">{p.name}</h4>
                    <span className="mt-1 inline-block rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0E0E0E]">
                      {p.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Galeria */}
        {tab === "galeria" && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {route.places.map((p, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden rounded-2xl" style={{ background: "#fcede3" }}>
                <div className="flex h-full w-full items-center justify-center">
                  <img src={placeIconSrc(p.category)} alt="" className="h-12 w-12 opacity-90" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Mapa */}
        {tab === "mapa" && (
          <div className="mt-5">
            <div className="aspect-[16/11] w-full overflow-hidden rounded-2xl ring-1 ring-black/[0.06]">
              <MiniMap seed={route.id} className="h-full w-full" />
            </div>
            <p className="mt-2 text-center text-xs text-[#979797]">{nbsp("Podgląd trasy - kolejność miejsc na mapie")}</p>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-black/[0.06] bg-white/95 px-5 pt-3 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          onClick={onUse}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.99]"
          style={{ background: BRAND }}
        >
          Zapisz tą trasę <Bookmark size={18} className="fill-white" />
        </button>
        <button onClick={onPlan} className="mt-2 w-full py-1.5 text-center text-sm font-semibold text-[#0E0E0E]">
          {nbsp(`Zaplanuj własną trasę w ${route.city}`)}
        </button>
      </div>

      {openPlace && (
        <PlaceSheet
          place={openPlace.place}
          routeId={route.id}
          index={openPlace.index}
          city={route.city}
          tags={route.tags}
          onClose={() => setOpenPlace(null)}
        />
      )}
    </div>
  );
}
