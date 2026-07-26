import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, Star, MapPin, ChevronDown, ChevronUp, Calendar as CalendarIcon, List, GalleryHorizontalEnd, Loader2, ArrowRight, Trash2, Bookmark, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ORIGIN_COUNTRIES } from "@/lib/locations";
import { expandCity } from "@/lib/cities";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { API_BASE } from "@/lib/platform";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import RouteMap from "@/components/RouteMap";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const PL_CITIES = ORIGIN_COUNTRIES.find((c) => c.name === "Polska")?.cities ?? ["Warszawa"];

// Miejsce w kompozycji wyjazdu. place_id != null = z bazy.
type ComposeItem = {
  key: string;
  place_id: string | null;
  place_name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  photo_url: string | null;
};

// Cokolwiek (DB place / wynik Google / ComposeItem) -> ComposeItem.
const toItem = (p: any): ComposeItem => ({
  key: p.id ?? p.key ?? `${p.place_name}:${p.latitude}`,
  place_id: p.id ?? p.place_id ?? null,
  place_name: p.place_name,
  category: p.category ?? null,
  address: p.address ?? null,
  latitude: p.latitude ?? null,
  longitude: p.longitude ?? null,
  rating: typeof p.rating === "number" ? p.rating : null,
  photo_url: p.photo_url ?? null,
});

// ComposeItem / propozycja -> MockPlace (do wizytowki PlaceSwiperDetail).
const toMockPlace = (p: any, city: string): MockPlace => ({
  id: p.place_id ?? p.id ?? p.key ?? p.place_name,
  place_name: p.place_name,
  category: (p.category ?? "other") as any,
  city,
  address: p.address ?? "",
  latitude: p.latitude ?? 0,
  longitude: p.longitude ?? 0,
  rating: typeof p.rating === "number" ? p.rating : 0,
  photo_url: p.photo_url ?? "",
  vibe_tags: [],
  description: "",
});

// Statyczna mapka (proxy /api/static-map) - pomaranczowe markery, POI/transit ukryte.
// Auto-fit do markerow (bez center/zoom). null gdy brak wspolrzednych.
function buildStaticMapUrl(pts: { latitude: number; longitude: number }[]): string | null {
  const valid = pts.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!valid.length) return null;
  const markers = valid.map((p) => `markers=size:small%7Ccolor:0xf9662b%7C${p.latitude},${p.longitude}`).join("&");
  return `${API_BASE}/api/static-map?size=560x260&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

// Kompozycja wyjazdu z zestawienia (wg Figmy "Zestawienie · nowe — klik uzyj"):
// nazwa + daty + miasto + wybrane miejsca (prefill z zestawienia) + szukanie (Google) /
// propozycje z bazy (na fokusie) + statyczna mapa. Potwierdzenie tworzy wyjazd (routes).
export default function ComposeWyjazd() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();

  const nav = (location.state ?? {}) as { city?: string | null; title?: string | null; places?: any[] };

  const [city, setCity] = useState<string>(nav.city || "Warszawa");
  const [name, setName] = useState<string>(nav.title || "");
  const [items, setItems] = useState<ComposeItem[]>(() => (nav.places ?? []).map((p: any, idx: number) => toItem({ ...p, key: p.place_id ?? p.id ?? `${p.place_name}:${idx}` })));
  const [placeView, setPlaceView] = useState<"detail" | "list">("detail");

  // Daty wyjazdu (start + liczba dni z FullCalendarPicker).
  const [dateSheet, setDateSheet] = useState(false);
  const [tripDate, setTripDate] = useState<{ start: Date; numDays: number } | null>(null);

  // Wyszukiwarka: propozycje z bazy (na fokusie), Google textsearch (podczas pisania).
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // Wizytowka miejsca (tap w karte) + rozwinieta mapa.
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  const addedIds = useMemo(() => new Set(items.map((i) => (i.place_id ?? i.place_name).toLowerCase())), [items]);
  const isAdded = (p: any) => addedIds.has((p.id ?? p.place_id ?? p.place_name ?? "").toLowerCase());

  // Propozycje z bazy (najlepiej oceniane w miescie) - pokazywane TYLKO na fokusie (pusta fraza).
  useEffect(() => {
    let alive = true;
    (async () => {
      const cities = expandCity(city);
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url")
        .in("city", cities)
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(20);
      if (alive) setSuggestions(data ?? []);
    })();
    return () => { alive = false; };
  }, [city]);

  // Szukanie po nazwie = GOOGLE (textsearch przez proxy), zeby znalezc KAZDE miejsce, nie
  // tylko te z naszej bazy. Debounce + cache po stronie proxy ogranicza koszt.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("google-places-proxy", {
          body: { action: "textsearch", query: `${q} ${city}` },
        });
        const raw = (data?.results ?? []) as any[];
        setResults(raw.map((r: any) => ({
          id: null,
          place_id: null,
          key: `g:${r.latitude},${r.longitude}:${r.name}`,
          place_name: r.name,
          address: r.full_address ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          category: null,
          rating: null,
          photo_url: null,
        })));
      } catch (e: any) {
        console.error("[ComposeWyjazd] google textsearch error:", e?.message ?? e);
        setResults([]);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, city]);

  const addPlace = (p: any) => { if (!isAdded(p)) setItems((prev) => [...prev, toItem(p)]); };
  const removePlace = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  // Zmiana kolejnosci miejsc (kolejnosc = przebieg trasy). dir: -1 w gore, +1 w dol.
  const moveItem = (key: string, dir: -1 | 1) => setItems((prev) => {
    const idx = prev.findIndex((i) => i.key === key);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });
  const openDetail = (p: any) => setDetailPlace(toMockPlace(p, city));

  const mapPins = items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ latitude: i.latitude!, longitude: i.longitude!, place_name: i.place_name }));
  const staticMapUrl = useMemo(() => buildStaticMapUrl(mapPins), [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateLabel = tripDate
    ? tripDate.numDays > 1
      ? `${format(tripDate.start, "d MMM", { locale: dateLocale() })} - ${format(addDays(tripDate.start, tripDate.numDays - 1), "d MMM", { locale: dateLocale() })}`
      : format(tripDate.start, "d MMM", { locale: dateLocale() })
    : null;

  // openEditor=true -> tworzy i otwiera edytor wyjazdu; false (zapis zakladka) -> tworzy
  // i laduje w liscie Wyjazdow z toastem.
  const confirm = async (openEditor: boolean) => {
    if (!user) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    if (!items.length) { toast.error("Dodaj przynajmniej jedno miejsce"); return; }
    setCreating(true);
    const dates = tripDate
      ? {
          start_date: format(tripDate.start, "yyyy-MM-dd"),
          end_date: format(addDays(tripDate.start, tripDate.numDays - 1), "yyyy-MM-dd"),
        }
      : undefined;
    const id = await createWyjazdFromPlaces(
      user.id,
      city,
      name.trim() || city || "Wyjazd",
      items.map((i) => ({
        place_name: i.place_name,
        category: i.category,
        address: i.address,
        latitude: i.latitude,
        longitude: i.longitude,
        photo_url: i.photo_url,
        place_id: i.place_id,
      })),
      dates,
    );
    setCreating(false);
    if (!id) { toast.error("Nie udało się utworzyć wyjazdu"); return; }
    if (openEditor) navigate(`/review-summary?route=${id}&edit=1`);
    else { toast.success("Zapisano wyjazd"); navigate("/dziennik"); }
  };

  // Propozycje: podczas pisania = wyniki Google, na fokusie = sugestie z bazy (bez dodanych).
  const proposals = (search.trim().length >= 2 ? results : suggestions).filter((p) => !isAdded(p));
  const showProposals = searchFocused || search.trim().length >= 2;

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Wróć" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 font-bold text-base truncate">{nav.title ? `Zestawienie - ${nav.title}` : "Nowy wyjazd"}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {/* Miasto */}
        <div className="px-4 pt-4">
          <div className="relative">
            <select value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full appearance-none rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40">
              {PL_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Nazwa + data */}
        <div className="px-4 pt-3 flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Twoja nazwa"
            className="flex-1 min-w-0 rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/60" />
          <button onClick={() => setDateSheet(true)}
            className={`shrink-0 h-[50px] rounded-2xl bg-secondary flex items-center gap-2 px-3.5 active:scale-95 transition-transform ${dateLabel ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            {dateLabel && <span className="text-sm whitespace-nowrap">{dateLabel}</span>}
          </button>
        </div>

        {/* Wyszukiwarka */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={`Szukaj miejsca w ${city}...`}
              className="w-full rounded-full bg-secondary text-secondary-foreground border border-border/40 pl-10 pr-9 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400/50 placeholder:text-muted-foreground/60" />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Wyczyść" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* PROPOZYCJE - poziome karty. Podczas pisania = wyniki Google, na fokusie = baza. Tap -> wizytowka, "+" -> dodaj. */}
        {showProposals && (
          <div className="pt-4">
            <p className="px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
              {search.trim().length >= 2 ? "Wyniki wyszukiwania" : `Propozycje w ${city}`}
            </p>
            {loading && search.trim().length >= 2 ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : proposals.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground pb-2">Brak wyników dla tej frazy.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory px-4 pb-1">
                {proposals.slice(0, 15).map((p: any) => (
                  <button key={p.id ?? p.key ?? p.place_name} onClick={() => openDetail(p)} className="shrink-0 w-[150px] snap-start text-left active:opacity-80 transition-opacity">
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.place_name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center"><MapPin className="h-6 w-6 text-orange-400" /></div>
                      )}
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); addPlace(p); }} aria-label="Dodaj miejsce"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform">
                        <Plus className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                      {typeof p.rating === "number" && p.rating > 0 && (
                        <span className="absolute bottom-2 left-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-[11px] font-bold text-foreground">{p.rating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 px-0.5 text-sm font-bold leading-tight line-clamp-1">{p.place_name}</p>
                    <p className="px-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-1">{p.category ? subcategoryLabelLocalized(p.category) : (p.address || city)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WYBRANE MIEJSCA (N) + toggle lista/karty. Tap -> wizytowka. */}
        <div className="px-4 pt-5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Wybrane miejsca ({items.length})</p>
            {items.length > 0 && (
              <div className="flex rounded-full bg-secondary p-0.5">
                <button type="button" onClick={() => setPlaceView("list")} aria-label="Widok listy" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <List className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPlaceView("detail")} aria-label="Widok kart" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "detail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <GalleryHorizontalEnd className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/40 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">Brak miejsc</p>
              <p className="text-xs text-muted-foreground mt-1">Dodaj miejsca z propozycji powyżej.</p>
            </div>
          ) : placeView === "detail" ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
              {items.map((it) => (
                <button key={it.key} onClick={() => openDetail(it)} className="shrink-0 w-[220px] snap-start rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm text-left active:opacity-90 transition-opacity">
                  <div className="relative aspect-[4/3] bg-muted">
                    {it.photo_url ? (
                      <img src={it.photo_url} alt={it.place_name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center"><MapPin className="h-7 w-7 text-orange-400" /></div>
                    )}
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removePlace(it.key); }} aria-label="Usuń miejsce"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center active:scale-90 transition-transform">
                      <X className="h-4 w-4" />
                    </span>
                    {typeof it.rating === "number" && it.rating > 0 && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-[11px] font-bold text-foreground">{it.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    {it.category && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground mb-1">{subcategoryLabelLocalized(it.category)}</span>}
                    <p className="text-sm font-black leading-tight line-clamp-1">{it.place_name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1">{it.address || city}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((it, idx) => (
                <button key={it.key} onClick={() => openDetail(it)} className="w-full flex items-center gap-2.5 rounded-2xl bg-secondary p-2.5 text-left active:opacity-90 transition-opacity">
                  {/* Numer porzadkowy = pozycja w trasie */}
                  <span className="shrink-0 h-6 w-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                  {it.photo_url ? (
                    <img src={it.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-background flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-4 w-4" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{it.place_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {it.category && <span className="text-[11px] text-muted-foreground truncate">{subcategoryLabelLocalized(it.category)}</span>}
                      {typeof it.rating === "number" && it.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{it.rating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                  {/* Zmiana kolejnosci: strzalki gora/dol (wylaczone na krancach) */}
                  <span className="shrink-0 flex flex-col -my-0.5">
                    <span role="button" tabIndex={0} aria-label="Przesuń wyżej" aria-disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); if (idx > 0) moveItem(it.key, -1); }}
                      className={`h-6 w-7 flex items-center justify-center rounded-lg transition-transform ${idx === 0 ? "text-muted-foreground/30" : "text-muted-foreground active:scale-90 active:bg-background"}`}>
                      <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span role="button" tabIndex={0} aria-label="Przesuń niżej" aria-disabled={idx === items.length - 1}
                      onClick={(e) => { e.stopPropagation(); if (idx < items.length - 1) moveItem(it.key, 1); }}
                      className={`h-6 w-7 flex items-center justify-center rounded-lg transition-transform ${idx === items.length - 1 ? "text-muted-foreground/30" : "text-muted-foreground active:scale-90 active:bg-background"}`}>
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                  </span>
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removePlace(it.key); }} aria-label="Usuń miejsce" className="h-8 w-8 rounded-full bg-background flex items-center justify-center text-muted-foreground active:scale-90 transition-transform shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MAPA - statyczna z guzikiem rozwinięcia (interaktywna mapa z zoomem) */}
        {mapPins.length > 0 && staticMapUrl && (
          <div className="px-4 pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Mapa</p>
            <div className="relative h-52 rounded-2xl overflow-hidden border border-border/40 bg-muted">
              <img src={staticMapUrl} alt="Mapa miejsc" className="w-full h-full object-cover" />
              <button onClick={() => setMapExpanded(true)} aria-label="Rozwiń mapę"
                className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform">
                <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer - ukryty gdy fokus na wyszukiwarce (wiecej miejsca na wyniki). */}
      {!searchFocused && (
        <div className="shrink-0 border-t border-border/20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-background flex items-center gap-2">
          <button onClick={() => confirm(true)} disabled={creating}
            className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Stwórz wyjazd <ArrowRight className="h-4 w-4" /></>}
          </button>
          <button onClick={() => confirm(false)} disabled={creating} aria-label="Zapisz wyjazd"
            className="shrink-0 h-12 w-12 rounded-2xl bg-secondary text-secondary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60">
            <Bookmark className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Wizytowka miejsca (tap w karte) */}
      <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={city} />

      {/* Rozwinięta interaktywna mapa (zoom) */}
      <Sheet open={mapExpanded} onOpenChange={setMapExpanded}>
        <SheetContent side="bottom" className="p-0 [&>button:last-child]:hidden" style={{ height: "92dvh" }}>
          <div className="relative w-full h-full">
            <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setMapExpanded(false)} aria-label="Zamknij mapę"
              className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet z kalendarzem */}
      <Sheet open={dateSheet} onOpenChange={setDateSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 [&>button:last-child]:hidden" style={{ maxHeight: "88vh" }}>
          <div className="px-5 pt-5 pb-1 text-center">
            <p className="text-lg font-black leading-tight">Kiedy jedziesz?</p>
            <p className="text-xs text-muted-foreground mt-1">Wybierz daty wyjazdu (opcjonalnie).</p>
          </div>
          <FullCalendarPicker onConfirm={(d, n) => { setTripDate({ start: d, numDays: n }); setDateSheet(false); }} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
