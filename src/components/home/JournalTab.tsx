import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { Globe, Lock, Loader2, Sparkles, ArrowRight, MoreVertical, EyeOff, Eye, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JournalTabProps {
  userId: string;
}

type JournalTabKey = "active" | "postcards" | "hidden";

const JournalTab = ({ userId }: JournalTabProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<JournalTabKey>("active");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Zamknij menu po kliknieciu poza
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      // Own routes (all statuses)
      const { data: ownRoutes } = await (supabase as any)
        .from("routes")
        .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, is_shared, overall_rating, new_for_users, hidden_for_users, chat_status")
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
          .select("id, city, day_number, start_date, ai_summary, ai_highlight, review_photos, new_for_users, hidden_for_users, chat_status, group_session_id")
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

  // Kategorizuj entries do 3 grup wg start_date i hidden_for_users.
  // Aktywne: NIE ukryte AND (start_date >= today OR null/brak daty)
  // Pocztowki: NIE ukryte AND start_date < today
  // Ukryte: user.id IN hidden_for_users
  const { active, postcards, hidden } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active: any[] = [];
    const postcards: any[] = [];
    const hidden: any[] = [];
    for (const e of entries) {
      const isHidden = Array.isArray(e.hidden_for_users) && e.hidden_for_users.includes(userId);
      if (isHidden) {
        hidden.push(e);
        continue;
      }
      const startDate = e.start_date ? parseISO(e.start_date) : null;
      const isPast = startDate && isValid(startDate) && startDate < today;
      if (isPast) postcards.push(e);
      else active.push(e);
    }
    // Sort: aktywne po start_date asc, pocztowki po start_date desc, ukryte po updated_at (juz w order)
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
    return { active, postcards, hidden };
  }, [entries, userId]);

  const visibleEntries = activeTab === "active" ? active : activeTab === "postcards" ? postcards : hidden;

  const handleHide = async (entry: any) => {
    setOpenMenuId(null);
    setDeletingId(entry.id);
    try {
      const { error } = await (supabase as any).rpc("hide_route_for_user", { p_route_id: entry.id });
      if (error) throw error;
      // Optymistycznie zaktualizuj cache - od razu znika z listy
      queryClient.setQueryData(["journal-entries", userId], (old: any) =>
        (old ?? []).map((e: any) => e.id === entry.id
          ? { ...e, hidden_for_users: [...(e.hidden_for_users ?? []), userId] }
          : e
        )
      );
      queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
      toast.success("Ukryto z dziennika", { description: "Znajdziesz w zakładce 'Ukryte'" });
    } catch {
      toast.error("Nie udało się ukryć trasy");
    }
    setDeletingId(null);
  };

  const handleUnhide = async (entry: any) => {
    setOpenMenuId(null);
    setDeletingId(entry.id);
    try {
      const { error } = await (supabase as any).rpc("unhide_route_for_user", { p_route_id: entry.id });
      if (error) throw error;
      queryClient.setQueryData(["journal-entries", userId], (old: any) =>
        (old ?? []).map((e: any) => e.id === entry.id
          ? { ...e, hidden_for_users: (e.hidden_for_users ?? []).filter((u: string) => u !== userId) }
          : e
        )
      );
      toast.success("Trasa przywrócona");
    } catch {
      toast.error("Nie udało się przywrócić trasy");
    }
    setDeletingId(null);
  };

  const handleLeaveOrDelete = async (entry: any) => {
    setOpenMenuId(null);
    const confirmMsg = entry.is_own
      ? `Usunąć trasę "${entry.city}"? Tego nie można cofnąć.`
      : `Opuścić trasę "${entry.city}"? Wyjdziesz z sesji grupowej i stracisz dostęp na zawsze.`;
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
        const { error } = await (supabase as any)
          .from("group_session_members")
          .delete()
          .eq("session_id", entry.group_session_id)
          .eq("user_id", userId);
        if (error) throw error;
        toast.success("Opuszczono trasę");
      }
      // Optymistyczne usuniecie + invalidate cache zeby trasa zniknela natychmiast
      queryClient.setQueryData(["journal-entries", userId], (old: any) =>
        (old ?? []).filter((e: any) => e.id !== entry.id)
      );
      queryClient.invalidateQueries({ queryKey: ["journal-entries", userId] });
      queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
    } catch {
      toast.error("Nie udało się usunąć trasy");
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

  // Empty state - tylko gdy brak WSZYSTKICH entries (we wszystkich tabach)
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
    { id: "postcards", label: "Pocztówki", count: postcards.length },
    { id: "hidden", label: "Ukryte", count: hidden.length },
  ];

  return (
    <div className="space-y-3 pb-2">
      {/* Tabs - sticky na gorze, scrollable horizontalnie gdy duzo */}
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

      {/* CTA: zaplanuj kolejna trase - tylko w Aktywnych */}
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
          {activeTab === "active" && "Brak aktywnych tras"}
          {activeTab === "postcards" && "Brak pocztówek z minionych podróży"}
          {activeTab === "hidden" && "Brak ukrytych tras"}
        </div>
      )}

      {/* Lista tras */}
      {visibleEntries.map((entry) => {
        const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
        const thumb = validPhotos[0] ?? getRandomPinPlaceholder(entry.id);
        const _d = entry.start_date ? parseISO(entry.start_date) : null;
        const dateLabel = _d && isValid(_d) ? format(_d, "d MMMM yyyy", { locale: pl }) : "";
        const hasUserPhoto = validPhotos.length > 0;
        const isHidden = activeTab === "hidden";

        return (
          <div
            key={entry.id}
            onClick={async () => {
              // Klik na ukrytej trasie - przywroc i nawiguj
              if (isHidden) {
                await handleUnhide(entry);
                navigate(`/review-summary?route=${entry.id}`);
                return;
              }
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
              navigate(`/review-summary?route=${entry.id}`);
            }}
            className="w-full rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform cursor-pointer"
          >
            {/* Cover photo */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
              <img
                src={thumb}
                alt=""
                className={cn("w-full h-full object-cover", isHidden && "opacity-50 grayscale")}
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
              {/* Top-right: badges + 3 kropki context menu */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {entry.new_for_users?.includes(userId) && !isHidden && (
                  <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Nowa trasa!
                  </div>
                )}
                {hasUserPhoto && !isHidden && (
                  <div className="bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white/90">
                    📷 Twoje zdjęcie
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === entry.id ? null : entry.id);
                    }}
                    disabled={deletingId === entry.id}
                    className="h-7 w-7 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-white hover:bg-black/60 transition-colors disabled:opacity-50"
                    aria-label="Opcje trasy"
                  >
                    {deletingId === entry.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <MoreVertical className="h-3.5 w-3.5" />
                    }
                  </button>
                  {openMenuId === entry.id && (
                    <div
                      ref={menuRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-9 right-0 min-w-[200px] rounded-2xl bg-card border border-border/50 shadow-xl py-1.5 z-30"
                    >
                      {isHidden ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnhide(entry); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted active:bg-muted/80 transition-colors"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          Przywróć z ukrytych
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleHide(entry); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted active:bg-muted/80 transition-colors"
                        >
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                          Ukryj z dziennika
                        </button>
                      )}
                      <div className="h-px bg-border/40 my-0.5" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLeaveOrDelete(entry); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                      >
                        {entry.is_own ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        {entry.is_own ? "Usuń trasę" : "Opuść trasę"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Text below photo */}
            {(entry.ai_highlight || entry.ai_summary) && (
              <div className="px-4 py-3">
                {entry.ai_highlight && (
                  <p className={cn("text-sm italic leading-snug mb-1.5", isHidden ? "text-muted-foreground" : "text-foreground/80")}>
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
