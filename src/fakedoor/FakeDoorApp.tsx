import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus } from "lucide-react";
import { TrasaLogo } from "@/components/TrasaLogo";
import { nbsp } from "./text";
import { fdTrack } from "./analytics";
import { MOCK_ROUTES, CITIES, routeById, type MockRoute } from "./mockRoutes";
import RouteCard from "./RouteCard";
import RouteDetail from "./RouteDetail";
import EmailModal, { type DoorSource } from "./EmailModal";

type View = { name: "list" } | { name: "detail"; id: string };
type Modal = { source: DoorSource; route: MockRoute | null } | null;

export default function FakeDoorApp() {
  const [view, setView] = useState<View>({ name: "list" });
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("Wszystkie");
  const searchedOnce = useRef(false);

  // Wejscie na landing = gora lejka.
  useEffect(() => {
    fdTrack("fd_view_list");
  }, []);

  // Scroll na gore przy zmianie widoku.
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

  const openUseDoor = (route: MockRoute) => {
    fdTrack("fd_click_use", { route: route.id, city: route.city });
    setModal({ source: "use_route", route });
  };

  const openCreateDoor = () => {
    fdTrack("fd_click_create");
    setModal({ source: "create_route", route: null });
  };

  const active = view.name === "detail" ? routeById(view.id) : null;

  return (
    <div className="min-h-[100dvh] bg-[#FEFEFE]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-black/[0.05] bg-[#FEFEFE]/90 px-4 py-3 backdrop-blur">
        <button onClick={() => setView({ name: "list" })} className="flex items-center gap-2">
          <TrasaLogo size={32} />
          <span className="text-lg font-extrabold tracking-tight text-[#0E0E0E]">trasa</span>
        </button>
      </header>

      {active ? (
        <RouteDetail route={active} onBack={() => setView({ name: "list" })} onUse={() => openUseDoor(active)} />
      ) : (
        <main className="mx-auto max-w-2xl px-4 pb-16">
          {/* Hero */}
          <section className="pt-6 pb-4">
            <p className="text-sm font-semibold text-[#F9662B]">{nbsp("speed dating z miastem")}</p>
            <h1 className="mt-1.5 text-3xl font-extrabold leading-tight tracking-tight text-[#0E0E0E] sm:text-4xl">
              {nbsp("Gotowe trasy po mieście, od ludzi którzy je znają")}
            </h1>
            <p className="mt-2 text-[#979797] leading-relaxed">
              {nbsp("Wybierz trasę, ruszaj w drogę. Sprawdzone miejsca, bez godzin szukania.")}
            </p>
          </section>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#CFCFCF]" />
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Szukaj trasy, miasta, miejsca..."
              className="w-full rounded-2xl border border-black/[0.08] bg-white py-3 pl-11 pr-4 text-base text-[#0E0E0E] outline-none transition placeholder:text-[#CFCFCF] focus:border-[#F9662B]"
            />
          </div>

          {/* City chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          {/* Create-route door */}
          <button
            onClick={openCreateDoor}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#F9662B]/40 bg-[#fcede3]/60 px-4 py-3 text-left transition hover:bg-[#fcede3]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }}>
              <Plus size={18} />
            </span>
            <span>
              <span className="block font-bold text-[#0E0E0E]">Stwórz własną trasę</span>
              <span className="block text-xs text-[#979797]">{nbsp("Ułóż swoją i podziel się nią z innymi")}</span>
            </span>
          </button>

          {/* Routes grid */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((r) => (
              <RouteCard key={r.id} route={r} onClick={() => openRoute(r.id)} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="mt-10 text-center text-[#979797]">{nbsp("Brak tras dla tego wyszukiwania. Spróbuj innego miasta.")}</p>
          )}

          <footer className="mt-14 border-t border-black/[0.05] pt-6 text-center">
            <p className="text-xs text-[#CFCFCF]">web · fake-door v1</p>
          </footer>
        </main>
      )}

      {modal && <EmailModal source={modal.source} route={modal.route} onClose={() => setModal(null)} />}
    </div>
  );
}
