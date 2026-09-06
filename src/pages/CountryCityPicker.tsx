import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateHeader from "@/components/create/CreateHeader";
import { TRIP_COUNTRIES, TRIP_REGIONS, citiesForCountry, countryForCity } from "@/lib/tripCountries";

// Wybor kraju + miasta - PIERWSZY krok tworzenia (po "+"). Kraj = SELEKTOR (dropdown),
// miasto = DRUM-SCROLL. Zastapil selecty na formie. Po "Dalej" ląduje na formie (/wyjazd/nowy)
// z wybranym miastem; toggle Trasa|Lista przenosi je dalej. WSZYSTKIE miasta odblokowane
// (tworzysz content w kazdym miescie - miejsca dociagane z Google przez proxy).

const IH = 54;            // wysokosc pozycji
const VIS = 5;            // widoczne pozycje (srodek + 2 gora/dol)
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
                d === 0 ? "text-2xl font-black text-foreground" : d === 1 ? "text-lg font-semibold text-foreground/45" : "text-base text-foreground/20")}
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
  const { t } = useTranslation("create-route");
  const navigate = useNavigate();
  const location = useLocation();
  const initCity = (location.state as any)?.city as string | undefined;
  const [country, setCountry] = useState<string>(() => countryForCity(initCity));
  const cities = citiesForCountry(country);
  // Domyslne miasto na srodku drumu: wybrane (initCity) -> "Gdańsk" (aktualny focus contentu) ->   // i18n-ignore: nazwa wlasna miasta
  // pierwsze. Dla innych krajow "Gdańsk" nie istnieje -> pierwsze miasto.   // i18n-ignore: nazwa wlasna miasta
  const defaultCityIndex = (cs: string[]) => {
    const g = cs.indexOf("Gdańsk");   // i18n-ignore: nazwa wlasna miasta
    return g >= 0 ? g : 0;
  };
  const [cyi, setCyi] = useState(() => (initCity ? Math.max(0, cities.indexOf(initCity)) : defaultCityIndex(cities)));
  // Zmiana kraju resetuje miasto na domyslne dla tego kraju - SYNCHRONICZNIE (w onChange),
  // zeby drum (key={country}) zamountowal sie z poprawna pozycja.
  const onCountry = (c: string) => { setCountry(c); setCyi(defaultCityIndex(citiesForCountry(c))); };
  const city = cities[cyi] ?? cities[0];

  const back = () => goBackOr(navigate, "/eksploruj");
  // Tryb docelowy: domyslnie trasa (toggle Trasy|Listy na formie). Gdy wejscie z guzika
  // "Nowa lista" (profil) -> state.mode="listy" -> picker prowadzi wprost na forme listy.
  const mode = (location.state as any)?.mode === "listy" ? "listy" : "trasy";
  const next = () => navigate(mode === "listy" ? "/zestawienie/nowe" : "/wyjazd/nowy", { state: { city }, replace: true });

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      <CreateHeader active="tworz" onBack={back} showMode={false} />

      {/* Kraj - SELEKTOR (dropdown), grupowany po regionie */}
      <div className="px-4 pt-4 shrink-0">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{t("picker.country")}</p>
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

      {/* Miasto - DRUM-SCROLL, wypelnia reszte, wysrodkowany */}
      <div className="flex-1 min-h-0 flex flex-col justify-center px-0">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 text-center">{t("picker.city")}</p>
        <Drum key={country} items={cities} index={cyi} setIndex={setCyi} />
      </div>

      <div className="px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shrink-0">
        <button onClick={next} className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">{t("common:buttons.next")}</button>
      </div>
    </div>
  );
}
