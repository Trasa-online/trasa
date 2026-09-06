import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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

// Domyslne miasto na srodku drumu: "Gdańsk" (aktualny focus contentu) -> pierwsze miasto.   // i18n-ignore: nazwa wlasna miasta
export function defaultCityIndex(cities: string[]): number {
  const g = cities.indexOf("Gdańsk");   // i18n-ignore: nazwa wlasna miasta
  return g >= 0 ? g : 0;
}

interface Props {
  city: string;                        // sterowana wartosc (wybrane miasto)
  onCityChange: (city: string) => void;
  compact?: boolean;
}

const NBSP = " ";
// Miasto jest "z listy" gdy wystepuje w ktoryms TRIP_COUNTRIES.cities. Inaczej = wpisane recznie
// (Google) - wtedy domyslnie tryb "Inne miasto".
const isKnownCity = (city: string) => TRIP_COUNTRIES.some((c) => c.cities.includes(city));

// Sterowany komponent: kraj wyliczany z miasta; zmiana miasta/kraju idzie przez onCityChange.
// Dwa tryby: "Z listy" (kraj + drum) oraz "Inne miasto" (wyszukiwarka Google - dowolne miasto,
// zeby userzy z malych miejscowosci NIE odbijali sie od apki).
export default function CityCountryPicker({ city, onCityChange, compact = false }: Props) {
  const { t } = useTranslation("create-route");
  const country = countryForCity(city);
  const cities = citiesForCountry(country);
  const cyi = Math.max(0, cities.indexOf(city));
  const onCountry = (c: string) => {
    const cs = citiesForCountry(c);
    onCityChange(cs[defaultCityIndex(cs)] ?? cs[0]);
  };
  const setIndex = (i: number) => onCityChange(cities[i] ?? cities[0]);

  const [mode, setMode] = useState<"list" | "search">(() => (isKnownCity(city) ? "list" : "search"));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string; full_address: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Wyszukiwarka miast Google (autocomplete przez google-places-proxy, debounce). Bez płatnego
  // Text Search - action "citysearch" uzywa Places Autocomplete (tanie, cache 24h w proxy).
  useEffect(() => {
    if (mode !== "search") return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "citysearch", query: q } });
        if (alive) setResults((((data as any)?.results ?? []) as { name: string; full_address: string }[]).slice(0, 6));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, mode]);

  return (
    <div className="flex flex-col">
      {/* Przelacznik trybu: gotowa lista vs wyszukiwarka dowolnego miasta */}
      <div className="flex items-center rounded-full bg-[#ededed] p-0.5 self-start mb-3">
        {([{ k: "list", l: `Z${NBSP}listy` }, { k: "search", l: "Inne miasto" }] as const).map((o) => (
          <button key={o.k} type="button" onClick={() => setMode(o.k)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${mode === o.k ? "bg-white text-foreground shadow-sm" : "text-foreground/55"}`}>
            {o.l}
          </button>
        ))}
      </div>

      {mode === "list" ? (
        <>
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
        </>
      ) : (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Wpisz miasto</p>
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`np.${NBSP}Kuusamo`} autoFocus
              className="w-full h-12 rounded-2xl bg-secondary text-secondary-foreground border-0 pl-10 pr-4 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/60" />
          </div>
          {/* Aktualnie wybrane miasto (recznie wpisane) */}
          {!isKnownCity(city) && city && query.trim().length < 2 && (
            <p className="mt-2 px-1 text-sm text-muted-foreground">Wybrane: <span className="font-semibold text-foreground">{city}</span></p>
          )}
          <div className="mt-1.5 min-h-[2.5rem]">
            {searching && (
              <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Szukam...</p>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="px-1 py-2 text-sm text-muted-foreground">{t("drum.no_results")}</p>
            )}
            {results.map((r) => {
              const selected = r.name === city;
              return (
                <button key={r.full_address} type="button"
                  onClick={() => { onCityChange(r.name); setQuery(""); setResults([]); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:bg-muted/60", selected ? "bg-secondary" : "")}>
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.full_address}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
