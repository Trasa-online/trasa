import { useState } from "react";
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

// Ekran glowny = dashboard "Aktywne": aktywne trasy solo (pelny edytor planu jak w Dzienniku
// - ActiveTripPlanEditor: Lista/Szczegoly, reorder, usuwanie, notki, dodawanie, wizytowka) +
// aktywne trasy grupowe. Gdy brak -> puste stany. Swiper jest pod guzikiem "+" (FAB w BottomNav).

const fmtDate = (d?: string | null) =>
  d && isValid(parseISO(d)) ? format(parseISO(d), "d MMMM yyyy", { locale: pl }) : null;

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
      <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3.5">{icon}</div>
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
      // Tylko NAJBARDZIEJ AKTUALNA aktywna trasa solo (jedna). Reszta jest dostepna
      // w "Szczegoly" / historii - home pokazuje to, czym user zyje teraz.
      return ((data as any[]) || []).filter((r) => !r.group_session_id).slice(0, 1);
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
    <div className="flex-1 overflow-y-auto px-4 pt-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Aktywne trasy (solo) */}
      <section className="mb-6">
        <p className="text-sm font-bold mb-2.5 px-1">Aktywne trasy</p>
        {soloLoading ? (
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
        ) : soloRoutes.length > 0 ? (
          <div className="space-y-3">
            {soloRoutes.map((r) => (
              <div key={r.id}>
                <div className="pb-2.5 flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-display font-extrabold leading-tight truncate">{r.city || r.title || "Trasa"}</p>
                    {fmtDate(r.start_date) && <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(r.start_date)}</p>}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, r)}
                    disabled={deletingId === r.id}
                    aria-label="Usuń trasę"
                    className="shrink-0 mb-0.5 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90 disabled:opacity-50"
                  >
                    {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
                <ActiveTripPlanEditor routeId={r.id} flush />
              </div>
            ))}
          </div>
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
