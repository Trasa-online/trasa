import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ActiveTripPlanEditor from "@/components/home/ActiveTripPlanEditor";
import { MapPin, Users, ChevronRight, ChevronDown, Trash2, Loader2, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { avatarSrc } from "@/lib/avatar";
import { notify } from "@/lib/notify";
import { deferDelete } from "@/lib/deferDelete";
import { cn } from "@/lib/utils";
import { useActiveSoloTrips } from "@/hooks/useActiveSoloTrips";
import { getDrafts, removeDraft, type DraftRoute } from "@/lib/draftRoutes";
import { resolveStored } from "@/components/PlacePhoto";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Compass } from "lucide-react";
import InviteFriendsBanner from "@/components/social/InviteFriendsBanner";

// Niski chip trasy: nazwa miasta + male okragle miniaturki miejsc obok (overlap +N).
// Tylko kolor secondary (bez pomaranczu); aktywny = subtelny ciemny border, nieaktywny = przezroczysty.
function TripCard({ trip, active, onSelect }: { trip: any; active: boolean; onSelect: () => void }) {
  const pins = Array.isArray(trip.pins) ? trip.pins : [];
  const photos = pins.map((p: any) => resolveStored(p.photo_url)).filter(Boolean).slice(0, 4) as string[];
  const extra = Math.max(0, pins.length - photos.length);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "shrink-0 flex items-center gap-2.5 rounded-full bg-secondary border-2 px-3 py-1.5 transition-colors active:scale-[0.97]",
        active ? "border-foreground/30" : "border-transparent",
      )}
    >
      <span className="text-sm font-display font-extrabold leading-none truncate max-w-[120px]">{trip.city || trip.title || "Trasa"}</span>
      <div className="flex -space-x-2 shrink-0">
        {photos.length > 0 ? photos.map((url, i) => (
          <img key={i} src={url} alt="" className="h-6 w-6 rounded-full object-cover bg-muted border-2 border-secondary" style={{ zIndex: photos.length - i }} loading="lazy" />
        )) : (
          <div className="h-6 w-6 rounded-full bg-muted border-2 border-secondary flex items-center justify-center"><MapPin className="h-3 w-3 text-muted-foreground" /></div>
        )}
        {extra > 0 && (
          <div className="h-6 w-6 rounded-full bg-foreground/80 text-background text-[9px] font-bold flex items-center justify-center border-2 border-secondary" style={{ zIndex: 0 }}>+{extra}</div>
        )}
      </div>
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
  const [planChoiceOpen, setPlanChoiceOpen] = useState(false);
  // Sekcja grupowych sesji "w toku": accordion (chowanie) + usuwanie pojedynczych sesji.
  const [groupOpen, setGroupOpen] = useState(true);
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(new Set());

  // Usuniecie aktywnej trasy z home: optymistycznie znika z listy, faktyczny delete
  // (piny + chat_sessions + route) ODROCZONY o okno "Cofnij" (5s). Undo przywraca liste.
  const handleDelete = (e: React.MouseEvent, r: any) => {
    e.stopPropagation();
    const name = r.city || r.title || "Trasa";
    const prev = queryClient.getQueryData(["home-active-solo", userId]);
    queryClient.setQueryData(["home-active-solo", userId], (old: any) =>
      (old ?? []).filter((x: any) => x.id !== r.id),
    );
    deferDelete({
      message: `Trasa „${name}" usunięta`,
      onUndo: () => queryClient.setQueryData(["home-active-solo", userId], prev),
      commit: async () => {
        try {
          await supabase.from("pins").delete().eq("route_id", r.id);
          await (supabase as any).from("chat_sessions").delete().eq("route_id", r.id);
          const { error } = await supabase.from("routes").delete().eq("id", r.id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["home-active-solo"] });
          queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        } catch (err: any) {
          console.error("[ActiveTripsDashboard] delete failed:", err?.message ?? err);
          notify.error("Nie udało się usunąć trasy");
          queryClient.invalidateQueries({ queryKey: ["home-active-solo"] });
        }
      },
    });
  };

  // Usuniecie grupowej sesji "w toku" z home. Optymistycznie chowamy lokalnie (zawsze znika
  // z widoku), a delete jest best-effort (RLS group_sessions: usuwa tworca; uczestnik zostaje
  // ukryty lokalnie). Invalidacja odswieza liste.
  const handleDeleteSession = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    // Optymistycznie ukryj; commit (DB delete) odroczony o okno "Cofnij".
    setHiddenSessionIds((prev) => new Set(prev).add(s.id));
    deferDelete({
      message: "Sesja usunięta",
      onUndo: () => setHiddenSessionIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; }),
      commit: async () => {
        try { await (supabase as any).from("group_sessions").delete().eq("id", s.id); }
        catch (err: any) { console.error("[ActiveTripsDashboard] delete session failed:", err?.message ?? err); }
        queryClient.invalidateQueries({ queryKey: ["home-group-sessions"] });
      },
    });
  };

  // Trasy robocze (drafty z localStorage) - niedokonczone planowanie do dokonczenia.
  const [drafts, setDrafts] = useState<DraftRoute[]>([]);
  useEffect(() => { setDrafts(getDrafts()); }, []);

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
  const { data: groupSessions = [] } = useQuery({
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
  // Sesje widoczne (bez lokalnie ukrytych/usunietych).
  const visibleGroupSessions = groupSessions.filter((s: any) => !hiddenSessionIds.has(s.id));
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

  // Awatary uczestnikow dla AKTYWNYCH TRAS (host trasy grupowej) - rozroznienie solo vs grupowa.
  const soloGroupSessionIds = useMemo(
    () => [...new Set((soloRoutes as any[]).map((r) => r.group_session_id).filter(Boolean))] as string[],
    [soloRoutes],
  );
  const { data: tripMemberAvatars = {} } = useQuery({
    queryKey: ["home-active-trip-members", soloGroupSessionIds.join(",")],
    enabled: soloGroupSessionIds.length > 0,
    queryFn: async () => {
      const { data: members } = await (supabase as any)
        .from("group_session_members").select("session_id, user_id").in("session_id", soloGroupSessionIds);
      if (!members?.length) return {} as Record<string, { avatar_url: string | null; name: string }[]>;
      const uids = [...new Set(members.map((m: any) => m.user_id))];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, avatar_url, username, first_name").in("id", uids);
      const pmap: Record<string, any> = {};
      for (const p of profs ?? []) pmap[p.id] = p;
      const out: Record<string, { avatar_url: string | null; name: string }[]> = {};
      for (const m of members) {
        (out[m.session_id] ??= []).push({
          avatar_url: pmap[m.user_id]?.avatar_url ?? null,
          name: pmap[m.user_id]?.first_name ?? pmap[m.user_id]?.username ?? "?",
        });
      }
      return out;
    },
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
          // Skeleton w ksztalcie realnej karty aktywnej trasy: tytul+data, potem karta z obrazem.
          <div className="space-y-3">
            <div className="space-y-2 pb-0.5">
              <div className="h-6 w-40 rounded-lg bg-muted/50 animate-pulse" />
              <div className="h-3 w-28 rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="rounded-3xl border border-border/40 overflow-hidden bg-card">
              <div className="h-40 bg-muted/50 animate-pulse" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-24 rounded-full bg-muted/40 animate-pulse" />
                <div className="h-5 w-36 rounded bg-muted/50 animate-pulse" />
              </div>
            </div>
          </div>
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
                      {/* Miasto + data (bez etykiety "Trasa grupowa"). Awatary sa po PRAWEJ. */}
                      <div className="flex items-baseline gap-2 min-w-0">
                        <p className="text-2xl font-display font-extrabold leading-tight truncate">{selected.city || selected.title || "Trasa"}</p>
                        {fmtRange(selected._dateMin, selected._dateMax) && <p className="text-xs text-muted-foreground shrink-0">{fmtRange(selected._dateMin, selected._dateMax)}</p>}
                      </div>
                    </div>
                    {/* Awatary uczestnikow (trasa grupowa) - dosuniete do PRAWEJ strony naglowka. */}
                    {selected.group_session_id && (() => {
                      const avs = (tripMemberAvatars as Record<string, { avatar_url: string | null; name: string }[]>)[selected.group_session_id] ?? [];
                      if (avs.length === 0) return null;
                      return (
                        <div className="flex -space-x-2 shrink-0 mb-0.5">
                          {avs.slice(0, 3).map((a, i) => (
                            <div key={i} className="h-7 w-7 rounded-full border-2 border-background overflow-hidden bg-orange-100" style={{ zIndex: 3 - i }}>
                              <img src={avatarSrc(a.avatar_url)} alt={a.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <ActiveTripPlanEditor
                    routeId={selected.id}
                    flush
                    onDelete={(e) => handleDelete(e, selected)}
                    deleting={deletingId === selected.id}
                  />
                </div>
              </>
            );
          })()
        ) : groupSessions.length === 0 ? (
          <EmptySection
            variant="solo"
            icon={<MapPin className="h-6 w-6 text-orange-600" />}
            title="Brak aktywnych tras"
            sub="Zaplanuj nową trasę albo po prostu przeglądaj miejsca dla inspiracji."
            cta="Zaplanuj trasę"
            onCta={() => setPlanChoiceOpen(true)}
            cta2="Przeglądaj miejsca"
            onCta2={() => navigate("/plan", { state: { exploreMode: true } })}
          />
        ) : null}

        {/* Sesje grupowe w toku (parowanie): accordion (chowanie) + usuwanie pojedynczych. */}
        {visibleGroupSessions.length > 0 && (
          <div className={soloRoutes.length > 0 ? "mt-7 space-y-3" : "space-y-3"}>
            <button
              onClick={() => setGroupOpen((o) => !o)}
              className="w-full flex items-center justify-between px-1 py-1 active:opacity-70 transition-opacity"
            >
              <p className="text-sm font-bold">Sesje grupowe ({visibleGroupSessions.length})</p>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${groupOpen ? "" : "-rotate-90"}`} />
            </button>
            {groupOpen && visibleGroupSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/sesja/${s.join_code}`)}
                className="w-full text-left active:scale-[0.98] transition-transform"
              >
                {/* Karta sesji grupowej (secondary) - spojna z pozostalymi kartami. */}
                <div className="rounded-2xl bg-secondary border border-border/40 shadow-sm p-4">
                <div className="pb-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-display font-extrabold leading-tight truncate">{s.name || s.city || "Sesja grupowa"}</p>
                    {(s.city || fmtDate(s.trip_date)) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.city}{fmtDate(s.trip_date) ? ` · ${fmtDate(s.trip_date)}` : ""}
                      </p>
                    )}
                  </div>
                  {/* Usuniecie sesji z home (chowa lokalnie + best-effort delete). */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDeleteSession(e, s)}
                    aria-label="Usuń sesję"
                    className="shrink-0 h-7 w-7 -mr-1 -mt-1 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </span>
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
                        <span className="text-xs text-orange-600 font-semibold">Wybieranie w toku</span>
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
                      <span className="text-xs text-muted-foreground">{n} {label} · <span className="text-orange-600 font-semibold">wybieranie w toku</span></span>
                    </div>
                  );
                })()}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trasy robocze (drafty) - niedokonczone planowanie, klik = dokoncz od swipera */}
      {drafts.length > 0 && (
        <section className="mb-6">
          <p className="text-sm font-bold mb-2.5 px-1">Trasy robocze</p>
          <div className="space-y-2.5">
            {drafts.map((d) => {
              const dateLabel = d.date && isValid(parseISO(d.date)) ? format(parseISO(d.date), "d MMM", { locale: pl }) : null;
              const n = d.likedPlaceNames.length;
              const placesLabel = `${n} ${n === 1 ? "miejsce" : n < 5 ? "miejsca" : "miejsc"}`;
              return (
                <button
                  key={d.city}
                  onClick={() => navigate("/plan", { state: { step: 4, city: d.city, date: d.date ?? undefined, numDays: d.numDays, startingLocation: d.startingLocation, likedPlaceNames: d.likedPlaceNames } })}
                  className="w-full flex items-center gap-3 rounded-2xl border border-border/40 bg-secondary shadow-sm p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Compass className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-extrabold text-sm leading-tight truncate">Dokończ trasę w&nbsp;{d.city}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{[dateLabel, placesLabel].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span
                    role="button"
                    aria-label="Usuń trasę roboczą"
                    onClick={(e) => { e.stopPropagation(); removeDraft(d.city); setDrafts(getDrafts()); }}
                    className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 active:scale-90 transition-transform"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-orange-600/50 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Viral: zaproszenie znajomych (link = auto-przyjazn) */}
      <InviteFriendsBanner className="mb-6" />

      {/* Wybor: solo vs grupowe (z empty state "Zaplanuj trasę") */}
      <Sheet open={planChoiceOpen} onOpenChange={setPlanChoiceOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] [&>button]:hidden">
          <p className="text-lg font-black mb-1">Jak chcesz zaplanować?</p>
          <p className="text-sm text-muted-foreground mb-5">Sam albo wspólnie ze znajomymi - Trasa ułoży plan z&nbsp;Waszych dopasowań.</p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => { setPlanChoiceOpen(false); navigate("/plan"); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 bg-card active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0"><MapPin className="h-5 w-5 text-orange-600" /></div>
              <div className="min-w-0">
                <p className="font-bold text-sm">Zaplanuj solo</p>
                <p className="text-xs text-muted-foreground">Sam przeglądasz miejsca i&nbsp;tworzysz trasę</p>
              </div>
            </button>
            <button
              onClick={() => { setPlanChoiceOpen(false); navigate("/sesja/nowa"); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 bg-card active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-orange-600" /></div>
              <div className="min-w-0">
                <p className="font-bold text-sm">Zaplanuj grupowo</p>
                <p className="text-xs text-muted-foreground">Zaproś znajomych i&nbsp;parujcie miejsca razem</p>
              </div>
            </button>
            <button
              onClick={() => { setPlanChoiceOpen(false); navigate("/plan", { state: { exploreMode: true } }); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 bg-card active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0"><Compass className="h-5 w-5 text-orange-600" /></div>
              <div className="min-w-0">
                <p className="font-bold text-sm">Tylko przeglądaj</p>
                <p className="text-xs text-muted-foreground">Zobacz miejsca bez tworzenia trasy</p>
              </div>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
