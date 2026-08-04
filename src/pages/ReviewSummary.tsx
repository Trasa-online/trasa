import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Globe, Lock, Pencil, Check, Image as ImageIcon, Map as MapIcon, MapPin, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2, Plus, Share, Share2, List, GalleryHorizontalEnd, Info, MoreVertical, Navigation, Maximize2, Users, Calendar as CalendarIcon, Loader2, GripVertical, Building2 } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import RouteMap from "@/components/RouteMap";
import SwipeToDeleteRow from "@/components/SwipeToDeleteRow";
import { useShare } from "@/hooks/useShare";
import { Switch } from "@/components/ui/switch";
import AddPinSheet from "@/components/route/AddPinSheet";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { QRCodeSVG } from "qrcode.react";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { compressImage } from "@/lib/imageCompression";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";
import { format, parseISO, isValid, addDays } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { isNative, API_BASE } from "@/lib/platform";
import { Camera as CapCamera } from "@capacitor/camera";
import { notify } from "@/lib/notify";
import { requestLocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/distance";
import { deferDelete } from "@/lib/deferDelete";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Limit zdjec dodawanych do galerii wpisu.
const MAX_PHOTOS = 20;

// Oficjalne logo Google (4-kolorowe "G") - guzik nawigacji do miejsca w Google Maps.
const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Wiersz listy miejsc z DRAG & DROP (framer-motion Reorder) na ekranie "Sugestie do trasy".
// Przeciaganie uchwytem (GripVertical) - reszta wiersza nadal tapowalna (otwiera wizytowke).
function SortableReviewRow({ pin, idx, categoryLabel, visited, onOpen, onRemove, noteValue, noteOpen, onToggleNote, onNoteChange, noteSaved, onNoteFocusChange }: {
  pin: any; idx: number; categoryLabel: React.ReactNode; visited: boolean; onOpen: () => void; onRemove: () => void;
  noteValue: string; noteOpen: boolean; onToggleNote: () => void; onNoteChange: (v: string) => void; noteSaved: boolean;
  onNoteFocusChange?: (focused: boolean) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={pin}
      dragListener={false}
      dragControls={controls}
      transition={{ duration: 0 }}
      className={`flex flex-col rounded-2xl bg-secondary border border-border/40 shadow-sm p-2.5 select-none ${visited ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        {/* Uchwyt przeciagania - z LEWEJ, obok okladki (daleko od kosza po prawej). */}
        <span
          onPointerDown={(e) => { haptics.light(); controls.start(e); }}
          aria-label="Przeciągnij, by zmienić kolejność"
          className="shrink-0 h-9 w-6 flex items-center justify-center text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <button onClick={onOpen} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
          <PlacePhoto pin={pin} className="w-full h-full object-cover" />
          <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className={`text-sm font-bold leading-tight truncate ${visited ? "line-through" : ""}`}>{pin.place_name}</p>
          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">{categoryLabel}</span>
        </button>
        <button onClick={onRemove} aria-label="Usuń miejsce" className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 active:scale-90 shrink-0"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* "+ Podziel sie wrazeniami" - zwijana notka usera o tym miejscu (opt-in, domyslnie zwinieta). */}
      {noteOpen ? (
        <div className="mt-4 pl-8 relative">
          <textarea
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            onFocus={() => onNoteFocusChange?.(true)}
            onBlur={() => onNoteFocusChange?.(false)}
            placeholder="Podziel się wrażeniami o tym miejscu..."
            rows={3}
            className="w-full bg-white rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none border border-border/50 focus:border-orange-400/60 placeholder:text-muted-foreground/55"
          />
          <div className="flex items-center justify-between mt-2">
            <button onClick={onToggleNote} className="px-4 py-2 rounded-full bg-muted text-sm font-semibold text-foreground active:scale-95 transition-transform">Zwiń</button>
            {noteSaved && <span className="text-xs text-green-600 font-medium">Zapisano</span>}
          </div>
        </div>
      ) : (
        <button onClick={onToggleNote} className="mt-4 mb-1 ml-8 self-start inline-flex items-center gap-2 py-1.5 text-sm font-bold text-foreground active:opacity-60">
          <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"><Plus className="h-4 w-4" strokeWidth={2.6} /></span>
          {noteValue.trim() ? "Twoje wrażenia" : "Podziel się wrażeniami"}
        </button>
      )}
    </Reorder.Item>
  );
}

// Wiersz planu (widok "Plan wyjazdu" wlasciciela) - wspoldzielony RoutePlaceRow z uchwytem
// DRAG (Reorder) po lewej + swipe-to-delete + opcjonalna notka. Ujednolicony z eksploracja.
function SortablePlanRow({ pin, index, categoryLabel, visited, onOpen, onGoogle, onDelete, note }: {
  pin: any; index: number; categoryLabel: React.ReactNode; visited: boolean;
  onOpen: () => void; onGoogle: () => void; onDelete: () => void; note?: React.ReactNode;
}) {
  const controls = useDragControls();
  const grip = (
    <span
      onPointerDown={(e) => { haptics.light(); controls.start(e); }}
      aria-label="Przeciągnij, by zmienić kolejność"
      className="shrink-0 w-6 flex items-center justify-center text-muted-foreground/45 cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical className="h-5 w-5" />
    </span>
  );
  return (
    <Reorder.Item value={pin} dragListener={false} dragControls={controls} transition={{ duration: 0 }}>
      <SwipeToDeleteRow onDelete={onDelete}>
        <RoutePlaceRow pin={pin} index={index} categoryLabel={categoryLabel} visited={visited} onOpen={onOpen} onGoogle={onGoogle} dragHandle={grip} note={note} />
      </SwipeToDeleteRow>
    </Reorder.Item>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

// Klucz kompozytowy ocena/notka per miejsce w danym dniu (route_id + place_name),
// zeby to samo miejsce w roznych dniach trasy wielodniowej bylo niezalezne.
const rkey = (routeId: string, placeName: string) => `${routeId}::${placeName}`;

// Statyczna mapka planu (proxy /api/static-map) - pomaranczowe markery miejsc, POI/transit
// ukryte, auto-fit. null gdy brak wspolrzednych.
function buildTripStaticMapUrl(pins: any[], size = "560x260"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!pts.length) return null;
  // Numerowane peachy piny (label 1-9; Google static przyjmuje 1 znak - dla 10+ bez numeru).
  const markers = pts.map((p, i) => {
    const label = i + 1 <= 9 ? `label:${i + 1}%7C` : "";
    return `markers=color:0xf0a583%7C${label}${p.latitude},${p.longitude}`;
  }).join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

const ReviewSummary = () => {
  const { t } = useTranslation("review");
  const catLabel = (cat: string) =>
    t(`categories.${cat}`, { defaultValue: CATEGORY_LABEL[cat] ?? CATEGORY_LABEL.other });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const share = useShare();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
  // ?edit=1 wymusza tryb edycji (stepper Trasa/Notki/Zdjecia) nawet dla AKTYWNEGO (przyszla data)
  // wyjazdu - domyslnie stepper pokazuje sie tylko dla wspomnien (isMemory). Uzywane przez
  // "Stworz wyjazd" i taps w aktywne wyjazdy w dzienniku.
  const forceEdit = searchParams.get("edit") === "1";
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  const [planMapOpen, setPlanMapOpen] = useState(false);
  // Okladka planu wyjazdu: zdjecie (false) lub mapka (true) - toggle klikiem w miniaturke.
  const [heroShowMap, setHeroShowMap] = useState(false);
  // Czy plan wyjazdu jest przewiniety (okladka zjechala) -> sticky pasek back+X dostaje tlo.
  const [planScrolled, setPlanScrolled] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  // Miniatura eksploracji = OSOBNA okladka (routes.list_cover_url), niezalezna od okladki trasy.
  const [listCoverPickerOpen, setListCoverPickerOpen] = useState(false);
  // Podglad "jak okladka wyglada w eksploracji" (fullscreen mock karty trasy).
  // QR do udostepnienia wyjazdu (arkusz z kodem + linkiem).
  const [qrShareOpen, setQrShareOpen] = useState(false);
  const [memoTab, setMemoTab] = useState<"notki" | "galeria">("notki");
  // Pod-zakladki w widoku wspomnienia: galeria zdjec / plan dnia.
  // Wpis dziennika (wlasciciel): 3-etapowy stepper. 1 Trasa (edycja) -> 2 Notki -> 3 Zdjecia.
  // Krok startowy z URL (?step=2) - wejscie "Przejdz do sugestii" z kompozycji ladauje od razu
  // na kroku sugestii+notek (plan miejsc user ulozyl juz w ComposeWyjazd).
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    // Bez kroku "Trasa" (step 1) - miejsca ustawia sie w ComposeWyjazd. Domyslnie Sugestie (2).
    const s = searchParams.get("step");
    return s === "3" ? 3 : 2;
  });
  // Po ukonczeniu steppera ("Gotowe") wpis przechodzi w tryb PODSUMOWANIA (read-only:
  // Miejsca+notki | Zdjecia). Edycja (olowek) wraca do steppera. localReviewed = optymistyczne
  // przejscie do podsumowania zanim refetch route zaktualizuje plan_finalized.
  const [summaryTab, setSummaryTab] = useState<"plan" | "galeria">("plan");
  // Widok "Plan wyjazdu" (aktywny): top-toggle Miejsca | Galeria (komplet: plan+mapa albo zdjęcia).
  const [planTab, setPlanTab] = useState<"miejsca" | "galeria" | "mapa">("miejsca");
  const [editingStepper, setEditingStepper] = useState(false);
  // Fokus w polu notki -> chowamy dolny pasek CTA (klawiatura zabiera miejsce, guziki przeszkadzaja).
  const [noteFocused, setNoteFocused] = useState(false);
  const [localReviewed, setLocalReviewed] = useState(false);
  // Wybrany dzien (trasa wielodniowa). Domyslnie dzien z URL.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  // Fullscreen podglad zdjecia z galerii.
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);
  // Podglad wizytowki miejsca po kliknieciu w pin.
  const [detailPin, setDetailPin] = useState<any | null>(null);
  // Edycja planu dnia (po minieciu daty, przed "Zapisz plan dnia").
  // draft.dayId = ktory dzien edytowany; draft.pins = robocza lista.
  const [draft, setDraft] = useState<{ dayId: string; pins: any[] } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  // Popup po finalizacji planu: udostepnic w Eksploruj czy zostawic prywatna.
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  // Arkusz udostepniania (skrot obok ikony edycji): widocznosc + podpis + osoby.
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // Badge "Nowa trasa!" w JournalTab znika po wejsciu w wpis.
  useEffect(() => {
    if (!routeId || !user) return;
    void supabase.rpc("dismiss_route_badge", { p_route_id: routeId } as any).then(() => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    });
  }, [routeId, user, queryClient]);

  const [photos, setPhotos] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [shareAnonymous, setShareAnonymous] = useState(false);
  const [shareFriends, setShareFriends] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSaved, setNoteSaved] = useState<Record<string, boolean>>({});
  const noteTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Zdjecia przypisane do konkretnego miejsca (pins.images). Osobny input (web) + spinner per pin.
  const pinFileInputRef = useRef<HTMLInputElement>(null);
  const pinTargetRef = useRef<any>(null);
  // Nowe zdjecie -> od razu okladka wyjazdu (input web; native uzywa CapCamera).
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const listCoverFileInputRef = useRef<HTMLInputElement>(null);
  const [pinUploadingId, setPinUploadingId] = useState<string | null>(null);
  // Zwinięte/rozwinięte notki per miejsce (pin.id) na widoku Sugestii - domyślnie zwinięte ("+ Twoja sugestia").
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  // Arkusz "Dodaj zdjęcia do miejsca": wybór ze zdjęć galerii wyjazdu (przypisanie) albo nowe. Trzyma pin.id.
  const [pinPickerId, setPinPickerId] = useState<string | null>(null);
  // "Twoja sugestia dla innych podroznych" (poziom trasy) - review_narrative. Autosave debounce.
  const [suggestion, setSuggestion] = useState("");
  const [suggestionSaved, setSuggestionSaved] = useState(false);
  const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Udostepnianie historycznej trasy: podpis + oznaczeni czlonkowie (#11).
  const [shareCaption, setShareCaption] = useState("");

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, user_id, city, day_number, start_date, end_date, folder_id, plan_finalized, trip_type, ai_summary, ai_highlight, review_photos, cover_url, list_cover_url, is_shared, share_friends, group_session_id, overall_rating, review_narrative")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

  const folderId = route?.folder_id ?? null;

  // Autor trasy (wlasciciel) - do naglowka (awatar + @username), zamiast badge "Plan wyjazdu".
  const { data: routeAuthor } = useQuery({
    queryKey: ["review-route-author", route?.user_id],
    enabled: !!route?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("username, first_name, avatar_url").eq("id", route!.user_id).maybeSingle();
      return data as { username: string | null; first_name: string | null; avatar_url: string | null } | null;
    },
  });

  // Dni trasy: jesli wpis nalezy do folderu (trasa wielodniowa) - wszystkie dni;
  // inaczej tylko ten jeden route. Jeden wpis w dzienniku = cala trasa, dni
  // przelaczane wewnatrz.
  const { data: dayRoutes = [] } = useQuery({
    queryKey: ["review-trip-days", folderId, routeId],
    queryFn: async () => {
      if (!route) return [];
      if (!folderId) return [route];
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, end_date, plan_finalized, trip_type, ai_summary, ai_highlight, review_photos, cover_url, list_cover_url")
        .eq("folder_id", folderId)
        .eq("user_id", route.user_id)
        .order("day_number", { ascending: true });
      return (data && data.length) ? data : [route];
    },
    enabled: !!route,
  });

  const sortedDays = useMemo(
    () => [...dayRoutes].sort((a: any, b: any) => (a.day_number ?? 0) - (b.day_number ?? 0)),
    [dayRoutes],
  );
  const isMultiDay = sortedDays.length > 1;
  const dayRouteIds = useMemo(() => sortedDays.map((d: any) => d.id), [sortedDays]);
  const activeRouteId = selectedDayId && dayRouteIds.includes(selectedDayId) ? selectedDayId : routeId;
  const activeDay = sortedDays.find((d: any) => d.id === activeRouteId) ?? route;

  // Init sugestii z danych trasy (review_narrative).
  useEffect(() => {
    if (!route) return;
    setSuggestion(route.review_narrative ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.id]);

  // Autosave sugestii dla innych podroznych (debounce, jak notki miejsc).
  const saveSuggestion = (answer: string) => {
    if (!routeId || !user) return;
    if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
    suggestionTimer.current = setTimeout(async () => {
      await (supabase as any).from("routes").update({ review_narrative: answer.trim() || null }).eq("id", routeId);
      setSuggestionSaved(true);
      setTimeout(() => setSuggestionSaved(false), 2000);
    }, 700);
  };

  // Domyslny wybrany dzien = dzien z URL (pierwszy raz po zaladowaniu).
  useEffect(() => {
    if (!selectedDayId && routeId && dayRouteIds.includes(routeId)) setSelectedDayId(routeId);
  }, [routeId, dayRouteIds, selectedDayId]);

  // Pins wszystkich dni naraz (grupowane po route_id).
  const idsKey = dayRouteIds.join(",");
  const { data: allPins = [] } = useQuery({
    queryKey: ["review-all-pins", idsKey],
    queryFn: async () => {
      if (!dayRouteIds.length) return [];
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, route_id, place_name, address, category, suggested_time, description, image_url, images, user_photo_urls, latitude, longitude, place_id, photo_url, pin_order, visited_at")
        .in("route_id", dayRouteIds)
        .order("pin_order", { ascending: true });
      return data ?? [];
    },
    enabled: dayRouteIds.length > 0,
  });
  const currentPins = useMemo(
    () => allPins.filter((p: any) => p.route_id === activeRouteId),
    [allPins, activeRouteId],
  );

  // Mapa: url zdjęcia -> nazwa miejsca, do którego zostało przypisane (pins.images). Badge w galerii.
  const photoPlaceLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const pin of currentPins) {
      const imgs = Array.isArray(pin.images) ? pin.images : [];
      for (const u of imgs) if (u && !m.has(u)) m.set(u, pin.place_name);
    }
    return m;
  }, [currentPins]);

  // Zdjecia miejsc trasy do wyboru jako okladka wyjazdu (tylko te z rozwiazywalnym URL-em).
  const coverOptions = useMemo(
    () => currentPins
      .map((pin: any) => ({
        id: pin.id as string,
        name: pin.place_name as string,
        url: resolveStored(pin.photo_url || pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null)),
      }))
      .filter((o): o is { id: string; name: string; url: string } => !!o.url),
    [currentPins],
  );

  // Opis + tagi (vibe_tags) z tabeli places - dla wizytowek i kart (lista/szczegoly).
  // Piny nie maja vibe_tags, wiec dociagamy je po nazwie miejsca + miescie.
  const placeNames = useMemo(
    () => [...new Set(allPins.map((p: any) => p.place_name).filter(Boolean))],
    [allPins],
  );
  const { data: placeMeta = {} } = useQuery({
    queryKey: ["review-place-meta", route?.city, placeNames.join("|")],
    queryFn: async () => {
      if (!placeNames.length || !route?.city) return {};
      const { data } = await (supabase as any)
        .from("places")
        .select("place_name, description, vibe_tags")
        .ilike("city", `${route.city}%`)
        .in("place_name", placeNames);
      const map: Record<string, { description: string | null; tags: string[] }> = {};
      for (const pl of data ?? []) {
        map[String(pl.place_name).toLowerCase()] = {
          description: pl.description ?? null,
          tags: Array.isArray(pl.vibe_tags) ? pl.vibe_tags.filter(Boolean) : [],
        };
      }
      return map;
    },
    enabled: placeNames.length > 0 && !!route?.city,
  });
  const metaFor = (pin: any): { description: string | null; tags: string[] } =>
    (placeMeta as Record<string, any>)[String(pin?.place_name ?? "").toLowerCase()] ?? { description: null, tags: [] };

  // Group session: participants (awatary w hero).
  const { data: groupParticipants = [] } = useQuery({
    queryKey: ["review-summary-participants", route?.group_session_id],
    queryFn: async () => {
      if (!route?.group_session_id) return [];
      const { data: members } = await (supabase as any)
        .from("group_session_members")
        .select("user_id")
        .eq("session_id", route.group_session_id);
      if (!members?.length) return [];
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      return (profiles ?? []) as { id: string; username: string | null; first_name: string | null; avatar_url: string | null }[];
    },
    enabled: !!route?.group_session_id,
  });

  // Group session: zdjecia innych uczestnikow (do wspolnej galerii).
  const { data: groupPhotos = [] } = useQuery({
    queryKey: ["review-summary-group-photos", route?.group_session_id],
    queryFn: async () => {
      if (!route?.group_session_id || !user) return [];
      const { data: groupRoutes } = await supabase
        .from("routes")
        .select("id, user_id, review_photos")
        .eq("group_session_id", route.group_session_id)
        .neq("user_id", user.id);
      if (!groupRoutes?.length) return [];
      const userIds = [...new Set(groupRoutes.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      return groupRoutes.flatMap((r: any) =>
        (r.review_photos ?? []).map((url: string) => ({
          url,
          userId: r.user_id,
          username: profileMap[r.user_id]?.first_name || profileMap[r.user_id]?.username || t("labels.participant"),
        }))
      );
    },
    enabled: !!route?.group_session_id,
  });

  // Notki miejsc (wszystkie dni naraz).
  const { data: existingNotes = [] } = useQuery({
    queryKey: ["pin-notes", idsKey, user?.id],
    queryFn: async () => {
      if (!dayRouteIds.length || !user) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("route_id, place_name, note")
        .in("route_id", dayRouteIds)
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: dayRouteIds.length > 0 && !!user,
  });

  useEffect(() => {
    if (route?.review_photos?.length) setPhotos(route.review_photos);
    if (route?.is_shared != null) setIsPublic(route.is_shared);
    if (typeof (route as any)?.share_friends === "boolean") setShareFriends((route as any).share_friends);
  }, [route?.review_photos, route?.is_shared, (route as any)?.share_friends]);

  // Podpis + oznaczeni czlonkowie: osobny best-effort load (kolumny z migracji
  // 20260705). Gdy migracja jeszcze nie zaaplikowana -> po prostu brak wartosci,
  // nie wywalamy calego ekranu podsumowania.
  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("routes").select("share_caption, share_anonymous").eq("id", routeId).maybeSingle();
        if (error) return;
        if (data?.share_caption) setShareCaption(data.share_caption);
        if (typeof data?.share_anonymous === "boolean") setShareAnonymous(data.share_anonymous);
      } catch (e) {
        console.warn("[ReviewSummary] share-meta load skipped:", e);
      }
    })();
  }, [routeId]);

  const saveShareMeta = async (caption: string) => {
    if (!routeId) return;
    try {
      await (supabase as any).from("routes").update({ share_caption: caption.trim() || null }).eq("id", routeId);
    } catch (e) {
      console.warn("[ReviewSummary] saveShareMeta failed:", e);
    }
  };

  // Auto-rozwiniecie notek z trescia (raz) - zeby przy wejsciu w edycje bylo widac, ze uzupelnione.
  const notesAutoOpened = useRef(false);
  useEffect(() => {
    if (!existingNotes.length) return;
    const nmap: Record<string, string> = {};
    for (const r of existingNotes) {
      const k = rkey(r.route_id, r.place_name);
      if (r.note) nmap[k] = r.note;
    }
    setNotes(nmap);
    // Rozwin notki miejsc, ktore juz maja tresc (dopasowanie po route_id+place_name -> pin.id).
    if (!notesAutoOpened.current && allPins.length) {
      const ids = new Set<string>();
      for (const p of allPins as any[]) {
        if (nmap[rkey(p.route_id, p.place_name)]) ids.add(p.id);
      }
      if (ids.size) { setOpenNotes((prev) => new Set([...prev, ...ids])); notesAutoOpened.current = true; }
    }
  }, [existingNotes, allPins]);

  // Udostepnij link do publicznej trasy (/#/route/:id). HashRouter => link z #.
  const shareUrl = routeId ? `https://trasa.travel/#/route/${routeId}` : "";
  const shareLink = async () => {
    if (!routeId) return;
    const res = await share({ title: route?.title || route?.city || "Trasa", text: t("share.text"), url: shareUrl });
    if (res.ok && res.method === "clipboard") notify.success(t("toast.link_copied"));
  };
  // Kopiowanie linku do schowka (arkusz QR).
  const copyShareLink = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); notify.success(t("toast.link_copied")); }
    catch { shareLink(); }
  };

  // Widocznosc trasy: profil (publicznie z profilem) | anon (publicznie anonimowo) | private.
  const setVisibility = async (mode: "profile" | "anon" | "private") => {
    const pub = mode !== "private";
    const anon = mode === "anon";
    setIsPublic(pub);
    setShareAnonymous(anon);
    if (routeId) {
      await supabase.from("routes").update({ is_shared: pub, share_anonymous: anon } as any).eq("id", routeId);
      queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      // Feed Eksploruj (Anonim vs profil na kartach tras) - wymus odswiezenie.
      queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
      queryClient.invalidateQueries({ queryKey: ["shared-route-meta", routeId] });
    }
  };
  // Kompat: showSharePrompt uzywa togglePublic(true/false).
  const togglePublic = (val: boolean) => setVisibility(val ? "profile" : "private");

  // 3-poziomowa widocznosc (Ustawienia prywatnosci): Tylko ja / Bliscy znajomi / Wszyscy.
  const privacyMode: "public" | "friends" | "private" = isPublic ? "public" : shareFriends ? "friends" : "private";
  const setPrivacy = async (mode: "public" | "friends" | "private") => {
    const pub = mode === "public";
    const fri = mode === "friends";
    setIsPublic(pub); setShareFriends(fri);
    if (!pub) setShareAnonymous(false);
    if (!routeId) return;
    await supabase.from("routes").update({ is_shared: pub, share_friends: fri, ...(pub ? {} : { share_anonymous: false }) } as any).eq("id", routeId);
    queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
    queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
    queryClient.invalidateQueries({ queryKey: ["shared-route-meta", routeId] });
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || !routeId || !user) return;
    setUploading(true);
    const newUrls: string[] = [];
    let failed = 0;
    for (const rawFile of files.slice(0, MAX_PHOTOS - photos.length)) {
      try {
        // iPhone robi zdjecia w HEIC/HEIF - canvas/Image w WebView tego nie zdekoduje, wiec
        // compressImage rzucalo, a blad byl polykany (zdjecie nie dodawalo sie, bez komunikatu).
        // Konwertujemy HEIC->JPEG przed kompresja (jak w dashboardzie biznesu).
        const file = isHeic(rawFile) ? await convertHeicToJpeg(rawFile) : rawFile;
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const path = `${user.id}/${routeId}/review_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const { error } = await supabase.storage
          .from("route-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (error) { failed++; console.error("[ReviewSummary] photo upload failed:", error.message); continue; }
        newUrls.push(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
      } catch (err: any) {
        failed++;
        console.error("[ReviewSummary] photo processing failed:", err?.message ?? err);
      }
    }
    if (newUrls.length) {
      const updated = [...photos, ...newUrls];
      setPhotos(updated);
      await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
      queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
      // Auto-miniatura eksploracji: gdy trasa nie ma jeszcze list_cover_url, ustaw LOSOWE
      // zdjecie z galerii (task 3) - trasa "finalizuje sie" i pojawia w eksploracji.
      await ensureListCover(routeId, updated);
    }
    // Nie chowaj cichych bledow - jesli nic sie nie dodalo (albo tylko czesc), powiedz o tym.
    if (failed > 0) notify.error(newUrls.length === 0 ? t("toast.photo_upload_error") : t("toast.photo_upload_partial"));
    setUploading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNativePhotoPick = async () => {
    if (uploading) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    try {
      const result = await CapCamera.pickImages({ quality: 90, limit: remaining, width: 1200, height: 1200 });
      const files: File[] = [];
      for (const photo of result.photos) {
        if (!photo.webPath) continue;
        try {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const fmt = photo.format || "jpeg";
          const mime = fmt === "png" ? "image/png" : "image/jpeg";
          files.push(new File([blob], `review-${Date.now()}-${files.length}.${fmt}`, { type: mime }));
        } catch {}
      }
      if (files.length) await processFiles(files);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) return;
      console.error("[ReviewSummary] native photo pick failed:", msg);
      notify.error(t("toast.photo_pick_error"));
    }
  };

  const triggerPhotoPick = () => {
    if (isNative) handleNativePhotoPick();
    else fileInputRef.current?.click();
  };

  // ── Zdjecia per-miejsce (pins.images) ─────────────────────────────────────
  // Wspoldzielony rdzen uploadu: HEIC->JPEG, kompresja, wrzut do route-images, zwrot URL-i.
  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (!routeId || !user || !files.length) return [];
    const urls: string[] = [];
    let failed = 0;
    for (const rawFile of files) {
      try {
        const file = isHeic(rawFile) ? await convertHeicToJpeg(rawFile) : rawFile;
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const path = `${user.id}/${routeId}/pin_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const { error } = await supabase.storage.from("route-images").upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (error) { failed++; console.error("[ReviewSummary] pin photo upload failed:", error.message); continue; }
        urls.push(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
      } catch (err: any) { failed++; console.error("[ReviewSummary] pin photo processing failed:", err?.message ?? err); }
    }
    if (failed > 0) notify.error(urls.length === 0 ? t("toast.photo_upload_error") : t("toast.photo_upload_partial"));
    return urls;
  };

  // Native photo picker -> lista File (wspolne dla galerii i zdjec per-miejsce).
  const pickNativeImageFiles = async (limit: number): Promise<File[]> => {
    const result = await CapCamera.pickImages({ quality: 90, limit, width: 1200, height: 1200 });
    const files: File[] = [];
    for (const photo of result.photos) {
      if (!photo.webPath) continue;
      try {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const fmt = photo.format || "jpeg";
        const mime = fmt === "png" ? "image/png" : "image/jpeg";
        files.push(new File([blob], `pin-${Date.now()}-${files.length}.${fmt}`, { type: mime }));
      } catch {}
    }
    return files;
  };

  // Zapis nowej listy zdjec pinu: optymistyczny cache ["review-all-pins"] + DB update pins.images.
  const commitPinImages = async (pin: any, images: string[]) => {
    queryClient.setQueryData(["review-all-pins", idsKey], (old: any) =>
      (old ?? []).map((p: any) => (p.id === pin.id ? { ...p, images } : p)));
    const { error } = await (supabase as any).from("pins").update({ images }).eq("id", pin.id);
    if (error) { notify.error(t("toast.photo_upload_error")); queryClient.invalidateQueries({ queryKey: ["review-all-pins", idsKey] }); }
  };

  const addPinPhotos = async (pin: any, files: File[]) => {
    if (!files.length) return;
    setPinUploadingId(pin.id);
    const urls = await uploadImages(files.slice(0, 8));
    if (urls.length) {
      const cur = Array.isArray(pin.images) ? pin.images : [];
      await commitPinImages(pin, [...cur, ...urls]);
    }
    setPinUploadingId(null);
  };

  const removePinPhoto = async (pin: any, url: string) => {
    haptics.light();
    const cur = Array.isArray(pin.images) ? pin.images : [];
    await commitPinImages(pin, cur.filter((u: string) => u !== url));
  };

  // Przypisanie/odpiecie zdjecia z galerii wyjazdu do miejsca (toggle).
  const toggleAssignPinPhoto = async (pin: any, url: string) => {
    haptics.light();
    const cur = Array.isArray(pin.images) ? pin.images : [];
    await commitPinImages(pin, cur.includes(url) ? cur.filter((u: string) => u !== url) : [...cur, url]);
  };

  const triggerPinPhotoPick = async (pin: any) => {
    if (pinUploadingId) return;
    haptics.light();
    if (isNative) {
      try {
        const files = await pickNativeImageFiles(8);
        if (files.length) await addPinPhotos(pin, files);
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) return;
        console.error("[ReviewSummary] native pin photo pick failed:", msg);
        notify.error(t("toast.photo_pick_error"));
      }
    } else {
      pinTargetRef.current = pin;
      pinFileInputRef.current?.click();
    }
  };

  const handlePinFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = pinTargetRef.current;
    const files = Array.from(e.target.files ?? []);
    if (pin && files.length) await addPinPhotos(pin, files);
    if (pinFileInputRef.current) pinFileInputRef.current.value = "";
    pinTargetRef.current = null;
  };

  // Zdjecia uzytkownika ze wszystkich dni (do wspolnej galerii). owner = route_id
  // do ktorego zdjecie nalezy (potrzebne przy usuwaniu).
  const myPhotos = useMemo(() => {
    const seen = new Set<string>();
    const out: { url: string; owner: string }[] = [];
    photos.forEach((u) => { if (u && !seen.has(u)) { seen.add(u); out.push({ url: u, owner: routeId! }); } });
    sortedDays.forEach((d: any) => (d.review_photos ?? []).forEach((u: string) => {
      if (u && !seen.has(u)) { seen.add(u); out.push({ url: u, owner: d.id }); }
    }));
    return out;
  }, [photos, sortedDays, routeId]);

  // Opcje okladki wyjazdu: NAJPIERW Twoje zdjecia z galerii (z etykieta miejsca gdy przypisane),
  // potem zdjecia miejsc trasy (bez duplikatow). Uzywane w arkuszu wyboru okladki.
  const coverPickerOptions = useMemo(() => {
    const gallery = myPhotos.map(({ url }) => ({ id: `g:${url}`, name: photoPlaceLabel.get(url) ?? "Twoje zdjęcie", url: resolveStored(url) ?? url }));
    const seen = new Set(gallery.map((o) => o.url));
    const places = coverOptions.filter((o) => !seen.has(o.url));
    return [...gallery, ...places];
  }, [myPhotos, coverOptions, photoPlaceLabel]);

  // Okladka wpisu = pierwsze zdjecie primary route (myPhotos[0]). Przenosi url na
  // poczatek review_photos primary route (dziala tez dla zdjec z innych dni/grupy).
  const setCover = async (url: string) => {
    if (!routeId) return;
    const updated = [url, ...photos.filter((p) => p !== url)];
    setPhotos(updated);
    // Zdjecie usera jako okladka -> czyscimy recznie wybrana okladke miejsca (cover_url),
    // zeby to zdjecie faktycznie stalo sie tlem (planCover ma wyzszy priorytet).
    // Okladka wyjazdu (tlo hero) = OSOBNA od miniatury eksploracji (list_cover_url). Zmiana
    // okladki NIE dotyka miniatury - eksploracje zmienia tylko osobny picker miniatury.
    await supabase.from("routes").update({ review_photos: updated, cover_url: null } as any).eq("id", routeId);
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, cover_url: null } : old);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    setViewerUrl(null);
    notify.success(t("toast.cover_set"));
  };

  // Nowe zdjecie z galerii telefonu -> upload do route-images -> od razu okladka wyjazdu.
  // (widok jak przy dodawaniu zdjec do miejsc). Trafia tez do galerii wyjazdu (review_photos).
  const addNewCoverPhoto = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true);
    const urls = await uploadImages(files.slice(0, 1));
    setUploading(false);
    if (urls[0]) { setCoverPickerOpen(false); await setCover(urls[0]); }
  };
  const triggerCoverPhotoPick = async () => {
    if (uploading) return;
    if (isNative) { try { const f = await pickNativeImageFiles(1); await addNewCoverPhoto(f); } catch { /* cancel */ } }
    else coverFileInputRef.current?.click();
  };
  const handleCoverFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addNewCoverPhoto(Array.from(e.target.files ?? []));
    if (coverFileInputRef.current) coverFileInputRef.current.value = "";
  };

  // Recznie wybrana okladka wyjazdu = zdjecie jednego z miejsc trasy. Zapis do routes.cover_url.
  const setPlanCover = async (url: string) => {
    if (!routeId) return;
    setCoverPickerOpen(false);
    // Okladka wyjazdu (tlo hero) = OSOBNA od miniatury eksploracji (list_cover_url) - patrz setCover.
    const { error } = await (supabase as any).from("routes").update({ cover_url: url }).eq("id", routeId);
    if (error) { notify.error(t("toast.cover_set_error", { defaultValue: "Nie udało się ustawić okładki" })); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, cover_url: url } : old);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success(t("toast.cover_set"));
  };

  // ── Miniatura eksploracji (list_cover_url) - OSOBNA okladka od okladki trasy (cover_url). ──
  // Reczny wybor zdjecia (galeria / miejsca trasy). Zapis do routes.list_cover_url.
  const setPlanListCover = async (url: string) => {
    if (!routeId) return;
    setListCoverPickerOpen(false);
    const { error } = await (supabase as any).from("routes").update({ list_cover_url: url }).eq("id", routeId);
    if (error) { notify.error(t("toast.cover_set_error", { defaultValue: "Nie udało się ustawić okładki" })); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, list_cover_url: url } : old);
    queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
    queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success(t("toast.cover_set"));
  };
  // Nowe zdjecie z telefonu -> upload -> miniatura eksploracji (+ trafia tez do galerii wyjazdu).
  const addNewListCoverPhoto = async (files: File[]) => {
    if (!files.length || uploading || !routeId) return;
    setUploading(true);
    const urls = await uploadImages(files.slice(0, 1));
    setUploading(false);
    if (!urls[0]) return;
    const updated = photos.includes(urls[0]) ? photos : [...photos, urls[0]];
    setPhotos(updated);
    await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
    await setPlanListCover(urls[0]);
  };
  const triggerListCoverPhotoPick = async () => {
    if (uploading) return;
    if (isNative) { try { const f = await pickNativeImageFiles(1); await addNewListCoverPhoto(f); } catch { /* cancel */ } }
    else listCoverFileInputRef.current?.click();
  };
  const handleListCoverFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addNewListCoverPhoto(Array.from(e.target.files ?? []));
    if (listCoverFileInputRef.current) listCoverFileInputRef.current.value = "";
  };
  // Auto-losowanie miniatury (task 3): gdy trasa ma zdjecia usera a brak miniatury, ustaw LOSOWE
  // zdjecie z galerii na list_cover_url. Dzieki temu trasa "finalizuje sie" i pojawia w eksploracji
  // bez recznego ustawiania okladek. NIE nadpisuje juz ustawionej miniatury (auto ani recznej).
  const ensureListCover = async (rid: string | null, poolUrls?: string[]) => {
    if (!rid) return;
    const pool = (poolUrls && poolUrls.length ? poolUrls : coverPickerOptions.map((o) => o.url))
      .map((u) => resolveStored(u) ?? u)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    if (pool.length === 0) return;
    const r: any = queryClient.getQueryData(["review-summary-route", rid]);
    if (r?.list_cover_url) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    await (supabase as any).from("routes").update({ list_cover_url: pick }).eq("id", rid);
    queryClient.setQueryData(["review-summary-route", rid], (old: any) => old ? { ...old, list_cover_url: pick } : old);
    queryClient.invalidateQueries({ queryKey: ["discovery-city-routes"] });
    queryClient.invalidateQueries({ queryKey: ["discovery-polecane"] });
  };

  // Usuwanie zdjecia: optymistycznie znika z galerii, faktyczny DB update ODROCZONY o okno
  // "Cofnij" (5s). Undo przywraca zdjecie (DB niezmieniona -> refetch je wraca).
  const removePhoto = (url: string, owner: string) => {
    const isPrimary = owner === routeId;
    const prevPhotos = photos;
    let commitUpdated: string[];
    if (isPrimary) {
      commitUpdated = photos.filter((p) => p !== url);
      setPhotos(commitUpdated);
      // Real-time: myPhotos scala `photos` z `sortedDays[].review_photos`, wiec optymistycznie
      // aktualizujemy tez cache route + dni (inaczej zdjecie wracaloby do galerii przed commitem).
      queryClient.setQueryData(["review-summary-route", routeId], (old: any) =>
        old ? { ...old, review_photos: commitUpdated } : old);
      queryClient.setQueryData(["review-trip-days", folderId, routeId], (old: any) =>
        (old ?? []).map((d: any) => (d.id === routeId ? { ...d, review_photos: commitUpdated } : d)));
    } else {
      const dr = sortedDays.find((d: any) => d.id === owner);
      commitUpdated = (dr?.review_photos ?? []).filter((p: string) => p !== url);
      queryClient.setQueryData(["review-trip-days", folderId, routeId], (old: any) =>
        (old ?? []).map((d: any) => (d.id === owner ? { ...d, review_photos: commitUpdated } : d)));
    }
    setViewerUrl(null);
    deferDelete({
      message: t("toast.photo_deleted"),
      onUndo: () => {
        if (isPrimary) setPhotos(prevPhotos);
        queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
        queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
      },
      commit: async () => {
        await supabase.from("routes").update({ review_photos: commitUpdated } as any).eq("id", isPrimary ? routeId : owner);
        queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
      },
    });
  };

  // Wyjscie z trybu edycji (stepper) do read-only PODSUMOWANIA - ta sama logika co "Gotowe",
  // ale dostepna na kazdym kroku. Zapisuje draft planu, oznacza wpis jako zrecenzowany
  // (plan_finalized) i pokazuje podsumowanie zamiast steppera.
  const finishEditing = async () => {
    haptics.success();
    if (draft && draft.dayId === activeRouteId) await savePlan(false);
    // "Zapisz trase" = trasa STWORZONA: status draft->published. Dopiero teraz zdjecia z pinow
    // (pins.images) zasilaja okladki miejsc w wyszukiwarce/eksploracji - fetchPlaceUserPhotos
    // pomija piny tras 'draft'. Podczas tworzenia (draft) zdjecia sa tylko lokalnie na wpisie.
    try {
      await (supabase as any).from("routes").update({ status: "published" })
        .in("id", dayRouteIds.length ? dayRouteIds : [activeRouteId]);
    } catch (e: any) { console.error("[ReviewSummary] publish status failed:", e?.message ?? e); }
    // Aktywny wyjazd (przyszla data, isMemory=false): NIE finalizujemy. Wpis staje sie
    // zakonczony (pocztowka) dopiero PO minieciu daty. Wyjscie z edycji zapisuje i wraca do dziennika.
    if (!isMemory) {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      navigate("/dziennik");
      return;
    }
    try {
      await (supabase as any).from("routes").update({ plan_finalized: true }).in("id", dayRouteIds.length ? dayRouteIds : [activeRouteId]);
    } catch (e: any) { console.error("[ReviewSummary] finishEditing failed:", e?.message ?? e); }
    // Auto-miniatura eksploracji przy finalizacji (task 3) - jesli trasa ma zdjecia a brak miniatury.
    await ensureListCover(routeId);
    setLocalReviewed(true); setEditingStepper(false); setSummaryTab("plan");
    queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
  };

  const handleNoteChange = (placeName: string, value: string) => {
    if (!activeRouteId) return;
    const k = rkey(activeRouteId, placeName);
    setNotes((prev) => ({ ...prev, [k]: value }));
    if (noteTimer.current[k]) clearTimeout(noteTimer.current[k]);
    noteTimer.current[k] = setTimeout(async () => {
      if (!user) return;
      await (supabase as any).from("pin_ratings").upsert({
        route_id: activeRouteId,
        user_id: user.id,
        place_name: placeName,
        note: value || null,
      }, { onConflict: "route_id,user_id,place_name" });
      setNoteSaved((prev) => ({ ...prev, [k]: true }));
      setTimeout(() => setNoteSaved((prev) => ({ ...prev, [k]: false })), 2000);
    }, 800);
  };

  // ── Edycja planu dnia (#4/#5) ──
  const workingPins = draft && draft.dayId === activeRouteId ? draft.pins : currentPins;

  // ── Odwiedzone (checklist "Bylem tu") - reczne oznaczanie, backed by pins.visited_at.
  // "Dni z dat": visited_at to timestamp, wiec wspomnienie moze grupowac po dacie odwiedzenia.
  // (Auto check-in GPS = Stage 2). visitedOverrides = optymistyczny stan przed refetchem.
  const [visitedOverrides, setVisitedOverrides] = useState<Record<string, boolean>>({});
  const isVisited = (pin: any) =>
    visitedOverrides[pin.id] ?? !!(allPins.find((p: any) => p.id === pin.id)?.visited_at);
  const visitedCount = currentPins.filter((p: any) => isVisited(p)).length;
  const toggleVisited = async (pin: any) => {
    const next = !isVisited(pin);
    setVisitedOverrides((o) => ({ ...o, [pin.id]: next }));
    try {
      await (supabase as any).from("pins")
        .update({ visited_at: next ? new Date().toISOString() : null })
        .eq("id", pin.id);
      queryClient.invalidateQueries({ queryKey: ["review-all-pins"] });
    } catch (e: any) {
      console.error("[ReviewSummary] toggleVisited failed:", e?.message ?? e);
      setVisitedOverrides((o) => ({ ...o, [pin.id]: !next })); // revert
    }
  };

  // GPS check-in (on-demand, one-shot): "Jestem tutaj" -> pobierz pozycje i oznacz pobliskie
  // (do 150 m) niezaliczone miejsca jako odwiedzone. Bez sledzenia w tle (prosto + prywatnie).
  const [checkingIn, setCheckingIn] = useState(false);
  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const coords = await requestLocation(true);
      if (!coords) { notify.error("Nie udało się pobrać lokalizacji"); return; }
      const nearby = currentPins.filter((p: any) =>
        !isVisited(p) && typeof p.latitude === "number" && typeof p.longitude === "number" &&
        haversineKm(coords, { lat: p.latitude, lng: p.longitude }) < 0.15,
      );
      if (nearby.length === 0) { notify.error("Brak zapisanych miejsc w pobliżu (150 m)"); return; }
      for (const p of nearby) await toggleVisited(p);
      notify.success(nearby.length === 1
        ? `Oznaczono „${nearby[0].place_name}" jako odwiedzone`
        : `Oznaczono ${nearby.length} miejsca w pobliżu`);
    } catch (e: any) {
      console.error("[ReviewSummary] check-in failed:", e?.message ?? e);
      notify.error("Nie udało się sprawdzić lokalizacji");
    } finally {
      setCheckingIn(false);
    }
  };

  // Pasek postepu "X/Y odwiedzone" + (aktywny wyjazd) przycisk GPS "Jestem tutaj".
  const renderVisitedProgress = () => {
    if (!activeChecklist || currentPins.length === 0) return null;
    const pct = Math.round((visitedCount / currentPins.length) * 100);
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-muted-foreground">Odwiedzone</span>
          <span className="text-xs font-bold text-foreground">{visitedCount}/{currentPins.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        {!isMemory && visitedCount < currentPins.length && (
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <MapPin className="h-3.5 w-3.5" />
            {checkingIn ? "Sprawdzam..." : "Jestem tutaj - oznacz pobliskie"}
          </button>
        )}
      </div>
    );
  };

  // Przycisk toggle "Bylem tu" na miejscu (zielony ptaszek gdy odwiedzone). Tylko w aktywnej checkliscie.
  const renderVisitedToggle = (pin: any) => {
    if (!activeChecklist) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleVisited(pin); }}
        aria-label={isVisited(pin) ? "Odznacz odwiedzone" : "Byłem tu"}
        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isVisited(pin) ? "bg-green-500 text-white" : "bg-white border border-border text-muted-foreground active:bg-muted"
        }`}
      >
        <Check className="h-4 w-4" strokeWidth={2.6} />
      </button>
    );
  };

  const setWorking = (next: any[]) => { if (activeRouteId) setDraft({ dayId: activeRouteId, pins: next }); };
  const movePin = (from: number, to: number) => {
    if (to < 0 || to >= workingPins.length) return;
    haptics.light();
    const next = [...workingPins];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setWorking(next);
  };
  const removeWorkingPin = (id: string) => {
    const pin = workingPins.find((p: any) => p.id === id);
    const name = pin?.place_name ? `„${pin.place_name}"` : t("confirm.place_this");
    if (!confirm(t("confirm.remove_place", { name }))) return;
    setWorking(workingPins.filter((p: any) => p.id !== id));
  };

  // Zapis edycji planu. finalize=true (wspomnienie): zamraza plan + odblokowuje
  // ocene/notki/share. finalize=false (aktywny wpis): tylko persystuje zmiany.
  const savePlan = async (finalize: boolean) => {
    if (!activeRouteId) return;
    setSavingPlan(true);
    try {
      const removed = currentPins.filter((p: any) => !workingPins.some((w: any) => w.id === p.id));
      if (removed.length) await supabase.from("pins").delete().in("id", removed.map((p: any) => p.id));
      await Promise.all(workingPins.map((p: any, idx: number) =>
        supabase.from("pins").update({ pin_order: idx } as any).eq("id", p.id)
      ));
      if (finalize) {
        // Finalizacja wspomnienia = trasa zakonczona: trip_type='completed' -> znika z ekranu
        // glownego (filtr planning/ongoing), zostaje w Dzienniku.
        await (supabase as any).from("routes").update({ plan_finalized: true, trip_type: "completed" }).eq("id", activeRouteId);
        queryClient.removeQueries({ queryKey: ["home-active-solo"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
      }
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["review-all-pins", idsKey] }),
        queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] }),
        queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] }),
      ]);
      notify.success(finalize ? t("toast.plan_saved") : t("toast.changes_saved"));
      // Po zatwierdzeniu planu (notki/oceny gotowe) - zapytaj o udostepnienie.
      if (finalize) setShowSharePrompt(true);
    } catch (e: any) {
      console.error("[ReviewSummary] savePlan failed:", e?.message ?? e);
      notify.error(t("toast.plan_save_error"));
    }
    setSavingPlan(false);
  };

  // Dodanie miejsca do planu aktywnego dnia (AddPinSheet zwraca PlanPin).
  const handleAddPin = async (pin: any) => {
    if (!activeRouteId || !user) { setAddingPlace(false); return; }
    const { data: row, error } = await (supabase as any)
      .from("pins")
      .insert({
        route_id: activeRouteId,
        place_name: pin.place_name,
        address: pin.address || null,
        description: pin.description || null,
        category: pin.category || "other",
        latitude: pin.latitude || null,
        longitude: pin.longitude || null,
        place_id: pin.place_id ?? null,
        suggested_time: pin.suggested_time || null,
        photo_url: pin.photoUrl ?? null,
        pin_order: workingPins.length,
        original_creator_id: user.id,
      })
      .select("id, route_id, place_name, address, category, suggested_time, description, image_url, images, latitude, longitude, place_id, photo_url, pin_order")
      .single();
    setAddingPlace(false);
    if (error || !row) { console.error("[ReviewSummary] add pin failed:", error?.message); notify.error(t("toast.add_place_error")); return; }
    // Jesli trwa edycja (draft) - dopisz do draftu zeby nie zginal przy kolejnym zapisie.
    if (draft && draft.dayId === activeRouteId) setDraft({ dayId: activeRouteId, pins: [...draft.pins, row] });
    queryClient.invalidateQueries({ queryKey: ["review-all-pins", idsKey] });
    notify.success(t("toast.place_added"));
  };

  // Autozapis: jesli user wyjdzie z edycji bez "Zapisz", persystujemy zmiany planu
  // (kolejnosc + usuniecia) w tle przy unmouncie. NIE finalizuje - wspomnienie
  // zostaje edytowalne, a aktywny wpis po prostu zachowuje zmiany.
  const autosaveRef = useRef<{ working: any[]; originalIds: string[] } | null>(null);
  useEffect(() => {
    if (!draft) { autosaveRef.current = null; return; }
    const originalIds = allPins.filter((p: any) => p.route_id === draft.dayId).map((p: any) => p.id);
    autosaveRef.current = { working: draft.pins, originalIds };
  }, [draft, allPins]);

  useEffect(() => () => {
    const a = autosaveRef.current;
    if (!a || !a.working.length) return;
    const removed = a.originalIds.filter((id) => !a.working.some((w: any) => w.id === id));
    if (removed.length) void supabase.from("pins").delete().in("id", removed);
    void Promise.all(a.working.map((p: any, idx: number) =>
      supabase.from("pins").update({ pin_order: idx } as any).eq("id", p.id)
    ));
  }, []);

  const cityLabel = route?.city || t("labels.trip_fallback");
  const isOwner = !!route && !!user && route.user_id === user.id;

  // Nazwa wpisu: wlasna (title) albo placeholder. Auto-tytul "City - Dzień N"
  // traktujemy jak brak wlasnej nazwy.
  const isAutoTitle = (t: string | null | undefined) =>
    !t || /(-\s*Dzień\s*\d+)$/i.test(t) || t === route?.city;
  const customName = isAutoTitle(route?.title) ? "" : (route?.title ?? "");
  const displayName = customName || (isOwner ? t("entry.add_name") : "");

  const saveName = async () => {
    if (!routeId) return;
    const trimmed = nameVal.trim();
    setSavingName(true);
    const { error } = await (supabase as any).from("routes").update({ title: trimmed || null }).eq("id", routeId);
    setSavingName(false);
    setEditingName(false);
    if (error) { notify.error(t("toast.name_save_error")); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, title: trimmed || null } : old);
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success(t("toast.name_saved"));
  };

  // Edycja daty wyjazdu (inline, z kalendarza) - zapisuje start_date/end_date na route.
  const saveDate = async (start: Date, numDays: number) => {
    if (!routeId) return;
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(addDays(start, Math.max(1, numDays) - 1), "yyyy-MM-dd");
    setDatePickerOpen(false);
    const { error } = await (supabase as any).from("routes").update({ start_date: startStr, end_date: endStr }).eq("id", routeId);
    if (error) { notify.error(t("toast.name_save_error")); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, start_date: startStr, end_date: endStr } : old);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success("Zapisano datę");
  };

  // Wyczyść daty wyjazdu (usun start/end).
  const clearDate = async () => {
    if (!routeId) return;
    setDatePickerOpen(false);
    const { error } = await (supabase as any).from("routes").update({ start_date: null, end_date: null }).eq("id", routeId);
    if (error) { notify.error(t("toast.name_save_error")); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, start_date: null, end_date: null } : old);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success("Usunięto daty");
  };

  // Zakres dat: trasa wielodniowa => "12 - 14 maja 2026", jednodniowa => "12 maja 2026".
  const dateLabel = useMemo(() => {
    const first = sortedDays[0]?.start_date;
    const lastRaw = sortedDays[sortedDays.length - 1];
    const last = lastRaw?.end_date ?? lastRaw?.start_date;
    if (!first) return "";
    const fd = new Date(first);
    if (isMultiDay && last) {
      const ld = new Date(last);
      return `${format(fd, "d", { locale: dateLocale() })} - ${format(ld, "d MMMM yyyy", { locale: dateLocale() })}`;
    }
    const single = route?.end_date && route.end_date !== route.start_date ? route.end_date : first;
    const sd = new Date(single);
    if (route?.end_date && route.end_date !== route.start_date) {
      return `${format(fd, "d", { locale: dateLocale() })} - ${format(sd, "d MMMM yyyy", { locale: dateLocale() })}`;
    }
    return format(fd, "d MMMM yyyy", { locale: dateLocale() });
  }, [sortedDays, isMultiDay, route?.end_date, route?.start_date]);

  // Aktywny wpis vs wspomnienie: wspomnienie gdy trasa UKOŃCZONA (trip_type=completed - user
  // odhaczył wszystkie miejsca / zatwierdził) LUB zrecenzowana (plan_finalized) LUB minął OSTATNI
  // dzień. trip_type ustawiane od razu przy ukończeniu, plan_finalized dopiero po stepperze.
  const isMemory = useMemo(() => {
    if (sortedDays.some((d: any) => d?.trip_type === "completed" || d?.plan_finalized)) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let lastTs = -Infinity;
    for (const d of sortedDays) {
      const ds = d.end_date ?? d.start_date;
      if (ds) lastTs = Math.max(lastTs, new Date(ds).getTime());
    }
    return Number.isFinite(lastTs) && lastTs < today.getTime();
  }, [sortedDays]);

  // Wpis zrecenzowany = user skończył stepper (plan_finalized). Wtedy pokazujemy PODSUMOWANIE
  // zamiast steppera. localReviewed = optymistyczne po "Gotowe" (przed refetchem route).
  const reviewed = localReviewed || sortedDays.some((d: any) => d?.plan_finalized);

  // Odhaczanie miejsc dostepne dopiero gdy wyjazd SIE ZACZAL (start_date <= dzis). Wyjazd
  // zaplanowany na przyszlosc = checklista ukryta. Brak daty = traktuj jako dostepne.
  const tripStarted = (() => {
    const s = route?.start_date ? parseISO(route.start_date) : null;
    if (!s || !isValid(s)) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return s.getTime() <= today.getTime();
  })();
  // Interaktywna checklista (toggle + wyszarzanie + postep + GPS) TYLKO w AKTYWNYM, rozpoczetym
  // wyjezdzie. Wspomnienie grupuje po dniach, ale BEZ odhaczania/wyszarzania (#2). Przyszly wyjazd
  // nie ma checklisty wcale (#1).
  const activeChecklist = tripStarted && !isMemory;

  if (authLoading) return null;
  if (!user) { navigate("/auth"); return null; }

  // Jawny loading - bez tego render leci na pustych danych (route undefined) podczas
  // pobierania, co przy zakonczeniu trasy wygladalo jak zawieszka.
  if (routeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin" />
      </div>
    );
  }
  // Trasa nie istnieje / brak dostepu (RLS / usunieta) - czytelny stan zamiast crashu.
  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-base font-bold">{t("not_found.title")}</p>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {t("not_found.desc")}
        </p>
        <button
          onClick={() => navigate("/home")}
          className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
        >
          {t("not_found.back_home")}
        </button>
      </div>
    );
  }

  // Hero: zdjecie usera/grupy, a gdy brak - ilustracja placeholder (zamiast emoji
  // mapy). Ciemny gradient overlay zapewnia kontrast tekstu (WCAG).
  // Tlo hero: zdjecie usera -> zdjecie pierwszego miejsca z trasy (cached
  // photo_url/image_url) -> ilustracja placeholder. Zdjecie miejsca liczy sie
  // jako realne tlo (wyzsze hero).
  const userCover = myPhotos[0]?.url ?? (groupPhotos[0] as any)?.url ?? null;
  const placeCover = resolveStored(currentPins[0]?.photo_url || currentPins[0]?.image_url);
  // Recznie wybrana okladka (zdjecie miejsca) ma pierwszenstwo nad auto-okladka.
  const planCover = resolveStored((route as any)?.cover_url);
  const hasRealPhoto = !!(planCover || userCover || placeCover);
  const heroPhoto = planCover ?? userCover ?? placeCover ?? getRandomPinPlaceholder(routeId ?? undefined);
  // Miniatura eksploracji = OSOBNA okladka (list_cover_url). Gdy nieustawiona -> fallback do hero.
  const listCoverPhoto = resolveStored((route as any)?.list_cover_url) ?? heroPhoto;
  const galleryPhotos = [
    ...myPhotos.map((p) => ({ ...p, mine: true, username: t("labels.you") })),
    ...groupPhotos.map((p: any) => ({ url: p.url, owner: "", mine: false, username: p.username })),
  ];

  // Podglad wizytowki miejsca - ta sama wizytowka co na swiperze (PlaceSwiperDetail).
  // Mapujemy pin na MockPlace (jak w FeedActivityCard).
  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: route?.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    photo_url: resolveStored(pin.photo_url || pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null)) ?? "",
    vibe_tags: metaFor(pin).tags,
    description: pin.description || metaFor(pin).description || "",
  } satisfies MockPlace);

  // Otworz miejsce w Google Maps (WIZYTOWKA / place page, NIE nawigacja/directions).
  // Uzywa query_place_id gdy pin.place_id to Google Place ID (nie nasze DB uuid) - wtedy
  // trafiamy w DOKLADNIE to miejsce; inaczej szukamy po nazwie+adresie+miescie.
  const openGooglePlace = (pin: any) => {
    if (!pin) return;
    haptics.light();
    const q = encodeURIComponent([pin.place_name, pin.address, route?.city].filter(Boolean).join(", "));
    const pid = typeof pin.place_id === "string" && pin.place_id.trim() ? pin.place_id.trim() : "";
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
    const placeIdParam = pid && !isDbUuid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  // ── Sekcja Ocena + Notka pod miejscem (widok wspomnienia / plan dnia). ──
  // centered => gwiazdki + etykiety wysrodkowane (widok Szczegoly / swiper).
  // Oceny gwiazdkowe USUNIETE - bazujemy wylacznie na wartosciowych notkach userow.
  // (patrz CLAUDE.md "Brak ocen miejsc"). Zostaje tylko pole notki.
  const renderRatingNote = (placeName: string, centered = false, readOnly = false) => {
    const k = rkey(activeRouteId!, placeName);
    const val = notes[k] ?? "";
    // Read-only (podsumowanie): pokaz notke jako tekst; ukryj gdy pusta.
    if (readOnly) {
      if (!val.trim()) return null;
      return (
        <div className={`mt-2 ${centered ? "text-center" : ""}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t("note.label")}</p>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{val}</p>
        </div>
      );
    }
    return (
      <div className={`mt-3 pt-1 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("note.label_own")}</p>
        <div className="relative">
          <textarea
            value={val}
            onChange={(e) => handleNoteChange(placeName, e.target.value)}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            placeholder={t("note.placeholder")}
            rows={2}
            className="w-full bg-white rounded-xl px-3 py-2.5 text-sm text-foreground text-left resize-none focus:outline-none border border-border/50 focus:border-orange-400/60 placeholder:text-muted-foreground/55"
          />
          {noteSaved[k] && (
            <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">{t("note.saved")}</span>
          )}
        </div>
      </div>
    );
  };

  // ── Lista (read-only): miejsca grupowane po kategorii. Klik => wizytowka. ──
  // Wspolna karta miejsca (karuzela + pionowa lista). fullWidth -> pelna szerokosc (stacked).
  const renderPlanCard = (pin: any, i: number, fullWidth: boolean, editable: boolean, withRating: boolean, checklist: boolean = activeChecklist) => (
    <div key={pin.id} className={`${fullWidth ? "w-full" : "snap-center shrink-0 w-[80vw] max-w-[320px]"} rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col transition-opacity ${checklist && isVisited(pin) ? "opacity-60" : ""}`}>
      <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
        <div className="relative w-full aspect-[4/3] bg-muted">
          <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-4xl" />
          <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-[#F0A583] text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
          {editable && (
            <button
              onClick={(e) => { e.stopPropagation(); removeWorkingPin(pin.id); }}
              aria-label={t("a11y.remove_place")}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="px-4 pt-4 pb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-xs font-semibold text-foreground mb-2">
            {catLabel(pin.category)}
          </span>
          <p className="text-base font-black leading-tight">{pin.place_name}</p>
          {(() => {
            const m = metaFor(pin);
            const desc = pin.description || m.description;
            return (
              <>
                {desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{desc}</p>}
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.tags.slice(0, 3).map((t: string) => (
                      <span key={t} className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </button>
      {/* Toggle "Bylem tu" (karta) - tylko w aktywnej checkliscie; poza przyciskiem openDetail.
          W KREATORZE (step 2 "Sugestie do trasy") checklist=false -> guzik ukryty. */}
      {checklist && (
        <div className="px-4 pt-2 pb-1">
          <button
            onClick={() => toggleVisited(pin)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isVisited(pin) ? "bg-green-500 text-white" : "bg-white border border-border text-muted-foreground active:bg-muted"}`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
            {isVisited(pin) ? "Odwiedzone" : "Byłem tu"}
          </button>
        </div>
      )}
      {editable && (
        <div className="flex items-center justify-between px-4 py-3 mt-auto border-t border-border/30">
          <button onClick={() => movePin(i, i - 1)} disabled={i === 0} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            <ChevronLeft className="h-4 w-4" />{t("plan.earlier")}
          </button>
          <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            {t("plan.later")}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {withRating && <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name, true, !editable)}</div>}
    </div>
  );

  // ── Kompaktowy wiersz listy: miniaturka + nazwa + chip kategorii (+ reorder/usuń gdy edycja). ──
  const renderPlanRow = (pin: any, i: number, editable: boolean, checklist: boolean = activeChecklist) => (
    <div key={pin.id} className={`flex items-center gap-3 rounded-2xl bg-secondary border border-border/40 shadow-sm p-2.5 transition-opacity ${checklist && isVisited(pin) ? "opacity-60" : ""}`}>
      <button onClick={() => openDetail(pin)} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
        <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
      </button>
      <button onClick={() => openDetail(pin)} className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-bold leading-tight truncate ${checklist && isVisited(pin) ? "line-through" : ""}`}>{pin.place_name}</p>
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">
          {catLabel(pin.category)}
        </span>
      </button>
      {editable && (
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col">
            <button onClick={() => movePin(i, i - 1)} disabled={i === 0} aria-label={t("plan.earlier")} className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
            <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} aria-label={t("plan.later")} className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
          </div>
          <button onClick={() => removeWorkingPin(pin.id)} aria-label={t("a11y.remove_place")} className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 active:scale-90"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  // Lista (read-only / podsumowanie): każde miejsce = biała sekcja (miniatura + nazwa + chip
  // + notka) na białym tle z delikatnym cieniem 1px. Tap -> wizytówka.
  const renderReadPin = (pin: any, i: number, withRating: boolean) => (
    <div key={pin.id} className={`rounded-2xl bg-secondary border border-black/5 shadow-sm p-3 transition-opacity ${activeChecklist && isVisited(pin) ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => openDetail(pin)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-90">
          <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted">
            <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
            <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold leading-tight truncate ${activeChecklist && isVisited(pin) ? "line-through" : ""}`}>{pin.place_name}</p>
            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">
              {catLabel(pin.category)}
            </span>
          </div>
        </button>
        {renderVisitedToggle(pin)}
      </div>
      {withRating && renderRatingNote(pin.place_name, false, true)}
    </div>
  );

  const placeWord = (n: number) => n === 1 ? "miejsce" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "miejsca" : "miejsc";

  const renderListReadonly = (withRating: boolean) => {
    // We WSPOMNIENIU grupujemy odwiedzone po DNIU odwiedzenia (visited_at). Dni wynikaja same
    // z tego kiedy user odhaczal - bez planowania z gory. Aktywny widok zostaje plaska checklista.
    const anyVisited = currentPins.some((p: any) => isVisited(p));
    if (isMemory && anyVisited) {
      const byDay = new Map<string, any[]>();
      const notVisited: any[] = [];
      currentPins.forEach((pin: any) => {
        if (isVisited(pin)) {
          const key = pin.visited_at ? String(pin.visited_at).slice(0, 10) : "brak";
          if (!byDay.has(key)) byDay.set(key, []);
          byDay.get(key)!.push(pin);
        } else notVisited.push(pin);
      });
      const days = [...byDay.keys()].filter((k) => k !== "brak").sort();
      if (byDay.has("brak")) days.push("brak");
      const dayLabel = (k: string) => {
        if (k === "brak") return "Odwiedzone";
        const d = parseISO(k);
        return isValid(d) ? format(d, "d MMMM yyyy", { locale: dateLocale() }) : k;
      };
      let idx = 0;
      return (
        <div className="space-y-5">
          {days.map((day) => {
            const items = byDay.get(day)!;
            return (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-black text-foreground">{dayLabel(day)}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{items.length} {placeWord(items.length)}</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="space-y-2.5">
                  {items.map((pin: any) => renderReadPin(pin, idx++, withRating))}
                </div>
              </div>
            );
          })}
          {notVisited.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm font-black text-muted-foreground">Nieodwiedzone</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="space-y-2.5">
                {notVisited.map((pin: any) => renderReadPin(pin, idx++, withRating))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {renderVisitedProgress()}
        {currentPins.map((pin: any, i: number) => renderReadPin(pin, i, withRating))}
      </div>
    );
  };

  // ── Szczegoly: poziomy swiper kart (jak kreator trasy). editable => move/usun,
  // withRating => Ocena + Notka pod karta. Klik w karte => wizytowka. ──
  // Szczegoly: poziomy swiper kart.
  const renderSwiper = (editable: boolean, withRating: boolean, checklist: boolean = activeChecklist) => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {workingPins.map((pin: any, i: number) => renderPlanCard(pin, i, false, editable, withRating, checklist))}
    </div>
  );

  // Lista (edytowalna): kompaktowe wiersze (miniatura + nazwa + chip + reorder/usuń).
  const renderEditablePlan = (_withRating: boolean) => (
    <div className="space-y-2">
      {renderVisitedProgress()}
      {workingPins.map((pin: any, i: number) => renderPlanRow(pin, i, true))}
    </div>
  );

  // Przycisk dodania miejsca - nowy pelnoekranowy widok (spojny z aktywna trasa na home),
  // zamiast drawera AddPinSheet.
  const renderAddPlaceButton = () => (
    <button
      onClick={() => activeRouteId && navigate(`/trasa/${activeRouteId}/dodaj`)}
      className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-border/50 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
    >
      <Plus className="h-4 w-4" /> {t("plan.add_place")}
    </button>
  );

  // ── Galeria zdjęć (grid 3-kol, jak instagram). editable -> przycisk dodawania. ──
  // ── Arkusz "Zdjęcia do miejsca" (przypisanie z galerii / nowe) - reużywany w widoku planu i kroku Galeria. ──
  const renderPinPickerSheet = () => {
    if (!pinPickerId) return null;
    const pickerPin = currentPins.find((p: any) => p.id === pinPickerId);
    if (!pickerPin) return null;
    const assigned: string[] = Array.isArray(pickerPin.images) ? pickerPin.images : [];
    return (
      <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPinPickerId(null)}>
        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col" style={{ maxHeight: "82dvh" }}>
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-3 shrink-0" />
          <p className="font-display text-lg font-bold text-foreground px-1 shrink-0">Zdjęcia do miejsca</p>
          <p className="text-[13px] text-muted-foreground px-1 mt-0.5 mb-3 shrink-0 truncate">{pickerPin.place_name}</p>
          <button
            onClick={() => { const p = pickerPin; setPinPickerId(null); triggerPinPhotoPick(p); }}
            className="shrink-0 w-full flex items-center justify-center gap-2 rounded-2xl bg-secondary text-secondary-foreground py-3 mb-3 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <Camera className="h-4 w-4" /> Dodaj nowe zdjęcie
          </button>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1 mb-2 shrink-0">Z galerii wyjazdu</p>
          <div className="overflow-y-auto min-h-0 flex-1">
            {myPhotos.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10 px-6">Brak zdjęć w galerii wyjazdu. Dodaj je najpierw w sekcji „Zdjęcia z wyjazdu" albo dodaj nowe powyżej.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 pb-1">
                {myPhotos.map(({ url }) => {
                  const src = resolveStored(url) ?? url;
                  const isOn = assigned.includes(url);
                  return (
                    <button key={url} onClick={() => toggleAssignPinPhoto(pickerPin, url)} className="relative aspect-square rounded-xl overflow-hidden bg-muted active:opacity-90">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {isOn && (
                        <span className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                          <span className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center"><Check className="h-4 w-4" strokeWidth={3} /></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button onClick={() => setPinPickerId(null)} className="shrink-0 w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm mt-3 active:scale-[0.98] transition-transform">Gotowe</button>
        </div>
      </div>
    );
  };

  // Fullscreen podgląd zdjęcia + menu (okładka / usuń) - reużywany w widoku planu i kroku Galeria.
  const renderPhotoViewer = () => {
    if (!viewerUrl) return null;
    return (
      <div className="fixed inset-0 z-[90] bg-black flex items-center justify-center" onClick={() => { setViewerUrl(null); setViewerMenuOpen(false); }}>
        <img src={viewerUrl} alt="" className="max-w-full max-h-full object-contain" />
        <div className="absolute flex items-center gap-2" style={{ top: "max(16px, env(safe-area-inset-top, 16px))", right: "16px" }} onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button onClick={() => setViewerMenuOpen((o) => !o)} aria-label={t("a11y.more_options")} className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <MoreVertical className="h-5 w-5 text-white" />
            </button>
            {viewerMenuOpen && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl bg-card shadow-xl overflow-hidden py-1">
                <button onClick={() => { if (viewerUrl !== heroPhoto) setCover(viewerUrl); setViewerMenuOpen(false); }} disabled={viewerUrl === heroPhoto} className="w-full px-4 py-3 text-left text-sm font-medium text-foreground flex items-center gap-2.5 active:bg-muted disabled:opacity-50">
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  {viewerUrl === heroPhoto ? t("viewer.is_cover") : t("viewer.set_cover")}
                  {viewerUrl === heroPhoto && <Check className="h-4 w-4 text-green-600 ml-auto" />}
                </button>
                {myPhotos.some((p) => p.url === viewerUrl) && (
                  <button onClick={() => { const owner = myPhotos.find((p) => p.url === viewerUrl)?.owner ?? routeId!; removePhoto(viewerUrl, owner); setViewerMenuOpen(false); }} className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 flex items-center gap-2.5 active:bg-muted border-t border-border/40">
                    <Trash2 className="h-4 w-4 shrink-0" /> {t("viewer.remove_photo")}
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={() => { setViewerUrl(null); setViewerMenuOpen(false); }} aria-label={t("a11y.close")} className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    );
  };

  const renderGallery = (editable: boolean) => (
    <div className="px-1 pt-1">
      <div className="grid grid-cols-3 gap-0.5">
        {editable && photos.length < MAX_PHOTOS && (
          <button onClick={triggerPhotoPick} disabled={uploading}
            className="aspect-square flex flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground active:bg-muted/60 transition-colors">
            <Camera className="h-6 w-6" />
            <span className="text-[10px] font-medium">{uploading ? "…" : t("gallery.add")}</span>
          </button>
        )}
        {galleryPhotos.map((item, idx) => (
          <button key={`${item.url}-${idx}`} onClick={() => { setViewerUrl(item.url); setViewerMenuOpen(false); }}
            className="relative aspect-square overflow-hidden bg-muted active:opacity-90">
            <img src={item.url} alt="" className="w-full h-full object-cover" />
            {/* Badge: nazwa miejsca, do którego zdjęcie zostało przypisane (pins.images). */}
            {photoPlaceLabel.get(item.url) && (
              <span className="absolute bottom-1 left-1 right-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 text-[9px] font-medium text-white truncate">{photoPlaceLabel.get(item.url)}</span>
            )}
            {!item.mine && !photoPlaceLabel.get(item.url) && (
              <span className="absolute bottom-1 left-1 bg-black/55 backdrop-blur-sm rounded px-1.5 py-0.5 text-[9px] font-medium text-white max-w-[90%] truncate">{item.username}</span>
            )}
            {editable && item.mine && (
              <span
                role="button"
                aria-label={t("a11y.remove_photo")}
                onClick={(e) => { e.stopPropagation(); removePhoto(item.url, item.owner); }}
                className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center active:scale-90"
              >
                <X className="h-4 w-4" />
              </span>
            )}
          </button>
        ))}
      </div>
      {galleryPhotos.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/70 px-6 pt-3">{t("gallery.tap_hint")}</p>
      )}
      {galleryPhotos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10 px-6">{editable ? t("gallery.empty_editable") : t("gallery.empty")}</p>
      )}
    </div>
  );

  // ── Zdjęcia przypisane do miejsc (pins.images) - poziomy pasek miniatur per punkt. ──
  const renderPinPhotoSection = () => {
    if (!workingPins.length) return null;
    return (
      <div className="px-5 pt-7">
        <p className="font-display text-xl font-bold text-foreground tracking-tight">Zdjęcia do miejsc</p>
        <p className="text-[13px] text-muted-foreground mt-1 mb-4 leading-relaxed">Dołącz zdjęcia do konkretnych punktów trasy.</p>
        <div className="space-y-3">
          {workingPins.map((pin: any, i: number) => {
            const imgs: string[] = Array.isArray(pin.images) ? pin.images : [];
            // Pasek zarzadzania zdjeciami (Dodaj + dodane) - renderowany POD wizytowka miejsca.
            const photosRow = (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                <button
                  onClick={() => { haptics.light(); setPinPickerId(pin.id); }}
                  disabled={pinUploadingId === pin.id}
                  className="shrink-0 h-20 w-20 rounded-xl bg-muted/50 border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground active:bg-muted/70 transition-colors"
                >
                  {pinUploadingId === pin.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Camera className="h-5 w-5" /><span className="text-[10px] font-medium">Dodaj</span></>}
                </button>
                {imgs.map((url, idx) => {
                  const src = resolveStored(url) ?? url;
                  return (
                    <button
                      key={`${url}-${idx}`}
                      onClick={() => { setViewerUrl(src); setViewerMenuOpen(false); }}
                      className="relative shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-muted active:opacity-90"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <span
                        role="button"
                        aria-label={t("a11y.remove_photo")}
                        onClick={(e) => { e.stopPropagation(); removePinPhoto(pin, url); }}
                        className="absolute top-0.5 right-0.5 h-6 w-6 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center active:scale-90"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            );
            // Regula (tworzenie nowej trasy): okladka wizytowki miejsca POKAZUJE istniejaca okladke
            // miejsca (photo_url / zdjecia usera z innych tras), ale NIE zaciaga MOICH swiezo dodanych
            // zdjec (kanal pins.images) jako okladki dopoki trasa nie jest stworzona (reviewed=false).
            // Dodane zdjecia widac w pasku ponizej. Po stworzeniu trasy (reviewed=true) - pelna okladka.
            const coverPin = reviewed ? pin : { ...pin, images: undefined };
            // Wizytowka miejsca (jak w liscie Miejsca) na gorze; Dodaj + zdjecia pod spodem (note).
            return (
              <RoutePlaceRow
                key={pin.id}
                pin={coverPin}
                index={i}
                categoryLabel={catLabel(pin.category)}
                onOpen={() => openDetail(pin)}
                onGoogle={() => openGooglePlace(pin)}
                note={photosRow}
              />
            );
          })}
        </div>
      </div>
    );
  };


  // ── Drawer udostepniania (skrot z ikony): trasa juz jest udostepniona (klik w ikone
  // publikuje), wiec pokazujemy TYLKO: anonimowo + gwarancja prywatnosci galerii + podpis. ──
  const renderShareDrawer = () => (
    <div className="px-5 pt-1">
      <div className="flex items-start gap-3 rounded-2xl bg-muted p-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{t("sharing.anon_title")}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{t("sharing.anon_desc")}</p>
        </div>
        <Switch
          checked={shareAnonymous}
          onCheckedChange={(v) => setVisibility(v ? "anon" : "profile")}
          className="mt-0.5 shrink-0"
        />
      </div>
      {/* Gwarancja prywatnosci: galeria zdjec nigdy nie jest udostepniana. */}
      <p className="text-[11px] text-muted-foreground mt-2.5 flex items-start gap-1.5">
        <Lock className="h-3 w-3 shrink-0 mt-0.5 text-emerald-600" />
        <span>{t("sharing.privacy_note")}</span>
      </p>
      {/* Podpis autora */}
      <div className="mt-4">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">{t("sharing.caption_label")} <span className="normal-case font-medium text-muted-foreground/50">{t("sharing.optional")}</span></label>
        <textarea
          value={shareCaption}
          onChange={(e) => setShareCaption(e.target.value)}
          onBlur={() => void saveShareMeta(shareCaption)}
          maxLength={200}
          rows={2}
          placeholder={t("sharing.caption_placeholder")}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-muted-foreground/50 resize-none"
        />
      </div>
    </div>
  );

  // ── Nagłówek steppera: 3 kroki, klikalne (powrót/przejście), pasek postępu. ──
  const renderStepper = () => {
    const steps = [{ n: 1, label: t("stepper.route") }, { n: 2, label: t("stepper.notes") }, { n: 3, label: t("stepper.photos") }] as const;
    return (
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-5 pt-3 pb-2.5">
        <div className="flex items-center">
          {steps.map((s, idx) => (
            <div key={s.n} className={`flex items-center ${idx < steps.length - 1 ? "flex-1" : ""}`}>
              <button onClick={() => setStep(s.n)} className="flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.n ? "bg-primary text-white" : step > s.n ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                  {step > s.n ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : s.n}
                </span>
                <span className={`text-xs font-semibold ${step === s.n ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              </button>
              {idx < steps.length - 1 && <div className="flex-1 h-px bg-border/50 mx-2" />}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStepInfo = () => (
    <div className="mb-3 flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
      <Info className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
      <p className="text-xs text-orange-800 leading-relaxed">{t(`step_info.${step}`)}</p>
    </div>
  );

  // Naglowek "Twój plan" + przelacznik Lista/Szczegoly + (multi-day) przelacznik dni.
  const renderPlanHeader = (showViewToggle = true) => (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("plan.your_plan")}</p>
        {showViewToggle && (
          <div className="flex rounded-full bg-muted p-0.5">
            <button onClick={() => setPlanView("list")} aria-label={t("a11y.list_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setPlanView("cards")} aria-label={t("a11y.cards_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <GalleryHorizontalEnd className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {isMultiDay && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none mb-3 -mx-1 px-1">
          {sortedDays.map((d: any) => (
            <button
              key={d.id}
              onClick={() => setSelectedDayId(d.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${d.id === activeRouteId ? "bg-foreground text-background" : "bg-card border border-border/50 text-muted-foreground"}`}
            >
              {t("plan.day", { number: d.day_number ?? "?" })}
            </button>
          ))}
        </div>
      )}
    </>
  );

  // ── Widok "Plan wyjazdu" (aktywny / najblizszy wyjazd wlasciciela) wg Figmy ──
  // Hero + info (avatar/nazwa/data) + widocznosc + lista miejsc (numer/kategoria/odhaczanie/
  // reorder) + statyczna mapa (rozwijalna) + footer "Nawiguj do...". Wspomnienia (isMemory)
  // i gosc ida dalej do klasycznego podsumowania/steppera.
  // forceEdit (?edit=1, np. "Przejdz do sugestii" z ComposeWyjazd) MUSI pominac ten widok i
  // trafic do steppera (Trasa -> Sugestie -> Galeria) - inaczej user laduje w widoku planu
  // z nawigacja do Dziennika zamiast na kroku sugestii.
  if (isOwner && !editingStepper && !forceEdit && sortedDays.length <= 1) {
    const heroMapThumb = buildTripStaticMapUrl(currentPins, "160x160");
    const bigMapUrl = buildTripStaticMapUrl(currentPins, "560x300");
    const heroMapCover = buildTripStaticMapUrl(currentPins, "560x350"); // 16:10, pod okladke hero
    const nextPlace = currentPins.find((p: any) => !isVisited(p)) ?? currentPins[0];
    // Ukonczony wyjazd = wszystkie miejsca odhaczone ALBO minieta data (isMemory). Wtedy w
    // sekcji miejsc pokazujemy Notki/Galerie (notatki + zdjecia = wspomnienie).
    const tripCompleted = isMemory || (currentPins.length > 0 && visitedCount === currentPins.length);
    // Usuniecie miejsca z planu (swipe/kosz) z oknem "Cofnij". Zmiana draftu; autosave
    // (on unmount) utrwala usuniecie w DB. Cofniecie przywraca poprzednia liste.
    const removePlaceFromPlan = (pin: any) => {
      const prev = workingPins;
      setWorking(workingPins.filter((p: any) => p.id !== pin.id));
      deferDelete({ message: "Usunięto miejsce", onUndo: () => setWorking(prev), commit: () => { /* DB przez autosave */ } });
    };
    const navMapPins = currentPins
      .filter((p: any) => p.latitude != null && p.longitude != null)
      .map((p: any) => ({ latitude: p.latitude, longitude: p.longitude, place_name: p.place_name }));
    const navigateTo = (p: any) => {
      if (!p) return;
      const dest = (typeof p.latitude === "number" && typeof p.longitude === "number")
        ? `${p.latitude},${p.longitude}`
        : encodeURIComponent([p.place_name, p.address, route?.city].filter(Boolean).join(" "));
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank", "noopener,noreferrer");
    };
    const sectionHeadingCls = "font-display text-xl font-bold text-foreground tracking-tight";

    return (
      <div className="relative h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
        {/* Sticky pasek back + X - NAD scrollem. Przezroczysty nad okladka, tlo gdy przewiniete.
            Okladka (zdjecie) NIE jest sticky - przewija sie razem z trescia (wg Figmy). */}
        <div
          className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pb-3 transition-colors duration-200 ${planScrolled ? "bg-[#FEFEFE]/95 backdrop-blur-md border-b border-black/[0.06]" : ""}`}
          style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
        >
          <button onClick={() => navigate("/dziennik")} aria-label={t("a11y.back_to_journal")} className={`h-8 w-8 rounded-full flex items-center justify-center active:scale-90 transition-transform ${planScrolled ? "bg-secondary text-foreground" : "bg-black/35 backdrop-blur-sm text-white"}`}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => navigate("/dziennik")} aria-label={t("a11y.back_to_journal")} className={`h-8 w-8 rounded-full flex items-center justify-center active:scale-90 transition-transform ${planScrolled ? "bg-secondary text-foreground" : "bg-white/25 backdrop-blur-sm text-white"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div onScroll={(e) => setPlanScrolled(e.currentTarget.scrollTop > 170)} className="flex-1 min-h-0 overflow-y-auto pb-5">
          {/* Okladka - w scrollu, przewija sie (NIE sticky), bez zaokraglen na dole */}
          <div className="relative w-full aspect-[16/10] overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
            <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/55" />
            {/* Ikona galerii = ZMIANA zdjecia okladkowego (dodaj nowe / wybierz z galerii / z miejsc).
                Lewy-dolny rog. Osobna funkcja od podgladu na eksploracji (prawy-dolny). */}
            <button
              onClick={() => setCoverPickerOpen(true)}
              aria-label="Zmień okładkę wyjazdu"
              className="absolute bottom-3 left-3 z-20 h-10 w-10 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <ImageIcon className="h-[18px] w-[18px]" />
            </button>
            {/* Miniatura eksploracji - OSOBNA okladka (list_cover_url), klik = zmiana zdjecia
                (dodaj nowe / wybierz z galerii/miejsc trasy). Prawy-dolny rog. Ikona = edytowalna. */}
            <button
              onClick={() => setListCoverPickerOpen(true)}
              aria-label="Zmień miniaturę w eksploracji"
              className="absolute bottom-3 right-3 z-20 w-20 rounded-2xl overflow-hidden border-[3px] border-white shadow-xl bg-muted active:scale-95 transition-transform"
            >
              <div className="relative w-full aspect-[9/16]">
                <img src={listCoverPhoto} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center">
                  <ImageIcon className="h-3 w-3" />
                </span>
              </div>
            </button>
          </div>

          {/* Tresc planu */}
          <div className="px-4 pt-5">
          {/* Badge "Plan wyjazdu" + nazwa (edytowalna) + data (edytowalna) + widocznosc */}
          <div className="flex flex-col gap-4">
            {/* Autor trasy (awatar + @username) + miasto + liczba miejsc - zamiast badge "Plan wyjazdu". */}
            <div className="flex items-center gap-2.5 flex-wrap text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <img src={avatarSrc(routeAuthor?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                {routeAuthor?.username ? `@${routeAuthor.username}` : (routeAuthor?.first_name || t("labels.you", { defaultValue: "Ty" }))}
              </span>
              {cityLabel && <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-4 w-4" />{cityLabel}</span>}
              <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{currentPins.length} {currentPins.length === 1 ? "miejsce" : currentPins.length < 5 ? "miejsca" : "miejsc"}</span>
            </div>
            {/* Nazwa wyjazdu - edytowalna inline; olowek dosuniety do prawej (justify-between) */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus maxLength={60} placeholder={t("entry.name_placeholder")}
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-lg font-bold text-foreground outline-none focus:ring-2 focus:ring-orange-500/40"
                  style={{ fontSize: "16px" }}
                />
                <button onClick={saveName} disabled={savingName} aria-label={t("a11y.save_name")} className="h-9 w-9 shrink-0 rounded-xl bg-primary text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button onClick={() => { setNameVal(customName); setEditingName(true); }} aria-label={t("a11y.edit_name", { defaultValue: "Edytuj nazwę" })} className="flex items-center justify-between gap-2 text-left active:opacity-70">
                <p className="flex-1 min-w-0 text-2xl font-black text-foreground leading-tight truncate">{displayName || cityLabel}</p>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            )}
            {/* Data - wiersz (ikona + zakres, chevron po prawej); klik otwiera kalendarz */}
            <button onClick={() => setDatePickerOpen(true)} className="flex items-center justify-between gap-2 active:opacity-70">
              <span className="flex items-center gap-1.5 min-w-0">
                <CalendarIcon className="h-5 w-5 text-foreground shrink-0" />
                <span className="text-base text-foreground truncate">{dateLabel || "Dodaj datę"}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            {/* Opis ogolny trasy - READ-ONLY tutaj (review_narrative). Edycja tylko pod guzikiem
                "Edytuj trase" (tryb edycji). Fallback: ai_summary. */}
            {(suggestion?.trim() || route?.ai_summary) && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{suggestion?.trim() || route?.ai_summary}</p>
            )}
            {/* "Edytuj trase" -> edytor ComposeWyjazd (ten sam co przy tworzeniu): wyszukiwarka
                miejsc + dodaj/usun/kolejnosc + nazwa. Zaladowany ta trasa (draftId), wiec zapis
                AKTUALIZUJE ja (bez duplikatu). Opis + notki edytuje sie dalej w "Przejdz do sugestii". */}
            {isOwner && (
              <button
                onClick={() => {
                  haptics.light();
                  navigate("/wyjazd/nowy", {
                    state: {
                      draftId: routeId,
                      city: route?.city ?? null,
                      title: displayName || (route as any)?.title || null,
                      places: currentPins.map((p: any) => ({
                        place_id: p.place_id ?? null,
                        place_name: p.place_name,
                        category: p.category,
                        address: p.address,
                        latitude: p.latitude,
                        longitude: p.longitude,
                        photo_url: p.photo_url,
                      })),
                    },
                  });
                }}
                className="w-full mt-1 py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Pencil className="h-4 w-4" /> Edytuj trasę
              </button>
            )}
            {/* Wiersz "Widoczność" usuniety (2026-07-30): wszystkie trasy sa publiczne by default. */}
          </div>

          {/* Top-toggle Miejsca | Galeria | Mapa */}
          <div className="flex rounded-full bg-muted p-0.5 mt-8 mb-4 text-sm font-bold">
            <button onClick={() => { haptics.selection(); setPlanTab("miejsca"); }} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "miejsca" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Miejsca</button>
            <button onClick={() => { haptics.selection(); setPlanTab("galeria"); }} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Galeria</button>
            <button onClick={() => { haptics.selection(); setPlanTab("mapa"); }} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "mapa" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Mapa</button>
          </div>

          {/* Galeria / Mapa / Miejsca (mapa przeniesiona do wlasnej zakladki obok Galeria). */}
          {planTab === "galeria" ? renderGallery(true) : planTab === "mapa" ? (
            <div className="pt-1">
              {bigMapUrl ? (
                <button onClick={() => setPlanMapOpen(true)} className="relative block w-full h-64 rounded-2xl overflow-hidden border border-border/40 bg-muted active:opacity-95 transition-opacity">
                  <img src={bigMapUrl} alt="Mapa planu" className="w-full h-full object-cover" />
                  <span className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center">
                    <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
                  </span>
                </button>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-10">Brak lokalizacji miejsc na mapie.</p>
              )}
            </div>
          ) : (
          <>
          {/* Sub-toggle podglądu miejsc (Lista/Karty) - tylko dla aktywnego (nieukończonego) wyjazdu. */}
          {!tripCompleted && (
            <div className="flex items-center justify-end pb-3">
              <div className="flex rounded-full bg-muted p-0.5">
                <button onClick={() => setPlanView("list")} aria-label={t("a11y.list_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <List className="h-4 w-4" />
                </button>
                <button onClick={() => setPlanView("cards")} aria-label={t("a11y.cards_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <GalleryHorizontalEnd className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {tripCompleted ? (
            /* Ukonczony + Notki -> kazde miejsce z polem notatki usera. */
            <div className="flex flex-col gap-3">
              {workingPins.map((pin: any, i: number) => (
                <div key={pin.id} className="rounded-2xl bg-secondary border border-border/40 p-2.5">
                  <button onClick={() => openDetail(pin)} className="w-full flex items-center gap-3 text-left active:opacity-90 transition-opacity">
                    <div className="relative h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                      <PlacePhoto pin={pin} className="h-full w-full object-cover" emojiClass="text-2xl" />
                      <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-[#9a9a9a] text-white text-[8px] font-bold flex items-center justify-center">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                      {pin.category && <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground">{catLabel(pin.category)}</span>}
                    </div>
                  </button>
                  <div className="pt-2">{renderRatingNote(pin.place_name)}</div>
                </div>
              ))}
            </div>
          ) : planView === "cards" ? (
            /* Aktywny + Karty -> poziome karty z koszem. */
            <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
              {workingPins.map((pin: any, i: number) => {
                const visited = isVisited(pin);
                return (
                  <button key={pin.id} onClick={() => openDetail(pin)} className="shrink-0 w-[210px] snap-start rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm text-left active:opacity-90 transition-opacity">
                    <div className="relative aspect-[4/3] bg-muted">
                      <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-3xl" />
                      <span className="absolute top-2 left-2 h-5 w-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removePlaceFromPlan(pin); }} aria-label={t("a11y.remove_place")}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/45 backdrop-blur text-white flex items-center justify-center active:scale-90 transition-transform">
                        <Trash2 className="h-4 w-4" />
                      </span>
                      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); openGooglePlace(pin); }} aria-label={`Otwórz ${pin.place_name} w Google Maps`}
                        className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform shadow-md">
                        <GoogleGlyph className="h-[18px] w-[18px]" />
                      </span>
                    </div>
                    <div className="px-3 py-2.5">
                      {pin.category && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-card text-[11px] font-semibold text-foreground mb-1">{catLabel(pin.category)}</span>}
                      <p className={`text-sm font-black leading-tight line-clamp-1 ${visited ? "line-through opacity-60" : ""}`}>{pin.place_name}</p>
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setAddingPlace(true)} className="shrink-0 w-[130px] snap-start rounded-2xl border border-dashed border-border/70 flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:bg-muted/40 transition-colors">
                <Plus className="h-5 w-5" /> <span className="text-xs font-bold">Dodaj miejsce</span>
              </button>
            </div>
          ) : (
            /* Aktywny + Lista -> duze wiersze (RoutePlaceRow) z uchwytem DRAG + swipe-to-delete. */
            <div className="flex flex-col gap-2.5">
              <Reorder.Group axis="y" values={workingPins} onReorder={setWorking} className="flex flex-col gap-2.5">
                {workingPins.map((pin: any, i: number) => {
                  const noteText = (notes[rkey(activeRouteId!, pin.place_name)] ?? "").trim();
                  const note = noteText ? (
                    <div>
                      <p className="text-sm font-semibold text-foreground">Twoja Notka</p>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-0.5">{noteText}</p>
                    </div>
                  ) : undefined;
                  return (
                    <SortablePlanRow
                      key={pin.id}
                      pin={pin}
                      index={i}
                      categoryLabel={catLabel(pin.category)}
                      visited={isVisited(pin)}
                      onOpen={() => openDetail(pin)}
                      onGoogle={() => openGooglePlace(pin)}
                      onDelete={() => removePlaceFromPlan(pin)}
                      note={note}
                    />
                  );
                })}
              </Reorder.Group>
              <button onClick={() => setAddingPlace(true)} className="w-full rounded-2xl border border-dashed border-border/70 p-3 text-center text-sm font-bold text-muted-foreground active:bg-muted/40 transition-colors">
                Dodaj miejsce
              </button>
            </div>
          )}
          {/* MAPA przeniesiona do wlasnej zakladki "Mapa" (obok Galeria) - patrz wyzej. */}
          </>
          )}
          </div>
        </div>

        {/* Footer "Nawiguj do..." usuniety - nawigacja jest per-miejsce (guziki Google w wierszach). */}

        {/* Wizytowka miejsca */}
        <PlaceSwiperDetail open={!!detailPin} onOpenChange={(o) => !o && setDetailPin(null)} place={detailPin} city={route?.city} />

        {/* Fullscreen podgląd zdjęcia (tap w galerię) - ustawienie okładki / usuniecie. */}
        {renderPhotoViewer()}

        {/* Dodawanie miejsca */}
        {addingPlace && (
          <AddPinSheet open={addingPlace} onOpenChange={(o) => !o && setAddingPlace(false)} onPinAdd={handleAddPin} cityContext={route?.city ?? ""} existingPinNames={currentPins.map((p: any) => p.place_name)} />
        )}

        {/* Arkusz wyboru okladki wyjazdu (zdjecia miejsc trasy) */}
        {coverPickerOpen && (
          <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={() => setCoverPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: "82dvh" }}>
              <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
              <button onClick={() => setCoverPickerOpen(false)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4" />
              </button>
              <p className="text-lg font-bold pr-8">Okładka wyjazdu</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Wybierz zdjęcie na okładkę - dodaj nowe, z galerii albo z miejsc trasy.</p>
              <div className="overflow-y-auto -mx-1 px-1" style={{ maxHeight: "62dvh" }}>
                <div className="grid grid-cols-3 gap-2 pb-1">
                  {/* Nowe zdjecie z telefonu -> od razu okladka (jak przy dodawaniu zdjec do miejsc). */}
                  <button
                    onClick={triggerCoverPhotoPick}
                    disabled={uploading}
                    className="relative aspect-square rounded-2xl border-2 border-dashed border-border/70 flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                    <span className="text-[11px] font-semibold leading-tight text-center px-1">Nowe zdjęcie</span>
                  </button>
                  {coverPickerOptions.map((opt) => {
                    const isCurrent = heroPhoto === opt.url;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPlanCover(opt.url)}
                        className={`relative aspect-square rounded-2xl overflow-hidden bg-muted active:scale-95 transition-transform ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                      >
                        <img src={opt.url} alt={opt.name} loading="lazy" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-semibold text-white leading-tight line-clamp-2 [text-shadow:_0_1px_2px_rgb(0_0_0/60%)]">{opt.name}</span>
                        {isCurrent && (
                          <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Arkusz wyboru MINIATURY w eksploracji (list_cover_url) - osobny od okladki wyjazdu. */}
        {listCoverPickerOpen && (
          <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={() => setListCoverPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: "82dvh" }}>
              <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
              <button onClick={() => setListCoverPickerOpen(false)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4" />
              </button>
              <p className="text-lg font-bold pr-8">Miniatura w eksploracji</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Zdjęcie widoczne na karcie trasy w eksploracji - dodaj nowe albo wybierz z galerii lub miejsc trasy.</p>
              <div className="overflow-y-auto -mx-1 px-1" style={{ maxHeight: "62dvh" }}>
                <div className="grid grid-cols-3 gap-2 pb-1">
                  <button
                    onClick={triggerListCoverPhotoPick}
                    disabled={uploading}
                    className="relative aspect-square rounded-2xl border-2 border-dashed border-border/70 flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                    <span className="text-[11px] font-semibold leading-tight text-center px-1">Nowe zdjęcie</span>
                  </button>
                  {coverPickerOptions.map((opt) => {
                    const isCurrent = listCoverPhoto === opt.url;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPlanListCover(opt.url)}
                        className={`relative aspect-square rounded-2xl overflow-hidden bg-muted active:scale-95 transition-transform ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                      >
                        <img src={opt.url} alt={opt.name} loading="lazy" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-semibold text-white leading-tight line-clamp-2 [text-shadow:_0_1px_2px_rgb(0_0_0/60%)]">{opt.name}</span>
                        {isCurrent && (
                          <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Arkusz edycji daty wyjazdu (kalendarz) */}
        {datePickerOpen && (
          <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={() => setDatePickerOpen(false)}>
            <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-2 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: "88dvh" }}>
              <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-3" />
              <div className="px-3 pb-1 text-center">
                <p className="text-base font-bold leading-tight">Wybierz daty dla trasy <span className="font-normal text-muted-foreground">(opcjonalnie)</span></p>
              </div>
              <FullCalendarPicker onConfirm={saveDate} allowPast onClear={clearDate} />
            </div>
          </div>
        )}

        {/* Input zdjec (galeria na web; native uzywa CapCamera) */}
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handlePhotoUpload} />
        <input ref={pinFileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handlePinFileInput} />
        <input ref={coverFileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleCoverFileInput} />
        <input ref={listCoverFileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleListCoverFileInput} />

        {/* Rozwinięta interaktywna mapa (zoom) */}
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

        {/* Ustawienia prywatnosci (pelnoekranowo, wg zalacznika - jasny motyw, copy pod Trase) */}
        {privacyOpen && (
          <div className="fixed inset-0 z-[85] bg-background flex flex-col max-w-lg mx-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
              <button onClick={() => setPrivacyOpen(false)} aria-label={t("a11y.back_to_journal", { defaultValue: "Wróć" })} className="h-9 w-9 flex items-center justify-center -ml-1 rounded-full text-foreground active:scale-90 transition-transform">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="text-lg font-bold">Ustawienia prywatności</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              <p className="text-2xl font-black leading-tight mb-5">Kto może zobaczyć ten wyjazd?</p>
              <div className="flex flex-col gap-3">
                {([
                  { mode: "private" as const, Icon: Lock, title: "Tylko ja", desc: "Maksymalna prywatność. Widzisz ten wyjazd tylko Ty oraz osoby, które zaprosisz lub oznaczysz. Nie pojawia się nigdzie w Trasie." },
                  { mode: "friends" as const, Icon: Users, title: "Bliscy znajomi", desc: "Ten wyjazd widzą tylko Twoi znajomi oraz osoby zaproszone lub oznaczone." },
                  { mode: "public" as const, Icon: Globe, title: "Wszyscy", desc: "Wyjazd jest widoczny publicznie - pojawia się w eksploracji i każdy może go zobaczyć." },
                ]).map((opt) => {
                  const selected = privacyMode === opt.mode;
                  return (
                    <button key={opt.mode} onClick={() => setPrivacy(opt.mode)} className={`w-full text-left rounded-2xl p-4 border-2 transition-colors active:scale-[0.99] ${selected ? "border-primary bg-primary/5" : "border-border/50 bg-secondary/40"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <opt.Icon className="h-5 w-5 text-foreground shrink-0" />
                          <p className="text-base font-bold text-foreground truncate">{opt.title}</p>
                        </div>
                        <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-primary" : "border-border"}`}>
                          {selected && <span className="h-3 w-3 rounded-full bg-primary" />}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-8 mb-3">Dostęp ogólny</p>
              <button onClick={() => setQrShareOpen(true)} className="w-full flex items-center gap-2.5 rounded-2xl bg-secondary p-4 active:scale-[0.99] transition-transform">
                <Share className="h-5 w-5 text-foreground shrink-0" />
                <span className="text-base font-semibold text-foreground">Udostępnij ten wyjazd</span>
              </button>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Udostępniaj linki do swoich wyjazdów niezależnie od ustawień prywatności.</p>
            </div>
          </div>
        )}

        {/* Arkusz QR: udostepnij wyjazd kodem QR + link. */}
        {qrShareOpen && (
          <div className="fixed inset-0 z-[95] flex items-end justify-center" onClick={() => setQrShareOpen(false)}>
            <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg bg-card rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
              <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 mb-4" />
              <button onClick={() => setQrShareOpen(false)} aria-label="Zamknij" className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4" />
              </button>
              <p className="text-lg font-bold mb-4 pr-8">Udostępnij wyjazd kodem QR</p>
              <div className="flex items-center gap-4 pb-4 border-b border-border/30">
                <div className="shrink-0 rounded-2xl bg-white p-2.5 border border-border/40">
                  <QRCodeSVG value={shareUrl} size={104} bgColor="#ffffff" fgColor="#0E0E0E" level="M" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold leading-tight truncate">{displayName || cityLabel}</p>
                  {dateLabel && <p className="text-sm text-muted-foreground mt-1"><span className="font-semibold text-foreground">Data:</span> {dateLabel}</p>}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button onClick={copyShareLink} className="text-sm font-semibold text-foreground active:opacity-70">Skopiuj link</button>
                    <button onClick={shareLink} aria-label="Udostępnij link" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                      <Share2 className="h-4 w-4 text-foreground" />
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={shareLink} className="w-full h-12 rounded-2xl bg-orange-100 text-foreground font-semibold text-sm mt-4 active:scale-[0.98] transition-transform">
                Zaproś znajomych do trasy
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Header: minimalny (Sugestie/Galeria) albo pełne Hero ──────────── */}
      {((isMemory || forceEdit) && isOwner && (!reviewed || editingStepper)) ? (
        /* Widok Sugestie/Galeria (wg Figmy 897:1832): tylko chevron wstecz - bez okładki i tytułu. */
        <div className="flex items-center px-3 shrink-0" style={{ paddingTop: "calc(max(16px, env(safe-area-inset-top, 16px)) + 6px)", paddingBottom: "8px" }}>
          <button
            onClick={() => {
              haptics.light();
              if (step === 3) { setStep(2); return; }
              if (editingStepper) { setEditingStepper(false); setSummaryTab("plan"); return; }
              navigate(-1);
            }}
            aria-label={t("cta.back")}
            className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>
      ) : (
      /* ── Hero (podsumowanie / gość / aktywny przegląd) ──────────────────── */
      <div className={`relative w-full ${(isMemory || forceEdit) ? "aspect-[16/9]" : (hasRealPhoto ? "aspect-[4/5]" : "aspect-[16/10]")} flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500`}>
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Ciemny gradient overlay - dla placeholdera mocniejszy (kontrast tekstu, WCAG) */}
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />

        <div className="absolute left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ top: "calc(max(16px, env(safe-area-inset-top, 16px)) + 6px)" }}>
          {/* Strzałkę cofania chowamy TYLKO w stepperze właściciela (tam nawigacja to
              "Gotowe"/"Wstecz"). W podsumowaniu, u gościa i w aktywnym widoku - pokazujemy. */}
          {editingStepper ? (
            /* Tryb edycji: cofanie wraca do podsumowania wpisu (nie wychodzi z dziennika). */
            <button onClick={() => { setEditingStepper(false); setSummaryTab("plan"); }} aria-label={t("a11y.finish_editing")} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          ) : !(isMemory && isOwner && !reviewed) ? (
            <button onClick={() => navigate("/dziennik")} aria-label={t("a11y.back_to_journal")} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-white/70 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">{t("status.saving")}</span>
            )}
            {isOwner && isPublic && (
              <button onClick={shareLink} aria-label={t("a11y.share_route")} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
                <Share2 className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-6">
          {dateLabel && <p className="text-white/70 text-sm mb-1 w-fit">{dateLabel}</p>}
          <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm w-fit">{cityLabel}</h1>

          {editingName ? (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                autoFocus
                maxLength={60}
                placeholder={t("entry.name_placeholder")}
                className="flex-1 min-w-0 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg px-3 py-1.5 text-white text-base font-medium placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                style={{ fontSize: "16px" }}
              />
              <button onClick={saveName} disabled={savingName} aria-label={t("a11y.save_name")}
                className="h-9 w-9 shrink-0 rounded-lg bg-white/90 text-orange-600 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          ) : (
            (customName || isOwner) && (
              <button
                onClick={() => { if (!isOwner) return; setNameVal(customName); setEditingName(true); }}
                className={`flex items-center gap-1.5 mt-0.5 text-white/80 text-base font-medium ${isOwner ? "active:opacity-70" : "cursor-default"}`}
              >
                <span>{displayName}</span>
                {isOwner && <Pencil className="h-3.5 w-3.5 text-white/60 shrink-0" />}
              </button>
            )
          )}

          {groupParticipants.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {groupParticipants.slice(0, 5).map((p) => (
                  <div key={p.id} className="h-7 w-7 rounded-full border-2 border-white/60 overflow-hidden bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                    <img src={avatarSrc(p.avatar_url)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {groupParticipants.length > 5 && (
                  <div className="h-7 w-7 rounded-full border-2 border-white/60 bg-black/50 flex items-center justify-center text-white text-[9px] font-bold">+{groupParticipants.length - 5}</div>
                )}
              </div>
              <span className="text-white/70 text-xs font-medium">{t("group.participants_count", { count: groupParticipants.length })}</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {(isMemory || forceEdit) ? (
          isOwner ? (
            (!reviewed || editingStepper) ? (
            /* ══ EDYCJA WPISU (właściciel) - BEZ steppera: Sugestie → Galeria (wg Figmy 897:1832).
               Miejsca user ulozyl w ComposeWyjazd; tutaj tylko sugestia + notki per miejsce, potem galeria. ══ */
            <>
              {step === 2 && (
                <div className="px-5 pb-5">
                  {/* Opis ogolny trasy (review_narrative, autosave) */}
                  <div className="pb-6">
                    <h2 className="font-display text-xl font-bold text-foreground tracking-tight mb-1">Opis trasy</h2>
                    <p className="text-[13px] text-muted-foreground mb-3">Ogólny opis Twojej trasy: dla kogo, na jaką okazję, co ją wyróżnia</p>
                    <div className="relative">
                      <textarea
                        value={suggestion}
                        onChange={(e) => { setSuggestion(e.target.value); saveSuggestion(e.target.value); }}
                        onFocus={() => setNoteFocused(true)}
                        onBlur={() => setNoteFocused(false)}
                        placeholder="Opisz swoją trasę: dla kogo, na jaką okazję, co warto zobaczyć..."
                        rows={5}
                        className="w-full bg-secondary/60 rounded-2xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
                      />
                      {suggestionSaved && <span className="absolute bottom-2.5 right-3 text-[10px] text-green-600 font-medium">Zapisano</span>}
                    </div>
                  </div>

                  {/* Miejsca + toggle Lista/Karty */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display text-xl font-bold text-foreground tracking-tight">Miejsca</p>
                    <div className="flex rounded-full bg-muted p-0.5">
                      <button onClick={() => setPlanView("list")} aria-label={t("a11y.list_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
                      <button onClick={() => setPlanView("cards")} aria-label={t("a11y.cards_view")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><GalleryHorizontalEnd className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {currentPins.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">{t("empty.no_places_note")}</p>
                  ) : planView === "list" ? (
                    /* Notki per-miejsce usuniete (2026-07-29): obnizamy friction, skupiamy sie na
                       zdjeciach do miejsc. Zostaje tylko ogolna sugestia do calej trasy (wyzej).
                       Kolejnosc miejsc = DRAG & DROP (uchwyt z lewej) + kosz z potwierdzeniem. */
                    <Reorder.Group axis="y" values={workingPins} onReorder={setWorking} className="space-y-2.5">
                      {workingPins.map((pin: any, i: number) => {
                        const nk = rkey(activeRouteId!, pin.place_name);
                        return (
                          <SortableReviewRow
                            key={pin.id}
                            pin={pin}
                            idx={i}
                            categoryLabel={catLabel(pin.category)}
                            visited={isVisited(pin)}
                            onOpen={() => openDetail(pin)}
                            onRemove={() => removeWorkingPin(pin.id)}
                            noteValue={notes[nk] ?? ""}
                            noteOpen={openNotes.has(pin.id)}
                            onToggleNote={() => setOpenNotes((prev) => { const n = new Set(prev); n.has(pin.id) ? n.delete(pin.id) : n.add(pin.id); return n; })}
                            onNoteChange={(v) => handleNoteChange(pin.place_name, v)}
                            noteSaved={!!noteSaved[nk]}
                            onNoteFocusChange={setNoteFocused}
                          />
                        );
                      })}
                    </Reorder.Group>
                  ) : (
                    renderSwiper(true, true, false)
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="pb-5">
                  <p className="px-5 font-display text-xl font-bold text-foreground tracking-tight mb-1">Zdjęcia z wyjazdu</p>
                  <p className="px-5 text-[13px] text-muted-foreground mb-3 leading-relaxed">Dodaj zdjęcia z całej podróży</p>
                  {renderGallery(true)}
                  {renderPinPhotoSection()}
                  {/* Sekcja "Podziel sie trasa" usunieta (2026-07-29): trasy sa domyslnie publiczne,
                      obnizamy friction - user nie musi nic przelaczac. */}
                </div>
              )}
            </>
            ) : (
            /* ══ WSPOMNIENIE (właściciel) - PODSUMOWANIE: Miejsca+notki | Zdjęcia + edycja ══ */
            <>
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-5 pt-3 pb-2.5 flex items-center gap-2">
                <div className="flex-1 flex rounded-full bg-muted p-0.5">
                  <button onClick={() => setSummaryTab("plan")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors ${summaryTab === "plan" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    <MapIcon className="h-4 w-4" /> {t("tabs.places")}
                  </button>
                  <button onClick={() => setSummaryTab("galeria")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors ${summaryTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    <ImageIcon className="h-4 w-4" /> {t("tabs.photos")}
                  </button>
                </div>
                <button onClick={() => { if (!isPublic) { setVisibility(shareAnonymous ? "anon" : "profile"); notify.success(t("toast.route_public"), undefined, { position: "top-center" }); } setShareSheetOpen(true); }} aria-label={t("a11y.share_route")}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <Share className="h-4 w-4 text-foreground" />
                </button>
                <button onClick={() => { setEditingStepper(true); setStep(2); }} aria-label={t("a11y.edit_entry")}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <Pencil className="h-4 w-4 text-foreground" />
                </button>
              </div>

              {summaryTab === "plan" ? (
                <div className="px-5 pt-4 pb-5">
                  {currentPins.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">{t("empty.no_places")}</p>
                  ) : (
                    <>
                      {/* Wyrazne wejscie w edycje istniejacej trasy (opis + notki per miejsce) */}
                      {isOwner && (
                        <button
                          onClick={() => { setEditingStepper(true); setStep(2); }}
                          className="w-full mb-4 py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                          <Pencil className="h-4 w-4" /> Edytuj trasę
                        </button>
                      )}
                      {/* Opis trasy (read) */}
                      {suggestion?.trim() && (
                        <div className="mb-5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Opis trasy</p>
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{suggestion}</p>
                        </div>
                      )}
                      {renderPlanHeader(true)}
                      {planView === "list" ? renderListReadonly(true) : renderSwiper(false, true)}
                    </>
                  )}
                </div>
              ) : (
                <div className="pt-2 pb-5">{renderGallery(true)}</div>
              )}
            </>
            )
          ) : (
            /* ══ WSPOMNIENIE (gość): read-only galeria + plan ══ */
            <div className="pt-2 pb-5">
              {renderGallery(false)}
              {currentPins.length > 0 && <div className="px-5 mt-5">{renderListReadonly(false)}</div>}
            </div>
          )
        ) : (
          /* ══ AKTYWNY WPIS: edytowalny plan (Lista + Szczegoly), bez oceny/wspomnien ══ */
          <>
            {currentPins.length > 0 && (
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                {renderPlanHeader(true)}
                {planView === "list" ? renderEditablePlan(false) : renderSwiper(true, false)}
              </div>
            )}

            {activeDay?.ai_highlight && (
              <div className="px-5 pt-6 pb-5 border-b border-border/30">
                <p className="text-[22px] font-bold leading-snug text-foreground">„{activeDay.ai_highlight}"</p>
              </div>
            )}

            {activeDay?.ai_summary && (
              <div className="px-5 pt-5 pb-5 border-b border-border/30">
                <p className="text-sm text-foreground/70 leading-relaxed">{activeDay.ai_summary}</p>
              </div>
            )}
            {/* Sekcja zdjec usunieta w aktywnym wpisie - zostaje sam plan trasy.
                Zdjecia dodaje sie dopiero we wspomnieniu (zakladka Galeria). */}
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handlePhotoUpload} />
        <input ref={pinFileInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handlePinFileInput} />
        <input ref={coverFileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleCoverFileInput} />
      </div>

      {/* ── Podglad wizytowki miejsca (ta sama co na swiperze) ───────────── */}
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => !o && setDetailPin(null)}
        place={detailPin}
        city={route?.city}
      />

      {/* ── Dodawanie miejsca do planu dnia ──────────────────────────────── */}
      {addingPlace && (
        <AddPinSheet
          open={addingPlace}
          onOpenChange={(o) => !o && setAddingPlace(false)}
          onPinAdd={handleAddPin}
          cityContext={route?.city ?? ""}
          existingPinNames={currentPins.map((p: any) => p.place_name)}
        />
      )}

      {/* ── Popup: udostepnic trase w Eksploruj? (po zatwierdzeniu planu) ──── */}
      {showSharePrompt && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSharePrompt(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black leading-snug">{t("prompt.title")}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("prompt.desc")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { togglePublic(true); setShowSharePrompt(false); notify.success(t("toast.route_public")); }}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                {t("prompt.confirm")}
              </button>
              <button
                onClick={() => { togglePublic(false); setShowSharePrompt(false); }}
                className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                {t("prompt.keep_private")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Arkusz udostepniania (skrot obok edycji): widocznosc + podpis + osoby ── */}
      {shareSheetOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/40" onClick={() => setShareSheetOpen(false)}>
          <div className="bg-background rounded-t-3xl max-h-[88dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <p className="text-lg font-black">{t("share_sheet.title")}</p>
              <button onClick={() => setShareSheetOpen(false)} aria-label={t("a11y.close")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
              {renderShareDrawer()}
              {isPublic && (
                <>
                  <div className="px-5 mt-5">
                    <button onClick={shareLink}
                      className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                      <Share2 className="h-4 w-4" /> {t("share_sheet.share_link")}
                    </button>
                  </div>
                  {/* Cofniecie udostepnienia - trasa znika z Eksploruj (zostaje prywatna). */}
                  <div className="px-5 mt-2">
                    <button onClick={() => { setVisibility("private"); setShareSheetOpen(false); notify.success(t("toast.route_hidden"), undefined, { position: "top-center" }); }}
                      className="w-full py-3 rounded-full text-muted-foreground font-bold text-sm active:scale-[0.98] transition-transform">
                      {t("share_sheet.stop_sharing")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Arkusz "Zdjęcia do miejsca" + fullscreen viewer (wspólne dla widoku planu i kroku Galeria). */}
      {renderPinPickerSheet()}
      {renderPhotoViewer()}

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      {/* W PODSUMOWANIU (wpis zrecenzowany) nie ma dolnego CTA - wyjscie przez strzalke cofania. */}
      {!noteFocused && !((isMemory || forceEdit) && isOwner && reviewed && !editingStepper) && (
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        {(isMemory || forceEdit) && isOwner && (!reviewed || editingStepper) ? (
          /* Stepper wpisu: Wstecz + Dalej/Gotowe. Edycje persystują (autosave on unmount +
             savePlan(false)); "Gotowe" oznacza wpis jako zrecenzowany (plan_finalized) i
             przechodzi do PODSUMOWANIA (nie wychodzi do Dziennika). */
          /* Sugestie(2): Wstecz + Przejdź do Galerii. Galeria(3): Wstecz + Zapisz trasę. */
          <div className="flex gap-2">
            <button
              onClick={() => {
                haptics.light();
                if (step === 3) { setStep(2); return; }
                if (editingStepper) { setEditingStepper(false); setSummaryTab("plan"); return; }
                navigate(-1);
              }}
              className="px-5 py-3.5 rounded-2xl border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-transform shrink-0"
            >
              {t("cta.back")}
            </button>
            {step === 2 ? (
              <button
                onClick={() => { haptics.light(); setStep(3); }}
                className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform"
              >
                Przejdź do Galerii
              </button>
            ) : (
              <button
                onClick={finishEditing}
                disabled={savingPlan}
                className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                {savingPlan ? t("status.saving") : "Zapisz trasę"}
              </button>
            )}
          </div>
        ) : !isMemory && draft && draft.dayId === activeRouteId ? (
          <button
            onClick={() => savePlan(false)}
            disabled={savingPlan || workingPins.length === 0}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {savingPlan ? t("status.saving") : t("cta.save_changes")}
          </button>
        ) : (
          <button onClick={() => navigate("/dziennik")} className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform">
            {t("cta.done")}
          </button>
        )}
      </div>
      )}
    </div>
  );
};

// Owijka ErrorBoundary: kazdy throw w renderze podsumowania (np. niespodziewany ksztalt
// danych przy zakonczeniu trasy) pokazuje ekran "Wroc do glownej" zamiast zawieszki.
export default function ReviewSummaryPage() {
  return (
    <ErrorBoundary>
      <ReviewSummary />
    </ErrorBoundary>
  );
}
