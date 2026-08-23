import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, Loader2, ChevronRight, ChevronDown, List, GalleryHorizontalEnd, GripVertical, Image as ImageIcon } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isNative } from "@/lib/platform";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { uploadCoverImage, pickNativeCoverFiles } from "@/lib/coverUpload";
import CoverPickerSheet, { type CoverOption } from "@/components/create/CoverPickerSheet";
import CreateHeader from "@/components/create/CreateHeader";
import { expandCity, cityGenitive } from "@/lib/cities";
import { TRIP_COUNTRIES, TRIP_REGIONS, citiesForCountry, countryForCity } from "@/lib/tripCountries";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { useQuery } from "@tanstack/react-query";
import { fetchSavedPlaces } from "@/lib/placeLists";
import { forwardGeocode, reverseGeocode, forwardGeocodeWithTypes } from "@/lib/googleMaps";
import { isRouteCollection } from "@/lib/collectionThemes";
import { MAIN_CATEGORIES, getDbCategoriesFor, mainCategoryLabel } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { categoryFromGoogleTypes, inferCategoryFromName } from "@/lib/placeCategoryIcon";
import { placeTagsForCategory } from "@/lib/routeTags";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";

// Domyslne tlo listy = gradient zolto-zloty (#FDF184 -> #FDCD84) jako data-URI SVG (renderuje sie
// jak zwykle zdjecie; resolveStored przepuszcza data:). Spojne z domyslnym tlem trasy.
const GRADIENT_COVER = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='16'%20height='16'%20preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23FDF184'/%3E%3Cstop%20offset='1'%20stop-color='%23FDCD84'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='16'%20height='16'%20fill='url(%23g)'/%3E%3C/svg%3E";
import { cacheListItemPhoto } from "@/lib/placePhotos";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import RouteMap from "@/components/RouteMap";

// Item rankingu. place_id != null = miejsce z bazy (tap -> wizytowka). null = custom (Google).
interface RankingItem {
  key: string;
  place_id: string | null;
  place_name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  google_place_id: string | null;
  photo_url: string | null;
  short_desc: string;
  tags?: string[];
}


// Kategoria (moze byc alias DB) -> emoji + etykieta, jak w dzienniku/home.
const CAT_META: Record<string, { emoji: string; label: string }> = {};
MAIN_CATEGORIES.forEach((m) => m.subcategories.forEach((s) => {
  CAT_META[s.id] = { emoji: s.emoji, label: s.label };
  for (const alias of getDbCategoriesFor(s.id)) if (!CAT_META[alias]) CAT_META[alias] = { emoji: s.emoji, label: s.label };
}));
const categoryBadge = (cat: string | null): { emoji: string; label: string } | null => (cat ? CAT_META[cat] ?? null : null);

// Inteligentne propozycje: motyw -> pasujace podkategorie miejsc. Brak wpisu
// (np. perfect-day) = bez filtra (rozny dzien = mix wszystkiego).
const THEME_SUBCATS: Record<string, string[]> = {
  date:      ["restaurant", "cafe", "bar", "viewpoint", "gallery"],
  friends:   ["bar", "club", "restaurant", "cafe", "experience"],
  family:    ["park", "museum", "experience", "viewpoint", "restaurant", "cafe"],
  budget:    ["cafe", "park", "market", "viewpoint", "monument"],
  foodie:    ["restaurant", "cafe", "bar", "market"],
  nightlife: ["bar", "club"],
  culture:   ["museum", "monument", "gallery", "viewpoint"],
  outdoor:   ["park", "viewpoint", "experience"],
  rainy:     ["museum", "cafe", "gallery", "restaurant", "shopping"],
};
// Rozwija podkategorie do wszystkich wartosci DB (aliasy) do filtra .in("category", ...).
const themeDbCategories = (themeId: string | null): string[] | null => {
  if (!themeId || !THEME_SUBCATS[themeId]) return null;
  return [...new Set(THEME_SUBCATS[themeId].flatMap((s) => getDbCategoriesFor(s)))];
};

// Wzbogaca miejsce spoza bazy danymi z Google (rating + okladka + adres + coords).
// Jeden pipeline dla wszystkich 3 trybow: nazwa | adres | koordynaty.
async function fetchGooglePlace(opts: { name?: string; address?: string; lat?: number; lng?: number; city: string }): Promise<Omit<RankingItem, "key" | "short_desc"> | null> {
  let name = opts.name?.trim();
  let lat = opts.lat ?? null;
  let lng = opts.lng ?? null;
  let address = opts.address?.trim() || null;
  try {
    if (address && (lat == null || lng == null)) {
      const geo = await forwardGeocode(address);
      if (geo[0]) { lat = geo[0].coordinates.latitude; lng = geo[0].coordinates.longitude; address = geo[0].full_address; if (!name) name = geo[0].name; }
    }
    if (lat != null && lng != null && !name) {
      const rev = await reverseGeocode(lat, lng);
      if (rev) { name = rev.placeName; address = address ?? rev.fullAddress; }
    }
    if (!name && lat == null) return null;
    // ZERO Google (2026-07-29): bez wzbogacania Place Details (rating/photos/place_id).
    // Uzywamy tylko wyniku geokodowania. Zdjecie miejsca przyjdzie z tras userow / ikona.
    return {
      place_id: null,
      place_name: name ?? "",
      category: null,
      address: address ?? null,
      latitude: lat,
      longitude: lng,
      rating: null,
      google_place_id: null,
      photo_url: null,
    };
  } catch (e) {
    console.warn("[CreateRanking] fetchGooglePlace failed:", e);
    return name ? { place_id: null, place_name: name, category: null, address, latitude: lat, longitude: lng, rating: null, google_place_id: null, photo_url: null } : null;
  }
}

// Wiersz wybranego miejsca (widok listy) z DRAG & DROP (framer-motion Reorder) - 1:1 z
// SortableComposeRow w tworzeniu trasy. Uchwyt GripVertical po lewej; reszta wiersza tapowalna.
function SortableRankingRow({ it, onOpen, onRemove }: { it: RankingItem; onOpen: () => void; onRemove: () => void }) {
  const controls = useDragControls();
  const cat = categoryBadge(it.category);
  return (
    <Reorder.Item
      value={it}
      dragListener={false}
      dragControls={controls}
      transition={{ duration: 0 }}
      className="w-full flex items-center gap-2 rounded-2xl bg-secondary p-2.5 select-none"
    >
      <span
        onPointerDown={(e) => { haptics.light(); controls.start(e); }}
        aria-label="Przeciągnij, by zmienić kolejność"
        className="shrink-0 h-9 w-5 flex items-center justify-center text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5" />
      </span>
      <button onClick={onOpen} className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
        {it.photo_url
          ? <img src={it.photo_url} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
          : <div className="h-11 w-11 rounded-lg bg-[#fcede3] flex items-center justify-center shrink-0"><CategoryIcon category={it.category} className="w-1/2" /></div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{it.place_name}</p>
          {cat && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5"><CategoryIcon category={it.category} className="h-3 w-3 shrink-0" />{cat.label}</p>}
        </div>
      </button>
      <button onClick={onRemove} aria-label="Usuń miejsce" className="h-7 w-7 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 shrink-0"><X className="h-4 w-4" /></button>
    </Reorder.Item>
  );
}

// Predefiniowane tagi list (krok 2, zamiast glownej notki). Wszystkie chipy widoczne od razu
// (styl chip-cloud). Moze tez dodac wlasny tag. Zapisywane w discovery_collections.tags.
const PREDEFINED_TAGS = [
  "Przyjazne dla psów",
  "Miejsca z vibem",
  "Dobre na randkę",
  "Na rodzinny wypad",
  "Klimatyczne wnętrza",
  "Dobra kawa",
  "Na wieczór",
  "Tanio zjesz",
  "Instagramowe",
  "Cicho i spokojnie",
  "Dla znajomych",
  "Roślinne / wege",
];

const CreateRanking = () => {
  const { t } = useTranslation("ranking");
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  // Motyw (category): wybor USUNIETY z flow. null dla nowych zestawien; przy edycji
  // starych zachowujemy istniejacy motyw (bez UI zmiany), zeby nie kasowac danych.
  const [category, setCategory] = useState<string | null>(null);
  // Miasto + kraj (1:1 z widokiem trasy ComposeWyjazd - tripCountries).
  // KRYTYCZNE: miasto z handoffu Trasa->Lista przychodzi w location.state.city (drum-scroll),
  // NIE w query param. Bez czytania state forma spadala do "Warszawa" i "Twoje zapisane miejsca"
  // nie pasowaly do miasta wybranego przez usera (bug 2026-08).
  const nav = (location.state ?? {}) as { city?: string | null; title?: string | null; places?: any[]; listStatus?: string | null; isPublic?: boolean };
  // "" = "Wszędzie" (lista globalna). Miasto NIE jest obowiazkowe przy tworzeniu listy -
  // user moze zrobic liste z miejsc z calego swiata. Selektor miasta = OPCJONALNY filtr wyszukiwarki.
  const initCity = nav.city || params.get("city") || "";
  const [city, setCity] = useState(initCity);
  const [country, setCountry] = useState<string>(() => countryForCity(initCity));
  const cities = citiesForCountry(country);
  const onCountryChange = (c: string) => { setCountry(c); setCity(citiesForCountry(c)[0]); };
  // Nazwa listy - generyczna domyslna (jak "Wyjazd do X" w trasie); titleDirty blokuje auto-update
  // po recznej edycji, a zmiana miasta aktualizuje domyslna nazwe.
  const defaultListName = (c: string) => (c ? `Lista miejsc - ${c}` : "Nowa lista");
  const [title, setTitle] = useState(() => nav.title || defaultListName(initCity));
  const [titleDirty, setTitleDirty] = useState(!!nav.title);
  // Inline selektor miasta wyszukiwania (multi-miasto): pozwala zmienic miasto w trakcie
  // dodawania i dolozyc miejsca z innego miasta (Krakow + Olsztyn w jednej liscie).
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  // Prefill miejsc z handoffu Trasa->Lista (zachowanie wybranych miejsc przy przelaczeniu trybu).
  const [items, setItems] = useState<RankingItem[]>(() =>
    (nav.places ?? []).map((p: any, i: number) => ({
      key: `handoff-${i}-${p.place_id ?? p.place_name}`,
      place_name: p.place_name, category: p.category ?? null,
      address: p.address ?? "", latitude: p.latitude ?? 0, longitude: p.longitude ?? 0,
      photo_url: p.photo_url ?? null, place_id: p.place_id ?? null,
      rating: p.rating ?? null, google_place_id: p.google_place_id ?? null, short_desc: "",
    })),
  );
  // Auto-nazwa aktualizuje sie z miastem TYLKO na pustej liscie (korekta zlego domyslnego
  // miasta). Po dodaniu miejsc zmiana miasta = budowanie listy multi-miasto -> nie zmieniamy nazwy.
  useEffect(() => { if (!titleDirty && items.length === 0) setTitle(defaultListName(city)); }, [city, titleDirty, items.length]);
  const [publishing, setPublishing] = useState(false);
  // Krok formularza po wyborze motywu: 1 = miasto + miejsca, 2 = notki + mapa + publikacja.
  const [step, setStep] = useState<1 | 2>(1);
  // Glowna notka do calego zestawienia (krok 2).
  const [description, setDescription] = useState("");
  // Tagi listy (krok 2) - zastapily glowna notke. Predefiniowane + wlasne usera.
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const toggleTag = (tag: string) => setTags((prev) => prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]);
  const addCustomTag = () => {
    const v = customTag.trim();
    if (!v) return;
    if (!tags.some((x) => x.toLowerCase() === v.toLowerCase())) setTags((prev) => [...prev, v]);
    setCustomTag("");
  };
  // Tozsamosc autora: domyslnie z profilem; checkbox "anonimowo" na koncu (krok 2).
  const [asAnon, setAsAnon] = useState(false);
  // Okladki listy (1:1 z modelem tras): cover_url = hero na /lista/:id, list_cover_url =
  // miniatura na karcie w eksploracji. NULL = fallback do zdjecia pierwszego miejsca.
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [listCoverUrl, setListCoverUrl] = useState<string | null>(null);
  // Status listy (discovery_collections.list_status): "visited" | "to_visit".
  // Nowa lista: user WYBIERA (toggle) czy juz odwiedzil te miejsca czy dopiero chce - domyslnie
  // "do odwiedzenia". Edycja: ladowane z col. Listy "do odwiedzenia" maja uproszczony krok 2.
  // CreateRanking = autor POLECAJEK (publiczna lista, list_status="visited"). Prywatne miejsca
  // "do zobaczenia" zapisuje się bookmarkiem (SavePlaceSheet) -> Zapisane→Miejsca, nie tutaj.
  const [listStatus, setListStatus] = useState<string | null>(editId ? null : ((nav.listStatus as string) ?? "visited"));
  // Dane B2B (premium) wybranych miejsc - do pokazania na karcie pelnego adresu, tagow i
  // kategorii glownej+drugiej. Klucz = place_id (UUID). Tylko miejsca z business_profiles.
  const [bizMap, setBizMap] = useState<Record<string, any>>({});
  // Ktory picker otwarty: hero (cover) | miniatura (list) | zamkniety.
  const [pickerTarget, setPickerTarget] = useState<null | "hero" | "list">(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Wyszukiwarka + propozycje miejsc (bez zargonu "baza/spoza bazy").
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  // Fokus na polu NAZWY listy - chowa CTA i wylacza sticky wyszukiwarki (inaczej sticky
  // search naježdža na pole nazwy gdy klawiatura przewija widok). Patrz krok 1.
  const [titleFocused, setTitleFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Dodatkowe miejsca spoza bazy (Google text search) - dopelnienie wynikow z DB.
  const [googleResults, setGoogleResults] = useState<any[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [addingGoogleName, setAddingGoogleName] = useState<string | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  // Wizytowka miejsca (tap w pozycje na liscie). detailSkip = custom (bez fetch Google).
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailSkip, setDetailSkip] = useState(false);
  // Widok miejsc: szczegolowy (karty) | lista (kompakt) - jak toggle na home/dzienniku.
  const [placeView, setPlaceView] = useState<"detail" | "list">("detail");
  // Podglad miejsca spoza bazy PRZED dodaniem (TYLKO okladka - min. kosztow Google).
  const [customPreview, setCustomPreview] = useState<Omit<RankingItem, "key" | "short_desc"> | null>(null);
  const [author, setAuthor] = useState<{ name: string; avatar: string | null }>({ name: "Użytkownik", avatar: null });


  // Dociagnij dane B2B dla wybranych miejsc (po place_id) - pelny adres, tagi, kategorie.
  const placeIdsKey = items.map((i) => i.place_id).filter(Boolean).join(",");
  useEffect(() => {
    const ids = items.map((i) => i.place_id).filter(Boolean) as string[];
    if (!ids.length) { setBizMap({}); return; }
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("id, business_profiles(street, postal_code, address, tags, main_category, secondary_category)")
        .in("id", ids);
      if (!alive) return;
      const m: Record<string, any> = {};
      for (const p of data ?? []) {
        const bp = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
        if (bp) m[p.id] = bp;
      }
      setBizMap(m);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdsKey]);

  // #3: okladki miejsc ze zdjec dodanych przez userow w wizytowkach (place_photos) - dla miejsc bez
  // wlasnego zdjecia. Wypelniamy item.photo_url (raz per klucz) -> pokazuje sie w kartach/liscie i
  // zapisuje sie na discovery_items przy publikacji. Losowy (stabilny) wybor sposrod zdjec miejsca.
  const filledCoverKeysRef = useRef<Set<string>>(new Set());
  const missingCoverKey = items.filter((i) => !i.photo_url).map((i) => i.place_name).join("|");
  useEffect(() => {
    const missing = items.filter((i) => !i.photo_url);
    const keys = Array.from(new Set(missing.flatMap((i) => pinCoverKeys({ google_place_id: i.google_place_id, place_name: i.place_name }))))
      .filter((k) => k && !filledCoverKeysRef.current.has(k));
    if (!keys.length) return;
    keys.forEach((k) => filledCoverKeysRef.current.add(k));
    let alive = true;
    fetchPlacePhotosForKeys(keys).then((map) => {
      if (!alive || map.size === 0) return;
      setItems((prev) => prev.map((i) => {
        if (i.photo_url) return i;
        const cover = pickPlaceCover(map, pinCoverKeys({ google_place_id: i.google_place_id, place_name: i.place_name }));
        return cover ? { ...i, photo_url: cover } : i;
      }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingCoverKey]);

  // ── Author + edit/liked prefill ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setAuthor({ name: (data as any).first_name || (data as any).username || "Użytkownik", avatar: (data as any).avatar_url ?? null }); });
  }, [user]);

  useEffect(() => {
    if (editId) {
      (async () => {
        const { data: col } = await (supabase as any).from("discovery_collections").select("title, city, category, description, author_name, author_avatar, cover_url, list_cover_url, tags, list_status, is_public").eq("id", editId).maybeSingle();
        if (col) {
          setTitle(col.title ?? ""); setTitleDirty(true); if (col.city) { setCity(col.city); setCountry(countryForCity(col.city)); } setCategory(col.category ?? null);
          setDescription(col.description ?? "");
          setAsAnon(col.author_name === "Anonim" && !col.author_avatar);
          setCoverUrl(col.cover_url ?? null); setListCoverUrl(col.list_cover_url ?? null);
          setTags(Array.isArray(col.tags) ? col.tags : []);
          setListStatus(col.list_status ?? null);
        }
        const { data: its } = await (supabase as any).from("discovery_items").select("*").eq("collection_id", editId).order("order_index", { ascending: true });
        if (its) setItems(its.map((i: any, idx: number) => ({
          key: `e${idx}`, place_id: i.place_id ?? null, place_name: i.place_name, category: i.category ?? inferCategoryFromName(i.place_name),
          address: i.address ?? null, latitude: i.latitude ?? null, longitude: i.longitude ?? null,
          rating: i.rating ?? null, google_place_id: i.google_place_id ?? null, photo_url: i.photo_url ?? null, short_desc: i.short_desc ?? "",
          tags: Array.isArray(i.tags) ? i.tags : [],
        })));
      })();
      return;
    }
    // Prefill z polubionych danego miasta.
    if (params.get("from") === "liked") {
      const liked = getHistoryByCity().find((g) => g.city === city)?.places ?? [];
      if (liked.length) {
        (async () => {
          const names = liked.map((p) => p.place_name);
          const { data: rows } = await (supabase as any).from("places").select("id, place_name, category, address, latitude, longitude, rating, photo_url").in("city", expandCity(city)).in("place_name", names);
          const byName = new Map<string, any>((rows ?? []).map((r: any) => [r.place_name.toLowerCase(), r]));
          setItems(liked.map((p, idx) => {
            const m = byName.get(p.place_name.toLowerCase());
            return {
              key: `l${idx}`, place_id: m?.id ?? null, place_name: p.place_name, category: m?.category ?? p.category ?? null,
              address: m?.address ?? p.address ?? null, latitude: m?.latitude ?? p.latitude ?? null, longitude: m?.longitude ?? p.longitude ?? null,
              rating: m?.rating ?? p.rating ?? null, google_place_id: null, photo_url: m?.photo_url ?? p.photo_url ?? null, short_desc: "",
            };
          }));
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Prefill z handoffu Trasa->Lista (CreateModeToggle) - przenosi miasto + wybrane miejsca
  // (+ tytul), zeby przelaczenie use case nie kasowalo wpisanej pracy. Tylko nowa lista.
  useEffect(() => {
    if (editId) return;
    const st = (location.state ?? {}) as { city?: string | null; title?: string | null; places?: any[] };
    if (st.city) { setCity(st.city); setCountry(countryForCity(st.city)); }
    if (st.title) { setTitle(st.title); setTitleDirty(true); }
    if (Array.isArray(st.places) && st.places.length) {
      setItems(st.places.map((p: any, idx: number) => ({
        key: `h${idx}`, place_id: p.place_id ?? null, place_name: p.place_name, category: p.category ?? null,
        address: p.address ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
        rating: p.rating ?? null, google_place_id: p.google_place_id ?? null, photo_url: p.photo_url ?? null, short_desc: "",
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addItem = (it: Omit<RankingItem, "key" | "short_desc">) => {
    if (items.some((x) => x.place_name.toLowerCase() === it.place_name.toLowerCase())) { toast(t("toast.already_added")); return; }
    const key = `k${Date.now()}`;
    setItems((prev) => [...prev, { ...it, key, short_desc: "" }]);
    // #5: miejsce bez okladki (dodane z Google) -> zcache'uj zdjecie ASYNCHRONICZNIE (nie blokuj
    // dodania). 1 fetch Google/miejsce, potem $0 (guard kosztowy w edge function). Miejsca z bazy
    // maja juz photo_url z cache - pomijamy (zero kosztu). Null z helpera -> zostaje ikona kategorii.
    if (!it.photo_url) {
      void cacheListItemPhoto({ place_name: it.place_name, city, latitude: it.latitude, longitude: it.longitude, google_place_id: it.google_place_id })
        .then((url) => { if (url) setItems((prev) => prev.map((x) => x.key === key ? { ...x, photo_url: url } : x)); });
    }
  };
  const removeItem = (key: string) => setItems((prev) => prev.filter((x) => x.key !== key));
  const setNote = (key: string, v: string) => setItems((prev) => prev.map((x) => x.key === key ? { ...x, short_desc: v } : x));
  // Tagi per miejsce (alternatywa dla notki, jak pins.tags przy trasach). Klik = toggle w it.tags.
  const toggleItemTag = (key: string, tag: string) => setItems((prev) => prev.map((x) => {
    if (x.key !== key) return x;
    const cur = x.tags ?? [];
    return { ...x, tags: cur.includes(tag) ? cur.filter((tg) => tg !== tag) : [...cur, tag] };
  }));
  // Kolejnosc zmienia drag & drop (Reorder) w widoku listy; order_index z pozycji w tablicy.

  // Otworz wizytowke miejsca. Miejsca z bazy (place_id) dociagaja galerie/recenzje
  // z Google. Miejsca spoza bazy (custom) NIE dociagaja niczego (min. kosztow) -
  // pokazujemy tylko to co mamy (okladka + nazwa + adres).
  const openDetail = (it: RankingItem) => {
    setDetailSkip(!it.place_id);
    setDetailPlace({
      id: it.place_id ?? it.google_place_id ?? it.place_name,
      place_name: it.place_name, category: it.category || "other",
      city, address: it.address ?? "", latitude: it.latitude ?? 0, longitude: it.longitude ?? 0,
      rating: it.rating ?? 0, photo_url: it.photo_url ?? "", vibe_tags: [], description: "",
    } as MockPlace);
  };

  const addedNames = new Set(items.map((x) => x.place_name.toLowerCase()));

  // Dodaj miejsce z bazy (wynik wyszukiwarki lub propozycji).
  const addDbPlace = (r: any) => {
    addItem({ place_id: r.id, place_name: r.place_name, category: r.category ?? null, address: r.address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null, rating: r.rating ?? null, google_place_id: null, photo_url: r.photo_url ?? null });
    setSuggestions((prev) => prev.filter((s) => s.id !== r.id));
  };

  // "Twoje zapisane miejsca" (z eksploracji, per miasto) - szybka sciaga do dodania jednym tapem.
  // Zastapily "Propozycje z bazy". id = place_id (do addItem) lub null (custom); key osobny.
  // "Twoje zapisane miejsca" = lista OGÓLNA usera (wszystkie zapisy z drawera, bez filtra miasta -
  // decyzja 2026-08-24). Źródło = DB wishlista to_visit (fetchSavedPlaces), spójne z CreateFlowSheet.
  const { data: savedPlaces = [] } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchSavedPlaces(user!.id),
  });
  const savedForCity = useMemo(() => {
    const places = (savedPlaces as any[]).map((p) => ({
      key: p.place_id ?? p.place_name, id: p.place_id ?? null, place_name: p.place_name, category: p.category,
      address: p.address ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      rating: p.rating ?? null, photo_url: p.photo_url ?? null,
    }));
    return { places, fallback: false };
  }, [savedPlaces]);

  // Dodaj miejsce spoza bazy (wynik Google text search). Dociagamy okladke/rating/place_id
  // przez proxy dopiero przy dodaniu (nie dla kazdego wyniku - min. kosztow Google).
  const addGooglePlace = async (g: any) => {
    if (addingGoogleName) return;
    setAddingGoogleName(g.name);
    const res = await fetchGooglePlace({ name: g.name, address: g.full_address, lat: g.latitude, lng: g.longitude, city });
    setAddingGoogleName(null);
    if (!res || !res.place_name) { toast.error(t("toast.add_failed")); return; }
    // Kategoria z typow Google (jak w wynikach wyszukiwarki) - zeby ikona po DODANIU
    // byla ta sama co w liscie wynikow (fetchGooglePlace zwraca category=null).
    addItem({ ...res, category: res.category ?? categoryFromGoogleTypes(g.types) ?? inferCategoryFromName(res.place_name) });
    setGoogleResults((prev) => prev.filter((x) => x.name !== g.name));
  };

  // Miejsce spoza bazy: najpierw POKAZ wizytowke do zatwierdzenia (Google proxy),
  // dopiero po "Dodaj" trafia na liste. User widzi co dodaje.
  const previewCustomByName = async (name: string) => {
    if (!name.trim() || addingCustom) return;
    setAddingCustom(true);
    // Najpierw TEXTSEARCH (zwraca typy Google -> realna kategoria, bez Place Details).
    // Preferujemy trafienie w wybranym miescie; fallback = geocode (bez typow) + inferencja.
    let res: Omit<RankingItem, "key" | "short_desc"> | null = null;
    try {
      const hits = await forwardGeocodeWithTypes(`${name.trim()} ${city}`.trim());
      const cityAliases = city ? expandCity(city).map((c) => c.toLowerCase()) : [];
      const best = (cityAliases.length ? hits.find((h) => cityAliases.some((c) => (h.full_address ?? "").toLowerCase().includes(c))) : hits[0]) ?? hits[0];
      if (best?.name) {
        res = {
          place_id: null, place_name: best.name,
          category: categoryFromGoogleTypes(best.types) ?? inferCategoryFromName(best.name),
          address: best.full_address ?? null, latitude: best.latitude ?? null, longitude: best.longitude ?? null,
          rating: null, google_place_id: null, photo_url: null,
        };
      }
    } catch { /* fallback ponizej */ }
    if (!res) res = await fetchGooglePlace({ name: name.trim(), city });
    setAddingCustom(false);
    if (!res || !res.place_name) { toast.error(t("toast.not_found")); return; }
    // Gwarancja kategorii nawet gdy fallback geocode nie mial typow.
    if (!res.category) res = { ...res, category: inferCategoryFromName(res.place_name) };
    setCustomPreview(res);
  };
  const confirmCustom = () => {
    if (!customPreview) return;
    addItem({ ...customPreview, category: customPreview.category ?? inferCategoryFromName(customPreview.place_name) });
    setCustomPreview(null);
    setSearch("");
    setSearchResults([]);
  };

  // Wyszukiwarka miejsc (debounce). Najpierw pokazujemy WSZYSTKIE dopasowania z bazy,
  // a nastepnie dopelniamy ~3 nowymi miejscami spoza bazy (Google text search).
  // Puste query -> brak wynikow (pokazujemy propozycje).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); setGoogleResults([]); setGoogleLoading(false); return; }
    setSearchLoading(true);
    setGoogleLoading(true);
    setGoogleResults([]);
    const t = setTimeout(async () => {
      // Miasto opcjonalne: gdy wybrane -> filtr; gdy "Wszedzie" (city="") -> szukamy globalnie.
      let dbq = (supabase as any).from("places")
        .select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .ilike("place_name", `%${q}%`).eq("is_active", true).limit(50);
      if (city) dbq = dbq.in("city", expandCity(city));
      const { data } = await dbq;
      const dbRows = data ?? [];
      setSearchResults(dbRows); setSearchLoading(false);
      // Dopelnienie: miejsca spoza bazy z Google (max 3), z pominieciem duplikatow nazw z DB.
      try {
        const g = await forwardGeocodeWithTypes(`${q} ${city}`.trim());
        const dbNames = new Set(dbRows.map((r: any) => (r.place_name ?? "").toLowerCase().trim()));
        // Gdy wybrane miasto -> odrzucamy wyniki spoza niego. Gdy "Wszedzie" -> akceptujemy globalnie.
        const cityAliases = city ? expandCity(city).map((c) => c.toLowerCase()) : [];
        const seen = new Set<string>();
        const extra = g
          .filter((x) => {
            const name = (x.name ?? "").toLowerCase().trim();
            if (!name || dbNames.has(name) || seen.has(name)) return false;
            // Odrzuc czyste wyniki geograficzne (miasta, dzielnice, drogi) - chcemy lokale.
            const geoOnly = ["locality", "sublocality", "administrative_area_level_1", "administrative_area_level_2", "country", "route", "postal_code", "political"];
            if ((x.types ?? []).length > 0 && (x.types ?? []).every((t) => geoOnly.includes(t))) return false;
            // Tylko lokale w wybranym miescie (gdy miasto ustawione). "Wszedzie" -> bez filtra miasta.
            if (cityAliases.length) {
              const addr = (x.full_address ?? "").toLowerCase();
              if (!cityAliases.some((c) => addr.includes(c))) return false;
            }
            seen.add(name);
            return true;
          })
          .slice(0, 3);
        setGoogleResults(extra);
      } catch { setGoogleResults([]); }
      setGoogleLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, city]);

  // Propozycje: losowe miejsca z bazy dla miasta, dopasowane do motywu (inteligentne
  // rekomendacje - np. "lokalne smaki" -> restauracje/kawiarnie/bary).
  useEffect(() => {
    let alive = true;
    (async () => {
      const cats = themeDbCategories(category);
      let q = (supabase as any).from("places")
        .select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .eq("is_active", true);
      if (city) q = q.in("city", expandCity(city));
      if (cats) q = q.in("category", cats);
      const { data } = await q.limit(40);
      if (!alive) return;
      const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, 15);
      setSuggestions(shuffled);
    })();
    return () => { alive = false; };
  }, [city, category]);

  const collectionTitle = title.trim() || "Lista";
  const isRoute = isRouteCollection(category); // stare trasy (edycja) -> mozna ustawiac kolejnosc
  const canGoNext = items.length >= 1 && title.trim().length > 0; // krok 1 -> 2 (min. 1 miejsce, miasto opcjonalne)
  const canPublish = canGoNext && !publishing;
  // Przejscie do kroku 2 - gdy warunki niespelnione, TOAST z powodem (guzik nie jest disabled).
  const goNext = () => {
    if (title.trim().length === 0) { toast(t("cta.need_title", "Dodaj nazwę listy")); return; }
    if (items.length < 1) { toast(t("cta.need_one", "Dodaj co najmniej jedno miejsce")); return; }
    setStep(2);
  };

  const publish = async () => {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      let collectionId = editId;
      // Wszystkie nowe zestawienia czekaja na akceptacje admina (App Store Guideline
      // 1.2 UGC + decyzja: moderacja na starcie dla wszystkich, nie tylko anonimow).
      // Widoczność z list_status: NOWA lista (default "visited") = publiczna polecajka.
      // EDYCJA istniejącej -> zachowaj stan (prywatna to_visit zostaje prywatna, nie flip na public).
      // null (przed doładowaniem na edycji) -> "visited" (bezpiecznie, list_status jest NOT NULL).
      const listStatusToSave = listStatus === "to_visit" ? "to_visit" : "visited";
      // Wszystkie kuratorskie listy (visited) sa PUBLICZNE (decyzja 2026-08-24: rozwoj bazy
      // discovery, brak opcji "prywatna"). Prywatna zostaje tylko wishlista to_visit.
      const isPublic = listStatusToSave === "visited";
      const moderationStatus = isPublic ? "pending" : "approved";
      const authorName = asAnon ? "Anonim" : author.name;
      const authorAvatar = asAnon ? null : author.avatar;
      const desc = description.trim() || null;
      // Okladki: hero (cover_url) + miniatura eksploracji (list_cover_url). Gdy user nic nie
      // wybral, zapisujemy zdjecie pierwszego miejsca jako sensowny default (fallback UI i tak
      // to robi, ale utrwalenie daje spojnosc w feedzie/edycji).
      const firstItemPhoto = items.find((it) => it.photo_url)?.photo_url ?? null;
      const coverToSave = coverUrl ?? firstItemPhoto;
      const listCoverToSave = listCoverUrl ?? firstItemPhoto;
      const tagsToSave = tags.map((x) => x.trim()).filter(Boolean).slice(0, 20);
      // Miasto opcjonalne: "" (Wszedzie) -> null (lista globalna, karta pokaze tylko liczbe miejsc).
      const cityToSave = city.trim() || null;
      if (editId) {
        await (supabase as any).from("discovery_collections").update({ title: collectionTitle, city: cityToSave, category, description: desc, is_public: isPublic, author_name: authorName, author_avatar: authorAvatar, cover_url: coverToSave, list_cover_url: listCoverToSave, tags: tagsToSave, list_status: listStatusToSave, updated_at: new Date().toISOString() }).eq("id", editId);
        await (supabase as any).from("discovery_items").delete().eq("collection_id", editId);
      } else {
        const { data: col, error } = await (supabase as any).from("discovery_collections").insert({
          user_id: user.id, author_name: authorName, author_avatar: authorAvatar, title: collectionTitle,
          category, city: cityToSave, description: desc, kind: "ranking", is_public: isPublic,
          cover_url: coverToSave, list_cover_url: listCoverToSave, tags: tagsToSave,
          list_status: listStatusToSave, moderation_status: moderationStatus,
        }).select("id").single();
        if (error || !col) throw new Error(error?.message ?? "insert failed");
        collectionId = col.id;
      }
      const rows = items.map((it, idx) => ({
        collection_id: collectionId, order_index: idx, place_id: it.place_id, place_name: it.place_name,
        category: it.category, address: it.address, latitude: it.latitude, longitude: it.longitude,
        rating: it.rating, google_place_id: it.google_place_id, photo_url: it.photo_url, short_desc: it.short_desc.trim() || null,
        tags: (it.tags ?? []).slice(0, 8),
      }));
      const { error: itemsErr } = await (supabase as any).from("discovery_items").insert(rows);
      if (itemsErr) throw new Error(itemsErr.message);
      // Kazda nowa publikacja -> powiadom admina mailem do moderacji (best-effort, nie blokuj flow).
      if (!editId) {
        supabase.functions.invoke("notify-admin-content", {
          body: { type: "ranking", title: collectionTitle, city, collection_id: collectionId, author: author.name },
        }).catch((e) => console.warn("[CreateRanking] notify-admin-content failed:", e));
      }
      toast.success(editId ? t("toast.updated") : t("toast.sent"));
      // Listy widoczne w profilu (zakładka Listy). Kieruj na profil zamiast na pusty feed -
      // inaczej user ma wrazenie, ze nic sie nie zapisalo. (Osobny widok "Twoje listy" usuniety, IA 2026-08-20.)
      navigate("/moj-profil");
    } catch (e: any) {
      toast.error(t("toast.save_failed", { error: e?.message ?? t("error_fallback") }));
    } finally {
      setPublishing(false);
    }
  };

  // ── Okladki (hero + miniatura) - opcje = zdjecia miejsc listy + upload nowego ──
  const firstItemPhoto = items.find((i) => i.photo_url)?.photo_url ?? null;
  const heroCover = coverUrl ?? firstItemPhoto ?? getRandomPinPlaceholder(editId ?? title);
  const listCover = listCoverUrl ?? firstItemPhoto ?? heroCover;
  // Pierwsza opcja: domyslne tlo (gradient zolto-zloty), potem zdjecia miejsc listy.
  const coverOptions: CoverOption[] = [
    { id: "__gradient__", name: "Domyślne tło", url: GRADIENT_COVER },
    ...items.filter((i) => i.photo_url).map((i) => ({ id: i.key, name: i.place_name, url: i.photo_url as string })),
  ];
  const applyCover = (url: string) => {
    if (pickerTarget === "hero") setCoverUrl(url);
    else if (pickerTarget === "list") setListCoverUrl(url);
    setPickerTarget(null);
  };
  const handleCoverFiles = async (files: File[]) => {
    if (!user || !files.length || uploadingCover) return;
    setUploadingCover(true);
    const url = await uploadCoverImage(files[0], user.id);
    setUploadingCover(false);
    if (url) applyCover(url);
    else toast.error(t("cover.upload_error", "Nie udało się wgrać zdjęcia"));
  };
  const triggerCoverUpload = async () => {
    if (uploadingCover) return;
    if (isNative) { try { const f = await pickNativeCoverFiles(1); await handleCoverFiles(f); } catch { /* cancel */ } }
    else coverFileInputRef.current?.click();
  };

  const mapPins = items.filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ latitude: i.latitude!, longitude: i.longitude!, place_name: i.place_name }));

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header - hub tworzenia (krok 1, nowa lista): wiersz 1 = back + zakladki Twórz|Robocze|
          Zapisane; wiersz 2 = toggle Trasa|Lista wysrodkowany (ta sama pozycja co w trasie).
          Krok 2 / edycja = prosty naglowek z tytulem. */}
      {step === 1 && !editId ? (
        <CreateHeader
          active="tworz"
          mode="listy"
          onMode={(m) => {
            if (m === "trasy") navigate("/wyjazd/nowy", {
              state: {
                city,
                title: titleDirty ? title : null,
                places: items.map((i) => ({
                  place_name: i.place_name, category: i.category, address: i.address,
                  latitude: i.latitude, longitude: i.longitude, photo_url: i.photo_url,
                  place_id: i.place_id, google_place_id: i.google_place_id,
                })),
              },
              replace: true,
            });
          }}
          onBack={() => (window.history.length > 1 ? navigate(-1) : navigate("/eksploruj"))}
        />
      ) : (
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button onClick={() => (step === 2 ? setStep(1) : (window.history.length > 1 ? navigate(-1) : navigate("/eksploruj")))} aria-label={t("header.back")} className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 font-bold text-base truncate">{step === 2 ? t("header.notes_and_map") : editId ? t("header.edit_collection") : t("header.new_collection")}</span>
        </div>
      )}

      {/* ══ KROK 1: miasto + wyszukiwarka (sticky) + propozycje + wybrane miejsca ══ */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto">
          {/* Hint: jedno zdanie czym jest lista */}
          <div className="px-4 pt-4">
            <p className="text-sm text-muted-foreground leading-snug">
              {`Lista to zbiór Twoich ulubionych miejsc bez ustalonej kolejności - np. Twoje ukochane kawiarnie w mieście.`}
            </p>
          </div>
          {/* Nazwa listy (generyczna domyslna, edytowalna) */}
          <div className="px-4 pt-3">
            <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleDirty(true); }} maxLength={80}
              onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)}
              placeholder={t("name_placeholder", "Nazwa listy")}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
          </div>

          {/* OPCJONALNY filtr miasta wyszukiwarki (miasto NIE jest obowiazkowe - lista moze byc
              globalna). Domyslnie "Wszedzie" (city="") -> szukamy na calym swiecie. User moze zawezic
              do miasta i dolozyc miejsca z roznych miast do JEDNEJ listy (Krakow + Olsztyn...). */}
          <div className="px-4 pt-3">
            <button type="button" onClick={() => setCityPickerOpen((o) => !o)}
              className="w-full flex items-center gap-2 rounded-2xl bg-secondary text-secondary-foreground px-4 py-3 active:opacity-80 transition-opacity">
              <span className="text-sm text-muted-foreground shrink-0">{`Szukasz w:`}</span>
              <span className="flex-1 text-left text-sm font-bold text-foreground truncate">{city || "Wszędzie"}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${cityPickerOpen ? "rotate-180" : ""}`} />
            </button>
            {cityPickerOpen && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="relative">
                  {/* Gdy miasto = "Wszedzie" (city=""), kraj tez pokazuje "Wszedzie". Wybor realnego
                      kraju zawezaja do jego pierwszego miasta; wybor "Wszedzie" -> globalnie (city=""). */}
                  <select value={city ? country : ""} onChange={(e) => { const v = e.target.value; if (!v) setCity(""); else onCountryChange(v); }}
                    className="w-full appearance-none rounded-2xl bg-secondary text-secondary-foreground border-0 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/40">
                    <option value="">Wszędzie</option>
                    {TRIP_REGIONS.map((region) => (
                      <optgroup key={region} label={region}>
                        {TRIP_COUNTRIES.filter((c) => c.region === region).map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <select value={city} onChange={(e) => setCity(e.target.value)}
                    className="w-full appearance-none rounded-2xl bg-secondary text-secondary-foreground border-0 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/40">
                    <option value="">Wszędzie (cały świat)</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
            {items.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                {`Miasto jest opcjonalne - możesz dodać miejsca z różnych miast do tej samej listy.`}
              </p>
            )}
          </div>

          {/* Wyszukiwarka - sticky na gorze, ale NIE podczas edycji nazwy (inaczej naježdža
              na pole nazwy gdy klawiatura przewija widok). */}
          <div className={`${titleFocused ? "" : "sticky top-0 z-20"} bg-background px-4 pt-3 pb-2`}>
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
              <input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={t("search.placeholder", { city })}
                className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 pl-9 pr-3 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
            </div>
          </div>

          {/* Wyniki wyszukiwarki - tuz pod wyszukiwarka (tylko podczas szukania) */}
          {search.trim().length >= 2 && (
            <div className="px-4">
              <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-background/60">
                {searchLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
                {searchResults.filter((r) => !addedNames.has(r.place_name.toLowerCase())).map((r) => (
                  <button key={r.id} onClick={() => addDbPlace(r)}
                    className="w-full flex items-center gap-3 p-2.5 active:bg-background/50 text-left">
                    {r.photo_url ? <img src={r.photo_url} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0" /> : <div className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0"><CategoryIcon category={r.category} className="w-1/2" /></div>}
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{r.place_name}</p>{r.address && <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>}</div>
                    <Plus className="h-4 w-4 text-orange-600 shrink-0" />
                  </button>
                ))}
                {/* Nowe miejsca spoza bazy (Google) - dopelnienie wynikow z DB. */}
                {googleLoading && !searchLoading && (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> {t("search.searching_more")}
                  </div>
                )}
                {googleResults.filter((g) => !addedNames.has((g.name ?? "").toLowerCase())).map((g) => (
                  <button key={g.name + g.latitude} onClick={() => addGooglePlace(g)} disabled={!!addingGoogleName}
                    className="w-full flex items-center gap-3 p-2.5 active:bg-background/50 text-left disabled:opacity-50">
                    <div className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0"><CategoryIcon category={categoryFromGoogleTypes(g.types)} className="w-1/2" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{g.name}</p>
                        <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5 shrink-0">{t("search.badge_new")}</span>
                      </div>
                      {g.full_address && <p className="text-[11px] text-muted-foreground truncate">{g.full_address}</p>}
                    </div>
                    {addingGoogleName === g.name ? <Loader2 className="h-4 w-4 animate-spin text-orange-600 shrink-0" /> : <Plus className="h-4 w-4 text-orange-600 shrink-0" />}
                  </button>
                ))}
                {/* Stan pusty - brak dopasowan w miescie (najczesciej literowka). */}
                {!searchLoading && !googleLoading
                  && searchResults.filter((r) => !addedNames.has(r.place_name.toLowerCase())).length === 0
                  && googleResults.filter((g) => !addedNames.has((g.name ?? "").toLowerCase())).length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm font-semibold">{t("search.empty_title", { city })}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">{t("search.empty_hint")}</p>
                  </div>
                )}
                {!searchLoading && !googleLoading && (
                  <button onClick={() => previewCustomByName(search)} disabled={addingCustom}
                    className="w-full flex items-center gap-2 p-3 text-left active:bg-background/50 disabled:opacity-50">
                    {addingCustom ? <Loader2 className="h-4 w-4 animate-spin text-orange-600 shrink-0" /> : <Search className="h-4 w-4 text-orange-600 shrink-0" />}
                    <span className="text-sm font-semibold">{t("search.preview_cta", { query: search.trim() })}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Wybrane miejsca - DUZE karty (styl jak dziennik/home) + szkielet "Dodaj miejsce".
              Bez notek - notki na kroku 2. */}
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("places.selected", { count: items.length })}</p>
              {items.length > 0 && (
                <div className="flex rounded-full bg-secondary p-0.5">
                  <button type="button" onClick={() => setPlaceView("list")} aria-label={t("places.view_list")} className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    <List className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setPlaceView("detail")} aria-label={t("places.view_cards")} className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "detail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    <GalleryHorizontalEnd className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {placeView === "list" ? (
              // ── Widok listy z DRAG & DROP (1:1 z tworzeniem trasy). Uchwyt zmienia kolejnosc;
              //    order_index zapisuje sie z pozycji przy publikacji. ──
              <>
                <Reorder.Group key={items.length} axis="y" values={items} onReorder={setItems} className="space-y-2.5">
                  {items.map((it) => (
                    <SortableRankingRow key={it.key} it={it} onOpen={() => openDetail(it)} onRemove={() => removeItem(it.key)} />
                  ))}
                </Reorder.Group>
                {/* Dodaj miejsce - pelna szerokosc pod lista */}
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="mt-2.5 w-full rounded-2xl border-2 border-dashed border-border/70 bg-secondary/40 flex flex-col items-center justify-center gap-2 py-5 text-muted-foreground active:scale-[0.99] transition-transform"
                >
                  <span className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"><Plus className="h-5 w-5 text-orange-600" /></span>
                  <span className="text-sm font-bold text-foreground">{t("places.add")}</span>
                  <span className="text-[12px] text-center">{t("places.add_hint")}</span>
                </button>
              </>
            ) : (
              // ── Widok kart (karuzela 4:3) - bez dnd (kolejnosc przez widok listy). ──
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
                {items.map((it, idx) => {
                  const cat = categoryBadge(it.category);
                  // Premium B2B: pelne dane z business_profiles (adres, kategoria glowna+druga, tagi).
                  const bp = it.place_id ? bizMap[it.place_id] : null;
                  const bpAddress = bp?.street
                    ? [bp.street, [bp.postal_code, city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
                    : (bp?.address || null);
                  const bpTags: string[] = Array.isArray(bp?.tags) ? bp.tags.filter(Boolean) : [];
                  return (
                    <div key={it.key} className="relative shrink-0 w-[80%] snap-start rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm">
                      <button onClick={() => openDetail(it)} className="w-full text-left active:opacity-90 transition-opacity">
                        <div className="relative w-full aspect-[4/3] bg-muted">
                          {it.photo_url
                            ? <img src={it.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            : <div className="absolute inset-0 flex items-center justify-center bg-[#fcede3]"><CategoryIcon category={it.category} className="w-1/4 max-w-[72px]" /></div>}
                          {isRoute && <span className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center shadow-sm">{idx + 1}</span>}
                        </div>
                        <div className="px-4 pt-3 pb-3.5">
                          {/* Kategorie: premium -> glowna + druga; zwykle miejsce -> pojedynczy badge. */}
                          {bp ? (
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              {bp.main_category && <span className="inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold">{mainCategoryLabel(bp.main_category)}</span>}
                              {bp.secondary_category && bp.secondary_category !== bp.main_category && <span className="inline-flex items-center rounded-full bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{mainCategoryLabel(bp.secondary_category)}</span>}
                            </div>
                          ) : (
                            cat && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold mb-1.5"><CategoryIcon category={it.category} className="h-3 w-3 shrink-0" />{cat.label}</span>
                          )}
                          <p className="text-[15px] font-bold leading-snug">{it.place_name}</p>
                          {/* Pelny adres (premium bez truncate) lub zwykly adres (truncate). */}
                          {(bpAddress || it.address) && <p className={`text-[12px] text-muted-foreground leading-snug mt-1 ${bpAddress ? "" : "truncate"}`}>{bpAddress || it.address}</p>}
                          {/* Tagi lokalu (premium). */}
                          {bpTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {bpTags.slice(0, 4).map((tg) => (
                                <span key={tg} className="text-[10px] font-medium text-foreground/70 bg-background rounded-full px-2 py-0.5">{tg}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button onClick={() => removeItem(it.key)} aria-label={t("places.remove")} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-destructive active:scale-95 transition-transform"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
                {/* Dodaj miejsce - kafel w karuzeli */}
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="rounded-2xl border-2 border-dashed border-border/70 bg-secondary/40 flex flex-col items-center justify-center gap-2 shrink-0 w-[80%] snap-start self-stretch min-h-[240px] px-4 text-muted-foreground active:scale-[0.99] transition-transform"
                >
                  <span className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"><Plus className="h-5 w-5 text-orange-600" /></span>
                  <span className="text-sm font-bold text-foreground">{t("places.add")}</span>
                  <span className="text-[12px] text-center">{t("places.add_hint")}</span>
                </button>
              </div>
            )}
          </div>

          {/* "Twoje zapisane miejsca" - szybka sciaga (zamiast propozycji z bazy). Ukryte podczas szukania. */}
          {search.trim().length < 2 && (() => {
            const saved = savedForCity.places.filter((s) => !addedNames.has(s.place_name.toLowerCase()));
            return (
              <div className="px-4 pb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  {savedForCity.fallback && saved.length > 0 ? "Twoje zapisane miejsca (z innych miast)" : "Twoje zapisane miejsca"}
                </p>
                {saved.length > 0 ? (
                  <div className="flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
                    {saved.map((s) => (
                      <button key={s.key} onClick={() => addDbPlace(s)}
                        className="shrink-0 w-[40%] snap-start rounded-2xl bg-secondary overflow-hidden text-left active:scale-[0.97] transition-transform">
                        <div className="relative aspect-[4/3] bg-background">
                          {s.photo_url ? <img src={s.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#fcede3]"><CategoryIcon category={s.category} className="w-1/3 max-w-[56px]" /></div>}
                          <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm"><Plus className="h-3.5 w-3.5" /></div>
                        </div>
                        <p className="text-xs font-bold leading-tight truncate px-2 py-2">{s.place_name}</p>
                      </button>
                    ))}
                    <div className="shrink-0 w-1" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-snug">{`Nie masz jeszcze zapisanych miejsc. Polub miejsca w eksploracji, żeby dodać je tu jednym tapem.`}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ KROK 2: glowna notka + notki do miejsc + mapa + anonimowo ══ */}
      {step === 2 && (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {/* Okladki listy: hero (cover_url) + miniatura eksploracji (list_cover_url) - 1:1
              z modelem tras. Tap w kafel = picker (zdjecia miejsc / wgraj nowe). */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">{`Okładka`}</label>
            <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
              <img src={heroCover} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/55" />
              {/* Hero = okladka listy (lewy-dolny rog) */}
              <button
                type="button"
                onClick={() => setPickerTarget("hero")}
                aria-label={t("cover.change_hero_aria", "Zmień okładkę listy")}
                className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-full bg-black/45 backdrop-blur-sm text-white text-xs font-bold active:scale-95 transition-transform"
              >
                <ImageIcon className="h-[18px] w-[18px]" /> {t("cover.hero_label", "Okładka")}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">{`Okładka to zdjęcie w widoku listy.`}</p>
          </div>

          {/* Tagi listy (zamiast glownej notki) - chip-cloud (wszystkie widoczne) + wlasne usera. */}
          <div className="pt-6">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              {t("tags.label", "Tagi")} <span className="normal-case font-medium text-muted-foreground/50">{t("notes.optional")}</span>
            </label>
            <p className="text-[12px] text-muted-foreground leading-snug mb-2.5">{t("tags.hint", "Dodaj tagi, żeby inni łatwiej trafili na Twoją listę.")}</p>
            <div className="flex flex-wrap gap-2">
              {/* Wlasne tagi usera (spoza predefiniowanych) - zawsze widoczne, zaznaczone */}
              {tags.filter((tg) => !PREDEFINED_TAGS.includes(tg)).map((tg) => (
                <button key={tg} type="button" onClick={() => toggleTag(tg)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#FDF184] border border-[#FDCD84] text-foreground text-sm font-semibold active:scale-95 transition-transform">
                  {tg} <X className="h-3.5 w-3.5" />
                </button>
              ))}
              {/* Chip-cloud: wszystkie predefiniowane tagi widoczne od razu (wybrany = zolty fill #6) */}
              {PREDEFINED_TAGS.map((tg) => {
                const on = tags.includes(tg);
                return (
                  <button key={tg} type="button" onClick={() => toggleTag(tg)}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-transform border ${on ? "bg-[#FDF184] border-[#FDCD84] text-foreground" : "bg-secondary border-transparent text-secondary-foreground"}`}>
                    {tg}
                  </button>
                );
              })}
            </div>
            {/* Wlasny tag */}
            <div className="flex gap-2 mt-2.5">
              <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} maxLength={30}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                placeholder={t("tags.custom_placeholder", "Dodaj własny tag")}
                className="flex-1 min-w-0 rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
              <button type="button" onClick={addCustomTag} disabled={!customTag.trim()}
                className="shrink-0 px-4 rounded-2xl bg-secondary text-secondary-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40">
                {t("tags.add", "Dodaj")}
              </button>
            </div>
          </div>

          {/* Notki do poszczegolnych miejsc. */}
          <div className="pt-6">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">{t("notes.places_label")}</label>
            <div className="space-y-2.5">
              {items.map((it) => (
                <div key={it.key} className="rounded-2xl bg-secondary p-2.5">
                  <div className="flex items-center gap-2.5">
                    {it.photo_url
                      ? <img src={it.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                      : <div className="h-10 w-10 rounded-lg bg-[#fcede3] flex items-center justify-center shrink-0"><CategoryIcon category={it.category} className="w-1/2" /></div>}
                    <p className="text-sm font-bold truncate flex-1 min-w-0">{it.place_name}</p>
                  </div>
                  <input value={it.short_desc} onChange={(e) => setNote(it.key, e.target.value)} maxLength={120}
                    placeholder={t("notes.place_placeholder")}
                    className="mt-2 w-full rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
                  {/* Tagi miejsca (alternatywa dla notki) - pula zalezna od kategorii, wybrany = zolty fill */}
                  <p className="text-[11px] text-muted-foreground mt-2 mb-1.5">{`Tagi miejsca`}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {placeTagsForCategory(it.category).map((tg) => {
                      const on = (it.tags ?? []).includes(tg);
                      return (
                        <button key={tg} type="button" onClick={() => toggleItemTag(it.key, tg)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform border ${on ? "bg-[#FDF184] border-[#FDCD84] text-foreground" : "bg-background border-transparent text-muted-foreground"}`}>
                          {tg}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mapa z miejscami */}
          {mapPins.length > 0 && (
            <div className="pt-6">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">{isRouteCollection(category) ? t("map.route") : t("map.list")}</label>
              <div className="relative h-52 rounded-2xl overflow-hidden border border-border/40">
                <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={isRoute} />
              </div>
            </div>
          )}

        </div>
      )}

      {/* CTA - Dalej (krok 1) / Zapisz (krok 2). Ukryte gdy fokus na wyszukiwarce LUB
          na polu nazwy (krok 1) - zeby nie zaslaniac wynikow / pola nad klawiatura. */}
      {!(step === 1 && (searchFocused || titleFocused)) && (
        <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/20">
          {step === 1 ? (
            // Guzik NIE jest `disabled` - klik przy niespelnionych warunkach pokazuje toast
            // z powodem (inaczej user nie wie czemu wyszarzone). Wyszarzenie = wizualny sygnal.
            <button onClick={goNext}
              className={`w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${canGoNext ? "" : "opacity-50"}`}>
              {t("cta.next")} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={publish} disabled={!canPublish}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform disabled:opacity-50">
              {publishing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (editId ? t("cta.save") : t("cta.publish", "Zapisz moją listę"))}
            </button>
          )}
        </div>
      )}

      {detailPlace && (
        <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={city} skipGoogleFetch={detailSkip} />
      )}

      {/* Picker okladki (hero lub miniatura wg pickerTarget) + web file input */}
      <CoverPickerSheet
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === "list" ? t("cover.thumb_title", "Miniatura w eksploracji") : t("cover.hero_title", "Okładka listy")}
        subtitle={pickerTarget === "list"
          ? t("cover.thumb_subtitle", "Zdjęcie na karcie listy w eksploracji - wgraj nowe albo wybierz z miejsc listy.")
          : t("cover.hero_subtitle", "Zdjęcie w widoku listy - wgraj nowe albo wybierz z miejsc listy.")}
        options={coverOptions}
        currentUrl={pickerTarget === "list" ? listCover : heroCover}
        onPick={applyCover}
        onUploadNew={triggerCoverUpload}
        uploading={uploadingCover}
      />
      <input ref={coverFileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); if (coverFileInputRef.current) coverFileInputRef.current.value = ""; void handleCoverFiles(f); }} />
      {/* Podglad miejsca spoza bazy - TYLKO okladka (bez godzin/recenzji, min. kosztow Google) */}
      {customPreview && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/40" onClick={() => setCustomPreview(null)}>
          <div className="bg-background rounded-t-3xl max-h-[88dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <p className="text-lg font-black">{t("custom_preview.title")}</p>
              <button onClick={() => setCustomPreview(null)} aria-label={t("custom_preview.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
              <div className="rounded-2xl overflow-hidden bg-secondary">
                <div className="relative w-full aspect-[4/3] bg-muted">
                  {customPreview.photo_url
                    ? <img src={customPreview.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center bg-[#fcede3]"><CategoryIcon category={customPreview.category} className="w-1/4 max-w-[72px]" /></div>}
                </div>
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black leading-tight flex-1 min-w-0">{customPreview.place_name}</p>
                  </div>
                  {customPreview.address && <p className="text-xs text-muted-foreground mt-1">{customPreview.address}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setCustomPreview(null)} className="flex-1 py-3 rounded-2xl bg-secondary text-secondary-foreground text-sm font-bold active:scale-[0.97] transition-transform">{t("custom_preview.reject")}</button>
                <button onClick={confirmCustom} className="flex-1 py-3 rounded-2xl bg-primary text-white text-sm font-bold active:scale-[0.97] transition-transform">{t("custom_preview.add")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateRanking;
