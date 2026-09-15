import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Search, X } from "lucide-react";
import { haptics } from "@/hooks/useHaptics";
import { TRIP_COUNTRIES, TRIP_REGIONS } from "@/lib/tripCountries";

// Wybor KRAJOW wyjazdu/listy (2026-09-10). Zastapil drum-scroll z miastem.
//
// Wielokrotny wybor jest tu istotny, a nie ozdobny: wyjazdy przekraczaja granice
// (Praga + Drezno, objazdowka po Balkanach), a zasieg wyszukiwarki miejsc idzie
// wprost z tej listy. Wybrane kraje siedza w chipach nad lista, zeby przy przewijaniu
// 100 pozycji nadal bylo widac, co juz jest zaznaczone.

// Nazwy regionow zyja w danych po polsku (TRIP_COUNTRIES) - na ekranie musza byc dwujezyczne,
// wiec sluza tylko jako klucz do tlumaczenia.
const REGION_KEY: Record<string, string> = {
  "Polska": "poland",                        // i18n-ignore: klucz slownika, nie tekst UI
  "Europa": "europe",                        // i18n-ignore: klucz slownika, nie tekst UI
  "Azja": "asia",                            // i18n-ignore: klucz slownika, nie tekst UI
  "Ameryka Północna": "north_america",       // i18n-ignore: klucz slownika, nie tekst UI
  "Ameryka Południowa": "south_america",     // i18n-ignore: klucz slownika, nie tekst UI
  "Afryka": "africa",                        // i18n-ignore: klucz slownika, nie tekst UI
  "Oceania": "oceania",                      // i18n-ignore: klucz slownika, nie tekst UI
};

// Normalizacja do wyszukiwania: bez diakrytyk, lower. "wegry" znajduje "Węgry".
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

export default function CountryPicker({ selected, onChange }: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation("create-route");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (name: string) => {
    haptics.light();
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name]);
  };

  // Wyniki wyszukiwania sa PLASKIE (bez naglowkow regionow) - przy zapytaniu region nie
  // pomaga, a puste sekcje tylko rozbijaja liste.
  const q = norm(query.trim());
  const matches = useMemo(
    () => (q ? TRIP_COUNTRIES.filter((c) => norm(c.name).includes(q)) : []),
    [q],
  );

  const row = (name: string) => {
    const on = selected.includes(name);
    return (
      <button
        key={name}
        type="button"
        onClick={() => toggle(name)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-2xl active:bg-secondary/60 transition-colors"
      >
        <span className="flex-1 min-w-0 text-[15px] font-medium text-foreground truncate">{name}</span>
        <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${on ? "bg-primary text-white" : "border-2 border-border"}`}>
          {on && <Check className="h-3.5 w-3.5 stroke-[3]" />}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-5 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("country.search")}
            className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-10 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label={t("common:buttons.close")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Chipy wybranych krajow - tap zdejmuje. Zostaja na wierzchu przy przewijaniu listy. */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selected.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white pl-3 pr-2 py-1.5 text-[13px] font-semibold active:scale-95 transition-transform"
              >
                {c}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-[max(16px,env(safe-area-inset-bottom))]">
        {q ? (
          matches.length === 0
            ? <p className="py-8 text-center text-sm text-muted-foreground">{t("country.no_results")}</p>
            : matches.map((c) => row(c.name))
        ) : (
          TRIP_REGIONS.map((region) => {
            const inRegion = TRIP_COUNTRIES.filter((c) => c.region === region);
            if (!inRegion.length) return null;
            return (
              <div key={region}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t(`country.region.${REGION_KEY[region] ?? "europe"}`)}</p>
                {inRegion.map((c) => row(c.name))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
