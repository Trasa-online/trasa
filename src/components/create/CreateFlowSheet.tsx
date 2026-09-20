import { useEffect, useRef, useState } from "react";
import { MAX_TRIP_DAYS } from "@/lib/tripDays";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, X, Users, ChevronRight, ArrowLeft, Plus, Loader2 } from "lucide-react";
import { BrandCalendar, BrandSearch, BrandCheck } from "@/components/BrandIcon";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import CountryPicker from "@/components/create/CountryPicker";
import { citiesForCountry } from "@/lib/tripCountries";
import AddPeoplePicker, { type PersonLite } from "@/components/create/AddPeoplePicker";
import { fetchSavedPlaces, createListFromSavedPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";
import { askPermissionSoon } from "@/lib/permissionPrompts";
import { collectionName, tripName, type NamingStrings } from "@/lib/placeNaming";
import { createWyjazdFromPlaces, createEmptyWyjazd } from "@/lib/createWyjazd";
import { checkPlaceLimit } from "@/lib/placeLimits";
import { inviteUsersToRoute } from "@/lib/groupInvite";
import { inviteUsersToCollection } from "@/lib/collectionInvite";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { GoogleGlyph } from "@/components/icons/GoogleGlyph";
import { openExternal } from "@/lib/openExternal";
import SheetSkeleton from "@/components/layout/SheetSkeleton";

type Step = "entry" | "listCountry" | "listCity" | "listName" | "listPick" | "listPeople" | "tripCountry" | "tripDates" | "tripDaysStep" | "tripPeople";

// Nazwa wyjazdu/listy powstaje z WYBRANYCH KRAJOW, a nie z osobnego kroku (decyzja Nat
// 2026-09-10). Krok "jak to nazwac" byl przed wyborem miejsc, czyli zanim user w ogole
// wiedzial, co w tym bedzie - i tak wracal do zmiany. Zmiana nazwy zyje teraz w widoku
// wyjazdu/listy, gdzie jest o czym decydowac.
const toPlaceForList = (p: SavedPlace): PlaceForList => ({
  place_name: p.place_name, category: p.category, address: p.address,
  latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
  google_place_id: p.google_place_id, rating: p.rating,
});

// Arkusz tworzenia (sheet-first, redesign 2026-08-20). "+" -> t("title") [Lista|Wyjazd].
// Lista: nazwa + prywatnosc + wybor z zapisanych (lub "Dodaj nowe" -> pelny edytor CreateRanking).
// Wyjazd: nazwa + kraj/miasto (drum w drawerze) + t("invite.cta") (realne zaproszenia) -> ComposeWyjazd.
export default function CreateFlowSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation("create-route");
  const navigate = useNavigate();
  // Domyslne nazwy nowej kolekcji/wyjazdu - z odmiana po polsku (patrz lib/placeNaming).
  const naming: NamingStrings = {
    collectionIn: t("naming.collection_in"),
    collectionPlain: t("naming.collection_plain"),
    tripTo: t("naming.trip_to"),
    tripPlain: t("naming.trip_plain"),
    collectionFallback: t("list_name_default"),
    tripFallback: t("trip_name_default"),
    declines: (i18n.language || "pl").toLowerCase().startsWith("pl"),
  };
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("entry");

  // Lista
  const [listCountries, setListCountries] = useState<string[]>([]);   // zasieg listy = kraje
  // MIASTO i NAZWA kolekcji (prosba Nat 2026-09-15). Do tej pory kreator szedl kraj -> miejsca,
  // a nazwa powstawala automatycznie z kraju i nie dalo sie jej tknac przed utworzeniem.
  const [listCity, setListCity] = useState("");
  const [listTitle, setListTitle] = useState("");
  // Wspoltworcy kolekcji (prosba Nat 2026-09-15) - dokladnie ten sam mechanizm, co przy
  // wyjezdzie: wiersz na dole ostatniego kroku, osobny ekran wyboru, zaproszenia wychodza
  // RAZEM z gotowa kolekcja (przed jej utworzeniem nie ma do czego zapraszac).
  const [listPeople, setListPeople] = useState<PersonLite[]>([]);
  // Dopoki user nie tknal pola nazwy, nazwa JEDZIE ZA wyborem kraju i miasta. Po pierwszej
  // edycji zostaje ta wpisana - inaczej cofniecie sie po miasto kasowaloby jego tekst.
  const [titleTouched, setTitleTouched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  // Wyszukiwarka Google Places INLINE (zamiast nawigacji do starego edytora CreateRanking).
  // manualPlaces = miejsca dodane z wynikow Google (nie z zapisanych), zawsze doliczane do listy.
  const [listQuery, setListQuery] = useState("");
  const [manualPlaces, setManualPlaces] = useState<PlaceForList[]>([]);
  const [detailPlace, setDetailPlace] = useState<any | null>(null);   // wizytowka miejsca (PlaceSwiperDetail)
  // "Dodaj to miejsce" w wizytowce = toggle z wiersza, z ktorego ja otwarto (prosba Nat 2026-09-13).
  const [detailCtx, setDetailCtx] = useState<{ onToggle: () => void; added: boolean } | null>(null);
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);   // "Zapisz to miejsce" -> SavePlaceSheet
  const listSearchRef = useRef<HTMLInputElement>(null);
  const pickActive = open && step === "listPick";
  // Zasieg wyszukiwarki to KRAJE listy (2026-09-10). Wczesniej zawezal ja geokod miasta w
  // promieniu 30 km - przy liscie obejmujacej caly kraj wycinal wiekszosc trafien.
  const { results: listResults, searching: listSearching, blocked: listBlocked, searchMode: listSearchMode } =
    usePlaceSearch(listQuery, { countries: listCountries, enabled: pickActive });

  // Wyjazd
  const [tripCountries, setTripCountries] = useState<string[]>([]);
  // Daty wyjazdu z kreatora - krok opcjonalny (t("skip")). Zakres wielodniowy wlacza pozniej
  // podzial miejsc na dni w widoku wyjazdu (routes.end_date + pins.day_index).
  const [tripStart, setTripStart] = useState<Date | null>(null);
  const [tripDays, setTripDays] = useState(1);
  const [tripPeople, setTripPeople] = useState<PersonLite[]>([]);

  // Reset przy kazdym otwarciu.
  useEffect(() => {
    if (open) {
      setStep("entry"); setListCountries([]); setListCity(""); setListTitle(""); setTitleTouched(false); setListPeople([]); setSelected(new Set()); setListQuery(""); setManualPlaces([]); setDetailPlace(null); setTripStart(null); setTripDays(1);
      setTripCountries([]); setTripPeople([]); setCreating(false);
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
  const author = { name: profile?.username || profile?.first_name || t("user_fallback"), avatar: profile?.avatar_url ?? null };

  const { data: savedPlaces = [], isLoading: loadingSaved } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  const close = () => onClose();
  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePerson = (p: PersonLite) => setTripPeople((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);
  const tripPeopleIds = new Set(tripPeople.map((p) => p.id));
  const listPeopleIds = new Set(listPeople.map((p) => p.id));
  const toggleListPerson = (person: PersonLite) =>
    setListPeople((prev) => (prev.some((x) => x.id === person.id) ? prev.filter((x) => x.id !== person.id) : [...prev, person]));

  const keyOfPlace = (p: { place_name?: string | null }) => (p.place_name || "").trim().toLowerCase();
  // Klik wyniku Google -> dodaj do manualPlaces (dedup po nazwie) i wroc do listy (wyczysc fraze).
  // Wybor miejsca Z WYNIKOW WYSZUKIWANIA w kreatorze kolekcji. ⛔ NIE czysc tu `listQuery`.
  // Do 2026-09-16 bylo tu `setListQuery("")`, wiec po wybraniu jednego wyniku lista znikala
  // i kreator wracal do siatki zapisanych - zeby dodac drugie miejsce z tej samej frazy,
  // trzeba bylo wpisac ja od nowa. Zgloszenie testerki: "chcialabym kilka od razu wybrac,
  // a nie moge, bo po wybraniu jednej od razu mnie resetuje i wracam na poczatek".
  // Ponowne tapniecie ODZNACZA (wiersz i tak pokazywal ptaszka, ale klik nic nie robil).
  const pickResult = (r: PlaceForList) => {
    haptics.light();
    setManualPlaces((prev) => prev.some((m) => keyOfPlace(m) === keyOfPlace(r))
      ? prev.filter((m) => keyOfPlace(m) !== keyOfPlace(r))
      : [r, ...prev]);
  };
  const removeManual = (p: PlaceForList) => setManualPlaces((prev) => prev.filter((m) => keyOfPlace(m) !== keyOfPlace(p)));
  // Licznik na guziku kroku "miejsca": przy wybieraniu kilku naraz zaznaczone wiersze
  // wyjezdzaja poza ekran i bez liczby nie widac, ile ich juz jest. Zero = "Pomiń".
  const listPickCount = selected.size + manualPlaces.length;
  const listPickLabel = listPickCount > 0 ? `${t("common:buttons.next")} (${listPickCount})` : t("skip");

  // Wizytowka miejsca (PlaceSwiperDetail) - mapowanie zapisanego/googlowego miejsca na MockPlace.
  const openDetail = (p: any, ctx?: { onToggle: () => void; selected: boolean }) => { haptics.light(); setDetailCtx(ctx ? { onToggle: ctx.onToggle, added: ctx.selected } : null); setDetailPlace({
    id: p.place_id || p.id || p.place_name,
    place_name: p.place_name,
    category: (p.category || "other"),
    city: p.city || "",
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
    const q = encodeURIComponent([p.place_name, p.address, p.city ?? listCountries[0]].filter(Boolean).join(", "));
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
      <button onClick={() => openDetail(opts.place, { onToggle: opts.onToggle, selected: opts.selected })} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
        <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
          <img src={categoryIconSrc(opts.place.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-foreground truncate">{opts.place.place_name}</span>
          {opts.subtitle && <span className="block text-[13px] text-muted-foreground truncate">{opts.subtitle}</span>}
        </span>
      </button>
      <button onClick={() => openGooglePlace(opts.place)} aria-label={t("aria.open_in_maps", { place: opts.place.place_name })}
        className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
        <GoogleGlyph className="h-[18px] w-[18px]" />
      </button>
      <button onClick={opts.onToggle} aria-label={opts.selected ? t("aria.remove_from_list") : t("aria.add_to_list")}
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${opts.selected ? "bg-[#f0a583] text-white" : "border-2 border-border"}`}>
        {opts.selected ? <BrandCheck className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );

  // Nazwa proponowana z zasiegu: miasto ma pierwszenstwo przed krajem ("Kolekcja miejsc
  // w Krakowie" zamiast "... w Polsce"), bo jest konkretniejsza.
  const suggestedTitle = collectionName(listCity.trim() || null, listCountries, naming);
  const effectiveTitle = (titleTouched ? listTitle : suggestedTitle).trim() || suggestedTitle;

  const createList = async () => {
    if (!user) { close(); navigate("/auth"); return; }
    // Miejsca listy = zaznaczone zapisane + dodane z Google (manual), dedup po nazwie.
    const savedSel = savedPlaces.filter((p) => selected.has(p.id)).map(toPlaceForList);
    const seen = new Set<string>();
    const places = [...manualPlaces, ...savedSel].filter((p) => { const k = keyOfPlace(p); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    // Pusta lista jest OK (opcja t("skip")) - miejsca mozna dodac pozniej na widoku listy.
    if (!checkPlaceLimit("collection_places", 0, places.length)) { haptics.error(); return; }
    setCreating(true);
    haptics.light();
    const id = await createListFromSavedPlaces(user.id, {
      title: effectiveTitle,
      city: listCity.trim() || null, countries: listCountries, isPublic: true, places, author,
    });
    setCreating(false);
    if (!id) { haptics.error(); toast.error(t("toast.list_failed")); return; }
    // Zaproszenia iDA DOPIERO TERAZ, bo dopiero teraz istnieje kolekcja. Blad zaproszen nie
    // moze wywrocic utworzenia - kolekcja juz jest, wiec najwyzej doprosi sie z jej widoku.
    if (listPeople.length) {
      try { await inviteUsersToCollection(id, listPeople.map((p) => p.id), user.id); }
      catch (e: any) { console.warn("[CreateFlowSheet] zaproszenia do kolekcji:", e?.message ?? e); }
    }
    haptics.success();
    toast.success(t("toast.list_created"));
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed", user.id] });
    queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user.id] });
    close();
    navigate(`/lista/${id}`);
    // Pierwsza kolekcja = moment, w ktorym powiadomienia zaczynaja miec sens (reakcje innych):
    // miekkie pytanie o zgode na push, gdy widok kolekcji juz stoi (lib/permissionPrompts).
    askPermissionSoon("push", "list_created");
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

  // Kreator tworzy PUSTY szkic planu i wpuszcza od razu do widoku planu - tam dodaje sie
  // miejsca. Kreator ustala wylacznie meta: nazwe, kraj, daty, osoby.
  // ⛔ Nie ma juz trybu "przeszly / przyszly" (decyzja Nat 2026-09-20: "usunac przeszle wyjazdy
  // i zostawic tylko plany jako ogolny mechanizm"). Kazdy nowy plan startuje w etapie
  // `planning`; daty z przeszlosci sa dozwolone, bo plan moze dokumentowac tez to, co juz bylo.
  const proceedTrip = async (startArg: Date | null = tripStart, daysArg: number = tripDays) => {
    if (!user) { close(); navigate("/auth"); return; }
    setCreating(true);
    haptics.light();
    const title = tripName(null, tripCountries, naming);
    const id = await createEmptyWyjazd(user.id, null, title,
      { ...tripDatesForSave(startArg, daysArg), countries: tripCountries,
        // Bez daty liczba dni musi gdzies zamieszkac - inaczej wybor z krokomierza przepada.
        dayCount: startArg ? 1 : daysArg,
        tripType: "planning" });
    if (!id) { setCreating(false); haptics.error(); toast.error(t("toast.trip_failed")); return; }
    if (tripPeople.length) {
      // ⚠️ `inviteUsersToRoute` NIE RZUCA przy porazce - oddaje `{ ok: false }`. Sam `try/catch`
      // przepuszczal wiec kazda nieudana wysylke po cichu: wyjazd powstawal, zaproszenia nie
      // szly, a user dostawal haptyke sukcesu i zamkniety arkusz (zgloszenie testerki
      // 2026-09-16: "na poziomie tworzenia wyjazdu wtedy sie nie dodalo", bez zadnego bledu).
      // Wyjazd zostaje utworzony tak czy siak - komunikat dotyczy wylacznie zaproszen.
      try {
        const res = await inviteUsersToRoute({ id, city: null, title, group_session_id: null }, tripPeople.map((p) => p.id), user.id);
        if (!res.ok) { console.warn("[CreateFlowSheet] invite failed:", res.error); toast.error(t("social:invite.failed")); }
      } catch (e: any) {
        console.warn("[CreateFlowSheet] invite threw:", e?.message ?? e);
        toast.error(t("social:invite.failed"));
      }
    }
    setCreating(false);
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
    close();
    // Wejscie do WIDOKU WYJAZDU (SharedRoute) - swiezy szkic, miejsca dodaje sie guzikiem "+".
    navigate(`/route/${id}`);
    // Jak przy kolekcji: pierwszy wyjazd -> miekkie pytanie o push (odpowiedzi znajomych,
    // reakcje po publikacji). Przy zaproszeniach kontekst "invite_sent" niesie trafniejsze copy.
    askPermissionSoon("push", tripPeople.length ? "invite_sent" : "trip_created", 2200);
  };

  // ── wspolny nagłowek Anuluj / tytul / Dalej ──
  // Domyslki etykiet licza sie w ciele, nie w liscie parametrow - tam hook `t` jeszcze nie istnieje.
  const Header = ({ title, onBack, onNext, nextLabel, nextEnabled = true, backLabel }: {
    title: string; onBack: () => void; onNext?: () => void; nextLabel?: string; nextEnabled?: boolean; backLabel?: string;
  }) => (
    <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
      <button onClick={onBack} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 transition-opacity shrink-0">{backLabel ?? t("common:buttons.cancel")}</button>
      <h2 className="text-[20px] font-semibold text-foreground truncate">{title}</h2>
      {onNext ? (
        <button onClick={onNext} disabled={!nextEnabled}
          className={`text-sm font-medium rounded-full border bg-white px-3.5 py-1.5 shrink-0 transition-opacity ${nextEnabled ? "text-[#181818] border-black/15 active:opacity-60" : "text-[#bcbcbc] border-black/[0.07]"}`}>
          {nextLabel ?? t("common:buttons.next")}
        </button>
      ) : <span className="w-[68px] shrink-0" />}
    </div>
  );

  // ── wiersz t("invite.cta") ──
  const PeopleRow = ({ kind, disabled, people, onClick }: { kind: "listy" | "wyjazdu"; disabled?: boolean; people?: PersonLite[]; onClick?: () => void }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`w-full flex items-center gap-4 px-5 py-3 text-left ${disabled ? "opacity-45" : "active:bg-muted/50"} transition-colors`}>
      <Users className="h-6 w-6 text-foreground shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-foreground">{kind === "listy" ? t("invite.to_list") : t("invite.to_trip")}</p>
        <p className="text-[13px] text-muted-foreground">{kind === "listy" ? t("invite.list_desc") : t("invite.trip_desc")}</p>
      </div>
      {disabled ? (
        <span className="shrink-0 text-[11px] font-bold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{t("soon")}</span>
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
            <h2 className="text-[20px] font-semibold text-foreground text-center">{t("title")}</h2>
            <div className="mt-4 flex gap-4">
              {[
                { key: "list", label: t("kind.list"), icon: <FileText className="h-8 w-8 text-foreground" strokeWidth={1.7} />, go: () => { track("list_create_opened"); setStep("listCountry"); } },
                { key: "trip", label: t("kind.trip"), icon: <img src="/spontaway-symbol.png" alt="" className="h-9 w-9 object-contain" style={{ filter: "brightness(0)" }} draggable={false} />, go: () => { track("trip_create_opened"); setStep("tripCountry"); } },
              ].map((t) => (
                <button key={t.key} onClick={() => { haptics.light(); t.go(); }} className="flex-1 flex flex-col items-center gap-3 active:scale-[0.98] transition-transform outline-none focus:outline-none focus-visible:outline-none">
                  <span className="w-full h-[90px] rounded-2xl bg-[#efefef] flex items-center justify-center">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTA: wybor KRAJOW (zasieg wyszukiwarki + domyslna nazwa listy) ── */}
        {step === "listCountry" && (
          <div className="flex-1 min-h-0 flex flex-col pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title={t("country.title_list")} onBack={() => setStep("entry")}
              onNext={() => setStep("listCity")}
              nextLabel={listCountries.length ? t("common:buttons.next") : t("skip")} />
            <p className="px-5 -mt-1 pb-2 text-[13px] text-muted-foreground leading-relaxed">{t("country.hint_list")}</p>
            <CountryPicker selected={listCountries} onChange={setListCountries} />
          </div>
        )}

        {/* ── LISTA: MIASTO (opcjonalne) - chipy miast pierwszego kraju albo wpisane ręcznie.
            Ten sam uklad, co w ListScopeSheet (zmiana zasiegu juz istniejacej kolekcji),
            zeby tworzenie i edycja pytaly o to samo w ten sam sposob. ── */}
        {step === "listCity" && (
          <div className="flex-1 min-h-0 flex flex-col pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title={t("city.title_list")} onBack={() => setStep("listCountry")}
              onNext={() => setStep("listName")}
              nextLabel={listCity.trim() ? t("common:buttons.next") : t("skip")} />
            <p className="px-5 -mt-1 pb-3 text-[13px] text-muted-foreground leading-relaxed">{t("city.hint_list")}</p>
            <div className="flex-1 min-h-0 overflow-y-auto px-5">
              {(() => {
                const opts = listCountries.length ? citiesForCountry(listCountries[0]) : [];
                const listed = opts.includes(listCity.trim());
                return (
                  <>
                    {opts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {opts.map((c) => {
                          const on = listCity.trim() === c;
                          return (
                            <button key={c} type="button"
                              onClick={() => { haptics.selection(); setListCity(on ? "" : c); }}
                              className={`rounded-full px-3.5 py-2 text-sm font-semibold border transition-colors active:scale-[0.97] ${on ? "bg-[#FDF184] border-[#FDF184] text-[#5B2C06]" : "bg-white text-foreground border-border"}`}>
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <input
                      value={listed ? "" : listCity}
                      onChange={(e) => setListCity(e.target.value.slice(0, 60))}
                      autoCapitalize="words"
                      autoCorrect="off"
                      placeholder={listed ? listCity : t("city.placeholder")}
                      className="mt-3 w-full h-11 rounded-xl bg-secondary/60 border border-border/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── LISTA: NAZWA. Pole startuje z propozycja z kraju i miasta; user moze ja
            nadpisac albo zostawic. Pusta = wraca propozycja (nie tworzymy kolekcji bez nazwy). ── */}
        {step === "listName" && (
          <div className="flex-1 min-h-0 flex flex-col pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title={t("name.title_list")} onBack={() => setStep("listCity")}
              onNext={() => setStep("listPick")} nextLabel={t("common:buttons.next")} />
            <p className="px-5 -mt-1 pb-3 text-[13px] text-muted-foreground leading-relaxed">{t("name.hint_list")}</p>
            <div className="px-5">
              <input
                value={titleTouched ? listTitle : suggestedTitle}
                onChange={(e) => { setTitleTouched(true); setListTitle(e.target.value.slice(0, 80)); }}
                autoCapitalize="sentences"
                maxLength={80}
                placeholder={suggestedTitle}
                className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 px-4 text-[16px] font-semibold text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <p className="mt-2 text-right text-[12px] text-muted-foreground tabular-nums">{(titleTouched ? listTitle : suggestedTitle).length}/80</p>
            </div>
          </div>
        )}

        {/* ── LISTA: wyszukiwarka Google (inline) + wybor zapisanych ── */}
        {step === "listPick" && (
          <>
            <Header title={effectiveTitle} onBack={() => setStep("listName")}
              onNext={createList} nextLabel={creating ? "..." : listPickLabel} nextEnabled={!creating} />
            {/* Wyszukiwarka Google Places INLINE - klik = wyniki tutaj (a NIE nawigacja do starego edytora). */}
            <div className="px-5 pt-1 pb-2 shrink-0">
              <div className="relative">
                <BrandSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input ref={listSearchRef} value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder={t("search_place")}
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
                  {listBlocked && <p className="py-6 text-center text-sm text-muted-foreground">{t("search_unavailable")}</p>}
                  {!listSearching && !listBlocked && listResults.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t("no_results")}</p>
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
                    rowKey: `m-${keyOfPlace(p)}-${i}`, place: p, subtitle: p.address ?? listCountries[0] ?? null,
                    onToggle: () => removeManual(p), selected: true,
                  }))}
                  {savedPlaces.length > 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground pt-1 px-0.5">{t("your_saved_places")}</p>
                  )}
                  {savedPlaces.map((p) => renderListRow({
                    rowKey: p.id, place: p, subtitle: p.city,
                    onToggle: () => toggleSel(p.id), selected: selected.has(p.id),
                  }))}
                </div>
              )}
              {!listSearchMode && !loadingSaved && savedPlaces.length === 0 && manualPlaces.length === 0 && (
                <p className="mt-4 px-2 text-center text-sm text-muted-foreground">{t("no_saved_places")}</p>
              )}
              {/* Zapraszanie NA DOLE ostatniego kroku - dokladnie tak, jak przy wyjezdzie
                  (prosba Nat 2026-09-15). Wlasny odstep od dolu, bo wiersz jest OSTATNIM
                  elementem i inaczej lezy tuz przy krawedzi arkusza. */}
              <div className="mt-2 border-t border-border/50 pb-[max(28px,calc(env(safe-area-inset-bottom,0px)+20px))]">
                <PeopleRow kind="listy" people={listPeople} onClick={() => setStep("listPeople")} />
              </div>
            </div>
          </>
        )}

        {/* ── LISTA: wybor osob (blizniaczy ekran do tripPeople) ── */}
        {step === "listPeople" && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
              <button onClick={() => setStep("listPick")} className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full active:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></button>
              <h2 className="text-[20px] font-semibold text-foreground">{t("invite.cta")}</h2>
              <button onClick={() => setStep("listPick")} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">{t("common:buttons.done")}</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              {user && <AddPeoplePicker userId={user.id} selected={listPeopleIds} onToggle={toggleListPerson} />}
            </div>
          </>
        )}

        {/* ── WYJAZD: wybor KRAJOW (zasieg wyjazdu i wyszukiwarki miejsc) ── */}
        {step === "tripCountry" && (
          <div className="flex-1 min-h-0 flex flex-col pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title={t("country.title")} onBack={() => setStep("entry")} backLabel={t("common:buttons.back")}
              onNext={() => setStep("tripDates")}
              nextLabel={tripCountries.length ? t("common:buttons.next") : t("skip")} />
            <p className="px-5 -mt-1 pb-2 text-[13px] text-muted-foreground leading-relaxed">{t("country.hint")}</p>
            <CountryPicker selected={tripCountries} onChange={setTripCountries} />
          </div>
        )}

        {/* ── WYJAZD: DATY (krok opcjonalny) ── */}
        {step === "tripDates" && (
          <>
                        {/* Guzik w naglowku dziala na ZAZNACZENIU z kalendarza (onRangeChange), wiec user
                moze najpierw wybrac daty, a dopiero potem kliknac t("create"). Bez dat = wyjazd
                bez dat (mozna je dodac pozniej w widoku wyjazdu). */}
            <Header
              title={t("pick_date")}
              onBack={() => setStep("tripCountry")}
              backLabel={t("common:buttons.back")}
              onNext={() => afterDates()}
              nextLabel={creating ? "..." : t("create")}
              nextEnabled={!creating}
            />
            <div className="flex-1 min-h-0 overflow-y-auto pb-[max(32px,calc(env(safe-area-inset-bottom,0px)+24px))]">
              {/* -4px: Header ma pb-3 (12px), a odstep naglowek -> hint ma byc 8px. */}
              <p className="px-5 -mt-1 text-[13px] text-muted-foreground leading-relaxed">
                {t("pick_date_desc")}
              </p>
              <FullCalendarPicker
                maxDays={MAX_TRIP_DAYS}
                allowPast
                onRangeChange={(d, numDays) => { setTripStart(d); setTripDays(Math.max(1, numDays)); }}
                onConfirm={(d, numDays) => { setTripStart(d); setTripDays(numDays); afterDates(d, numDays); }}
                onClear={tripStart ? () => { setTripStart(null); setTripDays(1); } : undefined}
              />
              {/* ILE DNI bez wybranego terminu (zgloszenie testerki 2026-09-16). Wiersz widac
                  TYLKO gdy nie ma daty - przy wybranym zakresie liczbe dni wyznacza kalendarz
                  i dwa sterowania obok siebie kazalyby zgadywac, ktore wygrywa.
                  ⚠️ Wiersz Z CHEVRONEM prowadzacy na wlasny krok, a NIE krokomierz wciety
                  w kalendarz. Pierwsza wersja miala krokomierz inline ("to jedna liczba, po co
                  osobny ekran") i Nat zglosila dwa razy, ze chodzilo jej o chevron - w tym
                  arkuszu kazde dodatkowe ustawienie ma taki sam wiersz ("Dodaj osoby"), wiec
                  wyjatek dla dni wygladal jak obcy element, a nie jak skrot. */}
              {!tripStart && (
                <button onClick={() => { haptics.light(); setStep("tripDaysStep"); }}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left active:bg-muted/50 transition-colors">
                  <BrandCalendar className="h-6 w-6 text-foreground shrink-0" strokeWidth={1.8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-foreground">{t("days_row_title")}</p>
                    <p className="text-[13px] text-muted-foreground">{t("days_row_desc")}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-2">
                    {tripDays > 1 && (
                      <span className="text-[13px] font-bold text-foreground tabular-nums">{t("days_row_value", { count: tripDays })}</span>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </span>
                </button>
              )}
              <div className="px-5 pt-2">
                <button
                  onClick={() => { setTripStart(null); afterDates(null, tripDays); }}
                  disabled={creating}
                  className="w-full py-3 text-sm font-medium text-muted-foreground active:text-foreground transition-colors disabled:opacity-50"
                >
                  {t("skip_dates")}
                </button>
              </div>
              {/* Zapraszanie zeszlo tu z usunietego kroku nazwy - to ostatni ekran przed
                  utworzeniem, wiec zaproszenia wychodza razem z gotowym wyjazdem.
                  Wlasny odstep od dolu: sam padding kontenera przewijania nie wystarczal,
                  bo wiersz jest OSTATNIM elementem i lezal tuz przy krawedzi arkusza
                  (zgloszenie Nat 2026-09-10). */}
              <div className="mt-1 border-t border-border/50 pb-[max(28px,calc(env(safe-area-inset-bottom,0px)+20px))]">
                <PeopleRow kind="wyjazdu" people={tripPeople} onClick={() => setStep("tripPeople")} />
              </div>
            </div>
          </>
        )}

        {/* ── WYJAZD: wybor osob ── */}
        {/* Krok "Ile dni?" - ten sam naglowek (wstecz + tytul + Gotowe), co krok osob. */}
        {step === "tripDaysStep" && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
              <button onClick={() => setStep("tripDates")} className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full active:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></button>
              <h2 className="text-[20px] font-semibold text-foreground">{t("days_row_title")}</h2>
              <button onClick={() => setStep("tripDates")} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">{t("common:buttons.done")}</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              <p className="text-[13px] text-muted-foreground leading-relaxed">{t("days_step_desc")}</p>
              <div className="mt-8 flex items-center justify-center gap-7">
                <button onClick={() => { haptics.light(); setTripDays((n) => Math.max(1, n - 1)); }} disabled={tripDays <= 1}
                  aria-label={t("days_row_less")}
                  className="h-14 w-14 rounded-full border border-border flex items-center justify-center text-3xl font-bold active:scale-90 transition-transform disabled:opacity-30">-</button>
                <span className="min-w-[3ch] text-center text-5xl font-black tabular-nums">{tripDays}</span>
                <button onClick={() => { haptics.light(); setTripDays((n) => Math.min(MAX_TRIP_DAYS, n + 1)); }} disabled={tripDays >= MAX_TRIP_DAYS}
                  aria-label={t("days_row_more")}
                  className="h-14 w-14 rounded-full border border-border flex items-center justify-center text-3xl font-bold active:scale-90 transition-transform disabled:opacity-30">+</button>
              </div>
              <p className="mt-3 text-center text-[13px] text-muted-foreground">{t("days_row_value", { count: tripDays })}</p>
            </div>
          </>
        )}

        {step === "tripPeople" && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
              <button onClick={() => setStep("tripDates")} className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full active:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></button>
              <h2 className="text-[20px] font-semibold text-foreground">{t("invite.cta")}</h2>
              <button onClick={() => setStep("tripDates")} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">{t("common:buttons.done")}</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              {user && <AddPeoplePicker userId={user.id} selected={tripPeopleIds} onToggle={togglePerson} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    {/* Wizytowka miejsca (klik w wiersz). Vaul-drawer nakłada się na arkusz tworzenia. */}
    <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) { setDetailPlace(null); setDetailCtx(null); } }} place={detailPlace} city={detailPlace?.city || listCountries[0] || ""}
      onAdd={detailCtx ? () => detailCtx.onToggle() : undefined}
      added={!!detailCtx?.added}
      onLike={user && detailPlace ? () => setSavePlace({
        place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
        city: detailPlace.city ?? null,
        latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
        photo_url: detailPlace.photo_url || null,
        place_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(detailPlace.id ?? "")) ? detailPlace.id : null,
      }) : undefined} />
    {/* "Zapisz to miejsce" z wizytowki (lista + wyjazd) -> auto-zapis do Ogolne + opcjonalnie do listy. */}
    <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={savePlace?.city ?? ""} />
    </>
  );
}
