import { useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRIP_COUNTRIES, TRIP_REGIONS, citiesForCountry, countryForCity } from "@/lib/tripCountries";

// Wspolny wybor kraju (dropdown) + miasta (drum-scroll). Wydzielony z CountryCityPicker,
// reuse w nowym CreateFlowSheet (arkusz "Nowy wyjazd") oraz na pelnoekranowym /utworz.
// `compact` = mniejszy drum do bottom-sheeta.

function drumMetrics(compact: boolean) {
  const IH = compact ? 44 : 54;        // wysokosc pozycji
  const VIS = 5;                       // widoczne pozycje (srodek + 2 gora/dol)
  const CH = IH * VIS;                 // wysokosc drumu
  const PAD = (CH - IH) / 2;
  return { IH, VIS, CH, PAD };
}

function Drum({ items, index, setIndex, compact = false }: { items: string[]; index: number; setIndex: (i: number) => void; compact?: boolean }) {
  const { IH, CH, PAD } = drumMetrics(compact);
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
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      <div ref={ref} onScroll={onScroll} className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: PAD }} />
        {items.map((it, i) => {
          const d = Math.abs(i - index);
          return (
            <div key={it} onClick={() => { setIndex(i); ref.current?.scrollTo({ top: i * IH, behavior: "smooth" }); }}
              className={cn("flex items-center justify-center select-none cursor-pointer transition-all duration-150 px-6",
                d === 0 ? (compact ? "text-xl font-black text-foreground" : "text-2xl font-black text-foreground") : d === 1 ? "text-lg font-semibold text-foreground/45" : "text-base text-foreground/20")}
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

// Domyslne miasto na srodku drumu: "Gdańsk" (aktualny focus contentu) -> pierwsze miasto.
export function defaultCityIndex(cities: string[]): number {
  const g = cities.indexOf("Gdańsk");
  return g >= 0 ? g : 0;
}

interface Props {
  city: string;                        // sterowana wartosc (wybrane miasto)
  onCityChange: (city: string) => void;
  compact?: boolean;
}

// Sterowany komponent: kraj wyliczany z miasta; zmiana miasta/kraju idzie przez onCityChange.
export default function CityCountryPicker({ city, onCityChange, compact = false }: Props) {
  const country = countryForCity(city);
  const cities = citiesForCountry(country);
  const cyi = Math.max(0, cities.indexOf(city));
  const onCountry = (c: string) => {
    const cs = citiesForCountry(c);
    onCityChange(cs[defaultCityIndex(cs)] ?? cs[0]);
  };
  const setIndex = (i: number) => onCityChange(cities[i] ?? cities[0]);

  return (
    <div className="flex flex-col">
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Kraj</p>
        <div className="relative">
          <select value={country} onChange={(e) => onCountry(e.target.value)}
            className="w-full appearance-none rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40">
            {TRIP_REGIONS.map((region) => (
              <optgroup key={region} label={region}>
                {TRIP_COUNTRIES.filter((c) => c.region === region).map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 text-center">Miasto</p>
        {/* key={country} remontuje drum z poprawna pozycja po zmianie kraju */}
        <Drum key={country} items={cities} index={cyi} setIndex={setIndex} compact={compact} />
      </div>
    </div>
  );
}
