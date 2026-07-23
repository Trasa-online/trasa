import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, Loader2, Share2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PlacePhoto } from "@/components/PlacePhoto";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHaptics } from "@/hooks/useHaptics";
import { useShare } from "@/hooks/useShare";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Etap 2 eksploracji: drawer "Miejsce zapisane!" pokazywany po zapisaniu miejsca guzikiem
// zakladki na karcie swipera. Miejsce laduje w Zapisanych (robi to PlaceSwiper), a ten
// sheet pozwala od razu dorzucic je do wyjazdu - nowego (input + nazwa) albo istniejacego
// (lista z lista wyjazdow + "+"). Referencja Figma: WIDOKI / "Krok 4 - klik w guzik '+'".

// Minimalny zestaw pol potrzebny do insertu pinu / utworzenia wyjazdu.
export interface SavePlaceInput {
  place_name: string;
  category: string | null;
  address: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  place_id: string | null;
}

interface TripRow {
  id: string;
  title: string | null;
  city: string | null;
  pins: { place_name: string; photo_url: string | null; category: string | null; latitude: number | null; longitude: number | null; pin_order: number | null }[] | null;
}

const skey = (name: string) => name.trim().toLowerCase();

export default function SavePlaceSheet({
  open,
  onOpenChange,
  place,
  city,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  place: SavePlaceInput | null;
  city: string;
}) {
  const { t } = useTranslation("plan");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const share = useShare();

  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null); // route id albo "new"
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["save-sheet-trips", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, pins(place_name, photo_url, category, latitude, longitude, pin_order)")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .order("created_at", { ascending: false });
      return (data ?? []) as TripRow[];
    },
    enabled: !!user && open,
  });

  // Odswiez listy wyjazdow/pinow w reszcie appki po dodaniu miejsca.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["save-sheet-trips", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["active-routes"] });
    queryClient.invalidateQueries({ queryKey: ["home-active-solo"] });
    queryClient.invalidateQueries({ queryKey: ["review-all-pins"] });
    queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins"] });
  };

  const alreadyIn = (trip: TripRow) =>
    addedIds.has(trip.id) || (trip.pins ?? []).some((p) => skey(p.place_name) === skey(place?.place_name ?? ""));

  const addToTrip = async (trip: TripRow) => {
    if (!place || !user || busyId || alreadyIn(trip)) return;
    setBusyId(trip.id);
    haptics.medium();
    try {
      const maxOrder = (trip.pins ?? []).reduce((m, p) => Math.max(m, p.pin_order ?? -1), -1);
      const { error } = await (supabase as any).from("pins").insert({
        route_id: trip.id,
        place_name: place.place_name,
        address: place.address,
        description: place.description,
        category: place.category || "other",
        latitude: place.latitude,
        longitude: place.longitude,
        place_id: place.place_id,
        suggested_time: null,
        photo_url: place.photo_url,
        pin_order: maxOrder + 1,
        original_creator_id: user.id,
      });
      if (error) throw error;
      setAddedIds((prev) => new Set(prev).add(trip.id));
      invalidate();
      toast.success(t("save_sheet.added_to", { name: trip.title || city }));
    } catch (e: any) {
      console.error("[SavePlaceSheet] add to trip failed:", e?.message ?? e);
      toast.error(t("save_sheet.add_error"));
    } finally {
      setBusyId(null);
    }
  };

  const createNew = async () => {
    const name = newName.trim();
    if (!place || !user || busyId) return;
    setBusyId("new");
    haptics.medium();
    try {
      const id = await createWyjazdFromPlaces(user.id, city || null, name || city || "Wyjazd", [
        {
          place_name: place.place_name,
          category: place.category,
          address: place.address,
          description: place.description,
          latitude: place.latitude,
          longitude: place.longitude,
          photo_url: place.photo_url,
          place_id: place.place_id,
        },
      ]);
      if (!id) throw new Error("route insert failed");
      setNewName("");
      invalidate();
      toast.success(t("save_sheet.created", { name: name || city || "Wyjazd" }));
    } catch (e: any) {
      console.error("[SavePlaceSheet] create trip failed:", e?.message ?? e);
      toast.error(t("save_sheet.create_error"));
    } finally {
      setBusyId(null);
    }
  };

  const onShare = async () => {
    if (!place) return;
    const url =
      place.latitude && place.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.place_name, place.address, city].filter(Boolean).join(" "))}`;
    const res = await share({ title: place.place_name, text: place.place_name, url });
    if (res.ok) toast.success(res.method === "clipboard" ? t("save_sheet.link_copied") : t("save_sheet.shared"));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* Uchwyt + zamknij */}
        <div className="relative pt-3 pb-1 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-2 right-3 h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t("close")}
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Tresc (scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
          <p className="text-xl font-semibold text-foreground">{t("save_sheet.title")}</p>

          {/* Nowy wyjazd: nazwa + "+" */}
          <div className="flex items-center gap-2.5 pt-3 pb-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createNew(); }}
              placeholder={t("save_sheet.new_name")}
              className="flex-1 h-12 px-3.5 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40"
            />
            <button
              type="button"
              onClick={createNew}
              disabled={busyId === "new"}
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-foreground active:scale-90 transition-transform disabled:opacity-50"
              aria-label={t("save_sheet.create_aria")}
            >
              {busyId === "new" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
            </button>
          </div>

          {/* Istniejace wyjazdy */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trips.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("save_sheet.empty_hint")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border/40">
              {trips.map((trip) => {
                const count = trip.pins?.length ?? 0;
                const cover = trip.pins?.[0];
                const added = alreadyIn(trip);
                return (
                  <div key={trip.id} className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => addToTrip(trip)}
                      disabled={added || busyId === trip.id}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left active:opacity-80 disabled:active:opacity-100"
                    >
                      <div className="relative h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                        {cover ? (
                          <PlacePhoto pin={cover} className="h-full w-full object-cover" emojiClass="text-2xl" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-2xl">🧳</div>
                        )}
                        {count > 0 && (
                          <span className="absolute bottom-1 right-1 bg-black/55 text-white text-[11px] font-medium px-1.5 rounded-full">
                            {count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{trip.title || city}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => addToTrip(trip)}
                      disabled={added || busyId === trip.id}
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform",
                        added ? "bg-orange-100 text-orange-600" : "text-foreground",
                      )}
                      aria-label={t("save_sheet.add_aria")}
                    >
                      {busyId === trip.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : added ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Plus className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stopka: Udostepnij / Gotowe */}
        <div className="shrink-0 px-5 pt-2 pb-safe-4 border-t border-border/20 flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="flex-1 h-11 rounded-2xl bg-orange-100 text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Share2 className="h-4 w-4" /> {t("save_sheet.share")}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            {t("save_sheet.done")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
