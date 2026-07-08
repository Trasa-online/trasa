import { Component, type ReactNode, useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, MapPin, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resizeImage } from "@/lib/imageResize";
import RouteMap from "@/components/RouteMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveStored } from "@/components/PlacePhoto";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { expandCity } from "@/lib/cities";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";

// Error boundary wokol RouteMap - Google Maps API (vis.gl/react-google-maps)
// czasami crashuje (np. brak API key w env, network down, geocoding limit).
// Bez tego cały widok ActiveTrip zostawal zablokowany przez render error.
// Z fallback uzytkownik widzi liste pinów + checkboxy + photo - mapa to bonus.
class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[ActiveTrip MapErrorBoundary] caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground bg-muted/30">
          Mapa chwilowo niedostępna
        </div>
      );
    }
    return this.props.children;
  }
}

// "W trakcie podrozy" view - mapa Leaflet + lista pinów z okraglymi checkboxami
// 'bylem tutaj' (visited_at) + photo upload do trip-photos bucket (max 5 per pin).
// CTA na dole 'Zakoncz trase' navigates do /review-summary?route={id}.
//
// User trafia tutaj zaraz po saveRoute (RouteSummaryDialog) gdy start_date = today
// albo null (trasa od razu zaczyna). Wczesniej navigate('/home') urywal sciezke
// w polowie - user nie wiedzial gdzie isc, brak 'in-trip' UX.

const MAX_PHOTOS_PER_PIN = 5;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

interface Pin {
  id: string;
  place_name: string;
  pin_order: number;
  suggested_time: string | null;
  address: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  visited_at: string | null;
  user_photo_urls: string[];
  photo_url: string | null;
}

const ActiveTrip = ({ routeId: propRouteId, embedded = false }: { routeId?: string; embedded?: boolean } = {}) => {
  const { id: paramRouteId } = useParams<{ id: string }>();
  // embedded=true gdy renderowany na /home (w AppLayout z BottomNav): routeId z propa,
  // brak guzika "Wroc", dolny CTA podniesiony nad BottomNav, wysokosc flex-1 zamiast 100dvh.
  const routeId = propRouteId ?? paramRouteId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploadingPinId, setUploadingPinId] = useState<string | null>(null);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; pinId: string; idx: number } | null>(null);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUploadPinRef = useRef<string | null>(null);

  const { data: routeData, isLoading, error: queryError } = useQuery({
    queryKey: ["active-trip", routeId],
    queryFn: async () => {
      if (!routeId) {
        console.error("[ActiveTrip] routeId is null/undefined", { routeId });
        throw new Error("Brak ID trasy w URL");
      }
      console.log("[ActiveTrip] fetching route", { routeId });
      const { data: route, error: routeError } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, user_id, status, group_session_id")
        .eq("id", routeId)
        .maybeSingle();
      if (routeError) {
        console.error("[ActiveTrip] route query error:", routeError);
        throw routeError;
      }
      if (!route) {
        console.warn("[ActiveTrip] route not found (RLS blocked or wrong id)", { routeId });
        throw new Error(`Trasa ${routeId} nie istnieje lub nie masz do niej dostępu (RLS)`);
      }
      console.log("[ActiveTrip] route loaded:", route);

      const { data: pins, error: pinsError } = await (supabase as any)
        .from("pins")
        .select("id, place_name, pin_order, suggested_time, address, description, latitude, longitude, visited_at, user_photo_urls, photo_url")
        .eq("route_id", routeId)
        .order("pin_order", { ascending: true });
      if (pinsError) {
        console.error("[ActiveTrip] pins query error:", pinsError);
        throw pinsError;
      }
      console.log("[ActiveTrip] pins loaded:", pins?.length ?? 0);

      // Opisy miejsc z bazy = zrodlo prawdy (places.description, jak w swiperze).
      // Mapa nazwa->opis; pin.description (AI per-trasa) tylko jako fallback.
      const names = (pins ?? []).map((p: any) => p.place_name).filter(Boolean);
      const descMap: Record<string, string> = {};
      if (names.length && route.city) {
        const { data: placeRows } = await (supabase as any)
          .from("places")
          .select("place_name, description")
          .in("city", expandCity(route.city))
          .in("place_name", names);
        for (const r of (placeRows ?? [])) {
          if (r.description) descMap[r.place_name.toLowerCase()] = r.description;
        }
      }

      return { route, pins: (pins ?? []) as Pin[], descMap };
    },
    enabled: !!routeId,
    retry: false,
  });

  const route = routeData?.route;
  const pins = routeData?.pins ?? [];
  const descMap = routeData?.descMap ?? {};
  const pinsWithCoords = pins.filter((p) => p.latitude && p.longitude);
  const firstUnvisitedIdx = pins.findIndex((p) => !p.visited_at);

  // Toggle visited_at: gdy null -> now(), gdy ustawione -> null.
  // Optymistyczny update cache + DB w tle.
  const handleToggleVisited = async (pin: Pin) => {
    if (togglingPinId) return;
    setTogglingPinId(pin.id);
    const newVisitedAt = pin.visited_at ? null : new Date().toISOString();
    // Czy po tym oznaczeniu WSZYSTKIE miejsca beda odwiedzone -> trasa zakonczona.
    const willAllBeVisited = !!newVisitedAt && pins.every((p) => p.id === pin.id || !!p.visited_at);
    console.log("[ActiveTrip] toggle pin", { pinId: pin.id, oldVisitedAt: pin.visited_at, newVisitedAt });
    // Optymistycznie
    queryClient.setQueryData(["active-trip", routeId], (old: any) =>
      old ? { ...old, pins: old.pins.map((p: Pin) => p.id === pin.id ? { ...p, visited_at: newVisitedAt } : p) } : old
    );
    try {
      // count: 'exact' detekcja silent RLS fail (UPDATE bez policy zwraca OK ale 0 rows).
      const { error, count } = await (supabase as any)
        .from("pins")
        .update({ visited_at: newVisitedAt }, { count: "exact" })
        .eq("id", pin.id);
      if (error) throw error;
      console.log("[ActiveTrip] update result:", { count });
      if (count === 0) {
        throw new Error("RLS zablokowal update (0 rows). Sprawdz policy 'Users can update pins for their routes'.");
      }
      // Wszystkie miejsca odhaczone -> trasa 'completed' (znika z ekranu glownego, wraca swiper #5)
      // i przenosimy do podsumowania w Dzienniku: sprawdzenie/edycja trasy + galeria/notki = wspomnienie (#4).
      if (willAllBeVisited) {
        await (supabase as any).from("routes").update({ trip_type: "completed" }).eq("id", routeId);
        queryClient.removeQueries({ queryKey: ["home-active-solo"] });
        queryClient.invalidateQueries({ queryKey: ["active-routes"] });
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        toast.success("Brawo! Wszystkie miejsca odwiedzone 🎉", { description: "Sprawdź trasę i dodaj wspomnienie" });
        navigate(`/review-summary?route=${routeId}`);
      }
    } catch (err: any) {
      console.error("[ActiveTrip] toggle failed:", err);
      queryClient.invalidateQueries({ queryKey: ["active-trip", routeId] });
      toast.error("Nie udało się zapisać", { description: err?.message ?? "" });
    }
    setTogglingPinId(null);
  };

  // Tap w karte miejsca -> pelna wizytowka (PlaceSwiperDetail dociaga zdjecia/recenzje z Google po nazwie+miescie).
  const openDetail = (pin: Pin) => setDetailPlace({
    id: pin.id || pin.place_name,
    place_name: pin.place_name,
    category: "other" as any,
    city: route?.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    photo_url: resolveStored(pin.photo_url) ?? "",
    vibe_tags: [],
    description: descMap[(pin.place_name ?? "").toLowerCase()] || pin.description || "",
  } satisfies MockPlace);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pinId = currentUploadPinRef.current;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !pinId || !user?.id || !routeId) return;

    const pin = pins.find((p) => p.id === pinId);
    if (!pin) return;

    const remaining = MAX_PHOTOS_PER_PIN - (pin.user_photo_urls?.length ?? 0);
    if (remaining <= 0) {
      toast.error(`Maksymalnie ${MAX_PHOTOS_PER_PIN} zdjęć na miejsce`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    setUploadingPinId(pinId);
    try {
      const newUrls: string[] = [];
      for (const file of toUpload) {
        if (!ALLOWED_MIME.includes(file.type)) {
          toast.error("Niedozwolony format pliku");
          continue;
        }
        const optimized = await resizeImage(file);
        const ext = optimized.name.split(".").pop() ?? "jpg";
        const idx = (pin.user_photo_urls?.length ?? 0) + newUrls.length;
        const path = `${user.id}/${routeId}/${pinId}/${Date.now()}-${idx}.${ext}`;
        const { data, error: uploadError } = await supabase.storage
          .from("trip-photos")
          .upload(path, optimized);
        if (uploadError) {
          console.error("[ActiveTrip] upload failed:", uploadError);
          toast.error(`Nie udało się przesłać zdjęcia: ${uploadError.message}`);
          continue;
        }
        const url = supabase.storage.from("trip-photos").getPublicUrl(data.path).data.publicUrl;
        newUrls.push(url);
      }
      if (newUrls.length > 0) {
        const updatedUrls = [...(pin.user_photo_urls ?? []), ...newUrls];
        const { error } = await (supabase as any)
          .from("pins")
          .update({ user_photo_urls: updatedUrls })
          .eq("id", pin.id);
        if (error) throw error;
        queryClient.setQueryData(["active-trip", routeId], (old: any) =>
          old ? { ...old, pins: old.pins.map((p: Pin) => p.id === pin.id ? { ...p, user_photo_urls: updatedUrls } : p) } : old
        );
        toast.success(`Dodano ${newUrls.length} ${newUrls.length === 1 ? "zdjęcie" : "zdjęcia"}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się przesłać zdjęć");
    }
    setUploadingPinId(null);
    currentUploadPinRef.current = null;
  };

  const handleRemovePhoto = async (pin: Pin, photoIdx: number) => {
    const newUrls = (pin.user_photo_urls ?? []).filter((_, i) => i !== photoIdx);
    queryClient.setQueryData(["active-trip", routeId], (old: any) =>
      old ? { ...old, pins: old.pins.map((p: Pin) => p.id === pin.id ? { ...p, user_photo_urls: newUrls } : p) } : old
    );
    try {
      const { error } = await (supabase as any)
        .from("pins")
        .update({ user_photo_urls: newUrls })
        .eq("id", pin.id);
      if (error) throw error;
    } catch {
      queryClient.invalidateQueries({ queryKey: ["active-trip", routeId] });
      toast.error("Nie udało się usunąć zdjęcia");
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? "h-full flex-1 min-h-0" : "h-[100dvh]"}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 px-8 text-center ${embedded ? "h-full flex-1 min-h-0" : "h-[100dvh]"}`}>
        <p className="text-lg font-bold">Nie znaleziono trasy</p>
        {queryError && (
          <p className="text-xs text-muted-foreground max-w-[280px]">
            {(queryError as Error).message ?? "Nieznany błąd"}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          routeId: {routeId ?? "null"}
        </p>
        <button
          onClick={() => navigate("/home")}
          className="px-6 py-3 rounded-full bg-primary text-white font-semibold text-sm"
        >
          Wróć na główną
        </button>
      </div>
    );
  }

  const dateLabel = route.start_date && isValid(parseISO(route.start_date))
    ? format(parseISO(route.start_date), "d MMMM yyyy", { locale: pl })
    : null;

  return (
    <div className={`flex flex-col bg-background ${embedded ? "h-full flex-1 min-h-0" : "h-[100dvh]"}`}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-safe pb-2.5 border-b border-border/30">
        {!embedded && (
          <button
            onClick={() => navigate("/home")}
            className="h-9 w-9 -ml-1 flex items-center justify-center text-foreground"
            aria-label="Wróć"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-tight truncate">{route.city || route.title || "Trasa"}</p>
          {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
        </div>
        {/* Reset zaznaczonych pinów - przydaje sie gdy user przetestowala wczoraj
            i chce zaczac od zera, albo pomylkowo zaznaczyla wszystko. */}
        {pins.some((p) => p.visited_at) && (
          <button
            onClick={async () => {
              if (!confirm("Cofnąć oznaczenia wszystkich miejsc jako odwiedzone?")) return;
              const visitedPins = pins.filter((p) => p.visited_at);
              queryClient.setQueryData(["active-trip", routeId], (old: any) =>
                old ? { ...old, pins: old.pins.map((p: Pin) => ({ ...p, visited_at: null })) } : old
              );
              try {
                const ids = visitedPins.map((p) => p.id);
                const { error } = await (supabase as any)
                  .from("pins")
                  .update({ visited_at: null })
                  .in("id", ids);
                if (error) throw error;
                toast.success("Wszystkie miejsca odznaczone");
              } catch (err: any) {
                queryClient.invalidateQueries({ queryKey: ["active-trip", routeId] });
                toast.error("Nie udało się", { description: err?.message ?? "" });
              }
            }}
            className="text-xs text-muted-foreground underline px-2"
          >
            Resetuj
          </button>
        )}
      </div>

      {/* Map - wrap w error boundary bo Google Maps moze crashowac na iOS WebView
          gdy brakuje API key albo network failuje. Lista pinów pozostaje niezalezna. */}
      {pinsWithCoords.length > 0 && (
        <div className="shrink-0 h-[35dvh] min-h-[200px] max-h-[320px] border-b border-border/30">
          <MapErrorBoundary>
            <RouteMap pins={pinsWithCoords} className="h-full w-full" />
          </MapErrorBoundary>
        </div>
      )}

      {/* Pins list - scroll */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 ${embedded ? "pb-[calc(8rem+3.5rem)]" : "pb-32"}`}>
        {pins.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Brak miejsc w tej trasie
          </div>
        )}
        {pins.map((pin, idx) => {
          const visited = !!pin.visited_at;
          const isNext = idx === firstUnvisitedIdx;
          const photos = pin.user_photo_urls ?? [];
          const canAddPhoto = photos.length < MAX_PHOTOS_PER_PIN;

          return (
            <div
              key={pin.id}
              className={cn(
                "rounded-2xl bg-card border transition-colors",
                visited ? "border-border/30 opacity-60" : isNext ? "border-orange-500/60 shadow-sm shadow-orange-500/10" : "border-border/50"
              )}
            >
              <div className="flex items-start gap-3 p-3">
                {/* Okragly checkbox */}
                <button
                  onClick={() => handleToggleVisited(pin)}
                  disabled={togglingPinId === pin.id}
                  className={cn(
                    "shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all active:scale-90",
                    visited
                      ? "bg-orange-600 border-orange-600 text-white"
                      : "border-border bg-background hover:border-orange-400"
                  )}
                  aria-label={visited ? "Cofnij oznaczenie" : "Oznacz jako odwiedzone"}
                >
                  {togglingPinId === pin.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : visited ? <Check className="h-4 w-4" /> : null
                  }
                </button>

                {/* Zdjecie miejsca + info -> tap otwiera pelna wizytowke */}
                <button type="button" onClick={() => openDetail(pin)} className="flex items-start gap-2.5 flex-1 min-w-0 text-left">
                  {resolveStored(pin.photo_url) ? (
                    <img src={resolveStored(pin.photo_url)!} alt={pin.place_name} loading="lazy" className={cn("shrink-0 h-14 w-14 rounded-xl object-cover bg-muted", visited && "opacity-60")} />
                  ) : (
                    <div className={cn("shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center", visited && "opacity-60")}>
                      <MapPin className="h-5 w-5 text-orange-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className={cn("text-sm font-bold leading-tight flex-1 truncate", visited && "line-through text-muted-foreground")}>
                      {pin.place_name}
                    </p>
                    {isNext && !visited && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Następne
                      </span>
                    )}
                  </div>
                  {/* Hours warning badge - polubione miejsce dodane przez safeguard
                      gdy AI uznal ze godziny otwarcia nie pasuja. Description zaczyna sie
                      od ⚠️ Sprawdz godziny otwarcia. Reuse opis jako sygnal. */}
                  {pin.description?.startsWith("⚠️") && !visited && (
                    <div className="flex items-center gap-1.5 mt-1 mb-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
                      <span className="text-[11px] text-amber-800 leading-snug">
                        {pin.description}
                      </span>
                    </div>
                  )}
                  {pin.address && (
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{pin.address}</span>
                    </div>
                  )}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA - Zakoncz trase */}
      <div className={`shrink-0 fixed left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-t from-background via-background to-transparent ${embedded ? "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-3" : "bottom-0 pb-[max(16px,env(safe-area-inset-bottom))]"}`}>
        <button
          onClick={() => navigate(`/review-summary?route=${routeId}`)}
          className="mx-auto w-auto px-8 py-2.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
        >
          Zakończ trasę
        </button>
      </div>

      {/* Hidden file input - uploaded gdy user klika camera ikona na pinie */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Wizytowka miejsca (tap w karte) */}
      {detailPlace && (
        <PlaceSwiperDetail
          open={!!detailPlace}
          onOpenChange={(o) => { if (!o) setDetailPlace(null); }}
          place={detailPlace}
          city={route?.city ?? undefined}
          skipGoogleFetch={false}
        />
      )}

      {/* Photo preview lightbox */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white"
            onClick={() => setPhotoPreview(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img src={photoPreview.url} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
};

export default ActiveTrip;
