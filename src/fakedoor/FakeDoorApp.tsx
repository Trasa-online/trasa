import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { TrasaLogo } from "@/components/TrasaLogo";
import { nbsp } from "./text";
import { fdTrack } from "./analytics";
import { MOCK_ROUTES, CITIES, routeById, type MockRoute } from "./mockRoutes";
import TrasaCard from "./TrasaCard";
import RouteDetail from "./RouteDetail";
import EmailModal, { type DoorSource } from "./EmailModal";

type View = { name: "list" } | { name: "detail"; id: string };
type Modal = { source: DoorSource; route: MockRoute | null } | null;

export default function FakeDoorApp() {
  const [view, setView] = useState<View>({ name: "list" });
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [city, setCity] = useState<string>("Wszystkie");
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
    setModal({ source: "use_route", route });
  };

  const openCreateDoor = () => {
    fdTrack("fd_click_create");
    setModal({ source: "create_route", route: null });
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
          <RouteDetail route={active} onBack={() => setView({ name: "list" })} onUse={() => openUseDoor(active, "detail")} />
        </div>
        {modal && <EmailModal source={modal.source} route={modal.route} onClose={() => setModal(null)} />}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#FEFEFE]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col">
        {/* Header */}
        <header className="z-30 shrink-0 px-4 pt-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <TrasaLogo size={32} />
              <span className="text-lg font-extrabold tracking-tight text-[#0E0E0E]">trasa</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Szukaj"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[#0E0E0E] transition active:scale-95"
              >
                {searchOpen ? <X size={19} /> : <Search size={19} />}
              </button>
              <button
                onClick={openCreateDoor}
                aria-label="Stwórz własną trasę"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition active:scale-95"
                style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }}
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>
            </div>
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

          {/* City chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["Wszystkie", ...CITIES].map((c) => {
              const on = city === c;
              return (
                <button
                  key={c}
                  onClick={() => setCity(c)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    on ? "text-white" : "bg-secondary text-secondary-foreground"
                  }`}
                  style={on ? { background: "linear-gradient(90deg,#F4A259,#F9662B)" } : undefined}
                >
                  {c}
                </button>
              );
            })}
          </div>
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

      {modal && <EmailModal source={modal.source} route={modal.route} onClose={() => setModal(null)} />}
    </div>
  );
}
