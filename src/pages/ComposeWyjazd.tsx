import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, ChevronDown, Calendar as CalendarIcon, List, GalleryHorizontalEnd, Loader2, ArrowRight, Trash2, Maximize2, GripVertical, UserPlus } from "lucide-react";
import InviteFriendsSheet from "@/components/route/InviteFriendsSheet";
import CreateHeader from "@/components/create/CreateHeader";
import { avatarSrc } from "@/lib/avatar";
import { Reorder, useDragControls } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ORIGIN_COUNTRIES } from "@/lib/locations";
import { expandCity, cityGenitive } from "@/lib/cities";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { createWyjazdFromPlaces, updateWyjazdPlaces } from "@/lib/createWyjazd";
import { haptics } from "@/hooks/useHaptics";
import { API_BASE } from "@/lib/platform";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import RouteMap from "@/components/RouteMap";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { TRIP_COUNTRIES, TRIP_REGIONS, citiesForCountry, countryForCity } from "@/lib/tripCountries";
import { fetchEnrichedPlace, type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { categoryIconSrc, categoryFromGoogleTypes } from "@/lib/placeCategoryIcon";
import { fetchUserPhotosByNames } from "@/lib/placeUserPhotos";
import { resolveStored } from "@/components/PlacePhoto";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const PL_CITIES = ORIGIN_COUNTRIES.find((c) => c.name === "Polska")?.cities ?? ["Warszawa"];


// Miejsce w kompozycji wyjazdu. place_id != null = z bazy.
type ComposeItem = {
  key: string;
  place_id: string | null;
  place_name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  photo_url: string | null;
};

// Cokolwiek (DB place / wynik Google / ComposeItem) -> ComposeItem.
const toItem = (p: any): ComposeItem => ({
  key: p.id ?? p.key ?? `${p.place_name}:${p.latitude}`,
  place_id: p.id ?? p.place_id ?? null,
  place_name: p.place_name,
  category: p.category ?? null,
  address: p.address ?? null,
  latitude: p.latitude ?? null,
  longitude: p.longitude ?? null,
  rating: typeof p.rating === "number" ? p.rating : null,
  photo_url: p.photo_url ?? null,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ComposeItem / propozycja -> MockPlace (do wizytowki PlaceSwiperDetail).
const toMockPlace = (p: any, city: string): MockPlace => ({
  id: p.place_id ?? p.id ?? p.key ?? p.place_name,
  place_name: p.place_name,
  category: (p.category ?? "other") as any,
  city,
  address: p.address ?? "",
  latitude: p.latitude ?? 0,
  longitude: p.longitude ?? 0,
  rating: typeof p.rating === "number" ? p.rating : 0,
  photo_url: p.photo_url ?? "",
  vibe_tags: [],
  description: "",
});

// Statyczna mapka (proxy /api/static-map) - pomaranczowe markery, POI/transit ukryte.
// Auto-fit do markerow (bez center/zoom). null gdy brak wspolrzednych.
function buildStaticMapUrl(pts: { latitude: number; longitude: number }[]): string | null {
  const valid = pts.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!valid.length) return null;
  const markers = valid.map((p) => `markers=size:small%7Ccolor:0xf9662b%7C${p.latitude},${p.longitude}`).join("&");
  return `${API_BASE}/api/static-map?size=560x260&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

// Wiersz listy wybranych miejsc z DRAG & DROP (framer-motion Reorder). Przeciaganie
// uchwytem (GripVertical) - reszta wiersza nadal tapowalna (otwiera wizytowke).
function SortableComposeRow({ it, idx, onOpen, onRemove }: {
  it: ComposeItem; idx: number; onOpen: () => void; onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={it}
      dragListener={false}
      dragControls={controls}
      // Bez animacji layoutu (spring "zwijania/rozwijania" przy dodaniu/usunieciu miejsca) -
      // zmiany natychmiastowe (duration 0). Drag & drop nadal dziala (dragControls), a
      // przestawianie w trakcie przeciagania jest natychmiastowe zamiast springowac.
      transition={{ duration: 0 }}
      className="w-full flex items-center gap-2.5 rounded-2xl bg-secondary p-2.5 select-none"
    >
      {/* Uchwyt przeciagania - z LEWEJ, tuz przy okladce (daleko od kosza po prawej, zeby nie mylic). */}
      <span
        onPointerDown={(e) => { haptics.light(); controls.start(e); }}
        aria-label="Przeciągnij, by zmienić kolejność"
        className="shrink-0 h-9 w-6 flex items-center justify-center text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5" />
      </span>
      <button onClick={onOpen} className="flex items-center gap-2.5 min-w-0 flex-1 text-left active:opacity-90 transition-opacity">
        <div className="relative shrink-0">
          {it.photo_url ? (
            <img src={it.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-[#fcede3] flex items-center justify-center"><img src={categoryIconSrc(it.category)} alt="" className="w-[30%]" draggable={false} /></div>
          )}
          {/* Numer kolejnosci - overlay na miniaturce (rog gorny-lewy). */}
          <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/65 backdrop-blur-sm text-white text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{it.place_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {it.category && <span className="text-[11px] text-muted-foreground truncate">{subcategoryLabelLocalized(it.category)}</span>}
          </div>
        </div>
      </button>
      <button
        onClick={onRemove}
        aria-label="Usuń miejsce"
        className="h-8 w-8 rounded-full bg-background flex items-center justify-center text-muted-foreground active:scale-90 transition-transform shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

// Kompozycja wyjazdu z zestawienia (wg Figmy "Zestawienie · nowe — klik uzyj"):
// nazwa + daty + miasto + wybrane miejsca (prefill z zestawienia) + szukanie (Google) /
// propozycje z bazy (na fokusie) + statyczna mapa. Potwierdzenie tworzy wyjazd (routes).
export default function ComposeWyjazd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const { i18n } = useTranslation();
  // Domyslna nazwa wyjazdu zalezna od jezyka (PL: "Wyjazd do X", EN: "Trip to X").
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");

  // draftId: gdy wchodzimy z ekranu wyboru bazy w SWOJA robocza trase -> edytujemy JA
  // (update), a nie tworzymy duplikatu. Brak = tryb tworzenia nowej trasy.
  const nav = (location.state ?? {}) as { city?: string | null; title?: string | null; places?: any[]; draftId?: string };

  // ── Soft-save (lekki zapis roboczy) ──────────────────────────────────────
  // Problem: "Przejdz do sugestii" tworzy trase i navigate'uje dalej; cofniecie (navigate(-1))
  // RE-MONTUJE ten ekran ze stanem z location.state (tylko prefill), gubiac miejsca dodane
  // chwile wczesniej. Fix: trzymamy roboczy stan w sessionStorage kluczowanym po location.key
  // (stabilny per wpis historii - fresh entry ma nowy key, powrot wraca do tego samego).
  // Po utworzeniu trasy zapisujemy draftId, wiec ponowny "Przejdz do sugestii" AKTUALIZUJE
  // istniejaca trase zamiast tworzyc duplikat.
  const softKey = `trasa_compose_soft:${location.key}`;
  // Trwaly backup (localStorage) - PRZEZYWA ubicie apki / restart iOS WebView, w przeciwienstwie
  // do sessionStorage (czyszczony przy zamknieciu). Chroni przed utrata dlugiej kompozycji.
  const DURABLE_KEY = "trasa_compose_backup";
  let restoredFromDurable = false;
  const soft = (() => {
    try {
      const raw = sessionStorage.getItem(softKey);
      if (raw) return JSON.parse(raw);
      // Fallback: trwaly backup - tylko gdy pasuje do tego wejscia (ten sam draftId albo oba nowe),
      // ma miejsca i jest swiezy (< 24h) - zeby nie wskrzeszac starych porzuconych kompozycji.
      const durRaw = localStorage.getItem(DURABLE_KEY);
      if (durRaw) {
        const d = JSON.parse(durRaw);
        const fresh = d?.ts && (Date.now() - d.ts) < 24 * 3600 * 1000;
        const sameEntry = (d?.draftId ?? null) === (nav.draftId ?? null);
        if (fresh && sameEntry && (d?.items?.length ?? 0) > 0) { restoredFromDurable = true; return d; }
      }
    } catch { /* storage unavailable */ }
    return null;
  })();

  const [draftId, setDraftId] = useState<string | null>(soft?.draftId ?? nav.draftId ?? null);
  const [city, setCity] = useState<string>(soft?.city ?? nav.city ?? "Warszawa");
  // Kraj wywiedziony z miasta (Europa/Azja odblokowane) - zmiana kraju resetuje miasto.
  const [country, setCountry] = useState<string>(() => countryForCity(soft?.city ?? nav.city ?? "Warszawa"));
  const cities = citiesForCountry(country);
  const onCountryChange = (c: string) => { setCountry(c); setCity(citiesForCountry(c)[0]); };
  // Domyslna nazwa: PL z dopelniaczem miasta ("Wyjazd do Warszawy/Berlina/Krakowa"), EN "Trip to X".
  const defaultTripName = (c: string) => (isEn ? `Trip to ${c}` : `Wyjazd do ${cityGenitive(c)}`);
  const [name, setName] = useState<string>(
    soft?.name ?? nav.title ?? defaultTripName(soft?.city ?? nav.city ?? "Warszawa"));
  // Nazwa uzupelniona z gory (edytowalna). Dopoki user nie edytowal recznie, synchronizuje sie
  // ze zmiana miasta. Prefill z draftu/nav = traktujemy jako juz "edytowane" (nie nadpisujemy).
  const [nameDirty, setNameDirty] = useState<boolean>(!!(soft?.name || nav.title));
  useEffect(() => {
    if (!nameDirty) setName(defaultTripName(city));
  }, [city, nameDirty, isEn]);
  const [items, setItems] = useState<ComposeItem[]>(() =>
    soft?.items ?? (nav.places ?? []).map((p: any, idx: number) => toItem({ ...p, key: p.place_id ?? p.id ?? `${p.place_name}:${idx}` })));
  const [placeView, setPlaceView] = useState<"detail" | "list">("list");

  // Daty wyjazdu (start + liczba dni z FullCalendarPicker).
  const [dateSheet, setDateSheet] = useState(false);
  const [tripDate, setTripDate] = useState<{ start: Date; numDays: number } | null>(
    soft?.tripDate ? { start: new Date(soft.tripDate.start), numDays: soft.tripDate.numDays } : null);

  // Persystencja roboczego stanu przy kazdej zmianie (miasto/nazwa/miejsca/daty/draftId).
  useEffect(() => {
    const payload = JSON.stringify({
      draftId, city, name, items,
      tripDate: tripDate ? { start: tripDate.start.toISOString(), numDays: tripDate.numDays } : null,
      ts: Date.now(),
    });
    try { sessionStorage.setItem(softKey, payload); } catch { /* sessionStorage unavailable */ }
    // Trwaly mirror TYLKO gdy sa miejsca (pusty stan nie nadpisuje dobrej kopii zapasowej).
    try { if (items.length) localStorage.setItem(DURABLE_KEY, payload); } catch { /* unavailable */ }
  }, [softKey, draftId, city, name, items, tripDate]);

  const clearSoft = () => {
    try { sessionStorage.removeItem(softKey); } catch { /* unavailable */ }
    try { localStorage.removeItem(DURABLE_KEY); } catch { /* unavailable */ }
  };

  // Odzyskano niezapisana trase z trwalego backupu (po ubiciu apki / crashu) - poinformuj usera.
  useEffect(() => {
    if (restoredFromDurable) toast("Przywrócono niezapisaną trasę", { description: "Twoje miejsca zostały odzyskane." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Doladowanie ROBOCZEJ trasy z DB gdy wchodzimy przez draftId BEZ przekazanych miejsc
  // (klik w robocza trase w hubie "Robocze"). Prefill miasto + nazwa + miejsca z pinow, zeby
  // user od razu byl na etapie tworzenia z uzupelnionymi miejscami. Guard: tylko gdy brak
  // soft-save i brak nav.places (zeby nie nadpisac swiezej pracy usera po powrocie).
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftLoadedRef.current) return;
    if (!draftId) return;
    if ((soft?.items?.length ?? 0) > 0 || (nav.places?.length ?? 0) > 0) { draftLoadedRef.current = true; return; }
    draftLoadedRef.current = true;
    (async () => {
      const { data: route } = await (supabase as any)
        .from("routes").select("title, city, start_date, end_date").eq("id", draftId).maybeSingle();
      if (route) {
        if (route.city) { setCity(route.city); setCountry(countryForCity(route.city)); }
        if (route.title) { setName(route.title); setNameDirty(true); }
        if (route.start_date) {
          const start = new Date(route.start_date);
          const numDays = route.end_date ? Math.max(1, Math.round((+new Date(route.end_date) - +start) / 86400000) + 1) : 1;
          setTripDate({ start, numDays });
        }
      }
      const { data: pins } = await (supabase as any)
        .from("pins").select("place_id, place_name, category, address, latitude, longitude, photo_url, pin_order")
        .eq("route_id", draftId).order("pin_order", { ascending: true });
      if (pins?.length) setItems(pins.map((p: any, idx: number) => toItem({
        id: p.place_id ?? undefined, place_id: p.place_id ?? null, place_name: p.place_name,
        category: p.category, address: p.address, latitude: p.latitude, longitude: p.longitude,
        photo_url: p.photo_url, key: p.place_id ?? `${p.place_name}:${idx}`,
      })));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Wyszukiwarka: propozycje z bazy (na fokusie), Google textsearch (podczas pisania).
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Budzet miesieczny Text Search wyczerpany (proxy zwraca quota_exceeded) - blokada wyszukiwarki Google.
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Sesja grupowa trasy (po pierwszym zaproszeniu) - zeby drugie zaproszenie nie tworzylo drugiej.
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);
  // Zaproszeni (awatary obok guzika "Zapros" - stan po zaproszeniu). Dedup po id.
  const [invited, setInvited] = useState<{ id: string; avatar_url: string | null }[]>([]);

  // "Zapros znajomych" przy tworzeniu: trasa jeszcze nie istnieje, wiec najpierw tworzymy
  // szkic (draft) zeby miec routeId, potem otwieramy sheet (podpina zaproszonych do tej trasy).
  const handleOpenInvite = async () => {
    if (!user) return;
    if (!items.length) { toast("Najpierw dodaj miejsca do trasy"); return; }
    let id = draftId;
    if (!id) {
      setCreating(true);
      const dates = tripDate
        ? { start_date: format(tripDate.start, "yyyy-MM-dd"), end_date: format(addDays(tripDate.start, tripDate.numDays - 1), "yyyy-MM-dd") }
        : undefined;
      const places = items.map((i) => ({
        place_name: i.place_name, category: i.category, address: i.address,
        latitude: i.latitude, longitude: i.longitude, photo_url: i.photo_url, place_id: i.place_id,
      }));
      id = await createWyjazdFromPlaces(user.id, city, name.trim() || city || "Wyjazd", places, dates);
      setCreating(false);
      if (!id) { toast.error("Nie udało się utworzyć trasy"); return; }
      setDraftId(id);
      try {
        const cur = JSON.parse(sessionStorage.getItem(softKey) || "{}");
        sessionStorage.setItem(softKey, JSON.stringify({ ...cur, draftId: id }));
      } catch { /* unavailable */ }
    }
    setInviteOpen(true);
  };

  // Wizytowka miejsca (tap w karte) + rozwinieta mapa.
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  // Popup przy cofaniu z niezapisana trasa (zapis do roboczych albo wyjscie bez zapisu).
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  // Potwierdzenie usuniecia miejsca z trasy ("czy na pewno") - trzyma klucz+nazwe usuwanego.
  const [confirmRemove, setConfirmRemove] = useState<{ key: string; name: string } | null>(null);

  // Cofniecie: gdy sa juz miejsca w trasie -> zapytaj czy zapisac do roboczych. Inaczej wyjdz.
  // Wyjscie z tworzenia do ekranu glownego. Historia jest plytka (nawigacje wewnatrz
  // tworzenia = replace), wiec navigate(-1) wraca do eksploracji; fallback gdyby brak historii.
  const exitCreate = () => { clearSoft(); if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); };
  const handleBack = () => {
    if (items.length > 0 && !creating) setShowBackConfirm(true);
    else exitCreate();
  };

  const addedIds = useMemo(() => new Set(items.map((i) => (i.place_id ?? i.place_name).toLowerCase())), [items]);
  const isAdded = (p: any) => addedIds.has((p.id ?? p.place_id ?? p.place_name ?? "").toLowerCase());

  // Propozycje z bazy (najlepiej oceniane w miescie) - pokazywane TYLKO na fokusie (pusta fraza).
  useEffect(() => {
    let alive = true;
    (async () => {
      const cities = expandCity(city);
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, city, category, address, latitude, longitude, rating, photo_url, business_profiles(cover_image_url, gallery_urls)")
        .in("city", cities)
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(20);
      // Okladka propozycji: biznes z wlasnym zdjeciem -> jego cover (uzupelnia lokal). Inaczej
      // null -> ikona kategorii (zdjecia userow z tras dojda pozniej). Google backfill
      // (place.photo_url) juz odciety, wiec go nie uzywamy.
      // Okladka: biznes z wlasnym zdjeciem -> jego cover. Inaczej zdjecie usera dodane do
      // tego miejsca w dowolnej trasie (images/user_photo_urls). Inaczej null -> ikona kategorii.
      const userPhotos = await fetchUserPhotosByNames((data ?? []).map((p: any) => p.place_name));
      const mapped = (data ?? []).map((p: any) => {
        const bp = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
        const bizCover = bp?.cover_image_url
          || (Array.isArray(bp?.gallery_urls) ? bp.gallery_urls.find(Boolean) : null)
          || null;
        const userPhoto = userPhotos.has(p.place_name) ? resolveStored(userPhotos.get(p.place_name)!) : null;
        return { ...p, photo_url: bizCover || userPhoto };
      });
      if (alive) setSuggestions(mapped);
    })();
    return () => { alive = false; };
  }, [city]);

  // Szukanie po nazwie = GOOGLE (textsearch przez proxy), zeby znalezc KAZDE miejsce, nie
  // tylko te z naszej bazy. Debounce + cache po stronie proxy ogranicza koszt.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("google-places-proxy", {
          body: { action: "textsearch", query: `${q} ${city}` },
        });
        setSearchBlocked(!!data?.quota_exceeded);
        const raw = (data?.results ?? []) as any[];
        const mappedResults = raw.map((r: any) => ({
          id: null,
          place_id: null,
          key: `g:${r.latitude},${r.longitude}:${r.name}`,
          place_name: r.name,
          address: r.full_address ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          // Kategoria z typow Google (inaczej wszystkie wyszukane miejsca = ikona Landmark).
          category: categoryFromGoogleTypes(r.types),
          rating: null,
          photo_url: null as string | null,
        }));
        setResults(mappedResults);
        // Zdjecie usera dla wyszukanych miejsc (jak wizytowka): jesli ktos dodal zdjecie do
        // tego miejsca w swojej trasie -> pokaz je na karcie zamiast ikony-placeholdera.
        const photoMap = await fetchUserPhotosByNames(mappedResults.map((r) => r.place_name));
        if (photoMap.size) {
          setResults((prev) => prev.map((r: any) => (r.photo_url == null && photoMap.has(r.place_name) ? { ...r, photo_url: resolveStored(photoMap.get(r.place_name)!) } : r)));
        }
      } catch (e: any) {
        console.error("[ComposeWyjazd] google textsearch error:", e?.message ?? e);
        setResults([]);
      }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, city]);

  // Dodanie miejsca: dorzuca do trasy i CZYSCI pole wyszukiwania (by od razu szukac kolejnego).
  const addPlace = (p: any) => {
    if (!isAdded(p)) { setItems((prev) => [...prev, toItem(p)]); haptics.light(); }
    setSearch("");
    setResults([]);
  };
  const removePlace = (key: string) => { haptics.light(); setItems((prev) => prev.filter((i) => i.key !== key)); };
  // Zmiana kolejnosci miejsc (kolejnosc = przebieg trasy). dir: -1 w gore, +1 w dol.
  const moveItem = (key: string, dir: -1 | 1) => setItems((prev) => {
    const idx = prev.findIndex((i) => i.key === key);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });
  const openDetail = async (p: any) => {
    const base = toMockPlace(p, city);
    setDetailPlace(base);
    // Wynik wyszukiwania Google ma id = "g:..." (nie UUID) - PlaceSwiperDetail nie wzbogaci
    // go o profil biznesu (brama UUID). Dociagamy rekord z tabeli places po nazwie+miescie,
    // zeby zaladowac pelna wizytowke biznesu (logo, kategorie, galeria, wydarzenia) zamiast
    // "wizytowki zero". Wzorzec jak w PlanChatExperience (dopasowanie po place_name/city).
    if (!UUID_RE.test(base.id)) {
      try {
        const { data } = await supabase
          .from("places")
          .select("id")
          .ilike("place_name", base.place_name)
          .ilike("city", city)
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          const enriched = await fetchEnrichedPlace(data.id, new Date().toISOString().slice(0, 10));
          if (enriched) setDetailPlace((prev) => (prev && prev.id === base.id ? enriched : prev));
        }
      } catch { /* brak dopasowania w bazie - zostaje wizytowka z danych Google */ }
    }
  };

  const mapPins = items
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ latitude: i.latitude!, longitude: i.longitude!, place_name: i.place_name }));
  const staticMapUrl = useMemo(() => buildStaticMapUrl(mapPins), [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateLabel = tripDate
    ? tripDate.numDays > 1
      ? `${format(tripDate.start, "d MMM", { locale: dateLocale() })} - ${format(addDays(tripDate.start, tripDate.numDays - 1), "d MMM", { locale: dateLocale() })}`
      : format(tripDate.start, "d MMM", { locale: dateLocale() })
    : null;

  // openEditor=true -> tworzy i otwiera edytor wyjazdu; false (zapis zakladka) -> tworzy
  // i laduje w liscie Wyjazdow z toastem.
  const confirm = async (openEditor: boolean) => {
    if (!user) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    if (!items.length) { toast.error("Dodaj przynajmniej jedno miejsce"); return; }
    setCreating(true);
    const dates = tripDate
      ? {
          start_date: format(tripDate.start, "yyyy-MM-dd"),
          end_date: format(addDays(tripDate.start, tripDate.numDays - 1), "yyyy-MM-dd"),
        }
      : undefined;
    const places = items.map((i) => ({
      place_name: i.place_name,
      category: i.category,
      address: i.address,
      latitude: i.latitude,
      longitude: i.longitude,
      photo_url: i.photo_url,
      place_id: i.place_id,
    }));
    // draftId -> aktualizuj istniejaca robocza (bez duplikatu). Inaczej stworz nowa.
    const id = draftId
      ? await updateWyjazdPlaces(draftId, city, name.trim() || city || "Wyjazd", places, dates)
      : await createWyjazdFromPlaces(user.id, city, name.trim() || city || "Wyjazd", places, dates);
    setCreating(false);
    if (!id) { haptics.error(); toast.error(draftId ? "Nie udało się zapisać zmian" : "Nie udało się utworzyć wyjazdu"); return; }
    haptics.success();
    // Trasa jest PRYWATNYM draftem (is_shared=false) - publikuje sie dopiero przy "Zapisz trase"
    // w ReviewSummary. Odswiezamy feed profilaktycznie (np. przy edycji juz opublikowanej trasy).
    queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
    queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
    // openEditor -> review-summary od razu na kroku SUGESTII (step 2), bo plan miejsc user juz
    // ulozyl tutaj w kompozycji. Guzik "Przejdz do sugestii".
    if (openEditor) {
      // Zapamietaj draftId w soft-save SYNCHRONICZNIE (przed navigate/unmount), zeby powrot
      // z sugestii przywrocil miejsca i traktowal ta trase jako edytowana (bez duplikatu).
      setDraftId(id);
      try {
        const cur = JSON.parse(sessionStorage.getItem(softKey) || "{}");
        sessionStorage.setItem(softKey, JSON.stringify({ ...cur, draftId: id }));
      } catch { /* unavailable */ }
      // Utrwal draftId TAKZE w stanie historii ComposeWyjazd (replace) - niezaleznie od
      // sessionStorage (bywa gubione w iOS WebView). Dzieki temu powrot z sugestii lapie
      // draftId i AKTUALIZUJE trase (updateWyjazdPlaces) zamiast tworzyc NOWA za kazdym razem.
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { ...(location.state as any || {}), draftId: id, city, title: name, places },
      });
      navigate(`/review-summary?route=${id}&edit=1&step=2`);
    } else {
      clearSoft();
      toast.success(draftId ? "Zapisano zmiany" : "Zapisano wyjazd");
      navigate("/dziennik");
    }
  };

  // "Twoje zapisane miejsca" (z eksploracji, per miasto) - szybka sciaga do dodania jednym tapem.
  // Zastapily "Propozycje z bazy". Podczas pisania pokazujemy wyniki wyszukiwania.
  const savedForCity = useMemo(() => {
    const mapPlace = (p: any) => ({
      id: p.place_id ?? p.place_name, place_id: p.place_id ?? null, place_name: p.place_name,
      category: p.category, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      photo_url: p.photo_url ?? null, address: p.address ?? null, rating: p.rating ?? null,
    });
    const wanted = new Set(expandCity(city).map((c) => c.toLowerCase()));
    const groups = getHistoryByCity();
    const forCity = groups.filter((g) => wanted.has(g.city.toLowerCase())).flatMap((g) => g.places).map(mapPlace);
    if (forCity.length > 0) return { places: forCity, fallback: false };
    // Fallback: zapisane miejsca sa w innym miescie niz domyslne - pokaz wszystkie (szybka sciaga).
    return { places: groups.flatMap((g) => g.places).map(mapPlace), fallback: true };
  }, [city]);
  const isSearching = search.trim().length >= 2;
  // Ujednolicony uklad z widokiem listy (CreateRanking): wyniki wyszukiwania POD wyszukiwarka,
  // "Wybrane miejsca" (z kafelkiem "+") wyzej, "Twoje zapisane miejsca" POD spodem.
  const searchProposals = results.filter((p) => !isAdded(p));
  const savedProposals = savedForCity.places.filter((p) => !isAdded(p));
  const savedFallback = savedForCity.fallback;

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Naglowek huba tworzenia: ikonowe zakladki + Trasy|Listy. "Listy" -> forma listy z handoffem. */}
      <CreateHeader
        active="tworz"
        mode="trasy"
        onMode={(m) => {
          if (m === "listy") navigate("/zestawienie/nowe", {
            state: {
              city,
              title: nameDirty ? name : null,
              places: items.map((i) => ({
                place_name: i.place_name, category: i.category, address: i.address,
                latitude: i.latitude, longitude: i.longitude, photo_url: i.photo_url, place_id: i.place_id,
              })),
            },
            replace: true,
          });
        }}
        onBack={handleBack}
      />
      {draftId && (
        <InviteFriendsSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          route={{ id: draftId, city: city ?? null, title: name || null, group_session_id: groupSessionId }}
          onInvited={(sid, list) => {
            if (sid) setGroupSessionId(sid);
            setInvited((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              list.forEach((p) => map.set(p.id, p));
              return [...map.values()];
            });
          }}
        />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {/* Hint: jedno zdanie czym jest trasa */}
        <div className="px-4 pt-4">
          <p className="text-sm text-muted-foreground leading-snug">
            {`Trasa to Twój plan wyjazdu: miejsca w kolejności, które zostały odwiedzone.`}
          </p>
        </div>
        {/* Kraj + miasto wybrane wczesniej drum-scrollem (/utworz) - tu bez selektora.
            Nazwa + data */}
        <div className="px-4 pt-3 flex items-center gap-2">
          <input value={name} onChange={(e) => { setName(e.target.value); setNameDirty(true); }} placeholder={isEn ? "Your trip name" : "Twoja nazwa"}
            className="flex-1 min-w-0 rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/60" />
          <button onClick={() => setDateSheet(true)}
            className={`shrink-0 h-[50px] rounded-2xl bg-secondary flex items-center gap-2 px-3.5 active:scale-95 transition-transform ${dateLabel ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            {dateLabel && <span className="text-sm whitespace-nowrap">{dateLabel}</span>}
          </button>
        </div>

        {/* Zapraszanie znajomych PRZENIESIONE na widok trasy po zapisaniu (ReviewSummary) -
            pierwszy widok skupia usera na dodawaniu miejsc. */}

        {/* Wyszukiwarka */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={`Szukaj miejsca w ${city}...`}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground border border-border/40 pl-10 pr-9 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400/50 placeholder:text-muted-foreground/60" />
            {search && (
              <button onClick={() => { setSearch(""); searchRef.current?.blur(); }} aria-label="Wyczyść" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* WYNIKI WYSZUKIWANIA - poziome karty pod wyszukiwarka (tylko podczas pisania). Tap -> wizytowka, "+" -> dodaj. */}
        {isSearching && (
          <div className="pt-4">
            <p className="px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Wyniki wyszukiwania</p>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : searchBlocked && searchProposals.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground pb-2 leading-relaxed">Wyszukiwarka miejsc jest chwilowo niedostępna. Spróbuj później.</p>
            ) : searchProposals.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground pb-2 leading-snug">Brak wyników dla tej frazy.</p>
            ) : (
              // Scroll owiniety w NIE-scrollowy div z px-4: padding na normalnym bloku dziala
              // niezawodnie w iOS WKWebView (w przeciwienstwie do padding na overflow-x kontenerze).
              <div className="px-4">
                <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
                  {searchProposals.slice(0, 15).map((p: any) => (
                    <button key={p.id ?? p.key ?? p.place_name} onClick={() => openDetail(p)} className="shrink-0 w-[150px] snap-start text-left active:opacity-80 transition-opacity">
                      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.place_name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#fcede3] flex items-center justify-center"><img src={categoryIconSrc(p.category)} alt="" className="w-1/5 max-w-[32px] opacity-90" draggable={false} /></div>
                        )}
                        <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); addPlace(p); }} aria-label="Dodaj miejsce"
                          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform">
                          <Plus className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                      </div>
                      <p className="mt-1.5 px-0.5 text-sm font-semibold leading-tight line-clamp-1">{p.place_name}</p>
                      <p className="px-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-1">{p.category ? subcategoryLabelLocalized(p.category) : (p.address || city)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WYBRANE MIEJSCA (N) + toggle lista/karty. Tap -> wizytowka. */}
        <div className="px-4 pt-5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Wybrane miejsca ({items.length})</p>
            {items.length > 0 && (
              <div className="flex rounded-full bg-secondary p-0.5">
                <button type="button" onClick={() => setPlaceView("list")} aria-label="Widok listy" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <List className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPlaceView("detail")} aria-label="Widok kart" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "detail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <GalleryHorizontalEnd className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            /* Pusty stan = kafelek "Dodaj miejsce" (klik = fokus wyszukiwarki), ujednolicony z lista. */
            <button type="button" onClick={() => searchRef.current?.focus()}
              className="w-full rounded-2xl border-2 border-dashed border-border/70 bg-secondary/40 flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground active:scale-[0.99] transition-transform">
              <span className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"><Plus className="h-5 w-5 text-orange-600" /></span>
              <span className="text-sm font-bold text-foreground">Dodaj miejsce</span>
              <span className="text-[12px] text-center">Wyszukaj lub wybierz z zapisanych poniżej</span>
            </button>
          ) : placeView === "detail" ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
              {items.map((it) => (
                <button key={it.key} onClick={() => openDetail(it)} className="shrink-0 w-[220px] snap-start rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm text-left active:opacity-90 transition-opacity">
                  <div className="relative aspect-[4/3] bg-muted">
                    {it.photo_url ? (
                      <img src={it.photo_url} alt={it.place_name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#fcede3] flex items-center justify-center"><img src={categoryIconSrc(it.category)} alt="" className="w-1/5 max-w-[40px] opacity-90" draggable={false} /></div>
                    )}
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setConfirmRemove({ key: it.key, name: it.place_name }); }} aria-label="Usuń miejsce"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center active:scale-90 transition-transform">
                      <X className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    {it.category && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground mb-1">{subcategoryLabelLocalized(it.category)}</span>}
                    <p className="text-sm font-semibold leading-tight line-clamp-1">{it.place_name}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1">{it.address || city}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Widok listy z DRAG & DROP (przeciaganie uchwytem zmienia kolejnosc = przebieg trasy). */
            /* key={items.length}: Reorder.Group czasem nie renderuje swiezo DODANYCH itemow do czasu
               remountu (trzeba bylo przelaczyc widok). Remount przy zmianie liczby miejsc naprawia to;
               reorder NIE zmienia dlugosci, wiec drag & drop dziala plynnie (bez remountu). */
            <Reorder.Group key={items.length} axis="y" values={items} onReorder={setItems} className="space-y-2.5">
              {items.map((it, idx) => (
                <SortableComposeRow
                  key={it.key}
                  it={it}
                  idx={idx}
                  onOpen={() => openDetail(it)}
                  onRemove={() => setConfirmRemove({ key: it.key, name: it.place_name })}
                />
              ))}
            </Reorder.Group>
          )}

          {/* Kafelek "Dodaj miejsce" pod wybranymi (gdy sa juz miejsca) - klik = fokus wyszukiwarki. */}
          {items.length > 0 && (
            <button type="button" onClick={() => searchRef.current?.focus()}
              className="mt-2.5 w-full rounded-2xl border-2 border-dashed border-border/70 bg-secondary/40 flex items-center justify-center gap-2 py-3.5 text-muted-foreground active:scale-[0.99] transition-transform">
              <Plus className="h-4 w-4 text-orange-600" /><span className="text-sm font-bold text-foreground">Dodaj miejsce</span>
            </button>
          )}
        </div>

        {/* TWOJE ZAPISANE MIEJSCA - szybka sciaga pod wybranymi (ukryte podczas szukania). Ujednolicone z lista. */}
        {!isSearching && (
          <div className="px-4 pt-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">
              {savedFallback && savedProposals.length > 0 ? "Twoje zapisane miejsca (z innych miast)" : "Twoje zapisane miejsca"}
            </p>
            {savedProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground leading-snug">{`Nie masz jeszcze zapisanych miejsc. Polub miejsca w eksploracji, żeby dodać je tu jednym tapem.`}</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
                {savedProposals.slice(0, 15).map((p: any) => (
                  <button key={p.id ?? p.key ?? p.place_name} onClick={() => openDetail(p)} className="shrink-0 w-[150px] snap-start text-left active:opacity-80 transition-opacity">
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.place_name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#fcede3] flex items-center justify-center"><img src={categoryIconSrc(p.category)} alt="" className="w-1/5 max-w-[32px] opacity-90" draggable={false} /></div>
                      )}
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); addPlace(p); }} aria-label="Dodaj miejsce"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform">
                        <Plus className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                    </div>
                    <p className="mt-1.5 px-0.5 text-sm font-semibold leading-tight line-clamp-1">{p.place_name}</p>
                    <p className="px-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-1">{p.category ? subcategoryLabelLocalized(p.category) : (p.address || city)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MAPA - statyczna z guzikiem rozwinięcia (interaktywna mapa z zoomem) */}
        {mapPins.length > 0 && staticMapUrl && (
          <div className="px-4 pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2.5">Mapa</p>
            <div className="relative h-52 rounded-2xl overflow-hidden border border-border/40 bg-muted">
              <img src={staticMapUrl} alt="Mapa miejsc" className="w-full h-full object-cover" />
              <button onClick={() => setMapExpanded(true)} aria-label="Rozwiń mapę"
                className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform">
                <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer - ukryty gdy fokus na wyszukiwarce (wiecej miejsca na wyniki). */}
      {!searchFocused && (
        <div className="shrink-0 border-t border-border/20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-background flex items-center gap-2">
          <button onClick={() => confirm(true)} disabled={creating}
            className="flex-1 h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Przejdź do sugestii <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}

      {/* Wizytowka miejsca (tap w karte) */}
      <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={city} />

      {/* Rozwinięta interaktywna mapa (zoom) */}
      <Sheet open={mapExpanded} onOpenChange={setMapExpanded}>
        <SheetContent side="bottom" className="p-0 [&>button:last-child]:hidden" style={{ height: "92dvh" }}>
          <div className="relative w-full h-full">
            <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setMapExpanded(false)} aria-label="Zamknij mapę"
              className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet z kalendarzem */}
      <Sheet open={dateSheet} onOpenChange={setDateSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 [&>button:last-child]:hidden" style={{ maxHeight: "88vh" }}>
          <div className="px-5 pt-5 pb-1 text-center">
            <p className="text-base font-bold leading-tight">Wybierz daty dla trasy <span className="font-normal text-muted-foreground">(opcjonalnie)</span></p>
          </div>
          <FullCalendarPicker allowPast onConfirm={(d, n) => { setTripDate({ start: d, numDays: n }); setDateSheet(false); }} onClear={() => { setTripDate(null); setDateSheet(false); }} />
        </SheetContent>
      </Sheet>

      {/* Popup potwierdzenia usuniecia miejsca z trasy. */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-black leading-tight">Usunąć miejsce z trasy?</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {confirmRemove.name ? `„${confirmRemove.name}" zniknie z tej trasy.` : "To miejsce zniknie z tej trasy."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => { removePlace(confirmRemove.key); setConfirmRemove(null); }}
                className="w-full h-12 rounded-2xl bg-destructive text-white font-bold text-sm flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                Usuń miejsce
              </button>
              <button
                onClick={() => setConfirmRemove(null)}
                className="w-full h-12 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center active:scale-95 transition-transform"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup przy cofaniu: zapis do roboczych albo wyjscie bez zapisu. */}
      {showBackConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowBackConfirm(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-black leading-tight">{draftId ? "Zapisać zmiany?" : "Zapisać trasę do roboczych?"}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {draftId
                ? "Masz niezapisane zmiany w tej roboczej trasie. Zapisać je?"
                : `Masz ${items.length} ${items.length === 1 ? "miejsce" : items.length < 5 ? "miejsca" : "miejsc"} w trasie. Zapisz ją jako roboczą, żeby wrócić do niej później.`}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => { setShowBackConfirm(false); confirm(false); }}
                disabled={creating}
                className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {draftId ? "Zapisz zmiany" : "Zapisz jako roboczą"}
              </button>
              <button
                onClick={() => { setShowBackConfirm(false); exitCreate(); }}
                className="w-full h-12 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center active:scale-95 transition-transform"
              >
                Nie zapisuj, wyjdź
              </button>
              <button
                onClick={() => setShowBackConfirm(false)}
                className="w-full py-2 text-sm font-medium text-muted-foreground active:text-foreground transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
