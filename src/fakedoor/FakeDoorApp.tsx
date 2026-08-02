import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { TrasaLogo } from "@/components/TrasaLogo";
import { nbsp } from "./text";
import { fdTrack } from "./analytics";
import { MOCK_ROUTES, CITIES, routeById, type MockRoute } from "./mockRoutes";
import TrasaCard from "./TrasaCard";
import RouteDetail from "./RouteDetail";
import EmailModal, { type DoorVariant } from "./EmailModal";
import Selector, { type Option } from "./Selector";

const CITY_OPTIONS: Option[] = [
  { value: "Wszystkie", label: "Wszystkie miasta" },
  ...CITIES.map((c) => ({ value: c, label: c })),
];
const COUNTRY_OPTIONS: Option[] = [{ value: "Polska", label: "Polska" }];

type View = { name: "list" } | { name: "detail"; id: string };
type Modal = { variant: DoorVariant; route: MockRoute | null } | null;

export default function FakeDoorApp() {
  const [view, setView] = useState<View>({ name: "list" });
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [city, setCity] = useState<string>("Wszystkie");
  const [country, setCountry] = useState<string>("Polska");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const searchedOnce = useRef(false);

  useEffect(() => {
    fdTrack("fd_view_list");
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  const onSearch = (v: string) => {
    setQuery(v);
    if (v.trim().length >= 3 && !searchedOnce.current) {
      searchedOnce.current = true;
      fdTrack("fd_search");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_ROUTES.filter((r) => {
      if (city !== "Wszystkie" && r.city !== city) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.places.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [query, city]);

  const openRoute = (id: string) => {
    const r = routeById(id);
    fdTrack("fd_open_route", r ? { route: r.id, city: r.city } : {});
    setView({ name: "detail", id });
  };

  const openUseDoor = (route: MockRoute, via: "detail" | "save") => {
    fdTrack("fd_click_use", { route: route.id, city: route.city, via });
    setModal({ variant: via === "detail" ? "get_route" : "save_route", route });
  };

  const openCreateDoor = () => {
    fdTrack("fd_click_create");
    setModal({ variant: "create_route", route: null });
  };

  const onSave = (route: MockRoute) => {
    setSaved((prev) => new Set(prev).add(route.id));
    openUseDoor(route, "save");
  };

  const active = view.name === "detail" ? routeById(view.id) : null;

  if (active) {
    return (
      <div className="min-h-[100dvh] bg-[#FEFEFE]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="mx-auto w-full max-w-[480px]">
          <RouteDetail
            route={active}
            onBack={() => setView({ name: "list" })}
            onUse={() => openUseDoor(active, "detail")}
            onPlan={openCreateDoor}
          />
        </div>
        {modal && <EmailModal variant={modal.variant} route={modal.route} onClose={() => setModal(null)} />}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#FEFEFE]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col">
        {/* Belka z logo */}
        <header className="z-30 shrink-0 px-4 pt-3">
          <div className="flex items-center gap-2">
            <TrasaLogo size={30} />
            <span className="text-lg font-extrabold tracking-tight text-[#0E0E0E]">trasa</span>
            <button
              onClick={openCreateDoor}
              aria-label="Stwórz własną trasę"
              className="ml-auto shrink-0 transition active:scale-95"
            >
              <img src="/Ikona_Dodaj_orange.svg" alt="" className="h-10 w-10 drop-shadow-sm" />
            </button>
          </div>

          {/* Kraj + miasto + wyszukiwarka (bez filtrów) */}
          <div className="mt-3 flex items-center gap-2">
            <Selector options={COUNTRY_OPTIONS} value={country} onChange={setCountry} ariaLabel="Kraj" />
            <div className="min-w-0 flex-1">
              <Selector options={CITY_OPTIONS} value={city} onChange={setCity} ariaLabel="Miasto" />
            </div>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Szukaj"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[#0E0E0E] transition active:scale-95"
            >
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
          </div>

          {searchOpen && (
            <div className="relative mt-3">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#CFCFCF]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Szukaj trasy, miasta, miejsca..."
                className="w-full rounded-2xl border border-black/[0.08] bg-white py-3 pl-11 pr-4 text-base text-[#0E0E0E] outline-none transition placeholder:text-[#CFCFCF] focus:border-[#F9662B]"
              />
            </div>
          )}
          <div className="pb-2" />
        </header>

        {/* Immersyjny feed tras - snap scroll (jak apka natywna) */}
        <main className="min-h-0 flex-1 snap-y snap-mandatory space-y-4 overflow-y-auto px-4 pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.map((r) => (
            <TrasaCard
              key={r.id}
              route={r}
              saved={saved.has(r.id)}
              onOpen={() => openRoute(r.id)}
              onSave={() => onSave(r)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="pt-24 text-center text-[#979797]">
              {nbsp("Brak tras dla tego wyszukiwania. Spróbuj innego miasta.")}
            </div>
          )}

          <p className="pb-2 pt-4 text-center text-xs text-[#CFCFCF]">web · fake-door v1</p>
        </main>
      </div>

      {modal && <EmailModal variant={modal.variant} route={modal.route} onClose={() => setModal(null)} />}
    </div>
  );
}
