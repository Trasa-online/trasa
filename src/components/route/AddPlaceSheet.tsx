import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Check, Users, ChevronRight, ChevronDown, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, fetchListsWithPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
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
  onInvitePeople?: () => void;          // trasa: otwiera zaproszenia; brak = ukryty wiersz (listy)
}

// Drawer "Dodaj nowe miejsce" (redesign 2026-08-21). Dodaje miejsca do ISTNIEJACEJ trasy/listy.
// Domyslnie: siatka Twoich zapisanych + kafelek "Dodaj nowe miejsce" (fokus na wyszukiwarke).
// Wpisanie frazy (>=2 znaki) -> Google Places (proxy) -> klik wyniku = nowy zaznaczony kafelek +
// odblokowanie "Dalej". "Dalej" zapisuje wybrane miejsca (onAdd).
export default function AddPlaceSheet({ open, onClose, city, existingPlaces, onAdd, onInvitePeople }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<PlaceForList[]>([]);
  const [manual, setManual] = useState<PlaceForList[]>([]);   // dodane z Google (poza zapisanymi)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceForList[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detailPlace, setDetailPlace] = useState<any | null>(null);   // wizytowka miejsca (PlaceSwiperDetail)
  const inputRef = useRef<HTMLInputElement>(null);

  // Srodek do filtra "w obrebie miasta" (~20km): centroida miejsc JUZ w trasie, a gdy brak (nowa
  // trasa/lista) - geokod miasta (Google textsearch). Zapobiega dodaniu miejsca z innego miasta/kraju.
  const existingCentroid = useMemo(() => {
    const pts = (existingPlaces ?? []).filter((p) => p.latitude != null && p.longitude != null);
    if (!pts.length) return null;
    return {
      lat: pts.reduce((s, p) => s + (p.latitude as number), 0) / pts.length,
      lng: pts.reduce((s, p) => s + (p.longitude as number), 0) / pts.length,
    };
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
        // Filtr "w obrebie miasta" (~20km od srodka) - odrzuca wyniki z innych miast/krajow.
        const scoped = center
          ? all.filter((r) => r.latitude == null || r.longitude == null || distKm(center, { lat: r.latitude, lng: r.longitude }) <= SCOPE_KM)
          : all;
        setResults(scoped.slice(0, 6).map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null, google_place_id: null, rating: null,
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

  // Zapisane (do wyboru) = dodane z Google + zapisane, dedup, BEZ tych juz w trasie/liscie.
  const tiles = useMemo(() => {
    const seen = new Set<string>();
    const out: PlaceForList[] = [];
    for (const p of [...manual, ...savedPlaces.map(toPlaceForList)]) {
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
      toast.success(selected.length === 1 ? "Dodano miejsce" : `Dodano ${selected.length} miejsca`);
      onClose();
    } catch (e: any) {
      haptics.error();
      toast.error("Nie udało się dodać miejsca");
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
      <button onClick={() => openGoogle(opts.place)} aria-label={`Otwórz ${opts.place.place_name} w Google Maps`}
        className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
        <GoogleGlyph className="h-[18px] w-[18px]" />
      </button>
      {opts.added ? (
        <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-[#f0a583] text-white"><Check className="h-3.5 w-3.5 stroke-[3]" /></span>
      ) : (
        <button onClick={opts.onToggle} aria-label={opts.selected ? "Usuń z trasy" : "Dodaj do trasy"}
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
          <button onClick={onClose} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">Anuluj</button>
          <h2 className="text-[18px] font-semibold text-foreground truncate">Dodaj nowe miejsce</h2>
          <button onClick={doAdd} disabled={!selected.length || adding}
            className={`text-sm font-medium rounded-full border bg-white px-3.5 py-1.5 shrink-0 ${selected.length && !adding ? "text-[#181818] border-black/15 active:opacity-60" : "text-[#bcbcbc] border-black/[0.07]"}`}>
            {adding ? "..." : "Dalej"}
          </button>
        </div>

        {/* Dodaj osoby (trasa) */}
        {onInvitePeople && (
          <button onClick={onInvitePeople} className="shrink-0 w-full flex items-center gap-4 px-5 py-3 text-left active:bg-muted/50 transition-colors">
            <Users className="h-6 w-6 text-foreground shrink-0" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-foreground">{`Dodaj osoby do${NBSP}tego wyjazdu`}</p>
              <p className="text-[13px] text-muted-foreground">{`Twórz wyjazdy razem z${NBSP}innymi`}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Wyszukiwarka */}
        <div className="px-5 pt-1 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nazwa miejsca"
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
              {blocked && <p className="py-6 text-center text-sm text-muted-foreground">{`Wyszukiwarka chwilowo niedostępna. Wybierz z${NBSP}zapisanych.`}</p>}
              {!searching && !blocked && results.length === 0 && query.trim().length >= 2 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Brak wyników</p>
              )}
              <div className="space-y-1.5">
                {results.map((r, i) => renderPlaceRow({ rowKey: `${keyOf(r)}-${i}`, place: r, subtitle: r.address, onToggle: () => pickGoogle(r), selected: isSel(r) }))}
              </div>
            </div>
          ) : (
            <div className="pt-1 space-y-4">
              {/* NAJPIERW "Zapisane" (do wyboru) + "Dodaj nowe miejsce", "Juz dodane" (info) na SAMYM
                  DOLE - nie zabiera miejsca u gory (2026-08-25, prosba Nat). Lista, nie siatka kafelkow. */}
              <div>
                {((existingPlaces && existingPlaces.length > 0) || userLists.length > 0) && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">Zapisane</p>
                )}
                <div className="space-y-1.5">
                  {/* "Dodaj nowe miejsce" jako WIERSZ (nie kafelek z plusem) -> fokus na wyszukiwarke */}
                  <button onClick={() => inputRef.current?.focus()} className="w-full flex items-center gap-3 rounded-2xl bg-secondary/60 px-3 py-2.5 text-left active:bg-secondary transition-colors">
                    <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                      <Plus className="h-5 w-5 text-[#f0a583]" strokeWidth={2.5} />
                    </span>
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-foreground">Dodaj nowe miejsce</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </button>
                  {tiles.map((p, i) => renderPlaceRow({ rowKey: `${keyOf(p)}-${i}`, place: p, subtitle: placeSubtitle(p), onToggle: () => toggle(p), selected: isSel(p) }))}
                </div>
              </div>
              {/* Miejsca z Twoich LIST - kazda lista jako zwijana sekcja (domyslnie zwinieta,
                  zeby nie zasypywac widoku). Miejsca juz w trasie sa odfiltrowane. */}
              {userLists.map((l) => {
                const available = l.places.filter((p) => !existingNameSet.has(keyOf(p)));
                if (!available.length) return null;
                const isOpen = openLists.has(l.id);
                return (
                  <div key={l.id}>
                    <button onClick={() => { haptics.light(); toggleList(l.id); }}
                      className="w-full flex items-center gap-2 mb-1.5 px-0.5 text-left active:opacity-70 transition-opacity">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">{l.title}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground/70 shrink-0">{available.length}</span>
                      <span className="flex-1" />
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
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
              {existingPlaces && existingPlaces.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 px-0.5">Już dodane</p>
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
    <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={detailPlace?.city || city || undefined} />
    </>
  );
}
