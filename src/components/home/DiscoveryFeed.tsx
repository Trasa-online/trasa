import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { avatarSrc } from "@/lib/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, Globe, Sparkles, Star, Pencil, Trash2, ChevronRight, ArrowRight, Heart, Eye, List, GalleryHorizontalEnd, Search, SlidersHorizontal, Plus, ArrowLeft, Images, Bookmark, Users } from "lucide-react";
import { API_BASE } from "@/lib/platform";
import { useDebounce } from "@/hooks/useDebounce";
import { expandCity } from "@/lib/cities";
import { MAIN_CATEGORIES, getDbCategoriesFor } from "@/lib/categories";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import RouteMap from "@/components/RouteMap";
import { type MockPlace, fetchEnrichedPlace } from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { resolveStored } from "@/components/PlacePhoto";
import { COLLECTION_THEMES, getTheme, collectionKind } from "@/lib/collectionThemes";
import { addLike, getHistoryByCity } from "@/lib/exploreLikes";
import { TrasaLogo } from "@/components/TrasaLogo";
import { toast } from "sonner";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";

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
  author_name: string;
  author_avatar: string | null;
  placeCount?: number;
  avgRating?: number;                  // srednia ocena Google z pinow (0 = brak)
  pins?: LatLng[];                     // wspolrzedne pinow do mini-mapy na okladce
};

const CAT_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

// Emoji kategorii (klucze jak CAT_LABEL) - chip kategorii na kartach jak w widoku trasy.
const CAT_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶", other: "📍",
};

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

type LatLng = { latitude?: number | null; longitude?: number | null };

// Mini mapka Google (statyczna) na okladce karty - jak w referencji (maly kafel
// z pinami trasy w rogu zdjecia). Przez proxy /api/static-map (klucz server-side,
// 24h CDN cache). Pomaranczowe piny, POI/transit ukryte dla czystosci. null gdy
// brak wspolrzednych. Max 12 pinow (limit dlugosci URL).
function buildMiniMapUrl(pins: LatLng[]): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 12);
  if (!pts.length) return null;
  const markers = pts
    .map((p) => `markers=size:tiny%7Ccolor:0xf9662b%7C${p.latitude},${p.longitude}`)
    .join("&");
  return `${API_BASE}/api/static-map?size=150x150&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

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
  const gradient = PLACEHOLDER_GRADIENTS[placeholderIdx % PLACEHOLDER_GRADIENTS.length];
  // Custom miejsca (spoza bazy) trzymaja surowy Google photo_reference - przepusc przez proxy
  // (resolveStored: pelny URL bez zmian, raw ref -> getPhotoUrl). Inaczej <img src=ref> = pusty kafel.
  const url = resolveStored(item.photo_url);
  return url ? (
    <img src={url} alt={item.place_name} className={`object-cover ${className ?? ""}`} loading="lazy" />
  ) : (
    <div className={`bg-gradient-to-br ${gradient} flex items-center justify-center ${className ?? ""}`}>
      <span className="text-2xl opacity-60">📍</span>
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
  const [deleting, setDeleting] = useState(false);
  // Widok miejsc: lista (domyslnie, jak w widoku trasy) lub karty (poziomy swiper).
  const [placeView, setPlaceView] = useState<"list" | "cards">("list");
  // Tryb tresci: miejsca (lista/karty) vs galeria (siatka zdjec) - toggle pod tytulem.
  const [contentView, setContentView] = useState<"places" | "gallery">("places");
  // Zapis calego zestawienia (bookmark w stopce) - lokalny, per przegladarka/urzadzenie.
  const [savedCol, setSavedCol] = useState<boolean>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")).has(col.id); } catch { return false; }
  });
  const toggleSaveCollection = () => {
    try {
      const key = "trasa_saved_collections";
      const set = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]"));
      if (set.has(col.id)) { set.delete(col.id); setSavedCol(false); }
      else { set.add(col.id); setSavedCol(true); toast.success(t("toast.saved")); }
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch { /* localStorage niedostepny - ignoruj */ }
  };
  const isOwner = !!user && user.id === col.user_id;
  const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
  const theme = getTheme(col.category);
  const isRoute = collectionKind(col.category) === "route";

  // Ktore miejsca sa juz polubione (localStorage per miasto) -> badge "juz polubione".
  // Set nazw miejsc; refresh po dodaniu polubienia w tym widoku.
  const likedInCity = () => new Set(
    (getHistoryByCity().find((g) => col.city && g.city.toLowerCase() === col.city!.toLowerCase())?.places ?? [])
      .map((p) => p.place_name.toLowerCase())
  );
  const [likedNames, setLikedNames] = useState<Set<string>>(likedInCity);

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

  // Dodaj miejsce do polubien (localStorage + user_place_reactions dla zalogowanych).
  const likePlace = async (item: DiscoveryItem) => {
    if (!col.city) return;
    if (likedNames.has(item.place_name.toLowerCase())) return;
    addLike(col.city, {
      place_name: item.place_name,
      category: item.category ?? "other",
      address: item.address ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      rating: item.rating ?? null,
      photo_url: item.photo_url ?? null,
    });
    setLikedNames((prev) => new Set(prev).add(item.place_name.toLowerCase()));
    toast.success(t("toast.saved"));
    if (user?.id && item.place_id) {
      (supabase as any).from("user_place_reactions").upsert({
        user_id: user.id, place_id: item.place_id, place_name: item.place_name, city: col.city,
        category: item.category ?? null, photo_url: item.photo_url ?? null, reaction: "liked",
      }, { onConflict: "user_id,place_id" }).then(({ error }: any) => { if (error) console.warn("[DiscoveryFeed] reaction upsert:", error.message); });
    }
    // Statystyka zestawienia: polubienie miejsca z kolekcji.
    (supabase as any).rpc("increment_collection_saves", { p_collection_id: col.id })
      .then(({ error }: any) => { if (error) console.warn("[DiscoveryFeed] increment_collection_saves:", error.message); });
  };

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

  // Okladka hero (pierwsze zdjecie) + mini mapka Google (statyczna) na hero.
  const coverItem = col.items.find((i) => i.photo_url) ?? col.items[0];
  const coverUrl = resolveStored(coverItem?.photo_url);
  const heroMap = buildMiniMapUrl(col.items);

  // "Uzyj tej trasy" - przejmij miejsca zestawienia do nowej trasy (swiper -> Dopasowania).
  // Najpierw pyta o date (przez onAdopt -> drawer w feedzie), potem laduje w PlanWizard.
  const adoptRoute = async () => {
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
        const alreadyLiked = likedNames.has(item.place_name.toLowerCase());
        return (
          <div key={item.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col">
            <div
              {...(tappable ? { onClick: () => openPlace(item), role: "button" } : {})}
              className={`relative w-full aspect-[4/3] bg-muted ${tappable ? "active:opacity-90 transition-opacity cursor-pointer" : ""}`}
            >
              <PlacePhoto item={item} placeholderIdx={idx} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{idx + 1}</div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {col.city && (
                  <span role="button" aria-label={alreadyLiked ? t("aria.already_saved") : t("aria.save_place")}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!alreadyLiked) likePlace(item); }}
                    className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                    <Heart className={`h-4 w-4 ${alreadyLiked ? "fill-rose-500 text-rose-500" : "text-foreground"}`} />
                  </span>
                )}
                {item.rating != null && (
                  <span className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-[11px] font-bold text-foreground">{item.rating}</span>
                  </span>
                )}
              </div>
              {!tappable && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/55 backdrop-blur-sm">
                  <Globe className="h-3 w-3 text-white/90 shrink-0" />
                  <span className="text-[9px] font-semibold text-white leading-tight">{t("not_in_trasa")}</span>
                </div>
              )}
            </div>
            <div className="px-4 pt-4 pb-4 flex-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <span>{CAT_EMOJI[cat] ?? "📍"}</span>{t(`cat.${cat}`, CAT_LABEL[cat] ?? t("cat.other"))}
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

  // ── Widok listy - zwarte ponumerowane wiersze (redesign wg Figmy: czarny numerek,
  // badge kategorii, gwiazdka+ocena, zapis przez Bookmark ribbon). ──
  const renderPlaceList = () => (
    <div className="space-y-2">
      {col.items.map((item, idx) => {
        const tappable = !!item.place_id;
        const cat = item.category ?? "other";
        const alreadyLiked = likedNames.has(item.place_name.toLowerCase());
        return (
          <div key={item.id} className="flex items-center gap-2 bg-secondary border border-border/40 shadow-sm rounded-2xl p-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">{idx + 1}</div>
            <button
              {...(tappable ? { onClick: () => openPlace(item) } : {})}
              className={`flex items-center gap-3 min-w-0 flex-1 text-left ${tappable ? "active:opacity-70 transition-opacity" : ""}`}
            >
              <PlacePhoto item={item} placeholderIdx={idx} className="h-14 w-14 rounded-xl shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight line-clamp-1">{item.place_name}</p>
                <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground">
                  {t(`cat.${cat}`, CAT_LABEL[cat] ?? t("cat.other"))}
                </span>
                {!tappable && (
                  <span className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                    <Globe className="h-3 w-3 shrink-0" />{t("not_in_trasa")}
                  </span>
                )}
              </div>
              {tappable && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.rating != null && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-[11px] font-bold text-foreground">{item.rating}</span>
                </span>
              )}
              {col.city && (
                <button aria-label={alreadyLiked ? t("aria.already_saved") : t("aria.save_place")}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!alreadyLiked) likePlace(item); }}
                  className="h-7 w-7 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                  <Bookmark className={`h-4 w-4 ${alreadyLiked ? "fill-primary text-primary" : "text-foreground"}`} />
                </button>
              )}
            </div>
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* HERO - okladka z gradientem, akcje overlay, mini mapka + galeria (wg Figmy) */}
        <div className="relative h-[240px] bg-muted overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt={col.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center"><span className="text-4xl opacity-60">📍</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70 pointer-events-none" />
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
          {/* Mini mapka Google (prawy dol) */}
          {heroMap && (
            <div className="absolute bottom-3 right-3 h-14 w-14 rounded-xl overflow-hidden ring-2 ring-white/80 shadow-md bg-muted">
              <img src={heroMap} alt="" aria-hidden className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
            </div>
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
            <div className="mt-4 flex justify-center">
              <div className="inline-flex rounded-full bg-muted p-0.5">
                <button onClick={() => setContentView("places")}
                  className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors ${contentView === "places" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <MapPin className="h-4 w-4" />{t("places")}
                </button>
                <button onClick={() => setContentView("gallery")}
                  className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors ${contentView === "gallery" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
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
        <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={col.city ?? undefined} skipGoogleFetch={false} />
      )}
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
          const photoUrl = resolveStored(photoItem?.photo_url);
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
          const photoUrl = resolveStored(photoItem?.photo_url);
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
  const countMap = new Map<string, number>();
  const catMap = new Map<string, string[]>(); // 3 glowne kategorie (wg pin_order)
  const ratingMap = new Map<string, number[]>(); // oceny Google pinow (do sredniej)
  const pinsMap = new Map<string, LatLng[]>();    // wspolrzedne pinow (do mini-mapy)
  const { data: pinRows } = await (supabase as any)
    .from("pins")
    .select("route_id, photo_url, image_url, category, pin_order, rating, latitude, longitude")
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
    const url = resolveStored(p.photo_url || p.image_url);
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

  return routes.map((r): PolecaneRoute => {
    const prof = profileMap.get(r.user_id);
    const anon = r.share_anonymous === true;
    return {
      kind: "route", id: r.id, title: r.title, city: r.city,
      photo: photoMap.get(r.id) ?? null,
      ai_highlight: r.ai_highlight ?? null,
      summary: r.ai_summary ?? null,
      categories: catMap.get(r.id) ?? [],
      author_name: anon ? i18n.t("author_anon", { ns: "homefeed" }) : (prof?.first_name || prof?.username || i18n.t("author_default", { ns: "homefeed" })),
      author_avatar: anon ? null : (prof?.avatar_url ?? null),
      placeCount: countMap.get(r.id) ?? 0,
      avgRating: avgRatingOf(ratingMap.get(r.id) ?? []),
      pins: pinsMap.get(r.id) ?? [],
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
  id, photo, categoryEmoji, categoryLabel, categoryClass, city, avgRating = 0,
  placeCount = 0, title, pins = [], note, authorName, authorAvatar, localBadge = false, onClick,
}: {
  id: string;
  photo: string | null;
  categoryEmoji?: string;
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
          {/* Badge kategorii + miasto (lewy gorny rog) - bez informacji o km */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {categoryLabel && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${categoryClass ?? "bg-black/55 backdrop-blur-sm text-white"}`}>
                {categoryEmoji ? <span>{categoryEmoji}</span> : null}{categoryLabel}
              </span>
            )}
            {city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                <MapPin className="h-3 w-3" />{city}
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

      {/* Wiersz meta: srednia ocena Google (mala pomaranczowa gwiazdka) + liczba miejsc */}
      <div className="mt-2.5 flex items-center gap-3 text-sm">
        {avgRating > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-[#F9662B] text-[#F9662B]" />
            <span className="font-bold text-foreground">{avgRating.toFixed(1)}</span>
          </span>
        )}
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
  const theme = getTheme(col.category);
  const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
  const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
  return (
    <BigCard
      id={col.id}
      photo={resolveStored(photoItem?.photo_url) ?? null}
      categoryEmoji={theme?.emoji}
      categoryLabel={theme?.label}
      categoryClass={theme?.badge}
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
      categoryEmoji={cat ? CAT_EMOJI[cat] : undefined}
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

const SHOW_ZESTAWIENIA = true;

export default function DiscoveryFeed() {
  const { t } = useTranslation("homefeed");
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);
  const [activeCreator, setActiveCreator] = useState<PolecaneCreatorPlan | null>(null);
  // Drawer "Kiedy planujesz te trase?" - klik "Uzyj tej trasy" w zestawieniu (podglad)
  // pyta o date, a potem laduje w PlanWizard (swiper) z miejscami w Dopasowaniach.
  // (Karty tras z tabeli routes maja wlasny podglad SharedRoute i swoj przycisk.)
  const [planPrompt, setPlanPrompt] = useState<{ city: string | null; names: string[] } | null>(null);
  // Podglad miejsca z wyszukiwarki (pelna wizytowka). Bazowy MockPlace od razu, potem doczytujemy
  // profil biznesu (menu/eventy) po UUID - jak w "Zapisane".
  const [placeDetail, setPlaceDetail] = useState<MockPlace | null>(null);
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
  const [searchInput, setSearchInput] = useState("");
  const debouncedQuery = useDebounce(searchInput.trim(), 300);
  // Filtry wielokrotnego wyboru (mozna zaznaczyc kilka miast / motywow / kategorii).
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const q = debouncedQuery.length >= 2 ? debouncedQuery : "";
  const isSearchActive = !!q || cityFilter.length > 0 || themeFilter.length > 0 || categoryFilter.length > 0;
  const activeFilterCount = cityFilter.length + themeFilter.length + categoryFilter.length;
  const clearFilters = () => { setCityFilter([]); setThemeFilter([]); setCategoryFilter([]); };
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
    queryKey: ["discovery-warszawa-routes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, ai_highlight, ai_summary, user_id, created_at, views, share_anonymous")
        .eq("is_shared", true).not("title", "is", null).ilike("city", "warszawa%")
        .order("views", { ascending: false, nullsFirst: false })
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
          .select("id, title, city, review_photos, ai_highlight, user_id, views")
          .eq("is_shared", true)
          .not("title", "is", null)
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
          .select("route_id, photo_url, image_url, category, pin_order")
          .in("route_id", routeIds);
        const RANK: Record<string, number> = {
          viewpoint: 0, monument: 1, park: 2, gallery: 3, museum: 4, experience: 5,
          market: 6, shopping: 7, club: 8, bar: 9, cafe: 10, restaurant: 11, walk: 12,
        };
        const best = new Map<string, { url: string; rank: number; order: number }>();
        for (const p of (pinRows ?? []) as any[]) {
          const url = resolveStored(p.photo_url || p.image_url);
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
        .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, plan_adds_count")
        .eq("is_public", true)
        .eq("kind", "ranking")
        .eq("hidden_by_admin", false)
        .eq("moderation_status", "approved")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error || !cols?.length) return [] as DiscoveryCollection[];
      return hydrateCollections(cols);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Wyszukiwarka: trasy (tytul / autor) + zestawienia (tytul / autor), z filtrami.
  const { data: results, isLoading: searchLoading } = useQuery({
    queryKey: ["explore-search", q, cityFilter, themeFilter, categoryFilter],
    enabled: isSearchActive,
    staleTime: 30_000,
    queryFn: async () => {
      // Wiele miast -> suma expandCity dla kazdego wybranego (dedupe).
      const cities = cityFilter.length ? [...new Set(cityFilter.flatMap(expandCity))] : null;
      const like = `%${escapeLike(q)}%`;
      const routeCols = "id, title, city, ai_highlight, ai_summary, user_id, created_at, views, share_anonymous";

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

      const applyRoute = (b: any) => {
        let x = b.eq("is_shared", true).not("title", "is", null);
        if (cities) x = x.in("city", cities);
        return x;
      };

      const routeMap = new Map<string, any>();
      if (q) {
        const { data: byTitle } = await applyRoute((supabase as any).from("routes").select(routeCols).ilike("title", like))
          .order("views", { ascending: false, nullsFirst: false }).limit(30);
        for (const r of byTitle ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        // Trasy autorow, ktorych nick/imie pasuje.
        const { data: profs } = await (supabase as any).from("profiles").select("id")
          .or(`username.ilike.${like},first_name.ilike.${like}`).limit(50);
        const uids = (profs ?? []).map((p: any) => p.id);
        if (uids.length) {
          const { data: byAuthor } = await applyRoute((supabase as any).from("routes").select(routeCols).in("user_id", uids))
            .order("views", { ascending: false, nullsFirst: false }).limit(30);
          for (const r of byAuthor ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
        }
      } else if (cities || categoryFilter.length) {
        // Same filtry (bez slowa) - i tak pokazujemy pasujace trasy.
        const { data: all } = await applyRoute((supabase as any).from("routes").select(routeCols))
          .order("views", { ascending: false, nullsFirst: false }).limit(40);
        for (const r of all ?? []) if (!routeMap.has(r.id)) routeMap.set(r.id, r);
      }
      let routeRows = [...routeMap.values()];
      if (allow) routeRows = routeRows.filter((r) => allow!.has(r.id));
      const routes = await enrichRouteRows(routeRows);

      // Zestawienia - pomijamy gdy aktywny filtr kategorii miejsc (to pojecie tras).
      let collections: DiscoveryCollection[] = [];
      if (!categoryFilter.length) {
        let colQ = (supabase as any).from("discovery_collections")
          .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, plan_adds_count")
          .eq("is_public", true).eq("kind", "ranking").eq("hidden_by_admin", false).eq("moderation_status", "approved");
        if (q) colQ = colQ.or(`title.ilike.${like},author_name.ilike.${like}`);
        if (themeFilter.length) colQ = colQ.in("category", themeFilter);
        if (cities) colQ = colQ.in("city", cities);
        const { data: cols } = await colQ.order("updated_at", { ascending: false }).limit(20);
        collections = await hydrateCollections(cols ?? []);
      }

      // Miejsca (places) - szukanie po nazwie, ze WSZYSTKICH miast (albo wybranych w filtrze
      // miast/kategorii). Tap otwiera pelna wizytowke. Tylko gdy user wpisal fraze (>=2 znaki).
      let places: any[] = [];
      if (q) {
        let pq = (supabase as any)
          .from("places")
          .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url")
          .ilike("place_name", like);
        if (cities) pq = pq.in("city", cities);
        if (categoryFilter.length) {
          const dbCats = [...new Set(categoryFilter.flatMap(getDbCategoriesFor))];
          pq = pq.in("category", dbCats);
        }
        const { data: placeRows } = await pq.order("rating", { ascending: false, nullsFirst: false }).limit(24);
        places = placeRows ?? [];
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
      {/* Pasek wyszukiwania + przycisk filtrow */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-secondary min-w-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: true }))}
            onBlur={() => window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false }))}
            placeholder={t("search_placeholder")}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} aria-label={t("aria.clear")} className="shrink-0"><X className="h-4 w-4 text-muted-foreground" /></button>
          )}
        </div>
        <button onClick={() => setFiltersOpen(true)} aria-label={t("aria.filters")}
          className="relative h-10 w-10 flex items-center justify-center rounded-full bg-secondary shrink-0 active:scale-90 transition-transform">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {isSearchActive ? (
        searchLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => <RouteCardVSkeleton key={i} />)}
          </div>
        ) : (results && (results.routes.length > 0 || results.collections.length > 0 || (results.places?.length ?? 0) > 0)) ? (
          <div className="space-y-7">
            {(results.places?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("places_heading")}</p>
                <div className="space-y-2">
                  {results.places.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => openPlaceDetail(p)}
                      className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary p-3 text-left active:scale-[0.98] transition-transform"
                    >
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.place_name} className="h-14 w-14 rounded-2xl object-cover shrink-0" loading="lazy" />
                      ) : (
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">{p.place_name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {typeof p.rating === "number" && p.rating > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {p.rating.toFixed(1)}
                            </span>
                          )}
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
            {results.collections.length > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("collections")}</p>
                <div className="space-y-6">
                  {results.collections.map((col) => (
                    <CollectionBigCard key={col.id} col={col} onOpen={setActiveCol} />
                  ))}
                </div>
              </div>
            )}
            {results.routes.length > 0 && (
              <div>
                <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">{t("routes_heading")}{cityFilter.length === 1 ? ` ${t("in_city", { city: cityFilter[0] })}` : ""}</p>
                <div className="space-y-6">
                  {results.routes.map((r) => (
                    <RouteBigCard key={r.id} route={r} onClick={() => navigate(`/route/${r.id}`)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center px-8">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-base font-bold">{t("no_results")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("no_results_hint")}</p>
          </div>
        )
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="h-6 w-44 bg-muted rounded mb-4 mx-1 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => <RouteCardVSkeleton key={i} />)}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Zestawienia - duze karty pionowe (glowna tresc, od razu widoczne). */}
          {SHOW_ZESTAWIENIA && userPolecajki.length > 0 && (
            <div>
              <div className="mb-4 px-1">
                <h2 className="text-xl font-black tracking-tight">{t("collections")}</h2>
              </div>
              <div className="space-y-6">
                {userPolecajki.map((col) => (
                  <CollectionBigCard key={col.id} col={col} onOpen={setActiveCol} />
                ))}
              </div>
            </div>
          )}

          {/* Trasy w Warszawie - duze karty pionowe. */}
          {warszawa.length > 0 && (
            <div>
              <div className="mb-4 px-1">
                <h2 className="text-xl font-black tracking-tight">{t("routes_in_warsaw")}</h2>
              </div>
              <div className="space-y-6">
                {warszawa.map((r) => (
                  <RouteBigCard key={r.id} route={r} onClick={() => navigate(`/route/${r.id}`)} />
                ))}
              </div>
            </div>
          )}

          {warszawa.length === 0 && userPolecajki.length === 0 && (
            <div className="py-16 text-center px-8">
              <div className="text-5xl mb-3">🗺️</div>
              <p className="text-base font-bold">{t("community_soon")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("community_soon_hint")}</p>
            </div>
          )}
        </div>
      )}

      {/* Pelna wizytowka miejsca z wyszukiwarki */}
      <PlaceSwiperDetail
        open={!!placeDetail}
        place={placeDetail}
        city={placeDetail?.city}
        onOpenChange={(open) => { if (!open) setPlaceDetail(null); }}
      />

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
        <SheetContent side="bottom" className="rounded-t-2xl p-0 [&>button:last-child]:hidden" style={{ maxHeight: "80vh" }}>
          <div className="flex items-center justify-between px-5 pt-5 mb-4">
            <p className="text-lg font-black">{t("filters_title")}</p>
            <button onClick={() => setFiltersOpen(false)} aria-label={t("aria.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-5 overflow-y-auto px-5 pb-2">
            {/* Miasto */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t("filter.city")}</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-5 px-5">
                <button onClick={() => setCityFilter([])} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${cityFilter.length === 0 ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t("all")}</button>
                {ACTIVE_CITIES.map((c) => (
                  <button key={c} onClick={() => toggleFilter(setCityFilter, c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${cityFilter.includes(c) ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{c}</button>
                ))}
              </div>
            </div>
            {/* Motyw zestawienia */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t("filter.theme")}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setThemeFilter([])} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${themeFilter.length === 0 ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t("all")}</button>
                {COLLECTION_THEMES.map((t) => (
                  <button key={t.id} onClick={() => toggleFilter(setThemeFilter, t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${themeFilter.includes(t.id) ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t.emoji} {t.label}</button>
                ))}
              </div>
            </div>
            {/* Kategoria miejsca (w trasach) */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{t("filter.category")}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCategoryFilter([])} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${categoryFilter.length === 0 ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{t("all")}</button>
                {MAIN_CATEGORIES.flatMap((c) => c.subcategories).map((s) => (
                  <button key={s.id} onClick={() => toggleFilter(setCategoryFilter, s.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${categoryFilter.includes(s.id) ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}>{s.emoji} {s.label}</button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("filter.hint")}</p>
          </div>
          <div className="flex gap-2 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button onClick={clearFilters} className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">{t("filter.clear")}</button>
            <button onClick={() => setFiltersOpen(false)} className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform">{t("filter.apply")}</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
