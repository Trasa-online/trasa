import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Globe, Lock, Pencil, Check, Image as ImageIcon, Map as MapIcon, MapPin, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2, Plus, Share, Share2, List, GalleryHorizontalEnd, Info, MoreVertical } from "lucide-react";
import { useShare } from "@/hooks/useShare";
import { Switch } from "@/components/ui/switch";
import AddPinSheet from "@/components/route/AddPinSheet";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { compressImage } from "@/lib/imageCompression";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";
import { format, parseISO, isValid } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { isNative } from "@/lib/platform";
import { Camera as CapCamera } from "@capacitor/camera";
import { notify } from "@/lib/notify";
import { requestLocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/distance";
import { deferDelete } from "@/lib/deferDelete";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Limit zdjec dodawanych do galerii wpisu.
const MAX_PHOTOS = 10;

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶",
};

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

// Klucz kompozytowy ocena/notka per miejsce w danym dniu (route_id + place_name),
// zeby to samo miejsce w roznych dniach trasy wielodniowej bylo niezalezne.
const rkey = (routeId: string, placeName: string) => `${routeId}::${placeName}`;

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
  // Pod-zakladki w widoku wspomnienia: galeria zdjec / plan dnia.
  // Wpis dziennika (wlasciciel): 3-etapowy stepper. 1 Trasa (edycja) -> 2 Notki -> 3 Zdjecia.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Po ukonczeniu steppera ("Gotowe") wpis przechodzi w tryb PODSUMOWANIA (read-only:
  // Miejsca+notki | Zdjecia). Edycja (olowek) wraca do steppera. localReviewed = optymistyczne
  // przejscie do podsumowania zanim refetch route zaktualizuje plan_finalized.
  const [summaryTab, setSummaryTab] = useState<"plan" | "galeria">("plan");
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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinRatings, setPinRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSaved, setNoteSaved] = useState<Record<string, boolean>>({});
  const noteTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Udostepnianie historycznej trasy: podpis + oznaczeni czlonkowie (#11).
  const [shareCaption, setShareCaption] = useState("");

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, user_id, city, day_number, start_date, end_date, folder_id, plan_finalized, trip_type, ai_summary, ai_highlight, review_photos, is_shared, group_session_id")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

  const folderId = route?.folder_id ?? null;

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
        .select("id, title, city, day_number, start_date, end_date, plan_finalized, trip_type, ai_summary, ai_highlight, review_photos")
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
        .select("id, route_id, place_name, address, category, suggested_time, description, image_url, images, latitude, longitude, place_id, photo_url, pin_order, visited_at")
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

  // Oceny + notki (wszystkie dni naraz).
  const { data: existingRatings = [] } = useQuery({
    queryKey: ["pin-ratings", idsKey, user?.id],
    queryFn: async () => {
      if (!dayRouteIds.length || !user) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("route_id, place_name, rating, note")
        .in("route_id", dayRouteIds)
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: dayRouteIds.length > 0 && !!user,
  });

  useEffect(() => {
    if (route?.review_photos?.length) setPhotos(route.review_photos);
    if (route?.is_shared != null) setIsPublic(route.is_shared);
  }, [route?.review_photos, route?.is_shared]);

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

  useEffect(() => {
    if (existingRatings.length) {
      const rmap: Record<string, number> = {};
      const nmap: Record<string, string> = {};
      for (const r of existingRatings) {
        const k = rkey(r.route_id, r.place_name);
        if (r.rating) rmap[k] = r.rating;
        if (r.note) nmap[k] = r.note;
      }
      setPinRatings(rmap);
      setNotes(nmap);
    }
  }, [existingRatings]);

  // Udostepnij link do publicznej trasy (/#/route/:id). HashRouter => link z #.
  const shareLink = async () => {
    if (!routeId) return;
    const url = `https://trasa.travel/#/route/${routeId}`;
    const res = await share({ title: route?.title || route?.city || "Trasa", text: t("share.text"), url });
    if (res.ok && res.method === "clipboard") notify.success(t("toast.link_copied"));
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
      queryClient.invalidateQueries({ queryKey: ["discovery-newest-routes"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-warszawa-routes"] });
      queryClient.invalidateQueries({ queryKey: ["shared-route-meta", routeId] });
    }
  };
  // Kompat: showSharePrompt uzywa togglePublic(true/false).
  const togglePublic = (val: boolean) => setVisibility(val ? "profile" : "private");

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

  // Okladka wpisu = pierwsze zdjecie primary route (myPhotos[0]). Przenosi url na
  // poczatek review_photos primary route (dziala tez dla zdjec z innych dni/grupy).
  const setCover = async (url: string) => {
    if (!routeId) return;
    const updated = [url, ...photos.filter((p) => p !== url)];
    setPhotos(updated);
    await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    setViewerUrl(null);
    notify.success(t("toast.cover_set"));
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
    if (draft && draft.dayId === activeRouteId) await savePlan(false);
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
    setLocalReviewed(true); setEditingStepper(false); setSummaryTab("plan");
    queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
  };

  const ratePinHandler = async (placeName: string, rating: number) => {
    if (!activeRouteId || !user) return;
    setPinRatings((prev) => ({ ...prev, [rkey(activeRouteId, placeName)]: rating }));
    await (supabase as any).from("pin_ratings").upsert({
      route_id: activeRouteId,
      user_id: user.id,
      place_name: placeName,
      rating,
    }, { onConflict: "route_id,user_id,place_name" });
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
  const hasRealPhoto = !!(userCover || placeCover);
  const heroPhoto = userCover ?? placeCover ?? getRandomPinPlaceholder(routeId ?? undefined);
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
            className="w-full bg-muted/50 rounded-xl px-3 py-2.5 text-sm text-foreground text-left resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
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
  const renderPlanCard = (pin: any, i: number, fullWidth: boolean, editable: boolean, withRating: boolean) => (
    <div key={pin.id} className={`${fullWidth ? "w-full" : "snap-center shrink-0 w-[80vw] max-w-[320px]"} rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col transition-opacity ${activeChecklist && isVisited(pin) ? "opacity-60" : ""}`}>
      <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
        <div className="relative w-full aspect-[4/3] bg-muted">
          <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-4xl" />
          <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
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
            <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{catLabel(pin.category)}
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
      {/* Toggle "Bylem tu" (karta) - tylko w aktywnej checkliscie; poza przyciskiem openDetail. */}
      {activeChecklist && (
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
  const renderPlanRow = (pin: any, i: number, editable: boolean) => (
    <div key={pin.id} className={`flex items-center gap-3 rounded-2xl bg-secondary border border-border/40 shadow-sm p-2.5 transition-opacity ${activeChecklist && isVisited(pin) ? "opacity-60" : ""}`}>
      <button onClick={() => openDetail(pin)} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
        <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
      </button>
      <button onClick={() => openDetail(pin)} className="min-w-0 flex-1 text-left">
        <p className={`text-sm font-bold leading-tight truncate ${activeChecklist && isVisited(pin) ? "line-through" : ""}`}>{pin.place_name}</p>
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">
          <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{catLabel(pin.category)}
        </span>
      </button>
      {renderVisitedToggle(pin)}
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
              <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{catLabel(pin.category)}
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
  const renderSwiper = (editable: boolean, withRating: boolean) => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {workingPins.map((pin: any, i: number) => renderPlanCard(pin, i, false, editable, withRating))}
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
            {!item.mine && (
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

  // ── Udostępnianie wpisu: prosty toggle (udostepnij/prywatnie) + anonim + podpis + osoby. ──
  const renderSharing = () => (
    <div className="px-5">
      <div className="mt-6 pt-5 border-t border-border/30">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">{t("sharing.title")}</p>
        {/* Glowny toggle: udostepnij trase, zeby pomoc innym w planowaniu. */}
        <div className="flex items-start gap-3 rounded-2xl bg-muted p-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t("sharing.help_others_title")}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t("sharing.help_others_desc")}</p>
          </div>
          <Switch
            checked={isPublic}
            onCheckedChange={(v) => setVisibility(v ? (shareAnonymous ? "anon" : "profile") : "private")}
            className="mt-0.5 shrink-0"
          />
        </div>
        {/* Gwarancja prywatnosci: galeria zdjec nigdy nie jest udostepniana. */}
        <p className="text-[11px] text-muted-foreground mt-2.5 flex items-start gap-1.5">
          <Lock className="h-3 w-3 shrink-0 mt-0.5 text-emerald-600" />
          <span>{t("sharing.privacy_note")}</span>
        </p>
      </div>
      {isPublic && (<>
        {/* Anonimowo - opcjonalny pod-toggle gdy trasa jest udostepniona. */}
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-muted p-3.5">
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
        {/* Podpis autora (#11) */}
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
      </>)}
    </div>
  );

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

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* We wpisie dziennika (isMemory) ORAZ w wymuszonej edycji wyjazdu (forceEdit) okladka jest
          NIZSZA (16/9) - zdjecie nie jest kluczowe, wazniejsza galeria/plan. Tylko legacy aktywny
          przeglad trasy zostaje wyzszy. */}
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

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {(isMemory || forceEdit) ? (
          isOwner ? (
            (!reviewed || editingStepper) ? (
            /* ══ EDYCJA WPISU (właściciel) - stepper 1 Trasa → 2 Notki → 3 Zdjęcia (wspomnienie lub aktywny wyjazd z ?edit=1) ══ */
            <>
              {renderStepper()}
              <div className="px-5 pt-4">{renderStepInfo()}</div>

              {step === 1 && (
                <div className="px-5 pb-5">
                  {currentPins.length === 0 ? (
                    <>
                      <p className="text-center text-sm text-muted-foreground py-8">{t("empty.no_places_day")}</p>
                      {renderAddPlaceButton()}
                    </>
                  ) : (
                    <>
                      {renderPlanHeader(true)}
                      {planView === "list" ? renderEditablePlan(false) : renderSwiper(true, false)}
                      {renderAddPlaceButton()}
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="px-5 pb-5">
                  {currentPins.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">{t("empty.no_places_note")}</p>
                  ) : (
                    <div className="space-y-3">
                      {currentPins.map((pin: any) => (
                        <div key={pin.id} className="rounded-2xl bg-card border border-border/40 p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-muted">
                              <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-xl" />
                            </div>
                            <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                          </div>
                          {renderRatingNote(pin.place_name)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="pb-5">
                  {renderGallery(true)}
                  {renderSharing()}
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
                <button onClick={() => { setEditingStepper(true); setStep(1); }} aria-label={t("a11y.edit_entry")}
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

      {/* ── Fullscreen photo viewer ──────────────────────────────────────── */}
      {viewerUrl && (
        <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center" onClick={() => { setViewerUrl(null); setViewerMenuOpen(false); }}>
          <img src={viewerUrl} alt="" className="max-w-full max-h-full object-contain" />
          {/* Górne akcje: wielokropek (ustaw okładkę / usuń) + zamknięcie. */}
          <div
            className="absolute flex items-center gap-2"
            style={{ top: "max(16px, env(safe-area-inset-top, 16px))", right: "16px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={() => setViewerMenuOpen((o) => !o)}
                aria-label={t("a11y.more_options")}
                className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
              >
                <MoreVertical className="h-5 w-5 text-white" />
              </button>
              {viewerMenuOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-2xl bg-card shadow-xl overflow-hidden py-1">
                  <button
                    onClick={() => { if (viewerUrl !== heroPhoto) setCover(viewerUrl); setViewerMenuOpen(false); }}
                    disabled={viewerUrl === heroPhoto}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-foreground flex items-center gap-2.5 active:bg-muted disabled:opacity-50"
                  >
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    {viewerUrl === heroPhoto ? t("viewer.is_cover") : t("viewer.set_cover")}
                    {viewerUrl === heroPhoto && <Check className="h-4 w-4 text-green-600 ml-auto" />}
                  </button>
                  {myPhotos.some((p) => p.url === viewerUrl) && (
                    <button
                      onClick={() => { const owner = myPhotos.find((p) => p.url === viewerUrl)?.owner ?? routeId!; removePhoto(viewerUrl, owner); setViewerMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 flex items-center gap-2.5 active:bg-muted border-t border-border/40"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" /> {t("viewer.remove_photo")}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => { setViewerUrl(null); setViewerMenuOpen(false); }}
              aria-label={t("a11y.close")}
              className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      {/* W PODSUMOWANIU (wpis zrecenzowany) nie ma dolnego CTA - wyjscie przez strzalke cofania. */}
      {!noteFocused && !((isMemory || forceEdit) && isOwner && reviewed && !editingStepper) && (
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        {(isMemory || forceEdit) && isOwner && (!reviewed || editingStepper) ? (
          /* Stepper wpisu: Wstecz + Dalej/Gotowe. Edycje persystują (autosave on unmount +
             savePlan(false)); "Gotowe" oznacza wpis jako zrecenzowany (plan_finalized) i
             przechodzi do PODSUMOWANIA (nie wychodzi do Dziennika). */
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="px-5 py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-transform shrink-0"
                >
                  {t("cta.back")}
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                  className="flex-1 py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform"
                >
                  {t("cta.next")}
                </button>
              ) : (
                <button
                  onClick={finishEditing}
                  disabled={savingPlan}
                  className="flex-1 py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
                >
                  {savingPlan ? t("status.saving") : t("cta.done")}
                </button>
              )}
            </div>
            {/* Wyjscie z trybu edycji dostepne na kazdym kroku (nie tylko po "Gotowe"). */}
            <button
              onClick={finishEditing}
              disabled={savingPlan}
              className="w-full py-3 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {t("cta.close_edit_mode")}
            </button>
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
