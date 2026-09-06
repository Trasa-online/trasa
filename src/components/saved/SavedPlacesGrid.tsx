import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bookmark, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PlaceTile } from "@/components/profile/PlaceTile";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { resolveStored } from "@/components/PlacePhoto";
import { inferCategoryFromName, categoryIconSrc } from "@/lib/placeCategoryIcon";
import { fetchSavedPlaces, removeSavedPlaceById, addPlaceToList, type SavedPlace } from "@/lib/placeLists";
import AddSavedPlaceSheet from "@/components/saved/AddSavedPlaceSheet";
import { countryForCity } from "@/lib/tripCountries";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";

// Segment "Miejsca" w zakładce Zapisane (profil): siatka 3-kol zapisanych miejsc usera
// (agregat pozycji z prywatnych list "do zobaczenia"). Tap kafelka -> wizytówka.
export function SavedPlacesGrid() {
  const { t } = useTranslation("homeprofile");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailPin, setDetailPin] = useState<{ place: MockPlace; city: string; skip: boolean } | null>(null);
  // Arkusz "Dodaj nowe miejsce" (kraj + miasto + nazwa) - wejscie z pierwszego kafelka siatki.
  const [addOpen, setAddOpen] = useState(false);
  // Zapis miejsca z wizytowki (dolozenie do kuratorskiej listy) - bookmark na hero + CTA na dole.
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const [detailRaw, setDetailRaw] = useState<SavedPlace | null>(null);
  // Filtry listy ogolnej: kraj -> miasto ("" = wszystkie). Miasto miejsca zapisujemy przy POZYCJI
  // (discovery_items.city), a kraj wyliczamy z miasta (prosba Nat 2026-08-30).
  const [fCountry, setFCountry] = useState("");
  const [fCity, setFCity] = useState("");

  const invalidateSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["saved-places", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-place-names", user?.id] });
  };

  // #7: usun z zapisanych (odklik bookmarka). ZAWSZE toast + "Cofnij" (re-insert do tej samej listy).
  const handleUnsave = async (p: SavedPlace) => {
    await removeSavedPlaceById(p.id);
    invalidateSaved();
    // #1: pełna nazwa miejsca + miniaturka po lewej (zdjęcie usera albo ikona kategorii na peachy).
    const photo = resolveStored(p.photo_url);
    const thumb = photo
      ? <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
      : <span className="h-9 w-9 rounded-lg bg-[#fcede3] flex items-center justify-center shrink-0"><img src={categoryIconSrc(p.category)} alt="" className="w-1/2" /></span>;
    toast.success(p.place_name, {
      icon: thumb,
      description: t("grid.removed"),
      action: {
        label: "Cofnij",
        onClick: async () => {
          // Cofnij usuniecie = przywracamy WLASNY wpis, wiec notka wraca razem z nim.
          await addPlaceToList(p.collection_id, {
            place_name: p.place_name, category: p.category, address: p.address,
            latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
            google_place_id: p.google_place_id, rating: p.rating,
          });
          invalidateSaved();
        },
      },
    });
  };

  const { data: places = [], isLoading } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  // Okladki miejsc ze zdjec userow (place_photos) - zapisane miejsce czesto nie ma wlasnego
  // photo_url, a zdjecia dodane do miejsca w wyjezdzie/liscie zyja wlasnie tam. Bez tego kafelek
  // pokazywal sama ikone kategorii (zgloszenie Nat 2026-08-30).
  const coverKeys = useMemo(
    () => Array.from(new Set((places as SavedPlace[]).flatMap((p) => pinCoverKeys(p)))).filter(Boolean),
    [places],
  );
  const { data: coverMap } = useQuery({
    queryKey: ["saved-places-covers", coverKeys.length, coverKeys[0] ?? ""],
    enabled: coverKeys.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchPlacePhotosForKeys(coverKeys),
  });
  const coverFor = (p: SavedPlace) => pickPlaceCover(coverMap, pinCoverKeys(p));

  // Kraje/miasta WYSTEPUJACE w zapisanych (nie cala pula) - filtr pokazuje tylko to, co user ma.
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const p of places as SavedPlace[]) if (p.city) set.add(countryForCity(p.city));
    return [...set].sort((a, b) => a.localeCompare(b, "pl"));
  }, [places]);
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of places as SavedPlace[]) {
      if (!p.city) continue;
      if (fCountry && countryForCity(p.city) !== fCountry) continue;
      set.add(p.city);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pl"));
  }, [places, fCountry]);
  const filtered = useMemo(() => (places as SavedPlace[]).filter((p) => {
    if (fCity) return p.city === fCity;
    if (fCountry) return !!p.city && countryForCity(p.city) === fCountry;
    return true;
  }), [places, fCountry, fCity]);

  const openDetail = (p: SavedPlace) => { setDetailRaw(p); setDetailPin({
    skip: !p.place_id,
    city: p.city ?? "",
    place: {
      id: p.place_id ?? p.google_place_id ?? p.place_name,
      place_name: p.place_name, category: (p.category ?? inferCategoryFromName(p.place_name) ?? "other") as any,
      city: p.city ?? "", address: p.address ?? "", latitude: p.latitude ?? 0, longitude: p.longitude ?? 0,
      // Opis miejsca = TYLKO opis z bazy. Notka usera (short_desc) ma wlasna sekcje
      // "Od użytkowników" w wizytowce - nie udaje opisu miejsca (zgloszenie Nat 2026-08-28).
      rating: p.rating ?? 0, photo_url: resolveStored(p.photo_url) ?? resolveStored(coverFor(p)) ?? "", vibe_tags: [], description: "",
    } as MockPlace,
  }); };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  // Pusty stan wg Figmy ("Mój profil - zapisane - pusty stan"): duzy peachy bookmark + copy.
  if (places.length === 0) return (
    <div className="pt-16 pb-12 text-center px-8 flex flex-col items-center">
      <span aria-hidden className="mb-5 block h-28 w-28" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Zapisane.svg)", maskImage: "url(/Ikona_Zapisane.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
      <p className="text-lg font-bold text-foreground">{t("saved.empty_short")}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[280px] leading-relaxed">
        Zapisz miejsce bookmarkiem w{" "}zakładce{" "}
        <span className="font-semibold text-foreground">Eksploruj</span>{" "}
        lub u{" "}<span className="font-semibold text-foreground">{t("grid.other_user")}</span>
      </p>
      <button onClick={() => setAddOpen(true)}
        className="mt-6 h-11 px-5 rounded-2xl bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-[0.97] transition-transform">
        <Plus className="h-4 w-4" strokeWidth={2.5} /> {t("saved.add_new_place")}
      </button>
      <AddSavedPlaceSheet open={addOpen} onOpenChange={setAddOpen} onAdded={invalidateSaved} />
    </div>
  );

  return (
    <>
      {/* FILTRY listy ogolnej: kraj -> miasto. Natywne <select> = kolo wyboru iOS, zero customu.
          Pokazujemy tylko wtedy, gdy jest co filtrowac (>1 kraj / >1 miasto). */}
      {(countries.length > 1 || cities.length > 1) && (
        <div className="flex items-center gap-2 mb-2.5">
          {countries.length > 1 && (
            <select
              value={fCountry}
              onChange={(e) => { setFCountry(e.target.value); setFCity(""); }}
              className="flex-1 min-w-0 h-9 rounded-full bg-secondary text-secondary-foreground border-0 px-3.5 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="">Wszystkie kraje</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {cities.length > 1 && (
            <select
              value={fCity}
              onChange={(e) => setFCity(e.target.value)}
              className="flex-1 min-w-0 h-9 rounded-full bg-secondary text-secondary-foreground border-0 px-3.5 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="">Wszystkie miasta</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {(fCountry || fCity) && (
            <button onClick={() => { setFCountry(""); setFCity(""); }}
              className="shrink-0 h-9 px-3 rounded-full bg-muted text-[13px] font-bold text-muted-foreground active:scale-95 transition-transform">{t("grid.clear")}</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {/* Pierwszy kafelek = dodanie miejsca spoza aplikacji (kraj + miasto + nazwa). */}
        <button onClick={() => setAddOpen(true)}
          className="relative aspect-[2/3] rounded-2xl bg-[#fcede3] border border-dashed border-[#ef9d78]/70 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <span className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center">
            <Plus className="h-5 w-5 text-[#ef9d78]" strokeWidth={2.5} />
          </span>
          <span className="text-[11px] font-bold text-foreground/70 leading-tight px-2 text-center">{t("saved.add_new_place")}</span>
        </button>
        {filtered.map((p) => (
          <div key={p.id} className="relative">
            <button onClick={() => openDetail(p)} className="w-full active:opacity-90 transition-opacity">
              <PlaceTile showCity tile={{ photo_url: p.photo_url, _cover: coverFor(p), category: p.category, place_name: p.place_name, city: p.city }} />
            </button>
            {/* #7: bookmark (wypelniony) - odklik = usun z zapisanych + toast z cofnij */}
            <button onClick={(e) => { e.stopPropagation(); void handleUnsave(p); }} aria-label={t("grid.remove")}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Bookmark className="h-4 w-4 fill-[#F0A583] text-[#F0A583]" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Brak zapisanych miejsc{fCity ? ` w ${fCity}` : fCountry ? ` w kraju ${fCountry}` : ""}.
        </p>
      )}
      <AddSavedPlaceSheet open={addOpen} onOpenChange={setAddOpen} onAdded={invalidateSaved} />
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => { if (!o) setDetailPin(null); }}
        place={detailPin?.place ?? null}
        city={detailPin?.city ?? ""}
        skipGoogleFetch={detailPin?.skip ?? false}
        onLike={user && detailRaw ? () => setSavePlace({
          place_name: detailRaw.place_name, category: detailRaw.category, address: detailRaw.address,
          city: detailRaw.city, latitude: detailRaw.latitude, longitude: detailRaw.longitude,
          photo_url: detailRaw.photo_url, place_id: detailRaw.place_id,
        }) : undefined}
        saved
      />
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={detailRaw?.city ?? ""} />
    </>
  );
}
