import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, X, Loader2, MapPin } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { inferCategoryFromName, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { forwardGeocodeWithTypes } from "@/lib/googleMaps";
import { fetchSavedPlaces, removeSavedPlaceById, quickSavePlace, type SavedPlace } from "@/lib/placeLists";

// Segment "Miejsca" w zakładce Zapisane: PRYWATNA wishlista usera "Do zobaczenia" (agregat
// pozycji ze wszystkich list to_visit). User może dodać miejsce BEZPOŚREDNIO ("Dodaj miejsce")
// oraz usunąć. Tap w miejsce -> wizytówka (PlaceSwiperDetail).
export function SavedPlaces({ city }: { city?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailPin, setDetailPin] = useState<{ place: MockPlace; city: string; skip: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Selektor "Wszystkie" = ALL_CITIES ("all") -> traktuj jak brak miasta (globalny zapis/wyszukiwanie).
  const rawCity = (city ?? "").trim();
  const activeCity = rawCity && rawCity !== "all" ? rawCity : "";

  const { data: places = [], isLoading } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-places", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-place-names", user?.id] });
  };

  const openDetail = (p: SavedPlace) => setDetailPin({
    skip: !p.place_id,
    city: p.city ?? "",
    place: {
      id: p.place_id ?? p.google_place_id ?? p.place_name,
      place_name: p.place_name, category: (p.category ?? inferCategoryFromName(p.place_name) ?? "other") as any,
      city: p.city ?? "", address: p.address ?? "", latitude: p.latitude ?? 0, longitude: p.longitude ?? 0,
      rating: p.rating ?? 0, photo_url: resolveStored(p.photo_url) ?? "", vibe_tags: [], description: p.short_desc || "",
    } as MockPlace,
  });

  const remove = async (p: SavedPlace) => {
    try {
      await removeSavedPlaceById(p.id);
      invalidate();
      toast.success(`Usunięto „${p.place_name}"`);
    } catch (e: any) {
      console.error("[SavedPlaces] remove failed:", e?.message ?? e);
      toast.error("Nie udało się usunąć");
    }
  };

  const catLabel = (p: SavedPlace) => {
    const cat = p.category ?? inferCategoryFromName(p.place_name);
    return cat ? subcategoryLabelLocalized(cat) : "Miejsce";
  };

  return (
    <div className="space-y-3">
      {/* Naglowek: dodaj miejsce bezposrednio do prywatnej wishlisty */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {`Twoja prywatna lista miejsc na później.`}
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full bg-secondary text-secondary-foreground text-sm font-bold shrink-0 active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Dodaj miejsce
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : places.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12">
          <div className="h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center text-orange-500">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-black">Brak zapisanych miejsc</p>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              {`Zapisuj miejsca na później zakładką w eksploracji albo dodaj je tutaj.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <button onClick={() => openDetail(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80">
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                  <PlacePhoto pin={{ photo_url: p.photo_url, category: p.category }} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{p.place_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[p.city, catLabel(p)].filter(Boolean).join(" · ")}</p>
                </div>
              </button>
              <button
                onClick={() => remove(p)}
                aria-label="Usuń miejsce"
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => { if (!o) setDetailPin(null); }}
        place={detailPin?.place ?? null}
        city={detailPin?.city ?? ""}
        skipGoogleFetch={detailPin?.skip ?? false}
      />

      <AddPlaceSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        city={activeCity}
        onAdded={invalidate}
      />
    </div>
  );
}

// Bottom-sheet wyszukiwarki: dodaj miejsce (Google textsearch) do prywatnej "Do zobaczenia".
function AddPlaceSheet({ open, onOpenChange, city, onAdded }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  city: string;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ name: string; full_address: string; latitude: number; longitude: number; types: string[] }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingName, setAddingName] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => { if (open) { setQ(""); setResults([]); setSearching(false); setAddingName(null); } }, [open]);

  // Debounce textsearch (>= 2 znaki). Miasto doklejone do zapytania dla trafniejszych wynikow.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const id = ++reqId.current;
    const h = setTimeout(async () => {
      const hits = await forwardGeocodeWithTypes(`${term} ${city}`.trim());
      if (id !== reqId.current) return;
      setResults(hits.slice(0, 12));
      setSearching(false);
    }, 350);
    return () => clearTimeout(h);
  }, [q, city]);

  const add = async (r: { name: string; full_address: string; latitude: number; longitude: number; types: string[] }) => {
    if (!user || addingName) return;
    setAddingName(r.name);
    try {
      const { added } = await quickSavePlace(user.id, {
        place_name: r.name,
        category: categoryFromGoogleTypes(r.types),
        address: r.full_address ?? null,
        description: null,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        photo_url: null,
        place_id: null,
        google_place_id: null,
      }, city || null);
      onAdded();
      toast.success(added ? `Dodano „${r.name}"` : `„${r.name}" już jest zapisane`);
      onOpenChange(false);
    } catch (e: any) {
      console.error("[AddPlaceSheet] add failed:", e?.message ?? e);
      toast.error("Nie udało się dodać miejsca");
    } finally { setAddingName(null); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "82vh" }}>
        <div className="relative pt-3 pb-1 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button type="button" onClick={() => onOpenChange(false)} className="absolute top-2 right-3 h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform" aria-label="Zamknij">
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>
        <div className="px-5 pt-1 pb-2 shrink-0">
          <p className="text-xl font-black text-foreground mb-3">Dodaj miejsce</p>
          <div className="flex items-center gap-2 h-12 px-3.5 rounded-2xl border border-border bg-background">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder={city ? `Szukaj miejsca w ${city}` : "Szukaj miejsca"}
              className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-safe-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {results.map((r) => (
            <button
              key={r.name + r.latitude}
              onClick={() => add(r)}
              disabled={!!addingName}
              className="w-full flex items-center gap-3 py-3 text-left border-b border-border/40 active:opacity-80 disabled:opacity-50"
            >
              <div className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                <PlacePhoto pin={{ category: categoryFromGoogleTypes(r.types) }} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.full_address}</p>
              </div>
              {addingName === r.name ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" /> : <Plus className="h-5 w-5 text-foreground shrink-0" />}
            </button>
          ))}
          {!searching && q.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Brak wyników. Spróbuj innej nazwy.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
