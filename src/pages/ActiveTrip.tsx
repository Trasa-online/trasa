import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Check, MapPin, Loader2, X, ZoomIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resizeImage } from "@/lib/imageResize";
import RouteMap from "@/components/RouteMap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";

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
  walking_time_from_prev: string | null;
  visited_at: string | null;
  user_photo_urls: string[];
  photo_url: string | null;
}

const ActiveTrip = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploadingPinId, setUploadingPinId] = useState<string | null>(null);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; pinId: string; idx: number } | null>(null);
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
        .select("id, place_name, pin_order, suggested_time, address, description, latitude, longitude, walking_time_from_prev, visited_at, user_photo_urls, photo_url")
        .eq("route_id", routeId)
        .order("pin_order", { ascending: true });
      if (pinsError) {
        console.error("[ActiveTrip] pins query error:", pinsError);
        throw pinsError;
      }
      console.log("[ActiveTrip] pins loaded:", pins?.length ?? 0);

      return { route, pins: (pins ?? []) as Pin[] };
    },
    enabled: !!routeId,
    retry: false,
  });

  const route = routeData?.route;
  const pins = routeData?.pins ?? [];
  const pinsWithCoords = pins.filter((p) => p.latitude && p.longitude);
  const firstUnvisitedIdx = pins.findIndex((p) => !p.visited_at);

  // Toggle visited_at: gdy null -> now(), gdy ustawione -> null.
  // Optymistyczny update cache + DB w tle.
  const handleToggleVisited = async (pin: Pin) => {
    if (togglingPinId) return;
    setTogglingPinId(pin.id);
    const newVisitedAt = pin.visited_at ? null : new Date().toISOString();
    // Optymistycznie
    queryClient.setQueryData(["active-trip", routeId], (old: any) =>
      old ? { ...old, pins: old.pins.map((p: Pin) => p.id === pin.id ? { ...p, visited_at: newVisitedAt } : p) } : old
    );
    try {
      const { error } = await (supabase as any)
        .from("pins")
        .update({ visited_at: newVisitedAt })
        .eq("id", pin.id);
      if (error) throw error;
    } catch (err) {
      // Rollback
      queryClient.invalidateQueries({ queryKey: ["active-trip", routeId] });
      toast.error("Nie udało się zapisać");
    }
    setTogglingPinId(null);
  };

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
      <div className="h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-8 text-center">
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
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/30">
        <button
          onClick={() => navigate("/home")}
          className="h-9 w-9 -ml-1 flex items-center justify-center text-foreground"
          aria-label="Wróć"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-tight truncate">{route.city || route.title || "Trasa"}</p>
          {dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
        </div>
      </div>

      {/* Map */}
      {pinsWithCoords.length > 0 && (
        <div className="shrink-0 h-[35dvh] min-h-[200px] max-h-[320px] border-b border-border/30">
          <RouteMap pins={pinsWithCoords} className="h-full w-full" />
        </div>
      )}

      {/* Pins list - scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 pb-32 space-y-2.5">
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

                {/* Pin info */}
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
                  {(pin.suggested_time || pin.walking_time_from_prev) && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {pin.suggested_time && <span>{pin.suggested_time}</span>}
                      {pin.walking_time_from_prev && (
                        <>
                          {pin.suggested_time && <span>·</span>}
                          <span>🚶 {pin.walking_time_from_prev}</span>
                        </>
                      )}
                    </div>
                  )}
                  {pin.address && (
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{pin.address}</span>
                    </div>
                  )}
                </div>

                {/* Photo upload button */}
                {canAddPhoto && (
                  <button
                    onClick={() => {
                      currentUploadPinRef.current = pin.id;
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingPinId === pin.id}
                    className="shrink-0 h-9 w-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
                    aria-label="Dodaj zdjęcie"
                  >
                    {uploadingPinId === pin.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Camera className="h-4 w-4" />
                    }
                  </button>
                )}
              </div>

              {/* Photo thumbnails - poziomy scroll */}
              {photos.length > 0 && (
                <div className="px-3 pb-3 -mx-1">
                  <div className="flex gap-2 overflow-x-auto scrollbar-none px-1">
                    {photos.map((url, photoIdx) => (
                      <div
                        key={photoIdx}
                        className="shrink-0 relative h-20 w-20 rounded-xl overflow-hidden bg-muted group"
                        onClick={() => setPhotoPreview({ url, pinId: pin.id, idx: photoIdx })}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover cursor-pointer" />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemovePhoto(pin, photoIdx); }}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                          aria-label="Usuń zdjęcie"
                        >
                          <X className="h-2.5 w-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom CTA - Zakoncz trase */}
      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={() => navigate(`/review-summary?route=${routeId}`)}
          className="w-full py-4 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
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
