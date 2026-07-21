import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Loader2, MapPin, CheckCircle2, Calendar } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dateLocale } from "@/lib/dateLocale";
import { PlacePhoto } from "@/components/PlacePhoto";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { notify } from "@/lib/notify";

// Ekran pojedynczego WYJAZDU (tryb uproszczony). Wyjazd = lekka trasa BEZ planowania:
// tytul, miasto, opcjonalne daty, plaska lista miejsc (dorzucanych z Zapisanych przez
// istniejacy ekran /trasa/:id/dodaj) + notki (per miejsce = pin_ratings.note, per wyjazd
// = routes.description). Zadnego AI, timeline ani ukladania kolejnosci godzinowej.

interface WyjazdRoute {
  id: string;
  user_id: string;
  title: string | null;
  city: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  trip_type: string | null;
}

interface WyjazdPin {
  id: string;
  place_name: string;
  category: string | null;
  address: string | null;
  photo_url: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  pin_order: number | null;
}

const WyjazdInner = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [tripNote, setTripNote] = useState("");
  const [placeNotes, setPlaceNotes] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["wyjazd-route", routeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, user_id, title, city, description, start_date, end_date, trip_type")
        .eq("id", routeId)
        .single();
      return (data ?? null) as WyjazdRoute | null;
    },
    enabled: !!routeId,
  });

  const { data: pins = [], isLoading: pinsLoading } = useQuery({
    queryKey: ["wyjazd-pins", routeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, place_name, category, address, photo_url, image_url, latitude, longitude, pin_order")
        .eq("route_id", routeId)
        .order("pin_order", { ascending: true });
      return (data ?? []) as WyjazdPin[];
    },
    enabled: !!routeId,
  });

  // Notki per miejsce (pin_ratings, klucz route_id+user_id+place_name).
  const { data: ratings = [] } = useQuery({
    queryKey: ["wyjazd-ratings", routeId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("place_name, note")
        .eq("route_id", routeId)
        .eq("user_id", user.id);
      return (data ?? []) as { place_name: string; note: string | null }[];
    },
    enabled: !!routeId && !!user?.id,
  });

  // Zsynchronizuj lokalny stan notek z DB po zaladowaniu.
  useEffect(() => {
    if (route) setTripNote(route.description ?? "");
  }, [route]);
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const r of ratings) map[r.place_name.toLowerCase()] = r.note ?? "";
    setPlaceNotes(map);
  }, [ratings]);

  const saveTripNote = async () => {
    if (!routeId) return;
    const value = tripNote.trim();
    if (value === (route?.description ?? "")) return;
    await (supabase as any).from("routes").update({ description: value }).eq("id", routeId);
    queryClient.invalidateQueries({ queryKey: ["wyjazd-route", routeId] });
  };

  const savePlaceNote = async (placeName: string) => {
    if (!routeId || !user?.id) return;
    const value = (placeNotes[placeName.toLowerCase()] ?? "").trim();
    await (supabase as any)
      .from("pin_ratings")
      .upsert(
        { route_id: routeId, user_id: user.id, place_name: placeName, note: value },
        { onConflict: "route_id,user_id,place_name" },
      );
  };

  const removePin = async (pin: WyjazdPin) => {
    if (!confirm(`Usunąć „${pin.place_name}" z wyjazdu?`)) return;
    setRemovingId(pin.id);
    try {
      const { error } = await supabase.from("pins").delete().eq("id", pin.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["wyjazd-pins", routeId] });
    } catch (e: any) {
      console.error("[Wyjazd] remove pin failed:", e?.message ?? e);
      notify.error("Nie udało się usunąć miejsca");
    }
    setRemovingId(null);
  };

  const finishTrip = async () => {
    if (!routeId) return;
    setFinishing(true);
    try {
      await saveTripNote();
      const { error } = await (supabase as any)
        .from("routes")
        .update({ trip_type: "completed", plan_finalized: true })
        .eq("id", routeId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notify.success("Wyjazd zapisany w dzienniku");
      navigate("/dziennik");
    } catch (e: any) {
      console.error("[Wyjazd] finish failed:", e?.message ?? e);
      notify.error("Nie udało się zakończyć wyjazdu");
      setFinishing(false);
    }
  };

  const dateLabel = (() => {
    const s = route?.start_date ? parseISO(route.start_date) : null;
    const e = route?.end_date ? parseISO(route.end_date) : null;
    if (s && isValid(s) && e && isValid(e) && route?.start_date !== route?.end_date) {
      return `${format(s, "d MMM", { locale: dateLocale() })} - ${format(e, "d MMM yyyy", { locale: dateLocale() })}`;
    }
    if (s && isValid(s)) return format(s, "d MMMM yyyy", { locale: dateLocale() });
    return "";
  })();

  if (routeLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <p className="text-base font-bold">Nie znaleziono wyjazdu</p>
        <button
          onClick={() => navigate("/dziennik")}
          className="px-5 py-3 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          {"Wróć do wyjazdów"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={() => navigate("/dziennik")}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
          aria-label="Wróć"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-base font-bold truncate">{route.title || route.city || "Wyjazd"}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 min-h-0">
        {/* Meta: miasto + daty */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
          {route.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />{route.city}
            </span>
          )}
          {dateLabel && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />{dateLabel}
            </span>
          )}
        </div>

        {/* Notka do calego wyjazdu */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{"Notka do wyjazdu"}</label>
          <textarea
            value={tripNote}
            onChange={(e) => setTripNote(e.target.value)}
            onBlur={saveTripNote}
            placeholder={"Zapisz wspomnienia albo plan na ten wyjazd..."}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 resize-none"
          />
        </div>

        {/* Lista miejsc */}
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold">
            Miejsca{pins.length > 0 ? ` (${pins.length})` : ""}
          </h2>
        </div>

        {pinsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 px-6 text-center rounded-3xl border border-dashed border-border/60 bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              {"Dorzuć miejsca z Zapisanych albo poszukaj nowych, żeby zbudować swój wyjazd."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pins.map((pin) => {
              const key = pin.place_name.toLowerCase();
              return (
                <div key={pin.id} className="rounded-3xl border border-border/50 bg-card overflow-hidden">
                  <div className="flex items-center gap-3 p-2.5">
                    <PlacePhoto
                      pin={{ place_name: pin.place_name, category: pin.category ?? "other", photo_url: pin.photo_url ?? pin.image_url, latitude: pin.latitude, longitude: pin.longitude }}
                      className="h-16 w-16 rounded-2xl object-cover shrink-0"
                      emojiClass="text-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                      {pin.address && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{pin.address}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removePin(pin)}
                      disabled={removingId === pin.id}
                      className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
                      aria-label="Usuń miejsce"
                    >
                      {removingId === pin.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                  {/* Notka do miejsca */}
                  <div className="px-2.5 pb-2.5">
                    <textarea
                      value={placeNotes[key] ?? ""}
                      onChange={(e) => setPlaceNotes((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => savePlaceNote(pin.place_name)}
                      placeholder={"Twoja notka o tym miejscu..."}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-border/60 bg-muted/20 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 resize-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dodaj miejsca */}
        <button
          onClick={() => navigate(`/trasa/${routeId}/dodaj`)}
          className="mt-3 w-full py-3.5 rounded-2xl border border-border bg-secondary text-secondary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Dodaj miejsca
        </button>
      </div>

      {/* Zakoncz wyjazd */}
      <div className="shrink-0 px-4 pt-2 pb-safe-4 border-t border-border/20 bg-background">
        <button
          onClick={finishTrip}
          disabled={finishing}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {finishing
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : <><CheckCircle2 className="h-5 w-5" />{"Zakończ i zapisz w dzienniku"}</>
          }
        </button>
      </div>
    </div>
  );
};

export default function Wyjazd() {
  return (
    <ErrorBoundary>
      <WyjazdInner />
    </ErrorBoundary>
  );
}
