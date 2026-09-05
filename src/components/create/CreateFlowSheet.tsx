import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, X, Users, ChevronRight, ArrowLeft, Plus, Check, CalendarPlus, History, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import CityCountryPicker, { defaultCityIndex } from "@/components/create/CityDrum";
import AddPeoplePicker, { type PersonLite } from "@/components/create/AddPeoplePicker";
import { fetchSavedPlaces, createListFromSavedPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";
import { createWyjazdFromPlaces, createEmptyWyjazd } from "@/lib/createWyjazd";
import { inviteUsersToRoute } from "@/lib/groupInvite";
import { citiesForCountry } from "@/lib/tripCountries";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { GoogleGlyph } from "@/components/icons/GoogleGlyph";
import { openExternal } from "@/lib/openExternal";
import SheetSkeleton from "@/components/layout/SheetSkeleton";

type Step = "entry" | "listCity" | "listName" | "listPick" | "tripMode" | "trip" | "tripDates" | "tripPeople";
type TripMode = "future" | "past";

const NBSP = " ";
// Domyslne miasto startowe wyjazdu: Gdańsk (aktualny focus contentu) jak w CountryCityPicker.
const defaultCity = () => { const cs = citiesForCountry("Polska"); return cs[defaultCityIndex(cs)] ?? cs[0]; };
// Normalizacja miasta do porownan (lower, bez diakrytyk: NFD + ł->l) - filtr zapisanych po miescie wyjazdu.
const normCityName = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").trim();

const toPlaceForList = (p: SavedPlace): PlaceForList => ({
  place_name: p.place_name, category: p.category, address: p.address,
  latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
  google_place_id: p.google_place_id, rating: p.rating,
});

// Arkusz tworzenia (sheet-first, redesign 2026-08-20). "+" -> "Co dzisiaj tworzymy?" [Lista|Wyjazd].
// Lista: nazwa + prywatnosc + wybor z zapisanych (lub "Dodaj nowe" -> pelny edytor CreateRanking).
// Wyjazd: nazwa + kraj/miasto (drum w drawerze) + "Dodaj osoby" (realne zaproszenia) -> ComposeWyjazd.
export default function CreateFlowSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("entry");

  // Lista
  const [listName, setListName] = useState("");
  const [listNameEdited, setListNameEdited] = useState(false);   // czy user recznie zmienil nazwe (nie nadpisuj default)
  const [listCity, setListCity] = useState(defaultCity);   // miasto listy - zawezenie wyszukiwarki Google
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  // Wyszukiwarka Google Places INLINE (zamiast nawigacji do starego edytora CreateRanking).
  // manualPlaces = miejsca dodane z wynikow Google (nie z zapisanych), zawsze doliczane do listy.
  const [listQuery, setListQuery] = useState("");
  const [manualPlaces, setManualPlaces] = useState<PlaceForList[]>([]);
  const [detailPlace, setDetailPlace] = useState<any | null>(null);   // wizytowka miejsca (PlaceSwiperDetail)
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);   // "Zapisz to miejsce" -> SavePlaceSheet
  const listSearchRef = useRef<HTMLInputElement>(null);
  const [tripCity, setTripCity] = useState(defaultCity);   // miasto wyjazdu (wyzej: wspolny pickCity dla wyszukiwarki)
  // Miasto dla wyszukiwarki miejsc. Kiedys dzielil ja krok wyboru miejsc do wyjazdu; dzis
  // miejsca do wyjazdu dodaje sie juz w widoku wyjazdu, wiec zostaje sama lista.
  const pickCity = listCity;
  const pickActive = open && step === "listPick";
  // Srodek wybranego miasta (geokod) - TWARDY filtr wynikow Google w obrebie miasta (inaczej "ato
  // ramen" dla Wroclawia zwracalo pozycje z USA). Zawezenie + dopisanie miasta do zapytania.
  const { data: listGeoCenter = null } = useQuery({
    queryKey: ["pickcity-center", pickCity],
    enabled: pickActive && !!pickCity,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "textsearch", query: pickCity } });
      const r = ((data as any)?.results ?? [])[0];
      return r?.latitude != null ? { lat: r.latitude as number, lng: r.longitude as number } : null;
    },
  });
  const { results: listResults, searching: listSearching, blocked: listBlocked, searchMode: listSearchMode } =
    usePlaceSearch(listQuery, { city: pickCity, center: listGeoCenter, scopeKm: 30, enabled: pickActive });

  // Wyjazd
  const [tripMode, setTripMode] = useState<TripMode>("future");
  const [tripName, setTripName] = useState("");
  // Daty wyjazdu z kreatora - krok opcjonalny ("Pomiń"). Zakres wielodniowy wlacza pozniej
  // podzial miejsc na dni w widoku wyjazdu (routes.end_date + pins.day_index).
  const [tripStart, setTripStart] = useState<Date | null>(null);
  const [tripDays, setTripDays] = useState(1);
  const [tripPeople, setTripPeople] = useState<PersonLite[]>([]);

  // Fokus (klawiatura) RAZEM z pojawieniem kroku "Nowa lista" - drawer wyjezdza wraz z klawiatura,
  // jedna plynna animacja. Fokus na NASTEPNEJ klatce po wyrenderowaniu inputu (double rAF), zamiast
  // ~260ms opoznienia (dawalo blysk: drawer stal chwile, potem WebView z resize:native migotal pod
  // klawiatura). NIE setTimeout - klawiatura ma wstac od razu z krokiem, nie osobno.
  const listNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || step !== "listName") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => listNameRef.current?.focus()); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [open, step]);

  // Reset przy kazdym otwarciu.
  useEffect(() => {
    if (open) {
      setStep("entry"); setListName(""); setListNameEdited(false); setListCity(defaultCity()); setSelected(new Set()); setListQuery(""); setManualPlaces([]); setDetailPlace(null); setTripStart(null); setTripDays(1);
      setTripMode("future"); setTripName(""); setTripCity(defaultCity()); setTripPeople([]); setCreating(false);
    }
  }, [open]);

  const { data: profile } = useQuery({
    queryKey: ["create-author", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("username, first_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data as { username: string | null; first_name: string | null; avatar_url: string | null } | null;
    },
  });
  const author = { name: profile?.username || profile?.first_name || "Użytkownik", avatar: profile?.avatar_url ?? null };

  const { data: savedPlaces = [], isLoading: loadingSaved } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  const close = () => onClose();
  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePerson = (p: PersonLite) => setTripPeople((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);
  const tripPeopleIds = new Set(tripPeople.map((p) => p.id));

  const keyOfPlace = (p: { place_name?: string | null }) => (p.place_name || "").trim().toLowerCase();
  // Klik wyniku Google -> dodaj do manualPlaces (dedup po nazwie) i wroc do listy (wyczysc fraze).
  const pickResult = (r: PlaceForList) => {
    haptics.light();
    setManualPlaces((prev) => prev.some((m) => keyOfPlace(m) === keyOfPlace(r)) ? prev : [r, ...prev]);
    setListQuery("");
  };
  const removeManual = (p: PlaceForList) => setManualPlaces((prev) => prev.filter((m) => keyOfPlace(m) !== keyOfPlace(p)));

  // Wizytowka miejsca (PlaceSwiperDetail) - mapowanie zapisanego/googlowego miejsca na MockPlace.
  const openDetail = (p: any) => { haptics.light(); setDetailPlace({
    id: p.place_id || p.id || p.place_name,
    place_name: p.place_name,
    category: (p.category || "other"),
    city: (p.city ?? pickCity) || "",
    address: p.address || "",
    latitude: p.latitude ?? 0,
    longitude: p.longitude ?? 0,
    rating: p.rating ?? 0,
    photo_url: p.photo_url ?? "",
    vibe_tags: [],
    // NIE pokazujemy short_desc jako opisu miejsca - to notka usera (jego wlasna albo, dla
    // starych wpisow, skopiowana od autora listy), a nie opis lokalu.
    description: p.description ?? "",
    google_place_id: p.google_place_id ?? null,
  }); };
  // Otworz miejsce w Google Maps (wizytowka/place page). query_place_id gdy mamy Google Place ID
  // (google_place_id lub place_id niebedace naszym DB uuid) - inaczej szukamy po nazwie+adresie+miescie.
  const openGooglePlace = (p: any) => {
    haptics.light();
    const q = encodeURIComponent([p.place_name, p.address, p.city ?? listCity].filter(Boolean).join(", "));
    const gpid = typeof p.google_place_id === "string" && p.google_place_id.trim() ? p.google_place_id.trim() : "";
    const pid0 = typeof p.place_id === "string" && p.place_id.trim() ? p.place_id.trim() : "";
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid0);
    const gid = gpid || (isDbUuid ? "" : pid0);
    const placeIdParam = gid ? `&query_place_id=${encodeURIComponent(gid)}` : "";
    void openExternal(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`);
  };

  // Wiersz listy: klik nazwy/ikony = WIZYTOWKA; ikona Google (po lewej od kolka) = Google Maps;
  // kolko po prawej = dodaj/usun z listy. Wiecej pozycji sie miesci niz w siatce.
  const renderListRow = (opts: { rowKey: string; place: any; subtitle?: string | null; onToggle: () => void; selected: boolean }) => (
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
      <button onClick={() => openGooglePlace(opts.place)} aria-label={`Otwórz ${opts.place.place_name} w Google Maps`}
        className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
        <GoogleGlyph className="h-[18px] w-[18px]" />
      </button>
      <button onClick={opts.onToggle} aria-label={opts.selected ? "Usuń z listy" : "Dodaj do listy"}
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${opts.selected ? "bg-[#f0a583] text-white" : "border-2 border-border"}`}>
        {opts.selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );

  const createList = async () => {
    if (!user) { close(); navigate("/auth"); return; }
    // Miejsca listy = zaznaczone zapisane + dodane z Google (manual), dedup po nazwie.
    const savedSel = savedPlaces.filter((p) => selected.has(p.id)).map(toPlaceForList);
    const seen = new Set<string>();
    const places = [...manualPlaces, ...savedSel].filter((p) => { const k = keyOfPlace(p); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    // Pusta lista jest OK (opcja "Pomiń") - miejsca mozna dodac pozniej na widoku listy.
    setCreating(true);
    haptics.light();
    const id = await createListFromSavedPlaces(user.id, {
      title: listName.trim() || (listCity ? `Lista miejsc ${listCity}` : "Lista miejsc"),
      city: listCity || null, isPublic: true, places, author,
    });
    setCreating(false);
    if (!id) { haptics.error(); toast.error("Nie udało się utworzyć listy"); return; }
    haptics.success();
    toast.success("Lista utworzona");
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed", user.id] });
    queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user.id] });
    close();
    navigate(`/lista/${id}`);
  };

  // Daty z kreatora -> ISO (YYYY-MM-DD). Pominiecie kroku = brak dat (wyjazd bez podzialu na dni).
  const tripDatesForSave = (start: Date | null = tripStart, days: number = tripDays) => {
    if (!start) return { startDate: null as string | null, endDate: null as string | null };
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const end = new Date(start.getTime() + (Math.max(1, days) - 1) * 86400000);
    return { startDate: iso(start), endDate: iso(end) };
  };
  // Krok dat -> od razu tworzymy wyjazd, TAK SAMO dla przyszlego i przeszlego.
  // Wczesniej przeszly szedl jeszcze przez wybor miejsc w kreatorze; teraz miejsca dodaje
  // sie dopiero w widoku wyjazdu, jak w wyjezdzie przyszlym (decyzja Nat 2026-09-05).
  const afterDates = (start: Date | null = tripStart, days: number = tripDays) => {
    void proceedTrip(start, days);
  };

  // Kreator tworzy PUSTY szkic wyjazdu i wpuszcza od razu do widoku wyjazdu - tam dodaje sie
  // miejsca. Etap zalezy od trybu: przyszly = "planning" (propozycje), przeszly = "completed"
  // (wspomnienie). Kreator ustala wylacznie meta: nazwe, miasto, daty, osoby.
  const proceedTrip = async (startArg: Date | null = tripStart, daysArg: number = tripDays) => {
    if (!user) { close(); navigate("/auth"); return; }
    setCreating(true);
    haptics.light();
    const id = await createEmptyWyjazd(user.id, tripCity, tripName.trim() || `Wyjazd do ${tripCity}`,
      { ...tripDatesForSave(startArg, daysArg), tripType: tripMode === "past" ? "completed" : "planning" });
    if (!id) { setCreating(false); haptics.error(); toast.error("Nie udało się utworzyć wyjazdu"); return; }
    if (tripPeople.length) {
      try { await inviteUsersToRoute({ id, city: tripCity ?? null, title: tripName.trim() || null, group_session_id: null }, tripPeople.map((p) => p.id), user.id); }
      catch (e: any) { console.warn("[CreateFlowSheet] invite failed:", e?.message ?? e); }
    }
    setCreating(false);
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
    close();
    // Wejscie do WIDOKU WYJAZDU (SharedRoute) - swiezy szkic, miejsca dodaje sie guzikiem "+".
    // Etap (propozycje / wspomnienie) rozstrzyga trip_type ustawiony wyzej.
    navigate(`/route/${id}`);
  };

  // ── wspolny nagłowek Anuluj / tytul / Dalej ──
  const Header = ({ title, onBack, onNext, nextLabel = "Dalej", nextEnabled = true, backLabel = "Anuluj" }: {
    title: string; onBack: () => void; onNext?: () => void; nextLabel?: string; nextEnabled?: boolean; backLabel?: string;
  }) => (
    <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
      <button onClick={onBack} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 transition-opacity shrink-0">{backLabel}</button>
      <h2 className="text-[20px] font-semibold text-foreground truncate">{title}</h2>
      {onNext ? (
        <button onClick={onNext} disabled={!nextEnabled}
          className={`text-sm font-medium rounded-full border bg-white px-3.5 py-1.5 shrink-0 transition-opacity ${nextEnabled ? "text-[#181818] border-black/15 active:opacity-60" : "text-[#bcbcbc] border-black/[0.07]"}`}>
          {nextLabel}
        </button>
      ) : <span className="w-[68px] shrink-0" />}
    </div>
  );

  // ── wiersz "Dodaj osoby" ──
  const PeopleRow = ({ kind, disabled, people, onClick }: { kind: "listy" | "wyjazdu"; disabled?: boolean; people?: PersonLite[]; onClick?: () => void }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`w-full flex items-center gap-4 px-5 py-3 text-left ${disabled ? "opacity-45" : "active:bg-muted/50"} transition-colors`}>
      <Users className="h-6 w-6 text-foreground shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-foreground">{kind === "listy" ? `Dodaj osoby do${NBSP}listy` : `Dodaj osoby do${NBSP}wyjazdu`}</p>
        <p className="text-[13px] text-muted-foreground">{kind === "listy" ? `Twórz listy razem z${NBSP}innymi` : `Twórz wyjazdy razem z${NBSP}innymi`}</p>
      </div>
      {disabled ? (
        <span className="shrink-0 text-[11px] font-bold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">Wkrótce</span>
      ) : (
        <span className="shrink-0 flex items-center gap-2">
          {people && people.length > 0 && (
            <span className="flex items-center -space-x-2">
              {people.slice(0, 3).map((p) => (
                <img key={p.id} src={avatarSrc(p.avatar_url)} alt="" className="h-7 w-7 rounded-full border-2 border-white object-cover bg-secondary" />
              ))}
              {people.length > 3 && (
                <span className="h-7 w-7 rounded-full border-2 border-white bg-secondary text-[10px] font-bold text-foreground flex items-center justify-center">+{people.length - 3}</span>
              )}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
    </button>
  );

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-[#fefefe] border-0" style={{ maxHeight: "88vh" }}>
        {/* grabber */}
        <div className="pt-3 pb-1 shrink-0"><div className="mx-auto h-1 w-10 rounded-full bg-[#d9d9d9]" /></div>

        {/* ── ENTRY ── */}
        {step === "entry" && (
          <div className="px-5 pt-1 pb-[max(20px,env(safe-area-inset-bottom))]">
            <h2 className="text-[20px] font-semibold text-foreground text-center">Co dzisiaj tworzymy?</h2>
            <div className="mt-4 flex gap-4">
              {[
                { key: "list", label: "Lista", icon: <FileText className="h-8 w-8 text-foreground" strokeWidth={1.7} />, go: () => { track("list_create_opened"); setStep("listCity"); } },
                { key: "trip", label: "Wyjazd", icon: <img src="/spontaway-symbol.png" alt="" className="h-9 w-9 object-contain" style={{ filter: "brightness(0)" }} draggable={false} />, go: () => { track("trip_create_opened"); setStep("tripMode"); } },
              ].map((t) => (
                <button key={t.key} onClick={() => { haptics.light(); t.go(); }} className="flex-1 flex flex-col items-center gap-3 active:scale-[0.98] transition-transform outline-none focus:outline-none focus-visible:outline-none">
                  <span className="w-full h-[90px] rounded-2xl bg-[#efefef] flex items-center justify-center">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── WYJAZD: wybor trybu (przyszly = zaplanuj / przeszly = wspomnienie) ── */}
        {step === "tripMode" && (
          <div className="pb-[max(20px,env(safe-area-inset-bottom))]">
            <Header title="Jaki to wyjazd?" onBack={() => setStep("entry")} backLabel="Wstecz" />
            <div className="px-5 pt-1 flex gap-4">
              {[
                { key: "past" as TripMode, label: "Przeszły", sub: "Dodaj wspomnienie", icon: <History className="h-8 w-8 text-foreground" strokeWidth={1.7} /> },
                { key: "future" as TripMode, label: "Przyszły", sub: "Zaplanuj wyjazd", icon: <CalendarPlus className="h-8 w-8 text-foreground" strokeWidth={1.7} /> },
              ].map((m) => (
                <button key={m.key} onClick={() => { haptics.light(); setTripMode(m.key); setStep("trip"); }}
                  className="flex-1 flex flex-col items-center gap-2 active:scale-[0.98] transition-transform outline-none focus:outline-none focus-visible:outline-none">
                  <span className="w-full h-[90px] rounded-2xl bg-[#efefef] flex items-center justify-center">{m.icon}</span>
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                  <span className="text-[12px] text-muted-foreground -mt-1 text-center">{m.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTA: wybor miasta (zawezenie wyszukiwarki Google + domyslna nazwa "Lista miejsc {miasto}") ── */}
        {step === "listCity" && (
          <div className="pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title="Miasto listy" onBack={() => setStep("entry")}
              onNext={() => { if (!listNameEdited) setListName(`Lista miejsc ${listCity}`); setStep("listName"); }} />
            <div className="px-5 pt-1">
              <CityCountryPicker city={listCity} onCityChange={setListCity} compact />
              {/* Miasto jest OPCJONALNE - lista moze zbierac miejsca z calego swiata (prosba Nat
                  2026-08-30). "Pomiń" czysci miasto i idzie dalej z generyczna nazwa. */}
              <button
                type="button"
                onClick={() => { setListCity(""); if (!listNameEdited) setListName("Lista miejsc"); setStep("listName"); }}
                className="mt-3 w-full py-2.5 text-sm font-semibold text-muted-foreground active:text-foreground transition-colors"
              >
                Pomiń - lista bez miasta
              </button>
            </div>
          </div>
        )}

        {/* ── LISTA: nazwa + prywatnosc ── */}
        {step === "listName" && (
          <div className="pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title="Nowa lista" onBack={() => setStep("listCity")} onNext={() => setStep("listPick")} nextEnabled={!!listName.trim()} />
            <div className="px-5 pt-1">
              <div className="relative">
                <input ref={listNameRef} value={listName} onChange={(e) => { setListName(e.target.value); setListNameEdited(true); }} placeholder="Nazwa listy"
                  className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-4 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
                {listName && (
                  <button onClick={() => { setListName(""); setListNameEdited(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <PeopleRow kind="listy" disabled />
            </div>
          </div>
        )}

        {/* ── LISTA: wyszukiwarka Google (inline) + wybor zapisanych ── */}
        {step === "listPick" && (
          <>
            <Header title={listName.trim() || "Nazwa listy"} onBack={() => setStep("listName")}
              onNext={createList} nextLabel={creating ? "..." : ((selected.size > 0 || manualPlaces.length > 0) ? "Dalej" : "Pomiń")} nextEnabled={!creating} />
            <PeopleRow kind="listy" disabled />
            {/* Wyszukiwarka Google Places INLINE - klik = wyniki tutaj (a NIE nawigacja do starego edytora). */}
            <div className="px-5 pt-1 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input ref={listSearchRef} value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Szukaj miejsca"
                  className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-10 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
                {listQuery && (
                  <button onClick={() => setListQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {listSearchMode ? (
                <div className="pt-1 space-y-1.5">
                  {listSearching && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>}
                  {listBlocked && <p className="py-6 text-center text-sm text-muted-foreground">{`Wyszukiwarka chwilowo niedostępna. Wybierz z${NBSP}zapisanych.`}</p>}
                  {!listSearching && !listBlocked && listResults.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Brak wyników</p>
                  )}
                  {listResults.map((r, i) => renderListRow({
                    rowKey: `${keyOfPlace(r)}-${i}`, place: r, subtitle: r.address,
                    onToggle: () => pickResult(r), selected: manualPlaces.some((m) => keyOfPlace(m) === keyOfPlace(r)),
                  }))}
                </div>
              ) : loadingSaved ? (
                <SheetSkeleton variant="places" rows={3} className="pt-1" />
              ) : (
                <div className="pt-1 space-y-1.5">
                  {/* Dodane z Google (manual) - zaznaczone, klik usuwa z listy */}
                  {manualPlaces.map((p, i) => renderListRow({
                    rowKey: `m-${keyOfPlace(p)}-${i}`, place: p, subtitle: listCity,
                    onToggle: () => removeManual(p), selected: true,
                  }))}
                  {savedPlaces.length > 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground pt-1 px-0.5">Twoje zapisane miejsca</p>
                  )}
                  {savedPlaces.map((p) => renderListRow({
                    rowKey: p.id, place: p, subtitle: p.city,
                    onToggle: () => toggleSel(p.id), selected: selected.has(p.id),
                  }))}
                </div>
              )}
              {!listSearchMode && !loadingSaved && savedPlaces.length === 0 && manualPlaces.length === 0 && (
                <p className="mt-4 px-2 text-center text-sm text-muted-foreground">{`Nie masz jeszcze zapisanych miejsc. Wyszukaj miejsce powyżej albo zapisuj je w${NBSP}eksploracji.`}</p>
              )}
            </div>
          </>
        )}

        {/* ── WYJAZD: nazwa + kraj/miasto + osoby ── */}
        {step === "trip" && (
          <>
            <Header title={tripMode === "past" ? "Przeszły wyjazd" : "Zaplanuj wyjazd"} onBack={() => setStep("tripMode")} onNext={() => setStep("tripDates")} nextLabel="Dalej" nextEnabled={!creating} />
            <div className="flex-1 min-h-0 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="px-5 pt-1">
                <div className="relative">
                  <input value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="Nazwa trasy"
                    className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-4 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
                  {tripName && (
                    <button onClick={() => setTripName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 pt-4">
                <CityCountryPicker city={tripCity} onCityChange={setTripCity} compact />
              </div>
              <div className="mt-2 border-t border-border/50">
                <PeopleRow kind="wyjazdu" people={tripPeople} onClick={() => setStep("tripPeople")} />
              </div>
            </div>
          </>
        )}

        {/* ── WYJAZD: DATY (krok opcjonalny) ── */}
        {step === "tripDates" && (
          <>
                        {/* Guzik w naglowku dziala na ZAZNACZENIU z kalendarza (onRangeChange), wiec user
                moze najpierw wybrac daty, a dopiero potem kliknac "Utwórz". Bez dat = wyjazd
                bez dat (mozna je dodac pozniej w widoku wyjazdu). */}
            <Header
              title="Wybierz datę"
              onBack={() => setStep("trip")}
              backLabel="Wstecz"
              onNext={() => afterDates()}
              nextLabel={creating ? "..." : "Utwórz"}
              nextEnabled={!creating}
            />
            <div className="flex-1 min-h-0 overflow-y-auto pb-[max(32px,calc(env(safe-area-inset-bottom,0px)+24px))]">
              {/* -4px: Header ma pb-3 (12px), a odstep naglowek -> hint ma byc 8px. */}
              <p className="px-5 -mt-1 text-[13px] text-muted-foreground leading-relaxed">
                {`Wybierz jeden dzień albo zakres. Przy kilku dniach rozłożysz miejsca na dni już w wyjeździe.`}
              </p>
              <FullCalendarPicker
                maxDays={14}
                allowPast={tripMode === "past"}
                onRangeChange={(d, numDays) => { setTripStart(d); setTripDays(Math.max(1, numDays)); }}
                onConfirm={(d, numDays) => { setTripStart(d); setTripDays(numDays); afterDates(d, numDays); }}
                onClear={tripStart ? () => { setTripStart(null); setTripDays(1); } : undefined}
              />
              <div className="px-5 pt-2">
                <button
                  onClick={() => { setTripStart(null); setTripDays(1); afterDates(null, 1); }}
                  disabled={creating}
                  className="w-full py-3 text-sm font-medium text-muted-foreground active:text-foreground transition-colors disabled:opacity-50"
                >
                  {`Pomiń - dodam daty później`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── WYJAZD: wybor osob ── */}
        {step === "tripPeople" && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
              <button onClick={() => setStep("trip")} className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full active:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></button>
              <h2 className="text-[20px] font-semibold text-foreground">Dodaj osoby</h2>
              <button onClick={() => setStep("trip")} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">Gotowe</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              {user && <AddPeoplePicker userId={user.id} selected={tripPeopleIds} onToggle={togglePerson} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    {/* Wizytowka miejsca (klik w wiersz). Vaul-drawer nakłada się na arkusz tworzenia. */}
    <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={detailPlace?.city || pickCity}
      onLike={user && detailPlace ? () => setSavePlace({
        place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
        city: detailPlace.city ?? null,
        latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
        photo_url: detailPlace.photo_url || null,
        place_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(detailPlace.id ?? "")) ? detailPlace.id : null,
      }) : undefined} />
    {/* "Zapisz to miejsce" z wizytowki (lista + wyjazd) -> auto-zapis do Ogolne + opcjonalnie do listy. */}
    <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={pickCity} />
    </>
  );
}
