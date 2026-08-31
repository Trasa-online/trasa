import { useState, useEffect, useMemo, useRef } from "react";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { avatarSrc } from "@/lib/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { fetchBlockedIds } from "@/lib/blockedUsers";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, Globe, Sparkles, Pencil, Trash2, ChevronRight, ArrowRight, Eye, List, GalleryHorizontalEnd, Search, SlidersHorizontal, Plus, ArrowLeft, Images, Bookmark, Building2, Users, Navigation, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/platform";
import { useDebounce } from "@/hooks/useDebounce";
import { expandCity } from "@/lib/cities";
import { saveCollectionDb, unsaveCollectionDb } from "@/lib/savedCollections";
import { MAIN_CATEGORIES, getDbCategoriesFor } from "@/lib/categories";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import RouteMap from "@/components/RouteMap";
import { type MockPlace, fetchEnrichedPlace } from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format as fmtDate, parseISO as parseISODate, isValid as isValidDate } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
// Karta trasy w feedzie + helper mapki: wspoldzielone z profilem (zakladka Wyjazdy).
import TrasaBigCard, { buildMiniMapUrl, TRASA_CARD_H, type LatLng } from "@/components/home/TrasaBigCard";
import { ProfileFeedCard } from "@/components/profile/ProfileFeedCard";
import { shortRelativeTime } from "@/lib/relativeTime";
import { resolveStored } from "@/components/PlacePhoto";
import { COLLECTION_THEMES, getTheme, collectionKind } from "@/lib/collectionThemes";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { TrasaLogo } from "@/components/TrasaLogo";
import { CategoryIcon } from "@/components/CategoryIcon";
import CityFilterRow from "@/components/home/CityFilterRow";
import { toast } from "sonner";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { setGpsReference } from "@/lib/distanceReference";

type DiscoveryItem = {
  id: string;
  order_index: number;
  place_name: string;
  short_desc: string | null;
  photo_url: string | null;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;     // != null -> miejsce z bazy (tap -> wizytowka)
  category?: string | null;
  address?: string | null;
  rating?: number | null;       // gwiazdki Google (dla miejsca spoza bazy)
};

export type DiscoveryCollection = {
  id: string;
  title: string;
  city: string | null;
  description: string | null;
  category?: string | null;          // motyw zestawienia (collectionThemes)
  author_name: string;
  author_avatar: string | null;
  items: DiscoveryItem[];
  user_id?: string | null;
  author_home_city?: string | null;  // do badge "lokals poleca!"
  views_count?: number | null;
  saves_count?: number | null;
  plan_adds_count?: number | null;
  gallery_urls?: string[] | null;     // zdjecia wgrane przez autora (galeria zestawienia)
  likes_count?: number | null;
  updated_at?: string | null;         // "14m" na karcie listy w wyszukiwarce
  cover_url?: string | null;          // okladka listy (hero w /lista/:id) - reczny wybor autora
  list_cover_url?: string | null;     // miniatura na karcie w eksploracji (feed)
};

type PolecaneRoute = {
  kind: "route";
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
  ai_highlight: string | null;
  summary?: string | null;
  categories?: string[];
  routeTags?: string[];                // tagi CALEJ trasy (routes.tags) - priorytet nad kategoriami na karcie
  author_name: string;
  author_avatar: string | null;
  author_username?: string | null;     // @handle - do etykiety autora na karcie eksploracji
  placeCount?: number;
  avgRating?: number;                  // srednia ocena Google z pinow (0 = brak)
  pins?: LatLng[];                     // wspolrzedne pinow do mini-mapy na okladce
  participants?: (string | null)[];   // awatary uczestnikow trasy grupowej (bez hosta)
  user_id?: string | null;             // autor - do filtra zablokowanych userow
};

const CAT_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

// Miniaturka miejsca z placeholderem: brak zdjecia LUB blad ladowania (np. miejsce
// spoza bazy z wygaslym refem Google) -> ikona kategorii w szarym kwadracie (jak w
// natywnych appkach map). Domyslnie 56px; klasy nadpisywalne przez `className`.
function PlaceThumb({ url, category, name, className }: { url?: string | null; category?: string | null; name?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = className ?? "h-14 w-14 rounded-2xl shrink-0";
  if (!url || failed) {
    return (
      <div className={`${box} bg-[#fcede3] flex items-center justify-center`}>
        <CategoryIcon category={category} className="w-2/5 max-w-[56px] opacity-90" />
      </div>
    );
  }
  return <img src={url} alt={name ?? ""} onError={() => setFailed(true)} className={`${box} object-cover`} loading="lazy" />;
}

type PolecaneCreatorPlan = {
  kind: "creator";
  id: string;
  title: string;
  city: string;
  description: string | null;
  photo: string | null;
  creator_handle: string;
  creator_avatar_url: string | null;
  num_days: number | null;
  tags: string[] | null;
};

type PolecaneEntry = PolecaneRoute | PolecaneCreatorPlan;

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  "from-amber-200 to-orange-300",
  "from-rose-200 to-pink-300",
  "from-sky-200 to-blue-300",
  "from-emerald-200 to-teal-300",
  "from-violet-200 to-purple-300",
];

// Srednia ocena Google z listy miejsc (tylko z ocena > 0). 0 gdy brak.
function avgRatingOf(ratings: (number | null | undefined)[]): number {
  const rated = ratings.filter((r): r is number => typeof r === "number" && r > 0);
  if (!rated.length) return 0;
  return rated.reduce((s, r) => s + r, 0) / rated.length;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AuthorChip({ name, avatar }: { name: string; avatar: string | null }) {
  // Oficjalne trasy ("trasa") - realne logo Trasy zamiast placeholdera awatara.
  const isTrasa = ["trasa", "trasa.travel", "@trasa"].includes(name.trim().toLowerCase());
  return (
    <div className="flex items-center gap-1.5">
      {isTrasa ? (
        <TrasaLogo size={20} />
      ) : (
        <img src={avatarSrc(avatar)} alt={name} className="h-5 w-5 rounded-full object-cover bg-orange-100" />
      )}
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

function PlacePhoto({
  item,
  className,
  placeholderIdx = 0,
}: {
  item: DiscoveryItem;
  className?: string;
  placeholderIdx?: number;
}) {
  // Custom miejsca (spoza bazy) trzymaja surowy Google photo_reference - przepusc przez proxy
  // (resolveStored: pelny URL bez zmian, raw ref -> getPhotoUrl). Inaczej <img src=ref> = pusty kafel.
  const url = resolveStored(item.photo_url);
  return url ? (
    <img src={url} alt={item.place_name} className={`object-cover ${className ?? ""}`} loading="lazy" />
  ) : (
    // Brak zdjecia (nie-biznesowe / brak zdjecia usera) -> ikona kategorii na tle peach (jak globalny PlacePhoto).
    <div className={`bg-[#fcede3] flex items-center justify-center ${className ?? ""}`}>
      <CategoryIcon category={item.category} className="w-2/5 max-w-[56px] opacity-90" />
    </div>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────

// Galeria zestawienia = zdjecia wgrane przez AUTORA zestawienia (nie zdjecia miejsc).
// Toggle Miejsca|Galeria widoczny; galeria pokazuje col.gallery_urls albo pusty stan,
// dopoki krok dodawania zdjec w tworzeniu zestawienia nie jest gotowy.
const GALLERY_ENABLED = true;

export function CollectionDetail({ col, onClose, onAdopt }: { col: DiscoveryCollection; onClose: () => void; onAdopt?: (city: string | null, names: string[]) => void }) {
  const { t } = useTranslation("homefeed");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Widok miejsc: lista (domyslnie, jak w widoku trasy) lub karty (poziomy swiper).
  const [placeView, setPlaceView] = useState<"list" | "cards">("list");
  // Tryb tresci: miejsca (lista/karty) vs galeria (siatka zdjec) - toggle pod tytulem.
  const [contentView, setContentView] = useState<"places" | "gallery">("places");
  // Hero: okladka (zdjecie) vs mapa. Klik miniatury w rogu podmienia je miejscami.
  const [heroMode, setHeroMode] = useState<"photo" | "map">("photo");
  // Zapis calego zestawienia (bookmark w stopce) - lokalny, per przegladarka/urzadzenie.
  const [savedCol, setSavedCol] = useState<boolean>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")).has(col.id); } catch { return false; }
  });
  const toggleSaveCollection = () => {
    try {
      const key = "trasa_saved_collections";
      const set = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
      // Rownolegly zapis daty zapisania (do wyswietlenia w zakladce Zapisane).
      const dkey = "trasa_saved_collections_dates";
      const dates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem(dkey) || "{}"); } catch { return {}; } })();
      haptics.light();
      if (set.has(col.id)) { set.delete(col.id); delete dates[col.id]; setSavedCol(false); }
      else { set.add(col.id); dates[col.id] = new Date().toISOString(); setSavedCol(true); toast.success(t("toast.saved")); }
      localStorage.setItem(key, JSON.stringify([...set]));
      localStorage.setItem(dkey, JSON.stringify(dates));
    } catch { /* localStorage niedostepny - ignoruj */ }
  };
  const isOwner = !!user && user.id === col.user_id;
  const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
  const theme = getTheme(col.category);
  const isRoute = collectionKind(col.category) === "route";

  // Licznik wyswietlen: dedup per-widz w localStorage (wzor increment_route_views).
  useEffect(() => {
    const key = "trasa_seen_collections";
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
      if (!seen.has(col.id)) {
        seen.add(col.id);
        localStorage.setItem(key, JSON.stringify([...seen]));
        (supabase as any).rpc("increment_collection_views", { p_collection_id: col.id })
          .then(({ error }: any) => { if (error) console.warn("[DiscoveryFeed] increment_collection_views:", error.message); });
      }
    } catch (e) {
      console.warn("[DiscoveryFeed] view dedup failed:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col.id]);

  // Miejsce z bazy (place_id) -> otworz pelna wizytowke. Custom (place_id null) = nieklikalne.
  const openPlace = async (item: DiscoveryItem) => {
    if (!item.place_id) return;
    const { data } = await (supabase as any).from("places").select("*").eq("id", item.place_id).maybeSingle();
    if (!data) return;
    setDetailPlace({
      id: data.id, place_name: data.place_name, category: (data.category || "other"),
      city: data.city ?? col.city ?? "", address: data.address ?? "", latitude: data.latitude ?? 0, longitude: data.longitude ?? 0,
      rating: data.rating ?? 0, photo_url: data.photo_url ?? "", vibe_tags: data.vibe_tags ?? [], description: data.description ?? "",
    } as MockPlace);
  };

  const handleDelete = async () => {
    if (!isOwner || deleting) return;
    if (!confirm(t("confirm.delete_collection"))) return;
    setDeleting(true);
    await (supabase as any).from("discovery_collections").delete().eq("id", col.id);
    queryClient.invalidateQueries({ queryKey: ["explore-rankings"] });
    onClose();
  };

  // Piny do mapy-podgladu (RouteMap = Google, dziala natywnie; leaflet w iframe srcDoc
  // sie nie ladowal w WebView - stad bialy placeholder).
  // pin_order = indeks w kolejnosci listy (numerowanie PRZED filtrem coords), zeby numery
  // na mapie odpowiadaly numerom na liscie/kartach.
  const mapPins = col.items
    .map((i, idx) => ({ latitude: i.latitude, longitude: i.longitude, place_name: i.place_name, pin_order: idx }))
    .filter((i) => i.latitude && i.longitude);

  // Okladka hero = reczny cover_url autora; fallback do zdjecia pierwszego miejsca. + mini mapka.
  const coverItem = col.items.find((i) => i.photo_url) ?? col.items[0];
  const coverUrl = resolveStored(col.cover_url) ?? resolveStored(coverItem?.photo_url);
  const heroMap = buildMiniMapUrl(col.items);

  // "Uzyj tej trasy" - przejmij miejsca zestawienia do nowej trasy (swiper -> Dopasowania).
  // Najpierw pyta o date (przez onAdopt -> drawer w feedzie), potem laduje w PlanWizard.
  const adoptRoute = async () => {
    haptics.light();
    const names = col.items.map((i) => i.place_name).filter(Boolean);
    // Statystyka: dodanie zestawienia do wlasnego planu/wyjazdu.
    (supabase as any).rpc("increment_collection_plan_adds", { p_collection_id: col.id })
      .then(({ error }: any) => { if (error) console.warn("[DiscoveryFeed] increment_collection_plan_adds:", error.message); });
    // Tryb uproszczony: "Uzyj tego zestawienia" -> ekran kompozycji wyjazdu (nazwa+daty+
    // miejsca, prefill z zestawienia). Potwierdzenie tam tworzy wyjazd (createWyjazd).
    if (PLANNING_DISABLED) {
      onClose();
      navigate("/wyjazd/nowy", { state: {
        city: col.city,
        title: col.title,
        places: col.items.map((i) => ({
          place_name: i.place_name,
          category: i.category ?? null,
          address: i.address ?? null,
          latitude: i.latitude ?? null,
          longitude: i.longitude ?? null,
          photo_url: i.photo_url ?? null,
          place_id: i.place_id ?? null,
          rating: i.rating ?? null,
        })),
      } });
      return;
    }
    if (onAdopt) { onAdopt(col.city, names); return; }
    onClose();
    navigate("/plan", { state: { step: 4, city: col.city, date: new Date().toISOString(), likedPlaceNames: names } });
  };
  const planOwn = () => { onClose(); navigate("/plan", { state: { step: 2, city: col.city } }); };

  // ── Widok kart (poziomy swiper) - jak renderSwiper w widoku trasy (SharedRoute). ──
  const renderPlaceCards = () => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 pb-2">
      {col.items.map((item, idx) => {
        const tappable = !!item.place_id;
        const cat = item.category ?? "other";
        return (
          <div key={item.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col">
            <div
              {...(tappable ? { onClick: () => openPlace(item), role: "button" } : {})}
              className={`relative w-full aspect-[4/3] bg-muted ${tappable ? "active:opacity-90 transition-opacity cursor-pointer" : ""}`}
            >
              <PlacePhoto item={item} placeholderIdx={idx} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{idx + 1}</div>
            </div>
            <div className="px-4 pt-4 pb-4 flex-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <CategoryIcon category={cat} className="h-4 w-4 shrink-0" />{t(`cat.${cat}`, CAT_LABEL[cat] ?? t("cat.other"))}
              </span>
              <p className="text-base font-black leading-tight">{item.place_name}</p>
              {item.address && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.address}</p>}
              {item.short_desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{item.short_desc}</p>}
              {tappable && (
                <div className="mt-3 inline-flex items-center gap-0.5 text-xs font-bold text-primary">
                  {t("see")} <ChevronRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Widok listy - zwarte ponumerowane wiersze (redesign wg Figmy: czarny numerek
  // na okladce miniatury, badge kategorii). Bez per-miejsce zapisu. ──
  const renderPlaceList = () => (
    <div className="space-y-2">
      {col.items.map((item, idx) => {
        const tappable = !!item.place_id;
        const cat = item.category ?? "other";
        return (
          <div key={item.id} className="flex items-center gap-2 bg-secondary border border-border/40 shadow-sm rounded-2xl p-2.5">
            <button
              {...(tappable ? { onClick: () => openPlace(item) } : {})}
              className={`flex items-center gap-3 min-w-0 flex-1 text-left ${tappable ? "active:opacity-70 transition-opacity" : ""}`}
            >
              {/* Numer miejsca bezposrednio na okladce miniatury (wg Figmy) */}
              <div className="relative h-14 w-14 shrink-0">
                <PlacePhoto item={item} placeholderIdx={idx} className="h-14 w-14 rounded-xl" />
                <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center shadow-sm ring-1 ring-black/5">{idx + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight line-clamp-1">{item.place_name}</p>
                <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground">
                  {t(`cat.${cat}`, CAT_LABEL[cat] ?? t("cat.other"))}
                </span>
              </div>
              {tappable && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
            </button>
          </div>
        );
      })}
    </div>
  );

  // ── Galeria - zdjecia wgrane przez AUTORA zestawienia (col.gallery_urls). Siatka 2 kol.
  // Pusty stan dopoki autor nie doda zdjec (krok w tworzeniu zestawienia - wkrotce). ──
  const renderGallery = () => {
    const photos = (col.gallery_urls ?? []).map((u) => resolveStored(u)).filter(Boolean) as string[];
    if (photos.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/40 flex flex-col items-center text-center gap-2.5 px-6 py-10">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
            <Images className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold">{t("gallery_empty_title", "Brak zdjęć w galerii")}</p>
          <p className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">{t("gallery_empty_desc", "Autor nie dodał jeszcze zdjęć do tego zestawienia.")}</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        {photos.map((url, idx) => (
          <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
            <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  };

  const mapOnHero = heroMode === "map" && mapPins.length > 0;
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-t-2xl">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* HERO - okladka z gradientem, akcje overlay, mini mapka + galeria (wg Figmy).
            Rounding zapewnia root (overflow-hidden rounded-t-2xl) - hero bez wlasnego
            zaokraglenia, zeby okladka siegala samej gory bez bialego paska/crescentu. */}
        <div className="relative h-[240px] bg-muted overflow-hidden">
          {mapOnHero ? (
            <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={isRoute} />
          ) : coverUrl ? (
            <img src={coverUrl} alt={col.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center"><span className="text-4xl opacity-60">📍</span></div>
          )}
          {!mapOnHero && <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70 pointer-events-none" />}
          {/* Akcje: back (lewa) + [owner: edytuj/usun] + close (prawa) */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur text-white active:scale-90 transition-transform">
              <ArrowLeft className="h-4 w-4" />
            </SheetClose>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)} aria-label={t("aria.edit")} className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur text-white active:scale-90 transition-transform">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {isOwner && (
                <button onClick={handleDelete} disabled={deleting} aria-label={t("aria.delete")} className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur text-white active:scale-90 transition-transform disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 backdrop-blur text-white active:scale-90 transition-transform">
                <X className="h-4 w-4" />
              </SheetClose>
            </div>
          </div>
          {/* Galeria pill (lewy dol) - przelacza na widok galerii. Ukryta gdy galeria off. */}
          {GALLERY_ENABLED && col.items.some((i) => i.photo_url) && (
            <button onClick={() => setContentView("gallery")} aria-label={t("gallery", "Galeria")}
              className="absolute bottom-3 left-3 h-8 px-3.5 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur text-white text-xs font-semibold active:scale-95 transition-transform">
              <Images className="h-4 w-4" />
            </button>
          )}
          {/* Miniatura w rogu (prawy dol): klik PODMIENIA okladke z mapka i odwrotnie. */}
          {heroMap && mapPins.length > 0 && (
            <button
              type="button"
              onClick={() => { haptics.selection(); setHeroMode((m) => (m === "photo" ? "map" : "photo")); }}
              aria-label={mapOnHero ? "Pokaż zdjęcie" : "Pokaż mapę"}
              className="absolute bottom-3 right-3 h-14 w-14 rounded-xl overflow-hidden ring-2 ring-white/80 shadow-md bg-muted active:scale-95 transition-transform"
            >
              {mapOnHero ? (
                coverUrl
                  ? <img src={coverUrl} alt="" aria-hidden className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-lg">📍</div>
              ) : (
                <img src={heroMap} alt="" aria-hidden className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
              )}
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div className="px-4 pt-3.5 pb-4">
          {/* Meta: miasto + autor + licznik */}
          <div className="flex items-center gap-2 flex-wrap">
            {col.city && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{col.city}</span>}
            <AuthorChip name={col.author_name} avatar={col.author_avatar} />
            {isLocal && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5">{t("local_recommends")}</span>}
            {(col.views_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="h-3 w-3" />{col.views_count}</span>
            )}
          </div>
          {/* Tytul */}
          <h2 className="mt-2 text-lg font-black leading-tight">{col.title}</h2>
          {col.description && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{col.description}</p>}

          {/* Toggle: Miejsca | Galeria (wysrodkowany). Ukryty gdy galeria off. */}
          {GALLERY_ENABLED && (
            <div className="mt-4">
              <div className="flex rounded-full bg-muted p-0.5">
                <button onClick={() => setContentView("places")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-medium transition-colors ${contentView === "places" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <MapPin className="h-4 w-4" />{t("places")}
                </button>
                <button onClick={() => setContentView("gallery")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-sm font-medium transition-colors ${contentView === "gallery" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <Images className="h-4 w-4" />{t("gallery", "Galeria")}
                </button>
              </div>
            </div>
          )}

          {GALLERY_ENABLED && contentView === "gallery" ? (
            <div className="mt-4">{renderGallery()}</div>
          ) : (
            <>
              {col.items.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isRoute ? t("route_plan") : t("places")}</p>
                    <div className="flex rounded-full bg-muted p-0.5">
                      <button onClick={() => setPlaceView("list")} aria-label={t("aria.list_view")}
                        className={`px-2.5 py-1.5 rounded-full transition-colors ${placeView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                        <List className="h-4 w-4" />
                      </button>
                      <button onClick={() => setPlaceView("cards")} aria-label={t("aria.cards_view")}
                        className={`px-2.5 py-1.5 rounded-full transition-colors ${placeView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                        <GalleryHorizontalEnd className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {placeView === "cards" ? renderPlaceCards() : renderPlaceList()}
                </div>
              )}

              {mapPins.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("map_heading", "Mapa")}</p>
                  <div className="relative h-52 rounded-2xl overflow-hidden border border-border/40">
                    <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={isRoute} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky footer: Uzyj tego zestawienia + zapis (bookmark) */}
      <div className="shrink-0 border-t border-border/20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-background flex items-center gap-2">
        <button
          onClick={adoptRoute}
          className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
        >
          {t("use_collection", "Użyj tego zestawienia")} <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={toggleSaveCollection}
          aria-label={t("aria.save_collection", "Zapisz zestawienie")}
          className="h-12 w-12 shrink-0 rounded-2xl bg-muted flex items-center justify-center active:scale-95 transition-transform"
        >
          <Bookmark className={`h-5 w-5 ${savedCol ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </div>

      {detailPlace && (
        <PlaceSwiperDetail
          open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace}
          city={col.city ?? undefined} skipGoogleFetch={false}
          onLike={() => setSavePlace({
            place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
            city: detailPlace.city || col.city || null, latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
            photo_url: detailPlace.photo_url || null, place_id: null,
          })}
        />
      )}
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={col.city ?? ""} />
    </div>
  );
}

function CreatorPlanDetail({ plan }: { plan: PolecaneCreatorPlan }) {
  const { t } = useTranslation("homefeed");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-border/20 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight line-clamp-2">{plan.title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-orange-500" />
            <span>@{plan.creator_handle}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{plan.city}</span>
            {plan.num_days && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{plan.num_days} {plan.num_days === 1 ? t("day") : t("days")}</span>
              </>
            )}
          </div>
        </div>
        <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90 transition-transform shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto">
        {plan.photo && (
          <div className="w-full aspect-[16/10] overflow-hidden bg-muted">
            <img src={plan.photo} alt={plan.title} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="px-4 py-3 space-y-3">
          {plan.description && (
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.description}</p>
          )}
          {plan.tags && plan.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.tags.map((tag) => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-orange-700 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

// Skeletony 1:1 z realna trescia Eksploruj (RouteCardH poziome + RouteCardV pionowe),
// zeby przy zaladowaniu nie bylo skoku layoutu.
function RouteCardHSkeleton() {
  return (
    <div className="shrink-0 w-[46vw] max-w-[200px] animate-pulse">
      <div className="aspect-[3/4] rounded-2xl bg-muted" />
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

function RouteCardVSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="aspect-[16/9] rounded-2xl bg-muted" />
      <div className="mt-2.5 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-2/3 bg-muted rounded" />
        <div className="flex gap-1.5 pt-0.5">
          <div className="h-4 w-14 bg-muted rounded-full" />
          <div className="h-4 w-16 bg-muted rounded-full" />
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="h-5 w-5 rounded-full bg-muted" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Rows ───────────────────────────────────────────────────────────────────────

function MotywyRow({
  collections,
  onOpen,
}: {
  collections: DiscoveryCollection[];
  onOpen: (col: DiscoveryCollection) => void;
}) {
  const { t } = useTranslation("homefeed");
  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">{t("popular_themes_warsaw")}</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory px-1 pb-1">
        {collections.map((col, idx) => {
          const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
          const photoUrl = resolveStored(col.list_cover_url) ?? resolveStored(photoItem?.photo_url);
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[88px] flex flex-col items-center gap-1.5 snap-start active:scale-95 transition-transform"
            >
              <div className="h-[88px] w-[88px] rounded-full overflow-hidden ring-1 ring-border/40">
                {photoUrl ? (
                  <img src={photoUrl} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-2xl opacity-60">📍</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] font-semibold text-center leading-tight line-clamp-2 w-[88px]">
                {col.title}
              </p>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

// Polecajki tworzone przez uzytkownikow (discovery_collections z user_id != null).
// Pokazujemy karty w formacie zblizonym do PolecaneRow (hero 16:10 + tytul + miasto
// + autor + licznik miejsc). Tap otwiera CollectionDetail Sheet jak fallback.
function UserPolecajkiRow({
  collections,
  onOpen,
}: {
  collections: DiscoveryCollection[];
  onOpen: (col: DiscoveryCollection) => void;
}) {
  const { t } = useTranslation("homefeed");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  // Tylko motywy faktycznie obecne w zestawieniach (nie pokazujemy pustych filtrow).
  const presentThemes = COLLECTION_THEMES.filter((t) => collections.some((c) => c.category === t.id));
  const filtered = themeFilter ? collections.filter((c) => c.category === themeFilter) : collections;

  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">{t("collections")}</p>
      {presentThemes.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
          <button
            onClick={() => setThemeFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${themeFilter === null ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}
          >
            {t("all")}
          </button>
          {presentThemes.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeFilter((prev) => (prev === t.id ? null : t.id))}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${themeFilter === t.id ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mr-4">
        {filtered.map((col, idx) => {
          const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
          const photoUrl = resolveStored(col.list_cover_url) ?? resolveStored(photoItem?.photo_url);
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          const placesCount = col.items.length;
          const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
          const theme = getTheme(col.category);
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted relative">
                {photoUrl ? (
                  <img src={photoUrl} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-3xl opacity-60">📍</span>
                  </div>
                )}
                {placesCount > 0 && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white">
                    {t("places_count", { count: placesCount })}
                  </div>
                )}
              </div>
              <div className="px-3.5 py-2.5 space-y-1.5">
                {/* Badge motywu (kolor wg motywu) + miasto po prawej, na tej samej wysokosci */}
                <div className="flex items-center justify-between gap-2">
                  {theme ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge}`}>{theme.emoji} {theme.label}</span>
                  ) : <span />}
                  {col.city && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      <MapPin className="h-3 w-3" />{col.city}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <AuthorChip name={col.author_name} avatar={col.author_avatar} />
                  {isLocal && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5">{t("local_recommends")}</span>}
                </div>
              </div>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

function PolecaneRow({
  entries,
  onCreatorOpen,
}: {
  entries: PolecaneEntry[];
  onCreatorOpen: (plan: PolecaneCreatorPlan) => void;
}) {
  const { t } = useTranslation("homefeed");
  const navigate = useNavigate();

  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">{t("recommended")}</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
        {entries.map((entry) => {
          const photo = entry.photo ?? getRandomPinPlaceholder(entry.id);
          const onClick = () => {
            if (entry.kind === "route") {
              navigate(`/route/${entry.id}`);
            } else {
              onCreatorOpen(entry);
            }
          };
          return (
            <button
              key={`${entry.kind}-${entry.id}`}
              onClick={onClick}
              className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                <img
                  src={photo}
                  alt={entry.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fb");
                  }}
                />
              </div>
              <div className="px-3 py-2.5 space-y-1.5">
                <p className="font-bold text-sm leading-snug line-clamp-2">{entry.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{entry.city ?? "-"}</span>
                  </div>
                  {entry.kind === "route" ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Globe className="h-3 w-3" />
                      {t("route")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-orange-600 font-semibold shrink-0">
                      <Sparkles className="h-3 w-3" />
                      {t("creator")}
                    </span>
                  )}
                </div>
                {entry.kind === "route" ? (
                  <AuthorChip name={entry.author_name} avatar={entry.author_avatar} />
                ) : (
                  <AuthorChip name={`@${entry.creator_handle}`} avatar={entry.creator_avatar_url} />
                )}
              </div>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

// ── Redesign: trasy uzytkownikow (Najnowsze + w Warszawie) ─────────────────────

// Ranking kategorii dla okladki: najbardziej "pocztowkowe" pierwsze.
const CAT_RANK: Record<string, number> = {
  viewpoint: 0, monument: 1, park: 2, gallery: 3, museum: 4, experience: 5,
  market: 6, shopping: 7, club: 8, bar: 9, cafe: 10, restaurant: 11, walk: 12,
};

// Wzbogaca wiersze routes o okladke (najatrakcyjniejsze zdjecie miejsca),
// autora (profil) i liczbe miejsc. Reuzywane przez obie sekcje.
async function enrichRouteRows(routes: any[]): Promise<PolecaneRoute[]> {
  if (!routes.length) return [];
  const routeIds = routes.map((r) => r.id);
  const photoMap = new Map<string, string>();
  const userPhotoMap = new Map<string, string>(); // pierwsze zdjecie usera z pinow (user_photo_urls)
  const countMap = new Map<string, number>();
  const catMap = new Map<string, string[]>(); // 3 glowne kategorie (wg pin_order)
  const ratingMap = new Map<string, number[]>(); // oceny Google pinow (do sredniej)
  const pinsMap = new Map<string, LatLng[]>();    // wspolrzedne pinow (do mini-mapy)
  const { data: pinRows } = await (supabase as any)
    .from("pins")
    .select("route_id, photo_url, image_url, images, user_photo_urls, category, pin_order, rating, latitude, longitude")
    .in("route_id", routeIds)
    .order("pin_order", { ascending: true });
  const best = new Map<string, { url: string; rank: number; order: number }>();
  for (const p of (pinRows ?? []) as any[]) {
    countMap.set(p.route_id, (countMap.get(p.route_id) ?? 0) + 1);
    if (p.category) {
      const arr = catMap.get(p.route_id) ?? [];
      if (arr.length < 3 && !arr.includes(p.category)) { arr.push(p.category); catMap.set(p.route_id, arr); }
    }
    if (typeof p.rating === "number" && p.rating > 0) {
      const arr = ratingMap.get(p.route_id) ?? []; arr.push(p.rating); ratingMap.set(p.route_id, arr);
    }
    if (p.latitude != null && p.longitude != null) {
      const arr = pinsMap.get(p.route_id) ?? []; arr.push({ latitude: p.latitude, longitude: p.longitude }); pinsMap.set(p.route_id, arr);
    }
    if (!userPhotoMap.has(p.route_id) && Array.isArray(p.user_photo_urls) && p.user_photo_urls.length) {
      const u = resolveStored(p.user_photo_urls.find(Boolean));
      if (u) userPhotoMap.set(p.route_id, u);
    }
    const url = resolveStored((Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.user_photo_urls) && p.user_photo_urls[0]) || p.photo_url || p.image_url);
    if (!url) continue;
    const rank = CAT_RANK[p.category as string] ?? 50;
    const order = p.pin_order ?? 999;
    const cur = best.get(p.route_id);
    if (!cur || rank < cur.rank || (rank === cur.rank && order < cur.order)) {
      best.set(p.route_id, { url, rank, order });
    }
  }
  for (const [rid, v] of best) photoMap.set(rid, v.url);

  const userIds = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
  const profileMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profiles } = await (supabase as any)
      .from("profiles").select("id, username, first_name, avatar_url").in("id", userIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }

  // Uczestnicy sesji grupowych (awatary obok hosta na kafelku eksploracji).
  const sessionIds = [...new Set(routes.map((r) => r.group_session_id).filter(Boolean))];
  const membersBySession = new Map<string, string[]>();
  if (sessionIds.length) {
    const { data: members } = await (supabase as any)
      .from("group_session_members").select("session_id, user_id").in("session_id", sessionIds);
    const memberIds = new Set<string>();
    for (const m of members ?? []) {
      if (!membersBySession.has(m.session_id)) membersBySession.set(m.session_id, []);
      membersBySession.get(m.session_id)!.push(m.user_id);
      memberIds.add(m.user_id);
    }
    const missing = [...memberIds].filter((id) => !profileMap.has(id));
    if (missing.length) {
      const { data: mp } = await (supabase as any).from("profiles").select("id, avatar_url").in("id", missing);
      for (const p of mp ?? []) if (!profileMap.has(p.id)) profileMap.set(p.id, p);
    }
  }

  // Wspolne zdjecia grupowe (Faza 3) - okladka kafelka dla tras grupowych (pierwsze zdjecie sesji).
  const groupCoverBySession = new Map<string, string>();
  if (sessionIds.length) {
    const { data: gphotos } = await (supabase as any)
      .from("group_trip_photos").select("session_id, url").in("session_id", sessionIds).order("created_at", { ascending: true });
    for (const g of gphotos ?? []) if (!groupCoverBySession.has(g.session_id)) groupCoverBySession.set(g.session_id, g.url);
  }

  return routes.map((r): PolecaneRoute => {
    const prof = profileMap.get(r.user_id);
    const anon = r.share_anonymous === true;
    return {
      user_id: r.user_id ?? null,
      kind: "route", id: r.id, title: r.title, city: r.city,
      // Miniatura eksploracji = OSOBNA okladka (list_cover_url), niezalezna od okladki trasy
      // (cover_url). Kolejnosc: miniatura -> okladka trasy -> zdjecie usera (review_photos[0]) ->
      // najlepsze zdjecie pinu -> zdjecie usera z pinow -> null (placeholder).
      photo: resolveStored(r.list_cover_url)
        ?? resolveStored(r.cover_url)
        ?? (r.group_session_id ? resolveStored(groupCoverBySession.get(r.group_session_id)) : null)
        ?? resolveStored(Array.isArray(r.review_photos) ? r.review_photos.find((u: any) => typeof u === "string" && u.trim()) : null)
        ?? photoMap.get(r.id)
        ?? userPhotoMap.get(r.id)
        ?? null,
      ai_highlight: r.ai_highlight ?? null,
      summary: r.ai_summary ?? null,
      categories: catMap.get(r.id) ?? [],
      routeTags: Array.isArray(r.tags) ? r.tags : [],
      author_name: anon ? i18n.t("author_anon", { ns: "homefeed" }) : (prof?.first_name || prof?.username || i18n.t("author_default", { ns: "homefeed" })),
      author_avatar: anon ? null : (prof?.avatar_url ?? null),
      author_username: anon ? null : (prof?.username ?? null),
      placeCount: countMap.get(r.id) ?? 0,
      avgRating: avgRatingOf(ratingMap.get(r.id) ?? []),
      pins: pinsMap.get(r.id) ?? [],
      participants: r.group_session_id
        ? (membersBySession.get(r.group_session_id) ?? [])
            .filter((uid: string) => uid !== r.user_id)
            .map((uid: string) => (profileMap.get(uid)?.avatar_url ?? null))
        : [],
    };
  });
}

// Karta pozioma (Najnowsze trasy) - portretowa okladka z tytulem na zdjeciu.
function RouteCardH({ route, onClick }: { route: PolecaneRoute; onClick: () => void }) {
  const photo = route.photo ?? getRandomPinPlaceholder(route.id);
  return (
    <button onClick={onClick} className="shrink-0 w-[46vw] max-w-[200px] snap-start text-left active:scale-[0.97] transition-transform">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-sm">
        <img src={photo} alt={route.title} loading="lazy" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(route.id + "_fb"); }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-sm">{route.title}</p>
          <p className="text-white/85 text-[11px] mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />{route.city ?? "-"}
            {route.placeCount ? <span className="opacity-70">· {route.placeCount}</span> : null}
          </p>
        </div>
      </div>
      <div className="mt-2 px-0.5"><AuthorChip name={route.author_name} avatar={route.author_avatar} /></div>
    </button>
  );
}

// Karta pionowa (Trasy w Warszawie) - duza okladka + tytul + autor pod spodem.
function RouteCardV({ route, onClick }: { route: PolecaneRoute; onClick: () => void }) {
  const { t } = useTranslation("homefeed");
  const photo = route.photo ?? getRandomPinPlaceholder(route.id);
  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-muted shadow-sm">
        <img src={photo} alt={route.title} loading="lazy" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(route.id + "_fb"); }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {route.placeCount ? (
          <span className="absolute top-3 left-3 bg-black/45 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1">
            <MapPin className="h-3 w-3" />{t("places_count", { count: route.placeCount })}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5">
        <p className="font-black text-base leading-snug line-clamp-2">{route.title}</p>
        {(route.summary || route.ai_highlight) && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-1">{route.summary || route.ai_highlight}</p>
        )}
        {route.categories && route.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {route.categories.slice(0, 3).map((c) => (
              <span key={c} className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {t(`cat.${c}`, CAT_LABEL[c] ?? c)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2.5"><AuthorChip name={route.author_name} avatar={route.author_avatar} /></div>
      </div>
    </button>
  );
}

// ── Duza karta feedu (redesign wg referencji) ──────────────────────────────────
// Pionowa, pelnej szerokosci. Okladka 16:10 z: badge kategorii + miasto (bez km),
// mini mapka Google w rogu. Pod spodem wiersz meta (mala pomaranczowa gwiazdka +
// srednia Google, liczba miejsc z ikonka), mocny tytul, notka rozwijana po "+".
// Reuzywana przez zestawienia i trasy (adaptery ponizej).
function BigCard({
  id, photo, categoryKey, categoryLabel, categoryClass, city,
  placeCount = 0, title, pins = [], note, authorName, authorAvatar, localBadge = false, onClick,
}: {
  id: string;
  photo: string | null;
  categoryKey?: string;
  categoryLabel?: string;
  categoryClass?: string;   // klasy koloru badge (motyw) - inaczej neutralny szklany
  city?: string | null;
  avgRating?: number;
  placeCount?: number;
  title: string;
  pins?: LatLng[];
  note?: string | null;
  authorName: string;
  authorAvatar: string | null;
  localBadge?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("homefeed");
  const [noteOpen, setNoteOpen] = useState(false);
  const cover = photo ?? getRandomPinPlaceholder(id);
  const miniMap = buildMiniMapUrl(pins);

  return (
    <div className="w-full">
      <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
        <div className="relative aspect-[16/10] rounded-3xl overflow-hidden bg-muted shadow-sm">
          <img src={cover} alt={title} loading="lazy" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(id + "_fb"); }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />
          {/* Badge kategorii (motyw, gdy podany) + miasto (bez ikony pina) - lewy gorny rog */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {categoryLabel && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${categoryClass ?? "bg-black/55 backdrop-blur-sm text-white"}`}>
                {categoryKey ? <CategoryIcon category={categoryKey} className="h-4 w-4 shrink-0" /> : null}{categoryLabel}
              </span>
            )}
            {city && (
              <span className="inline-flex items-center rounded-full bg-black/45 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                {city}
              </span>
            )}
          </div>
          {/* Mini mapka Google (prawy dolny rog) - jak w referencji */}
          {miniMap && (
            <div className="absolute bottom-3 right-3 h-16 w-16 rounded-2xl overflow-hidden ring-2 ring-white/85 shadow-md bg-muted">
              <img src={miniMap} alt="" aria-hidden loading="lazy" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
            </div>
          )}
        </div>
      </button>

      {/* Wiersz meta: liczba miejsc (ocena-gwiazdki usunieta z aplikacji). */}
      <div className="mt-2.5 flex items-center gap-3 text-sm">
        {placeCount > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-semibold">{t("places_count", { count: placeCount })}</span>
          </span>
        )}
      </div>

      {/* Tytul - mocna hierarchia */}
      <button onClick={onClick} className="block w-full text-left">
        <p className="mt-1 text-lg font-black leading-tight line-clamp-2">{title}</p>
      </button>

      {/* Autor + toggle notki ("+") */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <AuthorChip name={authorName} avatar={authorAvatar} />
          {localBadge && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5 shrink-0">{t("local_recommends")}</span>}
        </div>
        {note && (
          <button
            onClick={() => setNoteOpen((v) => !v)}
            aria-expanded={noteOpen}
            className="shrink-0 flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-xs font-bold active:scale-95 transition-transform"
          >
            <Plus className={`h-3.5 w-3.5 transition-transform ${noteOpen ? "rotate-45" : ""}`} />
            {t("note_toggle")}
          </button>
        )}
      </div>
      {note && noteOpen && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{note}</p>
      )}
    </div>
  );
}

// Adapter: zestawienie (kolekcja) -> BigCard.
function CollectionBigCard({ col, onOpen }: { col: DiscoveryCollection; onOpen: (col: DiscoveryCollection) => void }) {
  const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
  const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
  return (
    <BigCard
      id={col.id}
      photo={resolveStored(col.list_cover_url) ?? resolveStored(photoItem?.photo_url) ?? null}
      city={col.city}
      avgRating={avgRatingOf(col.items.map((i) => i.rating))}
      placeCount={col.items.length}
      title={col.title}
      pins={col.items}
      note={col.description}
      authorName={col.author_name}
      authorAvatar={col.author_avatar}
      localBadge={isLocal}
      onClick={() => onOpen(col)}
    />
  );
}

// Adapter: trasa -> BigCard. Kategoria = pierwsza kategoria miejsc z trasy.
function RouteBigCard({ route, onClick }: { route: PolecaneRoute; onClick: () => void }) {
  const { t } = useTranslation("homefeed");
  const cat = route.categories?.[0];
  return (
    <BigCard
      id={route.id}
      photo={route.photo}
      categoryKey={cat ?? undefined}
      categoryLabel={cat ? t(`cat.${cat}`, CAT_LABEL[cat] ?? cat) : undefined}
      city={route.city}
      avgRating={route.avgRating ?? 0}
      placeCount={route.placeCount ?? 0}
      title={route.title}
      pins={route.pins ?? []}
      note={route.summary || route.ai_highlight}
      authorName={route.author_name}
      authorAvatar={route.author_avatar}
      onClick={onClick}
    />
  );
}

// Wysokosc pelnoekranowej karty feedu = viewport - topbar(3.25rem) - BottomNav(4rem) -
// 16px odstepu do nawigacji - safe-area (gora+dol). Ten sam wzor uzywa karta Miejsc (swiper),
// zeby oba widoki mialy identyczny rozmiar wizytowki i 16px do BottomNava na kazdym iPhonie.
// ── Main export ────────────────────────────────────────────────────────────────

// Sekcja "Zestawienia miejsc" w Eksploruj - AKTYWNA (launch feature).
// Aktywne miasta (z CityPicker) - filtr miasta na eksploracji.
const ACTIVE_CITIES = ["Warszawa", "Gdańsk", "Sopot", "Gdynia", "Trójmiasto"];
// Escape znakow specjalnych ilike (%,_,\) - bezpieczne wyszukiwanie.
const escapeLike = (v: string) => v.replace(/[%_\\]/g, "\\$&");

// Hydratacja kolekcji: dociagnij items + home_city autora (badge "lokals poleca!").
// Wspoldzielone przez explore-rankings i wyszukiwarke.
async function hydrateCollections(cols: any[]): Promise<DiscoveryCollection[]> {
  if (!cols?.length) return [];
  const ids = cols.map((c: any) => c.id);
  const { data: items } = await (supabase as any)
    .from("discovery_items")
    .select("id, collection_id, order_index, place_name, short_desc, photo_url, latitude, longitude, place_id, category, address, rating")
    .in("collection_id", ids)
    .order("order_index", { ascending: true });
  const userIds = [...new Set(cols.map((c: any) => c.user_id).filter(Boolean))];
  const homeMap = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, home_city").in("id", userIds);
    for (const p of profs ?? []) homeMap.set(p.id, p.home_city ?? null);
  }
  return cols.map((col: any): DiscoveryCollection => ({
    ...col,
    author_home_city: homeMap.get(col.user_id) ?? null,
    items: (items ?? []).filter((i: any) => i.collection_id === col.id),
  }));
}

// Listy miejsc (dawne "zestawienia") w EKSPLORACJI WYLACZONE (2026-08-09, decyzja Nat):
// opublikowane listy widoczne TYLKO na profilu usera ("Moje listy"), NIE w feedzie/wyszukiwarce
// eksploracji. Flaga = master switch: gatuje feed (userPolecajki), wyszukiwarke (collections)
// i segment typu (Wszystko|Trasy|Listy). Ustaw true, by wrocic listy do eksploracji.
const SHOW_ZESTAWIENIA = false;

// Szybkie skroty w wyszukiwarce ("Biezace polozenie" + "Zapisane miejsca") - WYLACZONE
// (2026-07-27): dopoki scroller nie ma miejsc, nie maja sensu. Ustaw true, by przywrocic.
const SHOW_SEARCH_SHORTCUTS = false;

// Kompaktowy kafelek zapisanej trasy/zestawienia (spojny ze stylem kart Wyjazdow):
// miniatura + mini-mapka w rogu, tytul, miasto, liczba miejsc, bookmark = usun z zapisanych.
function SavedTile({ id, photo, title, city, placeCount, pins, onOpen, onUnsave }: {
  id: string; photo: string | null; title: string; city?: string | null;
  placeCount: number; pins: LatLng[]; onOpen: () => void; onUnsave: () => void;
}) {
  const cover = photo ?? getRandomPinPlaceholder(id);
  const miniMap = buildMiniMapUrl(pins);
  const countLabel = placeCount > 0
    ? `${placeCount} ${placeCount === 1 ? "miejsce" : placeCount < 5 ? "miejsca" : "miejsc"}`
    : null;
  return (
    <div
      onClick={onOpen}
      className="relative w-full flex gap-3.5 p-2.5 rounded-3xl bg-card border border-border/50 text-left active:scale-[0.99] transition-transform cursor-pointer"
    >
      <div className="relative w-[118px] shrink-0 aspect-[4/5] rounded-2xl overflow-hidden bg-muted">
        <img src={cover} alt="" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(id + "_fb"); }} />
        {miniMap && (
          <div className="absolute bottom-2 right-2 h-[46px] w-[46px] rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
            <img src={miniMap} alt="" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col py-0.5 pr-0.5">
        <div className="flex items-start gap-2">
          <p className="flex-1 min-w-0 text-lg font-bold leading-tight text-foreground line-clamp-2">{title}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onUnsave(); }}
            aria-label="Usuń z zapisanych"
            className="shrink-0 -mr-0.5 -mt-0.5 h-8 w-8 flex items-center justify-center rounded-full text-primary active:scale-90 transition-transform"
          >
            <Bookmark className="h-5 w-5 fill-primary text-primary" strokeWidth={2} />
          </button>
        </div>
        {city && <p className="mt-1 text-sm text-muted-foreground truncate">{city}</p>}
        {countLabel && (
          <div className="mt-auto pt-2">
            <span className="text-sm font-medium text-muted-foreground">{countLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SavedRoutes ─────────────────────────────────────────────────────────────────
// Trasy ZAPISANE przez usera (saved_routes + zapisane zestawienia z localStorage),
// pokazywane jako KAFELKI. Zakladka "Zapisane" (bottom nav). Tap otwiera trase
// (/route/:id) lub wizytowke zestawienia, bookmark usuwa z zapisanych.
export function SavedRoutes({ city, hideEmptyState }: { city?: string; hideEmptyState?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1) Zapisane TRASY (tabela saved_routes)
  const { data: routeData, isLoading: routesLoading } = useQuery({
    queryKey: ["saved-routes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: saved } = await (supabase as any)
        .from("saved_routes").select("route_id, created_at")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      const rows0 = (saved ?? []) as { route_id: string; created_at: string | null }[];
      const ids = rows0.map((r) => r.route_id);
      const dates: Record<string, string> = {};
      rows0.forEach((r) => { if (r.created_at) dates[r.route_id] = r.created_at; });
      if (!ids.length) return { list: [] as PolecaneRoute[], dates };
      const { data: rows } = await (supabase as any)
        .from("routes")
        .select("id, title, city, ai_highlight, ai_summary, user_id, created_at, published_at, views, share_anonymous, cover_url, list_cover_url, review_photos, group_session_id, tags")
        .in("id", ids);
      const list = await enrichRouteRows(rows ?? []);
      return { list, dates };
    },
    staleTime: 30_000,
  });
  const routes = routeData?.list ?? [];
  const routeDates = routeData?.dates ?? {};

  const unsaveRoute = async (id: string) => {
    if (!user) return;
    await (supabase as any).from("saved_routes").delete().eq("user_id", user.id).eq("route_id", id);
    queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    toast(i18n.t("toast.removed_saved", { ns: "homefeed", defaultValue: "Usunięto z zapisanych" }));
  };


  const cityOk = (c?: string | null) => !city || city === "all" || (c ?? "").toLowerCase().startsWith(city.toLowerCase());

  // Zunifikowana lista (trasy + zestawienia) posortowana po dacie zapisu (najnowsze na górze).
  const rows: { key: string; savedAt: string; el: JSX.Element }[] = [];
  routes.filter((r) => cityOk(r.city)).forEach((r) => {
    rows.push({
      key: `route-${r.id}`, savedAt: routeDates[r.id] ?? "",
      el: (
        <SavedTile key={`route-${r.id}`} id={r.id} photo={r.photo} title={r.title} city={r.city}
          placeCount={r.placeCount ?? 0} pins={r.pins ?? []}
          onOpen={() => navigate(`/route/${r.id}`)} onUnsave={() => unsaveRoute(r.id)} />
      ),
    });
  });
  rows.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));

  const loading = !!user && routesLoading;

  if (loading && rows.length === 0) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-full h-[164px] rounded-3xl bg-muted/50 animate-pulse" />)}</div>;
  }
  if (rows.length === 0) {
    if (hideEmptyState) return null;
    return (
      <div className="pt-20 pb-12 text-center px-8">
        <span aria-hidden className="mx-auto mb-4 h-20 w-20" style={{ display: "block", backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Zapisane.svg)", maskImage: "url(/Ikona_Zapisane.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
        <p className="text-base font-bold">Brak zapisanych tras</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">Zapisz trasę bookmarkiem w zakładce Eksploruj, żeby zobaczyć je tutaj.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">{rows.map((r) => r.el)}</div>
  );
}

// ── SavedCollections ──────────────────────────────────────────────────────────
// Zestawienia ZAPISANE przez usera (bookmark z trasa_saved_collections, localStorage) -
// czyli cudze kolekcje odlozone na pozniej. To NIE sa wlasne zestawienia usera (te sa na
// profilu, karta "Zestawienia" -> MyCollections). Wyszukiwarka jak w zakladce Miejsca.
// Tap otwiera pelna wizytowke zestawienia (CollectionDetail).
function SavedCollectionCard({ col, savedAt, onOpen, onDelete }: { col: DiscoveryCollection; savedAt?: string | null; onOpen: (c: DiscoveryCollection) => void; onDelete: () => void }) {
  const coverItem = col.items?.find((i) => i.photo_url);
  const cover = resolveStored(col.list_cover_url) ?? (coverItem?.photo_url ? resolveStored(coverItem.photo_url) : (col.gallery_urls?.[0] ? resolveStored(col.gallery_urls[0]) : null));
  const count = col.items?.length ?? 0;
  const countLabel = count === 1 ? "miejsce" : count < 5 ? "miejsca" : "miejsc";
  const d = savedAt ? parseISODate(savedAt) : null;
  const savedLabel = d && isValidDate(d) ? fmtDate(d, "d MMM yyyy", { locale: dateLocale() }) : null;
  return (
    <div className="relative w-full flex items-center gap-3 rounded-3xl bg-card border border-border/50 p-3">
      <button onClick={() => onOpen(col)} className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-80 transition-opacity">
        {cover ? (
          <img src={cover} alt="" className="h-16 w-16 rounded-2xl object-cover shrink-0" loading="lazy" />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center shrink-0">
            <Bookmark className="h-6 w-6 text-orange-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight truncate">{col.title || "Lista"}</p>
          {/* Bez miasta - zostaje liczba miejsc + autor */}
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[`${count} ${countLabel}`, col.author_name].filter(Boolean).join(" · ")}
          </p>
          {savedLabel && <p className="text-[11px] text-muted-foreground/70 mt-1">Zapisano {savedLabel}</p>}
        </div>
      </button>
      <button onClick={onDelete} aria-label="Usuń z zapisanych" className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-colors shrink-0">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SavedCollections({ hideEmptyState }: { hideEmptyState?: boolean } = {}) {
  const navigate = useNavigate();
  const [pendingUnsave, setPendingUnsave] = useState<DiscoveryCollection | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]") as string[]; }
    catch { return []; }
  });
  const savedDates = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}") as Record<string, string>; }
    catch { return {}; }
  }, [savedIds]);
  // Usuniecie z zapisanych (po potwierdzeniu w modalu) - localStorage + odswiez liste.
  const unsave = (id: string) => {
    try {
      const set = new Set(savedIds); set.delete(id);
      const dates: Record<string, string> = JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}");
      delete dates[id];
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
      setSavedIds([...set]);
    } catch { /* noop */ }
  };
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["saved-collections", [...savedIds].sort().join(",")],
    enabled: savedIds.length > 0,
    queryFn: async () => {
      const { data: cols } = await (supabase as any).from("discovery_collections")
        .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, plan_adds_count, cover_url, list_cover_url")
        .in("id", savedIds);
      // Zachowaj kolejnosc zapisu (ostatnio zapisane na gorze).
      const byId = new Map((cols ?? []).map((c: any) => [c.id, c]));
      const ordered = [...savedIds].reverse().map((id) => byId.get(id)).filter(Boolean);
      return hydrateCollections(ordered);
    },
  });
  return (
    <div className="flex flex-col">
      {savedIds.length === 0 || (!isLoading && collections.length === 0) ? (
        // Pusty stan. hideEmptyState -> null (wspólny pusty stan obsługuje wrapper SavedListsRoutes).
        hideEmptyState ? null : (
        <div className="pt-20 pb-12 text-center px-8">
          <span aria-hidden className="mx-auto mb-4 h-20 w-20" style={{ display: "block", backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Zapisane.svg)", maskImage: "url(/Ikona_Zapisane.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
          <p className="text-base font-bold">Brak zapisanych list</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[280px] mx-auto">
            Zapisz listę zakładką podczas przeglądania, żeby pojawiła się tutaj.
          </p>
        </div>
        )
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-3xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((col) => (
            <SavedCollectionCard key={col.id} col={col} savedAt={savedDates[col.id]} onOpen={(c) => navigate(`/lista/${c.id}`)} onDelete={() => setPendingUnsave(col)} />
          ))}
        </div>
      )}

      {/* Modal potwierdzenia usuniecia z zapisanych */}
      <AlertDialog open={!!pendingUnsave} onOpenChange={(o) => { if (!o) setPendingUnsave(null); }}>
        <AlertDialogContent className="rounded-3xl max-w-[340px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Na pewno chcesz usunąć to zestawienie z zapisanych?</AlertDialogTitle>
            <AlertDialogDescription>
              Zniknie ono z Twoich zapisanych zestawień. Zawsze możesz zapisać je ponownie z eksploracji.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { const c = pendingUnsave; setPendingUnsave(null); if (c) unsave(c.id); }}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DiscoveryFeed({ city = "Warszawa", cities = [], onCityChange, active = true, searchQuery = "", searchOpen = false, searchCategory = "all" }: { city?: string; cities?: string[]; onCityChange?: (city: string) => void; active?: boolean; searchQuery?: string; searchOpen?: boolean; searchCategory?: "all" | "lists" | "trips" | "places" } = {}) {
  const { t } = useTranslation("homefeed");
  const { user } = useAuth();
  // Zablokowani userzy (App Store 1.2): ich trasy i listy znikaja z feedu i wyszukiwarki.
  const { data: blockedIds } = useQuery({
    queryKey: ["blocked-ids", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchBlockedIds(user?.id),
    staleTime: 5 * 60 * 1000,
  });
  const notBlocked = (uid?: string | null) => !uid || !blockedIds?.has(uid);
  const { open: openAuthDrawer } = useAuthDrawer();
  const queryClient = useQueryClient();
  // Liczba zapisanych miejsc (do wiersza "Zapisane miejsca" pod wyszukiwarka).
  const savedCount = useMemo(() => getHistoryByCity().reduce((n, g) => n + g.places.length, 0), []);
  // Szybkie skroty widoczne po otwarciu wyszukiwarki (pusta). "Biezace polozenie" ->
  // najblizsze miejsca z bazy (geo + sort po dystansie), "Zapisane" -> zakladka Zapisane.
  // Wyszukiwarka zyje w gornej belce (Explore) i steruje feedem propsem searchOpen.
  const searchFocused = searchOpen;
  const [nearbyLoading, setNearbyLoading] = useState(false);
  // "Biezace polozenie": ustaw punkt odniesienia GPS i przejdz na widok Miejsc posortowany
  // od najblizszego (Explore slucha trasa:explore-nearby -> browse + sort nearest).
  const handleNearby = async () => {
    if (nearbyLoading) return;
    setNearbyLoading(true);
    const ok = await setGpsReference();
    setNearbyLoading(false);
    if (!ok) { toast.error("Nie udało się pobrać lokalizacji"); return; }
    window.dispatchEvent(new CustomEvent("trasa:explore-nearby"));
  };
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);
  const [activeCreator, setActiveCreator] = useState<PolecaneCreatorPlan | null>(null);
  // Drawer "Kiedy planujesz te trase?" - klik "Uzyj tej trasy" w zestawieniu (podglad)
  // pyta o date, a potem laduje w PlanWizard (swiper) z miejscami w Dopasowaniach.
  // (Karty tras z tabeli routes maja wlasny podglad SharedRoute i swoj przycisk.)
  const [planPrompt, setPlanPrompt] = useState<{ city: string | null; names: string[] } | null>(null);
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const planPromptDrag = useDragToDismiss({ onDismiss: () => setPlanPrompt(null) });
  // Podglad miejsca z wyszukiwarki (pelna wizytowka). Bazowy MockPlace od razu, potem doczytujemy
  // profil biznesu (menu/eventy) po UUID - jak w "Zapisane".
  const [placeDetail, setPlaceDetail] = useState<MockPlace | null>(null);
  const [feedSavePlace, setFeedSavePlace] = useState<SavePlaceInput | null>(null);
  const openPlaceDetail = (p: any) => {
    const base = {
      id: p.id,
      place_name: p.place_name,
      category: p.category,
      city: p.city,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
      photo_url: p.photo_url ?? undefined,
      rating: p.rating ?? undefined,
      address: p.address ?? undefined,
    } as unknown as MockPlace;
    setPlaceDetail(base);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (p.id && UUID_RE.test(p.id)) {
      void fetchEnrichedPlace(p.id, new Date().toISOString().slice(0, 10)).then((en) => {
        if (en) setPlaceDetail((prev) => (prev && prev.id === base.id ? en : prev));
      });
    }
  };
  const navigate = useNavigate();

  // Wyszukiwarka + filtry (miasto / motyw zestawienia / kategoria miejsc w trasach).
  // Input trzyma gorna belka (Explore) - tu przychodzi jako prop (searchQuery).
  const searchInput = searchQuery;
  const debouncedQuery = useDebounce(searchInput.trim(), 300);
  // Reset scrolla feedu na gore gdy otwieramy wyszukiwarke / zmieniamy fraze - inaczej skroty
  // i wyniki (na gorze fragmentu) zostaja przewiniete poza ekran, gdy user wczesniej scrollowal feed.
  const topAnchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    let el = topAnchorRef.current?.parentElement as HTMLElement | null;
    while (el && !(el.scrollHeight > el.clientHeight + 20 && getComputedStyle(el).overflowY === "auto")) el = el.parentElement;
    el?.scrollTo({ top: 0, behavior: "auto" });
  }, [searchOpen, debouncedQuery]);
  // Zapis CUDZEJ trasy bookmarkiem na karcie feedu -> tabela saved_routes (per user, w bazie).
  // Zakladka "Zapisane" czyta te trasy. Wymaga zalogowania (guest -> auth drawer).
  const [savedRouteIds, setSavedRouteIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setSavedRouteIds(new Set()); return; }
    let cancelled = false;
    (supabase as any).from("saved_routes").select("route_id").eq("user_id", user.id)
      .then(({ data }: { data: { route_id: string }[] | null }) => {
        if (!cancelled) setSavedRouteIds(new Set((data ?? []).map((s) => s.route_id)));
      });
    return () => { cancelled = true; };
  }, [user]);
  const toggleSaveRoute = async (routeId: string) => {
    if (!user) { openAuthDrawer({ mode: "register", hint: "save" }); return; }
    const has = savedRouteIds.has(routeId);
    const next = new Set(savedRouteIds);
    has ? next.delete(routeId) : next.add(routeId);
    setSavedRouteIds(next);
    haptics.light();
    if (has) {
      await (supabase as any).from("saved_routes").delete().eq("user_id", user.id).eq("route_id", routeId);
      toast(t("toast.removed_saved", "Usunięto z zapisanych"), {
        action: { label: t("undo", "Cofnij"), onClick: () => toggleSaveRoute(routeId) },
      });
    } else {
      await (supabase as any).from("saved_routes").insert({ user_id: user.id, route_id: routeId });
      // Powiadom właściciela trasy o zapisie (SECURITY DEFINER, pomija self-save).
      void (supabase as any).rpc("notify_route_used", { p_route_id: routeId });
      toast.success(t("toast.saved", "Zapisano"));
    }
    queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
  };
  // Zapis zestawienia bookmarkiem na karcie feedu Tras - localStorage (jak CollectionDetail/Zapisane).
  const [savedColIds, setSavedColIds] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")); } catch { return new Set(); }
  });
  const toggleSaveCol = (colId: string) => {
    try {
      // Czytamy z localStorage (zrodlo prawdy) - dzieki temu "Cofnij" w toascie dziala
      // mimo domkniec (stale closure na savedColIds by przywracalo zly stan).
      const set = new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]"));
      const dates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
      if (set.has(colId)) {
        set.delete(colId); delete dates[colId];
        if (user) void unsaveCollectionDb(user.id, colId);
        toast(t("toast.removed_saved", "Usunięto z zapisanych"), {
          action: { label: t("undo", "Cofnij"), onClick: () => toggleSaveCol(colId) },
        });
      } else {
        set.add(colId); dates[colId] = new Date().toISOString();
        if (user) { void saveCollectionDb(user.id, colId); void (supabase as any).rpc("notify_collection_saved", { p_collection_id: colId }); }
        toast.success(t("toast.saved"));
      }
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
      setSavedColIds(set);
    } catch { /* localStorage niedostepny */ }
  };
  // Filtry wielokrotnego wyboru (mozna zaznaczyc kilka miast / motywow / kategorii).
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  // Filtr typu tresci w feedzie eksploracji: wszystko / same trasy / same listy.
  const [contentType, setContentType] = useState<"all" | "routes" | "lists">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Zakladka wynikow wyszukiwania: najlepsze (wszystko) / miejsca / zestawienia.
  // Kategoria (Wszystko|Listy|Wyjazdy|Miejsca) przychodzi z gornego chrome (Explore).
  const cat = searchCategory;
  const q = debouncedQuery.length >= 2 ? debouncedQuery : "";
  // Wybrana kategoria (inna niz "Wszystko") wlacza widok wynikow TAKZE bez frazy - wtedy
  // pokazujemy zawartosc kategorii (tryb przegladania, decyzja Nat 2026-08-31).
  // Wyszukiwarka pokazuje tresc od momentu OTWARCIA (bez frazy): "Wszystko" = podglad
  // 5 wyjazdow + 5 list + 5 miejsc ze zdjeciami, kategoria = przegladanie tej kategorii.
  const isSearchActive = !!q || cityFilter.length > 0 || themeFilter.length > 0 || categoryFilter.length > 0 || searchOpen;
  // Reset zakladki wynikow gdy wychodzimy z wyszukiwania.

  // Miasto z gornej belki zeszlo do sheetu (parent `city`) - liczymy je do badge filtra,
  // ale trzymamy osobno od cityFilter[] (ten zostaje dla filtra wynikow wyszukiwania).
  const cityActive = !!city && city !== "all";
  const activeFilterCount = cityFilter.length + themeFilter.length + categoryFilter.length + (cityActive ? 1 : 0) + (contentType !== "all" ? 1 : 0);
  const clearFilters = () => { setCityFilter([]); setThemeFilter([]); setCategoryFilter([]); onCityChange?.("all"); setContentType("all"); };
  // Gorna belka (ExploreTopBar w Explore) trzyma guzik filtra - otwiera sheet eventem,
  // a DiscoveryFeed raportuje jej liczbe aktywnych filtrow (badge).
  useEffect(() => {
    if (!active) return;
    const openH = () => setFiltersOpen(true);
    window.addEventListener("trasa:explore-open-filters", openH);
    return () => window.removeEventListener("trasa:explore-open-filters", openH);
  }, [active]);
  useEffect(() => {
    if (active) window.dispatchEvent(new CustomEvent("trasa:explore-filter-count", { detail: activeFilterCount }));
  }, [active, activeFilterCount]);
  // Toggle wartosci w tablicy filtra (dodaj/usun).
  const toggleFilter = (set: (updater: (prev: string[]) => string[]) => void, v: string) =>
    set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // Po wyborze daty: przejdz do PlanWizard step 4 z miejscami zestawienia jako Dopasowania.
  const startPlanning = (date: Date | null, numDays: number) => {
    const p = planPrompt;
    if (!p) return;
    setPlanPrompt(null);
    navigate("/plan", {
      state: {
        // Bez miasta nie mamy z czego zaladowac swipera -> zacznij od wyboru miasta.
        step: p.city ? 4 : 1,
        city: p.city ?? undefined,
        date: (date ?? new Date()).toISOString(),
        numDays: numDays || 1,
        likedPlaceNames: p.names,
        fromRoute: true,
      },
    });
  };

  // Najnowsze udostepnione trasy (poziomy scroll).
  // Trasy w Warszawie (lista pionowa).
  const { data: warszawa = [], isLoading: wawaLoading } = useQuery({
    queryKey: ["discovery-city-routes", city],
    queryFn: async () => {
      // city === "all" (ALL_CITIES) -> feed agreguje Trasy ze wszystkich miast (bez filtra).
      let q = (supabase as any)
        .from("routes")
        .select("id, title, city, ai_highlight, ai_summary, user_id, created_at, published_at, views, share_anonymous, cover_url, list_cover_url, review_photos, group_session_id, tags")
        // Bramka "opublikowane": trasa pojawia sie w eksploracji dopiero gdy jest OPUBLIKOWANA
        // (status='published' przez "Zapisz trase") i ma miniature (list_cover_url). status blokuje
        // przeciek roboczych tras grupowych (is_shared=true, status='draft') z auto-okladka.
        .eq("is_shared", true).eq("status", "published").eq("hidden_by_admin", false).not("title", "is", null).not("list_cover_url", "is", null);
      if (city && city !== "all") q = q.ilike("city", `${city}%`);
      const { data } = await q
        // Najnowsze trasy na gorze feedu wg daty PUBLIKACJI (published_at), nie zalozenia trasy.
        // created_at to moment rozpoczecia planowania - wyjazd planowany od tygodnia i opublikowany
        // dzisiaj ladowal przez to ponizej starszych publikacji.
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(30);
      return enrichRouteRows(data ?? []);
    },
    staleTime: 60_000,
  });

  const { data: motywy = [], isLoading: motywyLoading } = useQuery({
    queryKey: ["discovery-motywy-warszawa"],
    enabled: false,
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .eq("city", "Warszawa")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      const coordMap = new Map<string, { latitude: number; longitude: number }>();
      try {
        const { data: coords } = await (supabase as any)
          .from("discovery_items")
          .select("id, latitude, longitude")
          .in("collection_id", ids)
          .not("latitude", "is", null);
        if (coords) {
          for (const c of coords) {
            if (c.latitude && c.longitude) coordMap.set(c.id, { latitude: c.latitude, longitude: c.longitude });
          }
        }
      } catch {
        // optional columns
      }

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? [])
          .filter((i: any) => i.collection_id === col.id)
          .map((i: any) => ({ ...i, ...coordMap.get(i.id) })),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: polecane = [], isLoading: polecaneLoading } = useQuery({
    queryKey: ["discovery-polecane"],
    enabled: false,
    queryFn: async () => {
      const [routesRes, creatorRes] = await Promise.all([
        (supabase as any)
          .from("routes")
          .select("id, title, city, review_photos, cover_url, list_cover_url, ai_highlight, user_id, views")
          .eq("is_shared", true)
          .eq("status", "published")
          .eq("hidden_by_admin", false)
          .not("title", "is", null)
          .not("list_cover_url", "is", null)
          .order("views", { ascending: false, nullsFirst: false })
          .limit(8),
        (supabase as any)
          .from("creator_plans")
          .select("id, title, city, description, thumbnail_url, creator_handle, creator_avatar_url, num_days, tags")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const routes = (routesRes.data ?? []) as any[];
      const creatorPlans = (creatorRes.data ?? []) as any[];

      // Okladka karty = najatrakcyjniejsze ZDJECIE MIEJSCA z trasy (nie zdjecie
      // usera). Ranking kategorii (najbardziej "pocztowkowe" pierwsze) + pierwszy
      // pin ze zdjeciem jako tie-break.
      const routeIds = routes.map((r) => r.id);
      const placePhotoMap = new Map<string, string>();
      if (routeIds.length > 0) {
        const { data: pinRows } = await (supabase as any)
          .from("pins")
          .select("route_id, photo_url, image_url, images, user_photo_urls, category, pin_order")
          .in("route_id", routeIds);
        const RANK: Record<string, number> = {
          viewpoint: 0, monument: 1, park: 2, gallery: 3, museum: 4, experience: 5,
          market: 6, shopping: 7, club: 8, bar: 9, cafe: 10, restaurant: 11, walk: 12,
        };
        const best = new Map<string, { url: string; rank: number; order: number }>();
        for (const p of (pinRows ?? []) as any[]) {
          const url = resolveStored((Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.user_photo_urls) && p.user_photo_urls[0]) || p.photo_url || p.image_url);
          if (!url) continue;
          const rank = RANK[p.category as string] ?? 50;
          const order = p.pin_order ?? 999;
          const cur = best.get(p.route_id);
          if (!cur || rank < cur.rank || (rank === cur.rank && order < cur.order)) {
            best.set(p.route_id, { url, rank, order });
          }
        }
        for (const [rid, v] of best) placePhotoMap.set(rid, v.url);
      }

      // Fetch profiles for routes
      const userIds = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
      let profileMap = new Map<string, { username: string | null; first_name: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, username, first_name, avatar_url")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, { username: p.username, first_name: p.first_name, avatar_url: p.avatar_url });
          }
        }
      }

      const routeEntries: PolecaneRoute[] = routes.map((r) => {
        const profile = profileMap.get(r.user_id);
        // Okladka ze zdjec miejsc (najatrakcyjniejsze), nie ze zdjec usera.
        const photo = placePhotoMap.get(r.id) ?? null;
        const authorName = profile?.first_name || profile?.username || i18n.t("author_default", { ns: "homefeed" });
        return {
          kind: "route",
          id: r.id,
          title: r.title,
          city: r.city,
          photo,
          ai_highlight: r.ai_highlight,
          author_name: authorName,
          author_avatar: profile?.avatar_url ?? null,
        };
      });

      const creatorEntries: PolecaneCreatorPlan[] = creatorPlans.map((p) => ({
        kind: "creator",
        id: p.id,
        title: p.title,
        city: p.city,
        description: p.description,
        photo: p.thumbnail_url,
        creator_handle: p.creator_handle,
        creator_avatar_url: p.creator_avatar_url,
        num_days: p.num_days,
        tags: p.tags,
      }));

      // Interleave: route, creator, route, creator, ...
      const merged: PolecaneEntry[] = [];
      const maxLen = Math.max(routeEntries.length, creatorEntries.length);
      for (let i = 0; i < maxLen && merged.length < 12; i++) {
        if (i < routeEntries.length) merged.push(routeEntries[i]);
        if (i < creatorEntries.length && merged.length < 12) merged.push(creatorEntries[i]);
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
  });

  const bothEmpty = !motywyLoading && !polecaneLoading && motywy.length === 0 && polecane.length === 0;

  // Zestawienia/rankingi miejsc (kind='ranking'). TYMCZASOWO WYLACZONE w Eksploruj
  // (feature jeszcze nie w MVP - na TODO). Flaga ponizej -> latwy powrot. Kod + query
  // zostaja w gotowosci. enabled=SHOW_ZESTAWIENIA zeby nie strzelac niepotrzebnie do DB.
  const { data: userPolecajki = [] } = useQuery({
    queryKey: ["explore-rankings"],
    enabled: SHOW_ZESTAWIENIA,
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, plan_adds_count, cover_url, list_cover_url")
        .eq("is_public", true)
        .eq("kind", "ranking")
        .eq("list_status", "visited") // tylko polecajki; prywatne wishlisty to_visit nigdy w feedzie
        .eq("hidden_by_admin", false)
        .neq("moderation_status", "rejected") // soft-moderacja: pending + approved widoczne od razu
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error || !cols?.length) return [] as DiscoveryCollection[];
      return hydrateCollections(cols);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Wyszukiwarka: trasy (tytul / autor) + zestawienia (tytul / autor), z filtrami.
  const { data: results, isLoading: searchLoading } = useQuery({
    queryKey: ["explore-search", q, cityFilter, themeFilter, categoryFilter, cat],
    enabled: isSearchActive,
    staleTime: 30_000,
    queryFn: async () => {
      // Wiele miast -> suma expandCity dla kazdego wybranego (dedupe).
      const cities = cityFilter.length ? [...new Set(cityFilter.flatMap(expandCity))] : null;
      const like = `%${escapeLike(q)}%`;
      const routeCols = "id, title, city, ai_highlight, ai_summary, user_id, created_at, views, share_anonymous, cover_url, list_cover_url, review_photos, group_session_id, tags";

      // Kategorie miejsc -> zbior route_id z pinow tych kategorii (routes nie ma kolumny category).
      let allow: Set<string> | null = null;
      if (categoryFilter.length) {
        const dbCats = [...new Set(categoryFilter.flatMap(getDbCategoriesFor))];
        const { data: pinRows } = await (supabase as any)
          .from("pins").select("route_id")
          .in("category", dbCats)
          .not("route_id", "is", null);
        allow = new Set((pinRows ?? []).map((p: any) => p.route_id));
        if (allow.size === 0) allow = new Set(["__none__"]);
      }

      // Miejsca z OKLADKAMI (zdjecia userow z place_photos) - do przegladania bez frazy.
      // "Rozne miasta": przy podgladzie bierzemy max jedno miejsce na miasto, kolejnosc losowa.
      const coverByName = new Map<string, string>();
      const fetchCoveredPlaces = async (limitN: number, oneCityEach: boolean) => {
        const { data: photoRows } = await (supabase as any)
          .from("place_photos").select("place_name, photo_url, created_at")
          .order("created_at", { ascending: false }).limit(240);
        for (const r of photoRows ?? []) {
          const k = String(r.place_name ?? "").toLowerCase();
          if (k && !coverByName.has(k)) coverByName.set(k, r.photo_url);
        }
        const names = [...new Set((photoRows ?? []).map((r: any) => r.place_name).filter(Boolean))].slice(0, 150);
        if (!names.length) return [] as any[];
        let pq2 = (supabase as any).from("places")
          .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url, google_place_id")
          .in("place_name", names);
        if (cities) pq2 = pq2.in("city", cities);
        const { data: rows } = await pq2.limit(150);
        const pool = (rows ?? []).map((p: any) => ({ ...p, _cover: resolveStored(coverByName.get(String(p.place_name).toLowerCase())) ?? null }))
          .filter((p: any) => !!p._cover);
        // Losowa kolejnosc (Fisher-Yates) - podglad ma byc za kazdym razem inny.
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        const seenCity = new Set<string>();
        const out: any[] = [];
        for (const p of pool) {
          const ck = String(p.city ?? "").toLowerCase();
          if (oneCityEach && ck && seenCity.has(ck)) continue;
          if (ck) seenCity.add(ck);
          out.push(p);
          if (out.length >= limitN) break;
        }
        return out;
      };
      // Doklej okladki (place_photos) do miejsc znalezionych po frazie - inaczej lista wynikow
      // pokazuje same ikony kategorii na peachy tle.
      const attachCovers = async (rows: any[]) => {
        if (!rows.length) return rows;
        const names = [...new Set(rows.map((r) => r.place_name).filter(Boolean))];
        const { data: ph } = await (supabase as any).from("place_photos").select("place_name, photo_url").in("place_name", names);
        const m = new Map<string, string>();
        for (const r of ph ?? []) { const k = String(r.place_name ?? "").toLowerCase(); if (k && !m.has(k)) m.set(k, r.photo_url); }
        return rows.map((r) => ({ ...r, _cover: resolveStored(m.get(String(r.place_name).toLowerCase())) ?? r.photo_url ?? null }));
      };

      const applyRoute = (b: any) => {
        // Bramka jak w feedzie: opublikowane (status='published') ze sfinalizowana miniatura (list_cover_url).
        let x = b.eq("is_shared", true).eq("status", "published").eq("hidden_by_admin", false).not("title", "is", null).not("list_cover_url", "is", null);
        if (cities) x = x.in("city", cities);
        return x;
      };

      const routeMap = new Map<string, any>();
      if (q) {
        // 1) Po TYTULE trasy.
        const { data: byTitle } = await applyRoute((supabase as any).from("routes").select(routeCols).ilike("title", like))
          .order("views", { ascending: false, nullsFirst: false }).limit(30);
        for (const r of byTitle ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        // 2) Po MIESCIE trasy - user naturalnie wpisuje nazwe miasta (np. "Rzym", "Lodz").
        const { data: byCity } = await applyRoute((supabase as any).from("routes").select(routeCols).ilike("city", like))
          .order("views", { ascending: false, nullsFirst: false }).limit(30);
        for (const r of byCity ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        // 3) Po NAZWIE MIEJSCA na trasie (pin) - placeholder obiecuje "miejsc na trasie".
        const { data: pinHits } = await (supabase as any).from("pins")
          .select("route_id").ilike("place_name", like).not("route_id", "is", null).limit(80);
        const pinRouteIds = [...new Set((pinHits ?? []).map((p: any) => p.route_id))].filter((id) => !routeMap.has(id));
        if (pinRouteIds.length) {
          const { data: byPlace } = await applyRoute((supabase as any).from("routes").select(routeCols).in("id", pinRouteIds))
            .order("views", { ascending: false, nullsFirst: false }).limit(30);
          for (const r of byPlace ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        }
        // 4) Po AUTORZE - trasy autorow, ktorych nick/imie pasuje.
        const { data: profs } = await (supabase as any).from("profiles").select("id")
          .or(`username.ilike.${like},first_name.ilike.${like}`).limit(50);
        const uids = (profs ?? []).map((p: any) => p.id);
        if (uids.length) {
          const { data: byAuthor } = await applyRoute((supabase as any).from("routes").select(routeCols).in("user_id", uids))
            .order("views", { ascending: false, nullsFirst: false }).limit(30);
          for (const r of byAuthor ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        }
      } else if (cities || categoryFilter.length || cat === "trips" || cat === "all") {
        // Bez frazy: same filtry ALBO kategoria "Wyjazdy" (przegladanie) - najnowsze publikacje.
        const { data: all } = await applyRoute((supabase as any).from("routes").select(routeCols))
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false })
          .limit(cat === "all" ? 5 : 40);
        for (const r of all ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
      }
      let routeRows = (cat === "all" || cat === "trips") ? [...routeMap.values()] : [];
      if (allow) routeRows = routeRows.filter((r) => allow!.has(r.id));
      const routes = await enrichRouteRows(routeRows);

      // Zestawienia (listy) - pomijamy gdy aktywny filtr kategorii miejsc (to pojecie tras)
      // ORAZ gdy listy sa wylaczone w eksploracji (SHOW_ZESTAWIENIA=false - widoczne tylko w profilu).
      let collections: DiscoveryCollection[] = [];
      // SHOW_ZESTAWIENIA chowa listy z PASYWNEGO feedu eksploracji, ale WYSZUKIWARKA ma je
      // pokazywac zawsze - "Wszystko" ma w podgladzie 5 najnowszych list (prosba Nat 2026-08-31).
      if (!categoryFilter.length && (cat === "all" || cat === "lists")) {
        let colQ = (supabase as any).from("discovery_collections")
          .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, likes_count, updated_at, plan_adds_count, cover_url, list_cover_url")
          .eq("is_public", true).eq("kind", "ranking").eq("list_status", "visited").eq("hidden_by_admin", false).neq("moderation_status", "rejected"); // soft-moderacja: pending widoczne
        if (q) colQ = colQ.or(`title.ilike.${like},author_name.ilike.${like}`);
        if (themeFilter.length) colQ = colQ.in("category", themeFilter);
        if (cities) colQ = colQ.in("city", cities);
        const { data: cols } = await colQ.order("updated_at", { ascending: false }).limit(cat === "all" ? 5 : 20);
        collections = await hydrateCollections(cols ?? []);
      }

      // Miejsca (places) - szukanie po nazwie, ze WSZYSTKICH miast (albo wybranych w filtrze
      // miast/kategorii). Tap otwiera pelna wizytowke. Tylko gdy user wpisal fraze (>=2 znaki).
      let places: any[] = [];
      if (q) {
        // Szukanie po nazwie + doklejone okladki ze zdjec userow.
        let pq = (supabase as any)
          .from("places")
          .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url, google_place_id")
          .ilike("place_name", like);
        if (cities) pq = pq.in("city", cities);
        if (categoryFilter.length) {
          const dbCats = [...new Set(categoryFilter.flatMap(getDbCategoriesFor))];
          pq = pq.in("category", dbCats);
        }
        const { data: placeRows } = await pq.order("rating", { ascending: false, nullsFirst: false }).limit(24);
        places = await attachCovers(placeRows ?? []);
      } else if (cat === "all") {
        // Podglad: 5 miejsc ZE ZDJECIAMI, kazde z innego miasta (prosba Nat 2026-08-31).
        places = await fetchCoveredPlaces(5, true);
      } else if (cat === "places") {
        // Zakladka Miejsca: najpierw losowe miejsca Z OKLADKAMI, potem dopiero te z ikona
        // kategorii na peachy tle (fallback).
        const covered = await fetchCoveredPlaces(24, false);
        const usedIds = new Set(covered.map((p: any) => p.id));
        let pq = (supabase as any)
          .from("places")
          .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url, google_place_id");
        if (cities) pq = pq.in("city", cities);
        if (categoryFilter.length) {
          const dbCats = [...new Set(categoryFilter.flatMap(getDbCategoriesFor))];
          pq = pq.in("category", dbCats);
        }
        const { data: rest } = await pq.order("rating", { ascending: false, nullsFirst: false }).limit(40);
        places = [...covered, ...(rest ?? []).filter((p: any) => !usedIds.has(p.id)).map((p: any) => ({ ...p, _cover: null }))];
      }

      return { routes, collections, places };
    },
  });

  const { data: fallbackCollections = [] } = useQuery({
    queryKey: ["discovery-fallback"],
    enabled: false,
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      const coordMap = new Map<string, { latitude: number; longitude: number }>();
      try {
        const { data: coords } = await (supabase as any)
          .from("discovery_items")
          .select("id, latitude, longitude")
          .in("collection_id", ids)
          .not("latitude", "is", null);
        if (coords) {
          for (const c of coords) {
            if (c.latitude && c.longitude) coordMap.set(c.id, { latitude: c.latitude, longitude: c.longitude });
          }
        }
      } catch {
        // optional
      }

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? [])
          .filter((i: any) => i.collection_id === col.id)
          .map((i: any) => ({ ...i, ...coordMap.get(i.id) })),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = wawaLoading;
  void motywyLoading; void polecaneLoading;

  return (
    <>
      {/* Kotwica do resetu scrolla feedu na gore przy otwarciu wyszukiwarki. */}
      <div ref={topAnchorRef} aria-hidden className="h-0" />
      {/* Szybkie skroty po kliknieciu w wyszukiwarke (pusta fraza) - NAD feedem; wizytowki
          zostaja widoczne pod spodem (feed nie znika). Wylaczone flaga SHOW_SEARCH_SHORTCUTS. */}
      {SHOW_SEARCH_SHORTCUTS && searchFocused && !isSearchActive && (
        <div className="rounded-2xl bg-secondary border border-border/40 overflow-hidden divide-y divide-border/40 mb-4">
          <button onClick={handleNearby} disabled={nearbyLoading} className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-muted/50 transition-colors disabled:opacity-60">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              {nearbyLoading ? <Loader2 className="h-[18px] w-[18px] text-orange-600 animate-spin" /> : <Navigation className="h-[18px] w-[18px] text-orange-600" />}
            </div>
            <span className="flex-1 text-sm font-semibold">{t("current_location", "Bieżące położenie")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          <button onClick={() => navigate("/moj-profil?tab=zapisane")} className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-muted/50 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Bookmark className="h-[18px] w-[18px] text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{t("saved_places", "Zapisane miejsca")}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{t("places_count", { count: savedCount })}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {/* Wyniki wyszukiwania (po wpisaniu frazy) - najlepsze dopasowania NAD feedem. */}
      {isSearchActive && (
        <div className="mb-6">
          {searchLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => <RouteCardVSkeleton key={i} />)}
          </div>
        ) : (results && (results.routes.length > 0 || results.collections.length > 0 || (results.places?.length ?? 0) > 0)) ? (
          <div className="space-y-5">
            {/* Filtr wynikow = karty kategorii w naglowku wyszukiwarki (Explore), nie pigulki. */}
            <div className="space-y-7">
            {/* WYJAZDY - te same duze karty co w eksploracji (prosba Nat 2026-08-31). */}
            {(cat === "all" || cat === "trips") && results.routes.length > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("routes_heading")}{cityFilter.length === 1 ? ` ${t("in_city", { city: cityFilter[0] })}` : ""}</p>
                <div className="space-y-4">
                  {results.routes.filter((r) => notBlocked(r.user_id)).map((r) => (
                    <TrasaBigCard
                      key={r.id}
                      id={r.id}
                      photo={r.photo}
                      city={r.city}
                      placeCount={r.placeCount ?? 0}
                      title={r.title}
                      description={r.summary || r.ai_highlight}
                      tags={(r.categories ?? []).map((c) => CAT_LABEL[c] ?? c)}
                      pins={r.pins ?? []}
                      saved={savedRouteIds.has(r.id)}
                      onToggleSave={() => toggleSaveRoute(r.id)}
                      onOpen={() => navigate(`/route/${r.id}`)}
                      authorName={r.author_username ? `@${r.author_username}` : r.author_name}
                      authorAvatar={r.author_avatar}
                      participants={r.participants ?? []}
                      snap={false}
                      heightClass="aspect-[3/4]"
                    />
                  ))}
                </div>
              </div>
            )}
            {/* LISTY - uklad karty z profilu (awatar + tytul + miniatury miejsc). */}
            {(cat === "all" || cat === "lists") && results.collections.length > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("collections")}</p>
                <div className="space-y-6">
                  {results.collections.filter((col) => notBlocked(col.user_id)).map((col) => (
                    <ProfileFeedCard
                      key={col.id}
                      avatarUrl={col.author_avatar}
                      fallback={col.author_name}
                      eyebrow=""
                      timestamp={col.updated_at ? shortRelativeTime(col.updated_at) : undefined}
                      title={col.title}
                      description={col.description}
                      tiles={col.items}
                      counts={{ saves: col.saves_count ?? 0, likes: col.likes_count ?? 0, views: col.views_count ?? 0 }}
                      onOpen={() => navigate(`/lista/${col.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
            {(cat === "all" || cat === "places") && (results.places?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("places_heading")}</p>
                <div className="space-y-2">
                  {results.places.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => openPlaceDetail(p)}
                      className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary p-3 text-left active:scale-[0.98] transition-transform"
                    >
                      <PlaceThumb url={p._cover ?? p.photo_url} category={p.category} name={p.place_name} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{p.place_name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {p.city && (
                            <span className="flex items-center gap-0.5 min-w-0">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{p.city}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center px-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#fcede3] flex items-center justify-center mb-3">
              <Search className="h-8 w-8 text-[#ef9d78]" strokeWidth={2} />
            </div>
            <p className="text-base font-bold">{t("no_results")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("no_results_hint")}</p>
          </div>
          )}
        </div>
      )}

      {/* Feed Tras - ZAWSZE widoczny pod skrotami/wynikami (nie znika przy wyszukiwaniu). */}
      {isLoading ? (
        // Skeleton pelnoekranowej karty feedu (1:1 z TrasaBigCard) - immersyjny, nie stary kompaktowy.
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`relative w-full shrink-0 rounded-3xl overflow-hidden bg-muted animate-pulse min-h-[420px] ${TRASA_CARD_H}`}>
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/25 to-transparent" />
              {/* podglad trasy: mapka w prawym-gornym rogu */}
              <div className="absolute right-3 top-3 h-24 w-24 rounded-2xl bg-white/30" />
              {/* prawy dolny stack: 2 guziki */}
              <div className="absolute right-4 bottom-5 flex flex-col items-center gap-2.5">
                <div className="h-12 w-12 rounded-full bg-white/40" />
                <div className="h-12 w-12 rounded-full bg-white/40" />
              </div>
              {/* dolny-lewy opis */}
              <div className="absolute left-5 bottom-6 right-20 space-y-2">
                <div className="h-3.5 w-28 bg-white/30 rounded-full" />
                <div className="h-6 w-4/5 bg-white/45 rounded-lg" />
                <div className="h-3 w-full bg-white/25 rounded-full" />
                <div className="flex gap-1.5 pt-1">
                  <div className="h-5 w-14 bg-white/25 rounded-full" />
                  <div className="h-5 w-12 bg-white/25 rounded-full" />
                  <div className="h-5 w-16 bg-white/25 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Redesign: immersyjny feed Tras - pelnoekranowe karty (zestawienia + trasy), scroll.
        <div className="space-y-4">
          {(() => {
            // Wspolny feed: trasy + listy PRZEPLECIONE (trasa, lista, trasa, lista...), z filtrem typu.
            // Karta identyczna (TrasaBigCard); rozni sie tylko onOpen (trasa -> /route, lista -> /lista).
            const routeCards = (contentType === "lists" ? [] : warszawa).filter((r) => notBlocked(r.user_id)).map((r) => (
              <TrasaBigCard
                key={`route-${r.id}`}
                id={r.id}
                photo={r.photo}
                city={r.city}
                placeCount={r.placeCount ?? 0}
                title={r.title}
                description={r.summary || r.ai_highlight}
                // Tagi CALEJ TRASY wycofane (prosba Nat 2026-08-31) - chipy to kategorie miejsc.
                tags={(r.categories ?? []).map((c) => CAT_LABEL[c] ?? c)}
                pins={r.pins ?? []}
                saved={savedRouteIds.has(r.id)}
                onToggleSave={() => toggleSaveRoute(r.id)}
                onOpen={() => navigate(`/route/${r.id}`)}
                authorName={r.author_username ? `@${r.author_username}` : r.author_name}
                authorAvatar={r.author_avatar}
                participants={r.participants ?? []}
              />
            ));
            const listCards = (contentType === "routes" ? [] : userPolecajki).filter((col) => notBlocked(col.user_id)).map((col) => {
              const ph = col.items.find((i) => i.photo_url)?.photo_url ?? col.gallery_urls?.[0] ?? null;
              const catTags = [...new Set(col.items.map((i) => i.category).filter(Boolean).map((c) => String(c).toLowerCase()))]
                .map((c) => CAT_LABEL[c] ?? c);
              return (
                <TrasaBigCard
                  key={`col-${col.id}`}
                  id={col.id}
                  photo={ph ? resolveStored(ph) : null}
                  city={col.city}
                  placeCount={col.items.length}
                  title={col.title}
                  description={col.description}
                  tags={catTags}
                  pins={col.items}
                  saved={savedColIds.has(col.id)}
                  onToggleSave={() => toggleSaveCol(col.id)}
                  onOpen={() => navigate(`/lista/${col.id}`)}
                  authorName={col.author_name}
                  authorAvatar={col.author_avatar}
                />
              );
            });
            if (routeCards.length === 0 && listCards.length === 0) {
              return (
                <div className="py-16 text-center px-8">
                  <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-[#fcede3] flex items-center justify-center">
                    <img src="/Ikona_Eksploracja.svg" alt="" className="h-8 w-8" draggable={false} />
                  </div>
                  <p className="text-base font-bold">{t("community_soon")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("community_soon_hint")}</p>
                </div>
              );
            }
            const mixed: any[] = [];
            const max = Math.max(routeCards.length, listCards.length);
            for (let i = 0; i < max; i++) {
              if (i < routeCards.length) mixed.push(routeCards[i]);
              if (i < listCards.length) mixed.push(listCards[i]);
            }
            return mixed;
          })()}
        </div>
      )}

      {/* Pelna wizytowka miejsca z wyszukiwarki */}
      <PlaceSwiperDetail
        open={!!placeDetail}
        place={placeDetail}
        city={placeDetail?.city}
        onOpenChange={(open) => { if (!open) setPlaceDetail(null); }}
        onLike={placeDetail ? () => setFeedSavePlace({
          place_name: placeDetail.place_name, category: placeDetail.category ?? null, address: placeDetail.address || null,
          city: placeDetail.city || null, latitude: placeDetail.latitude ?? null, longitude: placeDetail.longitude ?? null,
          photo_url: placeDetail.photo_url || null, place_id: null,
        }) : undefined}
      />
      <SavePlaceSheet open={!!feedSavePlace} onOpenChange={(o) => { if (!o) setFeedSavePlace(null); }} place={feedSavePlace} city={feedSavePlace?.city ?? ""} />

      <Sheet open={!!activeCol} onOpenChange={(open) => { if (!open) setActiveCol(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 [&>button:last-child]:hidden"
          style={{ maxHeight: "92vh", height: "92vh" }}
        >
          {activeCol && (
            <CollectionDetail
              col={activeCol}
              onClose={() => setActiveCol(null)}
              onAdopt={(city, names) => { setActiveCol(null); setPlanPrompt({ city, names }); }}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!activeCreator} onOpenChange={(open) => { if (!open) setActiveCreator(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 [&>button:last-child]:hidden"
          style={{ maxHeight: "92vh", height: "92vh" }}
        >
          {activeCreator && <CreatorPlanDetail plan={activeCreator} />}
        </SheetContent>
      </Sheet>

      {/* Drawer "Kiedy planujesz te trase?" - po kliknieciu w trase/zestawienie. */}
      {planPrompt && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPlanPrompt(null)}
        >
          <div
            {...planPromptDrag.dragProps}
            className="w-full max-w-md bg-card rounded-t-3xl flex flex-col max-h-[88dvh] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-1 text-center shrink-0">
              <p className="text-lg font-black leading-tight">{t("plan_prompt.title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("plan_prompt.desc")}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FullCalendarPicker onConfirm={(d, n) => startPlanning(d, n)} />
            </div>
            <button
              onClick={() => startPlanning(null, 1)}
              className="mx-5 mt-1 mb-[max(16px,env(safe-area-inset-bottom))] py-2.5 text-sm font-medium text-muted-foreground active:text-foreground transition-colors shrink-0"
            >
              {t("plan_prompt.skip")}
            </button>
          </div>
        </div>
      )}

      {/* Sheet filtrow: miasto / motyw zestawienia / kategoria miejsc */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 [&>button:last-child]:hidden flex flex-col" style={{ height: "80vh", maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 pt-5 mb-2 shrink-0">
            <p className="text-lg font-black">{t("filters_title")}</p>
            <button onClick={() => setFiltersOpen(false)} aria-label={t("aria.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
          </div>
          {/* Miasto (przeniesione z gornej belki 2026-08-05) + kategoria miejsca. */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-2">
            {/* Typ tresci: Wszystko | Trasy | Listy - TYLKO gdy listy sa w eksploracji (SHOW_ZESTAWIENIA).
                Wylaczone -> feed ma same trasy, segment bezuzyteczny. */}
            {SHOW_ZESTAWIENIA && (
              <>
                <p className="text-sm font-bold text-foreground mb-2">Pokaż</p>
                <div className="flex gap-2 mb-5">
                  {([
                    { id: "all", label: "Wszystko" },
                    { id: "routes", label: "Trasy" },
                    { id: "lists", label: "Listy" },
                  ] as { id: "all" | "routes" | "lists"; label: string }[]).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setContentType(s.id)}
                      className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-colors active:scale-[0.98] ${contentType === s.id ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {onCityChange && <CityFilterRow city={city} cities={cities} onChange={onCityChange} />}
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">{t("filter.category")}</p>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setCategoryFilter([])} className={`px-4 py-3 rounded-2xl text-sm font-bold transition-colors ${categoryFilter.length === 0 ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t("all")}</button>
              {MAIN_CATEGORIES.flatMap((c) => c.subcategories).map((s) => (
                <button key={s.id} onClick={() => toggleFilter(setCategoryFilter, s.id)} className={`px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${categoryFilter.includes(s.id) ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shrink-0 border-t border-border/40">
            <button onClick={clearFilters} className="flex-1 py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">{t("filter.clear")}</button>
            <button onClick={() => setFiltersOpen(false)} className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform">{t("filter.apply")}</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
