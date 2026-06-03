import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { Globe, Lock, Loader2, Sparkles, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JournalTabProps {
  userId: string;
}

type JournalTabKey = "active" | "postcards";

const JournalTab = ({ userId }: JournalTabProps) => {
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
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, is_shared, overall_rating, new_for_users, chat_status")
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
          .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, new_for_users, chat_status, group_session_id")
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

  // Kategoryzuj entries: Aktywne (start_date >= today albo null) vs Pocztowki (start_date < today).
  // Aktywne sortowane asc (najblizsze na gorze), pocztowki desc (najnowsze ukonczone na gorze).
  const { active, postcards } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active: any[] = [];
    const postcards: any[] = [];
    for (const e of entries) {
      const startDate = e.start_date ? parseISO(e.start_date) : null;
      const isPast = startDate && isValid(startDate) && startDate < today;
      if (isPast) postcards.push(e);
      else active.push(e);
    }
    active.sort((a, b) => {
      const aD = a.start_date ? parseISO(a.start_date).getTime() : Infinity;
      const bD = b.start_date ? parseISO(b.start_date).getTime() : Infinity;
      return aD - bD;
    });
    postcards.sort((a, b) => {
      const aD = a.start_date ? parseISO(a.start_date).getTime() : 0;
      const bD = b.start_date ? parseISO(b.start_date).getTime() : 0;
      return bD - aD;
    });
    return { active, postcards };
  }, [entries]);

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
    { id: "active", label: "Dzisiaj", count: active.length },
    { id: "postcards", label: "Pocztówki", count: postcards.length },
  ];

  return (
    <div className="space-y-3 pb-2">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5",
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "bg-card border border-border/50 text-muted-foreground"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "text-[10px] font-bold rounded-full px-1.5 py-0.5",
                activeTab === tab.id ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CTA tylko w Aktywnych - na jutro rozbudowa do atrakcyjniejszego banera (TODO) */}
      {activeTab === "active" && (
        <button
          onClick={() => navigate("/sesja/nowa", { state: { from: "journal" } })}
          className="w-full flex items-center gap-3 p-3.5 rounded-3xl bg-card border border-border/50 active:scale-[0.98] transition-transform"
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-bold leading-tight">Zaplanuj kolejną trasę</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wybierz datę i miasto · Możesz zaprosić znajomych</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}

      {/* Empty state per tab */}
      {visibleEntries.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {activeTab === "active" && "Brak tras na dziś"}
          {activeTab === "postcards" && "Brak pocztówek z minionych podróży"}
        </div>
      )}

      {/* Lista tras */}
      {visibleEntries.map((entry) => {
        const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
        const thumb = validPhotos[0] ?? getRandomPinPlaceholder(entry.id);
        const _d = entry.start_date ? parseISO(entry.start_date) : null;
        const dateLabel = _d && isValid(_d) ? format(_d, "d MMMM yyyy", { locale: pl }) : "";
        const hasUserPhoto = validPhotos.length > 0;

        return (
          <div
            key={entry.id}
            onClick={async () => {
              // Optymistycznie ukryj badge "Nowa trasa!" - update cache zanim nawiguje.
              if (entry.new_for_users?.includes(userId)) {
                queryClient.setQueryData(["journal-entries", userId], (old: any) =>
                  (old ?? []).map((e: any) => e.id === entry.id
                    ? { ...e, new_for_users: (e.new_for_users ?? []).filter((u: string) => u !== userId) }
                    : e
                  )
                );
                void supabase.rpc("dismiss_route_badge", { p_route_id: entry.id });
                queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
              }
              // Trasy 'Dzisiaj' (start_date today albo null) -> in-trip view z mapa + checkboxami.
              // Pocztowki (start_date < today) -> review-summary (rating + photos).
              if (activeTab === "active") {
                navigate(`/trasa/${entry.id}`);
              } else {
                navigate(`/review-summary?route=${entry.id}`);
              }
            }}
            className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform cursor-pointer"
          >
            {/* Cover photo */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
              <img
                src={thumb}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fallback"); }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">
                  {entry.city || "Podróż"}
                  {entry.day_number ? <span className="font-normal text-white/80"> · Dzień {entry.day_number}</span> : ""}
                </p>
                {dateLabel && (
                  <p className="text-white/70 text-xs mt-0.5">{dateLabel}</p>
                )}
                {entry.overall_rating && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({length: entry.overall_rating}).map((_,i) => (
                      <span key={i} className="text-[10px]">⭐</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                {entry.is_shared === false
                  ? <Lock className="h-3 w-3 text-white/80" />
                  : <Globe className="h-3 w-3 text-white/80" />
                }
              </div>
              {/* Top-right: badges + delete (kosz) */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {entry.new_for_users?.includes(userId) && (
                  <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Nowa trasa!
                  </div>
                )}
                {hasUserPhoto && (
                  <div className="bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white/90">
                    📷 Twoje zdjęcie
                  </div>
                )}
                {(entry.is_own || entry.group_session_id) && (
                  <button
                    onClick={(e) => handleDelete(e, entry)}
                    disabled={deletingId === entry.id}
                    className="h-7 w-7 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-white hover:bg-black/60 transition-colors disabled:opacity-50"
                    aria-label={entry.is_own ? "Usuń trasę" : "Opuść trasę"}
                  >
                    {deletingId === entry.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Text below photo */}
            {(entry.ai_highlight || entry.ai_summary) && (
              <div className="px-4 py-3">
                {entry.ai_highlight && (
                  <p className="text-sm text-foreground/80 italic leading-snug mb-1.5">
                    "{entry.ai_highlight}"
                  </p>
                )}
                {entry.ai_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {entry.ai_summary}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default JournalTab;
