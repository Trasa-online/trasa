import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TripDayView from "@/components/home/TripDayView";
import { MapPin, Users, ChevronRight } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";

// Ekran glowny = dashboard "Aktywne": aktywne trasy solo (re-uzyty TripDayView, jak wpisy
// w Dzienniku - lista miejsc + mapa + szczegoly na tap, BEZ godzin) + aktywne trasy grupowe.
// Gdy brak -> puste stany. Swiper jest pod guzikiem "+" (FAB w BottomNav).

const fmtDate = (d?: string | null) =>
  d && isValid(parseISO(d)) ? format(parseISO(d), "d MMMM yyyy", { locale: pl }) : null;

function EmptySection({ icon, title, sub, cta, onCta, cta2, onCta2 }: {
  icon: React.ReactNode; title: string; sub: string;
  cta?: string; onCta?: () => void; cta2?: string; onCta2?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 bg-muted/20 flex flex-col items-center text-center gap-2 px-6 py-8">
      <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">{icon}</div>
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">{sub}</p>
      {cta && onCta && (
        <button onClick={onCta} className="mt-1 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold active:scale-95 transition-transform">{cta}</button>
      )}
      {cta2 && onCta2 && (
        <button onClick={onCta2} className="text-sm font-semibold text-orange-600 active:scale-95 transition-transform">{cta2}</button>
      )}
    </div>
  );
}

export default function ActiveTripsDashboard({ userId }: { userId: string | null }) {
  const navigate = useNavigate();

  // Aktywne trasy SOLO (wlasne, planning/ongoing, bez grupy).
  const { data: soloRoutes = [], isLoading: soloLoading } = useQuery({
    queryKey: ["home-active-solo", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await (supabase as any)
        .from("routes")
        .select("*, pins(*)")
        .eq("user_id", userId)
        .in("trip_type", ["planning", "ongoing"])
        .order("created_at", { ascending: false });
      return ((data as any[]) || []).filter((r) => !r.group_session_id);
    },
    enabled: !!userId,
  });

  // Aktywne trasy GRUPOWE (sesje, w ktorych user jest czlonkiem; nie zakonczone, data nie minela).
  const { data: groupSessions = [], isLoading: groupLoading } = useQuery({
    queryKey: ["home-group-sessions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: members } = await (supabase as any)
        .from("group_session_members").select("session_id").eq("user_id", userId);
      if (!members?.length) return [];
      const ids = members.map((m: any) => m.session_id);
      const { data } = await (supabase as any)
        .from("group_sessions").select("id, city, join_code, trip_date, status, name")
        .in("id", ids).order("created_at", { ascending: false });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return ((data as any[]) || []).filter(
        (s) => s.status !== "completed" && (!s.trip_date || new Date(s.trip_date) >= today)
      );
    },
    enabled: !!userId,
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Aktywne trasy (solo) */}
      <section className="mb-6">
        <p className="text-sm font-bold mb-2.5 px-1">Aktywne trasy</p>
        {soloLoading ? (
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
        ) : soloRoutes.length > 0 ? (
          <div className="space-y-3">
            {soloRoutes.map((r) => (
              <div key={r.id} className="rounded-3xl bg-card border border-border/50 overflow-hidden">
                <button
                  onClick={() => navigate(`/trasa/${r.id}`)}
                  className="w-full flex items-center justify-between gap-2 px-4 pt-3.5 pb-2 text-left active:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-orange-600 shrink-0" />
                      {r.city || r.title || "Trasa"}
                    </p>
                    {fmtDate(r.start_date) && <p className="text-xs text-muted-foreground mt-0.5 ml-[22px]">{fmtDate(r.start_date)}</p>}
                  </div>
                  <span className="text-[11px] font-semibold text-orange-600 flex items-center gap-0.5 shrink-0">
                    Szczegóły<ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
                <TripDayView
                  pins={((r.pins as any[]) || []).map((p) => ({
                    id: p.id, place_name: p.place_name, pin_order: p.pin_order,
                    address: p.address, latitude: p.latitude, longitude: p.longitude,
                  }))}
                  dayLabel="Plan trasy"
                  date={r.start_date ?? null}
                  onStartReview={() => navigate(`/day-review?route=${r.id}`)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<MapPin className="h-6 w-6 text-orange-600" />}
            title="Brak aktywnych tras"
            sub="Zaplanuj nową trasę albo po prostu przeglądaj miejsca dla inspiracji."
            cta="Zaplanuj trasę"
            onCta={() => navigate("/plan")}
            cta2="Przeglądaj miejsca"
            onCta2={() => navigate("/plan", { state: { exploreMode: true } })}
          />
        )}
      </section>

      {/* Aktywne trasy grupowe */}
      <section>
        <p className="text-sm font-bold mb-2.5 px-1">Aktywne trasy grupowe</p>
        {groupLoading ? (
          <div className="h-20 rounded-3xl bg-muted/40 animate-pulse" />
        ) : groupSessions.length > 0 ? (
          <div className="space-y-2.5">
            {groupSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/sesja/${s.join_code}`)}
                className="w-full rounded-2xl bg-card border border-border/50 px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight truncate">{s.name || s.city || "Sesja grupowa"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {s.city}{fmtDate(s.trip_date) ? ` · ${fmtDate(s.trip_date)}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<Users className="h-6 w-6 text-orange-600" />}
            title="Brak aktywnych tras grupowych"
            sub="Zaplanuj coś wspólnie guzikiem + na dole."
          />
        )}
      </section>
    </div>
  );
}
