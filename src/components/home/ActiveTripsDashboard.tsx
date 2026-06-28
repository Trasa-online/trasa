import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ActiveTripPlanEditor from "@/components/home/ActiveTripPlanEditor";
import { MapPin, Users, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { avatarSrc } from "@/lib/avatar";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useActiveSoloTrips } from "@/hooks/useActiveSoloTrips";
import { resolveStored } from "@/components/PlacePhoto";

// Wizualny kafelek trasy: do 3 mini-zdjec miejsc (+N), miasto, zakres dat. Zastepuje chipy.
function TripCard({ trip, active, onSelect }: { trip: any; active: boolean; onSelect: () => void }) {
  const pins = Array.isArray(trip.pins) ? trip.pins : [];
  const photos = pins.map((p: any) => resolveStored(p.photo_url)).filter(Boolean).slice(0, 3) as string[];
  const extra = Math.max(0, pins.length - 3);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "shrink-0 w-40 rounded-2xl border p-2 text-left transition-colors active:scale-[0.98]",
        active ? "border-orange-400 bg-orange-50/60" : "border-border/50 bg-card",
      )}
    >
      <div className="flex gap-1 mb-2">
        {photos.length > 0 ? photos.map((url, i) => (
          <img key={i} src={url} alt="" className="h-11 flex-1 min-w-0 rounded-lg object-cover bg-muted" loading="lazy" />
        )) : (
          <div className="h-11 w-full rounded-lg bg-muted flex items-center justify-center"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
        )}
        {extra > 0 && (
          <div className="h-11 flex-1 min-w-0 rounded-lg bg-foreground/85 text-background text-[11px] font-bold flex items-center justify-center">+{extra}</div>
        )}
      </div>
      <p className="text-sm font-display font-extrabold leading-tight truncate px-0.5">{trip.city || trip.title || "Trasa"}</p>
      {fmtRange(trip._dateMin, trip._dateMax) && <p className="text-[11px] text-muted-foreground mt-0.5 truncate px-0.5">{fmtRange(trip._dateMin, trip._dateMax)}</p>}
    </button>
  );
}

// Ekran glowny = dashboard "Aktywne": aktywne trasy solo (pelny edytor planu jak w Dzienniku
// - ActiveTripPlanEditor: Lista/Szczegoly, reorder, usuwanie, notki, dodawanie, wizytowka) +
// aktywne trasy grupowe. Gdy brak -> puste stany. Swiper jest pod guzikiem "+" (FAB w BottomNav).

const fmtDate = (d?: string | null) =>
  d && isValid(parseISO(d)) ? format(parseISO(d), "d MMMM yyyy", { locale: pl }) : null;
const fmtShort = (d?: string | null) =>
  d && isValid(parseISO(d)) ? format(parseISO(d), "d MMM", { locale: pl }) : null;
// Zakres dat trasy (wielodniowa) - "26 cze – 27 cze 2026"; jednodniowa -> pelna data.
const fmtRange = (min?: string | null, max?: string | null) => {
  if (!min || !isValid(parseISO(min))) return null;
  if (!max || min === max || !isValid(parseISO(max))) return fmtDate(min);
  return `${format(parseISO(min), "d MMM", { locale: pl })} – ${format(parseISO(max), "d MMM yyyy", { locale: pl })}`;
};

// Sekcja w stylu "koncept": ikona w zaokraglonym kwadracie (lewy gorny rog), tekst do
// lewej, jasno-pomaranczowe tlo. Solo vs grupowe roznia sie odcieniem - solo bardzo jasny
// orange, grupowe cieplejszy/peachy (oba w rodzinie B2C pomaranczowej).
function EmptySection({ icon, title, sub, cta, onCta, cta2, onCta2, variant }: {
  icon: React.ReactNode; title: string; sub: string; variant: "solo" | "group";
  cta?: string; onCta?: () => void; cta2?: string; onCta2?: () => void;
}) {
  const tone = variant === "group"
    ? "bg-[#FFEAD9] border-orange-200/70"   // grupowe - cieplejszy peach
    : "bg-orange-50 border-orange-100";      // solo - bardzo jasny orange
  return (
    <div className={cn("rounded-3xl border p-5", tone)}>
      <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">{icon}</div>
      <p className="text-base font-display font-extrabold leading-tight">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[300px]">{sub}</p>
      {(cta || cta2) && (
        <div className="flex flex-col gap-2 mt-4">
          {cta && onCta && (
            <button onClick={onCta} className="px-5 py-3 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20">{cta}</button>
          )}
          {cta2 && onCta2 && (
            <button onClick={onCta2} className="px-5 py-2.5 rounded-full bg-white border border-orange-200 text-orange-600 text-sm font-bold active:scale-[0.97] transition-transform">{cta2}</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActiveTripsDashboard({ userId }: { userId: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSoloId, setSelectedSoloId] = useState<string | null>(null);

  // Usuniecie aktywnej trasy z home (z potwierdzeniem). Czysci piny + chat_sessions + route.
  const handleDelete = async (e: React.MouseEvent, r: any) => {
    e.stopPropagation();
    const name = r.city || r.title || "Trasa";
    if (!confirm(`Usunąć trasę "${name}"? Tego nie można cofnąć.`)) return;
    setDeletingId(r.id);
    try {
      await supabase.from("pins").delete().eq("route_id", r.id);
      await (supabase as any).from("chat_sessions").delete().eq("route_id", r.id);
      const { error } = await supabase.from("routes").delete().eq("id", r.id);
      if (error) throw error;
      notify.success("Trasa usunięta");
      queryClient.setQueryData(["home-active-solo", userId], (old: any) =>
        (old ?? []).filter((x: any) => x.id !== r.id),
      );
      queryClient.invalidateQueries({ queryKey: ["home-active-solo"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    } catch (err: any) {
      console.error("[ActiveTripsDashboard] delete failed:", err?.message ?? err);
      notify.error("Nie udało się usunąć trasy");
    }
    setDeletingId(null);
  };

  // Aktywne trasy SOLO (wlasne, planning/ongoing, bez grupy).
  const { data: soloRoutes = [], isLoading: soloLoading } = useActiveSoloTrips(userId);

  // Auto-archiwizacja: trasy ktorych OSTATNI dzien juz minal (data < dzis) nie sa "aktywne".
  // Przenosimy je do Dziennika (trip_type=completed) - znikaja z "Aktywne trasy", laduja jako
  // wspomnienia. Inaczej stara niedokonczona trasa (np. minionym 'ongoing') wisi w aktywnych.
  const archivingPast = useRef(false);
  useEffect(() => {
    if (!userId || archivingPast.current || !soloRoutes.length) return;
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    const past = (soloRoutes as any[]).filter((r) => r._dateMax && r._dateMax < todayStr);
    if (!past.length) return;
    archivingPast.current = true;
    void (async () => {
      try {
        for (const r of past) {
          const upd = (supabase as any).from("routes").update({ trip_type: "completed", plan_finalized: true });
          await (r.folder_id ? upd.eq("folder_id", r.folder_id) : upd.eq("id", r.id));
        }
        queryClient.removeQueries({ queryKey: ["home-active-solo", userId] });
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
      } finally {
        archivingPast.current = false;
      }
    })();
  }, [soloRoutes, userId, queryClient]);

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

  // Awatary uczestnikow per sesja grupowa (do stacka awatarow na karcie).
  const groupIds = groupSessions.map((s: any) => s.id);
  const { data: memberAvatars = {} } = useQuery({
    queryKey: ["home-group-members", groupIds.join(",")],
    queryFn: async () => {
      if (!groupIds.length) return {} as Record<string, { avatar_url: string | null; name: string }[]>;
      const { data: members } = await (supabase as any)
        .from("group_session_members").select("session_id, user_id").in("session_id", groupIds);
      if (!members?.length) return {};
      const uids = [...new Set(members.map((m: any) => m.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles").select("id, avatar_url, username, first_name").in("id", uids);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const map: Record<string, { avatar_url: string | null; name: string }[]> = {};
      for (const m of members) {
        const p: any = pmap.get(m.user_id);
        (map[m.session_id] ??= []).push({ avatar_url: p?.avatar_url ?? null, name: p?.first_name || p?.username || "?" });
      }
      return map;
    },
    enabled: groupIds.length > 0,
  });

  return (
    <div className={cn(
      "flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4",
      // Aktywna trasa solo => przyklejony dolny pasek statusu dnia (~4rem nad BottomNav),
      // wiec wiekszy pb zeby ostatnia sekcja (grupowa) nie chowala sie pod paskiem.
      soloRoutes.length > 0
        ? "pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))]"
        : "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]",
    )}>
      {/* Aktywne trasy (solo) */}
      <section className="mb-6">
        <p className="text-sm font-bold mb-2.5 px-1">Aktywne trasy</p>
        {soloLoading ? (
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
        ) : soloRoutes.length > 0 ? (
          (() => {
            const selected = soloRoutes.find((r) => r.id === selectedSoloId) ?? soloRoutes[0];
            return (
              <>
                {/* Wizualne kafelki tras (mini-zdjecia) - gdy user ma kilka aktywnych. */}
                {soloRoutes.length > 1 && (
                  <div className="flex gap-2.5 overflow-x-auto scrollbar-none -mx-4 px-4 mb-4 pb-1">
                    {soloRoutes.map((r) => (
                      <TripCard key={r.id} trip={r} active={r.id === selected.id} onSelect={() => setSelectedSoloId(r.id)} />
                    ))}
                  </div>
                )}
                <div key={selected.id}>
                  <div className="pb-2.5 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl font-display font-extrabold leading-tight truncate">{selected.city || selected.title || "Trasa"}</p>
                      {fmtRange(selected._dateMin, selected._dateMax) && <p className="text-xs text-muted-foreground mt-0.5">{fmtRange(selected._dateMin, selected._dateMax)}</p>}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, selected)}
                      disabled={deletingId === selected.id}
                      aria-label="Usuń trasę"
                      className="shrink-0 mb-0.5 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 disabled:opacity-50"
                    >
                      {deletingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <ActiveTripPlanEditor routeId={selected.id} flush />
                </div>
              </>
            );
          })()
        ) : (
          <EmptySection
            variant="solo"
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
          <div className="space-y-3">
            {groupSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/sesja/${s.join_code}`)}
                className="w-full text-left active:scale-[0.99] transition-transform"
              >
                {/* Naglowek 1:1 jak solo: duzy tytul Baloo + meta, floating (bez ramki) */}
                <div className="pb-2 flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-display font-extrabold leading-tight truncate">{s.name || s.city || "Sesja grupowa"}</p>
                    {(s.city || fmtDate(s.trip_date)) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.city}{fmtDate(s.trip_date) ? ` · ${fmtDate(s.trip_date)}` : ""}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mb-1" />
                </div>
                {/* Awatary uczestnikow + liczba osob */}
                {(() => {
                  const avs = (memberAvatars as Record<string, { avatar_url: string | null; name: string }[]>)[s.id] ?? [];
                  if (avs.length === 0) {
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5 text-orange-600" />
                        </div>
                        <span className="text-xs text-muted-foreground">Sesja grupowa</span>
                      </div>
                    );
                  }
                  const shown = avs.slice(0, 3);
                  const extra = avs.length - shown.length;
                  const n = avs.length;
                  const label = n === 1 ? "osoba" : n < 5 ? "osoby" : "osób";
                  return (
                    <div className="flex items-center gap-2.5">
                      <div className="flex -space-x-2.5 shrink-0">
                        {shown.map((a, i) => (
                          <div key={i} className="h-9 w-9 rounded-full border-2 border-background overflow-hidden bg-orange-100" style={{ zIndex: 3 - i }}>
                            <img src={avatarSrc(a.avatar_url)} alt={a.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {extra > 0 && (
                          <div className="h-9 w-9 rounded-full border-2 border-background bg-foreground/85 text-background text-[11px] font-bold flex items-center justify-center" style={{ zIndex: 0 }}>
                            +{extra}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{n} {label}</span>
                    </div>
                  );
                })()}
              </button>
            ))}
          </div>
        ) : (
          <EmptySection
            variant="group"
            icon={<Users className="h-6 w-6 text-orange-600" />}
            title="Brak aktywnych tras grupowych"
            sub="Zaplanuj coś wspólnie guzikiem + na dole."
          />
        )}
      </section>
    </div>
  );
}
