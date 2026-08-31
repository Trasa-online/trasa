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
import { MapPin, ArrowLeft, Sparkles, ChevronDown, UserRound, Bookmark, Calendar as CalendarIcon, Image as ImageIcon, Maximize2, X, Building2, Pencil, Trash2, Heart, Share2, Plus, Map as MapIcon, Loader2, Star, GripVertical, Check, Flag, Camera, ThumbsUp, MessageCircle } from "lucide-react";
import { MAIN_CATEGORIES, subcategoryPluralLabel } from "@/lib/categories";
import { PLACE_VERDICT_TAGS } from "@/lib/routeTags";
import { publishTrip } from "@/lib/publishTrip";
import { haptics } from "@/hooks/useHaptics";
import { track } from "@/lib/analytics";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { Reorder, useDragControls, motion } from "framer-motion";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlacePhoto } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { fetchRouteNotesWithAuthors, notesByPlace, placeNoteKey } from "@/lib/placeNotes";
import { fetchPinPhotos, addPinPhoto, deletePinPhoto, photosByPlace, pinPhotoKey, type PinPhoto } from "@/lib/pinPhotos";
import { fetchPlaceVotes, toggleVote, placeVoteKey } from "@/lib/placeVotes";
import { fetchUnreadChatCount } from "@/lib/chatReads";
import PlaceNotes from "@/components/route/PlaceNotes";
import PhotoViewer from "@/components/route/PhotoViewer";
import PlaceNoteEditor from "@/components/route/PlaceNoteEditor";
import ScreenSkeleton from "@/components/layout/ScreenSkeleton";
import ReportContentSheet from "@/components/moderation/ReportContentSheet";
import { fetchRouteCoversFor, setMyRouteCover, clearMyRouteCover } from "@/lib/routeMemberCover";
import { moderateImageUrl, MODERATION_REJECTED_MESSAGE } from "@/lib/imageModeration";
import { EmptyPlacesState } from "@/components/route/EmptyPlacesState";
import AddPlaceSheet from "@/components/route/AddPlaceSheet";
import TripChatSheet from "@/components/route/TripChatSheet";
import { useShare } from "@/hooks/useShare";
import { useUnsavePlace } from "@/hooks/useUnsavePlace";
import { buildShareUrl } from "@/lib/shareUrl";
import { quickSavePlace, type PlaceForList } from "@/lib/placeLists";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import { fetchPhotoLikes, togglePhotoLike, type LikeState as PhotoLikeState } from "@/lib/placePhotoSocial";
import PhotoPagination from "@/components/route/PhotoPagination";
import RouteMap from "@/components/RouteMap";
import { API_BASE } from "@/lib/platform";
import { compressImage } from "@/lib/imageCompression";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Kolejnosc grup kategorii na widoku wyjazdu = kolejnosc podkategorii w MAIN_CATEGORIES
// (Jedzenie -> Kultura -> ...). Nieznane kategorie ida na koniec. Prosba Nat 2026-08-27 (Figma).
const SUBCAT_ORDER: string[] = MAIN_CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.id));

// Statyczna mapa trasy (Google przez proxy) - ujednolicona z widokiem "Plan wyjazdu".
// Pomaranczowo-peachy markery (#F0A583). Klik -> interaktywna RouteMap (pelny ekran).
function buildStaticRouteMap(pins: { latitude: number; longitude: number }[], size = "560x300"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!pts.length) return null;
  // Numerowane peachy piny (label 1-9; Google static przyjmuje 1 znak - dla 10+ bez numeru).
  const markers = pts.map((p, i) => {
    const label = i + 1 <= 9 ? `label:${i + 1}%7C` : "";
    return `markers=color:0xf0a583%7C${label}${p.latitude},${p.longitude}`;
  }).join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { resolveStored } from "@/components/PlacePhoto";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { CategoryIcon } from "@/components/CategoryIcon";

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
// Wiersz w TRYBIE ZMIANY KOLEJNOSCI: sam uchwyt + miniaturka + nazwa. Bez notek, zdjec i akcji -
// krotki wiersz mniej skacze pod palcem i widac kilka miejsc naraz (prosba Nat 2026-08-30).
function CompactSortableRow({ value, rowPin, index, categoryLabel }: {
  value: any; rowPin: any; index: number; categoryLabel: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} transition={{ duration: 0 }}>
      <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-b-0 bg-background">
        <span
          onPointerDown={(e) => controls.start(e)}
          aria-label="Przeciągnij, by zmienić kolejność"
          className="shrink-0 w-6 flex items-center justify-center text-muted-foreground/60 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <span className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-[#fcede3]">
          <PlacePhoto pin={rowPin} className="w-full h-full object-cover" />
          <span className="absolute top-0.5 left-0.5 h-4 min-w-4 px-1 rounded-full bg-black/55 text-white text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground truncate">{rowPin.place_name}</span>
          <span className="block text-[12px] text-muted-foreground truncate">{categoryLabel}</span>
        </span>
      </div>
    </Reorder.Item>
  );
}

function SortableRouteRow({ value, rowPin, index, categoryLabel, onOpen, onGoogle, onDelete, onSave, saved, note, cornerAvatar }: {
  value: any; rowPin: any; index: number; categoryLabel: ReactNode;
  onOpen: () => void; onGoogle: () => void; onDelete: () => void;
  onSave?: () => void; saved?: boolean; note?: ReactNode; cornerAvatar?: string | null;
}) {
  const controls = useDragControls();
  const grip = (
    <span
      onPointerDown={(e) => controls.start(e)}
      aria-label="Przeciągnij, by zmienić kolejność"
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

export default function SharedRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation("sharing");

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
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [datesSheetOpen, setDatesSheetOpen] = useState(false);   // wlasciciel: zakres dat wyjazdu
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const dateDrag = useDragToDismiss({ onDismiss: () => setShowDateSheet(false) });
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
  // "Wybierz miejsca" (etap propozycji, host): zaznacz ktore miejsca zostaja -> reszta usunieta,
  // trip_type='ongoing' (przejscie na "w trakcie"). Domyslnie wszystkie zaznaczone.
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [choosingBusy, setChoosingBusy] = useState(false);
  // "Wybierz miejsca": jesli ktorys uczestnik nie dodal jeszcze miejsc -> dialog (przypomnienie / mimo to).
  const [missingParticipants, setMissingParticipants] = useState<{ id: string; username: string | null; avatar_url: string | null }[] | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  // Etap W TRAKCIE: zdjecia per-miejsce (wszyscy uczestnicy). Wlasna notka -> PlaceNoteEditor
  // (sam trzyma draft + debounce), zapis przez saveMyNote.
  const [uploadingPin, setUploadingPin] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  // User pisze notke -> chowamy czat i dolne CTA (zaslanialy pole i klawiature).
  const [noteEditing, setNoteEditing] = useState(false);
  // Etap W TRAKCIE = miejsce, w ktorym powstaje CALE wspomnienie: opis wyjazdu i tagi
  // miejsc. Stepper "podsumowania" zostal usuniety z flow (prosba Nat 2026-08-30) - publikacja to
  // jeden guzik "Opublikuj" na dole.
  const [tripDesc, setTripDesc] = useState("");
  const [descSaved, setDescSaved] = useState(false);
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinTags, setPinTags] = useState<Record<string, string[]>>({});
  const [publishing, setPublishing] = useState(false);
  // Tryb "Zmień kolejność miejsc" - dopiero on pokazuje uchwyty drag&drop i skraca wiersze
  // do miniaturek (prosba Nat 2026-08-30).
  const [reorderMode, setReorderMode] = useState(false);
  const [chatHidden, setChatHidden] = useState(false); // dymek czatu schowany do krawedzi (swipe w bok)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set()); // zwiniete grupy kategorii
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const share = useShare();
  const unsave = useUnsavePlace();
  // Tap bookmarka: zapisane -> odzapisz (toast+cofnij); niezapisane -> otworz drawer zapisu.
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
        .select("id, title, city, user_id, day_number, folder_id, start_date, end_date, ai_summary, ai_highlight, review_photos, review_narrative, group_session_id, tags, list_cover_url, trip_type, status")
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
        .from("group_session_members").select("user_id").eq("session_id", (route as any).group_session_id);
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
        .eq("session_id", (route as any).group_session_id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

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

  // Zapisz cudza trase do swojego dziennika (kopia pinow). Domyka petle
  // discovery -> moja sesja (re-discovery). Wymaga konta.
  const saveToMine = async (tripDate?: Date) => {
    if (!user) { navigate("/auth"); return; }
    if (!route || !pins.length || saving) return;
    setSaving(true);
    setShowDateSheet(false);
    const dateStr = tripDate ? format(tripDate, "yyyy-MM-dd") : null;
    try {
      const { data: newRoute, error } = await (supabase as any)
        .from("routes")
        .insert({
          user_id: user.id,
          title: route.title || route.city,
          city: route.city,
          status: "draft",
          trip_type: "planning",
          day_number: 1,
          start_date: dateStr,
          end_date: dateStr,
          is_shared: false,
          new_for_users: [user.id],
        })
        .select("id")
        .single();
      if (error || !newRoute) throw error;
      await (supabase as any).from("pins").insert(
        pins.map((p: any, idx: number) => ({
          route_id: newRoute.id,
          place_name: p.place_name,
          address: p.address ?? null,
          description: p.description ?? null,
          category: p.category ?? "other",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          place_id: p.place_id ?? null,
          photo_url: p.photo_url ?? null,
          suggested_time: p.suggested_time ?? null,
          pin_order: idx,
          original_creator_id: user.id,
        }))
      );
      notify.success(t("toast_saved"));
      // Powiadom autora oryginalnej trasy, ze ktos jej uzyl (best-effort; SECURITY DEFINER RPC -
      // klient nie moze insertowac notyfikacji dla innego usera). Push leci triggerem notify_push.
      if (route.user_id && route.user_id !== user.id) {
        // Zapisz "wykorzystanie" oryginalnej trasy (feeduje statystyki autora: my_route_stats
        // liczy saved_routes -> "osób wykorzystało Twoje trasy" + "Zapisania"). PK(user_id, route_id)
        // -> upsert idempotentny, ponowne uzycie tej samej trasy nie duplikuje.
        void (supabase as any)
          .from("saved_routes")
          .upsert({ user_id: user.id, route_id: id }, { onConflict: "user_id,route_id", ignoreDuplicates: true });
        void (supabase as any).rpc("notify_route_used", { p_route_id: id });
        // Push Z KLIENTA (trigger DB dostaje z send-push 401). Odbiorca = autor oryginalnej trasy.
        const me = await getCurrentUserName();
        void sendClientPush({ userId: route.user_id, title: t("push_used_title"), body: route.city ? t("push_used_body_city", { name: me, city: route.city }) : t("push_used_body", { name: me }), url: "/moj-profil?tab=wyjazdy" });
      }
      navigate(`/review-summary?route=${newRoute.id}`);
    } catch (e: any) {
      console.error("[SharedRoute] save failed:", e?.message ?? e);
      notify.error(t("toast_save_error"));
    }
    setSaving(false);
  };

  const { data: pins = [] } = useQuery({
    queryKey: ["shared-route-pins", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, route_id, place_name, address, category, suggested_time, images, image_url, user_photo_urls, photo_url, place_id, latitude, longitude, pin_order, day_index, description, tags, added_by")
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
    if (!user?.id) { toast.error("Zaloguj się, żeby polubić zdjęcie"); return; }
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
  const setMyCover = async (url: string) => {
    if (!user?.id || !id) return;
    const ok = await setMyRouteCover(id, user.id, url);
    if (!ok) { toast.error("Nie udało się ustawić Twojej okładki"); return; }
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ["route-member-cover", id, user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    toast.success("Ustawiono Twoją okładkę tego wyjazdu");
  };
  const resetMyCover = async () => {
    if (!user?.id || !id) return;
    await clearMyRouteCover(id, user.id);
    queryClient.invalidateQueries({ queryKey: ["route-member-cover", id, user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
    toast.success("Wróciła okładka wyjazdu");
  };

  // Init opisu/tagow z trasy (po zaladowaniu). Nie nadpisujemy, gdy user wlasnie pisze.
  useEffect(() => {
    if (!route) return;
    setTripDesc((prev) => (prev ? prev : ((route as any).review_narrative ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id]);

  // Tagi miejsc (pins.tags) - lokalny stan do optymistycznego przelaczania werdyktow.
  useEffect(() => {
    const map: Record<string, string[]> = {};
    for (const p of (pins as any[])) map[p.id] = Array.isArray(p.tags) ? p.tags : [];
    setPinTags(map);
  }, [pins]);

  // Opis wyjazdu (routes.review_narrative) - autosave z debounce, jak notki.
  const saveTripDesc = (v: string) => {
    setTripDesc(v);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(async () => {
      if (!id) return;
      await (supabase as any).from("routes").update({ review_narrative: v.trim() || null }).eq("id", id);
      setDescSaved(true);
      setTimeout(() => setDescSaved(false), 1500);
    }, 700);
  };


  // Werdykt o miejscu (pins.tags) - jeden tap pod notkami.
  const togglePinTag = async (pinId: string, tag: string) => {
    haptics.selection();
    const cur = pinTags[pinId] ?? [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
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
    if (!(pins as any[]).length) { toast.error("Wyjazd musi mieć co najmniej jedno miejsce"); return; }
    // Okladka eksploracji jest teraz WARUNKIEM publikacji (prosba Nat 2026-08-30) - wczesniej
    // losowalismy ja po cichu, wiec wyjazd trafial do feedu z przypadkowym zdjeciem.
    if (!(route as any)?.list_cover_url) {
      haptics.warning();
      toast.error("Wybierz okładkę wyjazdu", {
        description: "W zakładce Galeria zaznacz zdjęcie, które ma reprezentować wyjazd w eksploracji.",
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
      if (typeof synced === "number" && synced > 0) console.info(`[SharedRoute] zdjęcia miejsc: ${synced}`);
      const cover = (route as any)?.list_cover_url as string | null;
      track("trip_published", { route_id: id, city: route.city ?? null, place_count: (pins as any[]).length, has_cover: !!cover });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
      queryClient.invalidateQueries({ queryKey: ["profile-trip-feed"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
      queryClient.invalidateQueries({ queryKey: ["trip-shortcut"] });
      toast.success(cover ? "Wyjazd opublikowany - jest już w eksploracji" : "Wyjazd opublikowany. Dodaj zdjęcie, żeby pojawił się w eksploracji", {
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
      toast.error("Nie udało się opublikować wyjazdu");
    } finally { setPublishing(false); }
  };

  // Etap W TRAKCIE: zapis wlasnej notki (pin_ratings). PlaceNoteEditor sam debounce'uje -> zapis
  // natychmiastowy. Po zapisie invalidacja notek (inni uczestnicy widza + moj edytor sie synchronizuje).
  const saveMyNote = async (pin: any, value: string) => {
    if (!user) return;
    await (supabase as any).from("pin_ratings").upsert({ route_id: pin.route_id, user_id: user.id, place_name: pin.place_name, note: value || null }, { onConflict: "route_id,user_id,place_name" });
    queryClient.invalidateQueries({ queryKey: ["shared-route-notes", id] });
  };
  // Zdjecia per-miejsce (pins.images) - wszyscy uczestnicy widza wszystkie, kazdy dodaje/usuwa (member RLS).
  // Upload zdjecia -> bucket route-images -> pin_photos (route_id, place_name, user_id, url). Kazdy
  // uczestnik dodaje; przy zdjeciu awatar autora. (pins.images zostaje zrodlem okladek osobno.)
  const addPlacePhotos = async (pin: any, files: FileList | null) => {
    if (!user || !files || !files.length || !id) return;
    setUploadingPin(pin.id);
    try {
      const uploaded: { path: string; url: string }[] = [];
      for (const file of Array.from(files)) {
        const path = `${user.id}/${id}/pin_${pin.id}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from("route-images").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
        if (error) { console.error("[SharedRoute] photo upload:", error.message); continue; }
        const { data } = supabase.storage.from("route-images").getPublicUrl(path);
        if (data?.publicUrl) uploaded.push({ path, url: data.publicUrl });
      }
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
      if (rejectedCount) toast.error(rejectedCount === 1 ? MODERATION_REJECTED_MESSAGE : `${rejectedCount} zdjęcia nie przeszły moderacji`);
      // Opublikowany wyjazd zasila galerie MIEJSCA od razu (place_photos). Dla roboczego nie -
      // zdjecia trafia tam dopiero przy publikacji (patrz handlePublish).
      if ((route as any)?.status === "published") {
        await (supabase as any).rpc("sync_route_place_photos", { p_route_id: id });
        queryClient.invalidateQueries({ queryKey: ["place-photos"] });
      }
      queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
    } finally { setUploadingPin(null); }
  };
  const removePlacePhoto = async (photoId: string) => {
    await deletePinPhoto(photoId);
    queryClient.invalidateQueries({ queryKey: ["shared-route-pin-photos", id] });
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

  // Etap cyklu zycia wyjazdu (Nat 2026-08-25): planning=Propozycje, ongoing=W Trakcie, completed=Wspomnienie.
  const stage: "planning" | "ongoing" | "completed" = ((route as any).trip_type as any) || "planning";
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
      haptics.success(); toast.success(missingParticipants.length === 1 ? "Wysłano przypomnienie" : "Wysłano przypomnienia");
    } catch (e: any) { console.warn("[SharedRoute] reminder:", e?.message ?? e); haptics.error(); }
    finally { setReminderBusy(false); setMissingParticipants(null); }
  };
  const toggleChosen = (pid: string) => setChosen((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  // "Wybierz miejsca" -> zaznaczone zostaja, reszta usunieta, trip_type='ongoing' (przejscie w trakcie).
  const confirmChoose = async () => {
    if (!chosen.size) { toast("Zaznacz co najmniej jedno miejsce"); return; }
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
      if (removeIds.length) await (supabase as any).from("pins").delete().in("id", removeIds);
      await (supabase as any).from("routes").update({ trip_type: "ongoing" }).eq("id", route.id);
      haptics.success(); toast.success("Miejsca wybrane - wyjazd w trakcie!");
      setChoosing(false);
      queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
      queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    } catch (e: any) { console.error("[SharedRoute] confirmChoose:", e?.message ?? e); haptics.error(); toast.error("Nie udało się przejść dalej"); }
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
    if (error) { toast.error("Nie udało się zapisać dat"); return; }
    setDatesSheetOpen(false);
    haptics.success();
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success(numDays > 1 ? `Wyjazd na ${numDays} dni - miejsca możesz rozłożyć na dni` : "Zapisano datę wyjazdu");
  };
  const clearTripDates = async () => {
    if (!id) return;
    await (supabase as any).from("routes").update({ start_date: null, end_date: null }).eq("id", id);
    setDatesSheetOpen(false);
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
  };

  const handleShare = () => { void share({ title: route.title || cityLabel || "Wyjazd", url: buildShareUrl(`/route/${route.id}`) }); };

  // Wlasciciel dodaje miejsca do ISTNIEJACEJ trasy: append do pins (jak AddPlaceToTrip), potem refetch.
  const handleAddPlaces = async (places: PlaceForList[]) => {
    if (!user) return;
    const maxOrder = pins.reduce((m: number, p: any) => Math.max(m, p.pin_order ?? -1), -1);
    const rows = places.map((p, i) => ({
      // description = notka pina: pusta, notke pisze kazdy uczestnik sam (PlaceNotes).
      route_id: route.id, place_name: p.place_name, address: p.address ?? null, description: null,
      category: p.category ?? "other", latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      place_id: p.place_id ?? null, suggested_time: null, photo_url: p.photo_url ?? null,
      pin_order: maxOrder + 1 + i, original_creator_id: user.id, added_by: user.id,
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
    let urls: string[] = [];
    let rejected = 0;   // zdjecia odrzucone przez SafeSearch
    for (const rawFile of files) {
      try {
        const file = isHeic(rawFile) ? await convertHeicToJpeg(rawFile) : rawFile;
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const path = `${user.id}/${route.id}/gal_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const { error } = await (supabase as any).storage.from("route-images").upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (error) { console.error("[SharedRoute] photo upload failed:", error.message); continue; }
        urls.push(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
      } catch (e: any) { console.error("[SharedRoute] photo processing failed:", e?.message ?? e); }
    }
    // SafeSearch (Vision) RÓWNOLEGLE dla calej paczki - seryjnie kazde zdjecie kosztowaloby
    // ~2-4s. Odrzucone kasujemy ze Storage i nie dodajemy do galerii.
    if (urls.length) {
      const verdicts = await Promise.all(urls.map((u) => moderateImageUrl(u, "trip_gallery", { route_id: route.id })));
      const bad = urls.filter((_, i) => verdicts[i] === "rejected");
      rejected = bad.length;
      if (bad.length) {
        const prefix = `${SUPABASE_URL}/storage/v1/object/public/route-images/`;
        await (supabase as any).storage.from("route-images").remove(bad.map((u) => u.replace(prefix, "")));
      }
      urls = urls.filter((_, i) => verdicts[i] !== "rejected");
    }
    if (urls.length) {
      // RPC (SECURITY DEFINER) - dziala dla wlasciciela ORAZ uczestnika wspolnego wyjazdu
      // (routes UPDATE RLS = tylko owner; czlonek dopisuje zdjecia przez append_route_photos).
      const { error } = await (supabase as any).rpc("append_route_photos", { p_route_id: route.id, p_urls: urls });
      if (error) { toast.error("Nie udało się zapisać zdjęć"); }
      else { toast.success(urls.length === 1 ? "Dodano zdjęcie" : `Dodano ${urls.length} zdjęcia`); queryClient.invalidateQueries({ queryKey: ["shared-route", id] }); }
    } else if (!rejected) { toast.error("Nie udało się dodać zdjęć"); }
    if (rejected) toast.error(rejected === 1 ? MODERATION_REJECTED_MESSAGE : `${rejected} zdjęcia nie przeszły moderacji`);
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
    if (error) { toast.error("Nie udało się usunąć miejsca"); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    // Toast: miniaturka (lewo, powiekszona) + nazwa + Cofnij. toast.custom = pelna kontrola (akcja
    // + rozmiar miniatury), bo sonner action nie zawsze renderowal sie z customowa trescia.
    toast.custom((tid) => (
      <div className="flex items-center gap-3 w-full bg-white rounded-2xl shadow-lg shadow-black/10 pl-2.5 pr-2 py-2.5">
        <PlacePhoto pin={pin} className="h-12 w-12 rounded-xl object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground truncate">{pin.place_name}</p>
          <p className="text-[11.5px] text-muted-foreground">{stage === "planning" ? "Usunięto z propozycji" : "Usunięto z wyjazdu"}</p>
        </div>
        <button
          onClick={async () => {
            await (supabase as any).from("pins").insert({ ...rest });
            queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
            toast.dismiss(tid);
          }}
          className="shrink-0 text-[13px] font-bold text-primary px-3 py-2 rounded-xl active:bg-primary/10 transition-colors">Cofnij</button>
      </div>
    // classNames neutralizuje domyslny kontener Sonnera (szare tlo/ramka/cien z toastOptions) - inaczej
    // widac PODWOJNA obwodke: szary wrapper + moj bialy div. Cala plakietka ma byc jednolicie biala.
    ), { unstyled: true, classNames: { toast: "!bg-transparent !border-0 !shadow-none !p-0 !min-h-0" } });
  };

  // #3: usun zdjecie z galerii wyjazdu (review_photos). Toast + "Cofnij".
  const handleDeletePhoto = async (url: string) => {
    const before = ((route.review_photos ?? []) as string[]);
    const merged = before.filter((u) => u !== url);
    const { error } = await (supabase as any).from("routes").update({ review_photos: merged }).eq("id", route.id);
    if (error) { toast.error("Nie udało się usunąć zdjęcia"); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success("Usunięto zdjęcie", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          await (supabase as any).from("routes").update({ review_photos: before }).eq("id", route.id);
          queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
        },
      },
    });
  };

  // #c: ustaw zdjecie jako OKLADKE EKSPLORACJI (list_cover_url). Tylko wlasne zdjecia (galeria) -
  // zgodne z regula "okladka listy/trasy nigdy z Google".
  const handleSetCover = async (url: string) => {
    const { error } = await (supabase as any).from("routes").update({ list_cover_url: url }).eq("id", route.id);
    if (error) { toast.error("Nie udało się ustawić okładki"); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route", id] });
    toast.success("Ustawiono okładkę eksploracji");
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
      await supabase.from("pins").delete().in("route_id", ids);
      await (supabase as any).from("chat_sessions").delete().in("route_id", ids);
      const { error } = await supabase.from("routes").delete().in("id", ids).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      toast.success("Usunięto wyjazd.");
      setAskDelete(false);
      goBackOr(navigate, "/moj-profil");
    } catch (e: any) {
      toast.error("Nie udało się usunąć wyjazdu.");
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
  // Piny do mapy (ujednolicone z widokiem Trasy - RouteMap oczekuje latitude/longitude/place_name).
  const navMapPins = (pins as any[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number, place_name: p.place_name as string }));
  const staticMapUrl = buildStaticRouteMap(navMapPins);
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
    return d ? `Dzień ${day} · ${format(d, "EEEE d.MM", { locale: dateLocale() })}` : `Dzień ${day}`;
  };
  const pinDay = (pin: any) => Math.min(Math.max(Number(pin?.day_index) || 1, 1), dayCount);
  const dateLabel = tripStart
    ? (tripEnd && dayCount > 1
        ? `${format(tripStart, "d MMM", { locale: dateLocale() })} - ${format(tripEnd, "d MMMM yyyy", { locale: dateLocale() })}`
        : format(tripStart, "d MMMM yyyy", { locale: dateLocale() }))
    : "";
  const cityLabel = route.city || t("trip_default");
  // Tryb anonimowy: autor ukryty (bez profilu/awatara/lokalsa).
  const isAnon = shareMeta?.share_anonymous === true;
  // "lokals poleca!" - autor pochodzi z miasta tej trasy.
  const authorName = isAnon ? t("author_anon") : (author?.first_name || author?.username || t("author_default"));
  const isLocal = !isAnon && !!author?.home_city && !!route.city &&
    author.home_city.trim().toLowerCase() === route.city.trim().toLowerCase();

  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: route.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    photo_url: resolveStored(pin.photo_url || pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null)) ?? "",
    vibe_tags: metaFor(pin).tags,
    // Zrodlo prawdy = opis miejsca z bazy (places.description, jak w swiperze).
    // pin.description (generowany AI per-trasa) tylko jako fallback dla custom pinow.
    description: metaFor(pin).description || pin.description || "",
  } satisfies MockPlace);

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
    // Etap W TRAKCIE (ongoing): notki innych (awatar + tresc, BEZ headera) + moja notka (kompaktowo,
    // auto-zapis) + guzik "Zdjęcie" obok + zdjecia per-miejsce (awatar autora). Uklad wspolny z listami.
    if (stage === "ongoing") {
      const placePhotos = photosMap.get(pinPhotoKey(pin.place_name)) ?? [];
      const busy = uploadingPin === pin.id;
      const myNote = ((list.find((n) => n.user_id === user?.id)?.note) ?? "").trim();
      const photoSlot = canEdit ? (
        <label className={`inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer active:scale-95 transition-transform ${busy ? "opacity-60 pointer-events-none" : ""}`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {busy ? "Dodawanie..." : "Zdjęcie"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPlacePhotos(pin, e.target.files); e.currentTarget.value = ""; }} />
        </label>
      ) : null;
      return (
        <div className="space-y-3 mt-1">
          {/* Moja notka: kompaktowo (+ Dodaj notkę / Edytuj) + guzik zdjecia obok. Auto-zapis. */}
          {/* Awatar przy WLASNEJ notce dopiero we wspomnieniu (po publikacji) - w trakcie wyjazdu
              autor jest oczywisty, a awatar dokladal szumu przy pisaniu (prosba Nat 2026-08-30). */}
          {canEdit && (
            <PlaceNoteEditor note={myNote} avatarUrl={myAvatar} onSave={(v) => saveMyNote(pin, v)} photoSlot={photoSlot} onEditingChange={setNoteEditing} />
          )}
          {/* Notki innych uczestnikow - awatar + tresc, BEZ headera (task 6). */}
          <PlaceNotes notes={list} excludeUserId={user?.id} />
          {/* Werdykt o miejscu - jeden tap zamiast pisania (prosba Nat 2026-08-30). pins.tags,
              wiec trafia tez do wspomnienia i eksploracji. */}
          {canEdit && (
            <div className="flex flex-wrap gap-1.5">
              {PLACE_VERDICT_TAGS.map((tg) => {
                const on = (pinTags[pin.id] ?? []).includes(tg);
                return (
                  <button key={tg} type="button" onClick={() => togglePinTag(pin.id, tg)}
                    className={`px-2.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors active:scale-[0.97] ${on ? "bg-[#FDF184] border-[#FDCD84] text-foreground" : "bg-white text-foreground border-border/60"}`}>
                    {tg}
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
                  <img
                    src={resolveStored(ph.url) ?? ph.url} alt=""
                    role="button"
                    onClick={() => setPinPhotoViewer({
                      urls: placePhotos.map((x) => resolveStored(x.url) ?? x.url),
                      idx: placePhotos.findIndex((x) => x.id === ph.id),
                    })}
                    className="w-full h-full object-cover active:opacity-90 transition-opacity"
                  />
                  <img src={avatarSrc(ph.avatar_url)} alt="" title={ph.username ?? undefined} className="absolute bottom-1 left-1 h-7 w-7 rounded-full object-cover border-2 border-white shadow-sm bg-secondary" />
                  {(ph.user_id === user?.id || isOwner) && <button onClick={() => removePlacePhoto(ph.id)} aria-label="Usuń zdjęcie" className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90"><X className="h-3 w-3" /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    // Wspomnienie (completed / published): notki wszystkich, read-only. BEZ headera - sam awatar
    // + notka danego usera (task 6, prosba Nat 2026-08-26).
    if (!list.length) return undefined;
    return <PlaceNotes notes={list} />;
  };
  const rowPinFor = (pin: any) => (coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin);

  // Grupowanie miejsc po kategorii (subcat). Naglowki: nazwa (plural) + liczba "Propozycje" na etapie
  // planning; same nazwy pozniej (ongoing/wspomnienie). Kolejnosc grup wg SUBCAT_ORDER. (Figma 2026-08-27)
  const groupedPins: [string, any[]][] = (() => {
    const map = new Map<string, any[]>();
    for (const pin of pins as any[]) {
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
  const withDayMarkers = (list: any[]) => {
    const out: any[] = [];
    for (let d = 1; d <= dayCount; d++) {
      out.push({ id: `__day_${d}`, __day: d });
      out.push(...list.filter((p) => pinDay(p) === d));
    }
    return out;
  };
  const onReorderWithDays = (next: any[], persist: (pins: any[]) => void) => {
    let current = 1;
    const pinsOnly: any[] = [];
    for (const item of next) {
      if (item.__day) { current = item.__day; continue; }
      pinsOnly.push({ ...item, day_index: current });
    }
    persist(pinsOnly);
  };

  const renderRows = (list: any[], onReorder: (next: any[]) => void) => (
    canEdit && reorderMode ? (
      hasDays ? (
        <Reorder.Group axis="y" values={withDayMarkers(list)} onReorder={(next: any[]) => onReorderWithDays(next, onReorder)} as="div">
          {withDayMarkers(list).map((item: any, i: number) =>
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
    ) : hasDays ? (
      // Widok zwykly: te same miejsca, ale pogrupowane naglowkami dni.
      <div>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => {
          const dayPins = list.filter((p) => pinDay(p) === day);
          return (
            <div key={day}>
              <div className="pt-4 pb-2 flex items-center gap-2">
                <p className="text-[15px] font-bold text-foreground">{dayLabel(day)}</p>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              {dayPins.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-2">{canEdit ? `Brak miejsc - dodaj je albo przenieś tu w „Zmień kolejność"` : "Brak miejsc tego dnia"}</p>
              ) : dayPins.map((pin: any, i: number) => (
                <RoutePlaceRow
                  key={pin.id} pin={rowPinFor(pin)} index={i}
                  categoryLabel={categoryLabel(pin.category || "other")}
                  onOpen={() => openDetail(pin)} onGoogle={() => openGooglePlace(pin)}
                  onDelete={canEdit ? () => handleDeletePin(pin) : undefined}
                  onSave={user ? () => toggleSaveBookmark(pin) : undefined} saved={isSaved(pin.place_name)}
                  note={buildNote(pin)} cornerAvatar={addedByAvatar(pin)}
                />
              ))}
            </div>
          );
        })}
      </div>
    ) : (
      <div>
        {list.map((pin: any, i: number) => (
          <RoutePlaceRow
            key={pin.id} pin={rowPinFor(pin)} index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
            onOpen={() => openDetail(pin)} onGoogle={() => openGooglePlace(pin)}
            onDelete={canEdit ? () => handleDeletePin(pin) : undefined}
            onSave={user ? () => toggleSaveBookmark(pin) : undefined} saved={isSaved(pin.place_name)}
            note={buildNote(pin)} cornerAvatar={addedByAvatar(pin)}
          />
        ))}
      </div>
    )
  );

  const renderList = () => (
    // Kategorie grupuja miejsca TYLKO na etapie propozycji (tam sluza do przegladania sugestii).
    // W trakcie wyjazdu i we wspomnieniu liczy sie KOLEJNOSC ustawiona przez usera (od punktu do
    // punktu), wiec lista jest plaska - bez naglowkow kategorii (decyzja Nat 2026-08-28).
    stage !== "planning" ? renderRows(pins as any[], handleReorderPins) :
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

  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">

      {/* Staly TopBar (naglowek nad obszarem scrolla): wstecz + autor + uczestnicy + miasto + liczba miejsc + serce */}
      <div className="shrink-0 bg-background px-5 pb-2.5 border-b border-border/40" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <div className="flex items-center gap-2 text-sm">
            <button onClick={() => goBackOr(navigate, "/eksploruj")} aria-label="Wróć"
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
              <button onClick={toggleLike} aria-label="Polub trasę" className="shrink-0 flex items-center gap-1 active:scale-90 transition-transform">
                <Heart className={cn("h-5 w-5", routeLike.liked ? "fill-red-500 text-red-500" : "text-foreground/70")} />
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{routeLike.count}</span>
              </button>
            ) : (
              <div className="w-7 shrink-0" />
            )}
          </div>
      </div>

      {/* Obszar scrolla - #1: BEZ okladki tla trasy (okladka TYLKO w eksploracji). */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-44">
        {/* Naglowek: tytul + opis, spacing 35px pod TopBarem */}
        <div className="px-5 pt-[35px]">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-black text-foreground leading-tight">{route.title || cityLabel}</h1>
            {isOwner && (
              <div className="shrink-0 flex items-center gap-2">
                {/* Zapraszanie uczestnikow USUNIETE z widoku wyjazdu (decyzja Nat 2026-08-30):
                    osoby wybiera sie WYLACZNIE przy tworzeniu wyjazdu. Skladu nie zmienia sie
                    ani w trakcie, ani po publikacji. */}
                <button onClick={handleShare} aria-label="Udostępnij" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Share2 className="h-4 w-4 text-foreground" /></button>
                {/* Olowek TYLKO dla opublikowanego wspomnienia. W propozycjach i "w trakcie" caly
                    ten widok JEST edycja (miejsca, notki, zdjecia, opis, tagi) - osobny tryb
                    edycji tylko mylil (prosba Nat 2026-08-30). */}
                {stage === "completed" && (
                  <button onClick={() => navigate(`/review-summary?route=${route.id}&edit=1`)} aria-label="Edytuj trasę" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Pencil className="h-4 w-4 text-foreground" /></button>
                )}
                <button onClick={() => setAskDelete(true)} aria-label="Usuń wyjazd" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            )}
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
              <span className="text-base">{`Dodaj daty wyjazdu`}</span>
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

        {/* #2: Zakladki jak na profilu - ikony + podkreslenie aktywnej, FULL WIDTH (bez px). */}
        <div className="pt-5">
          <div className="flex border-b border-border/60">
            {/* Etap PROPOZYCJI (planning) = tylko Miejsca + Mapa (galeria bez sensu przy sugerowaniu).
                Galeria pojawia sie od "w trakcie" (ongoing) - prosba Nat 2026-08-25. */}
            {([
              { k: "miejsca" as const, Icon: MapPin, label: "Miejsca" },
              ...(stage !== "planning" ? [{ k: "galeria" as const, Icon: ImageIcon, label: "Galeria" }] : []),
              { k: "mapa" as const, Icon: MapIcon, label: "Mapa" },
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
            {/* OPIS + TAGI CALEJ TRASY - przeniesione tu ze steppera "podsumowania" (prosba Nat
                2026-08-30): wspomnienie powstaje w trakcie wyjazdu, a publikacja to jeden guzik. */}
            {canEdit && stage === "ongoing" && !choosing && (
              <div className="mb-5 space-y-4">
                <div>
                  <p className="text-[13px] font-bold text-foreground mb-1.5">Opis wyjazdu</p>
                  <div className="relative">
                    <textarea
                      value={tripDesc}
                      onChange={(e) => saveTripDesc(e.target.value)}
                      onFocus={() => setNoteEditing(true)}
                      onBlur={() => setNoteEditing(false)}
                      placeholder="Dla kogo jest ten wyjazd, na jaką okazję, co warto zobaczyć..."
                      rows={3}
                      className="w-full bg-muted/50 rounded-2xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none border border-border/40 focus:border-orange-400/60 placeholder:text-muted-foreground/55"
                    />
                    {descSaved && <span className="absolute bottom-2.5 right-3 text-[10px] font-medium text-green-600">Zapisano</span>}
                  </div>
                </div>
              </div>
            )}
            {choosing ? (
              /* Tryb "Wybierz miejsca": zaznacz ktore miejsca wchodza do wyjazdu (reszta usunieta). */
              <div className="space-y-2">
                <p className="text-[13px] text-muted-foreground pb-1">Zaznacz miejsca, które wchodzą do wyjazdu.</p>
                {(pins as any[]).map((pin) => (
                  <button key={pin.id} onClick={() => toggleChosen(pin.id)} className="w-full flex items-center gap-3 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5 text-left active:opacity-80 transition-opacity">
                    <PlacePhoto pin={pin} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-foreground truncate">{pin.place_name}</span>
                    {/* Liczba glosow - pomaga hostowi zdecydowac */}
                    {(() => {
                      const c = (votesMap as Map<string, { count: number }>).get(placeVoteKey(pin.place_name))?.count ?? 0;
                      if (c === 0) return null;
                      return <span className="shrink-0 inline-flex items-center rounded-full bg-white text-foreground px-2.5 py-0.5 text-[12px] font-bold">{c} {c === 1 ? "głos" : c < 5 ? "głosy" : "głosów"}</span>;
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
                title="Trasa jest pusta"
                hint={canEdit ? "Dodaj pierwsze miejsce guzikiem „+” po prawej stronie" : "Ta trasa nie ma jeszcze żadnych miejsc."}
              />
            )}
          </div>
        ) : planTab === "mapa" ? (
          /* Mapa w wlasnej zakladce (obok Galeria) - statyczna Google + rozwiniecie do interaktywnej. */
          <div className="px-5 pt-4">
            {navMapPins.length > 0 && staticMapUrl ? (
              <button data-no-swipe onClick={() => setPlanMapOpen(true)} className="relative block w-full h-64 rounded-2xl overflow-hidden border border-border/40 bg-muted active:opacity-95 transition-opacity">
                <img src={staticMapUrl} alt={t("route_map")} className="w-full h-full object-cover" />
                <span className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center">
                  <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
                </span>
              </button>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-10">Brak lokalizacji miejsc na mapie.</p>
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
                    className="block w-full break-inside-avoid aspect-[4/3] rounded-2xl border-2 border-dashed border-border flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-[0.98] transition-transform disabled:opacity-60">
                    {uploadingPhotos ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : <><Plus className="h-6 w-6 mx-auto" /><span className="block text-xs font-semibold mt-1">Dodaj zdjęcie</span></>}
                  </button>
                )}
                {galleryPhotos.map((url, i) => {
                  const isCover = (route as any).list_cover_url === url;
                  return (
                    <div key={i} onClick={() => setViewerIndex(i)} role="button"
                      className={`relative break-inside-avoid rounded-2xl overflow-hidden bg-muted active:opacity-90 transition-opacity cursor-pointer ${isCover ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                      <img src={url} alt="" loading="lazy" className="w-full h-auto block" />
                      {/* Licznik polubien (gdy sa) - siatka zostaje czysta, lajkuje sie w podgladzie. */}
                      {likeStateOf(url).count > 0 && (
                        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Heart className={`h-3 w-3 ${likeStateOf(url).liked ? "fill-red-500 text-red-500" : "text-white"}`} />
                          {likeStateOf(url).count}
                        </span>
                      )}
                      {/* Gwiazdka = okladka w EKSPLORACJI (tylko host). Ikona osoby = MOJA okladka
                          tego wyjazdu - kazdy uczestnik ma wlasna, nie rusza cudzych. */}
                      {isOwner && (
                        <button onClick={(e) => { e.stopPropagation(); void handleSetCover(url); }}
                          aria-label={isCover ? "To jest okładka w eksploracji" : "Ustaw jako okładkę w eksploracji"}
                          className={`absolute top-1.5 right-1.5 h-8 w-8 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform ${isCover ? "bg-primary" : "bg-white/90"}`}>
                          <Star className={`h-4 w-4 ${isCover ? "fill-white text-white" : "text-[#F0A583]"}`} />
                        </button>
                      )}
                      {canEdit && (() => {
                        const isMine = !!myCover && resolveStored(myCover) === url;
                        return (
                          <button onClick={(e) => { e.stopPropagation(); void (isMine ? resetMyCover() : setMyCover(url)); }}
                            aria-label={isMine ? "To Twoja okładka - kliknij, żeby wrócić do okładki wyjazdu" : "Ustaw jako Twoją okładkę"}
                            className={`absolute top-1.5 ${isOwner ? "right-11" : "right-1.5"} h-8 w-8 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform ${isMine ? "bg-foreground" : "bg-white/90"}`}>
                            <UserRound className={`h-4 w-4 ${isMine ? "text-white" : "text-foreground/70"}`} strokeWidth={2.2} />
                          </button>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("gallery_empty", { defaultValue: "Brak zdjęć w tej trasie" })}</p>
                {canAddPhotos && (
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}
                    className="mt-1 px-4 py-2.5 rounded-full border border-border text-foreground font-bold text-sm flex items-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
                    {uploadingPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dodaj zdjęcie
                  </button>
                )}
              </div>
            )}
            {canAddPhotos && (
              <input ref={photoInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
                onChange={(e) => { const files = Array.from(e.target.files ?? []); e.currentTarget.value = ""; if (files.length) void handleAddPhotos(files); }} />
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
          existingPlaces={pins.map((p: any) => ({
            place_name: p.place_name, category: p.category ?? null, address: p.address ?? null, description: p.description ?? null,
            latitude: p.latitude ?? null, longitude: p.longitude ?? null, photo_url: p.photo_url ?? null, place_id: p.place_id ?? null,
            google_place_id: p.google_place_id ?? null, rating: p.rating ?? null,
          }))}
          onAdd={handleAddPlaces}
        />
      )}

      {/* Dymek CZATU wyjazdu (prawa strona, nad dolnym CTA) - uczestnicy (owner/czlonek) przegaduja
          miejsca. Realtime. Ukryty w trybie wyboru miejsc. Prosba Nat 2026-08-26. */}
      {canEdit && id && !choosing && !noteEditing && (
        // Dymek czatu - PRZESUWALNY: swipe w prawo chowa go do krawedzi (zostaje sliver), tap/przeciagniecie
        // w lewo go wyciaga. Tap na widocznym otwiera czat. (prosba Nat 2026-08-26).
        <motion.button aria-label={chatHidden ? "Pokaż czat" : "Czat wyjazdu"}
          drag="x"
          dragConstraints={{ left: 0, right: 50 }}
          dragElastic={0.08}
          dragMomentum={false}
          animate={{ x: chatHidden ? 50 : 0, opacity: chatHidden ? 0.92 : 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onDragEnd={(_e, info) => { if (info.offset.x > 28) setChatHidden(true); else if (info.offset.x < -28) setChatHidden(false); }}
          onTap={() => { if (chatHidden) setChatHidden(false); else setChatOpen(true); }}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-background text-foreground border border-border shadow-lg shadow-black/10 flex items-center justify-center touch-none"
          style={{ bottom: "calc(152px + env(safe-area-inset-bottom, 0px))" }}>
          <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
          {/* Licznik nieprzeczytanych - top-LEFT, zeby byl widoczny tez gdy dymek schowany do krawedzi. */}
          {unreadChat > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white leading-none">{unreadChat > 9 ? "9+" : unreadChat}</span>
          )}
        </motion.button>
      )}
      {/* "Dodaj miejsce" jako plywajacy guzik BEZPOSREDNIO POD czatem (prosba Nat 2026-08-30).
          Dostepny takze w trybie zmiany kolejnosci (prosba Nat 2026-08-30) - chowamy tylko przy
          pisaniu notki i przy wyborze miejsc. */}
      {canEdit && !choosing && !noteEditing && (
        <button
          onClick={() => { haptics.light(); setAddPlaceOpen(true); }}
          aria-label="Dodaj miejsce"
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-background border border-border shadow-lg shadow-black/10 flex items-center justify-center active:scale-90 transition-transform"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
        >
          <Plus className="h-6 w-6 text-foreground" strokeWidth={2.4} />
        </button>
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
            <RouteMap pins={navMapPins as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setPlanMapOpen(false)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
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
          <button onClick={() => setViewerIndex(null)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
            <X className="h-5 w-5 text-white" />
          </button>
          {/* Usuwanie zdjecia zeszlo z kafelka do podgladu - siatka ma byc czysta (bez podpisow
              i dodatkowych ikon), zostaje na niej tylko wybor okladki. */}
          {isOwner && (
            <button onClick={(e) => { e.stopPropagation(); void handleDeletePhoto(galleryPhotos[viewerIndex]); setViewerIndex(null); }}
              aria-label="Usuń zdjęcie"
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
                aria-label={st.liked ? "Cofnij polubienie" : "Polub zdjęcie"}
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

      {/* CTA: editor (wlasciciel LUB uczestnik wspolnego wyjazdu) = "Dodaj nowe miejsce"; gosc = zapisz + zaplanuj.
          Ukryte na czas pisania notki - inaczej pasek siedzi nad klawiatura i zaslania pole. */}
      {!noteEditing && (
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-2 bg-background border-t border-border/30"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        {canEdit ? (
            choosing ? (
              /* Tryb wyboru miejsc (host) - potwierdzenie przejscia na "w trakcie". */
              <div className="flex items-center gap-2">
                <button onClick={() => setChoosing(false)} className="px-4 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">Anuluj</button>
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
                  <Check className="h-4 w-4 stroke-[3]" /> Gotowe
                </button>
              ) : (
              <div className="flex items-center gap-2">
                {/* "Dodaj miejsce" przeniesione do plywajacego guzika pod czatem (prosba Nat
                    2026-08-30) - dolny pasek zostaje dla akcji etapu. */}
                {pins.length > 1 && (
                  <button onClick={() => { haptics.light(); setReorderMode(true); }}
                    className="flex-1 py-3 rounded-full border border-border bg-background text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                    <GripVertical className="h-4 w-4" /> Zmień kolejność
                  </button>
                )}
                {/* Etap PROPOZYCJI (host): wybierz miejsca -> w trakcie. */}
                {isOwner && stage === "planning" && pins.length > 0 && (
                  <button onClick={startChoosing}
                    className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                    <Check className="h-4 w-4 stroke-[3]" /> Wybierz miejsca
                  </button>
                )}
                {/* Etap W TRAKCIE (host): PUBLIKACJA jednym guzikiem. Opis, tagi i zdjecia
                    powstaja juz w tym widoku - stepper "podsumowania" zostal usuniety z flow. */}
                {isOwner && stage === "ongoing" && (
                  <button onClick={handlePublish} disabled={publishing}
                    className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50">
                    {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {publishing ? "Publikuję..." : "Opublikuj"}
                  </button>
                )}
              </div>
              )
            )
          ) : (
            <>
              <button
                onClick={() => { if (!user) { navigate("/auth"); return; } setShowDateSheet(true); }}
                disabled={saving}
                className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25 disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4" />{saving ? t("saving") : "Zapisz tą trasę"}
              </button>
              <button
                onClick={() => navigate(`/plan?city=${encodeURIComponent(cityLabel)}`)}
                className="w-full mt-2 py-2 text-sm font-medium text-muted-foreground active:text-foreground transition-colors"
              >
                {t("plan_own_route", { city: cityLabel })}
              </button>
            </>
          )}
        </div>
      )}

      {/* Sheet wyboru daty wyjazdu przy zapisie cudzej trasy do dziennika */}
      {/* Wlasciciel: zakres dat wyjazdu. Zakres wielodniowy wlacza podzial miejsc na dni. */}
      <Sheet open={datesSheetOpen} onOpenChange={setDatesSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-[max(16px,env(safe-area-inset-bottom))] pt-5 max-h-[88dvh] overflow-y-auto">
          <SheetTitle className="sr-only">Daty wyjazdu</SheetTitle>
          <div className="px-5 pb-1 text-center">
            <p className="text-lg font-black leading-tight">{`Wybierz datę`}</p>
            <p className="text-xs text-muted-foreground mt-1">{`Wybierz jeden dzień albo zakres - przy kilku dniach rozłożysz miejsca na dni`}</p>
          </div>
          <FullCalendarPicker maxDays={14} onConfirm={(d, numDays) => void saveTripDates(d, numDays)} allowPast onClear={route.start_date ? () => void clearTripDates() : undefined} />
        </SheetContent>
      </Sheet>

      {showDateSheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDateSheet(false)}
        >
          <div
            {...dateDrag.dragProps}
            className="w-full max-w-md bg-card rounded-t-3xl flex flex-col max-h-[88dvh] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-1 text-center shrink-0">
              <p className="text-lg font-black leading-tight">{t("date_sheet_title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("date_sheet_desc")}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FullCalendarPicker onConfirm={(d) => saveToMine(d)} />
            </div>
            <button
              onClick={() => saveToMine()}
              disabled={saving}
              className="mx-5 mt-1 mb-[max(16px,env(safe-area-inset-bottom))] py-2.5 text-sm font-medium text-muted-foreground active:text-foreground transition-colors shrink-0 disabled:opacity-50"
            >
              {t("save_without_date")}
            </button>
          </div>
        </div>
      )}

      {/* Potwierdzenie usuniecia wyjazdu - nieodwracalne. */}
      {/* Potwierdzenie usuniecia MIEJSCA (od etapu "w trakcie") - pokazuje, ile tresci przepadnie. */}
      <AlertDialog open={!!confirmDeletePin} onOpenChange={(o) => { if (!o) setConfirmDeletePin(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{`Usunąć „${confirmDeletePin?.place_name ?? "to miejsce"}" z wyjazdu?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const notes = (notesMap.get(placeNoteKey(confirmDeletePin?.place_name ?? "")) ?? []).length;
                const photos = (photosMap.get(pinPhotoKey(confirmDeletePin?.place_name ?? "")) ?? []).length;
                const parts: string[] = [];
                if (notes) parts.push(`${notes} ${notes === 1 ? "notkę" : notes < 5 ? "notki" : "notek"}`);
                if (photos) parts.push(`${photos} ${photos === 1 ? "zdjęcie" : photos < 5 ? "zdjęcia" : "zdjęć"}`);
                return parts.length
                  ? `Razem z miejscem znikną ${parts.join(" i ")} dodane przez uczestników. Tego nie da się cofnąć.`
                  : "Miejsce zniknie z wyjazdu u wszystkich uczestników.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { const pin = confirmDeletePin; setConfirmDeletePin(null); if (pin) void deletePinNow(pin); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń miejsce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askDelete} onOpenChange={(o) => { if (!o && !deleting) setAskDelete(false); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Na pewno chcesz usunąć ten wyjazd?</AlertDialogTitle>
            <AlertDialogDescription>
              {`„${route.title || route.city || "Wyjazd"}" zniknie bezpowrotnie z Twojego profilu. Nie można tego cofnąć.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Usuwanie…" : "Usuń"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: uczestnicy bez dodanych miejsc -> przypomnienie (push) lub "wybierz mimo to" (prosba Nat). */}
      {missingParticipants && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setMissingParticipants(null)}>
          <div className="w-full max-w-sm bg-card rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold text-foreground">Nie wszyscy dodali miejsca</p>
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
              <button onClick={sendReminders} disabled={reminderBusy} className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60">{reminderBusy ? "Wysyłam..." : "Wyślij przypomnienie"}</button>
              <button onClick={proceedToChoosing} className="w-full py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform">Wybierz mimo to</button>
              <button onClick={() => setMissingParticipants(null)} className="w-full py-2 text-sm font-medium text-muted-foreground">Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
