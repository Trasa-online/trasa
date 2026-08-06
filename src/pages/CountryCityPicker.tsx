import { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTabs from "@/components/create/CreateTabs";
import { TRIP_COUNTRIES, citiesForCountry, countryForCity } from "@/lib/tripCountries";

// Wybor kraju + miasta drum-scrollem - PIERWSZY krok tworzenia (po "+"). Zastapil selecty
// kraj/miasto na widoku formy. Po "Dalej" ląduje na formie (/wyjazd/nowy) z wybranym miastem;
// toggle Trasa|Lista na formie przenosi je dalej. WSZYSTKIE miasta odblokowane (tworzysz
// content w kazdym miescie - miejsca dociagane z Google przez proxy).

const IH = 54;            // wysokosc pozycji
const VIS = 3;            // widoczne pozycje (srodek + 1 gora/dol)
const CH = IH * VIS;      // wysokosc drumu
const PAD = (CH - IH) / 2;

function Drum({ items, index, setIndex }: { items: string[]; index: number; setIndex: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const snap = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = index * IH; }, []); // init pozycja
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const cl = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / IH)));
    if (cl !== index) setIndex(cl);
    if (snap.current) clearTimeout(snap.current);
    snap.current = setTimeout(() => el.scrollTo({ top: cl * IH, behavior: "smooth" }), 90);
  };
  return (
    <div className="relative w-full" style={{ height: CH }}>
      {/* Podswietlony srodek */}
      <div className="absolute left-4 right-4 rounded-2xl bg-secondary pointer-events-none" style={{ top: PAD, height: IH }} />
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      <div ref={ref} onScroll={onScroll} className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: PAD }} />
        {items.map((it, i) => {
          const d = Math.abs(i - index);
          return (
            <div key={it} onClick={() => { setIndex(i); ref.current?.scrollTo({ top: i * IH, behavior: "smooth" }); }}
              className={cn("flex items-center justify-center select-none cursor-pointer transition-all duration-150 px-6",
                d === 0 ? "text-xl font-black text-foreground" : d === 1 ? "text-base font-semibold text-foreground/45" : "text-sm text-foreground/20")}
              style={{ height: IH, scrollSnapAlign: "center" }}>
              <span className="truncate">{it}</span>
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}

export default function CountryCityPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const initCity = (location.state as any)?.city as string | undefined;
  const countryNames = TRIP_COUNTRIES.map((c) => c.name);
  const [ci, setCi] = useState(() => Math.max(0, countryNames.indexOf(countryForCity(initCity))));
  const cities = citiesForCountry(countryNames[ci]);
  const [cyi, setCyi] = useState(() => (initCity ? Math.max(0, cities.indexOf(initCity)) : 0));
  // Zmiana kraju: reset miasta na 1. (city drum remountuje sie przez key={country}).
  useEffect(() => { setCyi(0); }, [ci]);
  const city = cities[cyi] ?? cities[0];

  const back = () => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); };
  const next = () => navigate("/wyjazd/nowy", { state: { city }, replace: true });

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={back} aria-label="Wróć" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1"><CreateTabs active="tworz" /></div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center gap-8 px-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 text-center">Kraj</p>
          <Drum items={countryNames} index={ci} setIndex={setCi} />
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 text-center">Miasto</p>
          <Drum key={countryNames[ci]} items={cities} index={cyi} setIndex={setCyi} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shrink-0">
        <button onClick={next} className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">
          Dalej
        </button>
      </div>
    </div>
  );
}
