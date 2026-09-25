import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandCheck, BrandSearch, BrandPin } from "@/components/BrandIcon";
import { usePlaceSearch, type PlaceSearchItem } from "@/hooks/usePlaceSearch";
import { fetchPlaceCities, placeCitiesKey } from "@/lib/placeCities";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { placeCategoryLabel } from "@/lib/categories";
import { countryForCity } from "@/lib/tripCountries";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

// Krok onboardingu „Twoje ulubione miejsca" (prosba Nat 2026-09-25): user wybiera miasto,
// w ktorym mieszka, i DWA ulubione miejsca stamtad - z nich powstaje jego pierwsza kolekcja.
// Cel podwojny: user od razu widzi, o co chodzi w apce (kolekcja = miejsca, ktore polecam),
// a baza dostaje tresc od pierwszego dnia.
//
// Stan (miasto + wybor) zyje w OnboardingFlow, bo to tam stoi guzik CTA i tam powstaje
// kolekcja. Ten komponent tylko go edytuje.
//
// Wyszukiwarka = wspolny `usePlaceSearch` (nasz katalog, potem Google Autocomplete w sesji).
// ⛔ Podpowiedz z Google nie ma wspolrzednych - `resolve()` przy WYBORZE, jak w AddPlaceSheet.

export const FAVORITES_COUNT = 2;

export type FavoritesState = { city: string; picks: PlaceSearchItem[] };

const keyOf = (p: PlaceSearchItem) => (p.google_place_id || p.place_id || p.place_name).toLowerCase();

export default function OnboardingFavorites({ value, onChange, onFocusChange }: {
  value: FavoritesState;
  onChange: (v: FavoritesState) => void;
  /** Pole w fokusie = rodzic chowa CTA (klawiatura), jak w pozostalych krokach. */
  onFocusChange: (focused: boolean) => void;
}) {
  const { t } = useTranslation("onboarding");
  const [cityDraft, setCityDraft] = useState(value.city);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const city = value.city.trim();
  const focusProps = { onFocus: () => onFocusChange(true), onBlur: () => onFocusChange(false) };

  // Podpowiedzi miast = miasta, w ktorych MAMY wizytowki (zero kosztu, te same co w Miejscach).
  const { data: cities = [] } = useQuery({
    queryKey: placeCitiesKey,
    queryFn: fetchPlaceCities,
    staleTime: 60 * 60 * 1000,
  });
  const citySuggestions = useMemo(() => {
    const q = cityDraft.trim().toLowerCase();
    const list = cities.map((c) => c.city);
    return (q ? list.filter((c) => c.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [cities, cityDraft]);

  // Srodek miasta z NASZYCH miejsc (darmowe RPC) - nakierowuje podpowiedzi Google na to miasto.
  const { data: center = null } = useQuery({
    queryKey: ["addplace-city-center", city],
    enabled: !!city,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("city_center", { p_city: city });
      const r = Array.isArray(data) ? data[0] : data;
      return r?.latitude != null ? { lat: Number(r.latitude), lng: Number(r.longitude) } : null;
    },
  });
  // PRZYKLADY (prosba Nat 2026-09-25): bez nich pusty ekran z wyszukiwarka nie mowil, czego
  // sie od usera oczekuje. Cztery miejsca z NASZEGO katalogu w tym miescie, kazde innej
  // kategorii - pokazuja rozpietosc ("to moze byc kawiarnia, park, muzeum") i od razu daja
  // sie wybrac jednym tapnieciem. Losowanie w queryFn, nie w renderze, zeby kafelki nie
  // przeskakiwaly przy kazdym przerysowaniu. Miasto bez naszych miejsc = brak sekcji.
  const { data: examples = [] } = useQuery({
    queryKey: ["onboarding-fav-examples", city],
    enabled: !!city,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<PlaceSearchItem[]> => {
      const { data } = await (supabase as any).from("places")
        .select("id, place_name, address, latitude, longitude, category, google_place_id")
        .eq("is_active", true).ilike("city", city).not("category", "is", null).limit(60);
      const rows = [...((data ?? []) as any[])].sort(() => Math.random() - 0.5);
      const seen = new Set<string>();
      const out: PlaceSearchItem[] = [];
      for (const r of rows) {
        const cat = String(r.category).toLowerCase();
        if (seen.has(cat) || !r.place_name) continue;
        seen.add(cat);
        out.push({
          place_name: r.place_name, address: r.address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: r.category, photo_url: null, place_id: r.id, google_place_id: r.google_place_id ?? null, rating: null, source: "catalog",
        });
        if (out.length === 4) break;
      }
      return out;
    },
  });
  const country = city ? countryForCity(city) : "";
  const { results, searching, searchMode, resolve } = usePlaceSearch(query, {
    city: city || null,
    countries: country ? [country] : null,
    center,
    enabled: !!city,
  });

  const chooseCity = (c: string) => {
    haptics.light();
    setCityDraft(c);
    // Zmiana miasta kasuje wybor - ulubione z Krakowa nie pasuja do kolekcji o Gdansku.
    onChange({ city: c, picks: c === value.city ? value.picks : [] });
  };

  const isPicked = (p: PlaceSearchItem) => value.picks.some((x) => keyOf(x) === keyOf(p));
  const toggle = async (p: PlaceSearchItem) => {
    if (isPicked(p)) {
      haptics.light();
      onChange({ ...value, picks: value.picks.filter((x) => keyOf(x) !== keyOf(p)) });
      return;
    }
    if (value.picks.length >= FAVORITES_COUNT) { haptics.warning(); return; }
    haptics.light();
    let place = p;
    if (p.source === "google" && p.latitude == null) {
      setResolving(keyOf(p));
      try { place = await resolve(p); } finally { setResolving(null); }
    }
    onChange({ ...value, picks: [...value.picks, place] });
  };

  // ── Etap 1: miasto ───────────────────────────────────────────────────────────
  if (!city) {
    const typed = cityDraft.trim();
    const typedIsKnown = citySuggestions.some((c) => c.toLowerCase() === typed.toLowerCase());
    return (
      <>
        <div className="pt-6">
          <h2 className="text-2xl font-black mb-2 leading-tight">{t("favorites.city_title")}</h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed">{t("favorites.city_desc")}</p>
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-white px-4 flex items-center gap-2 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
          <BrandPin className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            value={cityDraft}
            {...focusProps}
            onChange={(e) => setCityDraft(e.target.value.slice(0, 60))}
            onKeyDown={(e) => { if (e.key === "Enter" && typed) chooseCity(typed); }}
            autoCapitalize="words"
            autoCorrect="off"
            placeholder={t("favorites.city_placeholder")}
            className="flex-1 bg-transparent py-3.5 text-lg outline-none text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 pb-4">
          {citySuggestions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => chooseCity(c)}
              className="px-4 py-2.5 rounded-full text-sm font-semibold border border-border bg-white text-foreground active:scale-[0.97] transition-transform"
            >
              {c}
            </button>
          ))}
          {/* Miasto spoza naszej bazy tez przechodzi - kolekcja nie wymaga naszych wizytowek,
              a Google znajdzie miejsca wszedzie. */}
          {typed.length >= 2 && !typedIsKnown && (
            <button
              type="button"
              onClick={() => chooseCity(typed)}
              className="px-4 py-2.5 rounded-full text-sm font-semibold bg-primary text-white active:scale-[0.97] transition-transform"
            >
              {t("favorites.city_use", { city: typed })}
            </button>
          )}
        </div>
      </>
    );
  }

  // ── Etap 2: dwa miejsca ──────────────────────────────────────────────────────
  const slots = Array.from({ length: FAVORITES_COUNT }, (_, i) => value.picks[i] ?? null);
  return (
    <>
      <div className="pt-6">
        <h2 className="text-2xl font-black mb-2 leading-tight">{t("favorites.title")}</h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">{t("favorites.desc")}</p>
        <button
          type="button"
          onClick={() => { setCityDraft(city); onChange({ city: "", picks: [] }); setQuery(""); }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground active:scale-95 transition-transform"
        >
          <BrandPin className="h-3.5 w-3.5" />
          {city} · {t("favorites.change_city")}
        </button>
      </div>

      {/* Dwa sloty - widac od razu, ile zostalo do wybrania. */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {slots.map((p, i) => p ? (
          <div key={keyOf(p)} className="relative rounded-2xl bg-[#FDF184] px-3 pt-3 pb-3 min-h-[92px] flex flex-col">
            <span className="h-8 w-8 rounded-lg bg-white/80 flex items-center justify-center">
              <img src={categoryIconSrc(p.category)} alt="" className="h-5 w-5" draggable={false} />
            </span>
            <span className="mt-1.5 text-sm font-bold text-[#5B2C06] leading-snug line-clamp-2">{p.place_name}</span>
            {p.category && <span className="text-[11px] font-semibold text-[#5B2C06]/70 truncate">{placeCategoryLabel(p.category)}</span>}
            <button
              type="button"
              onClick={() => void toggle(p)}
              aria-label={t("favorites.remove")}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/80 flex items-center justify-center active:scale-95"
            >
              <X className="h-3.5 w-3.5 text-[#5B2C06]" />
            </button>
          </div>
        ) : (
          // Pusty slot = wejscie do wyszukiwarki: fokus od razu podnosi klawiature. focus()
          // musi pasc SYNCHRONICZNIE w obsludze tapniecia - inaczej iOS nie pokaze klawiatury.
          <button
            key={`empty-${i}`}
            type="button"
            onClick={() => { haptics.light(); searchRef.current?.focus(); }}
            className="rounded-2xl border-2 border-dashed border-border min-h-[92px] flex flex-col items-center justify-center gap-1.5 px-3 text-center active:scale-[0.98] transition-transform"
          >
            <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Plus className="h-4 w-4 text-white" strokeWidth={2.75} />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{t("favorites.slot_empty", { n: i + 1 })}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-white px-4 flex items-center gap-2 focus-within:ring-2 focus-within:ring-orange-500/60 transition-shadow">
        <BrandSearch className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          ref={searchRef}
          value={query}
          {...focusProps}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
          placeholder={t("favorites.search_placeholder")}
          className="flex-1 bg-transparent py-3.5 text-base outline-none text-foreground placeholder:text-muted-foreground/50"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {!searchMode && examples.length > 0 && (
        <div className="mt-5 pb-4">
          <p className="px-1 mb-2 text-sm font-semibold text-muted-foreground">{t("favorites.examples")}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {examples.map((p) => {
              const on = isPicked(p);
              const full = !on && value.picks.length >= FAVORITES_COUNT;
              return (
                <button
                  key={keyOf(p)}
                  type="button"
                  onClick={() => void toggle(p)}
                  className={cn("relative rounded-2xl bg-[#fcede3] p-3 min-h-[112px] flex flex-col text-left active:scale-[0.98] transition-transform",
                    on && "ring-2 ring-primary", full && "opacity-45")}
                >
                  <span className="h-9 w-9 rounded-xl bg-white flex items-center justify-center">
                    <img src={categoryIconSrc(p.category)} alt="" className="h-5 w-5" draggable={false} />
                  </span>
                  <span className="mt-auto pt-2 text-sm font-bold text-foreground leading-snug line-clamp-2">{p.place_name}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground truncate">{placeCategoryLabel(p.category)}</span>
                  <span className={cn("absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center", on ? "bg-white" : "bg-primary")}>
                    {on
                      ? <BrandCheck className="h-4 w-4 text-primary" strokeWidth={3} />
                      : <Plus className="h-4 w-4 text-white" strokeWidth={2.75} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1 pb-4">
        {searchMode && !searching && results.length === 0 && (
          <p className="px-1 py-3 text-sm text-muted-foreground">{t("favorites.no_results")}</p>
        )}
        {results.map((p) => {
          const on = isPicked(p);
          const full = !on && value.picks.length >= FAVORITES_COUNT;
          return (
            <button
              key={keyOf(p)}
              type="button"
              onClick={() => void toggle(p)}
              className={cn("w-full flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-muted/60 transition-colors", full && "opacity-45")}
            >
              <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                <img src={categoryIconSrc(p.category)} alt="" className="h-6 w-6" draggable={false} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold truncate">{p.place_name}</span>
                {p.address && <span className="block text-xs text-muted-foreground truncate">{p.address}</span>}
              </span>
              <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
                on ? "bg-[#FCEDE3]" : "bg-primary")}>
                {resolving === keyOf(p)
                  ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                  : on
                    ? <BrandCheck className="h-4 w-4 text-primary" strokeWidth={3} />
                    : <Plus className="h-4 w-4 text-white" strokeWidth={2.75} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
