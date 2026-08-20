import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Check, Users, ChevronRight, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";

const NBSP = " ";
const keyOf = (p: { place_name?: string | null }) => (p.place_name || "").trim().toLowerCase();
const toPlaceForList = (p: SavedPlace): PlaceForList => ({
  place_name: p.place_name, category: p.category, address: p.address, description: p.short_desc,
  latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
  google_place_id: p.google_place_id, rating: p.rating,
});

interface Props {
  open: boolean;
  onClose: () => void;
  city?: string | null;                 // kontekst miasta do wyszukiwarki Google
  existingNames?: Set<string>;          // nazwy juz w trasie/liscie (znormalizowane) - odfiltruj
  onAdd: (places: PlaceForList[]) => Promise<void> | void;   // zapis (pins.insert / addPlaceToList)
  onInvitePeople?: () => void;          // trasa: otwiera zaproszenia; brak = ukryty wiersz (listy)
}

// Drawer "Dodaj nowe miejsce" (redesign 2026-08-21). Dodaje miejsca do ISTNIEJACEJ trasy/listy.
// Domyslnie: siatka Twoich zapisanych + kafelek "Dodaj nowe miejsce" (fokus na wyszukiwarke).
// Wpisanie frazy (>=2 znaki) -> Google Places (proxy) -> klik wyniku = nowy zaznaczony kafelek +
// odblokowanie "Dalej". "Dalej" zapisuje wybrane miejsca (onAdd).
export default function AddPlaceSheet({ open, onClose, city, existingNames, onAdd, onInvitePeople }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<PlaceForList[]>([]);
  const [manual, setManual] = useState<PlaceForList[]>([]);   // dodane z Google (poza zapisanymi)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceForList[]>([]);
  const [searching, setSearching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setSelected([]); setManual([]); setQuery(""); setResults([]); setBlocked(false); setAdding(false); }
  }, [open]);

  const { data: savedPlaces = [] } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchSavedPlaces(user!.id),
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
        const raw = ((data as any)?.results ?? []).slice(0, 6) as any[];
        setResults(raw.map((r) => ({
          place_name: r.name, address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
          category: categoryFromGoogleTypes(r.types), photo_url: null, place_id: null, google_place_id: null, rating: null,
        })));
      } catch { if (alive) setResults([]); }
      finally { if (alive) setSearching(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query, searchMode, city]);

  const isSel = (p: PlaceForList) => selected.some((s) => keyOf(s) === keyOf(p));
  const toggle = (p: PlaceForList) => setSelected((prev) => prev.some((s) => keyOf(s) === keyOf(p)) ? prev.filter((s) => keyOf(s) !== keyOf(p)) : [...prev, p]);
  const pickGoogle = (p: PlaceForList) => {
    haptics.light();
    setManual((prev) => prev.some((m) => keyOf(m) === keyOf(p)) ? prev : [p, ...prev]);
    setSelected((prev) => prev.some((s) => keyOf(s) === keyOf(p)) ? prev : [...prev, p]);
    setQuery("");   // powrot do siatki - nowy kafelek zaznaczony
  };

  // Siatka: dodane z Google (manual) + zapisane, dedup po nazwie, bez tych juz w trasie.
  const tiles = useMemo(() => {
    const seen = new Set<string>();
    const out: PlaceForList[] = [];
    for (const p of [...manual, ...savedPlaces.map(toPlaceForList)]) {
      const k = keyOf(p);
      if (!k || seen.has(k)) continue;
      if (existingNames?.has(k)) continue;
      seen.add(k); out.push(p);
    }
    return out;
  }, [manual, savedPlaces, existingNames]);

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

  return (
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
              {results.map((r, i) => {
                const on = isSel(r);
                return (
                  <button key={`${keyOf(r)}-${i}`} onClick={() => pickGoogle(r)}
                    className="w-full flex items-center gap-3 px-1 py-2.5 text-left active:bg-muted/50 rounded-xl transition-colors">
                    <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                      <img src={categoryIconSrc(r.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-foreground truncate">{r.place_name}</span>
                      {r.address && <span className="block text-[13px] text-muted-foreground truncate">{r.address}</span>}
                    </span>
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${on ? "bg-[#f0a583] text-white" : "border-2 border-border"}`}>
                      {on ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {/* Dodaj nowe miejsce -> fokus na wyszukiwarke */}
              <button onClick={() => inputRef.current?.focus()} className="aspect-square rounded-2xl bg-[#fcede3] flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform">
                <Plus className="h-6 w-6 text-[#f0a583]" strokeWidth={2.5} />
                <span className="text-[11px] font-semibold text-foreground/80 px-1 text-center leading-tight">Dodaj nowe miejsce</span>
              </button>
              {tiles.map((p, i) => {
                const on = isSel(p);
                return (
                  <button key={`${keyOf(p)}-${i}`} onClick={() => toggle(p)} className={`relative rounded-2xl transition-all active:scale-[0.97] ${on ? "ring-2 ring-[#f0a583]" : ""}`}>
                    <PlaceTile showCity tile={{ photo_url: p.photo_url, category: p.category, place_name: p.place_name, city }} />
                    <span className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center ${on ? "bg-[#f0a583] text-white" : "bg-white/85 border border-black/10"}`}>
                      {on && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
