import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, GripVertical, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { parseISO, isValid, format, addDays } from "date-fns";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

interface PlanPin {
  place_name: string;
  address: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  liked_by?: number;
  hasSuperLike?: boolean;
}

interface LocationState {
  city: string;
  date: string | null;
  pins: PlanPin[];
  sessionId: string;
  memberIds: string[];
  backTo: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🔭", shopping: "🛍️", experience: "🎪",
  walk: "🚶", church: "⛪",
};

const QuickPlanReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as LocationState | null;

  const [pins, setPins] = useState<PlanPin[]>(state?.pins ?? []);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const city = state?.city ?? "";
  const dateStr = state?.date ?? null;
  const sessionId = state?.sessionId ?? "";
  const memberIds = state?.memberIds ?? [];
  const backTo = state?.backTo ?? "/";

  const dateObj = dateStr ? parseISO(dateStr) : null;
  const validDate = dateObj && isValid(dateObj) ? dateObj : null;
  const dateLabel = validDate ? format(validDate, "d MMMM yyyy", { locale: { code: "pl" } }) : null;

  // Static map URL
  const mapPins = pins.filter(p => p.latitude && p.longitude).slice(0, 10);
  const mapUrl = GOOGLE_MAPS_API_KEY && mapPins.length > 0
    ? `https://maps.googleapis.com/maps/api/staticmap?size=800x300&scale=2&${
        mapPins.map((p, i) => `markers=color:0xea580c%7Clabel:${i + 1}%7C${p.latitude},${p.longitude}`).join("&")
      }&style=feature:poi%7Cvisibility:off&key=${GOOGLE_MAPS_API_KEY}`
    : null;

  // ── Drag-to-reorder ──────────────────────────────────────────────────────────
  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIdx(i);
  };
  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...pins];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setPins(next);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // ── Save route for all members ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || pins.length === 0) return;
    setSaving(true);
    try {
      const allMemberIds = [...new Set([user.id, ...memberIds])];
      const startDateStr = validDate ? format(validDate, "yyyy-MM-dd") : null;

      for (const memberId of allMemberIds) {
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({
            user_id: memberId,
            city,
            title: city,
            status: "draft",
            trip_type: "planning",
            start_date: startDateStr,
            end_date: startDateStr,
            day_number: 1,
            ...(sessionId ? { group_session_id: sessionId } : {}),
          })
          .select("id")
          .single();

        if (routeError || !route) throw routeError ?? new Error("Brak ID trasy");

        await supabase.from("pins").insert(
          pins.map((pin, idx) => ({
            route_id: route.id,
            place_name: pin.place_name,
            address: pin.address ?? "",
            description: pin.description ?? "",
            category: pin.category,
            latitude: pin.latitude,
            longitude: pin.longitude,
            pin_order: idx + 1,
          }))
        );
      }

      toast.success("Trasa zapisana! 🎉", { description: `${city} · ${pins.length} miejsc` });
      navigate("/");
    } catch (err: any) {
      toast.error("Błąd zapisu", { description: err?.message ?? "Spróbuj ponownie" });
    } finally {
      setSaving(false);
    }
  }, [user, pins, city, validDate, sessionId, memberIds, navigate]);

  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 px-8 text-center">
        <p className="text-4xl">🗺️</p>
        <p className="font-bold">Brak danych trasy</p>
        <button onClick={() => navigate("/")} className="text-sm text-orange-600 font-semibold underline">
          Wróć do głównej
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={() => navigate(backTo)}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight">{city}</p>
          <p className="text-xs text-muted-foreground">
            {pins.length} wspólnych miejsc{dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Map */}
        {mapUrl && (
          <div className="w-full h-40 bg-muted overflow-hidden">
            <img src={mapUrl} alt="Mapa trasy" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Place list */}
        <div className="px-4 py-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Wspólne miejsca — przeciągnij, żeby zmienić kolejność
          </p>
          {pins.map((pin, i) => (
            <div
              key={pin.place_name}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                dragOverIdx === i && dragIdx !== i
                  ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
                  : dragIdx === i
                  ? "opacity-40 border-border/30 bg-muted"
                  : "border-border/40 bg-card"
              }`}
            >
              {/* Number */}
              <div className="h-7 w-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">
                  {CATEGORY_EMOJI[pin.category] ?? "📍"} {pin.place_name}
                </p>
                {pin.address && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />{pin.address}
                  </p>
                )}
                {pin.hasSuperLike && (
                  <span className="text-[10px] font-semibold text-amber-500">⭐ Super match</span>
                )}
                {pin.liked_by && pin.liked_by > 1 && !pin.hasSuperLike && (
                  <span className="text-[10px] text-muted-foreground">❤️ {pin.liked_by} osoby</span>
                )}
              </div>
              {/* Drag handle */}
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-safe-4 pb-6 pt-3 border-t border-border/20">
        {memberIds.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mb-3">
            Trasa zostanie zapisana dla {memberIds.length + 1} osób
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || pins.length === 0}
          className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {saving ? "Zapisuję…" : `Zapisz trasę (${pins.length} miejsc)`}
        </button>
      </div>
    </div>
  );
};

export default QuickPlanReview;
