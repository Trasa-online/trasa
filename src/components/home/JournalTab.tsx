import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { resolveStored } from "@/components/PlacePhoto";
import { format, parseISO, isValid } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { Globe, Lock, Loader2, Trash2, CalendarDays, Sparkles, Eye, Plus, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { PLANNING_DISABLED } from "@/lib/appMode";

interface JournalTabProps {
  userId: string;
}

const JournalTab = ({ userId }: JournalTabProps) => {
  const { t } = useTranslation("homeprofile");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Tryb uproszczony: tworzenie prostego wyjazdu wprost z zakladki Wyjazdy.
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const savedCities = useMemo(() => {
    try {
      const seen = new Set<string>();
      return getHistoryByCity()
        .map((g) => g.city)
        .filter((c) => c && !seen.has(c) && seen.add(c));
    } catch { return []; }
  }, []);

  const handleCreateWyjazd = async () => {
    const city = newCity.trim();
    const title = newTitle.trim() || city;
    if (!title || !userId) return;
    setCreating(true);
    try {
      const { data, error } = await (supabase as any)
        .from("routes")
        .insert({
          user_id: userId,
          title,
          city: city || null,
          trip_type: "planning",
          status: "draft",
          day_number: 1,
          is_shared: false,
          start_date: newStart || null,
          end_date: newEnd || newStart || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setShowCreate(false);
      setNewTitle(""); setNewCity(""); setNewStart(""); setNewEnd("");
      queryClient.invalidateQueries({ queryKey: ["journal-entries", userId] });
      navigate(`/wyjazd/${data.id}`);
    } catch (err: any) {
      console.error("[JournalTab] create wyjazd failed:", err?.message ?? err);
      toast.error("Nie udało się utworzyć wyjazdu");
      setCreating(false);
    }
  };

  // Polska liczba mnoga: 1 osoba obejrzala / 2-4 osoby obejrzaly / 5+ osob obejrzalo.
  const viewsLabel = (n: number): string => {
    if (n === 1) return t("journal.views_one");
    const last = n % 10, last2 = n % 100;
    if (last >= 2 && last <= 4 && (last2 < 10 || last2 >= 20)) return t("journal.views_few", { num: n });
    return t("journal.views_many", { num: n });
  };

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      // Own routes (all statuses)
      const { data: ownRoutes } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, end_date, folder_id, ai_summary, ai_highlight, review_photos, is_shared, overall_rating, views, new_for_users, chat_status, trip_type, plan_finalized")
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
          .select("id, title, city, day_number, start_date, end_date, folder_id, ai_summary, ai_highlight, review_photos, new_for_users, chat_status, group_session_id, trip_type, plan_finalized")
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

  // Okladka karty gdy brak zdjec usera: zdjecie pierwszego miejsca z trasy
  // (cached pin.photo_url/image_url). Mapa route_id -> URL (pierwszy pin Z
  // jakimkolwiek zdjeciem, wg pin_order). Reprezentant multi-day = dzien 1.
  const entryIds = useMemo(() => entries.map((e: any) => e.id), [entries]);
  const { data: pinData = { covers: {}, counts: {} } } = useQuery({
    queryKey: ["journal-cover-pins", entryIds.join(",")],
    queryFn: async () => {
      if (!entryIds.length) return { covers: {}, counts: {} };
      const { data } = await (supabase as any)
        .from("pins")
        .select("route_id, photo_url, image_url, pin_order")
        .in("route_id", entryIds)
        .order("pin_order", { ascending: true });
      const covers: Record<string, string> = {};
      const counts: Record<string, number> = {};
      for (const p of data ?? []) {
        counts[p.route_id] = (counts[p.route_id] ?? 0) + 1;
        if (covers[p.route_id]) continue;
        const u = resolveStored(p.photo_url || p.image_url);
        if (u) covers[p.route_id] = u;
      }
      return { covers, counts };
    },
    enabled: entryIds.length > 0,
  });
  const coverMap = pinData.covers;
  const countMap = pinData.counts;

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
        collapsed.push({ ...e, _numDays: 1, _lastDate: e.end_date ?? e.start_date });
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
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active: any[] = [];
    const postcards: any[] = [];
    for (const e of collapsed) {
      const lastDate = e._lastDate ? parseISO(e._lastDate) : null;
      const isPast = lastDate && isValid(lastDate) && lastDate < today;
      // Wspomnienie (pocztowka w Dzienniku) = trasa UKONCZONA (trip_type=completed /
      // plan_finalized) ALBO miniona (data < dzis). Wczesniej liczyla sie TYLKO data ->
      // trasa ukonczona DZIS znikala z aktywnych (trip_type!=planning), a do Dziennika
      // nie trafiala (data nie minela) = "nie zapisala sie nigdzie". To byl bug.
      const isDone = e.trip_type === "completed" || e.plan_finalized === true;
      if (isPast || isDone) postcards.push(e);
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
  }, [entries]);

  // Dziennik = tylko wspomnienia (minione podroze). Aktywne trasy/sesje zyja teraz
  // na ekranie glownym (ActiveTripsDashboard), wiec tu pokazujemy wylacznie pocztowki.
  const visibleEntries = postcards;

  const handleDelete = async (e: React.MouseEvent, entry: any) => {
    e.stopPropagation();
    const confirmMsg = entry.is_own
      ? t("journal.confirm_delete", { city: entry.city })
      : t("journal.confirm_leave", { city: entry.city });
    if (!confirm(confirmMsg)) return;
    setDeletingId(entry.id);
    try {
      if (entry.is_own) {
        await supabase.from("pins").delete().eq("route_id", entry.id);
        await (supabase as any).from("chat_sessions").delete().eq("route_id", entry.id);
        const { error } = await supabase.from("routes").delete().eq("id", entry.id);
        if (error) throw error;
        toast.success(t("journal.toast_deleted"));
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
          throw new Error(t("journal.leave_no_permission"));
        }
        toast.success(t("journal.toast_left"));
      }
      // Optymistyczne usuniecie z cache + invalidate zeby trasa zniknela natychmiast
      queryClient.setQueryData(["journal-entries", userId], (old: any) =>
        (old ?? []).filter((e: any) => e.id !== entry.id)
      );
      queryClient.invalidateQueries({ queryKey: ["journal-entries", userId] });
      queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
    } catch (err: any) {
      console.error("[JournalTab] delete/leave failed:", err);
      const msg = err?.message ?? t("journal.unknown_error");
      toast.error(t("journal.toast_fail"), { description: msg });
    }
    setDeletingId(null);
  };

  // Sheet tworzenia nowego wyjazdu (tryb uproszczony) - wspoldzielony miedzy stanami.
  const createSheet = showCreate ? (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => !creating && setShowCreate(false)}
    >
      <div
        className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">Nowy wyjazd</h2>
          <button
            onClick={() => setShowCreate(false)}
            className="h-8 w-8 -mr-1 flex items-center justify-center rounded-full text-foreground active:bg-muted transition-colors"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nazwa wyjazdu</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={"np. Weekend w Krakowie"}
            className="w-full h-12 px-4 rounded-2xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Miasto</label>
          <input
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="np. Kraków"
            className="w-full h-12 px-4 rounded-2xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
          />
          {savedCities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {savedCities.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => setNewCity(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    newCity === c ? "border-orange-400 bg-orange-50 text-orange-700" : "border-border/60 bg-card text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Kiedy? (opcjonalnie)</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="flex-1 h-11 px-3 rounded-2xl border border-border bg-muted/30 text-sm focus:outline-none focus:border-foreground/30"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <input
              type="date"
              value={newEnd}
              min={newStart || undefined}
              onChange={(e) => setNewEnd(e.target.value)}
              className="flex-1 h-11 px-3 rounded-2xl border border-border bg-muted/30 text-sm focus:outline-none focus:border-foreground/30"
            />
          </div>
        </div>
        <button
          onClick={handleCreateWyjazd}
          disabled={creating || (!newTitle.trim() && !newCity.trim())}
          className="mt-1 w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Utwórz wyjazd"}
        </button>
      </div>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        {t("journal.loading")}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-24 text-center">
          <div className="w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <div className="space-y-2">
            <p className="text-xl font-bold tracking-tight">{PLANNING_DISABLED ? "Twoje wyjazdy" : t("journal.empty_title")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
              {PLANNING_DISABLED ? "Stwórz wyjazd i dorzuć do niego miejsca, które zapisałeś z eksploracji." : t("journal.empty_desc")}
            </p>
          </div>
          <button
            onClick={() => (PLANNING_DISABLED ? setShowCreate(true) : navigate("/sesja/nowa", { state: { from: "journal" } }))}
            className="px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
          >
            {PLANNING_DISABLED ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {PLANNING_DISABLED ? "Nowy wyjazd" : t("journal.empty_cta")}
          </button>
        </div>
        {createSheet}
      </>
    );
  }

  return (
    <div className="space-y-3 pb-2">
      {/* Tryb uproszczony: tworzenie wyjazdu + lista aktywnych wyjazdow (w toku) NAD wspomnieniami. */}
      {PLANNING_DISABLED && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Plus className="h-4 w-4" /> Nowy wyjazd
          </button>
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((entry: any) => {
                const cnt = (countMap as Record<string, number>)[entry.id] ?? 0;
                const cover = (coverMap as Record<string, string>)[entry.id];
                const cntLabel = cnt === 0 ? "brak miejsc" : `${cnt} ${cnt === 1 ? "miejsce" : cnt % 10 >= 2 && cnt % 10 <= 4 && (cnt % 100 < 10 || cnt % 100 >= 20) ? "miejsca" : "miejsc"}`;
                return (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/wyjazd/${entry.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-border/50 bg-card text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {cover
                        ? <img src={cover} alt="" className="w-full h-full object-cover" />
                        : <MapPin className="h-5 w-5 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{entry.title || entry.city || "Wyjazd"}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {entry.city ? `${entry.city} · ` : ""}{cntLabel}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-orange-600 shrink-0 pr-1">W toku</span>
                  </button>
                );
              })}
            </div>
          )}
          {visibleEntries.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-muted-foreground">Wspomnienia</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
          )}
        </div>
      )}

      {/* Dziennik = wspomnienia (minione podroze). Aktywne trasy/sesje sa na ekranie glownym. */}
      {visibleEntries.length === 0 && !PLANNING_DISABLED && (
        <div className="py-16 text-center px-8">
          <div className="text-4xl mb-3">📸</div>
          <p className="text-base font-bold">{t("journal.memories_empty_title")}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">
            {t("journal.memories_empty_desc")}
          </p>
        </div>
      )}

      {/* Lista wspomnień */}
      {visibleEntries.map((entry) => {
        const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
        const thumb = validPhotos[0] ?? (coverMap as Record<string, string>)[entry.id] ?? getRandomPinPlaceholder(entry.id);
        const _d = entry.start_date ? parseISO(entry.start_date) : null;
        const dateLabel = _d && isValid(_d) ? format(_d, "d MMMM yyyy", { locale: dateLocale() }) : "";
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
              navigate(`/review-summary?route=${entry.id}`);
            }}
            className="w-full rounded-3xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform cursor-pointer"
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
                  {entry.title || entry.city || t("journal.trip_fallback")}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {dateLabel && <p className="text-white/70 text-xs">{dateLabel}</p>}
                  {entry._numDays > 1 && (
                    <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      <CalendarDays className="h-2.5 w-2.5" />{t("journal.days_count", { num: entry._numDays })}
                    </span>
                  )}
                </div>
                {/* Nagroda: ile osob skorzystalo z udostepnionej trasy */}
                {entry.is_shared && (entry.views ?? 0) > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 bg-orange-500/90 rounded-full px-2 py-0.5 text-[10px] font-bold text-white w-fit">
                    <Eye className="h-3 w-3" />{viewsLabel(entry.views)}
                  </div>
                )}
              </div>
              <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-lg p-1.5">
                {entry.is_shared === false
                  ? <Lock className="h-3 w-3 text-white/80" />
                  : <Globe className="h-3 w-3 text-white/80" />
                }
              </div>
              {/* Top-right: badges + delete (kosz) */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {entry.new_for_users?.includes(userId) && (
                  <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    {t("journal.new_badge")}
                  </div>
                )}
                {hasUserPhoto && (
                  <div className="bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white/90">
                    {t("journal.your_photo")}
                  </div>
                )}
                {(entry.is_own || entry.group_session_id) && (
                  <button
                    onClick={(e) => handleDelete(e, entry)}
                    disabled={deletingId === entry.id}
                    className="h-7 w-7 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-full text-white/80 hover:text-white hover:bg-black/60 transition-colors disabled:opacity-50"
                    aria-label={entry.is_own ? t("journal.delete_aria") : t("journal.leave_aria")}
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
      {createSheet}
    </div>
  );
};

export default JournalTab;
