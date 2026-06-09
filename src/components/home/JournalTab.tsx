import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { format, parseISO, isValid, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Globe, Lock, Loader2, Trash2, MapPin, Users, Link2, X, ArrowRight, ChevronRight, CheckCircle, CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

interface JournalTabProps {
  userId: string;
  activeSessions?: any[];
  sessionRoutes?: any[];
}

type JournalTabKey = "active" | "postcards";

const JournalTab = ({ userId, activeSessions = [], sessionRoutes = [] }: JournalTabProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JournalTabKey>("active");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      // Own routes (all statuses)
      const { data: ownRoutes } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, end_date, folder_id, ai_summary, ai_highlight, review_photos, is_shared, overall_rating, new_for_users, chat_status")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      // Group routes created by others that user is a member of
      const { data: memberRows } = await (supabase as any)
        .from("group_session_members")
        .select("session_id")
        .eq("user_id", userId);

      let groupRoutes: any[] = [];
      if (memberRows?.length) {
        const sessionIds = memberRows.map((m: any) => m.session_id);
        const { data } = await (supabase as any)
          .from("routes")
          .select("id, title, city, day_number, start_date, end_date, folder_id, ai_summary, ai_highlight, review_photos, new_for_users, chat_status, group_session_id")
          .in("group_session_id", sessionIds)
          .neq("user_id", userId)
          .order("updated_at", { ascending: false });
        groupRoutes = data || [];
      }

      return [
        ...(ownRoutes ?? []).map((r: any) => ({ ...r, is_own: true })),
        ...groupRoutes.map((r: any) => ({ ...r, is_own: false })),
      ] as any[];
    },
    enabled: !!userId,
  });

  // Kategorie miejsc per route (do tagow na kafelku - 3 glowne poczatkowe).
  const entryIds = useMemo(() => entries.map((e: any) => e.id), [entries]);
  const { data: catMap = {} } = useQuery({
    queryKey: ["journal-pin-cats", entryIds.join(",")],
    queryFn: async () => {
      if (!entryIds.length) return {};
      const { data } = await (supabase as any)
        .from("pins")
        .select("route_id, category, pin_order")
        .in("route_id", entryIds)
        .order("pin_order", { ascending: true });
      const map: Record<string, string[]> = {};
      for (const p of data ?? []) {
        if (!p.category) continue;
        (map[p.route_id] ??= []).push(p.category);
      }
      return map;
    },
    enabled: entryIds.length > 0,
  });

  // 3 glowne (pierwsze, unikalne) kategorie z pinow danych route'ow.
  const topCategories = (routeIds: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const rid of routeIds) {
      for (const c of (catMap as Record<string, string[]>)[rid] ?? []) {
        if (!seen.has(c)) { seen.add(c); out.push(c); }
        if (out.length >= 3) return out;
      }
    }
    return out;
  };

  // Grupuj trasy wielodniowe (folder_id) w JEDNA pocztowke (dzien 1 = reprezentant).
  // Granica aktywny/wspomnienie liczona po OSTATNIM dniu trasy (end_date ?? start_date).
  // Trasa jednodniowa = osobny wpis, granica po end_date ?? start_date.
  const { active, postcards } = useMemo(() => {
    const folderMap = new Map<string, any[]>();
    const collapsed: any[] = [];
    for (const e of entries) {
      if (e.folder_id) {
        if (!folderMap.has(e.folder_id)) folderMap.set(e.folder_id, []);
        folderMap.get(e.folder_id)!.push(e);
      } else {
        collapsed.push({ ...e, _numDays: 1, _lastDate: e.end_date ?? e.start_date, _categories: topCategories([e.id]) });
      }
    }
    for (const days of folderMap.values()) {
      const sorted = [...days].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
      const rep = sorted[0];
      const last = sorted[sorted.length - 1];
      collapsed.push({
        ...rep,
        // dla trasy wielodniowej naglowek = miasto (bez "Dzień 1"); chip "N dni"
        title: sorted.length > 1 ? null : rep.title,
        review_photos: sorted.flatMap((d) => d.review_photos ?? []),
        _numDays: sorted.length,
        _lastDate: last.end_date ?? last.start_date,
        _categories: topCategories(sorted.map((d) => d.id)),
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active: any[] = [];
    const postcards: any[] = [];
    for (const e of collapsed) {
      const lastDate = e._lastDate ? parseISO(e._lastDate) : null;
      const isPast = lastDate && isValid(lastDate) && lastDate < today;
      if (isPast) postcards.push(e);
      else active.push(e);
    }
    active.sort((a, b) => {
      const aD = a.start_date ? parseISO(a.start_date).getTime() : Infinity;
      const bD = b.start_date ? parseISO(b.start_date).getTime() : Infinity;
      return aD - bD;
    });
    postcards.sort((a, b) => {
      const aD = a._lastDate ? parseISO(a._lastDate).getTime() : 0;
      const bD = b._lastDate ? parseISO(b._lastDate).getTime() : 0;
      return bD - aD;
    });
    return { active, postcards };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, catMap]);

  const visibleEntries = activeTab === "active" ? active : postcards;

  const handleDelete = async (e: React.MouseEvent, entry: any) => {
    e.stopPropagation();
    const confirmMsg = entry.is_own
      ? `Usunąć trasę "${entry.city}"? Tego nie można cofnąć.`
      : `Opuścić trasę "${entry.city}"? Wyjdziesz z sesji grupowej i stracisz dostęp.`;
    if (!confirm(confirmMsg)) return;
    setDeletingId(entry.id);
    try {
      if (entry.is_own) {
        await supabase.from("pins").delete().eq("route_id", entry.id);
        await (supabase as any).from("chat_sessions").delete().eq("route_id", entry.id);
        const { error } = await supabase.from("routes").delete().eq("id", entry.id);
        if (error) throw error;
        toast.success("Trasa usunięta");
      } else {
        if (!entry.group_session_id) throw new Error("missing group_session_id");
        // count: 'exact' zeby wykryc silent RLS fail (DELETE zwraca success ale 0 rows
        // gdy nie ma policy). Wczesniej brak DELETE policy na group_session_members
        // powodowal ze user nie mogl opuscic trasy - DB nie blokowala explicit.
        // Migracja 20260604_gsm_delete_policy.sql dodaje policy.
        const { error, count } = await (supabase as any)
          .from("group_session_members")
          .delete({ count: "exact" })
          .eq("session_id", entry.group_session_id)
          .eq("user_id", userId);
        if (error) throw error;
        if (count === 0) {
          throw new Error("Brak uprawnień do opuszczenia trasy. Spróbuj ponownie po wklejeniu SQL z RLS policy.");
        }
        toast.success("Opuszczono trasę");
      }
      // Optymistyczne usuniecie z cache + invalidate zeby trasa zniknela natychmiast
      queryClient.setQueryData(["journal-entries", userId], (old: any) =>
        (old ?? []).filter((e: any) => e.id !== entry.id)
      );
      queryClient.invalidateQueries({ queryKey: ["journal-entries", userId] });
      queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
    } catch (err: any) {
      console.error("[JournalTab] delete/leave failed:", err);
      const msg = err?.message ?? "Nieznany błąd";
      toast.error("Nie udało się", { description: msg });
    }
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Ładowanie...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-24 text-center">
        <div className="w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <div className="space-y-2">
          <p className="text-xl font-bold tracking-tight">Twoja pierwsza trasa jest na wyciągnięcie palca</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            Wybierz datę, opcjonalnie zaproś znajomego, a resztę zrobicie razem przeglądając miejsca.
          </p>
        </div>
        <button
          onClick={() => navigate("/sesja/nowa", { state: { from: "journal" } })}
          className="px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Sparkles className="h-4 w-4" />
          Zaplanuj swoją pierwszą trasę
        </button>
      </div>
    );
  }

  const TABS: { id: JournalTabKey; label: string; count: number }[] = [
    { id: "active", label: "Aktywne", count: active.length },
    { id: "postcards", label: "Wspomnienia", count: postcards.length },
  ];

  return (
    <div className="space-y-3 pb-2">
      {/* Tabs - tekstowe (jak "Recent items" / "Saved"), bez pillsow i chipow */}
      <div className="flex items-baseline gap-5 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-baseline gap-1.5 transition-colors",
              activeTab === tab.id ? "text-foreground" : "text-muted-foreground/40"
            )}
          >
            <span className="text-xl font-extrabold tracking-tight">{tab.label}</span>
            {tab.count > 0 && (
              <span className="text-xs font-semibold">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Atrakcyjny hero baner CTA - tylko w Aktywne tabie.
          Tap otwiera menu nad orba "+" (te same opcje: solo / grupa / kod). */}
      {activeTab === "active" && (
        <button
          onClick={() => window.dispatchEvent(new Event("trasa:open-plan-menu"))}
          className="w-full relative overflow-hidden rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
          style={{ background: "linear-gradient(135deg, #FDBA74 0%, #FB923C 100%)" }}
        >
          <div className="relative px-4 py-3.5 flex items-center gap-3 text-left">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight text-white">
                Zaplanuj nową trasę
              </p>
              <p className="text-[11px] text-white/90 mt-0.5 leading-relaxed">
                Sam, z grupą znajomych, lub po kodzie zaproszenia
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-white shrink-0" />
          </div>
        </button>
      )}

      {/* Aktywne sesje grupowe - pocztowki (w zakladce Aktywne) */}
      {activeTab === "active" && activeSessions.length > 0 && (
        <div className="space-y-3">
          {activeSessions.map((s: any) => {
            const tripDateObj = s.trip_date ? parseISO(s.trip_date) : null;
            const dateLabel = tripDateObj && isValid(tripDateObj) ? format(tripDateObj, "d MMM", { locale: pl }) : null;
            const createdObj = s.created_at ? parseISO(s.created_at) : null;
            const agoLabel = createdObj && isValid(createdObj) ? formatDistanceToNow(createdObj, { addSuffix: true, locale: pl }) : null;
            const hasRoute = sessionRoutes.some((r: any) => r.group_session_id === s.id);
            const thumb = getRandomPinPlaceholder(s.id);
            return (
              <button key={s.id} onClick={() => navigate(`/sesja/${s.join_code}`)}
                className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform">
                <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[11px] font-semibold">
                    <Users className="h-3 w-3" /> Sesja grupowa
                  </div>
                  <div className="absolute top-3 right-3">
                    {hasRoute
                      ? <div className="bg-emerald-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1"><CheckCircle className="h-3 w-3" />Trasa gotowa</div>
                      : <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">Aktywna</div>
                    }
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <p className="text-white font-bold text-lg leading-tight drop-shadow-sm truncate">{s.name || s.city}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {dateLabel && <span className="flex items-center gap-1 text-white/80 text-xs"><CalendarDays className="h-3 w-3" />{dateLabel}</span>}
                      {agoLabel && !dateLabel && <span className="text-white/70 text-xs">{agoLabel}</span>}
                      <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded text-white/90">#{s.join_code}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state per tab */}
      {visibleEntries.length === 0 && !(activeTab === "active" && activeSessions.length > 0) && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {activeTab === "active" && "Brak aktywnych tras i sesji"}
          {activeTab === "postcards" && "Brak wspomnień z minionych podróży"}
        </div>
      )}

      {/* Lista tras - kafelek: miniatura + duza nazwa + data/miasto + tagi + strzalka */}
      {visibleEntries.map((entry) => {
        const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
        const thumb = validPhotos[0] ?? getRandomPinPlaceholder(entry.id);
        const _d = entry.start_date ? parseISO(entry.start_date) : null;
        const dateLabel = _d && isValid(_d) ? format(_d, "d MMM yyyy", { locale: pl }) : "";
        const isNew = entry.new_for_users?.includes(userId);
        const displayName = entry.title || entry.city || "Podróż";
        const showCity = entry.city && entry.city !== displayName;
        const cats: string[] = entry._categories ?? [];
        const canDelete = entry.is_own || entry.group_session_id;

        return (
          <div
            key={entry.id}
            onClick={async () => {
              // Optymistycznie ukryj badge "Nowa trasa!" - update cache zanim nawiguje.
              if (isNew) {
                queryClient.setQueryData(["journal-entries", userId], (old: any) =>
                  (old ?? []).map((e: any) => e.id === entry.id
                    ? { ...e, new_for_users: (e.new_for_users ?? []).filter((u: string) => u !== userId) }
                    : e
                  )
                );
                void supabase.rpc("dismiss_route_badge", { p_route_id: entry.id });
                queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
              }
              navigate(`/review-summary?route=${entry.id}`);
            }}
            className="relative w-full rounded-3xl bg-muted/50 p-3 text-left active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {/* Miniatura */}
              <div className="relative h-[76px] w-[76px] rounded-2xl overflow-hidden bg-muted shrink-0">
                <img
                  src={thumb}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fallback"); }}
                />
                {isNew && <span className="absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />}
              </div>

              {/* Tresc */}
              <div className="min-w-0 flex-1 pr-8">
                <p className="text-[17px] font-bold leading-tight line-clamp-2 text-foreground">
                  {displayName}
                </p>
                <div className="flex items-center gap-x-3 gap-y-0.5 mt-1 flex-wrap text-[11px] text-muted-foreground">
                  {dateLabel && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{dateLabel}</span>}
                  {showCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.city}</span>}
                  {entry._numDays > 1 && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{entry._numDays} dni</span>}
                </div>
                {cats.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {cats.map((c) => (
                      <span key={c} className="text-[10px] font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5 border border-border/40">
                        {CATEGORY_LABEL[c] ?? c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Strzalka w koleczku (top-right) */}
            <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background flex items-center justify-center shadow-sm">
              <ChevronRight className="h-4 w-4 text-foreground/70" />
            </div>

            {/* Usun / opusc (subtelny, bottom-right) */}
            {canDelete && (
              <button
                onClick={(e) => handleDelete(e, entry)}
                disabled={deletingId === entry.id}
                className="absolute bottom-3 right-3 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50"
                aria-label={entry.is_own ? "Usuń trasę" : "Opuść trasę"}
              >
                {deletingId === entry.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />
                }
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default JournalTab;
