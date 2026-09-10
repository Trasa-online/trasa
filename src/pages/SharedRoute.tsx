import { useState, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchRouteLike, toggleRouteLike, type LikeState } from "@/lib/likes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { sendClientPush, getCurrentUserName } from "@/lib/clientPush";
import { format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { MapPin, ArrowLeft, Sparkles, ChevronDown, Bookmark, Calendar as CalendarIcon, Image as ImageIcon, Maximize2, X, Building2, Pencil, Trash2, Heart, Share2, Plus, Map as MapIcon, Loader2, GripVertical, Check, Flag, Camera, ThumbsUp, MessageCircle, UserPlus } from "lucide-react";
import { MAIN_CATEGORIES, subcategoryPluralLabel } from "@/lib/categories";
import { PLACE_VERDICT_TAGS, verdictOf, localizeTag, verdictRank } from "@/lib/routeTags";
import { publishTrip } from "@/lib/publishTrip";
import { haptics } from "@/hooks/useHaptics";
import { track } from "@/lib/analytics";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { useScreenshot } from "@/hooks/useScreenshot";
import { Reorder, useDragControls, motion } from "framer-motion";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlacePhoto } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { scopeCountries, scopeLabel } from "@/lib/tripScope";
import { fetchRouteNotesWithAuthors, notesByPlace, placeNoteKey } from "@/lib/placeNotes";
import { detachPlacePhotos, restorePlacePhotos } from "@/lib/placePhotoSocial";
import StoredImage from "@/components/StoredImage";
import InviteFriendsSheet from "@/components/route/InviteFriendsSheet";
import { fetchPinPhotos, addPinPhoto, deletePinPhotoReturning, deletePinPhotosForPlace, restorePinPhotos, photosByPlace, pinPhotoKey, type PinPhoto } from "@/lib/pinPhotos";
import { fetchPlaceVotes, toggleVote, placeVoteKey } from "@/lib/placeVotes";
import { fetchUnreadChatCount } from "@/lib/chatReads";
import PlaceNotes from "@/components/route/PlaceNotes";
import PhotoViewer from "@/components/route/PhotoViewer";
import PlaceNoteEditor from "@/components/route/PlaceNoteEditor";
import { ShareCardTrip } from "@/components/share/ShareCard";
import ScreenSkeleton from "@/components/layout/ScreenSkeleton";
import ReportContentSheet from "@/components/moderation/ReportContentSheet";
import { fetchRouteCoversFor, setMyRouteCover, setMyRouteNote, fetchRouteMemberNotes } from "@/lib/routeMemberCover";
import { moderateImageUrl, MODERATION_REJECTED_MESSAGE } from "@/lib/imageModeration";
import { EmptyPlacesState } from "@/components/route/EmptyPlacesState";
import AddPlaceSheet from "@/components/route/AddPlaceSheet";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import TripFabStack, { type TripFab } from "@/components/route/TripFabStack";
import TripChatSheet from "@/components/route/TripChatSheet";
import { useShare } from "@/hooks/useShare";
import { useUnsavePlace } from "@/hooks/useUnsavePlace";
import { buildShareUrl } from "@/lib/shareUrl";
import { quickSavePlace, type PlaceForList } from "@/lib/placeLists";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import { fetchPhotoLikes, togglePhotoLike, type LikeState as PhotoLikeState } from "@/lib/placePhotoSocial";
import PhotoPagination from "@/components/route/PhotoPagination";
import RouteMap from "@/components/RouteMap";
import { mapWithLimit, sha256Hex } from "@/lib/imageCompression";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Kolejnosc grup kategorii na widoku wyjazdu = kolejnosc podkategorii w MAIN_CATEGORIES
// (Jedzenie -> Kultura -> ...). Nieznane kategorie ida na koniec. Prosba Nat 2026-08-27 (Figma).
const SUBCAT_ORDER: string[] = MAIN_CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.id));

import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { resolvePlaceDbId } from "@/lib/placeLists";
import { fetchEnrichedPlace } from "@/components/plan-wizard/PlaceSwiper";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { resolveStored } from "@/components/PlacePhoto";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { CategoryIcon } from "@/components/CategoryIcon";
import PreReleaseBanner from "@/components/share/PreReleaseBanner";
import TrasaBigCard from "@/components/home/TrasaBigCard";
import { renderForUpload, uploadPair, uploadWithThumb } from "@/lib/imageThumbs";
import { TOP_LIMIT } from "@/lib/topPlaces";
import { isWeb } from "@/lib/platform";
import { thumbUrl } from "@/lib/imageUrl";
import { rowOwnPhotos, mergeRowPhotosIntoDetail } from "@/lib/placeUserPhotos";
import { deferDelete } from "@/lib/deferDelete";

// Oficjalne logo Google (4-kolorowe "G") - guzik "Zobacz w Google".
const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Wiersz miejsca z uchwytem przeciagania (framer-motion Reorder) - tryb edycji wspoldzielonej
// trasy (wlasciciel + uczestnik). Wzor 1:1 z SortablePlanRow w ReviewSummary.
// Znaczniki dni w trybie zmiany kolejnosci. Trzymamy je w cache POZA komponentem, bo Reorder.Group
// rozpoznaje elementy PO REFERENCJI: marker tworzony na nowo przy kazdym renderze nie dawal sie
// dopasowac do listy wartosci i miejsca nie przechodzily pod naglowek innego dnia (zgloszenie Nat
// 2026-09-09). Cache, a nie useMemo - to miejsce jest juz za wczesnymi returnami komponentu.
const DAY_MARKERS = new Map<number, { id: string; __day: number }>();
const dayMarkerFor = (d: number) => {
  let m = DAY_MARKERS.get(d);
  if (!m) { m = { id: `__day_${d}`, __day: d }; DAY_MARKERS.set(d, m); }
  return m;
};

// Wiersz w TRYBIE ZMIANY KOLEJNOSCI: sam uchwyt + miniaturka + nazwa. Bez notek, zdjec i akcji -
// krotki wiersz mniej skacze pod palcem i widac kilka miejsc naraz (prosba Nat 2026-08-30).
function CompactSortableRow({ value, rowPin, index, categoryLabel, dayBadge }: {
  value: any; rowPin: any; index: number; categoryLabel: ReactNode;
  /** Wyjazd wielodniowy: pigulka z dniem, tapniecie przenosi miejsce do nastepnego dnia. */
  dayBadge?: { label: string; onCycle: () => void };
}) {
  const { t } = useTranslation("sharing");
  const controls = useDragControls();
  return (
    // Haptyka na chwycenie i na puszczenie wiersza - bez niej przeciaganie nie ma zadnego
    // potwierdzenia w dloni i nie wiadomo, czy uchwyt "zlapal" (zgloszenie Nat 2026-09-09).
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} transition={{ duration: 0 }}
      onDragStart={() => haptics.selection()} onDragEnd={() => haptics.light()}>
      <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-b-0 bg-background">
        <span
          onPointerDown={(e) => controls.start(e)}
          aria-label={t("reorder_hint")}
          className="shrink-0 w-6 flex items-center justify-center text-muted-foreground/60 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <span className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-[#fcede3]">
          <PlacePhoto pin={rowPin} width={80} className="w-full h-full object-cover" />
          <span className="absolute top-0.5 left-0.5 h-4 min-w-4 px-1 rounded-full bg-black/55 text-white text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground truncate">{rowPin.place_name}</span>
          <span className="block text-[12px] text-muted-foreground truncate">{categoryLabel}</span>
        </span>
        {/* Przeniesienie do innego dnia BEZ przeciagania. Samo przeciaganie pod naglowek dnia
            zostaje, ale przy kilkunastu miejscach dzien docelowy jest daleko poza ekranem,
            a lista nie przewija sie w trakcie ciagniecia - w praktyce nie dalo sie tego zrobic
            (zgloszenie Nat 2026-09-09). Tapniecie przerzuca do kolejnego dnia. */}
        {dayBadge && (
          <button
            onClick={(e) => { e.stopPropagation(); dayBadge.onCycle(); }}
            className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground active:scale-95 transition-transform"
          >{dayBadge.label}</button>
        )}
      </div>
    </Reorder.Item>
  );
}

function SortableRouteRow({ value, rowPin, index, categoryLabel, onOpen, onGoogle, onDelete, onSave, saved, note, cornerAvatar }: {
  value: any; rowPin: any; index: number; categoryLabel: ReactNode;
  onOpen: () => void; onGoogle: () => void; onDelete: () => void;
  onSave?: () => void; saved?: boolean; note?: ReactNode; cornerAvatar?: string | null;
}) {
  const { t } = useTranslation("sharing");
  const controls = useDragControls();
  const grip = (
    <span
      onPointerDown={(e) => controls.start(e)}
      aria-label={t("reorder_hint")}
      // self-start + pt: uchwyt na wysokosci NAZWY miejsca (gora wiersza), nie wysrodkowany w calym
      // wysokim wierszu (notki/zdjecia) gdzie byl niewidoczny (prosba Nat).
      className="shrink-0 self-start pt-4 w-6 flex items-center justify-center text-muted-foreground/45 cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical className="h-5 w-5" />
    </span>
  );
  return (
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} transition={{ duration: 0 }}>
      <RoutePlaceRow pin={rowPin} index={index} categoryLabel={categoryLabel} onOpen={onOpen} onGoogle={onGoogle} onDelete={onDelete} onSave={onSave} saved={saved} dragHandle={grip} note={note} cornerAvatar={cornerAvatar} />
    </Reorder.Item>
  );
}

// Stabilna referencja pustej listy - patrz komentarz przy zapytaniu o piny nizej.
const EMPTY_PINS: any[] = [];

export default function SharedRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation("sharing");

  // Polubienie trasy (heart). Owner powiadamiany przez trigger notify_route_like.
  const { data: likeData } = useQuery({
    queryKey: ["route-like", id, user?.id],
    enabled: !!id,
    queryFn: () => fetchRouteLike(id!, user?.id),
  });
  const routeLike: LikeState = likeData ?? { liked: false, count: 0 };
  const toggleLike = async () => {
    if (!id) return;
    if (!user) { navigate("/auth"); return; }
    const key = ["route-like", id, user.id];
    const cur = (queryClient.getQueryData(key) as LikeState) ?? routeLike;
    queryClient.setQueryData(key, { liked: !cur.liked, count: Math.max(0, cur.count + (cur.liked ? -1 : 1)) });
    try { await toggleRouteLike(id, user.id, cur.liked); }
    finally { queryClient.invalidateQueries({ queryKey: key }); }
  };
  const categoryLabel = (cat: string) => t(`categories.${cat}`, { defaultValue: t("categories.other") });
  const { isSaved } = useSavedPlaces();
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const pinToSave = (pin: any): SavePlaceInput => ({
    place_name: pin.place_name, category: pin.category ?? null, address: pin.address ?? null,
    // Pin lezy w miescie SWOJEJ trasy - to jest wlasne miasto miejsca, nie przypadkowy kontekst.
    city: pin.city ?? (route as any)?.city ?? null,
    latitude: pin.latitude ?? null, longitude: pin.longitude ?? null,
    photo_url: pin.photo_url ?? null, place_id: pin.place_id ?? null,
  });
  const [planTab, setPlanTab] = useState<"miejsca" | "galeria" | "mapa">("miejsca");
  // Widok ODBIORCY linku na webie (Figma "[NEW] Ekrany" -> "Udostępnianie wyjazdów oraz list"
  // -> "Widok wyświetlania wyjazdu"). Zamiast pelnego ekranu wyjazdu - zapowiedz: okladka,
  // pierwsze przystanki i jedno wyjscie dalej. Osoba, ktora dostala link, zwykle nie ma jeszcze
  // aplikacji, wiec pelny ekran roboczy (zakladki, edycja, czat) jest dla niej szumem.
  // `?full=1` = pomin zapowiedz i pokaz od razu pelny wyjazd. Dla kogos, kto widzial juz
  // zapowiedz na stronie publicznej (api/share.ts) - druga taka sama byłaby dreptaniem
  // w miejscu.
  const [previewOpened, setPreviewOpened] = useState(
    () => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("full") === "1",
  );
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [datesSheetOpen, setDatesSheetOpen] = useState(false);   // wlasciciel: zakres dat wyjazdu
  const [planMapOpen, setPlanMapOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null); // fullscreen podglad zdjecia galerii
  // Podglad zdjec DODANYCH DO MIEJSCA (klik w miniaturke w wierszu) - osobny od galerii wyjazdu.
  const [pinPhotoViewer, setPinPhotoViewer] = useState<{ urls: string[]; idx: number } | null>(null);
  // Miejsce czekajace na potwierdzenie usuniecia (etap "w trakcie" / wspomnienie).
  const [confirmDeletePin, setConfirmDeletePin] = useState<any | null>(null);
  const galleryPhotosCount = useRef(0);
  // Zdjecia galerii wyjazdu dla handlerow zadeklarowanych PRZED ich wyliczeniem (publikacja).
  const galleryPhotosRef = useRef<string[]>([]);
  // Gest natywny: swipe w bok przelacza zakladki (kolejnosc = kolejnosc ikon nad trescia).
  // Etap czytamy leniwie z route: w propozycjach nie ma Galerii (tylko Miejsca | Mapa).
  const goTab = (dir: 1 | -1) => {
    const planning = (((route as any)?.trip_type as string) || "planning") === "planning";
    const tabs: Array<"miejsca" | "galeria" | "mapa"> = planning ? ["miejsca", "mapa"] : ["miejsca", "galeria", "mapa"];
    const next = tabs[tabs.indexOf(planTab) + dir];
    if (next) setPlanTab(next);
  };
  const swipeTabs = useSwipeNav({ onLeft: () => goTab(1), onRight: () => goTab(-1) });
  // Galeria fullscreen: swipe w bok = poprzednie/nastepne zdjecie (zamiast tylko strzalek).
  const swipeViewer = useSwipeNav({
    onLeft: () => setViewerIndex((i) => (i === null ? i : (i + 1) % Math.max(1, galleryPhotosCount.current))),
    onRight: () => setViewerIndex((i) => (i === null ? i : (i - 1 + galleryPhotosCount.current) % Math.max(1, galleryPhotosCount.current))),
  });
  // Usuniecie wyjazdu (wlasciciel) - nieodwracalne, walidacja "czy na pewno?".
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  // t("choose_places") (etap propozycji, host): zaznacz ktore miejsca zostaja -> reszta usunieta,
  // trip_type='ongoing' (przejscie na "w trakcie"). Domyslnie wszystkie zaznaczone.
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [choosingBusy, setChoosingBusy] = useState(false);
  // t("choose_places"): jesli ktorys uczestnik nie dodal jeszcze miejsc -> dialog (przypomnienie / mimo to).
  const [missingParticipants, setMissingParticipants] = useState<{ id: string; username: string | null; avatar_url: string | null }[] | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  // Etap W TRAKCIE: zdjecia per-miejsce (wszyscy uczestnicy). Wlasna notka -> PlaceNoteEditor
  // (sam trzyma draft + debounce), zapis przez saveMyNote.
  const [uploadingPin, setUploadingPin] = useState<string | null>(null);
  // Postep wgrywania zdjec galerii ("3 z 8"). Przy paczce z iPhone'a czekanie liczy sie
  // w dziesiatkach sekund i bez licznika wyglada jak zawieszenie (zgloszenie Nat 2026-09-09).
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  // User pisze notke -> chowamy czat i dolne CTA (zaslanialy pole i klawiature).
  const [noteEditing, setNoteEditing] = useState(false);
  // Etap W TRAKCIE = miejsce, w ktorym powstaje CALE wspomnienie: opis wyjazdu i tagi
  // miejsc. Stepper "podsumowania" zostal usuniety z flow (prosba Nat 2026-08-30) - publikacja to
  // jeden guzik "Opublikuj" na dole.
  const [pinTags, setPinTags] = useState<Record<string, string[]>>({});
  const [publishing, setPublishing] = useState(false);
  // Tryb "Zmień kolejność miejsc" - dopiero on pokazuje uchwyty drag&drop i skraca wiersze
  // do miniaturek (prosba Nat 2026-08-30).
  const [reorderMode, setReorderMode] = useState(false);
  // Wlasna okladka wyjazdu: JEDEN guzik w naglowku -> arkusz wyboru ze zdjec galerii (prosba Nat
  // 2026-09-01). Kazdy uczestnik ma swoja - u pozostalych nic sie nie zmienia.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  // Zmiana nazwy wyjazdu - stan trzymany PRZED wczesnymi returnami (regula hookow; ten plik
  // juz raz wywrocil sie na hooku postawionym nizej, React #310).
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [savingName, setSavingName] = useState(false);
  // Wybieranie MIEJSC z cudzego wyjazdu (2026-09-10). Zastapilo zapisywanie calej cudzej
  // trasy: ludzie i tak nie chcieli cudzego planu w calosci, tylko dwoch-trzech miejsc z niego.
  const [pickMode, setPickMode] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [pickTargetOpen, setPickTargetOpen] = useState(false);   // arkusz "do ktorego wyjazdu"
  const [pickBusy, setPickBusy] = useState(false);
  // Wlasne wyjazdy ROBOCZE - cel dla "Dodaj do wyjazdu". Opublikowane wspomnienie to zamknieta
  // historia, wiec doklejanie do niego cudzych miejsc nie ma sensu.
  const { data: myDraftTrips = [] } = useQuery({
    queryKey: ["pick-target-drafts", user?.id],
    enabled: !!user?.id && pickTargetOpen,
    queryFn: async () => {
      const { data } = await (supabase as any).from("routes")
        .select("id, title, city, countries, start_date, trip_type")
        .eq("user_id", user!.id).neq("status", "published")
        .order("created_at", { ascending: false }).limit(30);
      return ((data ?? []) as any[]).filter((r) => r.id !== id);
    },
  });
  // Zrzut ekranu = intencja "chce to pokazac". Zamiast szukac guzika, user dostaje gotowy
  // kadr od razu po zrzucie (logika jak na Pintereście). iOS nie pozwala podmienic juz
  // zrobionego zdjecia, wiec karta pojawia sie PO nim i user robi drugi zrzut - z karta.
  useScreenshot(() => setShareCardOpen(true), !shareCardOpen);
  // Wyjazd wielodniowy: ktory dzien jest na ekranie. null = "Wszystkie" (cala lista z naglowkami
  // dni - tak jak przed 2026-09-01). Domyslnie pokazujemy JEDEN dzien, zeby ekran nie byl
  // niekonczacym sie scrollem (wariant A z Figmy, sekcja "Wyjazd wielodniowy").
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Czy uzytkownik sam wybral dzien - blokuje pozniejsze auto-ustawienie dnia domyslnego.
  const [dayTouched, setDayTouched] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set()); // zwiniete grupy kategorii
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const share = useShare();
  const unsave = useUnsavePlace();
  // Tap bookmarka: zapisane -> odzapisz (toast+cofnij); niezapisane -> otworz drawer zapisu.
  // "Topka" wyjazdu (2026-09-08): autor wyroznia miejsca warte polecenia. Limit rosnie
  // z dlugoscia trasy - trzy gwiazdki przy trzech miejscach nie wyrozniaja niczego.
  const toggleTopPin = async (pin: any) => {
    const list = pins as any[];
    const next = !pin.is_top;
    haptics.light();
    // Limit 1: zaznaczenie innego miejsca PRZENOSI wyroznienie zamiast odmawiac. Przy jednej
    // gwiazdce kazdy kolejny wybor to zmiana zdania, a nie blad (decyzja Nat 2026-09-08).
    const toClear = next ? list.filter((p) => p.is_top && p.id !== pin.id).slice(0, TOP_LIMIT + 4) : [];
    queryClient.setQueryData(["shared-route-pins", id], (old: any[] | undefined) =>
      (old ?? []).map((p) => (p.id === pin.id ? { ...p, is_top: next } : toClear.some((c) => c.id === p.id) ? { ...p, is_top: false } : p)));
    const ops: Promise<any>[] = [(supabase as any).from("pins").update({ is_top: next }).eq("id", pin.id)];
    if (toClear.length) ops.push((supabase as any).from("pins").update({ is_top: false }).in("id", toClear.map((p) => p.id)));
    const res = await Promise.all(ops);
    if (res.some((r: any) => r?.error)) {
      console.error("[SharedRoute] top toggle:", res.map((r: any) => r?.error?.message).filter(Boolean).join(" | "));
      queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    }
  };

  const toggleSaveBookmark = (pin: any) => { if (isSaved(pin.place_name)) void unsave(pinToSave(pin)); else setSavePlace(pinToSave(pin)); };

  // Otworz miejsce w Google Maps (WIZYTOWKA / place page, NIE nawigacja). query_place_id gdy
  // pin.place_id to Google Place ID (nie nasze DB uuid) - trafiamy w dokladne miejsce.
  const openGooglePlace = (pin: any) => {
    if (!pin) return;
    const q = encodeURIComponent([pin.place_name, pin.address, route?.city].filter(Boolean).join(", "));
    const pid = typeof pin.place_id === "string" && pin.place_id.trim() ? pin.place_id.trim() : "";
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
    const placeIdParam = pid && !isDbUuid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["shared-route", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        // trip_type/status = etap cyklu zycia (planning=Propozycje, ongoing=W Trakcie). Bez filtra
        // is_shared - RLS i tak wpuszcza tylko wlasciciela (wlasne robocze) lub is_shared/published.
        // Dzieki temu SharedRoute jest WIDOKIEM WYJAZDU dla wszystkich etapow (Nat 2026-08-25).
        .select("id, title, city, countries, user_id, day_number, folder_id, start_date, end_date, ai_summary, ai_highlight, review_photos, review_narrative, group_session_id, tags, list_cover_url, trip_type, status")
        .eq("id", id as string)
        .single();
      if (error) return null;
      return data as any;
    },
    enabled: !!id,
  });

  // Autor trasy - do logiki "lokals poleca!" (home_city autora == miasto trasy).
  const { data: author } = useQuery({
    queryKey: ["shared-route-author", route?.user_id],
    enabled: !!route?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("username, first_name, avatar_url, home_city")
        .eq("id", route!.user_id)
        .maybeSingle();
      return data as any;
    },
  });

  // Uczestnicy trasy grupowej (awatary obok hosta) - bez hosta.
  const { data: groupParticipants = [] } = useQuery({
    queryKey: ["shared-route-participants", (route as any)?.group_session_id, route?.user_id],
    enabled: !!(route as any)?.group_session_id,
    queryFn: async () => {
      const { data: members } = await (supabase as any)
        .from("group_session_members").select("user_id").eq("session_id", (route as any).group_session_id).eq("status", "accepted");
      const ids = (members ?? []).map((m: any) => m.user_id).filter((id: string) => id !== route!.user_id);
      if (!ids.length) return [] as { id: string; username: string | null; avatar_url: string | null }[];
      const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", ids);
      // Zachowaj kolejnosc czlonkow sesji (pierwsi uczestnicy = pelna nazwa w TopBarze).
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return ids.map((id: string) => byId.get(id)).filter(Boolean)
        .map((p: any) => ({ id: p.id, username: p.username ?? null, avatar_url: p.avatar_url ?? null }));
    },
  });

  // Czy zalogowany user jest UCZESTNIKIEM wspolnego wyjazdu (czlonek sesji, nie host).
  // Uczestnik moze dodawac zdjecia do galerii i NIE widzi CTA "Zapisz/Zaplanuj" (trasa juz jego).
  const { data: isGroupMember = false } = useQuery({
    queryKey: ["shared-route-membership", (route as any)?.group_session_id, user?.id],
    enabled: !!(route as any)?.group_session_id && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_members").select("user_id")
        .eq("session_id", (route as any).group_session_id).eq("user_id", user!.id).eq("status", "accepted").maybeSingle();
      return !!data;
    },
  });

  // Pelen sklad wyjazdu WIDZIANY PRZEZ HOSTA - razem z osobami, ktore jeszcze nie
  // potwierdzily. Osobne zapytanie od groupParticipants (tamto celowo pokazuje tylko
  // potwierdzonych, bo to publiczna lista uczestnikow wyjazdu).
  const { data: sessionMembers = [] } = useQuery({
    queryKey: ["shared-route-members-admin", (route as any)?.group_session_id],
    enabled: !!(route as any)?.group_session_id && !!user?.id && (route as any)?.user_id === user?.id,
    queryFn: async () => {
      const { data: rows } = await (supabase as any)
        .from("group_session_members").select("user_id, status")
        .eq("session_id", (route as any).group_session_id);
      const others = ((rows ?? []) as any[]).filter((m) => m.user_id !== (route as any).user_id);
      if (!others.length) return [] as { id: string; username: string | null; avatar_url: string | null; status: string }[];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, username, avatar_url").in("id", others.map((m) => m.user_id));
      const byId = new Map(((profs ?? []) as any[]).map((p) => [p.id, p]));
      return others.map((m) => ({
        id: m.user_id,
        username: byId.get(m.user_id)?.username ?? null,
        avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
        status: m.status ?? "accepted",
      }));
    },
  });

  // Czekajace zaproszenie (2026-09-08): host dodal mnie do wyjazdu, ale jeszcze tego nie
  // potwierdzilem. Do czasu zgody wyjazd NIE pojawia sie w moich Wyjazdach - tutaj dostaje
  // pasek z decyzja, bo to jedyny ekran, na ktorym widac, na co sie zgadzam.
  const { data: pendingInvite = false } = useQuery({
    queryKey: ["shared-route-invite", (route as any)?.group_session_id, user?.id],
    enabled: !!(route as any)?.group_session_id && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_members").select("user_id")
        .eq("session_id", (route as any).group_session_id).eq("user_id", user!.id)
        .eq("status", "pending").maybeSingle();
      return !!data;
    },
  });

  const respondToInvite = async (accept: boolean) => {
    const sid = (route as any)?.group_session_id;
    if (!sid || !user) return;
    haptics.light();
    const { error } = await (supabase as any).rpc("respond_to_route_invite", { p_session_id: sid, p_accept: accept });
    if (error) { notify.error(t("invite.response_failed")); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route-invite", sid, user.id] });
    queryClient.invalidateQueries({ queryKey: ["shared-route-membership", sid, user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    if (accept) {
      notify.success(t("invite.accepted"));
    } else {
      notify.success(t("invite.declined"));
      goBackOr(navigate, "/eksploruj");
    }
  };

  // Host usuwa uczestnika - pomylka przy zapraszaniu (klikniecie w zla osobe z listy) musi
  // byc odwracalna. Polityka DELETE "Session creator can remove members" juz to dopuszcza.
  const removeParticipant = async (participantId: string) => {
    const sid = (route as any)?.group_session_id;
    if (!sid) return;
    haptics.light();
    // ODROCZONY commit zamiast natychmiastowego delete'a. Host nie ma polityki INSERT na
    // group_session_members (jest tylko "Host can add self"), wiec przywrocenie wiersza po
    // fakcie musialoby isc przez add_member_to_session - a to wpisaloby osobe od nowa, jako
    // zaproszona do potwierdzenia. Nie wykonujac delete'a przez 5 s zachowujemy stan DOKLADNIE
    // taki, jaki byl, razem ze statusem (zgloszenie Nat 2026-09-09).
    queryClient.setQueryData(["shared-route-participants", sid], (prev: any) =>
      Array.isArray(prev) ? prev.filter((m: any) => m.id !== participantId) : prev);
    deferDelete({
      message: t("invite.removed"),
      commit: async () => {
        const { error } = await (supabase as any)
          .from("group_session_members").delete().eq("session_id", sid).eq("user_id", participantId);
        if (error) notify.error(t("invite.remove_failed"));
        queryClient.invalidateQueries({ queryKey: ["shared-route-participants", sid] });
      },
      onUndo: () => queryClient.invalidateQueries({ queryKey: ["shared-route-participants", sid] }),
    });
  };

  // Podpis autora + oznaczeni czlonkowie (#11). Best-effort (kolumny z migracji
  // 20260705) - gdy jeszcze nie zaaplikowana, po prostu brak wartosci.
  const { data: shareMeta } = useQuery({
    queryKey: ["shared-route-meta", id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("routes").select("share_caption, tagged_members, share_anonymous").eq("id", id as string).maybeSingle();
        if (error) return null;
        return data as { share_caption: string | null; tagged_members: string[] | null; share_anonymous: boolean | null } | null;
      } catch {
        return null;
      }
    },
  });

  // Inkrementacja licznika wyswietlen (nagroda dla autora). Dedup per-urzadzenie
  // (localStorage), zeby refresh/powroty nie zawyzaly "X osob obejrzalo".
  useEffect(() => {
    if (!route?.id) return;
    try {
      const key = "trasa_viewed_routes";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(route.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, route.id].slice(-200)));
    } catch { /* brak localStorage - i tak inkrementuj raz na mount */ }
    void (supabase as any).rpc("increment_route_views", { route_id: route.id });
  }, [route?.id]);

  // NIE `= []` w destrukturyzacji: przy KAZDYM renderze bylby to nowy pusty tablicowy
  // literal, wiec efekt ponizej z deps [pins] odpalal sie w kolko i przez setPinTags
  // wymuszal kolejny render. Petla krecila sie przez cale ladowanie pinow (React ucinal ja
  // ostrzezeniem "Maximum update depth exceeded"; zmierzone 168 obrotow na jednym wejsciu
  // w wyjazd). Stala referencja zamyka temat.
  const { data: pins = EMPTY_PINS } = useQuery({
    queryKey: ["shared-route-pins", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, route_id, place_name, address, category, suggested_time, images, image_url, user_photo_urls, photo_url, place_id, latitude, longitude, pin_order, day_index, description, tags, added_by, is_top")
        .eq("route_id", id!)
        .order("pin_order");
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  // #okladki: zdjecia userow dodane do miejsc tej trasy (place_photos) - do okladek miejsc bez
  // wlasnego zdjecia. Klucze inline (male tablice); queryKey stabilny per zestaw pinow+miasto.
  const routePinKeys = Array.from(new Set((pins as any[]).flatMap((p) => pinCoverKeys(p, route?.city ?? null)))).filter(Boolean);
  const { data: placePhotoCoverMap } = useQuery({
    queryKey: ["shared-route-place-photos", routePinKeys.join("|")],
    enabled: routePinKeys.length > 0,
    queryFn: () => fetchPlacePhotosForKeys(routePinKeys),
  });

  // Notki WSZYSTKICH uczestnikow trasy (pin_ratings SELECT publiczny dla is_shared). Eksploracja
  // pokazuje notki calej grupy (awatar + imie + tresc), nie tylko autora (prosba Nat 2026-08-25).
  const { data: allNotes = [] } = useQuery({
    queryKey: ["shared-route-notes", id],
    queryFn: () => fetchRouteNotesWithAuthors(id ? [id] : []),
    enabled: !!id,
  });
  const notesMap = notesByPlace(allNotes);

  // Zdjecia per-miejsce z autorem (pin_photos) - etap "w trakcie".
  const { data: pinPhotoRows = [] } = useQuery({
    queryKey: ["shared-route-pin-photos", id],
    queryFn: () => fetchPinPhotos(id!),
    enabled: !!id,
  });
  const photosMap = photosByPlace(pinPhotoRows as PinPhoto[]);

  // Glosowanie na miejsca (etap propozycji) - liczba glosow + czy JA glosowalem.
  const { data: votesMap = new Map() } = useQuery({
    queryKey: ["shared-route-votes", id, user?.id],
    queryFn: () => fetchPlaceVotes(id!, user?.id ?? null),
    enabled: !!id,
  });
  const toggleVoteHandler = async (pin: any, voted: boolean) => {
    if (!user || !id) return;
    haptics.light();
    await toggleVote(id, pin.place_name, user.id, voted);
    queryClient.invalidateQueries({ queryKey: ["shared-route-votes", id] });
  };

  // Nieprzeczytane wiadomosci czatu - licznik na dymku. RLS (trip_messages/reads) = uczestnicy,
  // wiec dla obcych zwroci 0. Odswiezany realtime'em ponizej (nowa wiadomosc) + przy oznaczeniu read.
  const { data: unreadChat = 0 } = useQuery({
    queryKey: ["chat-unread", id, user?.id],
    enabled: !!id && !!user?.id,
    queryFn: () => fetchUnreadChatCount(id!, user!.id),
  });
  // Realtime: nowa wiadomosc w tym wyjezdzie -> odswiez licznik + (gdy czat otwarty) liste wiadomosci.
  useEffect(() => {
    if (!id || !user?.id) return;
    const ch = supabase.channel(`trip-msg-badge-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_messages", filter: `route_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-unread", id, user.id] });
        queryClient.invalidateQueries({ queryKey: ["trip-messages", id] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, user?.id, queryClient]);

  // Lajki zdjec galerii wyjazdu (prosba Nat 2026-08-30). photo_ref = URL zdjecia; liczniki
  // + "czy ja polubilem" leca jednym zapytaniem dla calej galerii. Liste URL-i bierzemy z refa,
  // bo galeria wyliczana jest ponizej early returnow.
  const { data: photoLikes } = useQuery({
    queryKey: ["route-photo-likes", id, user?.id, ((route as any)?.review_photos ?? []).length],
    enabled: !!route,
    queryFn: () => fetchPhotoLikes(galleryPhotosRef.current, user?.id ?? null),
    staleTime: 60_000,
  });
  const [likeOverrides, setLikeOverrides] = useState<Record<string, PhotoLikeState>>({});
  const likeStateOf = (url: string): PhotoLikeState =>
    likeOverrides[url] ?? photoLikes?.get(url) ?? { count: 0, liked: false };
  const togglePhotoLikeUi = async (url: string) => {
    if (!user?.id) { toast.error(t("toast.login_to_like")); return; }
    const cur = likeStateOf(url);
    const next: PhotoLikeState = { liked: !cur.liked, count: Math.max(0, cur.count + (cur.liked ? -1 : 1)) };
    setLikeOverrides((o) => ({ ...o, [url]: next }));
    haptics.light();
    const liked = await togglePhotoLike(url, user.id, cur.liked);
    if (liked !== next.liked) setLikeOverrides((o) => ({ ...o, [url]: cur }));
  };

  // Wlasna okladka wyjazdu (route_member_covers) - kazdy uczestnik widzi swoja, wybor jednej
  // osoby nie zmienia widoku pozostalych. Okladka hosta (list_cover_url) zostaje ta, ktora
  // reprezentuje wyjazd w EKSPLORACJI (prosba Nat 2026-08-31).
  const { data: myCoverMap } = useQuery({
    queryKey: ["route-member-cover", id, user?.id],
    enabled: !!id && !!user?.id,
    queryFn: () => fetchRouteCoversFor(user!.id, [id!]),
    staleTime: 60_000,
  });
  const myCover = id ? (myCoverMap?.get(id) ?? null) : null;
  // NOTKI UCZESTNIKOW O CALYM WYJEZDZIE (route_member_covers.note). Kazdy pisze swoja; wlasna
  // ladnie na gorze, cudze pod nia. Osobny byt od routes.description (opis hosta dla eksploracji).
  const { data: memberNotes = [] } = useQuery({
    queryKey: ["route-member-notes", id],
    enabled: !!id,
    queryFn: () => fetchRouteMemberNotes(id!),
  });
  const myTripNote = (memberNotes as any[]).find((n) => n.user_id === user?.id)?.note ?? "";
  const saveMyTripNote = async (value: string) => {
    if (!user || !id) return;
    await setMyRouteNote(id, user.id, value);
    queryClient.invalidateQueries({ queryKey: ["route-member-notes", id] });
  };


  // Tagi miejsc (pins.tags) - lokalny stan do optymistycznego przelaczania werdyktow.
  useEffect(() => {
    const map: Record<string, string[]> = {};
    for (const p of (pins as any[])) map[p.id] = Array.isArray(p.tags) ? p.tags : [];
    setPinTags(map);
  }, [pins]);

  // Opis CALEGO wyjazdu (routes.review_narrative) - pisze go wlasciciel i to on jedzie
  // z wyjazdem do eksploracji. Edytowany tym samym guzikiem, ktory stoi POD wyswietlonym
  // opisem, wiec guzik i tresc to jedno i to samo pole (zgloszenie Nat 2026-09-09: guzik mowil
  // "Dodaj opis", chociaz opis byl - bo siedzial na innym polu niz to widoczne wyzej).
  const saveTripDescription = async (value: string) => {
    if (!id) return;
    await (supabase as any).from("routes").update({ review_narrative: value.trim() || null }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
  };


  // Werdykt o miejscu (pins.tags) - jeden tap pod notkami.
  const togglePinTag = async (pinId: string, tagId: string) => {
    haptics.selection();
    const cur = pinTags[pinId] ?? [];
    // Odznaczanie po ID: usuwamy zarowno nowe id, jak i stara polska etykiete tego samego werdyktu
    // (inaczej tag zapisany poprzednim buildem zostawalby na miejscu mimo odklikniecia).
    const isSame = (t: string) => t === tagId || verdictOf(t)?.id === tagId;
    const next = cur.some(isSame) ? cur.filter((t) => !isSame(t)) : [...cur, tagId];
    setPinTags((prev) => ({ ...prev, [pinId]: next }));
    await (supabase as any).from("pins").update({ tags: next }).eq("id", pinId);
  };

  // PUBLIKACJA wyjazdu - jeden guzik zamiast steppera "podsumowania" (prosba Nat 2026-08-30).
  // status='published' + trip_type='completed' => wspomnienie w profilu i wpis w eksploracji.
  // Miniature eksploracji domykamy automatycznie (losowe zdjecie usera), bo bramka feedu jej
  // wymaga - user nie musi juz niczego wybierac. Toast z "Cofnij" (publikacja jest odwracalna
  // przez 6 s, potem juz nie - dlatego bez dodatkowego dialogu).
  const handlePublish = async () => {
    if (!id || publishing) return;
    if (!(pins as any[]).length) { toast.error(t("toast.need_place")); return; }
    // Okladka eksploracji jest teraz WARUNKIEM publikacji (prosba Nat 2026-08-30) - wczesniej
    // losowalismy ja po cichu, wiec wyjazd trafial do feedu z przypadkowym zdjeciem.
    if (!(route as any)?.list_cover_url) {
      haptics.warning();
      toast.error(t("toast.pick_cover"), {
        description: t("toast.pick_cover_desc"),
        action: { label: "Galeria", onClick: () => setPlanTab("galeria") },
      });
      return;
    }
    setPublishing(true);
    try {
      await publishTrip([id]);
      // Zdjecia dodane przy miejscach (pin_photos) staja sie czescia galerii MIEJSC dopiero teraz -
      // publikacja jest momentem, w ktorym tresc wyjazdu staje sie publiczna (RPC security definer,
      // bo przenosi tez zdjecia innych uczestnikow; zgloszenie Nat 2026-08-30).
      const { data: synced } = await (supabase as any).rpc("sync_route_place_photos", { p_route_id: id });
      if (typeof synced === "number" && synced > 0) console.info(`[SharedRoute] place photos synced: ${synced}`);
      const cover = (route as any)?.list_cover_url as string | null;
      track("trip_published", { route_id: id, city: route.city ?? null, place_count: (pins as any[]).length, has_cover: !!cover });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
      queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
      queryClient.invalidateQueries({ queryKey: ["trip-shortcut"] });
      toast.success(cover ? t("toast.published_with_cover") : t("toast.published_no_cover"), {
        action: {
          label: "Cofnij",
          onClick: async () => {
            await (supabase as any).from("routes").update({ status: "draft", trip_type: "ongoing" }).eq("id", id);
            queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
            queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
          },
        },
        duration: 6000,
      });
    } catch (e) {
      console.error("[SharedRoute] publish failed:", e instanceof Error ? e.message : e);
      haptics.error();
      toast.error(t("toast.publish_failed"));
    } finally { setPublishing(false); }
  };

  // Etap W TRAKCIE: zapis wlasnej notki (pin_ratings). PlaceNoteEditor sam debounce'uje -> zapis
  // natychmiastowy. Po zapisie invalidacja notek (inni uczestnicy widza + moj edytor sie synchronizuje).
  const saveMyNote = async (pin: any, value: string) => {
    if (!user) return;
    await (supabase as any).from("pin_ratings").upsert({ route_id: pin.route_id, user_id: user.id, place_name: pin.place_name, note: value || null }, { onConflict: "route_id,user_id,place_name" });
    queryClient.invalidateQueries({ queryKey: ["shared-route-notes", id] });
  };
  // Werdykt o miejscu jest WLASNY dla kazdego uczestnika (pin_ratings.verdict, obok jego notki).
  // Wczesniej siedzial w pins.tags - czyli w jednej tablicy na pinie, gdzie kazdy nadpisywal
  // opinie pozostalych. Wybor jest pojedynczy: tapniecie aktywnego chipa zdejmuje werdykt.
  const saveMyVerdict = async (pin: any, verdictId: string | null) => {
    if (!user) return;
    haptics.selection();
    await (supabase as any).from("pin_ratings").upsert(
      { route_id: pin.route_id, user_id: user.id, place_name: pin.place_name, verdict: verdictId },
      { onConflict: "route_id,user_id,place_name" });
    queryClient.invalidateQueries({ queryKey: ["shared-route-notes", id] });
  };

  // Zdjecia per-miejsce (pins.images) - wszyscy uczestnicy widza wszystkie, kazdy dodaje/usuwa (member RLS).
  // Upload zdjecia -> bucket route-images -> pin_photos (route_id, place_name, user_id, url). Kazdy
  // uczestnik dodaje; przy zdjeciu awatar autora. (pins.images zostaje zrodlem okladek osobno.)
  const addPlacePhotos = async (pin: any, files: FileList | null) => {
    if (!user || !files || !files.length || !id) return;
    setUploadingPin(pin.id);
    try {
      // Jak w galerii: HEIC -> JPEG, zmniejszenie i wgrywanie po 3 naraz. Wczesniej szedl tu
      // ORYGINALNY plik z iPhone'a (kilka MB, czasem HEIC) - stad dlugie czekanie, a na
      // urzadzeniach nie-Apple takie zdjecie i tak sie nie wyswietlalo.
      const prepared = await mapWithLimit(Array.from(files), 3, async (rawFile, i) => {
        try {
          // Wersja pelna i miniatura z JEDNEGO dekodowania (2026-09-08) - wczesniej zdjecie
          // bylo dekodowane dwa razy, a to na 12 Mpix z iPhone'a kilka sekund za kazdym razem.
          const { full, thumb } = await renderForUpload(rawFile);
          // Nazwa z TRESCI pliku: to samo zdjecie wgrane drugi raz (tez przez inna osobe w tym
          // samym wyjezdzie) trafia pod ta sama sciezke, wiec galeria miejsca nie dostaje dubla.
          const sha = await sha256Hex(full);
          const path = `${user.id}/${id}/pin_${sha ?? `${pin.id}_${i}_${Math.random().toString(36).slice(2)}`}.jpg`;
          const { error } = await uploadPair("route-images", path, full, thumb, true);
          if (error) { console.error("[SharedRoute] photo upload:", error.message); return null; }
          const { data } = supabase.storage.from("route-images").getPublicUrl(path);
          return data?.publicUrl ? { path, url: data.publicUrl } : null;
        } catch (e: any) { console.error("[SharedRoute] photo processing failed:", e?.message ?? e); return null; }
      });
      const uploaded = prepared.filter((u): u is { path: string; url: string } => !!u);
      const failedPin = Array.from(files).length - uploaded.length;
      if (failedPin) toast.error(t("toast.photos_failed", { count: failedPin }));
      // SafeSearch (Vision) RÓWNOLEGLE - jedno zdjecie to ~2-4s, wiec seryjnie 5 zdjec
      // kazalo czekac ponad minute. Odrzucone znika ze Storage i nie trafia do galerii.
      const verdicts = await Promise.all(uploaded.map((u) => moderateImageUrl(u.url, "pin_photo", { route_id: id, place_name: pin.place_name })));
      let rejectedCount = 0;
      for (let i = 0; i < uploaded.length; i++) {
        if (verdicts[i] === "rejected") {
          rejectedCount += 1;
          await supabase.storage.from("route-images").remove([uploaded[i].path]);
          continue;
        }
        await addPinPhoto(id, pin.place_name, user.id, uploaded[i].url);
      }
      if (rejectedCount) toast.error(rejectedCount === 1 ? MODERATION_REJECTED_MESSAGE : t("toast.photos_rejected", { count: rejectedCount }));
      // Opublikowany wyjazd zasila galerie MIEJSCA od razu (place_photos). Dla roboczego nie -
      // zdjecia trafia tam dopiero przy publikacji (patrz handlePublish).
      if ((route as any)?.status === "published") {
        await (supabase as any).rpc("sync_route_place_photos", { p_route_id: id });
        queryClient.invalidateQueries({ queryKey: ["place-photos"] });
      }
      queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
    } finally { setUploadingPin(null); }
  };
  // Kasowalo BEZ SLOWA - zadnego toasta, wiec i zadnej drogi powrotu (zgloszenie Nat
  // 2026-09-09). Plik w Storage zostaje, kasujemy sam wiersz, wiec "Cofnij" jest uczciwe.
  const removePlacePhoto = async (photoId: string) => {
    const row = await deletePinPhotoReturning(photoId);
    queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
    if (!row) return;
    toast.success(t("toast.photo_deleted"), {
      action: {
        label: t("common:buttons.undo"),
        onClick: () => {
          void (async () => {
            await restorePinPhotos([row]);
            queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
          })();
        },
      },
    });
  };

  // Opis + tagi z tabeli places (wizytowka miejsca). Piny nie maja vibe_tags.
  const { data: placeMeta = {} } = useQuery({
    queryKey: ["shared-place-meta", route?.city, id],
    queryFn: async () => {
      const names = [...new Set((pins as any[]).map((p) => p.place_name).filter(Boolean))];
      if (!names.length || !route?.city) return {};
      const { data } = await (supabase as any)
        .from("places")
        .select("place_name, description, vibe_tags")
        .ilike("city", `${route.city}%`)
        .in("place_name", names);
      const map: Record<string, { description: string | null; tags: string[] }> = {};
      for (const pl of data ?? []) {
        map[String(pl.place_name).toLowerCase()] = {
          description: pl.description ?? null,
          tags: Array.isArray(pl.vibe_tags) ? pl.vibe_tags.filter(Boolean) : [],
        };
      }
      return map;
    },
    enabled: pins.length > 0 && !!route?.city,
  });
  const metaFor = (pin: any) => (placeMeta as Record<string, any>)[String(pin?.place_name ?? "").toLowerCase()] ?? { description: null, tags: [] };

  if (routeLoading) return <ScreenSkeleton variant="trip" />;

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">🗺️</p>
        <p className="text-lg font-bold">{t("route_unavailable_title")}</p>
        <p className="text-sm text-muted-foreground">{t("route_unavailable_desc")}</p>
        <button onClick={() => navigate("/")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">
          {t("back_to_trasa")}
        </button>
      </div>
    );
  }

  const isOwner = !!user && route.user_id === user.id;
  // Zdjecia moze dodawac wlasciciel LUB uczestnik wspolnego wyjazdu (przez RPC append_route_photos).
  const canAddPhotos = isOwner || isGroupMember;
  // Edycja miejsc (dodaj/usun/kolejnosc): wlasciciel LUB uczestnik wspolnego wyjazdu (RLS: polityki
  // "Group members can ... pins of shared route"). Nazwa/publikacja/usuniecie trasy zostaja owner-only.
  const canEdit = isOwner || isGroupMember;

  // ── Wybor MIEJSC z cudzego wyjazdu (2026-09-10) ───────────────────────────────
  // Zastapilo "Zapisz tą trasę". Cudzy plan rzadko pasuje w calosci; to, co realnie
  // zabiera sie z cudzego wyjazdu, to dwa-trzy miejsca. Wejscie przez przytrzymanie
  // kafelka, bo w spoczynku widok ma byc do czytania, a nie obwieszony checkboxami.
  const canPick = !!user && !canEdit;
  const pickedPins = (pins as any[]).filter((p) => pickedIds.has(p.id));
  const exitPick = () => { setPickMode(false); setPickedIds(new Set()); };
  const togglePicked = (pinId: string) => {
    haptics.light();
    setPickedIds((prev) => { const n = new Set(prev); n.has(pinId) ? n.delete(pinId) : n.add(pinId); return n; });
  };
  const enterPick = (pinId: string) => { setPickMode(true); setPickedIds(new Set([pinId])); };
  /** Wiersz dostaje zaznaczanie tylko na CUDZYM wyjezdzie - u siebie ma edycje. */
  const selectionFor = (pin: any) => (canPick ? {
    active: pickMode,
    selected: pickedIds.has(pin.id),
    onToggle: () => togglePicked(pin.id),
    onEnter: () => enterPick(pin.id),
  } : undefined);

  const pickedAsPlaces = () => pickedPins.map((p: any) => ({
    place_name: p.place_name, category: p.category ?? null, address: p.address ?? null,
    latitude: p.latitude ?? null, longitude: p.longitude ?? null,
    // Zdjecie NIE jedzie z miejscem: nalezy do autora tamtego wyjazdu (zdjecia userow zyja
    // w place_photos i tak sie doczytaja), a przenoszenie go tutaj zrobiloby z cudzej pracy
    // okladke mojego wyjazdu.
    photo_url: null, place_id: p.place_id ?? null, description: null,
  }));

  /** "Utwórz wyjazd do {kraj}" - nowy szkic z zaznaczonych miejsc, od razu w nim ladujemy. */
  const createTripFromPicked = async () => {
    if (!user || !pickedPins.length) return;
    setPickBusy(true);
    const countries = scopeCountries(route);
    const newId = await createWyjazdFromPlaces(
      user.id, route.city ?? null, cityLabel, pickedAsPlaces(), undefined,
      { countries, tripType: "planning" },
    );
    setPickBusy(false);
    if (!newId) { haptics.error(); toast.error(t("toast.pick_trip_failed")); return; }
    haptics.success();
    track("trip_places_forked", { from_route: id, count: pickedPins.length });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
    exitPick();
    navigate(`/route/${newId}`);
  };

  /** "Dodaj do wyjazdu" - dopisanie zaznaczonych miejsc do istniejacego szkicu. */
  const addPickedToTrip = async (targetId: string, targetTitle: string) => {
    if (!user || !pickedPins.length) return;
    setPickBusy(true);
    try {
      const { data: existing } = await (supabase as any).from("pins")
        .select("place_name, pin_order").eq("route_id", targetId);
      const taken = new Set(((existing ?? []) as any[]).map((p) => (p.place_name || "").trim().toLowerCase()));
      const maxOrder = ((existing ?? []) as any[]).reduce((m, p) => Math.max(m, p.pin_order ?? -1), -1);
      // Miejsce, ktore juz tam jest, pomijamy po cichu - duplikat w wyjezdzie to zawsze blad,
      // a nie decyzja usera.
      const rows = pickedAsPlaces()
        .filter((p) => !taken.has((p.place_name || "").trim().toLowerCase()))
        .map((p, i) => ({
          route_id: targetId, place_name: p.place_name, address: p.address ?? "", description: null,
          category: p.category || "other", latitude: p.latitude, longitude: p.longitude,
          place_id: p.place_id, suggested_time: null, photo_url: null,
          pin_order: maxOrder + 1 + i, original_creator_id: user.id, added_by: user.id,
        }));
      if (!rows.length) { haptics.error(); toast.info(t("toast.pick_all_present")); return; }
      const { error } = await (supabase as any).from("pins").insert(rows);
      if (error) throw error;
      haptics.success();
      track("trip_places_copied", { from_route: id, to_route: targetId, count: rows.length });
      queryClient.invalidateQueries({ queryKey: ["shared-route-pins", targetId] });
      queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
      toast.success(t("toast.pick_added", { count: rows.length, trip: targetTitle }), {
        action: { label: t("pick.open_trip"), onClick: () => navigate(`/route/${targetId}`) },
      });
      setPickTargetOpen(false);
      exitPick();
    } catch (e: any) {
      console.error("[SharedRoute] addPickedToTrip:", e?.message ?? e);
      haptics.error();
      toast.error(t("toast.pick_add_failed"));
    } finally {
      setPickBusy(false);
    }
  };

  // Etap cyklu zycia wyjazdu (Nat 2026-08-25): planning=Propozycje, ongoing=W Trakcie, completed=Wspomnienie.
  const stage: "planning" | "ongoing" | "completed" = ((route as any).trip_type as any) || "planning";
  // Opublikowany = jest juz w eksploracji i na profilu jako wspomnienie.
  const isPublished = ((route as any).status as string) === "published";
  // Wlasciciel moze opublikowac kazdy nieopublikowany wyjazd poza etapem propozycji
  // (tam najpierw wybiera sie miejsca).
  const canPublish = isOwner && stage !== "planning" && !isPublished;
  const proceedToChoosing = () => { setMissingParticipants(null); haptics.light(); setChosen(new Set((pins as any[]).map((p) => p.id))); setChoosing(true); };
  const startChoosing = () => {
    // Sprawdz czy KAZDY uczestnik (poza hostem) dodal >=1 miejsce (pins.added_by). Jesli nie -> dialog.
    const contributors = new Set((pins as any[]).map((p) => p.added_by).filter(Boolean));
    const missing = (groupParticipants as any[]).filter((p) => !contributors.has(p.id));
    if (missing.length > 0) { haptics.light(); setMissingParticipants(missing); return; }
    proceedToChoosing();
  };
  // Wyslij przypomnienie ("dodaj miejsca") uczestnikom, ktorzy jeszcze nic nie dodali (RPC host-only + push).
  const sendReminders = async () => {
    if (!missingParticipants || !id) return;
    setReminderBusy(true);
    try {
      for (const m of missingParticipants) { await (supabase as any).rpc("notify_trip_places_reminder", { p_route_id: id, p_user_id: m.id }); }
      haptics.success(); toast.success(missingParticipants.length === 1 ? t("toast.reminder_sent") : t("toast.reminders_sent"));
    } catch (e: any) { console.warn("[SharedRoute] reminder:", e?.message ?? e); haptics.error(); }
    finally { setReminderBusy(false); setMissingParticipants(null); }
  };
  const toggleChosen = (pid: string) => setChosen((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  // t("choose_places") -> zaznaczone zostaja, reszta usunieta, trip_type='ongoing' (przejscie w trakcie).
  const confirmChoose = async () => {
    if (!chosen.size) { toast(t("toast.select_one_place")); return; }
    setChoosingBusy(true); haptics.light();
    try {
      const leftover = (pins as any[]).filter((p) => !chosen.has(p.id));
      // Nie gub miejsc: niezaznaczone -> lista "Ogólne" (na razie hosta; docelowo wszystkich
      // uczestnikow przez definer-RPC). Zeby sugestie nie przepadly.
      if (leftover.length && user) {
        for (const p of leftover) {
          try {
            await quickSavePlace(user.id, {
              place_name: p.place_name, category: p.category ?? null, address: p.address ?? null,
              description: p.description ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
              photo_url: p.photo_url ?? null, place_id: p.place_id ?? null, google_place_id: p.google_place_id ?? null, rating: p.rating ?? null,
            } as PlaceForList, null);
          } catch (e: any) { console.warn("[SharedRoute] save leftover:", e?.message ?? e); }
        }
      }
      const removeIds = leftover.map((p) => p.id);
      if (removeIds.length) {
        // Odrzucone propozycje tez zabieraja swoje zdjecia - inaczej zostawalyby w galerii
        // wyjazdu, mimo ze miejsca juz w nim nie ma.
        const removed = (pins as any[]).filter((p) => removeIds.includes(p.id));
        await (supabase as any).from("pins").delete().in("id", removeIds);
        for (const p of removed) {
          const rows = await deletePinPhotosForPlace(id!, p.place_name);
          await detachPlacePhotos([`nm:${String(p.place_name ?? "").toLowerCase().trim()}`],
            [...rows.map((r: any) => r.url), ...((p.images ?? []) as string[]), ...((p.user_photo_urls ?? []) as string[])]);
        }
      }
      await (supabase as any).from("routes").update({ trip_type: "ongoing" }).eq("id", route.id);
      haptics.success(); toast.success(t("toast.places_chosen"));
      setChoosing(false);
      queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
      queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    } catch (e: any) { console.error("[SharedRoute] confirmChoose:", e?.message ?? e); haptics.error(); toast.error(t("toast.next_failed")); }
    finally { setChoosingBusy(false); }
  };

  // Zmiana kolejnosci miejsc (drag) - optymistycznie w cache + persist pin_order (bezposredni update,
  // RLS zezwala wlascicielowi i czlonkowi). Wzor: ReviewSummary.savePlan.
  const persistPinOrder = async (ordered: any[]) => {
    // Zapisujemy kolejnosc ORAZ dzien - przy wyjezdzie wielodniowym przeciagniecie miejsca pod
    // inny naglowek zmienia jego day_index (pole pomijamy, gdy wyjazd nie ma podzialu na dni).
    await Promise.all(ordered.map((p: any, idx: number) => {
      const patch: Record<string, unknown> = { pin_order: idx };
      if (p.day_index != null) patch.day_index = p.day_index;
      return (supabase as any).from("pins").update(patch).eq("id", p.id);
    }));
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
  };
  /** Przenosi miejsce do NASTEPNEGO dnia (z zawijaniem). Kolejnosc w obrebie dnia: na koniec. */
  const movePinToNextDay = (pin: any) => {
    const next = (pinDay(pin) % dayCount) + 1;
    const rest = (pins as any[]).filter((p) => p.id !== pin.id);
    const moved = { ...pin, day_index: next };
    const ordered: any[] = [];
    for (let d = 1; d <= dayCount; d++) {
      ordered.push(...rest.filter((p) => pinDay(p) === d));
      if (d === next) ordered.push(moved);
    }
    haptics.success();
    handleReorderPins(ordered);
    toast.success(t("day.moved", { day: t("days.nth", { n: next }) }));
  };

  const handleReorderPins = (newOrder: any[]) => {
    reorderTick(newOrder, (pins as any[]) ?? []);
    queryClient.setQueryData(["shared-route-pins", id], newOrder);
    void persistPinOrder(newOrder);
  };

  // Wlasciciel ustawia ZAKRES dat wyjazdu. FullCalendarPicker zwraca (start, liczba dni),
  // wiec end_date liczymy z liczby dni. Zakres > 1 dnia wlacza podzial miejsc na dni.
  const saveTripDates = async (start: Date, numDays: number) => {
    if (!id) return;
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const end = new Date(start.getTime() + (Math.max(1, numDays) - 1) * 86400000);
    const { error } = await (supabase as any).from("routes")
      .update({ start_date: iso(start), end_date: iso(end) }).eq("id", id);
    if (error) { toast.error(t("toast.dates_failed")); return; }
    setDatesSheetOpen(false);
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success(numDays > 1 ? t("toast.dates_saved_multi", { count: numDays }) : t("toast.date_saved"));
  };
  const clearTripDates = async () => {
    if (!id) return;
    await (supabase as any).from("routes").update({ start_date: null, end_date: null }).eq("id", id);
    setDatesSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
  };

  // Jak w liscie: guzik pokazuje KARTE wyjazdu do zrzutu; dlugie przytrzymanie wysyla sam link.
  const handleShare = () => setShareCardOpen(true);
  const handleShareLink = () => { void share({ title: route.title || cityLabel || t("common:fallback.trip"), url: buildShareUrl(`/route/${route.id}`) }); };

  // Zmiana nazwy wyjazdu (prosba Nat 2026-09-10). Nazwa nie powstaje juz w kreatorze - domyslnie
  // jest to lista krajow - wiec musi dac sie zmienic tam, gdzie jest o czym decydowac.
  // Edycja NA MIEJSCU, tak samo jak nazwa listy (SharedList) - osobny arkusz do jednego pola
  // tylko mnozylby kroki.
  const saveRouteName = async () => {
    if (!id) return;
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed === (route?.title ?? "")) { setEditingName(false); return; }
    setSavingName(true);
    const { error } = await (supabase as any).from("routes").update({ title: trimmed }).eq("id", id);
    setSavingName(false);
    if (error) {
      // Cenzura siedzi w bazie (wyzwalacz na tytule) - bez osobnego komunikatu user widzi
      // tylko, ze "nie zapisalo sie".
      toast.error(/title_not_allowed/.test(error.message) ? t("toast.name_not_allowed") : t("toast.name_failed"));
      return;
    }
    setEditingName(false);
    queryClient.setQueryData(["shared-route", id], (old: any) => (old ? { ...old, title: trimmed } : old));
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    haptics.success();
    toast.success(t("toast.name_saved"));
  };

  // Wlasciciel dodaje miejsca do ISTNIEJACEJ trasy: append do pins (jak AddPlaceToTrip), potem refetch.
  const handleAddPlaces = async (places: PlaceForList[]) => {
    if (!user) return;
    const maxOrder = pins.reduce((m: number, p: any) => Math.max(m, p.pin_order ?? -1), -1);
    // Dowiazanie do NASZEGO rekordu `places` - dzieki temu lokal z kontem biznesowym otwiera sie
    // jako pelna wizytowka, a nie "zero" (zgloszenie Nat 2026-09-01).
    const dbIds = await Promise.all(places.map((p) =>
      p.place_id ? Promise.resolve(p.place_id) : resolvePlaceDbId(p.google_place_id, p.place_name, route.city)));
    const rows = places.map((p, i) => ({
      // description = notka pina: pusta, notke pisze kazdy uczestnik sam (PlaceNotes).
      route_id: route.id, place_name: p.place_name, address: p.address ?? null, description: null,
      category: p.category ?? "other", latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      place_id: dbIds[i] ?? p.place_id ?? null, suggested_time: null, photo_url: p.photo_url ?? null,
      pin_order: maxOrder + 1 + i, original_creator_id: user.id, added_by: user.id,
      // Miejsce dodane przy WYBRANYM dniu ląduje w tym dniu. Bez tego wpadalo do dnia 1 i
      // znikalo z ekranu (przelacznik dni pokazuje jeden dzien naraz).
      day_index: activeDay,
    }));
    const { error } = await (supabase as any).from("pins").insert(rows);
    if (error) throw error;
    track("trip_place_added", { target: "trip", route_id: id, city: route.city ?? null, count: rows.length });
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
  };

  const existingPinNames = new Set(pins.map((p: any) => (p.place_name || "").trim().toLowerCase()));

  // #7: wlasciciel LUB uczestnik wspolnego wyjazdu dodaje zdjecia z widoku (Galeria). HEIC->JPEG
  // + kompresja -> route-images -> RPC append_route_photos (owner|czlonek) -> refetch.
  const handleAddPhotos = async (files: File[]) => {
    if (!user || !files.length) return;
    setUploadingPhotos(true);
    let rejected = 0;   // zdjecia odrzucone przez SafeSearch
    // Przygotowanie + wgranie RÓWNOLEGLE, po 3 naraz. Seryjna petla przy paczce zdjec z iPhone'a
    // (12 Mpx kazde) potrafila trwac minute, a gdy ktores zdjecie sie nie przetworzylo, znikalo
    // bez sladu w UI - stad "trwa wieki i finalnie nic sie nie dodaje" (zgloszenie Nat 2026-09-01).
    // Moderacja idzie ZARAZ PO wgraniu KAZDEGO zdjecia, a nie osobna faza po calej paczce.
    // Wczesniej przebieg byl scisle etapowy: [wszystkie wysylki] -> [wszystkie moderacje] -> zapis,
    // wiec 1-3 s na zdjecie (zmierzone) doklejalo sie do konca czekania zamiast chowac sie
    // w cieniu kolejnych wysylek.
    setPhotoProgress({ done: 0, total: files.length });
    const processed = await mapWithLimit(files, 3, async (rawFile, i) => {
      try {
        const path = `${user.id}/${route.id}/gal_${Date.now()}_${i}_${Math.floor(Math.random() * 1e6)}.jpg`;
        // Jedno dekodowanie na zdjecie zamiast dwoch, oryginal i miniatura w sieci rownolegle.
        const { error } = await uploadWithThumb("route-images", path, rawFile);
        if (error) { console.error("[SharedRoute] photo upload failed:", error.message); return null; }
        const url = `${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`;
        const verdict = await moderateImageUrl(url, "trip_gallery", { route_id: route.id });
        setPhotoProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        if (verdict === "rejected") {
          await (supabase as any).storage.from("route-images").remove([path, `${path}.thumb`]);
          return "rejected" as const;
        }
        return url;
      } catch (e: any) { console.error("[SharedRoute] photo processing failed:", e?.message ?? e); return null; }
    });
    let urls: string[] = processed.filter((u): u is string => !!u && u !== "rejected");
    rejected = processed.filter((u) => u === "rejected").length;
    const failed = processed.filter((u) => u === null).length;
    if (urls.length) {
      // RPC (SECURITY DEFINER) - dziala dla wlasciciela ORAZ uczestnika wspolnego wyjazdu
      // (routes UPDATE RLS = tylko owner; czlonek dopisuje zdjecia przez append_route_photos).
      const { error } = await (supabase as any).rpc("append_route_photos", { p_route_id: route.id, p_urls: urls });
      if (error) { toast.error(t("toast.photos_save_failed")); }
      else { toast.success(t("toast.photos_added", { count: urls.length })); queryClient.invalidateQueries({ queryKey: ["shared-route", id] }); }
    } else if (!rejected && !failed) { toast.error(t("toast.photos_add_failed")); }
    if (rejected) toast.error(rejected === 1 ? MODERATION_REJECTED_MESSAGE : t("toast.photos_rejected", { count: rejected }));
    // Zdjecia zgubione po drodze mowia o tym wprost - wczesniej znikaly po cichu.
    if (failed) toast.error(t("toast.photos_failed", { count: failed }));
    setPhotoProgress(null);
    setUploadingPhotos(false);
  };

  // #4: wlasciciel usuwa miejsce z trasy (kosz w wierszu). Toast + "Cofnij" (re-insert).
  // Usuniecie miejsca: w PROPOZYCJACH tanie (toast + Cofnij), ale od etapu "w trakcie" miejsce
  // niesie juz notki i zdjecia uczestnikow - tam pytamy o potwierdzenie (zgloszenie Nat 2026-08-29).
  const handleDeletePin = async (pin: any) => {
    if (stage !== "planning") { haptics.warning(); setConfirmDeletePin(pin); return; }
    await deletePinNow(pin);
  };

  const deletePinNow = async (pin: any) => {
    const { id: _id, created_at, updated_at, ...rest } = pin;
    const { error } = await (supabase as any).from("pins").delete().eq("id", pin.id);
    if (error) { toast.error(t("toast.place_delete_failed")); return; }
    // Zdjecia ida ZA miejscem (zgloszenie Nat 2026-09-01). Wczesniej znikal sam pin, a zdjecia
    // zostawaly: w galerii wyjazdu (pin_photos, kluczowane nazwa miejsca) i w galerii miejsca
    // (place_photos, dosypywane przez sync_route_place_photos). Efekt: miejsca usuniete z wyjazdu
    // nadal mialy w aplikacji swoje zdjecia, a po ponownym dodaniu robily sie duble.
    const goneRows = await deletePinPhotosForPlace(id!, pin.place_name);
    const gonePlace = await detachPlacePhotos([`nm:${String(pin.place_name ?? "").toLowerCase().trim()}`],
      [...goneRows.map((r: any) => r.url), ...((pin.images ?? []) as string[]), ...((pin.user_photo_urls ?? []) as string[])]);
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
    queryClient.invalidateQueries({ queryKey: ["place-photos"] });
    // Toast: miniaturka (lewo, powiekszona) + nazwa + Cofnij. toast.custom = pelna kontrola (akcja
    // + rozmiar miniatury), bo sonner action nie zawsze renderowal sie z customowa trescia.
    toast.custom((tid) => (
      <div className="flex items-center gap-3 w-full bg-white rounded-2xl shadow-lg shadow-black/10 pl-2.5 pr-2 py-2.5">
        <PlacePhoto pin={pin} width={56} className="h-12 w-12 rounded-xl object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground truncate">{pin.place_name}</p>
          <p className="text-[11.5px] text-muted-foreground">{stage === "planning" ? t("toast.removed_from_proposals") : t("toast.removed_from_trip")}</p>
        </div>
        <button
          onClick={async () => {
            // Cofnij przywraca komplet: miejsce + jego zdjecia w obu galeriach.
            await (supabase as any).from("pins").insert({ ...rest });
            await restorePinPhotos(goneRows);
            await restorePlacePhotos(gonePlace);
            queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
            queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
            queryClient.invalidateQueries({ queryKey: ["place-photos"] });
            toast.dismiss(tid);
          }}
          className="shrink-0 text-[13px] font-bold text-primary px-3 py-2 rounded-xl active:bg-primary/10 transition-colors">Cofnij</button>
      </div>
    // classNames neutralizuje domyslny kontener Sonnera (szare tlo/ramka/cien z toastOptions) - inaczej
    // widac PODWOJNA obwodke: szary wrapper + moj bialy div. Cala plakietka ma byc jednolicie biala.
    ), { unstyled: true, classNames: { toast: "!bg-transparent !border-0 !shadow-none !p-0 !min-h-0" } });
  };

  // #3: usun zdjecie z galerii wyjazdu (review_photos). Toast + "Cofnij".
  //
  // Przez RPC, nie zwyklym UPDATE: polityka RLS na `routes` przepuszcza tylko wlasciciela,
  // a uczestnik wspolnego wyjazdu MOGL dodac zdjecie (append_route_photos) i nie mogl go cofnac
  // (zgloszenie Nat 2026-09-09). Kto jest autorem zdjecia, rozstrzyga sciezka w Storage -
  // patrz migracja 20260909b. Plik w Storage zostaje, zeby "Cofnij" mialo co przywrocic.
  const handleDeletePhoto = async (url: string) => {
    const { error } = await (supabase as any).rpc("remove_route_photo", { p_route_id: route.id, p_url: url });
    if (error) { toast.error(t("toast.photo_delete_failed")); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success(t("toast.photo_deleted"), {
      action: {
        label: "Cofnij",
        onClick: async () => {
          await (supabase as any).rpc("restore_route_photo", { p_route_id: route.id, p_url: url });
          queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
        },
      },
    });
  };

  /** Czy TO zdjecie wgral zalogowany user - "<user_id>/<route_id>/" w sciezce pliku. */
  const isMyGalleryPhoto = (url: string) => !!user?.id && url.includes(`/${user.id}/${route.id}/`);

  // #c: ustaw zdjecie jako OKLADKE EKSPLORACJI (list_cover_url). Tylko wlasne zdjecia (galeria) -
  // zgodne z regula "okladka listy/trasy nigdy z Google".
  // Wybor okladki z GALERII (ikona eksploracji przy zdjeciu). Ustawia MOJA okladke - te, ktora
  // widze na swojej karcie wyjazdu w profilu i w hero tego widoku. Gdy robi to wlasciciel,
  // ustawiamy przy okazji okladke eksploracji (routes.list_cover_url): dla niego to jedna decyzja,
  // a bramka publikacji wymaga tej kolumny (patrz reference_content_ops_scripts).
  const setCoverFromGallery = async (url: string) => {
    if (!user?.id || !id) return;
    const ok = await setMyRouteCover(id, user.id, url);
    if (!ok) { toast.error(t("toast.cover_failed")); return; }
    queryClient.invalidateQueries({ queryKey: ["route-member-cover", id, user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    if (isOwner) await handleSetCover(url, true);
    else toast.success(t("toast.own_cover_set"));
  };

  const handleSetCover = async (url: string, silent = false) => {
    const { error } = await (supabase as any).from("routes").update({ list_cover_url: url }).eq("id", route.id);
    if (error) { toast.error(t("toast.cover_failed")); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success(silent ? t("toast.trip_cover_set") : t("toast.explore_cover_set"));
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Wielodniowy wyjazd (folder_id) -> usuwamy WSZYSTKIE dni; inaczej pojedyncza trase.
      let ids: string[] = [route.id];
      if ((route as any).folder_id) {
        const { data: days } = await (supabase as any)
          .from("routes").select("id").eq("folder_id", (route as any).folder_id).eq("user_id", user.id);
        if (days?.length) ids = days.map((d: any) => d.id);
      }
      // Commit ODROCZONY o okno "Cofnij" - tak samo, jak przy usuwaniu wyjazdu z profilu
      // (TravelerProfile). Kasujemy piny, czat i trase, wiec nie da sie tego zlozyc z powrotem
      // po fakcie; jedyne uczciwe cofniecie to nie wykonac usuniecia (zgloszenie Nat 2026-09-09).
      setAskDelete(false);
      goBackOr(navigate, "/moj-profil");
      deferDelete({
        message: t("toast.trip_deleted"),
        commit: async () => {
          await supabase.from("pins").delete().in("route_id", ids);
          await (supabase as any).from("chat_sessions").delete().in("route_id", ids);
          const { error } = await supabase.from("routes").delete().in("id", ids).eq("user_id", user.id);
          if (error) { toast.error(t("toast.trip_delete_failed")); return; }
          queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
        },
        onUndo: () => queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] }),
      });
    } catch (e: any) {
      toast.error(t("toast.trip_delete_failed"));
      console.error("[SharedRoute] delete failed:", e?.message ?? e);
      setDeleting(false);
    }
  };

  // Okladki miejsc ze zdjec dodanych przez userow w wizytowkach (place_photos) - gdy pin nie ma
  // wlasnego zdjecia. Spojnie z widokiem trasy/listy: place_photos to zdjecia miejsca (Storage).
  const routeCity = route.city ?? null;
  const pinHasOwnPhoto = (p: any) =>
    !!(p.image_url || (Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.user_photo_urls) && p.user_photo_urls[0]) || p.photo_url);
  const coverFor = (p: any): string | null => {
    if (pinHasOwnPhoto(p)) return null; // PlacePhoto sam wybierze wlasne zdjecie pinu
    return pickPlaceCover(placePhotoCoverMap, pinCoverKeys(p, routeCity));
  };

  // Hero: okladka autora (review_photos[0]) -> zdjecie pierwszego miejsca z trasy (wlasne LUB
  // place_photo) -> ilustracja placeholder.
  const userCover = (route.review_photos ?? []).find((u: any) => typeof u === "string" && u.trim() !== "") ?? null;
  const placeCover = resolveStored(pins[0]?.photo_url || pins[0]?.image_url) ?? (pins[0] ? coverFor(pins[0]) : null);
  // JEDNA lista dla mapy: kafelek w zakladce, pelny ekran i wizytowki pod mapa dostaja te same
  // piny, wiec numeracja wszedzie sie zgadza. `__no` = pozycja w wyjezdzie liczona PRZED odsianiem
  // miejsc bez wspolrzednych (inaczej miejsce bez lokalizacji przesuwaloby numery reszcie).
  const mapPlaces = (pins as any[])
    .map((p, i) => ({ ...p, __no: i + 1 }))
    .filter((p) => p.latitude != null && p.longitude != null);
  // Priorytet hero: MOJA okladka (jesli wybralem) -> okladka autora -> zdjecie miejsca.
  const cover = resolveStored(myCover) ?? userCover ?? placeCover;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(route.id);
  // Opis trasy (pod tytulem) = podsumowanie AI albo podpis autora.
  // Opis trasy: preferuj reczny opis autora (review_narrative), potem AI/podpis udostepnienia.
  const routeDescription: string = (route as any).review_narrative || route.ai_summary || shareMeta?.share_caption || "";
  // Galeria = wszystkie zdjecia wyjazdu autora (review_photos), z rozwiazanym URL-em.
  const galleryPhotos: string[] = ((route.review_photos ?? []) as any[])
    .map((u) => (typeof u === "string" ? resolveStored(u) : null))
    .filter((u): u is string => !!u);
  // Handler swipe w galerii fullscreen jest zadeklarowany wyzej (przed early returnami),
  // wiec liczbe zdjec podajemy mu przez ref.
  galleryPhotosCount.current = galleryPhotos.length;
  galleryPhotosRef.current = galleryPhotos;
  // ── DNI WEWNATRZ WYJAZDU ────────────────────────────────────────────────────
  // Data wybrana + zakres wielodniowy -> miejsca dzielimy na "Dzien 1..N" (pins.day_index,
  // przypisanie RECZNE przez drag). Brak daty albo jeden dzien -> plaska lista jak dotad.
  const tripStart = route.start_date ? new Date(route.start_date) : null;
  const tripEnd = (route as any).end_date ? new Date((route as any).end_date) : null;
  const dayCount = tripStart && tripEnd
    ? Math.max(1, Math.round((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1)
    : 1;
  const hasDays = !!tripStart && dayCount > 1;
  const dayDate = (day: number) => (tripStart ? new Date(tripStart.getTime() + (day - 1) * 86400000) : null);
  const dayLabel = (day: number) => {
    const d = dayDate(day);
    return d ? t("day.label_with_date", { day, date: format(d, "EEEE d.MM", { locale: dateLocale() }) }) : t("day.label", { day });
  };
  const pinDay = (pin: any) => Math.min(Math.max(Number(pin?.day_index) || 1, 1), dayCount);
  // Krotka data pod nazwa dnia w chipie: "pt 12.09". Daje kontekst bez otwierania kalendarza.
  const dayChipDate = (day: number) => {
    const d = dayDate(day);
    return d ? format(d, "EEEEEE d.MM", { locale: dateLocale() }) : "";
  };
  // Dzien domyslny: ten, ktory trwa DZIS (gdy wyjazd wlasnie sie dzieje), inaczej pierwszy.
  // Liczony z samych dat (bez godzin), zeby strefa czasowa nie przesuwala doby.
  // Dopoki user sam nie tknal przelacznika, pokazujemy dzien domyslny. Po tknieciu rzadzi jego
  // wybor - w tym "Wszystkie" (null), ktorego nie da sie odroznic od "jeszcze nie wybral".
  // Przelacznik dni pokazujemy na KAZDYM etapie (propozycje, w trakcie, wspomnienie), gdy tylko
  // wyjazd ma zakres dat i pierwsze miejsce (prosba Nat 2026-09-01): cala grupa ma od razu widziec,
  // ze wyjazd ma podzialke na dni - takze wtedy, gdy dni sa jeszcze puste. Nowe miejsca trafiaja
  // domyslnie do dnia 1, a przypisac je do wlasciwego dnia mozna w kazdej chwili - w wersji
  // roboczej, w trakcie wyjazdu i po nim (gdyby cos poszlo nie tak).
  const daysUsable = hasDays && (pins as any[]).length > 0;
  // Domyslnie "Wszystkie" (null), nie dzien dzisiejszy (prosba Nat 2026-09-08): wchodzac
  // w wyjazd chce sie najpierw zobaczyc CALOSC, a dopiero potem zawezic do dnia. Dzien
  // dzisiejszy zostaje jednym tapnieciem w chip.
  const activeDay: number | null = daysUsable && dayTouched ? selectedDay : null;
  // Miejsca widoczne na ekranie = te z wybranego dnia. Filtrujemy RAZ, przed grupowaniem po
  // kategoriach - inaczej puste kategorie zostawialyby po sobie same naglowki.
  const visiblePins: any[] = activeDay === null ? (pins as any[]) : (pins as any[]).filter((p) => pinDay(p) === activeDay);
  const pickDay = (day: number | null) => { haptics.selection(); setDayTouched(true); setSelectedDay(day); };
  const placeWord = (n: number) => {
    if (n === 1) return "miejsce";
    const u = n % 10, h = n % 100;
    return u >= 2 && u <= 4 && !(h >= 12 && h <= 14) ? "miejsca" : "miejsc";
  };
  const dateLabel = tripStart
    ? (tripEnd && dayCount > 1
        ? `${format(tripStart, "d MMM", { locale: dateLocale() })} - ${format(tripEnd, "d MMMM yyyy", { locale: dateLocale() })}`
        : format(tripStart, "d MMMM yyyy", { locale: dateLocale() }))
    : "";
  // Podpis zasiegu: kraje wyjazdu, a dla starych wyjazdow - miasto (patrz src/lib/tripScope.ts).
  const cityLabel = scopeLabel(route) || t("trip_default");
  // Karta z eksploracji potrzebuje tagow (kategorie miejsc) i wspolrzednych (mini mapka).
  // Liczymy raz - uzywa ich podglad udostepniania I zapowiedz dla odbiorcy linku.
  const cardTags = [...new Set((pins as any[]).map((p) => p.category).filter(Boolean))]
    .slice(0, 3).map((c) => categoryLabel(c as string));
  const cardMapPins = (pins as any[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  // Tryb anonimowy: autor ukryty (bez profilu/awatara/lokalsa).
  const isAnon = shareMeta?.share_anonymous === true;
  // "lokals poleca!" - autor pochodzi z miasta tej trasy.
  const authorName = isAnon ? t("author_anon") : (author?.first_name || author?.username || t("author_default"));
  const isLocal = !isAnon && !!author?.home_city && !!route.city &&
    author.home_city.trim().toLowerCase() === route.city.trim().toLowerCase();

  // Po otwarciu karty doczytujemy PELNA wizytowke z bazy (places + business_profiles), gdy pin
  // wskazuje na nasz rekord. Bez tego lokal z kontem biznesowym pokazywal sie jako wizytowka
  // "zero" - karta budowana z samego wiersza pinu nie ma skad wziac profilu, godzin ani menu
  // (zgloszenie Nat 2026-09-01). Budujemy szybka wersje od razu, a bogatsza podmieniamy, gdy
  // przyjdzie - dzieki temu arkusz otwiera sie natychmiast.
  const upgradeDetail = async (pin: any) => {
    const dbId = typeof pin.place_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pin.place_id)
      ? pin.place_id
      : await resolvePlaceDbId(pin.google_place_id, pin.place_name, route.city);
    if (!dbId) return;
    const full = await fetchEnrichedPlace(dbId);
    // Nazwa zostaje TA Z WYJAZDU. resolvePlaceDbId dopasowuje miejsce po nazwie i wspolrzednych,
    // wiec potrafi trafic w wiersz zapisany pod inna nazwa - i wtedy wizytowka pokazywala co
    // innego niz wiersz, w ktory user wlasnie tapnal (zgloszenie Nat 2026-09-08). Z wzbogacenia
    // bierzemy dane (zdjecia, godziny, profil biznesu), ale nie podmieniamy tego, co user widzi
    // na liscie i sam tam wpisal.
    if (full) setDetailPin((cur) => (cur && cur.place_name === pin.place_name
      ? mergeRowPhotosIntoDetail({ ...full, place_name: pin.place_name }, rowOwnPhotos(pin))
      : cur));
  };

  // Wizytowka dostaje TE SAME zdjecia, ktore pokazuje wiersz - patrz ten sam komentarz
  // w SharedList. `google_place_id` idzie dalej, zeby galeria miejsca byla odpytana oboma
  // kluczami (gpid: oraz nm:), nie tylko po nazwie.
  const openDetail = (pin: any) => { void upgradeDetail(pin); const own = rowOwnPhotos(pin); return setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: route.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    google_place_id: pin.google_place_id ?? null,
    galleryPhotos: own.slice(1),
    photo_url: own[0] ?? coverFor(pin) ?? "",
    vibe_tags: metaFor(pin).tags,
    // Zrodlo prawdy = opis miejsca z bazy (places.description, jak w swiperze).
    // pin.description (generowany AI per-trasa) tylko jako fallback dla custom pinow.
    description: metaFor(pin).description || pin.description || "",
  } satisfies MockPlace); };

  // Awatar zalogowanego usera (do edytora "Twoja notka"): z listy uczestnikow lub autora (owner).
  const myAvatar = (groupParticipants as any[]).find((p) => p.id === user?.id)?.avatar_url ?? (isOwner ? (author as any)?.avatar_url : null);

  // Mapa user_id -> avatar (uczestnicy + autor). "added_by" na pinie = kto DODAL miejsce -> awatar w rogu.
  const avatarByUser = new Map<string, string | null>();
  for (const p of (groupParticipants as any[])) avatarByUser.set(p.id, p.avatar_url ?? null);
  if (route?.user_id && (author as any)?.avatar_url) avatarByUser.set(route.user_id, (author as any).avatar_url);
  // undefined = brak added_by (stare piny -> bez awatara); null = jest autor ale brak awatara (default).
  const addedByAvatar = (pin: any): string | null | undefined => (pin.added_by ? (avatarByUser.get(pin.added_by) ?? null) : undefined);

  // Plaska lista miejsc (wg Figmy: bez grupowania po kategorii) - wspoldzielony RoutePlaceRow
  // (duze zdjecie 104px, chip kategorii + guzik Google). Notki uczestnikow pod wierszem gdy sa.
  const buildNote = (pin: any): ReactNode | undefined => {
    const list = notesMap.get(placeNoteKey(pin.place_name)) ?? [];
    // Etap PROPOZYCJI (planning): glosowanie na miejsce (kazdy uczestnik 1 glos; host widzi liczbe).
    if (stage === "planning") {
      const v = (votesMap as Map<string, { count: number; voted: boolean }>).get(placeVoteKey(pin.place_name)) ?? { count: 0, voted: false };
      // Etykieta = laczna liczba glosow: "+1" domyslnie (zacheta), "+2" gdy dwoje zaglosowalo itd.
      // Pomaranczowy = JA zaglosowalem. (prosba Nat 2026-08-26)
      const voteLabel = `+${Math.max(1, v.count)}`;
      if (!user) return v.count > 0 ? (
        <div className="mt-1.5 inline-flex items-center rounded-full bg-secondary px-3 py-1.5 text-[13px] font-bold text-muted-foreground">{voteLabel}</div>
      ) : undefined;
  return (
        <button onClick={() => toggleVoteHandler(pin, v.voted)}
          className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-bold active:scale-95 transition-transform ${v.voted ? "bg-primary text-white" : "bg-secondary text-foreground"}`}>
          {voteLabel}
        </button>
      );
    }
    // Etap W TRAKCIE (ongoing) i WSPOMNIENIE (completed): notki innych (awatar + tresc, BEZ headera)
    // + moja notka (kompaktowo, auto-zapis) + guzik "Zdjęcie" obok + zdjecia per-miejsce (awatar
    // autora). Uklad wspolny z listami.
    // Dopisywanie dziala TAKZE PO PUBLIKACJI (prosba Nat 2026-09-01): wspomnienie dojrzewa po
    // powrocie - kazdy uczestnik moze dorzucic swoja notke i zdjecia do miejsca. RLS na
    // pin_ratings/pin_photos tego nie blokuje (warunkiem jest czlonkostwo, nie status trasy).
    if (stage === "ongoing" || stage === "completed") {
      const placePhotos = photosMap.get(pinPhotoKey(pin.place_name)) ?? [];
      const myVerdict = (list.find((n) => n.user_id === user?.id)?.verdict ?? null) as string | null;
      // Widz spoza wyjazdu przy pustym miejscu: nic nie renderujemy (bez pustego odstepu pod wierszem).
      if (!canEdit && !list.length && !placePhotos.length) return undefined;
      const busy = uploadingPin === pin.id;
      const myNote = ((list.find((n) => n.user_id === user?.id)?.note) ?? "").trim();
      const photoSlot = canEdit ? (
        <label className={`inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer active:scale-95 transition-transform ${busy ? "opacity-60 pointer-events-none" : ""}`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {busy ? t("adding") : t("photo")}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPlacePhotos(pin, e.target.files); e.currentTarget.value = ""; }} />
        </label>
      ) : null;
      return (
        <div className="space-y-3 mt-1">
          {/* Moja notka: kompaktowo (+ Dodaj notkę / Edytuj) + guzik zdjecia obok. Auto-zapis. */}
          {/* Awatar przy WLASNEJ notce dopiero we wspomnieniu (po publikacji) - w trakcie wyjazdu
              autor jest oczywisty, a awatar dokladal szumu przy pisaniu (prosba Nat 2026-08-30). */}
          {canEdit && (
            <PlaceNoteEditor note={myNote} showAvatar avatarUrl={myAvatar} onSave={(v) => saveMyNote(pin, v)} photoSlot={photoSlot} onEditingChange={setNoteEditing} />
          )}
          {/* Notki innych uczestnikow - awatar + tresc, BEZ headera (task 6). Widz spoza wyjazdu
              nie ma edytora, wiec jego notki nie ma czego wykluczac - pokazujemy wszystkie. */}
          <PlaceNotes notes={list} excludeUserId={canEdit ? user?.id : undefined} />
          {/* Werdykt o miejscu - jeden tap zamiast pisania (prosba Nat 2026-08-30). pins.tags,
              wiec trafia tez do wspomnienia i eksploracji. */}
          {canEdit && (
            <div className="flex flex-wrap gap-1.5">
              {PLACE_VERDICT_TAGS.map((v) => {
                // MOJ werdykt (pin_ratings.verdict). Legacy: werdykt zapisany starym buildem siedzi
                // w pins.tags jako polska etykieta - podswietlamy go, dopoki user nie wybierze na nowo.
                const on = myVerdict ? myVerdict === v.id
                  : (pinTags[pin.id] ?? []).some((t) => verdictOf(t)?.id === v.id);
                return (
                  <button key={v.id} type="button" onClick={() => saveMyVerdict(pin, on ? null : v.id)}
                    className={`px-2.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors active:scale-[0.97] ${on ? "bg-[#FDF184] border-[#FDCD84] text-foreground" : "bg-white text-foreground border-border/60"}`}>
                    {localizeTag(v.id, i18n.language)}
                  </button>
                );
              })}
            </div>
          )}
          {/* Zdjecia miejsca (2:3) - awatar autora (dol-lewo) + usun (autor lub wlasciciel). */}
          {placePhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {placePhotos.map((ph) => (
                <div key={ph.id} className="relative w-[84px] aspect-[2/3] shrink-0 rounded-xl overflow-hidden bg-muted">
                  {/* Klik w zdjecie = pelnoekranowy podglad (zgloszenie Nat 2026-08-29). */}
                  {/* Kafelek 84 px -> miniatura, nie oryginal (1-3 MB na sztuke zabijalo
                      ladowanie zdjec przy miejscu). Podglad ponizej dalej bierze pelny plik. */}
                  <StoredImage
                    url={ph.url} size={84}
                    role="button"
                    onClick={() => setPinPhotoViewer({
                      urls: placePhotos.map((x) => resolveStored(x.url) ?? x.url),
                      idx: placePhotos.findIndex((x) => x.id === ph.id),
                    })}
                    className="w-full h-full object-cover active:opacity-90 transition-opacity"
                  />
                  <img src={avatarSrc(ph.avatar_url)} alt="" title={ph.username ?? undefined} className="absolute bottom-1 left-1 h-7 w-7 rounded-full object-cover border-2 border-white shadow-sm bg-secondary" />
                  {(ph.user_id === user?.id || isOwner) && <button onClick={() => removePlacePhoto(ph.id)} aria-label={t("aria.delete_photo")} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90"><X className="h-3 w-3" /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return undefined;
  };
  const rowPinFor = (pin: any) => (coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin);

  // Grupowanie miejsc po kategorii (subcat). Naglowki: nazwa (plural) + liczba "Propozycje" na etapie
  // planning; same nazwy pozniej (ongoing/wspomnienie). Kolejnosc grup wg SUBCAT_ORDER. (Figma 2026-08-27)
  const groupedPins: [string, any[]][] = (() => {
    const map = new Map<string, any[]>();
    for (const pin of visiblePins) {
      const key = pin.category || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pin);
    }
    const rank = (cat: string) => { const i = SUBCAT_ORDER.indexOf(cat); return i === -1 ? 999 : i; };
    return Array.from(map.entries()).sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  })();
  const groupHeaderLabel = (cat: string) => (cat === "other" ? "Inne" : subcategoryPluralLabel(cat));
  const proposalWord = (n: number) => {
    if (n === 1) return "Propozycja";
    const u = n % 10, h = n % 100;
    return u >= 2 && u <= 4 && !(h >= 12 && h <= 14) ? "Propozycje" : "Propozycji";
  };
  const toggleCat = (cat: string) => setCollapsedCats((prev) => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  // Reorder w obrebie grupy -> odbuduj pelna liste (grupy w kolejnosci wyswietlania) i persist pin_order.
  // Haptyczny "tick" przy KAZDEJ zamianie miejsc - wiadomo, ze element wskoczyl na nowa pozycje
  // (prosba Nat 2026-08-30). Wolane z obu sciezek reorderu (plaska lista + grupy kategorii).
  const reorderTick = (next: any[], prev: any[]) => {
    if (next.length !== prev.length) return;
    for (let i = 0; i < next.length; i++) {
      if (next[i]?.id !== prev[i]?.id) { haptics.selection(); return; }
    }
  };

  const handleReorderGroup = (cat: string, newGroupOrder: any[]) => {
    handleReorderPins(groupedPins.flatMap(([c, ps]) => (c === cat ? newGroupOrder : ps)));
  };
  const renderCatHeader = (cat: string, count: number, collapsed: boolean) => (
    <button onClick={() => toggleCat(cat)} className="w-full flex items-center gap-2 pt-4 pb-2 text-left active:opacity-70 transition-opacity">
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-foreground leading-tight">{groupHeaderLabel(cat)}</p>
        {stage === "planning" && <p className="text-[13px] text-muted-foreground mt-0.5">{count} {proposalWord(count)}</p>}
      </div>
      <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} strokeWidth={2.25} />
    </button>
  );

  // Wiersze miejsc w podanej kolejnosci (edycja = drag, inaczej zwykla lista).
  // Wiersze miejsc. Uchwyty przeciagania POKAZUJEMY WYLACZNIE w trybie "Zmień kolejność miejsc"
  // (prosba Nat 2026-08-30) - domyslny widok jest do czytania i uzupelniania, nie do sortowania.
  // Wyjazd wielodniowy: naglowki "Dzien N" sa CZESCIA listy przeciagania (jako nieprzesuwalne
  // znaczniki), wiec miejsce przeciagniete pod inny naglowek zmienia dzien. Po kazdym reorderze
  // przeliczamy day_index z pozycji wzgledem naglowkow.
  // Znaczniki dni to STALE obiekty. Reorder.Group rozpoznaje elementy PO REFERENCJI, wiec gdy
  // marker powstawal na nowo przy kazdym renderze (a do tego osobno dla `values` i dla `map`),
  // biblioteka nie potrafila znalezc go w liscie wartosci - i miejsca nie dawaly sie przeciagnac
  // pod naglowek innego dnia (zgloszenie Nat 2026-09-09: "nie jestem w stanie przeniesc miejsca
  // do nowego dnia").
  const withDayMarkers = (list: any[]) => {
    const out: any[] = [];
    for (let d = 1; d <= dayCount; d++) {
      out.push(dayMarkerFor(d));
      out.push(...list.filter((p) => pinDay(p) === d));
    }
    return out;
  };
  const onReorderWithDays = (next: any[], persist: (pins: any[]) => void) => {
    let current = 1;
    const pinsOnly: any[] = [];
    let dayChanged = false;
    for (const item of next) {
      if (item.__day) { current = item.__day; continue; }
      if (pinDay(item) !== current) dayChanged = true;
      pinsOnly.push({ ...item, day_index: current });
    }
    // Przeniesienie do INNEGO DNIA to zmiana wieksza niz zwykla zamiana kolejnosci, wiec
    // dostaje mocniejsze potwierdzenie (prosba Nat 2026-09-09).
    if (dayChanged) haptics.success(); else haptics.selection();
    persist(pinsOnly);
  };

  const renderRows = (list: any[], onReorder: (next: any[]) => void) => {
    // JEDNA instancja listy z markerami - `values` i renderowane dzieci musza dostac te same
    // obiekty, inaczej Reorder.Group nie dopasuje elementu do wartosci.
    const decorated = hasDays ? withDayMarkers(list) : list;
    return (
    canEdit && reorderMode ? (
      hasDays ? (
        <Reorder.Group axis="y" values={decorated} onReorder={(next: any[]) => onReorderWithDays(next, onReorder)} as="div">
          {decorated.map((item: any, i: number) =>
            item.__day ? (
              <Reorder.Item as="div" key={item.id} value={item} dragListener={false} drag={false} transition={{ duration: 0 }}>
                <div className="pt-4 pb-2 flex items-center gap-2">
                  <p className="text-[15px] font-bold text-foreground">{dayLabel(item.__day)}</p>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              </Reorder.Item>
            ) : (
              <CompactSortableRow
                key={item.id} value={item} rowPin={rowPinFor(item)} index={i}
                categoryLabel={categoryLabel(item.category || "other")}
                dayBadge={hasDays && canEdit ? { label: t("days.nth", { n: pinDay(item) }), onCycle: () => movePinToNextDay(item) } : undefined}
              />
            )
          )}
        </Reorder.Group>
      ) : (
      <Reorder.Group axis="y" values={list} onReorder={onReorder} as="div">
        {list.map((pin: any, i: number) => (
          <CompactSortableRow
            key={pin.id} value={pin} rowPin={rowPinFor(pin)} index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
          />
        ))}
      </Reorder.Group>
      )
    ) : hasDays && activeDay !== null ? (
      // JEDEN DZIEN NARAZ (wariant A z Figmy). Bez naglowka "Dzien N" - chip nad lista juz to mowi,
      // a naglowek nad jedna lista bylby tylko powtorzeniem. `list` przychodzi juz przefiltrowana
      // po dniu (visiblePins), wiec tu tylko renderujemy - pusty dzien obsluguje renderList raz dla
      // calego dnia, zamiast wypisywac ten sam komunikat pod kazda kategoria.
      (() => {
        return (
          <div>
            {list.map((pin: any, i: number) => (
              <RoutePlaceRow
                key={pin.id} pin={rowPinFor(pin)} index={i}
                categoryLabel={categoryLabel(pin.category || "other")}
                onOpen={() => openDetail(pin)} onGoogle={() => openGooglePlace(pin)}
                onDelete={canEdit ? () => handleDeletePin(pin) : undefined}
                onSave={user ? () => toggleSaveBookmark(pin) : undefined} saved={isSaved(pin.place_name)}
            isTop={!!pin.is_top}
                /* Gwiazdka ("topka") tylko na wyjezdzie OPUBLIKOWANYM (prosba Nat 2026-09-10).
                   To wyroznienie dla CZYTAJACYCH - wskazanie, co z tego wyjazdu jest naprawde
                   warte odwiedzenia. Dopoki wyjazd jest roboczy, nie ma komu tego mowic. */
                onToggleTop={canEdit && isPublished ? () => void toggleTopPin(pin) : undefined}
                note={buildNote(pin)} cornerAvatar={addedByAvatar(pin)}
                selection={selectionFor(pin)}
              />
            ))}
          </div>
        );
      })()
    ) : (
      // "Wszystkie" = po prostu wszystkie miejsca: w propozycjach pogrupowane po KATEGORIACH
      // (grupuje renderList), pozniej plaska lista w kolejnosci trasy. BEZ naglowkow dni i dat
      // (prosba Nat 2026-09-01) - dni sa w chipach, a nagle daty w srodku listy tylko szumia.
      // Przypisywanie do dni odbywa sie w trybie t("reorder"), ktory naglowki dni ma.

      <div>
        {/* Gradacja (prosba Nat 2026-09-08): najpierw gwiazdka topki, potem werdykty od
            najmocniejszego ("Musisz odwiedzic!" -> "Warto wpasc" -> ...), na koncu miejsca bez
            werdyktu i jawne "nie warto". W obrebie tego samego stopnia zostaje kolejnosc trasy,
            wiec sortowanie niczego nie miesza tam, gdzie nikt nic nie oznaczyl. */}
        {(dayCount > 1
          ? [...list]
              .map((pin: any, i: number) => ({ pin, i }))
              .sort((a, b) =>
                (b.pin.is_top ? 1 : 0) - (a.pin.is_top ? 1 : 0)
                || verdictRank(a.pin.tags) - verdictRank(b.pin.tags)
                || a.i - b.i)
              .map((e) => e.pin)
          // Wyjazd JEDNODNIOWY: "Wszystkie" to jedyny widok i zarazem uklad tego dnia, ktory
          // user sam poukladal. Gradacja przestawialaby mu miejsca pod rekami (prosba Nat
          // 2026-09-08) - sortujemy tylko tam, gdzie lista scala kilka dni.
          : list
        ).map((pin: any, i: number) => (
          <RoutePlaceRow
            key={pin.id} pin={rowPinFor(pin)} index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
            onOpen={() => openDetail(pin)} onGoogle={() => openGooglePlace(pin)}
            onDelete={canEdit ? () => handleDeletePin(pin) : undefined}
            onSave={user ? () => toggleSaveBookmark(pin) : undefined} saved={isSaved(pin.place_name)}
            isTop={!!pin.is_top} onToggleTop={canEdit && isPublished ? () => void toggleTopPin(pin) : undefined}
            note={buildNote(pin)} cornerAvatar={addedByAvatar(pin)}
            selection={selectionFor(pin)}
          />
        ))}
      </div>
    )
    );
  };

  const renderList = () => {
    // Pusty DZIEN: miejsca w wyjezdzie sa, tylko nie w tym dniu. Jeden komunikat na cala liste
    // (nie pod kazda kategoria) - i od razu mowi, jak to naprawic.
    if (activeDay !== null && !visiblePins.length) {
      return (
        <p className="text-[13px] text-muted-foreground py-6 text-center px-4 leading-relaxed">
          {canEdit
            ? t("day.empty")
            : t("day.no_places")}
        </p>
      );
    }
    // Kategorie grupuja miejsca TYLKO na etapie propozycji (tam sluza do przegladania sugestii).
    // W trakcie wyjazdu i we wspomnieniu liczy sie KOLEJNOSC ustawiona przez usera (od punktu do
    // punktu), wiec lista jest plaska - bez naglowkow kategorii (decyzja Nat 2026-08-28).
    // Wyjatek: tryb t("reorder") przy wyjezdzie z dniami jest ZAWSZE plaski (z naglowkami
    // dni), tez w propozycjach - inaczej naglowki dni powtarzalyby sie w kazdej kategorii i nie
    // dalo by sie przeciagnac miejsca do innego dnia.
    if (stage !== "planning" || (reorderMode && hasDays)) return renderRows(visiblePins, handleReorderPins);
    return (
    <div>
      {groupedPins.map(([cat, groupPins]) => {
        const collapsed = collapsedCats.has(cat);
        return (
          <div key={cat}>
            {renderCatHeader(cat, groupPins.length, collapsed)}
            {/* Drag TYLKO w trybie "Zmień kolejność miejsc" - wtedy kolejnosc zmienia sie W OBREBIE
                kategorii. Domyslnie zwykle wiersze (notki, zdjecia, akcje). */}
            {!collapsed && renderRows(groupPins, (no: any[]) => handleReorderGroup(cat, no))}
          </div>
        );
      })}
    </div>
    );
  };

  // Odbiorca na WEBIE dostaje najpierw zapowiedz. "Zobacz wyjazd" odslania pelny widok - nie
  // wypycha do sklepu, bo tresc, po ktora przyszedl, jest tuz obok. Do sklepu prowadzi pasek
  // na gorze i to jest jego jedyne zadanie.
  if (isWeb && !previewOpened) {
    const strip = (pins as any[]).slice(0, 8);
    return (
      <div className="min-h-[100dvh] bg-spontaway-yellow flex flex-col max-w-lg mx-auto">
        <PreReleaseBanner />
        <div className="flex-1 flex flex-col items-center px-5 pt-6 pb-8">
          {/* DOKLADNIE ta sama karta, co w eksploracji i w podgladzie udostepniania - autor
              wysylajac widzi to, co zobaczy odbiorca. Wczesniej byla tu osobna, uproszczona
              wersja: inna okladka, bez tagow i awatarow (prosba Nat 2026-09-08). */}
          <div className="w-full max-w-[340px]">
            <TrasaBigCard
              id={route.id}
              photo={cover}
              city={route.city}
              placeCount={(pins as any[]).length}
              title={route.title || cityLabel}
              tags={cardTags}
              pins={cardMapPins}
              onOpen={() => setPreviewOpened(true)}
              authorName={author?.username ? `@${author.username}` : authorName}
              authorAvatar={(author as any)?.avatar_url ?? null}
              participants={(groupParticipants as any[]).map((p) => p.avatar_url ?? null)}
              snap={false}
              heightClass="h-[520px]"
            />
          </div>

          {/* Pierwsze przystanki - to one mowia, co jest w srodku. */}
          {strip.length > 0 && (
            <div className="mt-7 w-full">
              <div className="flex items-center gap-2 pb-2">
                <span className="h-4 w-[3px] rounded-full bg-spontaway-orange" />
                <p className="font-brand text-[15px] leading-none text-spontaway-orange">{t("share.first_day")}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {strip.map((pin: any, i: number) => (
                  <div key={pin.id} className="flex w-[264px] shrink-0 items-center gap-3 rounded-3xl bg-white px-3 py-3">
                    <div className="relative h-[80px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-[#fcede3]">
                      <PlacePhoto pin={rowPinFor(pin)} width={110} className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-[10px] bg-spontaway-orange px-1 text-[10px] font-black leading-none text-white">{i + 1}</span>
                    </div>
                    <div className="flex h-[80px] min-w-0 flex-1 flex-col justify-between py-0.5">
                      <p className="line-clamp-2 text-[14px] font-bold leading-[1.19] text-black">{pin.place_name}</p>
                      <div className="flex items-center justify-between gap-2">
                        {(() => {
                          const v = (Array.isArray(pin.tags) ? pin.tags : []).find((tg: string) => verdictOf(tg));
                          return v ? <span className="truncate rounded-full bg-spontaway-yellow px-2.5 py-1 text-[11px] font-medium text-spontaway-brown">{localizeTag(v)}</span> : <span />;
                        })()}
                        {pin.category && pin.category !== "other" && (
                          <span className="shrink-0 text-[11px] font-medium text-[#666]">{categoryLabel(pin.category)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setPreviewOpened(true)}
            className="mt-8 w-full max-w-[420px] rounded-full bg-spontaway-orange py-4 text-[17px] font-extrabold text-white active:scale-[0.98] transition-transform"
          >
            {t("preview.open_trip")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
      {/* Odbiorca linku na webie: skrot do wersji przedpremierowej (Figma 2026-09-08).
          Na natywce komponent sam sie nie renderuje. */}
      <PreReleaseBanner />

      {/* Czekajace zaproszenie (2026-09-08): decyzja NAD trescia, a nie w powiadomieniach -
          zgode wydaje sie widzac, na co konkretnie. Do potwierdzenia wyjazd nie pojawia sie
          w moich Wyjazdach, wiec ten pasek jest jedynym miejscem, gdzie mozna go przyjac. */}
      {pendingInvite && (
        <div className="shrink-0 bg-[#fcede3] px-5 py-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
          <p className="text-[15px] font-bold text-foreground">{t("invite.banner_title")}</p>
          <p className="text-[13px] text-foreground/70 mt-0.5 leading-snug">{t("invite.banner_desc")}</p>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => void respondToInvite(true)}
              className="flex-1 py-2.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform">
              {t("invite.accept")}
            </button>
            <button onClick={() => void respondToInvite(false)}
              className="px-4 py-2.5 rounded-2xl bg-white/70 text-foreground font-bold text-sm active:scale-[0.98] transition-transform">
              {t("invite.decline")}
            </button>
          </div>
        </div>
      )}

      {/* Staly TopBar (naglowek nad obszarem scrolla): wstecz + autor + uczestnicy + miasto + liczba miejsc + serce */}
      <div className="shrink-0 bg-background" style={pendingInvite ? { paddingTop: 12 } : { paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <div className="flex items-center gap-2 text-sm px-5 pb-2.5">
            <button onClick={() => goBackOr(navigate, "/eksploruj")} aria-label={t("back")}
              className="h-9 w-9 -ml-2 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            {/* Awatar + username WYSRODKOWANE (#5). Wspolny wyjazd: host + pierwsi 2 uczestnicy z
                PELNA nazwa (awatar + @username, truncate = "jesli sie zmiesci"); reszta = same awatary. */}
            <div className="flex-1 min-w-0 flex justify-center items-center gap-2.5">
              {/* Uzytkownik 1 = host */}
              {!isAnon && author?.username ? (
                <button
                  onClick={() => navigate(`/profil/${author.username}`)}
                  className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity min-w-0 shrink"
                >
                  <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />
                  <span className="truncate">@{author.username}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-foreground min-w-0 shrink">
                  {!isAnon && <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />}
                  <span className="truncate">{authorName}</span>
                </span>
              )}
              {/* Uzytkownicy 2-3 = pierwsi uczestnicy z pelna nazwa (awatar + @username). */}
              {groupParticipants.slice(0, 2).map((p) => (
                p.username ? (
                  <button key={p.id} onClick={() => navigate(`/profil/${p.username}`)} className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity min-w-0 shrink">
                    <img src={avatarSrc(p.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />
                    <span className="truncate">@{p.username}</span>
                  </button>
                ) : (
                  <img key={p.id} src={avatarSrc(p.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />
                )
              ))}
              {/* Pozostali uczestnicy (4+) = same awatary (nachodzacy stack) + "+N". */}
              {groupParticipants.length > 2 && (
                <span className="flex items-center -space-x-2 shrink-0">
                  {groupParticipants.slice(2, 5).map((p) => (
                    <img key={p.id} src={avatarSrc(p.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 ring-2 ring-background" />
                  ))}
                  {groupParticipants.length > 5 && (
                    <span className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] font-bold text-foreground">+{groupParticipants.length - 5}</span>
                  )}
                </span>
              )}
            </div>
            {/* Serce polubienia wyjazdu (prawy skraj) - TYLKO gosc. Wlasciciel: spacer dla symetrii. */}
            {!isOwner ? (
              <button onClick={toggleLike} aria-label={t("aria.like_trip")} className="shrink-0 flex items-center gap-1 active:scale-90 transition-transform">
                <Heart className={cn("h-5 w-5", routeLike.liked ? "fill-red-500 text-red-500" : "text-foreground/70")} />
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{routeLike.count}</span>
              </button>
            ) : (
              <div className="w-7 shrink-0" />
            )}
          </div>
      </div>

      {/* Obszar scrolla - #1: BEZ okladki tla trasy (okladka TYLKO w eksploracji). */}
      {/* Zapas na dole = ponad ZWINIETY stos akcji (84px + 56px wysokosci = 140px). Po
          schowaniu czatu i "+" pod jeden guzik (2026-09-10) nie trzeba juz rezerwowac miejsca
          na dwa kolka; rozwiniety stos to nakladka z tlem do zamkniecia, wiec moze zaslaniac. */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-[calc(10rem+env(safe-area-inset-bottom,0px))]">
        {/* Naglowek: tytul + opis, spacing 35px pod TopBarem */}
        <div className="px-5 pt-[35px]">
          <div className="flex items-start gap-3">
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={() => void saveRouteName()}
                onKeyDown={(e) => { if (e.key === "Enter") void saveRouteName(); if (e.key === "Escape") setEditingName(false); }}
                maxLength={80}
                aria-label={t("aria.rename_trip")}
                className="flex-1 min-w-0 text-2xl font-black text-foreground leading-tight bg-transparent border-b-2 border-primary outline-none"
              />
            ) : (
              <h1 className="flex-1 text-2xl font-black text-foreground leading-tight">{route.title || cityLabel}</h1>
            )}
            {/* Grupa ikon. Udostepnianie widzi KAZDY (spojnie z listami, prosba Nat 2026-09-01) -
                gosc ogladajacy cudzy wyjazd tez ma go czym poslac dalej. Reszta zostaje przy
                wlascicielu / uczestniku. */}
            <div className="shrink-0 flex items-center gap-2">
                {/* Olowek = zmiana NAZWY wyjazdu. Stoi PIERWSZY (prosba Nat 2026-09-10, zamiana
                    miejscami z zaproszeniem): nazwa nie powstaje juz w kreatorze, wiec zmiana
                    nazwy jest tu czynnoscia czestsza niz dopraszanie ludzi. Ten widok dalej JEST
                    edycja reszty (miejsca, notki, zdjecia, opis, tagi) - stepper sie nie otwiera. */}
                {canEdit && (
                  <button
                    onClick={() => { haptics.light(); setNameVal(route.title || ""); setEditingName(true); }}
                    aria-label={t("aria.rename_trip")}
                    disabled={savingName}
                    className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4 text-foreground" />
                  </button>
                )}
                <button onClick={handleShare} onContextMenu={(e) => { e.preventDefault(); handleShareLink(); }} aria-label={t("aria.share")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Share2 className="h-4 w-4 text-foreground" /></button>
                {/* Zapraszanie uczestnikow PRZYWROCONE (prosba Nat 2026-09-06, cofa decyzje
                    z 2026-08-30): sklad da sie uzupelnic takze PO fakcie, czyli na juz
                    opublikowanym wyjezdzie. Tylko HOST: inviteUsersToRoute idzie przez
                    host-only RPC add_member_to_session. */}
                {isOwner && (
                  <button onClick={() => { haptics.light(); setInviteOpen(true); }}
                    aria-label={t("aria.invite_people")}
                    className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform">
                    <UserPlus className="h-4 w-4 text-foreground" />
                  </button>
                )}
                {isOwner && <button onClick={() => setAskDelete(true)} aria-label={t("aria.delete_trip")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>}
            </div>
          </div>
          {/* #5: miasto + liczba miejsc bezposrednio pod tytulem (przeniesione z TopBara). */}
          <div className="flex items-center gap-4 mt-2.5 text-sm text-muted-foreground">
            {cityLabel && <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 shrink-0" />{cityLabel}</span>}
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" />{pins.length} {pins.length === 1 ? "miejsce" : pins.length < 5 ? "miejsca" : "miejsc"}</span>
          </div>
          {/* Daty wyjazdu: wlasciciel moze je ustawic/zmienic (zakres wlacza podzial na dni). */}
          {dateLabel ? (
            isOwner ? (
              <button onClick={() => setDatesSheetOpen(true)} className="flex items-center gap-1.5 mt-2.5 text-foreground active:opacity-60 transition-opacity">
                <CalendarIcon className="h-5 w-5 shrink-0" />
                <span className="text-base">{dateLabel}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 mt-2.5 text-foreground">
                <CalendarIcon className="h-5 w-5 shrink-0" />
                <span className="text-base">{dateLabel}</span>
              </div>
            )
          ) : isOwner ? (
            <button onClick={() => setDatesSheetOpen(true)} className="flex items-center gap-1.5 mt-2.5 text-muted-foreground active:opacity-60 transition-opacity">
              <CalendarIcon className="h-5 w-5 shrink-0" />
              <span className="text-base">{t("aria.add_dates")}</span>
            </button>
          ) : null}
          {route.ai_highlight && (
            <p className="text-[17px] font-bold leading-snug text-foreground mt-3">„{route.ai_highlight}"</p>
          )}
          {routeDescription && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">{routeDescription}</p>
          )}
          {/* Tagi CALEJ TRASY usuniete (prosba Nat 2026-08-31) - widok wyjazdu ma byc czysty.
              Zostaja tylko werdykty przy KONKRETNYCH miejscach (pins.tags). */}
          {(shareMeta?.tagged_members?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-xs text-muted-foreground">{t("with_prefix")}</span>
              {shareMeta!.tagged_members!.map((m) => (
                <span key={m} className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-xs font-semibold">{m}</span>
              ))}
            </div>
          )}
        </div>

        {/* MOJ OPIS WYJAZDU - stoi PRZY opisie glownym, nie pod zakladkami (prosba Nat
            2026-09-09): guzik edytowal tresc, ktora byla kilka sekcji wyzej, wiec zwiazek
            miedzy nimi nie byl widoczny. Kazdy uczestnik ma swoj, u siebie na gorze
            (prosba Nat 2026-09-01). Notki pozostalych ida pod nia, tym samym szarym dymkiem z awatarem
            co notki przy miejscach. Nie mylic z t("trip_description") - tamten pisze host i idzie
            z wyjazdem do eksploracji. */}
        {/* Na etapie PROPOZYCJI notki nie ma - wyjazd dopiero powstaje, nie ma jeszcze o czym
            pisac (prosba Nat 2026-09-01). Wchodzi od "w trakcie". */}
        {stage !== "planning" && (canEdit || (memberNotes as any[]).length > 0) && !choosing && (
          <div className="mt-3 mb-5 px-5">
            {/* WLASCICIEL edytuje tu OPIS WYJAZDU - dokladnie te tresc, ktora widac nad guzikiem.
                UCZESTNIK nie ma prawa zapisu do `routes`, wiec u niego zostaje jego WLASNA notka
                (i copy mowi "notka", bo to co innego niz opis calego wyjazdu). */}
            {isOwner ? (
              <PlaceNoteEditor
                note={routeDescription}
                hideText
                placeholder={t("desc.placeholder")}
                addLabel={t("route:note.add_description")}
                editLabel={t("route:note.edit_description")}
                onSave={saveTripDescription}
                onEditingChange={setNoteEditing}
              />
            ) : canEdit ? (
              <PlaceNoteEditor
                note={myTripNote}
                showAvatar
                avatarUrl={myAvatar}
                placeholder={t("note.placeholder")}
                onSave={saveMyTripNote}
                onEditingChange={setNoteEditing}
              />
            ) : null}
            {(memberNotes as any[]).filter((n) => n.user_id !== user?.id).length > 0 && (
              <div className="space-y-3 mt-3">
                {(memberNotes as any[]).filter((n) => n.user_id !== user?.id).map((n) => (
                  <div key={n.user_id} className="relative bg-muted/50 rounded-2xl px-3.5 py-2.5">
                    <p className="text-[13.5px] text-foreground/85 leading-snug whitespace-pre-wrap break-words">{n.note}</p>
                    <img src={avatarSrc(n.avatar_url)} alt={n.username ?? ""} title={n.username ?? undefined}
                      className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full object-cover border-2 border-white shadow-sm bg-secondary" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Zakladki wracaja POD opis wyjazdu - dzialaja tam jak divider miedzy naglowkiem
            a trescia (prosba Nat 2026-09-01). Zeby nie uciekaly przy przewijaniu, sa sticky
            do gornej krawedzi obszaru scrolla. Chipy dni przyklejaja sie tuz pod nimi. */}
        <div className="sticky top-0 z-30 bg-background pt-5">
          <div className="flex border-b border-border/60">
            {/* Etap PROPOZYCJI (planning) = tylko Miejsca + Mapa (galeria bez sensu przy sugerowaniu).
                Galeria pojawia sie od "w trakcie" (ongoing) - prosba Nat 2026-08-25. */}
            {([
              { k: "miejsca" as const, Icon: MapPin, label: t("tabs.places") },
              ...(stage !== "planning" ? [{ k: "galeria" as const, Icon: ImageIcon, label: t("tabs.gallery") }] : []),
              { k: "mapa" as const, Icon: MapIcon, label: t("tabs.map") },
            ]).map(({ k, Icon, label }) => {
              const on = planTab === k;
              return (
                <button key={k} onClick={() => setPlanTab(k)} aria-label={label}
                  className="flex-1 flex items-center justify-center py-3 relative active:opacity-70 transition-opacity">
                  <Icon className={cn("h-5 w-5", on ? "text-foreground" : "text-muted-foreground/60")} strokeWidth={on ? 2.4 : 2} />
                  {on && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tresc zakladek - swipe w bok przelacza Miejsca / Galeria / Mapa. */}
        <div {...swipeTabs}>
        {planTab === "miejsca" ? (
          <div className="px-5 pt-4">
            {/* PRZELACZNIK DNI (wariant A z Figmy, sekcja "Wyjazd wielodniowy" 2026-09-01).
                Przypiety pasek chipow: jeden dzien naraz zamiast wszystkich dni w jednym,
                niekonczacym sie scrollu. Chip "Wszystkie" wraca do pelnej listy z naglowkami dni -
                i to tam przenosi sie miejsca miedzy dniami. Data pod nazwa daje kontekst bez
                otwierania kalendarza; pasek przewija sie w bok, wiec skaluje sie do kilkunastu dni. */}
            {/* W trybie t("reorder") chipow NIE ma: tam widac caly wyjazd, bo o to chodzi -
                przeciagniecie miejsca pod naglowek innego dnia zmienia mu dzien. */}
            {/* top-65px = dokladna wysokosc paska zakladek wyzej (pt-5 = 20 + guzik py-3 z ikona
                h-5 = 44 + kreska 1). Bylo 45px, wiec chipy wjezdzaly POD zakladki i ucinaly sie
                od gory przy przewijaniu (zgloszenie Nat 2026-09-09). */}
            {daysUsable && !choosing && !reorderMode && (
              <div className="sticky top-[65px] z-20 -mx-5 bg-background border-b border-border/50">
                <div className="flex gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
                  {[null, ...Array.from({ length: dayCount }, (_, i) => i + 1)].map((d) => {
                    const on = activeDay === d;
                    const count = d === null ? pins.length : (pins as any[]).filter((p) => pinDay(p) === d).length;
                    return (
                      <button
                        key={d ?? "all"}
                        onClick={() => pickDay(d)}
                        className={`shrink-0 rounded-full px-3.5 py-2 flex flex-col items-center leading-tight transition-colors active:scale-95 ${on ? "bg-primary text-white" : "bg-secondary text-foreground"}`}
                      >
                        <span className="text-sm font-semibold">{d === null ? t("days.all") : t("days.nth", { n: d })}</span>
                        <span className={`text-[11px] ${on ? "text-white/85" : "text-muted-foreground"}`}>
                          {d === null ? `${count} ${placeWord(count)}` : dayChipDate(d)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {choosing ? (
              /* Tryb t("choose_places"): zaznacz ktore miejsca wchodza do wyjazdu (reszta usunieta). */
              <div className="space-y-2">
                <p className="text-[13px] text-muted-foreground pb-1">{t("choose_places_desc")}</p>
                {(pins as any[]).map((pin) => (
                  <button key={pin.id} onClick={() => toggleChosen(pin.id)} className="w-full flex items-center gap-3 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5 text-left active:opacity-80 transition-opacity">
                    <PlacePhoto pin={pin} width={56} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-foreground truncate">{pin.place_name}</span>
                    {/* Liczba glosow - pomaga hostowi zdecydowac */}
                    {(() => {
                      const c = (votesMap as Map<string, { count: number }>).get(placeVoteKey(pin.place_name))?.count ?? 0;
                      if (c === 0) return null;
                      return <span className="shrink-0 inline-flex items-center rounded-full bg-white text-foreground px-2.5 py-0.5 text-[12px] font-bold">{t("votes", { count: c })}</span>;
                    })()}
                    <span className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${chosen.has(pin.id) ? "bg-primary text-primary-foreground" : "border-2 border-border"}`}>{chosen.has(pin.id) && <Check className="h-4 w-4 stroke-[3]" />}</span>
                  </button>
                ))}
              </div>
            ) : pins.length > 0 ? (
              /* Jeden widok miejsc (lista). Przelacznik "karty" usuniety 2026-08-29 - duze
                 karty duplikowaly liste i rozbijaly kolejnosc od-do. */
              renderList()
            ) : (
              <EmptyPlacesState
                title={t("empty.title")}
                hint={canEdit ? t("empty.hint_owner") : t("empty.hint_guest")}
              />
            )}
          </div>
        ) : planTab === "mapa" ? (
          /* Mapa w wlasnej zakladce (obok Galeria) - statyczna Google + rozwiniecie do interaktywnej. */
          <div className="px-5 pt-4">
            {mapPlaces.length > 0 ? (
              /* Mapa wypelnia CALA pozostala wysokosc zakladki (prosba Nat 2026-09-01) - wczesniej
                 byl kadr 256 px, w ktorym przy kilkunastu miejscach nie dalo sie niczego odczytac.
                 Wysokosc liczona z dvh minus chrome (naglowek + zakladki + dolny pasek), bo
                 wysokosc procentowa nie dziala w tym drzewie flexow w iOS WebView. */
              /* JEDNA mapa w calej aplikacji: ten sam RouteMap co po rozwinieciu, wiec markery sa
                 identyczne - peachowe OKREGI Z NUMERAMI zamiast kropelek Google (prosba Nat
                 2026-09-01). Wczesniej byl tu obrazek ze Static Maps, ktory rysowal wlasne piny
                 i widok PRZED nie zgadzal sie z widokiem PO. Mapa jest nieklikalna
                 (pointer-events-none), a tap w nakladke rozwija ja na pelny ekran. */
              <div data-no-swipe className="relative w-full rounded-2xl overflow-hidden border border-border/40 bg-muted"
                style={{ height: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 250px)", minHeight: "300px" }}>
                <div className="absolute inset-0 pointer-events-none">
                  <RouteMap pins={mapPlaces as any} className="w-full h-full" showRoute={false} />
                </div>
                <button onClick={() => setPlanMapOpen(true)} aria-label={t("aria.expand_map")} className="absolute inset-0 active:opacity-95 transition-opacity" />
                <span className="absolute top-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center pointer-events-none">
                  <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
                </span>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-10">{t("map_no_locations")}</p>
            )}
          </div>
        ) : (
          <div className="px-5 pt-4">
            {galleryPhotos.length > 0 ? (
              /* Uklad masonry (jak Pinterest, prosba Nat 2026-08-30): zdjecia w NATURALNYCH
                 proporcjach, dwie kolumny CSS, bez podpisow. Na kafelku tylko ikona wyboru
                 okladki; usuwanie przeniesione do podgladu pelnoekranowego. */
              <div className="columns-2 gap-2 [&>*]:mb-2">
                {canAddPhotos && (
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}
                    className="flex w-full break-inside-avoid aspect-[4/3] rounded-2xl border-2 border-dashed border-border flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-[0.98] transition-transform disabled:opacity-60">
                    {uploadingPhotos ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        {/* Licznik zamiast samego kolka: przy paczce z iPhone'a czekanie
                            liczy sie w dziesiatkach sekund i bez niego wyglada jak zawieszenie. */}
                        {photoProgress && photoProgress.total > 1 && (
                          <span className="text-xs font-semibold tabular-nums">{t("photo_progress", { done: photoProgress.done, total: photoProgress.total })}</span>
                        )}
                      </>
                    ) : <><Plus className="h-6 w-6" /><span className="text-xs font-semibold">{t("add_photo")}</span></>}
                  </button>
                )}
                {galleryPhotos.map((url, i) => {
                  // Zaznaczone = MOJA okladka (to nia steruje ikona). U hosta pokrywa sie z okladka
                  // eksploracji, bo jeden gest ustawia obie.
                  const isCover = (resolveStored(myCover) ?? null) === url || (isOwner && !myCover && (route as any).list_cover_url === url);
                  return (
                    <div key={i} onClick={() => setViewerIndex(i)} role="button"
                      className={`relative break-inside-avoid rounded-2xl overflow-hidden bg-muted active:opacity-90 transition-opacity cursor-pointer ${isCover ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                      {/* Siatka masonry ma ~180 px na kolumne - pobieramy miniature, nie oryginal.
                          Podglad pelnoekranowy nizej zostaje przy pelnej rozdzielczosci. */}
                      <StoredImage url={url} size={200} className="w-full h-auto block" />
                      {/* Licznik polubien (gdy sa) - siatka zostaje czysta, lajkuje sie w podgladzie. */}
                      {likeStateOf(url).count > 0 && (
                        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Heart className={`h-3 w-3 ${likeStateOf(url).liked ? "fill-red-500 text-red-500" : "text-white"}`} />
                          {likeStateOf(url).count}
                        </span>
                      )}
                      {/* Ikona eksploracji = "to jest okladka TEGO wyjazdu u mnie". Widzi ja KAZDY
                          uczestnik, nie tylko host (zgloszenie Nat 2026-09-01) - wczesniej byla
                          za `isOwner`, wiec uczestnik nie mial jak wybrac okladki swojej karty
                          wyjazdu na profilu. Kazdy ustawia WLASNA (route_member_covers), nie rusza
                          cudzych; u hosta ten sam gest ustawia dodatkowo okladke w eksploracji,
                          bo jego wybor jest twarza wyjazdu na zewnatrz. */}
                      {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); void setCoverFromGallery(url); }}
                          aria-label={isCover ? t("aria.is_my_cover") : t("aria.set_my_cover")}
                          className={`absolute top-1.5 right-1.5 h-8 w-8 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform ${isCover ? "bg-primary" : "bg-white/90"}`}>
                          {/* Ikona EKSPLORACJI (ta sama co w nawigacji) - mowi wprost, do czego sluzy
                              to zdjecie: reprezentuje wyjazd w eksploracji. Aktywna = biala na
                              pomaranczu (filtr, bo to zwykly SVG bez currentColor). */}
                          <img src="/Ikona_Eksploracja.svg" alt="" className="h-4 w-4"
                            style={isCover ? { filter: "brightness(0) invert(1)" } : undefined} />
                        </button>
                      )}
                      {/* Wybor WLASNEJ okladki przeniesiony do jednego guzika w naglowku
                          (ikona galerii) - prosba Nat 2026-09-01. Ikona przy kazdym zdjeciu robila
                          z tego drugi, konkurencyjny mechanizm. Gwiazdka (okladka eksploracji, host)
                          zostaje, bo to inna decyzja i inny odbiorca. */}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("gallery_empty")}</p>
                {canAddPhotos && (
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}
                    className="mt-1 px-4 py-2.5 rounded-full border border-border text-foreground font-bold text-sm flex items-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
                    {uploadingPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
                    {uploadingPhotos && photoProgress && photoProgress.total > 1
                      ? t("photo_progress", { done: photoProgress.done, total: photoProgress.total })
                      : t("add_photo_cta")}
                  </button>
                )}
              </div>
            )}

          </div>
        )}
        </div>

        {/* Zgloszenie tresci - wymog App Store (Guideline 1.2). Autor/uczestnik nie zglasza siebie. */}
        {!canEdit && (
          <div className="px-5 pt-6 pb-2 flex justify-center">
            <ReportContentSheet targetType="route" targetId={route.id} />
          </div>
        )}
      </div>

      {/* Podglad wizytowki miejsca */}
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => !o && setDetailPin(null)}
        place={detailPin}
        city={route.city}
        onLike={user && detailPin ? () => setSavePlace(pinToSave(detailPin)) : undefined}
      />

      {/* Zapis miejsca do listy (odwiedzone / do odwiedzenia) - bookmark przy wierszu miejsca */}
      <SavePlaceSheet
        open={!!savePlace}
        onOpenChange={(o) => { if (!o) setSavePlace(null); }}
        place={savePlace}
        city={route.city ?? ""}
      />

      {/* Editor (wlasciciel/uczestnik): dodaj nowe miejsce (zapisane + wyszukiwarka Google) do tej trasy */}
      {canEdit && (
        <AddPlaceSheet
          open={addPlaceOpen}
          onClose={() => setAddPlaceOpen(false)}
          city={route.city ?? null}
          countries={scopeCountries(route)}
          existingPlaces={pins.map((p: any) => ({
            place_name: p.place_name, category: p.category ?? null, address: p.address ?? null, description: p.description ?? null,
            latitude: p.latitude ?? null, longitude: p.longitude ?? null, photo_url: p.photo_url ?? null, place_id: p.place_id ?? null,
            google_place_id: p.google_place_id ?? null, rating: p.rating ?? null,
          }))}
          onAdd={handleAddPlaces}
        />
      )}

      {/* "Dodaj do wyjazdu" - wybor wlasnego szkicu docelowego. */}
      <Sheet open={pickTargetOpen} onOpenChange={(o) => { if (!o) setPickTargetOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pt-5 pb-[max(16px,env(safe-area-inset-bottom))] max-h-[76dvh] flex flex-col">
          <SheetTitle className="px-5 text-lg font-black">{t("pick.sheet_title", { count: pickedIds.size })}</SheetTitle>
          <div className="flex-1 min-h-0 overflow-y-auto mt-3">
            {(myDraftTrips as any[]).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground leading-relaxed">{t("pick.no_drafts")}</p>
            ) : (
              (myDraftTrips as any[]).map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => void addPickedToTrip(tr.id, tr.title || scopeLabel(tr))}
                  disabled={pickBusy}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left active:bg-secondary/60 transition-colors disabled:opacity-50"
                >
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-[#fcede3] flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-[#BC4206]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground truncate">{tr.title || scopeLabel(tr) || t("trip_default")}</span>
                    {scopeLabel(tr) && <span className="block text-[12px] text-muted-foreground truncate">{scopeLabel(tr)}</span>}
                  </span>
                  <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {shareCardOpen && (
        <ShareCardTrip
          routeId={route.id}
          title={route.title || cityLabel}
          city={route.city}
          pins={pins as any[]}
          tags={cardTags}
          mapPins={cardMapPins}
          photoFor={coverFor}
          authorName={author?.username ? `@${author.username}` : authorName}
          authorAvatar={(author as any)?.avatar_url ?? null}
          participants={(groupParticipants as any[]).map((p) => p.avatar_url ?? null)}
          cover={(route as any).list_cover_url ?? heroPhoto}
          onClose={() => setShareCardOpen(false)}
          onShare={handleShareLink}
          shareUrl={buildShareUrl(`/route/${route.id}`)}
        />
      )}

      {/* Zaproszenie kolejnych uczestnikow - takze do wyjazdu juz opublikowanego. Po dodaniu
          odswiezamy skald grupy, zeby awatary w naglowku od razu sie zgadzaly. */}
      {isOwner && (
        <InviteFriendsSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          route={{ id: route.id, city: route.city ?? null, title: route.title ?? null, group_session_id: (route as any).group_session_id ?? null }}
          existingMemberIds={(sessionMembers as any[]).map((p) => p.id)}
          participants={sessionMembers as any[]}
          onRemove={async (uid) => {
            await removeParticipant(uid);
            void queryClient.invalidateQueries({ queryKey: ["shared-route-members-admin", (route as any).group_session_id] });
          }}
          onInvited={() => {
            void queryClient.invalidateQueries({ queryKey: ["shared-route-participants"] });
            void queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
          }}
        />
      )}

      {/* Wejscie do plikow trzymamy POZA zakladka galerii - plywajacy "+" korzysta z niego
          takze wtedy, gdy galeria nie jest jeszcze otwarta ani pusta. */}
      {canAddPhotos && (
        <input ref={photoInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
          onChange={(e) => { const files = Array.from(e.target.files ?? []); e.currentTarget.value = ""; if (files.length) void handleAddPhotos(files); }} />
      )}

      {/* Czat i "+" schowane pod JEDNYM guzikiem z chevronem (prosba Nat 2026-09-10), na
          KAZDYM etapie wyjazdu. Dwa kolka wiszace nad trescia zaslanialy ostatnie wiersze
          listy - stad jeden guzik w spoczynku. Nieprzeczytane wiadomosci wedruja na niego,
          zeby schowanie czatu nie schowalo tez sygnalu, ze ktos pisze.
          Chowamy caly stos przy wyborze miejsc i przy pisaniu notki - tam ekran nalezy do
          jednej czynnosci. */}
      {canEdit && !choosing && !noteEditing && (
        <TripFabStack
          actions={[
            ...(id ? [{
              key: "chat",
              label: t("chat.title"),
              icon: <MessageCircle className="h-6 w-6" strokeWidth={2.2} />,
              badge: unreadChat,
              onClick: () => setChatOpen(true),
            } as TripFab] : []),
            {
              // "+" znaczy "dodaj to, na co patrzysz" (prosba Nat 2026-09-08): w Miejscach
              // dodaje miejsce, w Galerii otwiera wybor zdjec.
              key: "add",
              label: planTab === "galeria" && canAddPhotos ? t("add_photo_cta") : t("add_place"),
              icon: <Plus className="h-6 w-6" strokeWidth={2.4} />,
              primary: true,
              onClick: () => {
                if (planTab === "galeria" && canAddPhotos) photoInputRef.current?.click();
                else setAddPlaceOpen(true);
              },
            },
          ]}
        />
      )}

      {canEdit && id && (
        <TripChatSheet open={chatOpen} onOpenChange={setChatOpen} routeId={id} tripTitle={route.title ?? cityLabel}
          participants={[
            { id: route.user_id, username: (author as any)?.username ?? null, avatar_url: (author as any)?.avatar_url ?? null },
            ...(groupParticipants as any[]),
          ]} />
      )}

      {/* Rozwinięta interaktywna mapa (zoom) - jak w widoku "Plan wyjazdu" */}
      {planMapOpen && (
        <div className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in duration-200">
          <div className="relative flex-1 min-h-0">
            <RouteMap pins={mapPlaces as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setPlanMapOpen(false)} aria-label={t("close")} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
            {/* WIZYTOWKI MIEJSC nad mapa (prosba Nat 2026-09-01): miniaturka z okladka (albo ikona
                kategorii na peachy tle), numer miejsca w wyjezdzie i awatar tego, kto je dodal.
                Przewijane w bok; tapniecie otwiera pelna wizytowke. */}
            {mapPlaces.length > 0 && (
              <div className="absolute left-0 right-0 z-10" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
                <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar">
                  {mapPlaces.map((p: any) => (
                    <button key={p.id} onClick={() => { setPlanMapOpen(false); openDetail(p); }}
                      className="shrink-0 w-[184px] rounded-2xl bg-card shadow-lg shadow-black/15 p-2.5 flex items-center gap-2.5 text-left active:scale-[0.98] transition-transform">
                      <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-[#fcede3] shrink-0">
                        <PlacePhoto pin={rowPinFor(p)} width={56} className="w-full h-full object-cover" />
                        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{p.__no}</span>
                        {addedByAvatar(p) !== undefined && (
                          <img src={avatarSrc(addedByAvatar(p))} alt="" className="absolute bottom-0.5 right-0.5 h-5 w-5 rounded-full object-cover border-2 border-white bg-secondary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-foreground">{p.place_name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{categoryLabel(p.category || "other")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Podglad zdjec dodanych do MIEJSCA (miniaturki w wierszu). */}
      {pinPhotoViewer && (
        <PhotoViewer urls={pinPhotoViewer.urls} startIndex={pinPhotoViewer.idx} onClose={() => setPinPhotoViewer(null)} />
      )}

      {/* Fullscreen podglad zdjecia galerii (object-contain, kropki paginacji + polubienie). */}
      {viewerIndex !== null && galleryPhotos[viewerIndex] && (
        <div {...swipeViewer} className="fixed inset-0 z-[95] bg-black flex items-center justify-center animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
          <img src={galleryPhotos[viewerIndex]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setViewerIndex(null)} aria-label={t("close")} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
            <X className="h-5 w-5 text-white" />
          </button>
          {/* Usuwanie zdjecia zeszlo z kafelka do podgladu - siatka ma byc czysta (bez podpisow
              i dodatkowych ikon), zostaje na niej tylko wybor okladki.
              Kosz widzi wlasciciel wyjazdu (odpowiada za cala galerie) ORAZ uczestnik przy
              WLASNYM zdjeciu - skoro moze je dodac, musi tez moc je zabrac. */}
          {(isOwner || (isGroupMember && isMyGalleryPhoto(galleryPhotos[viewerIndex]))) && (
            <button onClick={(e) => { e.stopPropagation(); void handleDeletePhoto(galleryPhotos[viewerIndex]); setViewerIndex(null); }}
              aria-label={t("aria.delete_photo")}
              className="absolute left-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <Trash2 className="h-5 w-5 text-white" />
            </button>
          )}
          {/* Polubienie zdjecia - lewy dolny rog, nad kropkami paginacji. */}
          {(() => {
            const url = galleryPhotos[viewerIndex];
            const st = likeStateOf(url);
            return (
              <button onClick={(e) => { e.stopPropagation(); void togglePhotoLikeUi(url); }}
                aria-label={st.liked ? t("aria.unlike_photo") : t("aria.like_photo")}
                className="absolute left-3 z-10 h-10 px-3 rounded-full bg-white/15 backdrop-blur-sm flex items-center gap-1.5 active:scale-90 transition-transform"
                style={{ bottom: "max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))" }}>
                <Heart className={`h-5 w-5 ${st.liked ? "fill-red-500 text-red-500" : "text-white"}`} />
                {st.count > 0 && <span className="text-white text-sm font-semibold">{st.count}</span>}
              </button>
            );
          })()}
          {/* Kropki zamiast strzalek - sugeruja przewijanie gestem (prosba Nat 2026-08-30). */}
          <PhotoPagination count={galleryPhotos.length} index={viewerIndex} />
        </div>
      )}

      {/* CTA: editor (wlasciciel LUB uczestnik wspolnego wyjazdu) = akcje etapu; gosc = pasek
          pojawia sie DOPIERO po zaznaczeniu miejsc (przytrzymanie kafelka).
          Ukryte na czas pisania notki - inaczej pasek siedzi nad klawiatura i zaslania pole. */}
      {!noteEditing && (canEdit || pickMode) && (
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-2 bg-background border-t border-border/30"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        {canEdit ? (
            choosing ? (
              /* Tryb wyboru miejsc (host) - potwierdzenie przejscia na "w trakcie". */
              <div className="flex items-center gap-2">
                <button onClick={() => setChoosing(false)} className="px-4 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">{t("common:buttons.cancel")}</button>
                <button onClick={confirmChoose} disabled={choosingBusy || chosen.size === 0}
                  className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-transform ${choosingBusy || chosen.size === 0 ? "bg-primary/40 text-white/80" : "bg-primary text-white active:scale-[0.98]"}`}>
                  {choosingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />} Zatwierdź{chosen.size ? ` (${chosen.size})` : ""}
                </button>
              </div>
            ) : (
              /* Tryb zmiany kolejnosci ma WLASNY, jednoguzikowy pasek - reszta akcji tylko
                 rozpraszalaby przy przeciaganiu. */
              reorderMode ? (
                <button onClick={() => { haptics.success(); setReorderMode(false); }}
                  className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <Check className="h-4 w-4 stroke-[3]" />{t("common:buttons.done")}</button>
              ) : (
              <div className="flex items-center gap-2">
                {/* t("add_place") przeniesione do plywajacego guzika pod czatem (prosba Nat
                    2026-08-30) - dolny pasek zostaje dla akcji etapu. */}
                {/* Obok publikacji zmiana kolejnosci jest akcja drugoplanowa (szary fill wg
                    CLAUDE.md), ale MUSI byc widoczna: samo #EDEDED na bialym pasku znikalo
                    i user zglosil, ze guzik "sie zgubil" - stad obwodka.
                    Szerokosc: zmiana kolejnosci sciesnia sie do tresci (shrink-0), a cala
                    reszte paska zabiera publikacja. Dwa guziki na flex-1 z nielamanym tekstem
                    nie mialy sie jak zmiescic na wezszych telefonach. */}
                {pins.length > 1 && (
                  <button onClick={() => { haptics.light(); pickDay(null); setReorderMode(true); }}
                    className={`px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] transition-transform ${
                      canPublish
                        ? "min-w-0 bg-secondary text-secondary-foreground border border-border"
                        : "flex-1 bg-primary text-white"}`}>
                    <GripVertical className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("reorder")}</span>
                  </button>
                )}
                {/* Etap PROPOZYCJI (host): wybierz miejsca -> w trakcie. */}
                {isOwner && stage === "planning" && pins.length > 0 && (
                  <button onClick={startChoosing}
                    className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                    <Check className="h-4 w-4 stroke-[3]" />{t("choose_places")}</button>
                )}
                {/* PUBLIKACJA jednym guzikiem. Opis, tagi i zdjecia powstaja juz w tym widoku -
                    stepper "podsumowania" zostal usuniety z flow.
                    Warunek to NIEOPUBLIKOWANY wyjazd, a nie sam etap "w trakcie": przeszly wyjazd
                    dostaje trip_type='completed' od razu przy zakladaniu, wiec z etapem "ongoing"
                    w warunku guzik w ogole sie nie pokazywal i roboczego wspomnienia nie dalo sie
                    opublikowac (zgloszenie usera 2026-09-06). */}
                {canPublish && (
                  <button onClick={handlePublish} disabled={publishing}
                    className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] transition-transform disabled:opacity-50">
                    {publishing && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    {publishing ? t("publishing") : t("publish_trip")}
                  </button>
                )}
              </div>
              )
            )
          ) : (
            /* Gosc: zaznaczone miejsca -> wlasny wyjazd. "Zapisz tą trasę" i "Zaplanuj własną
               trasę w {miasto}" usuniete (decyzja Nat 2026-09-10) - cudzy plan w calosci
               prawie nikomu nie pasowal, a przenoszenie POJEDYNCZYCH miejsc jest tym, po co
               ludzie tu wchodza. */
            <>
              <div className="flex items-center justify-between gap-2 pb-2">
                <p className="text-[13px] font-semibold text-foreground">
                  {t("pick.selected", { count: pickedIds.size })}
                </p>
                <button onClick={exitPick} className="text-[13px] font-medium text-muted-foreground active:text-foreground transition-colors">
                  {t("common:buttons.cancel")}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void createTripFromPicked()}
                  disabled={pickBusy || pickedIds.size === 0}
                  className="flex-1 min-w-0 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {pickBusy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  <span className="truncate">{t("pick.create_trip", { place: cityLabel })}</span>
                </button>
                <button
                  onClick={() => { haptics.light(); setPickTargetOpen(true); }}
                  disabled={pickBusy || pickedIds.size === 0}
                  className="shrink-0 px-4 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm whitespace-nowrap active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {t("pick.add_to_trip")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sheet wyboru daty wyjazdu przy zapisie cudzej trasy do dziennika */}
      {/* Wlasciciel: zakres dat wyjazdu. Zakres wielodniowy wlacza podzial miejsc na dni. */}
      <Sheet open={datesSheetOpen} onOpenChange={setDatesSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-[max(16px,env(safe-area-inset-bottom))] pt-5 max-h-[88dvh] overflow-y-auto">
          <SheetTitle className="sr-only">{t("trip_dates")}</SheetTitle>
          <div className="px-5 pb-1 text-center">
            <p className="text-lg font-black leading-tight">{t("pick_date")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("pick_date_desc")}</p>
          </div>
          <FullCalendarPicker maxDays={14} onConfirm={(d, numDays) => void saveTripDates(d, numDays)} allowPast onClear={route.start_date ? () => void clearTripDates() : undefined} />
        </SheetContent>
      </Sheet>

      {/* Potwierdzenie usuniecia wyjazdu - nieodwracalne. */}
      {/* Potwierdzenie usuniecia MIEJSCA (od etapu "w trakcie") - pokazuje, ile tresci przepadnie. */}
      <AlertDialog open={!!confirmDeletePin} onOpenChange={(o) => { if (!o) setConfirmDeletePin(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.delete_place_title", { place: confirmDeletePin?.place_name ?? t("confirm.this_place") })}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const notes = (notesMap.get(placeNoteKey(confirmDeletePin?.place_name ?? "")) ?? []).length;
                const photos = (photosMap.get(pinPhotoKey(confirmDeletePin?.place_name ?? "")) ?? []).length;
                const parts: string[] = [];
                if (notes) parts.push(t("confirm.notes", { count: notes }));
                if (photos) parts.push(t("confirm.photos", { count: photos }));
                return parts.length
                  ? t("confirm.place_gone_with", { parts: parts.join(t("confirm.and")) })
                  : t("confirm.place_gone_all");
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { const pin = confirmDeletePin; setConfirmDeletePin(null); if (pin) void deletePinNow(pin); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{t("aria.delete_place")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askDelete} onOpenChange={(o) => { if (!o && !deleting) setAskDelete(false); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.delete_trip")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.delete_trip_desc", { title: route.title || route.city || t("trip_fallback") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common:buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: uczestnicy bez dodanych miejsc -> przypomnienie (push) lub "wybierz mimo to" (prosba Nat). */}
      {missingParticipants && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setMissingParticipants(null)}>
          <div className="w-full max-w-sm bg-card rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold text-foreground">{t("confirm.not_everyone")}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {missingParticipants.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary pl-1 pr-3 py-1">
                  <img src={avatarSrc(m.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-white" />
                  <span className="text-[13px] font-semibold text-foreground">{m.username || "Uczestnik"}</span>
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{`${missingParticipants.length === 1 ? "Ta osoba nie dodała" : "Te osoby nie dodały"} jeszcze żadnego miejsca. Wysłać przypomnienie, czy wybrać mimo to?`}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={sendReminders} disabled={reminderBusy} className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60">{reminderBusy ? t("sending") : t("send_reminder")}</button>
              <button onClick={proceedToChoosing} className="w-full py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">{t("confirm.choose_anyway")}</button>
              <button onClick={() => setMissingParticipants(null)} className="w-full py-2 text-sm font-medium text-muted-foreground">{t("common:buttons.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
