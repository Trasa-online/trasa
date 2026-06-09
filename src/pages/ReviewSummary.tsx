import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X, Globe, Lock, Pencil, Check, Image as ImageIcon, Map as MapIcon, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { getPhotoUrl } from "@/lib/placePhotos";
import { compressImage } from "@/lib/imageCompression";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { isNative } from "@/lib/platform";
import { Camera as CapCamera } from "@capacitor/camera";
import { toast } from "sonner";

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

// Pelny URL (cache/storage/http) uzywamy bezposrednio; surowy photo_reference
// przepuszczamy przez proxy getPhotoUrl.
const resolveStored = (img: string | null | undefined): string | null => {
  if (!img) return null;
  return /^(https?:|\/api\/|\/storage\/|blob:|data:)/.test(img) ? img : getPhotoUrl(img);
};

// Zdjecie miejsca: stored (image_url/images) albo fallback do Google Places (jak
// w kreatorze trasy - LargeCarouselCard). Dzieki temu pins bez wlasnego zdjecia
// dostaja zdjecie z Google zamiast samej emoji.
function PlacePhoto({ pin, className, emojiClass }: { pin: any; className?: string; emojiClass?: string }) {
  const stored = pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null);
  const [url, setUrl] = useState<string | null>(resolveStored(stored));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    supabase.functions
      .invoke("google-places-proxy", {
        body: { placeName: pin.place_name, latitude: pin.latitude || undefined, longitude: pin.longitude || undefined },
      })
      .then(({ data }: any) => {
        const ref = data?.result?.photos?.[0]?.photo_reference;
        if (ref && !cancelled) { const u = getPhotoUrl(ref, 800); if (u) setUrl(u); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin.place_name]);

  if (url && !failed) {
    return <img src={url} alt="" className={className} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${className ?? ""} flex items-center justify-center bg-muted ${emojiClass ?? "text-xl"}`}>
      {CATEGORY_EMOJI[pin.category] ?? "📍"}
    </div>
  );
}

const ReviewSummary = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get("route");
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  // Pod-zakladki w widoku wspomnienia: galeria zdjec / plan dnia.
  const [memoryTab, setMemoryTab] = useState<"galeria" | "plan">("galeria");
  // Wybrany dzien (trasa wielodniowa). Domyslnie dzien z URL.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  // Fullscreen podglad zdjecia z galerii.
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // Podglad wizytowki miejsca po kliknieciu w pin.
  const [detailPin, setDetailPin] = useState<any | null>(null);
  // Edycja planu dnia (po minieciu daty, przed "Zapisz plan dnia").
  // draft.dayId = ktory dzien edytowany; draft.pins = robocza lista.
  const [draft, setDraft] = useState<{ dayId: string; pins: any[] } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

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

  const { data: route } = useQuery({
    queryKey: ["review-summary-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, user_id, city, day_number, start_date, end_date, folder_id, plan_finalized, ai_summary, ai_highlight, review_photos, is_shared, group_session_id")
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
        .select("id, title, city, day_number, start_date, end_date, plan_finalized, ai_summary, ai_highlight, review_photos")
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
      toast.error("Nie udało się wybrać zdjęć");
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
    toast.success("Ustawiono okładkę");
  };

  const removePhoto = async (url: string, owner: string) => {
    if (owner === routeId) {
      const updated = photos.filter((p) => p !== url);
      setPhotos(updated);
      await supabase.from("routes").update({ review_photos: updated } as any).eq("id", routeId);
    } else {
      const dr = sortedDays.find((d: any) => d.id === owner);
      const updated = (dr?.review_photos ?? []).filter((p: string) => p !== url);
      await supabase.from("routes").update({ review_photos: updated } as any).eq("id", owner);
    }
    setViewerUrl(null);
    queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] });
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
  // Plan zamrozony (read-only + mozna udostepnic) gdy plan_finalized=true dla dnia.
  const finalized = !!activeDay?.plan_finalized;
  const workingPins = draft && draft.dayId === activeRouteId ? draft.pins : currentPins;

  const setWorking = (next: any[]) => { if (activeRouteId) setDraft({ dayId: activeRouteId, pins: next }); };
  const movePin = (from: number, to: number) => {
    if (to < 0 || to >= workingPins.length) return;
    const next = [...workingPins];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setWorking(next);
  };
  const removeWorkingPin = (id: string) => setWorking(workingPins.filter((p: any) => p.id !== id));

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
      if (finalize) await (supabase as any).from("routes").update({ plan_finalized: true }).eq("id", activeRouteId);
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["review-all-pins", idsKey] }),
        queryClient.invalidateQueries({ queryKey: ["review-trip-days", folderId, routeId] }),
        queryClient.invalidateQueries({ queryKey: ["review-summary-route", routeId] }),
      ]);
      toast.success(finalize ? "Plan dnia zapisany" : "Zapisano zmiany");
    } catch (e: any) {
      console.error("[ReviewSummary] savePlan failed:", e?.message ?? e);
      toast.error("Nie udało się zapisać planu");
    }
    setSavingPlan(false);
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
    if (error) { toast.error("Nie udało się zapisać nazwy"); return; }
    queryClient.setQueryData(["review-summary-route", routeId], (old: any) => old ? { ...old, title: trimmed || null } : old);
    if (user) queryClient.invalidateQueries({ queryKey: ["journal-entries", user.id] });
    toast.success("Zapisano nazwę");
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

  // Aktywny wpis vs wspomnienie: wspomnienie gdy minal OSTATNI dzien trasy.
  const isMemory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let lastTs = -Infinity;
    for (const d of sortedDays) {
      const ds = d.end_date ?? d.start_date;
      if (ds) lastTs = Math.max(lastTs, new Date(ds).getTime());
    }
    return Number.isFinite(lastTs) && lastTs < today.getTime();
  }, [sortedDays]);

  if (authLoading) return null;
  if (!user) { navigate("/auth"); return null; }

  // Hero: zdjecie usera/grupy, a gdy brak - ilustracja placeholder (zamiast emoji
  // mapy). Ciemny gradient overlay zapewnia kontrast tekstu (WCAG).
  const hasRealPhoto = !!(myPhotos[0]?.url ?? (groupPhotos[0] as any)?.url);
  const heroPhoto = myPhotos[0]?.url ?? (groupPhotos[0] as any)?.url ?? getRandomPinPlaceholder(routeId ?? undefined);
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
    vibe_tags: [],
    description: pin.description || "",
  } satisfies MockPlace);

  // ── Sekcja Ocena + Notka pod miejscem (tylko widok wspomnienia / plan dnia) ──
  const renderRatingNote = (placeName: string) => {
    const k = rkey(activeRouteId!, placeName);
    const rating = pinRatings[k] ?? 0;
    return (
      <div className="mt-3 pt-3 border-t border-border/40">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Ocena miejsca</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => ratePinHandler(placeName, n)}
              className={`text-lg leading-none transition-transform active:scale-90 ${n <= rating ? "opacity-100" : "opacity-25"}`}
            >
              ⭐
            </button>
          ))}
        </div>
        <div className="my-3 h-px bg-border/40" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notka</p>
        <div className="relative">
          <textarea
            value={notes[k] ?? ""}
            onChange={(e) => handleNoteChange(placeName, e.target.value)}
            placeholder="Twoja rada lub notka o tym miejscu…"
            rows={2}
            className="w-full bg-muted/50 rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
          />
          {noteSaved[k] && (
            <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">Zapisano ✓</span>
          )}
        </div>
      </div>
    );
  };

  // ── Lista (read-only): miejsca grupowane po kategorii. Klik => wizytowka. ──
  const renderListReadonly = (withRating: boolean) => (
    <div className="space-y-4">
      {(() => {
        const groups: Record<string, any[]> = {};
        currentPins.forEach((p: any) => { const kk = p.category || "other"; (groups[kk] ??= []).push(p); });
        return Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>{CATEGORY_EMOJI[cat] ?? "📍"}</span>{CATEGORY_LABEL[cat] ?? "Miejsce"}
            </p>
            <div className="space-y-2">
              {items.map((pin: any) => (
                <div key={pin.id} className="bg-card border border-border/40 rounded-2xl p-2.5">
                  <button onClick={() => openDetail(pin)} className="w-full flex items-center gap-3 text-left active:opacity-70 transition-opacity">
                    <PlacePhoto pin={pin} className="h-14 w-14 rounded-xl object-cover shrink-0" emojiClass="text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                      {pin.address && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{pin.address}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </button>
                  {withRating && renderRatingNote(pin.place_name)}
                </div>
              ))}
            </div>
          </div>
        ));
      })()}
    </div>
  );

  // ── Szczegoly: poziomy swiper kart (jak kreator trasy). editable => move/usun,
  // withRating => Ocena + Notka pod karta. Klik w karte => wizytowka. ──
  const renderSwiper = (editable: boolean, withRating: boolean) => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {workingPins.map((pin: any, i: number) => (
        <div key={pin.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm flex flex-col">
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
            <div className="px-4 pt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{CATEGORY_LABEL[pin.category] ?? "Miejsce"}
              </span>
              <p className="text-base font-black leading-tight">{pin.place_name}</p>
              {pin.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{pin.description}</p>}
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
          {withRating && <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name)}</div>}
        </div>
      ))}
    </div>
  );

  // Edytowalna lista planu (reorder strzalkami gora/dol + usuwanie). Bez drag&drop
  // - HTML5 DnD nie dziala w natywnym WebView iOS, strzalki sa niezawodne na dotyku.
  // Klik w miejsce (zdjecie/nazwa) => wizytowka. withRating => Ocena + Notka pod miejscem.
  const renderEditablePlan = (withRating: boolean) => (
    <div className="space-y-2">
      {workingPins.map((pin: any, i: number) => (
        <div key={pin.id} className="bg-card border border-border/40 rounded-2xl p-2">
          <div className="flex items-center gap-2">
            <button onClick={() => openDetail(pin)} className="flex items-center gap-2 min-w-0 flex-1 text-left active:opacity-70 transition-opacity">
              <PlacePhoto pin={pin} className="h-12 w-12 rounded-xl object-cover shrink-0" emojiClass="text-lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{CATEGORY_LABEL[pin.category] ?? "Miejsce"}</p>
              </div>
            </button>
            <div className="flex flex-col shrink-0">
              <button onClick={() => movePin(i, i - 1)} disabled={i === 0} aria-label="W górę" className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} aria-label="W dół" className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <button onClick={() => removeWorkingPin(pin.id)} aria-label="Usuń miejsce" className="h-8 w-8 shrink-0 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
          </div>
          {withRating && <div className="px-0.5">{renderRatingNote(pin.place_name)}</div>}
        </div>
      ))}
    </div>
  );

  // Naglowek "Twój plan" + przelacznik Lista/Szczegoly + (multi-day) przelacznik dni.
  const renderPlanHeader = (showViewToggle = true) => (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Twój plan</p>
        {showViewToggle && (
          <div className="flex rounded-full bg-muted p-0.5">
            <button onClick={() => setPlanView("list")} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Lista</button>
            <button onClick={() => setPlanView("cards")} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Szczegóły</button>
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
      <div className="relative w-full aspect-[4/5] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Ciemny gradient overlay - dla placeholdera mocniejszy (kontrast tekstu, WCAG) */}
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />

        <div className="absolute left-0 right-0 flex items-center justify-between px-4"
          style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => navigate("/dziennik")} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
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
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.first_name || p.username || "?")[0].toUpperCase()}
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
          /* ══ WSPOMNIENIE: pod-zakladki Galeria / Plan dnia ══ */
          <>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-5 pt-3 pb-2">
              <div className="flex rounded-full bg-muted p-0.5">
                <button onClick={() => setMemoryTab("galeria")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors ${memoryTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <ImageIcon className="h-4 w-4" /> Galeria
                </button>
                <button onClick={() => setMemoryTab("plan")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-colors ${memoryTab === "plan" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <MapIcon className="h-4 w-4" /> Plan dnia
                </button>
              </div>
            </div>

            {memoryTab === "galeria" ? (
              /* ── Galeria: grid 3-kol (jak instagram) ── */
              <div className="px-1 pt-1">
                <div className="grid grid-cols-3 gap-0.5">
                  {photos.length < MAX_PHOTOS && (
                    <button
                      onClick={triggerPhotoPick}
                      disabled={uploading}
                      className="aspect-square flex flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground active:bg-muted/60 transition-colors"
                    >
                      <Camera className="h-6 w-6" />
                      <span className="text-[10px] font-medium">{uploading ? "…" : "Dodaj"}</span>
                    </button>
                  )}
                  {galleryPhotos.map((item, idx) => (
                    <button
                      key={`${item.url}-${idx}`}
                      onClick={() => setViewerUrl(item.url)}
                      className="relative aspect-square overflow-hidden bg-muted active:opacity-90"
                    >
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                      {!item.mine && (
                        <span className="absolute bottom-1 left-1 bg-black/55 backdrop-blur-sm rounded px-1.5 py-0.5 text-[9px] font-medium text-white max-w-[90%] truncate">{item.username}</span>
                      )}
                    </button>
                  ))}
                </div>
                {galleryPhotos.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10 px-6">Brak zdjęć z tej podróży. Dodaj pierwsze wspomnienia.</p>
                )}
              </div>
            ) : (
              /* ── Plan dnia ── */
              <div className="px-5 pt-5 pb-5">
                {currentPins.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Brak miejsc w planie tego dnia.</p>
                ) : !finalized ? (
                  /* Tryb edycji: popraw plan (reorder strzalkami / usun) i zapisz.
                     Lista = edytowalna, Szczegoly = podglad kart. */
                  <>
                    {renderPlanHeader(true)}
                    <div className="mb-3 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
                      <p className="text-xs text-orange-800 leading-relaxed">
                        Popraw plan, jeśli coś się zmieniło - usuń miejsca, w&nbsp;których nie&nbsp;byliście, lub zmień kolejność. Oceń miejsca i&nbsp;dodaj notki, a&nbsp;potem zapisz, żeby zablokować plan i&nbsp;udostępnić trasę.
                      </p>
                    </div>
                    {planView === "list" ? renderEditablePlan(true) : renderSwiper(true, true)}
                  </>
                ) : (
                  /* Plan zamrozony: read-only + ocena + notka + udostepnianie */
                  <>
                    <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" /> Plan dnia zapisany
                    </div>
                    {renderPlanHeader()}
                    {planView === "list" ? renderListReadonly(true) : renderSwiper(false, true)}

                    {/* Udostepnianie (odblokowane po zapisaniu planu) */}
                    <div className="mt-6 pt-5 border-t border-border/30 flex items-center gap-3">
                      {isPublic ? <Globe className="h-4 w-4 text-orange-600 flex-shrink-0" /> : <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{isPublic ? "Udostępnione" : "Prywatne"}</p>
                        <p className="text-xs text-muted-foreground">{isPublic ? "Widoczne na feedzie znajomych" : "Tylko dla Ciebie"}</p>
                      </div>
                      <button onClick={() => togglePublic(!isPublic)}
                        className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 ${isPublic ? "bg-primary" : "bg-muted-foreground/30"}`}>
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
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

            {/* Zdjecia (poziomy scroll) */}
            <div className="pt-5 pb-5 border-b border-border/30">
              <div className="flex items-center justify-between px-5 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zdjęcia</p>
                {photos.length > 0 && photos.length < MAX_PHOTOS && (
                  <button onClick={triggerPhotoPick} disabled={uploading} className="text-xs font-semibold text-primary">
                    {uploading ? "Dodawanie…" : "+ Dodaj"}
                  </button>
                )}
              </div>
              {photos.length > 0 ? (
                <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none pb-1">
                  {photos.map((url) => (
                    <div key={url} className="relative flex-shrink-0 w-32 h-32 rounded-2xl overflow-hidden shadow-sm">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(url, routeId!)} className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1">
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button onClick={triggerPhotoPick} disabled={uploading}
                      className="flex-shrink-0 w-32 h-32 rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <Camera className="h-6 w-6" />
                      <span className="text-xs">{uploading ? "…" : "Dodaj"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={triggerPhotoPick} disabled={uploading}
                  className="mx-5 w-[calc(100%-40px)] h-24 rounded-2xl border-2 border-dashed border-border/40 flex items-center justify-center gap-2.5 text-muted-foreground active:bg-muted/40 transition-colors">
                  <Camera className="h-5 w-5" />
                  <span className="text-sm">{uploading ? "Dodawanie…" : "Dodaj zdjęcia z podróży"}</span>
                </button>
              )}
            </div>
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

      {/* ── Fullscreen photo viewer ──────────────────────────────────────── */}
      {viewerUrl && (
        <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center" onClick={() => setViewerUrl(null)}>
          <img src={viewerUrl} alt="" className="max-w-full max-h-full object-contain" />
          <button
            onClick={() => setViewerUrl(null)}
            className="absolute h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
            style={{ top: "max(16px, env(safe-area-inset-top, 16px))", right: "16px" }}
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <div
            className="absolute left-0 right-0 flex items-center justify-center gap-2 px-4"
            style={{ bottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { if (viewerUrl !== heroPhoto) setCover(viewerUrl); }}
              disabled={viewerUrl === heroPhoto}
              className="px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60"
            >
              {viewerUrl === heroPhoto ? "Okładka ✓" : "Ustaw jako okładkę"}
            </button>
            {myPhotos.some((p) => p.url === viewerUrl) && (
              <button
                onClick={() => { const owner = myPhotos.find((p) => p.url === viewerUrl)?.owner ?? routeId!; removePhoto(viewerUrl, owner); }}
                className="px-4 py-2 rounded-full bg-red-500/90 text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                Usuń zdjęcie
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed bottom CTA ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-3 bg-background/80 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        {isMemory && memoryTab === "plan" && !finalized && currentPins.length > 0 ? (
          <button
            onClick={() => savePlan(true)}
            disabled={savingPlan || workingPins.length === 0}
            className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {savingPlan ? "Zapisywanie…" : "Zapisz plan dnia"}
          </button>
        ) : !isMemory && draft && draft.dayId === activeRouteId ? (
          <button
            onClick={() => savePlan(false)}
            disabled={savingPlan || workingPins.length === 0}
            className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {savingPlan ? "Zapisywanie…" : "Zapisz zmiany"}
          </button>
        ) : (
          <button onClick={() => navigate("/dziennik")} className="w-full py-4 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform">
            Gotowe
          </button>
        )}
      </div>
    </div>
  );
};

export default ReviewSummary;
