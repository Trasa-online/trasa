import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import CityCountryPicker from "@/components/create/CityDrum";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { forwardGeocodeWithTypes } from "@/lib/googleMaps";
import { categoryFromGoogleTypes, inferCategoryFromName, categoryIconSrc } from "@/lib/placeCategoryIcon";
import { countryForCity } from "@/lib/tripCountries";
import { quickSavePlace } from "@/lib/placeLists";

// Arkusz "Dodaj nowe miejsce" do listy OGÓLNEJ (prywatna wishlista usera).
// Kraj + miasto (drum jak przy tworzeniu wyjazdu) zawężają wyszukiwarkę Google, a gdy miejsca
// nie ma w Google - można je dopisać ręcznie. Miasto zapisujemy przy POZYCJI (discovery_items.city),
// bo lista "Ogólne" jest globalna i sama miasta nie ma.

const CITY_KEY = "trasa_add_place_city";
const readLastCity = () => {
  try { return localStorage.getItem(CITY_KEY) || "Warszawa"; } catch { return "Warszawa"; }
};

type Hit = { name: string; full_address: string; latitude: number; longitude: number; types: string[] };

export default function AddSavedPlaceSheet({ open, onOpenChange, onAdded }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}) {
  const { t } = useTranslation("homeprofile");
  const { user } = useAuth();
  const [city, setCity] = useState<string>(readLastCity);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const reqId = useRef(0);
  const term = q.trim();

  useEffect(() => {
    if (!open) return;
    setQ(""); setResults([]); setSearching(false); setAdding(null); setPickerOpen(false);
    setCity(readLastCity());
  }, [open]);

  // Wyszukiwarka Google (debounce 350 ms, >= 2 znaki). Miasto doklejone do zapytania - dzięki
  // temu "Loving Hut" w Warszawie nie zwraca lokalu z drugiego końca świata.
  useEffect(() => {
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
  }, [term, city]);

  const save = async (place: { place_name: string; category: string | null; address: string | null; latitude: number | null; longitude: number | null }) => {
    if (!user || adding) return;
    setAdding(place.place_name);
    try {
      const { added } = await quickSavePlace(user.id, {
        place_name: place.place_name,
        category: place.category,
        address: place.address,
        city,
        latitude: place.latitude,
        longitude: place.longitude,
        photo_url: null,
        place_id: null,
        google_place_id: null,
      }, city || null);
      try { localStorage.setItem(CITY_KEY, city); } catch { /* noop */ }
      onAdded?.();
      haptics.success();
      toast.success(added ? `Dodano „${place.place_name}"` : t("add_saved.already", { name: place.place_name }));
      onOpenChange(false);
    } catch (e) {
      console.error("[AddSavedPlaceSheet] save failed:", e instanceof Error ? e.message : e);
      toast.error(t("add_saved.failed"));
    } finally { setAdding(null); }
  };

  const country = countryForCity(city);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-background" style={{ maxHeight: "88dvh" }}>
        <SheetTitle className="sr-only">Dodaj nowe miejsce</SheetTitle>
        <div className="relative pt-3 pb-1 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Zamknij"
            className="absolute top-2 right-3 h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform">
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        <div className="px-5 pt-1 pb-2 shrink-0">
          <p className="text-xl font-black text-foreground">Dodaj nowe miejsce</p>
          <p className="text-sm text-muted-foreground mt-0.5">{t("add_saved.goes_to_general")}</p>

          {/* Kraj + miasto: zwinięte do jednego wiersza, tap rozwija drum (jak przy wyjeździe). */}
          <button type="button" onClick={() => { haptics.light(); setPickerOpen((o) => !o); }}
            className="mt-3 w-full flex items-center gap-2.5 h-12 px-3.5 rounded-2xl border border-border bg-secondary/50 active:opacity-80 transition-opacity text-left">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0 truncate text-base font-semibold text-foreground">{city}</span>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">{country}</span>
            <span className="text-xs font-bold text-orange-600 shrink-0">{pickerOpen ? "Gotowe" : t("add_saved.change")}</span>
          </button>
          {pickerOpen && (
            <div className="pt-3">
              <CityCountryPicker city={city} onCityChange={setCity} compact />
            </div>
          )}

          {!pickerOpen && (
            <div className="mt-3 flex items-center gap-2 h-12 px-3.5 rounded-2xl border border-border bg-background">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Nazwa miejsca w ${city}`}
                className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
              {!searching && q && (
                <button type="button" onClick={() => setQ("")} aria-label={t("add_saved.clear")}
                  className="h-7 w-7 rounded-full bg-[#ebebeb]/70 flex items-center justify-center active:scale-90 transition-transform shrink-0">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
        </div>

        {!pickerOpen && (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ WebkitOverflowScrolling: "touch" }}>
            {results.map((r) => (
              <button
                key={`${r.name}-${r.latitude}`}
                onClick={() => save({
                  place_name: r.name, category: categoryFromGoogleTypes(r.types),
                  address: r.full_address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
                })}
                disabled={!!adding}
                className="w-full flex items-center gap-3 py-3 text-left border-b border-border/40 active:opacity-80 disabled:opacity-50"
              >
                <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
                  <img src={categoryIconSrc(categoryFromGoogleTypes(r.types))} alt="" className="w-1/2" draggable={false} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground truncate">{r.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{r.full_address}</span>
                </span>
                {adding === r.name
                  ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                  : <Plus className="h-5 w-5 text-foreground shrink-0" />}
              </button>
            ))}

            {/* Miejsca nie ma w Google (nowy lokal, mieszkanie znajomych) - dopisz ręcznie. */}
            {term.length >= 2 && !searching && (
              <button
                onClick={() => save({
                  place_name: term, category: inferCategoryFromName(term) ?? null,
                  address: city || null, latitude: null, longitude: null,
                })}
                disabled={!!adding}
                className="w-full flex items-center gap-3 py-3 text-left active:opacity-80 disabled:opacity-50"
              >
                <span className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5 text-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground truncate">{t("add_saved.add_term", { term })}</span>
                  <span className="block text-xs text-muted-foreground truncate">{t("add_saved.custom_in", { city })}</span>
                </span>
                {adding === term && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />}
              </button>
            )}

            {term.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-10 px-6 leading-relaxed">
                Wpisz nazwę miejsca, żeby poszukać go w{" "}{city}. Jeśli go nie{" "}znajdziesz, dopiszesz je ręcznie.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
