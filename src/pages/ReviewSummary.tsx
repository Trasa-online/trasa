import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { avatarSrc } from "@/lib/avatar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Globe, Lock, Pencil, Check, Image as ImageIcon, Map as MapIcon, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2, Plus, Share2, List, GalleryHorizontalEnd, Info, MoreVertical } from "lucide-react";
import { useShare } from "@/hooks/useShare";
import AddPinSheet from "@/components/route/AddPinSheet";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { isNative } from "@/lib/platform";
import { Camera as CapCamera } from "@capacitor/camera";
import { notify } from "@/lib/notify";
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const share = useShare();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
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

  // Badge "Nowa trasa!" w JournalTab znika po wejsciu w wpis.
  useEffect(() => {
    if (!routeId || !user) return;
    void supabase.rpc("dismiss_route_badge", { p_route_id: routeId } as any).then(() => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    });
  }, [routeId, user, queryClient]);

  const [photos, setPhotos] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinRatings, setPinRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSaved, setNoteSaved] = useState<Record<string, boolean>>({});
  const noteTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Udostepnianie historycznej trasy: podpis + oznaczeni czlonkowie (#11).
  const [shareCaption, setShareCaption] = useState("");
  const [taggedMembers, setTaggedMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");

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
        .select("id, route_id, place_name, address, category, suggested_time, description, image_url, images, latitude, longitude, place_id, photo_url, pin_order")
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
          username: profileMap[r.user_id]?.first_name || profileMap[r.user_id]?.username || "Uczestnik",
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
          .from("routes").select("share_caption, tagged_members").eq("id", routeId).maybeSingle();
        if (error) return;
        if (data?.share_caption) setShareCaption(data.share_caption);
        if (Array.isArray(data?.tagged_members)) setTaggedMembers(data.tagged_members);
      } catch (e) {
        console.warn("[ReviewSummary] share-meta load skipped:", e);
      }
    })();
  }, [routeId]);

  const saveShareMeta = async (caption: string, members: string[]) => {
    if (!routeId) return;
    try {
      await (supabase as any).from("routes").update({ share_caption: caption.trim() || null, tagged_members: members }).eq("id", routeId);
    } catch (e) {
      console.warn("[ReviewSummary] saveShareMeta failed:", e);
    }
  };

  const addMember = () => {
    const v = memberInput.trim().replace(/^@/, "");
    if (!v) return;
    if (taggedMembers.some((m) => m.toLowerCase() === v.toLowerCase())) { setMemberInput(""); return; }
    const next = [...taggedMembers, v];
    setTaggedMembers(next);
    setMemberInput("");
    void saveShareMeta(shareCaption, next);
  };
  const removeMember = (name: string) => {
    const next = taggedMembers.filter((m) => m !== name);
    setTaggedMembers(next);
    void saveShareMeta(shareCaption, next);
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
    const res = await share({ title: route?.title || route?.city || "Trasa", text: "Zobacz moją trasę w Trasa", url });
    if (res.ok && res.method === "clipboard") notify.success("Link skopiowany");
  };

  const togglePublic = async (val: boolean) => {
    setIsPublic(val);
    if (routeId) {
      await supabase.from("routes").update({ is_shared: val } as any).eq("id", routeId);
      queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || !routeId || !user) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const path = `${user.id}/${routeId}/review_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const { error } = await supabase.storage
          .from("route-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (!error) newUrls.push(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
      } catch {}
    }
    if (newUrls.length) {
      const updated = [...photos, ...newUrls];
      setPhotos(updated);
      await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
      queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
    }
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
      notify.error("Nie udało się wybrać zdjęć");
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
    notify.success("Ustawiono okładkę");
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
      message: "Zdjęcie usunięte",
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
    const name = pin?.place_name ? `„${pin.place_name}"` : "to miejsce";
    if (!confirm(`Czy na pewno chcesz usunąć ${name} z planu dnia?`)) return;
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
      notify.success(finalize ? "Plan dnia zapisany" : "Zapisano zmiany");
      // Po zatwierdzeniu planu (notki/oceny gotowe) - zapytaj o udostepnienie.
      if (finalize) setShowSharePrompt(true);
    } catch (e: any) {
      console.error("[ReviewSummary] savePlan failed:", e?.message ?? e);
      notify.error("Nie udało się zapisać planu");
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
    if (error || !row) { console.error("[ReviewSummary] add pin failed:", error?.message); notify.error("Nie udało się dodać miejsca"); return; }
    // Jesli trwa edycja (draft) - dopisz do draftu zeby nie zginal przy kolejnym zapisie.
    if (draft && draft.dayId === activeRouteId) setDraft({ dayId: activeRouteId, pins: [...draft.pins, row] });
    queryClient.invalidateQueries({ queryKey: ["review-all-pins", idsKey] });
    notify.success("Dodano miejsce");
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

  const cityLabel = route?.city || "Podróż";
  const isOwner = !!route && !!user && route.user_id === user.id;

  // Nazwa wpisu: wlasna (title) albo placeholder. Auto-tytul "City - Dzień N"
  // traktujemy jak brak wlasnej nazwy.
  const isAutoTitle = (t: string | null | undefined) =>
    !t || /(-\s*Dzień\s*\d+)$/i.test(t) || t === route?.city;
  const customName = isAutoTitle(route?.title) ? "" : (route?.title ?? "");
  const displayName = customName || (isOwner ? "Dodaj nazwę wpisu" : "");

  const saveName = async () => {
    if (!routeId) return;
    const trimmed = nameVal.trim();
    setSavingName(true);
    const { error } = await (supabase as any).from("routes").update({ title: trimmed || null }).eq("id", routeId);
    setSavingName(false);
    setEditingName(false);
    if (error) { notify.error("Nie udało się zapisać nazwy"); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, title: trimmed || null } : old);
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    notify.success("Zapisano nazwę");
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
      return `${format(fd, "d", { locale: pl })} - ${format(ld, "d MMMM yyyy", { locale: pl })}`;
    }
    const single = route?.end_date && route.end_date !== route.start_date ? route.end_date : first;
    const sd = new Date(single);
    if (route?.end_date && route.end_date !== route.start_date) {
      return `${format(fd, "d", { locale: pl })} - ${format(sd, "d MMMM yyyy", { locale: pl })}`;
    }
    return format(fd, "d MMMM yyyy", { locale: pl });
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
        <p className="text-base font-bold">Nie znaleźliśmy tej trasy</p>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Mogła zostać usunięta albo nie&nbsp;masz do&nbsp;niej dostępu.
        </p>
        <button
          onClick={() => navigate("/home")}
          className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
        >
          Wróć do&nbsp;głównej
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
    ...myPhotos.map((p) => ({ ...p, mine: true, username: "Ty" })),
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notka</p>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{val}</p>
        </div>
      );
    }
    return (
      <div className={`mt-3 pt-1 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notka od Ciebie</p>
        <div className="relative">
          <textarea
            value={val}
            onChange={(e) => handleNoteChange(placeName, e.target.value)}
            placeholder="Twoja rada lub notka o tym miejscu…"
            rows={2}
            className="w-full bg-muted/50 rounded-xl px-3 py-2.5 text-sm text-foreground text-left resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
          />
          {noteSaved[k] && (
            <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">Zapisano ✓</span>
          )}
        </div>
      </div>
    );
  };

  // ── Lista (read-only): miejsca grupowane po kategorii. Klik => wizytowka. ──
  // Wspolna karta miejsca (karuzela + pionowa lista). fullWidth -> pelna szerokosc (stacked).
  const renderPlanCard = (pin: any, i: number, fullWidth: boolean, editable: boolean, withRating: boolean) => (
    <div key={pin.id} className={`${fullWidth ? "w-full" : "snap-center shrink-0 w-[80vw] max-w-[320px]"} rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col`}>
      <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
        <div className="relative w-full aspect-[4/3] bg-muted">
          <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-4xl" />
          <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
          {editable && (
            <button
              onClick={(e) => { e.stopPropagation(); removeWorkingPin(pin.id); }}
              aria-label="Usuń miejsce"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="px-4 pt-4 pb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-xs font-semibold text-foreground mb-2">
            <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{CATEGORY_LABEL[pin.category] ?? "Miejsce"}
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
      {editable && (
        <div className="flex items-center justify-between px-4 py-3 mt-auto border-t border-border/30">
          <button onClick={() => movePin(i, i - 1)} disabled={i === 0} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            <ChevronLeft className="h-4 w-4" />Wcześniej
          </button>
          <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            Później<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {withRating && <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name, true, !editable)}</div>}
    </div>
  );

  // ── Kompaktowy wiersz listy: miniaturka + nazwa + chip kategorii (+ reorder/usuń gdy edycja). ──
  const renderPlanRow = (pin: any, i: number, editable: boolean) => (
    <div key={pin.id} className="flex items-center gap-3 rounded-2xl bg-secondary border border-border/40 shadow-sm p-2.5">
      <button onClick={() => openDetail(pin)} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
        <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
      </button>
      <button onClick={() => openDetail(pin)} className="min-w-0 flex-1 text-left">
        <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">
          <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{CATEGORY_LABEL[pin.category] ?? "Miejsce"}
        </span>
      </button>
      {editable && (
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col">
            <button onClick={() => movePin(i, i - 1)} disabled={i === 0} aria-label="Wcześniej" className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
            <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} aria-label="Później" className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
          </div>
          <button onClick={() => removeWorkingPin(pin.id)} aria-label="Usuń miejsce" className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 active:scale-90"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  // Lista (read-only / podsumowanie): każde miejsce = biała sekcja (miniatura + nazwa + chip
  // + notka) na białym tle z delikatnym cieniem 1px. Tap -> wizytówka.
  const renderListReadonly = (withRating: boolean) => (
    <div className="space-y-2.5">
      {currentPins.map((pin: any, i: number) => (
        <div key={pin.id} className="rounded-2xl bg-secondary border border-black/5 shadow-sm p-3">
          <button onClick={() => openDetail(pin)} className="flex items-center gap-3 w-full text-left active:opacity-90">
            <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted">
              <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
              <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-foreground">
                <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{CATEGORY_LABEL[pin.category] ?? "Miejsce"}
              </span>
            </div>
          </button>
          {withRating && renderRatingNote(pin.place_name, false, true)}
        </div>
      ))}
    </div>
  );

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
      <Plus className="h-4 w-4" /> Dodaj miejsce
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
            <span className="text-[10px] font-medium">{uploading ? "…" : "Dodaj"}</span>
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
                aria-label="Usuń zdjęcie"
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
        <p className="text-center text-[11px] text-muted-foreground/70 px-6 pt-3">Dotknij zdjęcia, żeby zobaczyć je w&nbsp;pełni i&nbsp;ustawić okładkę wpisu.</p>
      )}
      {galleryPhotos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10 px-6">{editable ? "Brak zdjęć z tej podróży. Dodaj pierwsze wspomnienia." : "Brak zdjęć z tej podróży."}</p>
      )}
    </div>
  );

  // ── Udostępnianie wpisu (toggle public + link). ──
  const renderSharing = () => (
    <div className="px-5">
      <div className="mt-6 pt-5 border-t border-border/30 flex items-center gap-3">
        {isPublic ? <Globe className="h-4 w-4 text-orange-600 flex-shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{isPublic ? "Udostępnione" : "Prywatne"}</p>
          <p className="text-xs text-muted-foreground">{isPublic ? "Widoczne w zakładce Eksploruj" : "Tylko dla Ciebie"}</p>
        </div>
        <button onClick={() => togglePublic(!isPublic)}
          className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 ${isPublic ? "bg-primary" : "bg-muted-foreground/30"}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
      {isPublic && (<>
        {/* Podpis autora (#11) */}
        <div className="mt-4">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Podpis <span className="normal-case font-medium text-muted-foreground/50">(opcjonalnie)</span></label>
          <textarea
            value={shareCaption}
            onChange={(e) => setShareCaption(e.target.value)}
            onBlur={() => void saveShareMeta(shareCaption, taggedMembers)}
            maxLength={200}
            rows={2}
            placeholder="Napisz coś o tej podróży…"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-muted-foreground/50 resize-none"
          />
        </div>

        {/* Oznaczeni czlonkowie podrozy (#11) */}
        <div className="mt-4">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Z kim byłeś/aś <span className="normal-case font-medium text-muted-foreground/50">(opcjonalnie)</span></label>
          {taggedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {taggedMembers.map((m) => (
                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-xs font-semibold">
                  {m}
                  <button onClick={() => removeMember(m)} aria-label={`Usuń ${m}`} className="active:scale-90"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
              maxLength={40}
              placeholder="Imię lub @nick"
              className="flex-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-muted-foreground/50"
            />
            <button onClick={addMember} disabled={!memberInput.trim()} className="shrink-0 px-4 rounded-2xl bg-secondary text-secondary-foreground text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-40">Dodaj</button>
          </div>
        </div>

        <button onClick={shareLink}
          className="mt-4 w-full py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <Share2 className="h-4 w-4" /> Udostępnij link do trasy
        </button>
      </>)}
    </div>
  );

  // ── Nagłówek steppera: 3 kroki, klikalne (powrót/przejście), pasek postępu. ──
  const renderStepper = () => {
    const steps = [{ n: 1, label: "Trasa" }, { n: 2, label: "Notki" }, { n: 3, label: "Zdjęcia" }] as const;
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

  const STEP_INFO: Record<1 | 2 | 3, string> = {
    1: "Popraw trasę tak, jak było naprawdę: usuń miejsca, w których nie byliście, lub zmień kolejność.",
    2: "Notka o miejscu: wspomnienie dla siebie i rada dla innych (co zamówić, pro-tip). Zapisuje się sama.",
    3: "Dodaj zdjęcia do wspomnienia. To opcjonalne, możesz wrócić do tego później.",
  };
  const renderStepInfo = () => (
    <div className="mb-3 flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
      <Info className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
      <p className="text-xs text-orange-800 leading-relaxed">{STEP_INFO[step]}</p>
    </div>
  );

  // Naglowek "Twój plan" + przelacznik Lista/Szczegoly + (multi-day) przelacznik dni.
  const renderPlanHeader = (showViewToggle = true) => (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Twój plan</p>
        {showViewToggle && (
          <div className="flex rounded-full bg-muted p-0.5">
            <button onClick={() => setPlanView("list")} aria-label="Widok listy" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setPlanView("cards")} aria-label="Widok kart" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
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
              Dzień {d.day_number ?? "?"}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* We wpisie dziennika (isMemory) okladka jest NIZSZA - zdjecie nie jest kluczowe,
          wazniejsza jest galeria/plan ponizej. Aktywny przeglad trasy zostaje wyzszy. */}
      <div className={`relative w-full ${isMemory ? "aspect-[16/9]" : (hasRealPhoto ? "aspect-[4/5]" : "aspect-[16/10]")} flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500`}>
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Ciemny gradient overlay - dla placeholdera mocniejszy (kontrast tekstu, WCAG) */}
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />

        <div className="absolute left-0 right-0 flex items-center justify-between px-4"
          style={{ top: "calc(max(16px, env(safe-area-inset-top, 16px)) + 6px)" }}>
          {/* Strzałkę cofania chowamy TYLKO w stepperze właściciela (tam nawigacja to
              "Gotowe"/"Wstecz"). W podsumowaniu, u gościa i w aktywnym widoku - pokazujemy. */}
          {!(isMemory && isOwner && (!reviewed || editingStepper)) ? (
            <button onClick={() => navigate("/dziennik")} aria-label="Wróć do dziennika" className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          ) : <span />}
          {saving && (
            <span className="text-xs text-white/70 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">Zapisywanie...</span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          {dateLabel && <p className="text-white/70 text-sm mb-1">{dateLabel}</p>}
          <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm">{cityLabel}</h1>

          {editingName ? (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                autoFocus
                maxLength={60}
                placeholder="Nazwa wpisu"
                className="flex-1 min-w-0 bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg px-3 py-1.5 text-white text-base font-medium placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                style={{ fontSize: "16px" }}
              />
              <button onClick={saveName} disabled={savingName} aria-label="Zapisz nazwę"
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
              <span className="text-white/70 text-xs font-medium">{groupParticipants.length} uczestników</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-32">

        {isMemory ? (
          isOwner ? (
            (!reviewed || editingStepper) ? (
            /* ══ WSPOMNIENIE (właściciel) - EDYCJA: stepper 1 Trasa → 2 Notki → 3 Zdjęcia ══ */
            <>
              {renderStepper()}
              <div className="px-5 pt-4">{renderStepInfo()}</div>

              {step === 1 && (
                <div className="px-5 pb-5">
                  {currentPins.length === 0 ? (
                    <>
                      <p className="text-center text-sm text-muted-foreground py-8">Brak miejsc w planie tego dnia.</p>
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
                    <p className="text-center text-sm text-muted-foreground py-8">Brak miejsc do oznaczenia notką.</p>
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
                    <MapIcon className="h-4 w-4" /> Miejsca
                  </button>
                  <button onClick={() => setSummaryTab("galeria")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors ${summaryTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    <ImageIcon className="h-4 w-4" /> Zdjęcia
                  </button>
                </div>
                <button onClick={() => { setEditingStepper(true); setStep(1); }} aria-label="Edytuj wpis"
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                  <Pencil className="h-4 w-4 text-foreground" />
                </button>
              </div>

              {summaryTab === "plan" ? (
                <div className="px-5 pt-4 pb-5">
                  {currentPins.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Brak miejsc w planie.</p>
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

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
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
                <p className="text-base font-black leading-snug">Udostępnić tę trasę innym?</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Trafi do zakładki Eksploruj i&nbsp;pomoże innym zaplanować podróż. Udostępniamy plan trasy z&nbsp;Twoją okładką, notkami i&nbsp;ocenami - bez galerii Twoich zdjęć. Jeśli nie, zostanie prywatna w&nbsp;Twoich Wspomnieniach. Zmienisz to w&nbsp;każdej chwili.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { togglePublic(true); setShowSharePrompt(false); notify.success("Trasa widoczna w Eksploruj"); }}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                Udostępnij w Eksploruj
              </button>
              <button
                onClick={() => { togglePublic(false); setShowSharePrompt(false); }}
                className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                Zostaw prywatną
              </button>
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
                aria-label="Więcej opcji"
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
                    {viewerUrl === heroPhoto ? "Okładka wpisu" : "Ustaw jako okładkę"}
                    {viewerUrl === heroPhoto && <Check className="h-4 w-4 text-green-600 ml-auto" />}
                  </button>
                  {myPhotos.some((p) => p.url === viewerUrl) && (
                    <button
                      onClick={() => { const owner = myPhotos.find((p) => p.url === viewerUrl)?.owner ?? routeId!; removePhoto(viewerUrl, owner); setViewerMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 flex items-center gap-2.5 active:bg-muted border-t border-border/40"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" /> Usuń zdjęcie
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => { setViewerUrl(null); setViewerMenuOpen(false); }}
              aria-label="Zamknij"
              className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      {/* W PODSUMOWANIU (wpis zrecenzowany) nie ma dolnego CTA - wyjscie przez strzalke cofania. */}
      {!(isMemory && isOwner && reviewed && !editingStepper) && (
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        {isMemory && isOwner && (!reviewed || editingStepper) ? (
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
                  Wstecz
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                  className="flex-1 py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform"
                >
                  Dalej
                </button>
              ) : (
                <button
                  onClick={finishEditing}
                  disabled={savingPlan}
                  className="flex-1 py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
                >
                  {savingPlan ? "Zapisywanie…" : "Gotowe"}
                </button>
              )}
            </div>
            {/* Wyjscie z trybu edycji dostepne na kazdym kroku (nie tylko po "Gotowe"). */}
            <button
              onClick={finishEditing}
              disabled={savingPlan}
              className="w-full py-3 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              Zamknij tryb edycji
            </button>
          </div>
        ) : !isMemory && draft && draft.dayId === activeRouteId ? (
          <button
            onClick={() => savePlan(false)}
            disabled={savingPlan || workingPins.length === 0}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {savingPlan ? "Zapisywanie…" : "Zapisz zmiany"}
          </button>
        ) : (
          <button onClick={() => navigate("/dziennik")} className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform">
            Gotowe
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
