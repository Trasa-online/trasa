import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Check, ChevronRight, ChevronDown, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, fetchListsWithPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { GoogleGlyph } from "@/components/icons/GoogleGlyph";
import { openExternal } from "@/lib/openExternal";

const NBSP = " ";
const SCOPE_KM = 20; // wyniki wyszukiwarki tylko w obrebie ~20km od srodka trasy/miasta
// Odleglosc haversine (km) - filtr "w obrebie miasta" (unika miejsc z innego miasta/kraju).
const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const keyOf = (p: { place_name?: string | null }) => (p.place_name || "").trim().toLowerCase();
const toPlaceForList = (p: SavedPlace): PlaceForList => ({
  place_name: p.place_name, category: p.category, address: p.address, city: p.city,
  latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
  google_place_id: p.google_place_id, rating: p.rating,
});
// Podpis wiersza = WLASNE miasto miejsca (albo adres). NIE miasto wyjazdu - inaczej kazde
// zapisane miejsce wygladalo jakby lezalo w miescie, do ktorego akurat planujesz wyjazd.
const placeSubtitle = (p: { city?: string | null; address?: string | null }) => p.city || p.address || null;

interface Props {
  open: boolean;
  onClose: () => void;
  city?: string | null;                 // kontekst miasta do wyszukiwarki Google
  existingPlaces?: PlaceForList[];      // miejsca JUŻ w tej trasie/liście - pokazane u góry (info)
  onAdd: (places: PlaceForList[]) => Promise<void> | void;   // zapis (pins.insert / addPlaceToList)
}

// Drawer "Dodaj nowe miejsce" (redesign 2026-08-21). Dodaje miejsca do ISTNIEJACEJ trasy/listy.
// Domyslnie: siatka Twoich zapisanych + kafelek "Dodaj nowe miejsce" (fokus na wyszukiwarke).
// Wpisanie frazy (>=2 znaki) -> Google Places (proxy) -> klik wyniku = nowy zaznaczony kafelek +
// odblokowanie "Dalej". "Dalej" zapisuje wybrane miejsca (onAdd).
export default function AddPlaceSheet({ open, onClose, city, existingPlaces, onAdd }: Props) {
  const { t } = useTranslation("route");
  const { user } = useAuth();
  const [selected, setSelected] = useState<PlaceForList[]>([]);
  const [manual, setManual] = useState<PlaceForList[]>([]);   // dodane z Google (poza zapisanymi)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceForList[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detailPlace, setDetailPlace] = useState<any | null>(null);   // wizytowka miejsca (PlaceSwiperDetail)
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null); // zapis miejsca do wlasnych list
  const inputRef = useRef<HTMLInputElement>(null);

  // Srodek do sortowania "najblizej najpierw": centroida miejsc JUZ w trasie, a gdy brak (nowa
  // trasa/lista) - geokod miasta (Google textsearch).
  //
  // UWAGA (blad zgloszony przez testerke 2026-09-01: "wyszukiwarka nic nie znajduje"): centroide
  // wolno liczyc TYLKO gdy miejsca sa SKUPIONE. Lista wielomiastowa - a taka jest kazda "Ogolne"
  // (prywatna wishlista, globalna z zalozenia) i kazda lista po kilku miastach - ma centroide w
  // szczerym polu miedzy miastami. W bazie: lista z 7 miastami ma centroide 472 km od wlasnych
  // miejsc, wiec filtr ~20 km wycinal WSZYSTKIE wyniki Google. Wyszukiwarka byla martwa na amen.
  // Gdy miejsca sa rozrzucone, centroida nic nie znaczy - lepiej jej nie miec (padniemy na geokod
  // miasta albo na brak sortowania).
  const existingCentroid = useMemo(() => {
    const pts = (existingPlaces ?? []).filter((p) => p.latitude != null && p.longitude != null);
    if (!pts.length) return null;
    const c = {
      lat: pts.reduce((s, p) => s + (p.latitude as number), 0) / pts.length,
      lng: pts.reduce((s, p) => s + (p.longitude as number), 0) / pts.length,
    };
    const spreadKm = Math.max(...pts.map((p) => distKm(c, { lat: p.latitude as number, lng: p.longitude as number })));
    return spreadKm <= SCOPE_KM ? c : null;
  }, [existingPlaces]);
  const { data: geoCenter = null } = useQuery({
    queryKey: ["addplace-city-center", city],
    enabled: open && !!city && !existingCentroid,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "textsearch", query: city } });
      const r = ((data as any)?.results ?? [])[0];
      return r?.latitude != null ? { lat: r.latitude as number, lng: r.longitude as number } : null;
    },
  });
  const center = existingCentroid ?? geoCenter;

  useEffect(() => {
    if (open) { setSelected([]); setManual([]); setQuery(""); setResults([]); setBlocked(false); setAdding(false); setDetailPlace(null); setOpenLists(new Set()); }
  }, [open]);

  const { data: savedPlaces = [] } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  // Miejsca z LIST usera (kuratorskie "Moje listy") - drugie zrodlo wyboru obok "Ogolnych".
  const { data: userLists = [] } = useQuery({
    queryKey: ["lists-with-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchListsWithPlaces(user!.id),
  });
  const [openLists, setOpenLists] = useState<Set<string>>(new Set());
  const toggleList = (id: string) => setOpenLists((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const searchMode = query.trim().length >= 2;

  // Wyszukiwarka Google (debounce 350ms), tylko przy >=2 znakach.
  useEffect(() => {
    if (!searchMode) { setResults([]); setSearching(false); return; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "textsearch", query: `${query} ${city ?? ""}`.trim() } });
        if (!alive) return;
        setBlocked(!!(data as any)?.quota_exceeded);
        const all = ((data as any)?.results ?? []) as any[];
        // "W obrebie miasta" (~20km od srodka) = KOLEJNOSC, nie odsiew. Wczesniej bylo twarde
        // `.filter()` i kazdy przypadek, w ktorym srodek byl zly albo nieznany, konczyl sie pusta
        // lista - user widzial "brak wynikow" dla miejsca, ktore Google normalnie zwraca.
        // Teraz bliskie ida na gore, dalekie na dol: ranking dalej chroni przed "Loving Hut" z
        // drugiego konca swiata, ale wyszukiwarka NIGDY nie oddaje pustki, gdy Google cos znalazl.
        const near = (r: any) => !center || r.latitude == null || r.longitude == null
          || distKm(center, { lat: r.latitude, lng: r.longitude }) <= SCOPE_KM;
        const ordered = [...all.filter(near), ...all.filter((r) => !near(r))];
        setResults(ordered.slice(0, 6).map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null,
          // google_place_id niesiemy dalej - przy zapisie po nim znajdujemy nasz rekord `places`
          // (a z nim wizytowke biznesowa lokalu).
          google_place_id: r.place_id ?? null, rating: null,
        })));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city, center]);

  const isSel = (p: PlaceForList) => selected.some((s) => keyOf(s) === keyOf(p));
  const toggle = (p: PlaceForList) => setSelected((prev) => prev.some((s) => keyOf(s) === keyOf(p)) ? prev.filter((s) => keyOf(s) !== keyOf(p)) : [...prev, p]);
  const pickGoogle = (p: PlaceForList) => {
    haptics.light();
    setManual((prev) => prev.some((m) => keyOf(m) === keyOf(p)) ? prev : [p, ...prev]);
    setSelected((prev) => prev.some((s) => keyOf(s) === keyOf(p)) ? prev : [...prev, p]);
    setQuery("");   // powrot do siatki - nowy kafelek zaznaczony
  };

  // Siatka: dodane z Google (manual) + zapisane, dedup po nazwie, bez tych juz w trasie.
  const existingNameSet = useMemo(() => new Set((existingPlaces ?? []).map(keyOf).filter(Boolean)), [existingPlaces]);

  // Sekcja "Zapisane" = TYLKO zapisane miejsca, bez tych juz w trasie/liscie.
  // Miejsca wybrane wlasnie z wyszukiwarki (`manual`) maja wlasny blok na GORZE arkusza -
  // trzymanie ich takze tutaj dublowaloby ten sam kafelek w dwoch miejscach.
  const tiles = useMemo(() => {
    const seen = new Set(manual.map(keyOf).filter(Boolean));
    const out: PlaceForList[] = [];
    for (const p of savedPlaces.map(toPlaceForList)) {
      const k = keyOf(p);
      if (!k || seen.has(k)) continue;
      if (existingNameSet.has(k)) continue;
      seen.add(k); out.push(p);
    }
    return out;
  }, [manual, savedPlaces, existingNameSet]);

  const doAdd = async () => {
    if (!selected.length || adding) return;
    setAdding(true);
    haptics.light();
    try {
      await onAdd(selected);
      haptics.success();
      toast.success(t("add_place.added", { count: selected.length }));
      onClose();
    } catch (e: any) {
      haptics.error();
      toast.error(t("add_place.failed"));
    } finally { setAdding(false); }
  };

  // Wizytowka miejsca (PlaceSwiperDetail) - mapowanie miejsca (zapisane/google/juz-w-trasie) na MockPlace.
  const openDetail = (p: any) => { haptics.light(); setDetailPlace({
    id: p.place_id || p.place_name,
    place_name: p.place_name,
    category: (p.category || "other"),
    city: (p.city ?? city) || "",
    address: p.address || "",
    latitude: p.latitude ?? 0,
    longitude: p.longitude ?? 0,
    rating: p.rating ?? 0,
    photo_url: p.photo_url ?? "",
    vibe_tags: [],
    description: p.description ?? "",
    google_place_id: p.google_place_id ?? null,
  }); };
  // Otworz miejsce w Google Maps (in-app Safari na native -> mozliwy powrot do apki). query_place_id
  // gdy mamy Google Place ID (google_place_id / place_id niebedace naszym DB uuid).
  const openGoogle = (p: any) => {
    haptics.light();
    const q = encodeURIComponent([p.place_name, p.address, city].filter(Boolean).join(", "));
    const gpid = typeof p.google_place_id === "string" && p.google_place_id.trim() ? p.google_place_id.trim() : "";
    const pid0 = typeof p.place_id === "string" && p.place_id.trim() ? p.place_id.trim() : "";
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid0);
    const gid = gpid || (isDbUuid ? "" : pid0);
    const placeIdParam = gid ? `&query_place_id=${encodeURIComponent(gid)}` : "";
    void openExternal(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`);
  };

  // Wiersz listy: klik nazwy/ikony = WIZYTOWKA; ikona Google w bialym kolku = Google Maps; kolko po
  // prawej = dodaj/usun (lub statyczny check gdy juz w trasie). "szary kafelek w formie listy".
  const renderPlaceRow = (opts: {
    rowKey: string; place: any; subtitle?: string | null; onToggle?: () => void; selected?: boolean; added?: boolean;
  }) => (
    <div key={opts.rowKey} className="w-full flex items-center gap-2 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5">
      <button onClick={() => openDetail(opts.place)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
        <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
          <img src={categoryIconSrc(opts.place.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-foreground truncate">{opts.place.place_name}</span>
          {opts.subtitle && <span className="block text-[13px] text-muted-foreground truncate">{opts.subtitle}</span>}
        </span>
      </button>
      <button onClick={() => openGoogle(opts.place)} aria-label={t("add_place.open_in_maps", { place: opts.place.place_name })}
        className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
        <GoogleGlyph className="h-[18px] w-[18px]" />
      </button>
      {opts.added ? (
        <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-[#f0a583] text-white"><Check className="h-3.5 w-3.5 stroke-[3]" /></span>
      ) : (
        <button onClick={opts.onToggle} aria-label={opts.selected ? t("add_place.remove") : t("add_place.add_to_route")}
          className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${opts.selected ? "bg-[#f0a583] text-white" : "border-2 border-border"}`}>
          {opts.selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      )}
    </div>
  );

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-[#fefefe] border-0" style={{ maxHeight: "86vh" }}>
        <div className="pt-3 pb-1 shrink-0"><div className="mx-auto h-1 w-10 rounded-full bg-[#d9d9d9]" /></div>

        {/* Naglowek */}
        <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3 shrink-0">
          <button onClick={onClose} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">{t("common:buttons.cancel")}</button>
          <h2 className="text-[18px] font-semibold text-foreground truncate">{t("add_place.title")}</h2>
          <button onClick={doAdd} disabled={!selected.length || adding}
            className={`text-sm font-medium rounded-full border bg-white px-3.5 py-1.5 shrink-0 ${selected.length && !adding ? "text-[#181818] border-black/15 active:opacity-60" : "text-[#bcbcbc] border-black/[0.07]"}`}>
            {adding ? "..." : t("common:buttons.add")}
          </button>
        </div>

        {/* Wiersz "Dodaj osoby do tego wyjazdu" USUNIETY 2026-08-30 (decyzja Nat): sklad
            uczestnikow ustala sie WYLACZNIE przy tworzeniu wyjazdu. */}

        {/* Wyszukiwarka */}
        <div className="px-5 pt-1 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("add_place.placeholder")}
              className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-10 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Wyniki Google (search mode) LUB siatka zapisanych */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {searchMode ? (
            <div className="pt-1">
              {searching && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>}
              {blocked && <p className="py-6 text-center text-sm text-muted-foreground">{t("add_place.search_unavailable")}</p>}
              {!searching && !blocked && results.length === 0 && query.trim().length >= 2 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("add_place.no_results")}</p>
              )}
              <div className="space-y-1.5">
                {results.map((r, i) => renderPlaceRow({ rowKey: `${keyOf(r)}-${i}`, place: r, subtitle: r.address, onToggle: () => pickGoogle(r), selected: isSel(r) }))}
              </div>
            </div>
          ) : (
            <div className="pt-1 space-y-4">
              {/* Miejsca WLASNIE wybrane z wyszukiwarki. Trafiaja tez do `tiles`, ale tam ladowaly
                  w sekcji "Zapisane" - czyli pod listami, na samym dole arkusza. Po powrocie
                  z wyszukiwarki wygladalo to, jakby wybor przepadl (zgloszenie Nat 2026-09-04).
                  Pokazujemy je wiec od razu pod wyszukiwarka, nad akcja "Dodaj nowe miejsce". */}
              {manual.length > 0 && (
                <div className="space-y-1.5">
                  {manual.map((m, i) => renderPlaceRow({
                    rowKey: `manual-${keyOf(m)}-${i}`,
                    place: m,
                    subtitle: m.address,
                    onToggle: () => toggle(m),
                    selected: isSel(m),
                  }))}
                </div>
              )}

              {/* Kolejnosc sekcji (2026-08-28): akcja "Dodaj nowe miejsce" -> TWOJE LISTY -> "Zapisane"
                  (lista ogolna) -> "Juz dodane" (info, na samym dole). */}
              <button onClick={() => inputRef.current?.focus()} className="w-full flex items-center gap-3 rounded-2xl bg-secondary/60 px-3 py-2.5 text-left active:bg-secondary transition-colors">
                <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5 text-[#f0a583]" strokeWidth={2.5} />
                </span>
                <span className="flex-1 min-w-0 text-[15px] font-semibold text-foreground">{t("add_place.title")}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>

              {/* TWOJE LISTY (wlasne + zapisane od innych) NAD "Zapisanymi" - to z nich najczesciej
                  buduje sie wyjazd. Kazda lista = zwijana sekcja z wiekszym naglowkiem, oddzielona
                  linia (prosba Nat 2026-08-28). */}
              {userLists.map((l) => {
                const available = l.places.filter((p) => !existingNameSet.has(keyOf(p)));
                if (!available.length) return null;
                const isOpen = openLists.has(l.id);
                return (
                  <div key={l.id} className="border-t border-border/60 pt-4">
                    <button onClick={() => { haptics.light(); toggleList(l.id); }}
                      className="w-full flex items-center gap-2 mb-2 px-0.5 text-left active:opacity-70 transition-opacity">
                      <span className="min-w-0">
                        <span className="block text-[17px] font-bold text-foreground truncate leading-tight">{l.title}</span>
                        <span className="block text-[12px] text-muted-foreground mt-0.5">
                          {l.saved ? `${t("add_place.saved_list")} ` : ""}{t("add_place.places_count", { count: available.length })}
                        </span>
                      </span>
                      <span className="flex-1" />
                      <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-1.5">
                        {available.map((p, i) => renderPlaceRow({
                          rowKey: `l-${l.id}-${keyOf(p)}-${i}`, place: p, subtitle: placeSubtitle(p),
                          onToggle: () => toggle(p), selected: isSel(p),
                        }))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className={userLists.length > 0 ? "pt-1" : ""}>
                <p className="text-[17px] font-bold text-foreground mb-2 px-0.5">Zapisane</p>
                <div className="space-y-1.5">
                  {tiles.map((p, i) => renderPlaceRow({ rowKey: `${keyOf(p)}-${i}`, place: p, subtitle: placeSubtitle(p), onToggle: () => toggle(p), selected: isSel(p) }))}
                </div>
              </div>
              {existingPlaces && existingPlaces.length > 0 && (
                <div className="border-t border-border/60 pt-4">
                  <p className="text-[17px] font-bold text-foreground mb-2 px-0.5">{t("add_place.already")}</p>
                  <div className="space-y-1.5">
                    {existingPlaces.map((p, i) => renderPlaceRow({ rowKey: `ex-${keyOf(p)}-${i}`, place: p, subtitle: placeSubtitle(p) ?? city, added: true }))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    {/* Wizytowka miejsca (klik w wiersz). Vaul-drawer nakłada się na arkusz dodawania. */}
    <PlaceSwiperDetail
      open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace}
      city={detailPlace?.city || city || undefined}
      onLike={detailPlace ? () => setSavePlace({
        place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
        city: detailPlace.city || city || null, latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
        photo_url: detailPlace.photo_url || null, place_id: null,
      }) : undefined}
    />
    <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={city ?? ""} />
    </>
  );
}
