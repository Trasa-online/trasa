import { useState, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchRouteLike, toggleRouteLike, type LikeState } from "@/lib/likes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { sendClientPush, getCurrentUserName } from "@/lib/clientPush";
import { format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { MapPin, ArrowLeft, Sparkles, ChevronRight, ChevronLeft, Bookmark, List, GalleryHorizontalEnd, Calendar as CalendarIcon, Image as ImageIcon, Maximize2, X, Building2, Pencil, Trash2, Heart, Share2, Plus, Map as MapIcon, Loader2, Star, GripVertical } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlacePhoto } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { EmptyPlacesState } from "@/components/route/EmptyPlacesState";
import AddPlaceSheet from "@/components/route/AddPlaceSheet";
import InviteFriendsSheet from "@/components/route/InviteFriendsSheet";
import { inviteUsersToRoute } from "@/lib/groupInvite";
import { useShare } from "@/hooks/useShare";
import { useUnsavePlace } from "@/hooks/useUnsavePlace";
import { buildShareUrl } from "@/lib/shareUrl";
import type { PlaceForList } from "@/lib/placeLists";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import RouteMap from "@/components/RouteMap";
import { API_BASE } from "@/lib/platform";
import { compressImage } from "@/lib/imageCompression";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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
function SortableRouteRow({ value, rowPin, index, categoryLabel, onOpen, onGoogle, onDelete, note }: {
  value: any; rowPin: any; index: number; categoryLabel: ReactNode;
  onOpen: () => void; onGoogle: () => void; onDelete: () => void; note?: ReactNode;
}) {
  const controls = useDragControls();
  const grip = (
    <span
      onPointerDown={(e) => controls.start(e)}
      aria-label="Przeciągnij, by zmienić kolejność"
      className="shrink-0 w-6 flex items-center justify-center text-muted-foreground/45 cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical className="h-5 w-5" />
    </span>
  );
  return (
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} transition={{ duration: 0 }}>
      <RoutePlaceRow pin={rowPin} index={index} categoryLabel={categoryLabel} onOpen={onOpen} onGoogle={onGoogle} onDelete={onDelete} dragHandle={grip} note={note} />
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
    description: pin.description ?? null, latitude: pin.latitude ?? null, longitude: pin.longitude ?? null,
    photo_url: pin.photo_url ?? null, place_id: pin.place_id ?? null,
  });
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  const [planTab, setPlanTab] = useState<"miejsca" | "galeria" | "mapa">("miejsca");
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [planMapOpen, setPlanMapOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null); // fullscreen podglad zdjecia galerii
  // Usuniecie wyjazdu (wlasciciel) - nieodwracalne, walidacja "czy na pewno?".
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
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
        .select("id, title, city, user_id, day_number, folder_id, start_date, ai_summary, ai_highlight, review_photos, review_narrative, group_session_id, tags, list_cover_url")
        .eq("id", id as string)
        .eq("is_shared", true)
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
      if (!ids.length) return [] as (string | null)[];
      const { data: profs } = await (supabase as any).from("profiles").select("id, avatar_url").in("id", ids);
      return (profs ?? []).map((p: any) => (p.avatar_url ?? null)) as (string | null)[];
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
        .select("id, place_name, address, category, suggested_time, images, image_url, user_photo_urls, photo_url, place_id, latitude, longitude, pin_order, description, tags")
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

  // Notki autora trasy (pin_ratings SELECT jest publiczny).
  const { data: authorNotes = [] } = useQuery({
    queryKey: ["shared-route-notes", id, route?.user_id],
    queryFn: async () => {
      if (!route?.user_id) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("place_name, note")
        .eq("route_id", id!)
        .eq("user_id", route.user_id);
      return (data ?? []) as any[];
    },
    enabled: !!id && !!route?.user_id,
  });

  const noteMap: Record<string, { note: string | null }> = {};
  for (const r of authorNotes) noteMap[r.place_name] = { note: r.note };

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

  if (routeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">{t("loading")}</div>
      </div>
    );
  }

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

  // Zmiana kolejnosci miejsc (drag) - optymistycznie w cache + persist pin_order (bezposredni update,
  // RLS zezwala wlascicielowi i czlonkowi). Wzor: ReviewSummary.savePlan.
  const persistPinOrder = async (ordered: any[]) => {
    await Promise.all(ordered.map((p: any, idx: number) => (supabase as any).from("pins").update({ pin_order: idx }).eq("id", p.id)));
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
  };
  const handleReorderPins = (newOrder: any[]) => {
    queryClient.setQueryData(["shared-route-pins", id], newOrder);
    void persistPinOrder(newOrder);
  };

  const handleShare = () => { void share({ title: route.title || cityLabel || "Wyjazd", url: buildShareUrl(`/route/${route.id}`) }); };

  // Wlasciciel dodaje miejsca do ISTNIEJACEJ trasy: append do pins (jak AddPlaceToTrip), potem refetch.
  const handleAddPlaces = async (places: PlaceForList[]) => {
    if (!user) return;
    const maxOrder = pins.reduce((m: number, p: any) => Math.max(m, p.pin_order ?? -1), -1);
    const rows = places.map((p, i) => ({
      route_id: route.id, place_name: p.place_name, address: p.address ?? null, description: p.description ?? null,
      category: p.category ?? "other", latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      place_id: p.place_id ?? null, suggested_time: null, photo_url: p.photo_url ?? null,
      pin_order: maxOrder + 1 + i, original_creator_id: user.id,
    }));
    const { error } = await (supabase as any).from("pins").insert(rows);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
  };

  const existingPinNames = new Set(pins.map((p: any) => (p.place_name || "").trim().toLowerCase()));

  // #7: wlasciciel LUB uczestnik wspolnego wyjazdu dodaje zdjecia z widoku (Galeria). HEIC->JPEG
  // + kompresja -> route-images -> RPC append_route_photos (owner|czlonek) -> refetch.
  const handleAddPhotos = async (files: File[]) => {
    if (!user || !files.length) return;
    setUploadingPhotos(true);
    const urls: string[] = [];
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
    if (urls.length) {
      // RPC (SECURITY DEFINER) - dziala dla wlasciciela ORAZ uczestnika wspolnego wyjazdu
      // (routes UPDATE RLS = tylko owner; czlonek dopisuje zdjecia przez append_route_photos).
      const { error } = await (supabase as any).rpc("append_route_photos", { p_route_id: route.id, p_urls: urls });
      if (error) { toast.error("Nie udało się zapisać zdjęć"); }
      else { toast.success(urls.length === 1 ? "Dodano zdjęcie" : `Dodano ${urls.length} zdjęcia`); queryClient.invalidateQueries({ queryKey: ["shared-route", id] }); }
    } else { toast.error("Nie udało się dodać zdjęć"); }
    setUploadingPhotos(false);
  };

  // #4: wlasciciel usuwa miejsce z trasy (kosz w wierszu). Toast + "Cofnij" (re-insert).
  const handleDeletePin = async (pin: any) => {
    const { id: _id, created_at, updated_at, ...rest } = pin;
    const { error } = await (supabase as any).from("pins").delete().eq("id", pin.id);
    if (error) { toast.error("Nie udało się usunąć miejsca"); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
    toast.success("Usunięto miejsce", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          await (supabase as any).from("pins").insert({ ...rest });
          queryClient.invalidateQueries({ queryKey: ["shared-route-pins", id] });
        },
      },
    });
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
      if (window.history.length > 1) navigate(-1); else navigate("/moj-profil");
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
  const cover = userCover ?? placeCover;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(route.id);
  // Opis trasy (pod tytulem) = podsumowanie AI albo podpis autora.
  // Opis trasy: preferuj reczny opis autora (review_narrative), potem AI/podpis udostepnienia.
  const routeDescription: string = (route as any).review_narrative || route.ai_summary || shareMeta?.share_caption || "";
  // Galeria = wszystkie zdjecia wyjazdu autora (review_photos), z rozwiazanym URL-em.
  const galleryPhotos: string[] = ((route.review_photos ?? []) as any[])
    .map((u) => (typeof u === "string" ? resolveStored(u) : null))
    .filter((u): u is string => !!u);
  const dateLabel = route.start_date ? format(new Date(route.start_date), "d MMMM yyyy", { locale: dateLocale() }) : "";
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

  // Read-only notka autora pod miejscem.
  const renderRatingNote = (placeName: string, centered = false) => {
    const r = noteMap[placeName];
    if (!r || !r.note) return null;
    return (
      <div className={`mt-3 pt-3 border-t border-border/40 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("author_note")}</p>
        <p className="text-sm text-foreground/80 leading-relaxed text-left whitespace-pre-wrap">{r.note}</p>
      </div>
    );
  };

  // Plaska lista miejsc (wg Figmy: bez grupowania po kategorii) - wspoldzielony RoutePlaceRow
  // (duze zdjecie 104px, chip kategorii + guzik Google). Notka autora pod wierszem gdy jest.
  const buildNote = (pin: any): ReactNode | undefined => {
    const noteText = (noteMap[pin.place_name]?.note ?? "").trim();
    return noteText ? (
      <div>
        <p className="text-sm font-semibold text-foreground">Notka Autora</p>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-0.5">{noteText}</p>
      </div>
    ) : undefined;
  };
  const rowPinFor = (pin: any) => (coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin);

  const renderList = () =>
    canEdit ? (
      // Tryb edycji (wlasciciel/uczestnik): przeciaganie zmienia kolejnosc, kosz usuwa.
      <Reorder.Group axis="y" values={pins} onReorder={handleReorderPins} as="div">
        {pins.map((pin: any, i: number) => (
          <SortableRouteRow
            key={pin.id}
            value={pin}
            rowPin={rowPinFor(pin)}
            index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGooglePlace(pin)}
            onDelete={() => handleDeletePin(pin)}
            note={buildNote(pin)}
          />
        ))}
      </Reorder.Group>
    ) : (
      <div>
        {pins.map((pin: any, i: number) => (
          <RoutePlaceRow
            key={pin.id}
            pin={rowPinFor(pin)}
            index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGooglePlace(pin)}
            onSave={!isOwner && user ? () => toggleSaveBookmark(pin) : undefined}
            saved={isSaved(pin.place_name)}
            note={buildNote(pin)}
          />
        ))}
      </div>
    );

  // Kafelki (wg Figmy): poziomy scroll kart ~168px. Peachy zdjecie (badge kategorii + bookmark +
  // nazwa), pod spodem Notka Autora + notka + "Zobacz w Google".
  const renderSwiper = () => (
    <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none -mr-5 pr-5 pb-2">
      {pins.map((pin: any) => {
        const noteText = (noteMap[pin.place_name]?.note ?? "").trim();
        const pinForPhoto = coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin;
        return (
          <div key={pin.id} className="snap-start shrink-0 w-[168px] flex flex-col gap-3">
            <div onClick={() => openDetail(pin)} role="button" className="relative aspect-square rounded-2xl overflow-hidden bg-[#fcede3] active:opacity-90 transition-opacity cursor-pointer">
              <PlacePhoto pin={pinForPhoto} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-white text-[11px] font-semibold text-foreground shadow-sm">{categoryLabel(pin.category)}</span>
              {!isOwner && user && (
                <button onClick={(e) => { e.stopPropagation(); toggleSaveBookmark(pin); }} aria-label={isSaved(pin.place_name) ? "Usuń z zapisanych" : "Zapisz miejsce"}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-transform">
                  <Bookmark className={cn("h-4 w-4", isSaved(pin.place_name) ? "fill-orange-600 text-orange-600" : "text-foreground")} strokeWidth={2} />
                </button>
              )}
              <span className="absolute bottom-2 left-2.5 right-2.5 text-sm font-semibold text-white drop-shadow line-clamp-1">{pin.place_name}</span>
            </div>
            <div className="flex flex-col gap-2">
              {/* Google bezposrednio pod miniaturka (#5), nad Notka Autora */}
              <button onClick={() => openGooglePlace(pin)} className="flex items-center gap-2 active:opacity-70 transition-opacity">
                <span className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0"><GoogleGlyph className="h-[18px] w-[18px]" /></span>
                <span className="text-sm font-medium text-foreground">Zobacz w Google</span>
              </button>
              {noteText && (
                <div>
                  <p className="text-sm font-semibold text-foreground">Notka Autora</p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5 mt-0.5">{noteText}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">

      {/* Staly TopBar (naglowek nad obszarem scrolla): wstecz + autor + uczestnicy + miasto + liczba miejsc + serce */}
      <div className="shrink-0 bg-background px-5 pb-2.5 border-b border-border/40" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <div className="flex items-center gap-2 flex-wrap text-sm">
            <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); }} aria-label="Wróć"
              className="h-9 w-9 -ml-2 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            {!isAnon && author?.username ? (
              <button
                onClick={() => navigate(`/profil/${author.username}`)}
                className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity"
              >
                <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                @{author.username}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                {!isAnon && <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />}
                {authorName}
              </span>
            )}
            {/* Uczestnicy trasy grupowej - nachodzacy stack awatarow obok hosta. */}
            {groupParticipants.length > 0 && (
              <span className="flex items-center -space-x-2">
                {groupParticipants.slice(0, 3).map((a, i) => (
                  <img key={i} src={avatarSrc(a)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 ring-2 ring-background" />
                ))}
                {groupParticipants.length > 3 && (
                  <span className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] font-bold text-foreground">+{groupParticipants.length - 3}</span>
                )}
              </span>
            )}
            {cityLabel && <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-4 w-4" />{cityLabel}</span>}
            <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{pins.length} {pins.length === 1 ? "miejsce" : pins.length < 5 ? "miejsca" : "miejsc"}</span>
            {/* Serce polubienia wyjazdu w TopBarze - TYLKO gosc. Wlasciciel nie lajkuje wlasnej trasy. */}
            {!isOwner && (
              <button onClick={toggleLike} aria-label="Polub trasę" className="ml-auto shrink-0 flex items-center gap-1 active:scale-90 transition-transform">
                <Heart className={cn("h-5 w-5", routeLike.liked ? "fill-red-500 text-red-500" : "text-foreground/70")} />
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{routeLike.count}</span>
              </button>
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
                <button onClick={handleShare} aria-label="Udostępnij" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Share2 className="h-4 w-4 text-foreground" /></button>
                <button onClick={() => navigate(`/review-summary?route=${route.id}&edit=1`)} aria-label="Edytuj trasę" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Pencil className="h-4 w-4 text-foreground" /></button>
                <button onClick={() => setAskDelete(true)} aria-label="Usuń wyjazd" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            )}
          </div>
          {dateLabel && (
            <div className="flex items-center gap-1.5 mt-2.5 text-foreground">
              <CalendarIcon className="h-5 w-5 shrink-0" />
              <span className="text-base">{dateLabel}</span>
            </div>
          )}
          {route.ai_highlight && (
            <p className="text-[17px] font-bold leading-snug text-foreground mt-3">„{route.ai_highlight}"</p>
          )}
          {routeDescription && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">{routeDescription}</p>
          )}
          {/* Tagi CALEJ TRASY (routes.tags) - neutralny bialy chip. */}
          {Array.isArray((route as any).tags) && (route as any).tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(route as any).tags.map((tg: string) => (
                <span key={tg} className="inline-flex items-center rounded-full bg-white border border-border/60 text-foreground px-3 py-1 text-[13px] font-semibold">{tg}</span>
              ))}
            </div>
          )}
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
            {([
              { k: "miejsca", Icon: MapPin, label: "Miejsca" },
              { k: "galeria", Icon: ImageIcon, label: "Galeria" },
              { k: "mapa", Icon: MapIcon, label: "Mapa" },
            ] as const).map(({ k, Icon, label }) => {
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

        {planTab === "miejsca" ? (
          <div className="px-5 pt-4">
            {pins.length > 0 ? (
              <>
                <div className="flex items-center justify-end pb-3">
                  <div className="flex rounded-full bg-muted p-0.5">
                    <button onClick={() => setPlanView("list")} aria-label={t("view_list")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
                    <button onClick={() => setPlanView("cards")} aria-label={t("view_cards")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><GalleryHorizontalEnd className="h-4 w-4" /></button>
                  </div>
                </div>
                {planView === "list" ? renderList() : renderSwiper()}
              </>
            ) : (
              <EmptyPlacesState
                title="Trasa jest pusta"
                hint={canEdit ? "Dodaj pierwsze miejsce klikając guzik „+ Dodaj nowe miejsce”" : "Ta trasa nie ma jeszcze żadnych miejsc."}
              />
            )}
          </div>
        ) : planTab === "mapa" ? (
          /* Mapa w wlasnej zakladce (obok Galeria) - statyczna Google + rozwiniecie do interaktywnej. */
          <div className="px-5 pt-4">
            {navMapPins.length > 0 && staticMapUrl ? (
              <button onClick={() => setPlanMapOpen(true)} className="relative block w-full h-64 rounded-2xl overflow-hidden border border-border/40 bg-muted active:opacity-95 transition-opacity">
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
              <div className="grid grid-cols-2 gap-2">
                {/* #7: wlasciciel LUB uczestnik wspolnego wyjazdu - kafelek dodawania zdjecia */}
                {canAddPhotos && (
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}
                    className="aspect-[4/3] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground active:scale-[0.98] transition-transform disabled:opacity-60">
                    {uploadingPhotos ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Plus className="h-6 w-6" /><span className="text-xs font-semibold">Dodaj zdjęcie</span></>}
                  </button>
                )}
                {galleryPhotos.map((url, i) => (
                  <div key={i} onClick={() => setViewerIndex(i)} role="button" className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted active:opacity-90 transition-opacity cursor-pointer">
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    {/* #c: ustaw okladke eksploracji (gwiazdka) + #3: usun zdjecie (kosz) - wlasciciel */}
                    {isOwner && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); void handleSetCover(url); }} aria-label="Ustaw jako okładkę eksploracji"
                          className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                          <Star className={`h-3.5 w-3.5 ${(route as any).list_cover_url === url ? "fill-yellow-400 text-yellow-400" : "text-white"}`} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); void handleDeletePhoto(url); }} aria-label="Usuń zdjęcie"
                          className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                          <Trash2 className="h-3.5 w-3.5 text-white" />
                        </button>
                        {(route as any).list_cover_url === url && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5">Okładka</span>
                        )}
                      </>
                    )}
                  </div>
                ))}
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
          onInvitePeople={isOwner ? () => setInviteOpen(true) : undefined}
        />
      )}
      {isOwner && (
        <InviteFriendsSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          route={{ id: route.id, city: route.city ?? null, title: route.title ?? null, group_session_id: (route as any).group_session_id ?? null }}
        />
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

      {/* Fullscreen podglad zdjecia galerii (object-contain, strzalki + licznik). */}
      {viewerIndex !== null && galleryPhotos[viewerIndex] && (
        <div className="fixed inset-0 z-[95] bg-black flex items-center justify-center animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
          <img src={galleryPhotos[viewerIndex]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setViewerIndex(null)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
            <X className="h-5 w-5 text-white" />
          </button>
          {galleryPhotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex - 1 + galleryPhotos.length) % galleryPhotos.length); }} aria-label="Poprzednie" className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex + 1) % galleryPhotos.length); }} aria-label="Następne" className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
              <span className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-white/85 text-sm font-medium">{viewerIndex + 1} / {galleryPhotos.length}</span>
            </>
          )}
        </div>
      )}

      {/* CTA: editor (wlasciciel LUB uczestnik wspolnego wyjazdu) = "Dodaj nowe miejsce"; gosc = zapisz + zaplanuj. */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-2 bg-background border-t border-border/30"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        {canEdit ? (
            <button
              onClick={() => setAddPlaceOpen(true)}
              className="w-full py-3 rounded-full border border-border bg-background text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" /> Dodaj nowe miejsce
            </button>
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

      {/* Sheet wyboru daty wyjazdu przy zapisie cudzej trasy do dziennika */}
      {showDateSheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDateSheet(false)}
        >
          <div
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
    </div>
  );
}
