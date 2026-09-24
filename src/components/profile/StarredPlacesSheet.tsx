import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandIcon, LIST_ICON, STAR_ICON } from "@/components/BrandIcon";
import { resolveStored } from "@/components/PlacePhoto";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";
import { haptics } from "@/hooks/useHaptics";
import { fetchStarredPlaces, starredPlacesKey, type StarredPlace } from "@/lib/starredPlaces";

// Filtry arkusza (prosba Nat 2026-09-15): kraj, miasto, typ miejsca. Grupa pojawia sie TYLKO
// wtedy, gdy realnie ma co filtrowac (dwie rozne wartosci) - przy jednym miescie rzad chipow
// "Wszystkie / Warszawa" jest samym halasem. Wartosci biora sie z tego, co user faktycznie
// wyroznil, wiec nigdy nie ma tu pustego wyniku po wyborze pojedynczego filtra.
function FilterRow({ value, onChange, options, allLabel }: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {[{ id: "", label: allLabel }, ...options].map((o) => {
        const active = (o.id || null) === value;
        return (
          <button
            key={o.id}
            onClick={() => { haptics.selection(); onChange(o.id || null); }}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold whitespace-nowrap active:scale-95 transition-all ${
              active ? "bg-[#FDF184] text-[#5B2C06]" : "bg-secondary text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Wyroznione miejsca (prosba Nat 2026-09-13): licznik gwiazdek na profilu otwiera arkusz ze
// wszystkimi miejscami, ktore user wyroznil w swoich wyjazdach i listach. Wiersz = zdjecie
// (albo ikona kategorii), nazwa, kategoria i skad pochodzi gwiazdka; tap otwiera ten
// wyjazd / te liste.
export function useStarredPlaces(userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: starredPlacesKey(userId),
    enabled: enabled && !!userId,
    queryFn: () => fetchStarredPlaces(userId!),
    staleTime: 60_000,
  });
}

function Thumb({ place }: { place: StarredPlace }) {
  const { src, failed, onError } = useImageWithFallback(resolveStored(place.photo), 120);
  return (
    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#fcede3]">
      {src && !failed
        ? <img src={src} alt="" onError={onError} className="h-full w-full object-cover" />
        : <img src={categoryIconSrc(place.category)} alt="" className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2" draggable={false} />}
      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-sm">
        <BrandIcon src={STAR_ICON} className="h-3.5 w-3.5 text-primary" />
      </span>
    </span>
  );
}

export default function StarredPlacesSheet({ open, onOpenChange, userId, own = true }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string;
  /** false = cudzy profil: opisy w trzeciej osobie, pusty stan bez instrukcji "jak dodac". */
  own?: boolean }) {
  const { t } = useTranslation("profiles");
  const navigate = useNavigate();
  const { data: places = [], isLoading } = useStarredPlaces(userId, open);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);

  // Listy wartosci liczymy z CALEGO zbioru (nie z przefiltrowanego), zeby chipy nie znikaly
  // po wybraniu pierwszego filtra i dalo sie zmienic zdanie bez czyszczenia wszystkiego.
  const countries = useMemo(
    () => Array.from(new Set(places.flatMap((p) => p.countries))).sort((a, b) => a.localeCompare(b, "pl")),
    [places]);
  const cities = useMemo(
    () => Array.from(new Set(places.map((p) => p.city).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b, "pl")),
    [places]);
  const cats = useMemo(
    () => Array.from(new Set(places.map((p) => p.category).filter((c): c is string => !!c)))
      .map((id) => ({ id, label: subcategoryLabelLocalized(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl")),
    [places]);

  const shown = useMemo(() => places.filter((p) =>
    (!country || p.countries.includes(country)) &&
    (!city || p.city === city) &&
    (!cat || p.category === cat)), [places, country, city, cat]);

  const hasFilters = countries.length > 1 || cities.length > 1 || cats.length > 1;
  const anyActive = !!(country || city || cat);
  const clear = () => { haptics.light(); setCountry(null); setCity(null); setCat(null); };

  const go = (p: StarredPlace) => {
    haptics.light();
    onOpenChange(false);
    navigate(p.source.kind === "trip" ? `/route/${p.source.id}` : `/lista/${p.source.id}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="flex items-center gap-2 text-lg font-black">
          <BrandIcon src={STAR_ICON} className="h-5 w-5 text-primary" />{t("starred.title")}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{own ? t("starred.desc") : t("starred.desc_theirs")}</p>
        {isLoading ? (
          <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : places.length === 0 ? (
          <div className="py-10 text-center">
            <BrandIcon src={STAR_ICON} className="mx-auto mb-3 h-12 w-12 text-[#ef9d78]" />
            <p className="text-base font-bold">{own ? t("starred.empty_title") : t("starred.empty_title_theirs")}</p>
            {own && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("starred.empty_desc")}</p>}
          </div>
        ) : (
          <>
          {hasFilters && (
            <div className="mt-4 space-y-2">
              {countries.length > 1 && (
                <FilterRow value={country} onChange={setCountry} allLabel={t("starred.filter_all_countries")}
                  options={countries.map((c) => ({ id: c, label: c }))} />
              )}
              {cities.length > 1 && (
                <FilterRow value={city} onChange={setCity} allLabel={t("starred.filter_all_cities")}
                  options={cities.map((c) => ({ id: c, label: c }))} />
              )}
              {cats.length > 1 && (
                <FilterRow value={cat} onChange={setCat} allLabel={t("starred.filter_all_types")} options={cats} />
              )}
              {anyActive && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[12px] text-muted-foreground">{t("starred.filter_count", { count: shown.length })}</span>
                  <button onClick={clear} className="text-[12px] font-semibold text-primary active:opacity-70">{t("starred.filter_clear")}</button>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 divide-y divide-border/40">
            {shown.map((p) => (
              <button key={p.id} onClick={() => go(p)} className="flex w-full items-center gap-3 py-3 text-left active:bg-muted/40 transition-colors">
                <Thumb place={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">{p.place_name}</span>
                  {p.category && <span className="block text-[12px] text-muted-foreground">{subcategoryLabelLocalized(p.category)}</span>}
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                    {p.source.kind === "trip"
                      ? <BrandIcon src="/Ikona_Trasy.svg" className="h-3 w-3 shrink-0" />
                      : <BrandIcon src={LIST_ICON} className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{p.source.title || (p.source.kind === "trip" ? t("starred.trip_fallback") : t("starred.list_fallback"))}</span>
                    {/* To samo miejsce wyroznione w kilku planach/kolekcjach = jeden wiersz z licznikiem. */}
                    {p.sources.length > 1 && (
                      <span className="shrink-0 text-muted-foreground/80">{t("starred.also_in", { count: p.sources.length - 1 })}</span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
