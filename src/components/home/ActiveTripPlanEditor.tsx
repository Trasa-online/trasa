import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Trash2, Plus, Globe } from "lucide-react";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { notify } from "@/lib/notify";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDistanceReference } from "@/lib/distanceReference";
import { haversineKm, formatDistance } from "@/lib/distance";
import { Navigation, GripVertical } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";

// Edytor planu aktywnej trasy osadzony na ekranie glownym. Replika edytora planu z
// ReviewSummary (widok Dziennika), ale jako self-contained widget na home: laduje wlasne
// dane po routeId, trzyma wlasny stan, renderuje hint + plan (Lista/Szczegoly) + dodawanie
// miejsca + wizytowke + przycisk zapisu inline (NIE fixed) + popup udostepniania.
// ReviewSummary.tsx jest zamrozony - tu replikujemy jego logike, nie importujemy.

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
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={pin}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 0.98, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}
      className="bg-card border border-border/40 rounded-2xl p-2"
    >
      <div className="flex items-center gap-2">
        <div
          onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }}
          className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5"
          style={{ touchAction: "none" }}
          aria-label="Przeciągnij, aby zmienić kolejność"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <button onClick={onTap} className="flex items-center gap-2 min-w-0 flex-1 text-left active:opacity-70 transition-opacity">
          <PlacePhoto pin={pin} className="h-12 w-12 rounded-xl object-cover shrink-0" emojiClass="text-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-muted-foreground truncate">{CATEGORY_LABEL[pin.category] ?? "Miejsce"}</p>
              {distLabel && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-700">
                  <Navigation className="h-2.5 w-2.5" />{distLabel}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex flex-col shrink-0">
          <button onClick={onUp} disabled={isFirst} aria-label="W górę" className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={onDown} disabled={isLast} aria-label="W dół" className="p-1 text-muted-foreground disabled:opacity-25 active:scale-90"><ChevronDown className="h-4 w-4" /></button>
        </div>
        <button onClick={onRemove} aria-label="Usuń miejsce" className="h-8 w-8 shrink-0 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
      </div>
      {noteNode && <div className="px-0.5">{noteNode}</div>}
    </Reorder.Item>
  );
}

const ActiveTripPlanEditorInner = ({ routeId }: { routeId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const distanceRef = useDistanceReference();
  // Dystans do miejsca od wspolnego punktu odniesienia (GPS / punkt startowy), gdy pin ma wspolrzedne.
  const distFor = (pin: any): string | null =>
    distanceRef && pin?.latitude && pin?.longitude
      ? formatDistance(haversineKm(distanceRef.coords, { lat: pin.latitude, lng: pin.longitude }))
      : null;

  const [planView, setPlanView] = useState<"list" | "cards">("cards");
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [detailPin, setDetailPin] = useState<any | null>(null);
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
        .select("route_id, place_name, rating, note")
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
        await (supabase as any).from("routes").update({ plan_finalized: true, trip_type: "completed" }).eq("id", activeRouteId);
        queryClient.removeQueries({ queryKey: ["home-active-solo"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
      }
      setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins", idsKey] }),
        queryClient.invalidateQueries({ queryKey: ["active-plan-trip-days", folderId, routeId] }),
        queryClient.invalidateQueries({ queryKey: ["active-plan-route", routeId] }),
      ]);
      notify.success(finalize ? "Plan dnia zapisany" : "Zapisano zmiany");
      if (finalize) setShowSharePrompt(true);
    } catch (e: any) {
      console.error("[ActiveTripPlanEditor] savePlan failed:", e?.message ?? e);
      notify.error("Nie udało się zapisać planu");
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
    description: pin.description || metaFor(pin).description || "",
  } satisfies MockPlace);

  // ── Notka pod miejscem. Oceny gwiazdkowe USUNIETE (CLAUDE.md: brak ocen miejsc). ──
  const renderRatingNote = (placeName: string, centered = false) => {
    const k = rkey(activeRouteId!, placeName);
    return (
      <div className={`mt-3 pt-1 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notka</p>
        <div className="relative">
          <textarea
            value={notes[k] ?? ""}
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

  // ── Szczegoly: poziomy swiper kart. editable => move/usun, withRating => Notka. ──
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
              {(() => {
                const m = metaFor(pin);
                const desc = pin.description || m.description;
                return (
                  <>
                    {desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{desc}</p>}
                    {m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t}</span>
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
          {withRating && <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name, true)}</div>}
        </div>
      ))}
    </div>
  );

  // Edytowalna lista planu: chevrony gora/dol + przeciaganie (Reorder) + usuwanie.
  // Klik w miejsce => wizytowka.
  const renderEditablePlan = (withRating: boolean) => (
    <Reorder.Group as="div" axis="y" values={workingPins} onReorder={(next) => setWorking(next as any[])} className="space-y-2">
      {workingPins.map((pin: any, i: number) => (
        <PlanReorderRow
          key={pin.id}
          pin={pin}
          isFirst={i === 0}
          isLast={i === workingPins.length - 1}
          onTap={() => openDetail(pin)}
          onUp={() => movePin(i, i - 1)}
          onDown={() => movePin(i, i + 1)}
          onRemove={() => removeWorkingPin(pin.id)}
          distLabel={distFor(pin)}
          noteNode={withRating ? renderRatingNote(pin.place_name) : null}
        />
      ))}
    </Reorder.Group>
  );

  // Przycisk dodania miejsca do planu dnia - pelnoekranowy widok /trasa/:id/dodaj.
  const renderAddPlaceButton = () => (
    <button
      onClick={() => navigate(`/trasa/${activeRouteId}/dodaj`)}
      className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-border/50 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
    >
      <Plus className="h-4 w-4" /> Dodaj miejsce
    </button>
  );

  // Naglowek "Twój plan" + przelacznik Lista/Szczegoly + (multi-day) przelacznik dni.
  const renderPlanHeader = (showViewToggle = true) => (
    <>
      <div className="flex items-center justify-end mb-3">
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

  if (!route) return null;

  // CTA inline: wspomnienie (data minela) i niezatwierdzone -> "Zapisz plan dnia" (finalize);
  // aktywny wpis z niezapisanymi zmianami (draft) -> "Zapisz zmiany"; inaczej brak przycisku.
  const showFinalizeBtn = isMemory && !finalized && currentPins.length > 0;
  const showSaveChangesBtn = !isMemory && draft && draft.dayId === activeRouteId;

  return (
    <div className="px-5 pt-1 pb-4">
      {currentPins.length === 0 ? (
        <>
          <p className="text-center text-sm text-muted-foreground py-8">Brak miejsc w planie tego dnia.</p>
          {renderAddPlaceButton()}
        </>
      ) : (
        <>
          {renderPlanHeader(true)}
          <div className="mb-3 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
            <p className="text-xs text-orange-800 leading-relaxed">
              Popraw plan, jeśli coś się zmieniło - usuń miejsca, w&nbsp;których nie&nbsp;byliście, lub zmień kolejność. Oceń miejsca i&nbsp;dodaj notki, a&nbsp;potem zapisz, żeby zablokować plan i&nbsp;udostępnić trasę.
            </p>
          </div>
          {planView === "list" ? renderEditablePlan(true) : renderSwiper(true, true)}
          {renderAddPlaceButton()}
        </>
      )}

      {(showFinalizeBtn || showSaveChangesBtn) && (
        <button
          onClick={() => savePlan(!!showFinalizeBtn)}
          disabled={savingPlan || workingPins.length === 0}
          className="mt-4 w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {savingPlan ? "Zapisywanie…" : showFinalizeBtn ? "Zapisz plan dnia" : "Zapisz zmiany"}
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
                <p className="text-base font-black leading-snug">Udostępnić tę trasę innym?</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Trafi do zakładki Eksploruj i&nbsp;pomoże innym zaplanować podróż. Udostępniamy plan trasy z&nbsp;Twoją okładką, notkami i&nbsp;ocenami - bez galerii Twoich zdjęć. Jeśli nie, zostanie prywatna w&nbsp;Twoich Wspomnieniach. Zmienisz to w&nbsp;każdej chwili.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { togglePublic(true); setShowSharePrompt(false); notify.success("Trasa widoczna w Eksploruj"); navigate(`/trasa/${routeId}`); }}
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
    </div>
  );
};

// Owijka ErrorBoundary: throw w renderze edytora planu pokazuje fallback zamiast wywalac
// caly home.
export default function ActiveTripPlanEditor({ routeId }: { routeId: string }) {
  return (
    <ErrorBoundary>
      <ActiveTripPlanEditorInner routeId={routeId} />
    </ErrorBoundary>
  );
}
