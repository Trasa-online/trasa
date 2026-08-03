import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2, Plus, Globe, List, GalleryHorizontalEnd, Map as MapIcon, Info, Check, Pencil, RotateCcw } from "lucide-react";
import RouteMap from "@/components/RouteMap";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { notify } from "@/lib/notify";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDistanceReference, tryResolveOnSite } from "@/lib/distanceReference";
import { haversineKm, formatDistance } from "@/lib/distance";
import { Navigation, GripVertical, CalendarDays, Loader2 } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { useTranslation } from "react-i18next";
import { API_BASE } from "@/lib/platform";
import { CategoryIcon } from "@/components/CategoryIcon";

// Statyczna mapka pojedynczego miejsca (okladka karty planu). Tania (Maps Static + 24h CDN),
// pomaranczowy pin, POI/transit ukryte. null gdy brak wspolrzednych.
function placeStaticMap(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${API_BASE}/api/static-map?size=400x300&scale=2&maptype=roadmap&zoom=15&markers=color:0xf9662b%7C${lat},${lng}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

// Kolorowe logo Google (guzik "otworz wizytowke miejsca").
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Edytor planu aktywnej trasy osadzony na ekranie glownym. Replika edytora planu z
// ReviewSummary (widok Dziennika), ale jako self-contained widget na home: laduje wlasne
// dane po routeId, trzyma wlasny stan, renderuje hint + plan (Lista/Szczegoly) + dodawanie
// miejsca + wizytowke + przycisk zapisu inline (NIE fixed) + popup udostepniania.
// ReviewSummary.tsx jest zamrozony - tu replikujemy jego logike, nie importujemy.

// Klucz kompozytowy notka per miejsce w danym dniu (route_id + place_name).
const rkey = (routeId: string, placeName: string) => `${routeId}::${placeName}`;

// Wiersz edytowalnej Listy z przeciaganiem (framer-motion Reorder). Chevrony gora/dol
// ZOSTAJA, OBOK uchwyt drag (GripVertical) ktory startuje przeciaganie przez useDragControls
// + dragListener=false (zeby tap w wizytowke i przyciski dzialaly). HTML5 draggable nie
// dziala w iOS WebView - framer-motion dziala na dotyk.
function PlanReorderRow({ pin, isFirst, isLast, onTap, onUp, onDown, onRemove, distLabel, noteNode }: {
  pin: any; isFirst: boolean; isLast: boolean;
  onTap: () => void; onUp: () => void; onDown: () => void; onRemove: () => void;
  distLabel: string | null; noteNode: React.ReactNode;
}) {
  const { t } = useTranslation("hometrip");
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={pin}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 0.98, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}
      className="bg-secondary border border-border/40 rounded-2xl p-2"
    >
      <div className="flex items-center gap-2">
        <div
          onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }}
          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5"
          style={{ touchAction: "none" }}
          aria-label={t("editor.reorder_aria")}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <button onClick={onTap} className="flex items-center gap-2 min-w-0 flex-1 text-left active:opacity-70 transition-opacity">
          <PlacePhoto pin={pin} className="h-12 w-12 rounded-xl object-cover shrink-0" emojiClass="text-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-muted-foreground truncate">{t(`categories.${pin.category}`, { defaultValue: t("categories.other") })}</p>
              {distLabel && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-700">
                  <Navigation className="h-2.5 w-2.5" />{distLabel}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex flex-col shrink-0">
          <button onClick={onUp} disabled={isFirst} aria-label={t("editor.move_up")} className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={onDown} disabled={isLast} aria-label={t("editor.move_down")} className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
        </div>
        <button onClick={onRemove} aria-label={t("editor.remove_place")} className="h-8 w-8 shrink-0 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
      </div>
      {noteNode && <div className="px-0.5">{noteNode}</div>}
    </Reorder.Item>
  );
}

const ActiveTripPlanEditorInner = ({ routeId, flush = false, onDelete, deleting }: { routeId: string; flush?: boolean; onDelete?: (e: React.MouseEvent) => void; deleting?: boolean }) => {
  const { t } = useTranslation("hometrip");
  // Etykieta kategorii miejsca (fallback -> "Miejsce"/"Place").
  const catLabel = (cat: string) => t(`categories.${cat}`, { defaultValue: t("categories.other") });
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const distanceRef = useDistanceReference();
  // Dystans do miejsca od wspolnego punktu odniesienia (GPS / punkt startowy), gdy pin ma wspolrzedne.
  const distFor = (pin: any): string | null =>
    distanceRef && pin?.latitude && pin?.longitude
      ? formatDistance(haversineKm(distanceRef.coords, { lat: pin.latitude, lng: pin.longitude }))
      : null;

  const [planView, setPlanView] = useState<"list" | "cards" | "map">("cards");
  // Tryb edycji planu (za ikona olowka). Default OFF: karty pokazuja tylko odhacz/nawiguj +
  // tap w wizytowke. ON: reorder (wczesniej/pozniej), usuwanie i "Dodaj miejsce".
  const [editMode, setEditMode] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [highlightPinId, setHighlightPinId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ dayId: string; pins: any[] } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteSaved, setNoteSaved] = useState<Record<string, boolean>>({});
  const noteTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: route } = useQuery({
    queryKey: ["active-plan-route", routeId],
    queryFn: async () => {
      if (!routeId || !user) return null;
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, user_id, city, day_number, start_date, end_date, folder_id, plan_finalized, ai_summary, ai_highlight, is_shared, group_session_id")
        .eq("id", routeId)
        .single();
      return data as any;
    },
    enabled: !!routeId && !!user,
  });

  const folderId = route?.folder_id ?? null;

  // Dni trasy: jesli wpis nalezy do folderu (trasa wielodniowa) - wszystkie dni;
  // inaczej tylko ten jeden route.
  const { data: dayRoutes = [] } = useQuery({
    queryKey: ["active-plan-trip-days", folderId, routeId],
    queryFn: async () => {
      if (!route) return [];
      if (!folderId) return [route];
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, end_date, plan_finalized, ai_summary, ai_highlight")
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

  useEffect(() => {
    if (!selectedDayId && routeId && dayRouteIds.includes(routeId)) setSelectedDayId(routeId);
  }, [routeId, dayRouteIds, selectedDayId]);

  const idsKey = dayRouteIds.join(",");
  const { data: allPins = [] } = useQuery({
    queryKey: ["active-plan-all-pins", idsKey],
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

  // Opis + tagi (vibe_tags) z tabeli places - dla wizytowek i kart.
  const placeNames = useMemo(
    () => [...new Set(allPins.map((p: any) => p.place_name).filter(Boolean))],
    [allPins],
  );
  const { data: placeMeta = {} } = useQuery({
    queryKey: ["active-plan-place-meta", route?.city, placeNames.join("|")],
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

  // Notki (wszystkie dni naraz).
  const { data: existingRatings = [] } = useQuery({
    queryKey: ["active-plan-pin-ratings", idsKey, user?.id],
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
    if (existingRatings.length) {
      const nmap: Record<string, string> = {};
      for (const r of existingRatings) {
        const k = rkey(r.route_id, r.place_name);
        if (r.note) nmap[k] = r.note;
      }
      setNotes(nmap);
    }
  }, [existingRatings]);

  const togglePublic = async (val: boolean) => {
    await supabase.from("routes").update({ is_shared: val } as any).eq("id", routeId);
    queryClient.invalidateQueries({ queryKey: ["active-plan-route", routeId] });
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

  // ── Edycja planu dnia ──
  const finalized = !!activeDay?.plan_finalized;
  // Draft = overlay kolejnosci/usuniec. Scalamy ZYWE visited_at z currentPins, inaczej
  // odhaczenie miejsca nie wyszarza karty gdy istnieje draft (snapshot ma stare visited_at).
  const workingPins = useMemo(() => {
    if (!(draft && draft.dayId === activeRouteId)) return currentPins;
    const liveById = new Map(currentPins.map((p: any) => [p.id, p]));
    return draft.pins.map((p: any) => {
      const live = liveById.get(p.id);
      return live ? { ...p, visited_at: live.visited_at } : p;
    });
  }, [draft, activeRouteId, currentPins]);

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
    const name = pin?.place_name ? `„${pin.place_name}"` : t("editor.remove_this_place");
    if (!confirm(t("editor.remove_confirm", { name }))) return;
    setWorking(workingPins.filter((p: any) => p.id !== id));
  };

  // Zapis edycji planu. finalize=true: zamraza plan (trasa zakonczona -> Dziennik).
  // finalize=false: tylko persystuje zmiany.
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
        // trip_type=completed: trasa zakonczona (znika z home, wchodzi do Dziennika jako wpis).
        // NIE ustawiamy plan_finalized - to robi dopiero stepper wpisu ("Gotowe") = zrecenzowane.
        await (supabase as any).from("routes").update({ trip_type: "completed" }).eq("id", activeRouteId);
        // Trasa zakonczona: znika z home (filtr planning/ongoing) i trafia do Dziennika
        // jako wspomnienie. Czyscimy home-active-solo + odswiezamy Dziennik przed nawigacja.
        queryClient.removeQueries({ queryKey: ["home-active-solo"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
      }
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins", idsKey] }),
        queryClient.invalidateQueries({ queryKey: ["active-plan-trip-days", folderId, routeId] }),
        queryClient.invalidateQueries({ queryKey: ["active-plan-route", routeId] }),
      ]);
      notify.success(finalize ? t("toast.plan_saved") : t("toast.changes_saved"), undefined, finalize ? { position: "top-center" } : undefined);
      // Zatwierdzenie trasy: przenies do wpisu w Dzienniku (uzupelnienie wspomnienia +
      // udostepnianie w kroku Zdjecia). Wczesniej pokazywal sie tu osobny share prompt.
      if (finalize) navigate(`/review-summary?route=${routeId}`);
    } catch (e: any) {
      console.error("[ActiveTripPlanEditor] savePlan failed:", e?.message ?? e);
      notify.error(t("toast.save_error"));
    }
    setSavingPlan(false);
  };

  // Autozapis przy unmount: persystuj zmiany planu (kolejnosc + usuniecia) bez finalizacji.
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

  // ── "Następny przystanek" (tryb w trakcie trasy) ──────────────────────────────
  // Kontekst wnioskujemy: trasa nie jest wspomnieniem (isMemory) + jestes na miejscu
  // (distanceRef z GPS, ustawiany przez tryResolveOnSite ponizej). GPS = darmowy sensor,
  // nawigacja = deep-link do Maps (tez 0 kosztow). Wizyty oznaczamy recznie ("Tak, bylem")
  // - foreground, bez sledzenia w tle (bez drenazu baterii i zgody "Always").
  // Pominiete miejsca (user przeszedl dalej bez odhaczenia, na pytanie "bylem?" -> "jeszcze nie").
  const [skippedPinIds, setSkippedPinIds] = useState<Set<string>>(new Set());
  // Pin o ktory pytamy "Czy byles tutaj?" (double-check przy przejsciu do kolejnego bez odhaczenia).
  const [skipPromptPin, setSkipPromptPin] = useState<any | null>(null);

  // Na wejsciu w aktywna trase: jednorazowy odczyt GPS (cache, bez promptu) zeby wykryc
  // czy user jest w miescie trasy -> ustawia distanceRef. Tylko gdy trasa NIE jest miniona.
  useEffect(() => {
    if (isMemory || !route?.city) return;
    void tryResolveOnSite(route.city);
  }, [isMemory, route?.city]);

  // Trasa "dzisiaj": dzisiejsza data miesci sie w zakresie dni trasy. To GLOWNY sygnal trybu
  // w trakcie (nie wymaga GPS - dziala tez w symulatorze i bez zgody na lokalizacje).
  // "Dzis" liczymy dla AKTYWNEGO DNIA (nie calego folderu) - nawigacja w trasie
  // wielodniowej wlacza sie tylko dla dnia ktory jest dzisiaj. Dzien 2 (jutro) = planowanie.
  const tripIsToday = useMemo(() => {
    if (!activeDay?.start_date) return false;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const s = new Date(activeDay.start_date).setHours(0, 0, 0, 0);
    const e = activeDay.end_date ? new Date(activeDay.end_date).setHours(0, 0, 0, 0) : s;
    return t.getTime() >= s && t.getTime() <= e;
  }, [activeDay]);
  // Ile dni do startu aktywnego dnia (do bannera "Zaplanowana").
  const daysUntilStart = useMemo(() => {
    if (!activeDay?.start_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const s = new Date(activeDay.start_date).setHours(0, 0, 0, 0);
    return Math.round((s - today.getTime()) / 86_400_000);
  }, [activeDay]);
  const isFutureDay = !tripIsToday && daysUntilStart != null && daysUntilStart > 0;
  // Dzien MINIONY (data przeszla) w trasie ktora NIE jest jeszcze pelnym wspomnieniem
  // (np. dzien 1 = wczoraj, dzien 2 = dzis). Wtedy: brak "zaczyna sie wkrotce", miejsca wyszarzone.
  const isPastDay = useMemo(() => {
    if (isMemory || tripIsToday || !activeDay?.start_date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const e = activeDay.end_date ? new Date(activeDay.end_date).setHours(0, 0, 0, 0) : new Date(activeDay.start_date).setHours(0, 0, 0, 0);
    return e < today.getTime();
  }, [isMemory, tripIsToday, activeDay]);
  // Czy pokazujemy dolny pasek (nawigacja / zaplanowana / zakonczony) - jedno stale miejsce.
  const showBottomBar = !isMemory && (tripIsToday || isFutureDay || isPastDay);
  // Nastepny przystanek = pierwszy nieodwiedzony i niepominiety pin (po kolejnosci).
  const nextStop = useMemo(
    // workingPins (nie currentPins) -> usuniecie pina koszem od razu znika z nawigacji.
    () => workingPins.find((p: any) => !p.visited_at && !skippedPinIds.has(p.id)) ?? null,
    [workingPins, skippedPinIds],
  );

  // Po odhaczeniu OSTATNIEGO miejsca (lub auto-visit przez GPS) - trasa konczy sie i trafia
  // do Dziennika jako wspomnienie do uzupelnienia. new_for_users -> kropka na zakladce Dziennik
  // + badge "Nowa trasa!" na wpisie (powiadomienie ze jest cos do uzupelnienia).
  const finalizeOnComplete = async () => {
    try {
      // Wielodniowa trasa = wszystkie dni (folder) konczymy razem; Dziennik dedupuje po folder_id.
      await (supabase as any).from("routes")
        .update({ trip_type: "completed", new_for_users: user ? [user.id] : null })
        .in("id", dayRouteIds.length ? dayRouteIds : [activeRouteId]);
    } catch (e: any) {
      console.error("[ActiveTripPlanEditor] finalizeOnComplete failed:", e?.message ?? e);
    }
    // Przenies od razu do wpisu w Dzienniku (uzupelnienie: trasa -> notki -> zdjecia).
    // Nawigacja NAJPIERW - zanim removeQueries odmontuje ten komponent (znika z home).
    notify.success(t("toast.completed_title"), t("toast.completed_desc"));
    navigate(`/review-summary?route=${routeId}`);
    queryClient.removeQueries({ queryKey: ["home-active-solo"] });
    queryClient.invalidateQueries({ queryKey: ["active-routes"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
  };

  // Cofnij odhaczenie (np. omylkowe "Odhacz").
  const unmarkVisited = async (pinId: string) => {
    queryClient.setQueryData(["active-plan-all-pins", idsKey], (old: any) =>
      (old ?? []).map((p: any) => (p.id === pinId ? { ...p, visited_at: null } : p)),
    );
    try {
      await (supabase as any).from("pins").update({ visited_at: null }).eq("id", pinId);
      notify.success(t("toast.uncheck"));
    } catch (e: any) {
      console.error("[ActiveTripPlanEditor] unmarkVisited failed:", e?.message ?? e);
      queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins", idsKey] });
    }
  };

  // Czy po obsluzeniu (visit/skip) wszystkich pinow nie zostaje juz zaden do zrobienia -> finalizuj.
  // Liczymy ze SWIEZEGO cache (getQueryData) PO optymistycznym update, a nie ze stale closure
  // `allPins` (ktore przy odhaczaniu po kolei bywalo nieaktualne -> finalize nie odpalalo sie).
  // Po WSZYSTKICH dniach (allPins/cache obejmuje caly folder) - dzien 2 z 3 nie konczy calej trasy.
  const allHandled = (skipped: Set<string>) => {
    const latest = (queryClient.getQueryData(["active-plan-all-pins", idsKey]) ?? []) as any[];
    // Piny usuniete w drafcie aktywnego dnia (jeszcze niepersystowane) NIE blokuja ukonczenia.
    const removedIds = new Set<string>();
    if (draft && draft.dayId === activeRouteId) {
      const keep = new Set(draft.pins.map((p: any) => p.id));
      for (const p of latest) if (p.route_id === activeRouteId && !keep.has(p.id)) removedIds.add(p.id);
    }
    const relevant = latest.filter((p: any) => !removedIds.has(p.id));
    return relevant.length > 0 && relevant.every((p: any) => !!p.visited_at || skipped.has(p.id));
  };

  const markVisited = async (pinId: string, silent = false) => {
    queryClient.setQueryData(["active-plan-all-pins", idsKey], (old: any) =>
      (old ?? []).map((p: any) => (p.id === pinId ? { ...p, visited_at: new Date().toISOString() } : p)),
    );
    const done = allHandled(skippedPinIds); // czyta cache JUZ po update powyzej
    try {
      await (supabase as any).from("pins").update({ visited_at: new Date().toISOString() }).eq("id", pinId);
      if (done) await finalizeOnComplete();
      else if (!silent) notify.success(t("toast.checked"));
    } catch (e: any) {
      console.error("[ActiveTripPlanEditor] markVisited failed:", e?.message ?? e);
      queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins", idsKey] });
    }
  };

  // Double-check przy "przejdz do kolejnego" bez odhaczenia: pytamy czy user byl w tym miejscu.
  const confirmSkipWasThere = () => { const p = skipPromptPin; setSkipPromptPin(null); if (p) void markVisited(p.id); };
  const confirmSkipNotYet = () => {
    const p = skipPromptPin; setSkipPromptPin(null);
    if (!p) return;
    const newSkipped = new Set(skippedPinIds).add(p.id);
    setSkippedPinIds(newSkipped);
    if (allHandled(newSkipped)) void finalizeOnComplete();
  };

  // Karta kontekstowa nad planem: tryb "w trakcie trasy". Pokazujemy gdy trasa nie jest
  // wspomnieniem i (jest dzisiaj LUB jestes fizycznie na miejscu wg GPS). GPS dodaje dystans
  // + auto "jestes na miejscu?"; bez GPS dziala manualne odhaczanie po kolei.
  // Przyklejony pasek na dole (nad BottomNav) - JEDNO stale miejsce dla statusu dnia (zeby
  // nic nie skakalo gora/dol): dzis = nawigacja + check, przyszly = "Zaplanowana", miniony =
  // "Dzien zakonczony".
  const renderBottomBar = () => {
    if (!showBottomBar) return null;
    // Pasek "Nastepny przystanek" USUNIETY - odhaczenie + nawigacja sa teraz na KAZDEJ karcie
    // (redukcja przeciazenia poznawczego na home). Zostaje tylko info-banner przyszly/miniony dzien.
    if (tripIsToday && !!nextStop) return null;
    if (!isFutureDay && !isPastDay) return null;
    return (
      <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-40 bottom-[calc(5.6rem+env(safe-area-inset-bottom,0px))]">
        {(
          // Przyszly / miniony dzien - info banner.
          <div className="rounded-3xl bg-card border border-border/50 shadow-xl shadow-black/10 p-3 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              {isPastDay ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("status.day_finished_label")}</p>
                  <p className="text-base font-display font-extrabold text-foreground leading-tight">{t("status.day_finished")}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("status.planned_label")}</p>
                  <p className="text-base font-display font-extrabold text-foreground leading-tight">
                    {daysUntilStart === 1 ? t("status.starts_tomorrow") : t("status.starts_in_days", { count: daysUntilStart })}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Klik "Nastepny przystanek" -> POKAZ karte miejsca na homepage (przewin + podswietl),
  // NIE otwieraj szczegolow (wizytowki). Szczegoly otwiera dopiero tap w sama karte.
  const showCard = (pin: any) => {
    if (planView === "map") setPlanView("cards");
    setHighlightPinId(pin.id);
    setTimeout(() => setHighlightPinId((cur) => (cur === pin.id ? null : cur)), 1800);
    setTimeout(() => {
      document.getElementById(`active-pin-${pin.id}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
    }, 60);
  };

  // Podglad wizytowki miejsca - ta sama wizytowka co na swiperze (PlaceSwiperDetail).
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
    // Zrodlo prawdy = opis miejsca z bazy (places.description, jak w swiperze).
    // pin.description (generowany AI per-trasa) tylko jako fallback dla custom pinow.
    description: metaFor(pin).description || pin.description || "",
  } satisfies MockPlace);

  // ── Notka pod miejscem. Oceny gwiazdkowe USUNIETE (CLAUDE.md: brak ocen miejsc). ──
  const renderRatingNote = (placeName: string, centered = false) => {
    const k = rkey(activeRouteId!, placeName);
    return (
      <div className={`mt-3 pt-1 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("editor.note_label")}</p>
        <div className="relative">
          <textarea
            value={notes[k] ?? ""}
            onChange={(e) => handleNoteChange(placeName, e.target.value)}
            placeholder={t("editor.note_placeholder")}
            rows={2}
            className="w-full bg-muted/50 rounded-xl px-3 py-2.5 text-sm text-foreground text-left resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
          />
          {noteSaved[k] && (
            <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">{t("editor.note_saved")}</span>
          )}
        </div>
      </div>
    );
  };

  // ── Wspolna karta miejsca (uzywana w karuzeli "Szczegoly" i pionowej liscie). ──
  // fullWidth=false -> karta karuzeli (w-[80vw]); true -> pelna szerokosc (lista stacked).
  const renderPlanCard = (pin: any, i: number, fullWidth: boolean, editable: boolean, withRating: boolean) => (
    <div key={pin.id} id={`active-pin-${pin.id}`} className={`${fullWidth ? "w-full" : "snap-center shrink-0 w-[80vw] max-w-[320px]"} rounded-2xl bg-secondary border overflow-hidden shadow-sm flex flex-col transition-all ${highlightPinId === pin.id ? "border-trasa-teal-ink ring-2 ring-trasa-teal-ink/50" : "border-border/40"} ${pin.visited_at || isPastDay || skippedPinIds.has(pin.id) ? "opacity-55" : ""}`}>
      <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
        <div className="relative w-full aspect-[4/3] bg-muted">
          {/* Okladka = mapka miejsca (statyczna, tania). Fallback: zdjecie/placeholder gdy brak coords. */}
          {placeStaticMap(pin.latitude, pin.longitude) ? (
            <img src={placeStaticMap(pin.latitude, pin.longitude)!} alt="" loading="lazy"
              className={`w-full h-full object-cover ${pin.visited_at || isPastDay || skippedPinIds.has(pin.id) ? "grayscale opacity-90" : ""}`} />
          ) : (
            <PlacePhoto pin={pin} className={`w-full h-full object-cover ${pin.visited_at || isPastDay || skippedPinIds.has(pin.id) ? "grayscale" : ""}`} emojiClass="text-4xl" />
          )}
          {/* Numer miejsca (lewy gorny) */}
          <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
          {/* Miniatura zdjecia okladkowego miejsca (prawy dol) */}
          {placeStaticMap(pin.latitude, pin.longitude) && (
            <div className="absolute bottom-3 right-3 h-16 w-16 rounded-xl overflow-hidden ring-2 ring-white/85 shadow-md bg-muted">
              <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-2xl" />
            </div>
          )}
          {/* Prawy gorny: usun (edycja) LUB guzik Google -> wizytowka miejsca (zamiast odhaczania). */}
          {editable ? (
            <button
              onClick={(e) => { e.stopPropagation(); removeWorkingPin(pin.id); }}
              aria-label={t("editor.remove_place")}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center active:scale-90"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); openDetail(pin); }}
              aria-label={t("editor.open_place", "Zobacz miejsce")}
              className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-lg shadow-black/20 active:scale-90"
            >
              <GoogleG className="h-5 w-5" />
            </span>
          )}
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-xs font-semibold text-foreground">
              <CategoryIcon category={pin.category} className="h-4 w-4 shrink-0" />{catLabel(pin.category)}
            </span>
            {/* Pill "Nawiguj" (Google Maps directions) usuniety (2026-07-30): rezygnujemy z
                zewnetrznej nawigacji - miejsce otwiera sie w wizytowce (guzik w prawym gornym rogu). */}
          </div>
          <p className="text-base font-bold leading-tight">{pin.place_name}</p>
        </div>
      </button>
      {editable && (
        <div className="flex items-center justify-between px-4 py-3 mt-auto border-t border-border/30">
          <button onClick={() => movePin(i, i - 1)} disabled={i === 0} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            <ChevronLeft className="h-4 w-4" />{t("editor.earlier")}
          </button>
          <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-25 active:scale-95">
            {t("editor.later")}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Notatka USUNIETA z home (redukcja przeciazenia) - notki uzupelnia sie w Dzienniku. */}
      {void withRating}
    </div>
  );

  // ── Szczegoly: poziomy swiper kart. ──
  const renderSwiper = (editable: boolean, withRating: boolean) => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {workingPins.map((pin: any, i: number) => renderPlanCard(pin, i, false, editable, withRating))}
    </div>
  );

  // ── Kompaktowy wiersz listy: miniaturka + nazwa + chip kategorii + akcje. ──
  // Lekka alternatywa dla dużych kart (widok "kafelki"). Tap miniatury/nazwy -> wizytówka.
  const renderPlanRow = (pin: any, i: number, editable: boolean) => {
    const dimmed = pin.visited_at || isPastDay || skippedPinIds.has(pin.id);
    return (
      <div
        key={pin.id}
        id={`active-pin-${pin.id}`}
        className={`flex items-center gap-3 rounded-2xl bg-secondary border shadow-sm p-2.5 transition-all ${highlightPinId === pin.id ? "border-trasa-teal-ink ring-2 ring-trasa-teal-ink/50" : "border-border/40"} ${dimmed ? "opacity-55" : ""}`}
      >
        <button onClick={() => openDetail(pin)} className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted active:opacity-90">
          <PlacePhoto pin={pin} className={`w-full h-full object-cover ${pin.visited_at ? "grayscale" : ""}`} emojiClass="text-2xl" />
          <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
        </button>
        <button onClick={() => openDetail(pin)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[11px] font-semibold text-muted-foreground">
            <CategoryIcon category={pin.category} className="h-3.5 w-3.5 shrink-0" />{catLabel(pin.category)}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {editable && (
            <div className="flex flex-col">
              <button onClick={() => movePin(i, i - 1)} disabled={i === 0} aria-label={t("editor.earlier")} className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => movePin(i, i + 1)} disabled={i === workingPins.length - 1} aria-label={t("editor.later")} className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
            </div>
          )}
          {/* Guzik Google -> wizytowka miejsca (zamiast odhaczania) */}
          <button onClick={() => openDetail(pin)} aria-label={t("editor.open_place", "Zobacz miejsce")} className="h-9 w-9 rounded-full bg-white border border-border/50 shadow-sm flex items-center justify-center active:scale-90"><GoogleG className="h-4 w-4" /></button>
          {editable && (
            <button onClick={() => removeWorkingPin(pin.id)} aria-label={t("editor.remove_place")} className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/60 active:scale-90"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    );
  };

  // ── Lista: kompaktowe wiersze (miniatura + nazwa + chip), jedna pod druga. ──
  const renderEditablePlan = (withRating: boolean) => (
    <div className="space-y-2">
      {void withRating}
      {workingPins.map((pin: any, i: number) => renderPlanRow(pin, i, editMode))}
    </div>
  );

  // Przycisk dodania miejsca do planu dnia - pelnoekranowy widok /trasa/:id/dodaj.
  const renderAddPlaceButton = () => (
    <button
      onClick={() => navigate(`/trasa/${activeRouteId}/dodaj`)}
      className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-border/50 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
    >
      <Plus className="h-4 w-4" /> {t("add_place")}
    </button>
  );

  // Naglowek "Twój plan" + przelacznik Lista/Szczegoly + (multi-day) przelacznik dni.
  const renderPlanHeader = (showViewToggle = true) => (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {/* Ikony w kolkach (bg-secondary) - czytelna afordancja klikalnosci. */}
          <button
            onClick={() => setInfoOpen((o) => !o)}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors active:scale-90 ${infoOpen ? "bg-orange-100 text-orange-700" : "bg-secondary text-muted-foreground"}`}
            aria-label={t("editor.edit_hint_aria")}
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditMode((o) => !o)}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors active:scale-90 ${editMode ? "bg-orange-100 text-orange-700" : "bg-secondary text-muted-foreground"}`}
            aria-label={t("editor.edit_plan_aria")}
          >
            <Pencil className="h-4 w-4" />
          </button>
          {/* Usuwanie trasy obok edycji (przeniesione z naglowka dashboardu). */}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={deleting}
              aria-label={t("editor.delete_route_aria")}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-destructive transition-colors active:scale-90 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
        </div>
        {showViewToggle && (
          <div className="flex rounded-full bg-muted p-0.5">
            <button onClick={() => setPlanView("list")} aria-label={t("editor.view_list")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setPlanView("cards")} aria-label={t("editor.view_cards")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <GalleryHorizontalEnd className="h-4 w-4" />
            </button>
            <button onClick={() => setPlanView("map")} aria-label={t("editor.view_map")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "map" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <MapIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {infoOpen && (
        <div className="mb-3 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-orange-800 leading-relaxed">
            {t("editor.edit_hint")}
          </p>
        </div>
      )}
      {isMultiDay && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none mb-3 -mx-1 px-1">
          {sortedDays.map((d: any) => (
            <button
              key={d.id}
              onClick={() => setSelectedDayId(d.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${d.id === activeRouteId ? "bg-foreground text-background" : "bg-card border border-border/50 text-muted-foreground"}`}
            >
              {t("day_number", { number: d.day_number ?? "?" })}
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (!route) return null;

  // CTA inline: wspomnienie (data minela) i niezatwierdzone -> "Zapisz plan dnia" (finalize);
  // aktywny wpis z niezapisanymi zmianami (draft) -> "Zapisz zmiany"; inaczej brak przycisku.
  const showFinalizeBtn = isMemory && !finalized && currentPins.length > 0;
  const showSaveChangesBtn = !isMemory && draft && draft.dayId === activeRouteId;

  return (
    <div className={`pt-1 pb-4 ${flush ? "px-0" : "px-5"}`}>
      {/* Naglowek (z tabami dni) renderujemy ZAWSZE - takze gdy dzien jest pusty. Wczesniej
          pusty dzien pomijal naglowek => znikaly taby dni i nie dalo sie wrocic do innego dnia
          (trasa wielodniowa wygladala na "zgubiona"). View toggle chowamy tylko gdy pusto. */}
      {renderPlanHeader(currentPins.length > 0)}
      {currentPins.length === 0 ? (
        <>
          <p className="text-center text-sm text-muted-foreground py-8">{t("editor.empty_day")}</p>
          {renderAddPlaceButton()}
        </>
      ) : (
        <>
          {planView === "list" ? (
            renderEditablePlan(true)
          ) : planView === "map" ? (
            // Mapa aktywnego dnia (currentPins) - przelacznik dni w naglowku zmienia dzien.
            <RouteMap pins={currentPins as any} className="h-72 rounded-2xl border border-border/40" />
          ) : (
            renderSwiper(editMode, true)
          )}
          {editMode && renderAddPlaceButton()}
        </>
      )}
      {renderBottomBar()}

      {/* Double-check: "przejdz do kolejnego" bez odhaczenia -> czy byles tutaj? */}
      {skipPromptPin && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSkipPromptPin(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-trasa-teal flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-trasa-teal-ink" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black leading-snug">{t("skip.title", { place: skipPromptPin.place_name })}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t("skip.desc")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={confirmSkipWasThere} className="w-full py-3.5 rounded-full bg-[#0E0E0E] text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform">
                <Check className="h-4 w-4" /> {t("skip.yes")}
              </button>
              <button onClick={confirmSkipNotYet} className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform">
                {t("skip.no")}
              </button>
            </div>
          </div>
        </div>
      )}

      {(showFinalizeBtn || showSaveChangesBtn) && (
        <button
          onClick={() => savePlan(!!showFinalizeBtn)}
          disabled={savingPlan || workingPins.length === 0}
          className="mt-4 w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {savingPlan ? t("editor.saving") : showFinalizeBtn ? t("editor.confirm_route") : t("editor.save_changes")}
        </button>
      )}

      {/* ── Podglad wizytowki miejsca ───────────── */}
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => !o && setDetailPin(null)}
        place={detailPin}
        city={route?.city}
      />

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
                <p className="text-base font-black leading-snug">{t("share.title")}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("share.desc")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { togglePublic(true); setShowSharePrompt(false); notify.success(t("toast.shared_public")); navigate("/dziennik"); }}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                {t("share.public")}
              </button>
              <button
                onClick={() => { togglePublic(false); setShowSharePrompt(false); notify.success(t("toast.saved_private")); navigate("/dziennik"); }}
                className="w-full py-3.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                {t("share.private")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Owijka ErrorBoundary: throw w renderze edytora planu pokazuje fallback zamiast wywalac
// caly home.
export default function ActiveTripPlanEditor({ routeId, flush, onDelete, deleting }: { routeId: string; flush?: boolean; onDelete?: (e: React.MouseEvent) => void; deleting?: boolean }) {
  return (
    <ErrorBoundary>
      <ActiveTripPlanEditorInner routeId={routeId} flush={flush} onDelete={onDelete} deleting={deleting} />
    </ErrorBoundary>
  );
}
