import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, Loader2, MapPin, ChevronRight, ChevronDown, ChevronUp, List, GalleryHorizontalEnd, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import CreateHeader from "@/components/create/CreateHeader";
import { expandCity, cityGenitive } from "@/lib/cities";
import { TRIP_COUNTRIES, TRIP_REGIONS, citiesForCountry, countryForCity } from "@/lib/tripCountries";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { forwardGeocode, reverseGeocode, forwardGeocodeWithTypes } from "@/lib/googleMaps";
import { isRouteCollection } from "@/lib/collectionThemes";
import { MAIN_CATEGORIES, getDbCategoriesFor } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
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
  const [city, setCity] = useState(params.get("city") || "Warszawa");
  const [country, setCountry] = useState<string>(() => countryForCity(params.get("city") || "Warszawa"));
  const cities = citiesForCountry(country);
  const onCountryChange = (c: string) => { setCountry(c); setCity(citiesForCountry(c)[0]); };
  // Nazwa listy - generyczna domyslna (jak "Wyjazd do X" w trasie); titleDirty blokuje auto-update
  // po recznej edycji, a zmiana miasta aktualizuje domyslna nazwe.
  const defaultListName = (c: string) => `Lista miejsc - ${c}`;
  const [title, setTitle] = useState(() => defaultListName(params.get("city") || "Warszawa"));
  const [titleDirty, setTitleDirty] = useState(false);
  useEffect(() => { if (!titleDirty) setTitle(defaultListName(city)); }, [city, titleDirty]);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [publishing, setPublishing] = useState(false);
  // Krok formularza po wyborze motywu: 1 = miasto + miejsca, 2 = notki + mapa + publikacja.
  const [step, setStep] = useState<1 | 2>(1);
  // Glowna notka do calego zestawienia (krok 2).
  const [description, setDescription] = useState("");
  // Tozsamosc autora: domyslnie z profilem; checkbox "anonimowo" na koncu (krok 2).
  const [asAnon, setAsAnon] = useState(false);

  // Wyszukiwarka + propozycje miejsc (bez zargonu "baza/spoza bazy").
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
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


  // ── Author + edit/liked prefill ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setAuthor({ name: (data as any).first_name || (data as any).username || "Użytkownik", avatar: (data as any).avatar_url ?? null }); });
  }, [user]);

  useEffect(() => {
    if (editId) {
      (async () => {
        const { data: col } = await (supabase as any).from("discovery_collections").select("title, city, category, description, author_name, author_avatar").eq("id", editId).maybeSingle();
        if (col) {
          setTitle(col.title ?? ""); setTitleDirty(true); if (col.city) { setCity(col.city); setCountry(countryForCity(col.city)); } setCategory(col.category ?? null);
          setDescription(col.description ?? "");
          setAsAnon(col.author_name === "Anonim" && !col.author_avatar);
        }
        const { data: its } = await (supabase as any).from("discovery_items").select("*").eq("collection_id", editId).order("order_index", { ascending: true });
        if (its) setItems(its.map((i: any, idx: number) => ({
          key: `e${idx}`, place_id: i.place_id ?? null, place_name: i.place_name, category: i.category ?? null,
          address: i.address ?? null, latitude: i.latitude ?? null, longitude: i.longitude ?? null,
          rating: i.rating ?? null, google_place_id: i.google_place_id ?? null, photo_url: i.photo_url ?? null, short_desc: i.short_desc ?? "",
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
    setItems((prev) => [...prev, { ...it, key: `k${Date.now()}`, short_desc: "" }]);
  };
  const removeItem = (key: string) => setItems((prev) => prev.filter((x) => x.key !== key));
  const setNote = (key: string, v: string) => setItems((prev) => prev.map((x) => x.key === key ? { ...x, short_desc: v } : x));
  // Zmiana kolejnosci (tylko trasa/plan). order_index zapisuje sie z pozycji w tablicy.
  const move = (idx: number, dir: -1 | 1) => setItems((prev) => {
    const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

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
  const savedForCity = useMemo(() => {
    const wanted = new Set(expandCity(city).map((c) => c.toLowerCase()));
    return getHistoryByCity()
      .filter((g) => wanted.has(g.city.toLowerCase()))
      .flatMap((g) => g.places)
      .map((p: any) => ({
        key: p.place_id ?? p.place_name, id: p.place_id ?? null, place_name: p.place_name, category: p.category,
        address: p.address ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
        rating: p.rating ?? null, photo_url: p.photo_url ?? null,
      }));
  }, [city]);

  // Dodaj miejsce spoza bazy (wynik Google text search). Dociagamy okladke/rating/place_id
  // przez proxy dopiero przy dodaniu (nie dla kazdego wyniku - min. kosztow Google).
  const addGooglePlace = async (g: any) => {
    if (addingGoogleName) return;
    setAddingGoogleName(g.name);
    const res = await fetchGooglePlace({ name: g.name, address: g.full_address, lat: g.latitude, lng: g.longitude, city });
    setAddingGoogleName(null);
    if (!res || !res.place_name) { toast.error(t("toast.add_failed")); return; }
    addItem(res);
    setGoogleResults((prev) => prev.filter((x) => x.name !== g.name));
  };

  // Miejsce spoza bazy: najpierw POKAZ wizytowke do zatwierdzenia (Google proxy),
  // dopiero po "Dodaj" trafia na liste. User widzi co dodaje.
  const previewCustomByName = async (name: string) => {
    if (!name.trim() || addingCustom) return;
    setAddingCustom(true);
    const res = await fetchGooglePlace({ name: name.trim(), city });
    setAddingCustom(false);
    if (!res || !res.place_name) { toast.error(t("toast.not_found")); return; }
    setCustomPreview(res);
  };
  const confirmCustom = () => {
    if (!customPreview) return;
    addItem(customPreview);
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
      const { data } = await (supabase as any).from("places")
        .select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .in("city", expandCity(city)).ilike("place_name", `%${q}%`).eq("is_active", true).limit(50);
      const dbRows = data ?? [];
      setSearchResults(dbRows); setSearchLoading(false);
      // Dopelnienie: miejsca spoza bazy z Google (max 3), z pominieciem duplikatow nazw z DB.
      try {
        const g = await forwardGeocodeWithTypes(`${q} ${city}`);
        const dbNames = new Set(dbRows.map((r: any) => (r.place_name ?? "").toLowerCase().trim()));
        // Szukamy TYLKO w wybranym miescie - odrzucamy wyniki spoza (Google potrafi zwrocic
        // np. lokal o podobnej nazwie w innym miescie). Dopasowanie po nazwie miasta w adresie.
        const cityAliases = expandCity(city).map((c) => c.toLowerCase());
        const seen = new Set<string>();
        const extra = g
          .filter((x) => {
            const name = (x.name ?? "").toLowerCase().trim();
            if (!name || dbNames.has(name) || seen.has(name)) return false;
            // Odrzuc czyste wyniki geograficzne (miasta, dzielnice, drogi) - chcemy lokale.
            const geoOnly = ["locality", "sublocality", "administrative_area_level_1", "administrative_area_level_2", "country", "route", "postal_code", "political"];
            if ((x.types ?? []).length > 0 && (x.types ?? []).every((t) => geoOnly.includes(t))) return false;
            // Tylko lokale w wybranym miescie (adres zawiera nazwe miasta/dzielnicy).
            const addr = (x.full_address ?? "").toLowerCase();
            if (!cityAliases.some((c) => addr.includes(c))) return false;
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
        .in("city", expandCity(city)).eq("is_active", true);
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
  const canGoNext = !!city && items.length >= 2 && title.trim().length > 0; // krok 1 -> 2
  const canPublish = canGoNext && !publishing;

  const publish = async () => {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      let collectionId = editId;
      // Wszystkie nowe zestawienia czekaja na akceptacje admina (App Store Guideline
      // 1.2 UGC + decyzja: moderacja na starcie dla wszystkich, nie tylko anonimow).
      const moderationStatus = "pending";
      // Zestawienia zawsze publiczne; tozsamosc wg wyboru (profil vs anonim).
      const isPublic = true;
      const authorName = asAnon ? "Anonim" : author.name;
      const authorAvatar = asAnon ? null : author.avatar;
      const desc = description.trim() || null;
      if (editId) {
        await (supabase as any).from("discovery_collections").update({ title: collectionTitle, city, category, description: desc, is_public: isPublic, author_name: authorName, author_avatar: authorAvatar, updated_at: new Date().toISOString() }).eq("id", editId);
        await (supabase as any).from("discovery_items").delete().eq("collection_id", editId);
      } else {
        const { data: col, error } = await (supabase as any).from("discovery_collections").insert({
          user_id: user.id, author_name: authorName, author_avatar: authorAvatar, title: collectionTitle,
          category, city, description: desc, kind: "ranking", is_public: isPublic,
          moderation_status: moderationStatus,
        }).select("id").single();
        if (error || !col) throw new Error(error?.message ?? "insert failed");
        collectionId = col.id;
      }
      const rows = items.map((it, idx) => ({
        collection_id: collectionId, order_index: idx, place_id: it.place_id, place_name: it.place_name,
        category: it.category, address: it.address, latitude: it.latitude, longitude: it.longitude,
        rating: it.rating, google_place_id: it.google_place_id, photo_url: it.photo_url, short_desc: it.short_desc.trim() || null,
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
      navigate("/eksploruj");
    } catch (e: any) {
      toast.error(t("toast.save_failed", { error: e?.message ?? t("error_fallback") }));
    } finally {
      setPublishing(false);
    }
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
          {/* Kraj + miasto wybrane wczesniej drum-scrollem (/utworz) - tu bez selektora. */}
          {/* Nazwa listy (generyczna domyslna, edytowalna) */}
          <div className="px-4 pt-3">
            <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleDirty(true); }} maxLength={80}
              placeholder={t("name_placeholder", "Nazwa listy")}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
          </div>

          {/* Wyszukiwarka - STICKY na gorze (najwazniejsza) */}
          <div className="sticky top-0 z-20 bg-background px-4 pt-3 pb-2">
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
                    {r.photo_url ? <img src={r.photo_url} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0" /> : <div className="h-11 w-11 rounded-xl bg-background flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-muted-foreground" /></div>}
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
                    <div className="h-11 w-11 rounded-xl bg-background flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
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
            <div className={placeView === "detail" ? "flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1" : "space-y-2.5"}>
              {items.map((it, idx) => {
                const cat = categoryBadge(it.category);
                // Kontrolki kolejnosci (tylko Plan): strzalki gora/dol.
                const reorder = isRoute && (
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={t("places.move_up")} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground disabled:opacity-25 active:bg-background"><ChevronUp className="h-4 w-4" /></button>
                    <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label={t("places.move_down")} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground disabled:opacity-25 active:bg-background"><ChevronDown className="h-4 w-4" /></button>
                  </div>
                );
                // ── Widok kompaktowy (lista) ──
                if (placeView === "list") {
                  const stepNo = isRoute && <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>;
                  return (
                    <div key={it.key} className="rounded-2xl bg-secondary p-2.5 flex items-center gap-2">
                      {stepNo}
                      <button onClick={() => openDetail(it)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
                        {it.photo_url
                          ? <img src={it.photo_url} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                          : <div className="h-11 w-11 rounded-lg bg-background flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-4 w-4" /></div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate">{it.place_name}</p>
                          </div>
                          {cat && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><CategoryIcon category={it.category} className="h-3 w-3 shrink-0" />{cat.label}</p>}
                        </div>
                      </button>
                      {reorder}
                      <button onClick={() => removeItem(it.key)} aria-label={t("places.remove")} className="h-7 w-7 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 shrink-0"><X className="h-4 w-4" /></button>
                    </div>
                  );
                }
                // ── Widok kart: duza karta 4:3 (jak w dzienniku) ──
                return (
                  <div key={it.key} className="relative shrink-0 w-[80%] snap-start rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm">
                    <button onClick={() => openDetail(it)} className="w-full text-left active:opacity-90 transition-opacity">
                      <div className="relative w-full aspect-[4/3] bg-muted">
                        {it.photo_url
                          ? <img src={it.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><MapPin className="h-8 w-8" /></div>}
                        {/* Numer kroku (tylko Plan - kolejnosc zwiedzania) */}
                        {isRoute && <span className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center shadow-sm">{idx + 1}</span>}
                      </div>
                      <div className="px-4 pt-3 pb-3.5">
                        {cat && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold mb-1.5"><CategoryIcon category={it.category} className="h-3 w-3 shrink-0" />{cat.label}</span>}
                        <p className="text-base font-black leading-tight">{it.place_name}</p>
                        {it.address && <p className="text-[12px] text-muted-foreground leading-snug mt-1 truncate">{it.address}</p>}
                      </div>
                    </button>
                    {/* Akcje: reorder (Plan) + usun - overlay w prawym gornym rogu nad zdjeciem */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {isRoute && (
                        <div className="flex flex-col rounded-full bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
                          <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={t("places.move_up")} className="h-6 w-7 flex items-center justify-center text-foreground/70 disabled:opacity-25 active:bg-black/5"><ChevronUp className="h-4 w-4" /></button>
                          <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label={t("places.move_down")} className="h-6 w-7 flex items-center justify-center text-foreground/70 disabled:opacity-25 active:bg-black/5"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                      )}
                      <button onClick={() => removeItem(it.key)} aria-label={t("places.remove")} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-destructive active:scale-95 transition-transform"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                );
              })}

              {/* Szkielet "Dodaj miejsce" - klik = fokus na wyszukiwarce. Zawsze widoczny:
                  jako pusty stan (gdy 0 miejsc) i jako sposob dodania kolejnych. W trybie kart
                  = kafel w karuzeli (obok miejsc), w trybie listy = pelna szerokosc pod spodem. */}
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className={`rounded-2xl border-2 border-dashed border-border/70 bg-secondary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground active:scale-[0.99] transition-transform ${placeView === "list" ? "w-full py-5" : "shrink-0 w-[80%] snap-start self-stretch min-h-[240px] px-4"}`}
              >
                <span className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"><Plus className="h-5 w-5 text-orange-600" /></span>
                <span className="text-sm font-bold text-foreground">{t("places.add")}</span>
                <span className="text-[12px] text-center">{t("places.add_hint")}</span>
              </button>
            </div>
          </div>

          {/* "Twoje zapisane miejsca" - szybka sciaga (zamiast propozycji z bazy). Ukryte podczas szukania. */}
          {search.trim().length < 2 && (() => {
            const saved = savedForCity.filter((s) => !addedNames.has(s.place_name.toLowerCase()));
            return (
              <div className="px-4 pb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Twoje zapisane miejsca</p>
                {saved.length > 0 ? (
                  <div className="flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
                    {saved.map((s) => (
                      <button key={s.key} onClick={() => addDbPlace(s)}
                        className="shrink-0 w-[40%] snap-start rounded-2xl bg-secondary overflow-hidden text-left active:scale-[0.97] transition-transform">
                        <div className="relative aspect-[4/3] bg-background">
                          {s.photo_url ? <img src={s.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><MapPin className="h-5 w-5" /></div>}
                          <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm"><Plus className="h-3.5 w-3.5" /></div>
                        </div>
                        <p className="text-xs font-bold leading-tight truncate px-2 py-2">{s.place_name}</p>
                      </button>
                    ))}
                    <div className="shrink-0 w-1" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-snug">{`Nie masz zapisanych miejsc w ${city}. Zapisz je w eksploracji (serduszko), a pojawią się tu do szybkiego dodania. Możesz też znaleźć miejsce wyszukiwarką powyżej.`}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ KROK 2: glowna notka + notki do miejsc + mapa + anonimowo ══ */}
      {step === 2 && (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* Glowna notka do calego zestawienia */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("notes.collection_label")} <span className="normal-case font-medium text-muted-foreground/50">{t("notes.optional")}</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={3}
              placeholder={t("notes.collection_placeholder")}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50 resize-none" />
          </div>

          {/* Notki do poszczegolnych miejsc */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">{t("notes.places_label")}</label>
            <div className="space-y-2.5">
              {items.map((it) => (
                <div key={it.key} className="rounded-2xl bg-secondary p-2.5">
                  <div className="flex items-center gap-2.5">
                    {it.photo_url
                      ? <img src={it.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                      : <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-4 w-4" /></div>}
                    <p className="text-sm font-bold truncate flex-1 min-w-0">{it.place_name}</p>
                  </div>
                  <input value={it.short_desc} onChange={(e) => setNote(it.key, e.target.value)} maxLength={120}
                    placeholder={t("notes.place_placeholder")}
                    className="mt-2 w-full rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>

          {/* Mapa z miejscami */}
          {mapPins.length > 0 && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">{isRouteCollection(category) ? t("map.route") : t("map.list")}</label>
              <div className="relative h-52 rounded-2xl overflow-hidden border border-border/40">
                <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={isRoute} />
              </div>
            </div>
          )}

          {/* Anonimowo - checkbox na koncu (domyslnie z profilem) */}
          <button type="button" onClick={() => setAsAnon((v) => !v)} className="w-full flex items-start gap-3 rounded-2xl bg-secondary p-3.5 text-left active:scale-[0.99] transition-transform">
            <span className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${asAnon ? "bg-primary border-orange-600" : "border-border bg-background"}`}>
              {asAnon && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="text-sm font-bold block">{t("anon.label")}</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">{asAnon ? t("anon.on") : t("anon.off")}</span>
            </span>
          </button>
        </div>
      )}

      {/* CTA - Dalej (krok 1) / Opublikuj (krok 2). Ukryte gdy fokus na wyszukiwarce
          (krok 1) - zeby nie zaslaniac wynikow nad klawiatura. */}
      {!(step === 1 && searchFocused) && (
        <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/20">
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={!canGoNext}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {t("cta.next")} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={publish} disabled={!canPublish}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform disabled:opacity-50">
              {publishing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (editId ? t("cta.save") : t("cta.publish"))}
            </button>
          )}
        </div>
      )}

      {detailPlace && (
        <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={city} skipGoogleFetch={detailSkip} />
      )}
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
                    : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><MapPin className="h-8 w-8" /></div>}
                </div>
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black leading-tight flex-1 min-w-0">{customPreview.place_name}</p>
                  </div>
                  {customPreview.address && <p className="text-xs text-muted-foreground mt-1">{customPreview.address}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setCustomPreview(null)} className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground text-sm font-bold active:scale-[0.97] transition-transform">{t("custom_preview.reject")}</button>
                <button onClick={confirmCustom} className="flex-1 py-3 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.97] transition-transform">{t("custom_preview.add")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateRanking;
