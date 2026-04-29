import { useState, useEffect } from "react";
import { Trash2, MapPin, Clock } from "lucide-react";
import { format, differenceInDays, isValid, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

// Safe date parse - always returns a valid Date or null
function safeDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  // Try ISO string first (e.g. "2026-04-20"), then fallback
  const d = typeof val === "string" && val.includes("T") ? new Date(val) : parseISO(val);
  return isValid(d) ? d : null;
}
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl } from "@/lib/placePhotos";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌿",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🔭", shopping: "🛍️", experience: "🎪",
  walk: "🚶", church: "⛪", nightlife: "🌙",
};

// ─── Lazy pin photo thumbnail ──────────────────────────────────────────────

function PinThumb({ pin, onClick }: { pin: any; onClick: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const hasCoords = pin.latitude && pin.longitude && pin.latitude !== 0 && pin.longitude !== 0;
    supabase.functions
      .invoke("google-places-proxy", {
        body: {
          placeName: pin.place_name,
          ...(hasCoords ? { latitude: pin.latitude, longitude: pin.longitude } : {}),
        },
      })
      .then(({ data }) => {
        const ref = data?.result?.photos?.[0]?.photo_reference;
        if (ref) {
          const url = getPhotoUrl(ref, 400);
          if (url) setPhoto(url);
        }
      })
      .catch(() => {});
  }, [pin.place_name]);

  return (
    <button onClick={onClick} className="shrink-0 flex flex-col gap-1.5 items-start active:scale-95 transition-transform">
      <div className="h-[100px] w-[100px] rounded-2xl overflow-hidden relative bg-muted">
        {photo ? (
          <img src={photo} alt={pin.place_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900">
            {CATEGORY_EMOJI[pin.category] ?? "📍"}
          </div>
        )}
        {pin.suggested_time && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <Clock className="h-2.5 w-2.5 text-white/80" />
            <span className="text-[10px] font-bold text-white">{pin.suggested_time}</span>
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-foreground w-[100px] truncate leading-tight">{pin.place_name}</p>
    </button>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────

interface UpcomingTripCardProps {
  trip: any;
  onDelete: () => void;
  onPinTap: (pin: any) => void;
  onEdit: (trip: any) => void;
}

const UpcomingTripCard = ({ trip, onDelete, onPinTap, onEdit }: UpcomingTripCardProps) => {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const startDateObj = safeDate(trip.startDate);
  const daysUntil = startDateObj ? differenceInDays(startDateObj, todayMidnight) : null;

  const sortedRoutes = [...(trip.routes || [])].sort((a: any, b: any) => (a.day_number || 0) - (b.day_number || 0));
  const allPins = sortedRoutes.flatMap((r: any) =>
    [...(r.pins || [])].sort((a: any, b: any) => (a.pin_order || 0) - (b.pin_order || 0))
  );
  const isMultiDay = sortedRoutes.length > 1;

  // Build static map URL
  const mapPins = allPins.filter((p: any) => p.latitude && p.longitude).slice(0, 10);
  const heroMapUrl = mapPins.length > 0
    ? `/api/static-map?size=800x400&scale=2&${mapPins.map((p: any, i: number) =>
        `markers=color:0xff6b35%7Clabel:${i + 1}%7C${p.latitude},${p.longitude}`
      ).join("&")}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`
    : null;

  const countdownLabel = daysUntil === null
    ? null
    : daysUntil === 0
    ? "Dzisiaj! 🔥"
    : daysUntil === 1
    ? "Jutro! 🔥"
    : `Za ${daysUntil} dni 🔥`;

  const dateLabel = startDateObj
    ? format(startDateObj, "d MMM", { locale: pl })
    : null;

  return (
    <div className="space-y-4">
      {/* ── Hero card ── */}
      <div className="relative h-52 rounded-3xl overflow-hidden shadow-lg">
        {/* Background */}
        {heroMapUrl ? (
          <img src={heroMapUrl} alt={trip.city} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-600" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

        {/* Top row: countdown + delete */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          {countdownLabel && (
            <span className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm shadow-primary/30">
              {countdownLabel}
            </span>
          )}
          <button
            onClick={onDelete}
            className="h-8 w-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <Trash2 className="h-3.5 w-3.5 text-white/80" />
          </button>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p className="text-2xl font-black text-white leading-tight">{trip.city}</p>
          <div className="flex items-center gap-2 mt-1">
            {dateLabel && (
              <span className="text-white/70 text-sm font-medium">{dateLabel}</span>
            )}
            {dateLabel && <span className="text-white/30">·</span>}
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-white/50" />
              <span className="text-white/70 text-sm">
                {allPins.length} {allPins.length === 1 ? "miejsce" : allPins.length < 5 ? "miejsca" : "miejsc"}
              </span>
            </div>
            {isMultiDay && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-white/70 text-sm">{sortedRoutes.length} dni</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Per-day sections ── */}
      {sortedRoutes.map((route: any, routeIdx: number) => {
        const dayPins = [...(route.pins || [])].sort((a: any, b: any) => (a.pin_order || 0) - (b.pin_order || 0));
        if (dayPins.length === 0) return null;
        const routeDateObj = safeDate(route.start_date);
        const dayDate = routeDateObj
          ? format(routeDateObj, "EEE, d MMM", { locale: pl })
          : null;
        return (
          <div key={route.id} className="space-y-2">
            {/* Day header */}
            <div className="flex items-center gap-2">
              {isMultiDay && (
                <span className="text-[11px] font-bold bg-foreground text-background px-2 py-0.5 rounded-full">
                  Dzień {route.day_number || routeIdx + 1}
                </span>
              )}
              {dayDate && (
                <span className="text-xs text-muted-foreground">{dayDate}</span>
              )}
              <span className="text-xs text-muted-foreground">
                · {dayPins.length} {dayPins.length === 1 ? "miejsce" : dayPins.length < 5 ? "miejsca" : "miejsc"}
              </span>
            </div>
            {/* Photo strip */}
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none snap-x">
              {dayPins.slice(0, 6).map((pin: any, idx: number) => (
                <PinThumb key={idx} pin={pin} onClick={() => onPinTap(pin)} />
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Edit CTA ── */}
      <button
        onClick={() => onEdit(trip)}
        className="w-full py-3 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
      >
        Dostosuj plan →
      </button>
    </div>
  );
};

export default UpcomingTripCard;
