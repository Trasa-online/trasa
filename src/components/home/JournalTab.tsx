import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { resolveStored } from "@/components/PlacePhoto";
import { format, parseISO, isValid } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { Globe, Lock, Loader2, Trash2, CalendarDays, Sparkles, Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { API_BASE } from "@/lib/platform";
import { avatarSrc } from "@/lib/avatar";

interface JournalTabProps {
  userId: string;
  // Filtr miasta z naglowka zakladki. "all" (lub brak) = wszystkie miasta.
  city?: string;
}

type LatLng = { latitude?: number | null; longitude?: number | null };

// Mini mapka Google (statyczna) w rogu okladki karty wyjazdu - pomaranczowe piny miejsc,
// POI/transit ukryte. Przez proxy /api/static-map (klucz server-side, 24h CDN). null gdy
// brak wspolrzednych. Wzorzec 1:1 z DiscoveryFeed.
function buildMiniMapUrl(pins: LatLng[]): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 12);
  if (!pts.length) return null;
  const markers = pts
    .map((p) => `markers=size:tiny%7Ccolor:0xf9662b%7C${p.latitude},${p.longitude}`)
    .join("&");
  return `${API_BASE}/api/static-map?size=120x120&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

const JournalTab = ({ userId, city: cityFilter }: JournalTabProps) => {
  const { t } = useTranslation("homeprofile");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", userId],
    queryFn: async () => {
      // Own routes (all statuses)
      const { data: ownRoutes } = await (supabase as any)
        .from("routes")
        .select("id, title, city, day_number, start_date, end_date, folder_id, group_session_id, ai_summary, ai_highlight, review_photos, is_shared, overall_rating, views, new_for_users, chat_status, trip_type, plan_finalized")
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
  const { data: pinData = { covers: {}, counts: {}, maps: {} } } = useQuery({
    queryKey: ["journal-cover-pins", entryIds.join(",")],
    queryFn: async () => {
      if (!entryIds.length) return { covers: {}, counts: {}, maps: {} };
      const { data } = await (supabase as any)
        .from("pins")
        .select("route_id, photo_url, image_url, pin_order, latitude, longitude")
        .in("route_id", entryIds)
        .order("pin_order", { ascending: true });
      const covers: Record<string, string> = {};
      const counts: Record<string, number> = {};
      const coords: Record<string, LatLng[]> = {};
      for (const p of data ?? []) {
        counts[p.route_id] = (counts[p.route_id] ?? 0) + 1;
        (coords[p.route_id] ??= []).push({ latitude: p.latitude, longitude: p.longitude });
        if (covers[p.route_id]) continue;
        const u = resolveStored(p.photo_url || p.image_url);
        if (u) covers[p.route_id] = u;
      }
      // Prebuild mini-map URL per route (max 12 pinow, tylko gdy sa wspolrzedne).
      const maps: Record<string, string> = {};
      for (const [rid, pts] of Object.entries(coords)) {
        const u = buildMiniMapUrl(pts);
        if (u) maps[rid] = u;
      }
      return { covers, counts, maps };
    },
    enabled: entryIds.length > 0,
  });
  const coverMap = pinData.covers;
  const countMap = pinData.counts as Record<string, number>;
  const mapMap = pinData.maps as Record<string, string>;

  // Awatary uczestnikow dla wyjazdow grupowych (group_session_id) - stack na karcie.
  const groupIds = useMemo(
    () => [...new Set(entries.filter((e: any) => e.group_session_id).map((e: any) => e.group_session_id))] as string[],
    [entries],
  );
  const { data: memberAvatars = {} } = useQuery({
    queryKey: ["journal-group-members", groupIds.join(",")],
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

  // Grupuj trasy wielodniowe (folder_id) w JEDNA pocztowke (dzien 1 = reprezentant).
  // Granica aktywny/wspomnienie liczona po OSTATNIM dniu trasy (end_date ?? start_date).
  // Trasa jednodniowa = osobny wpis, granica po end_date ?? start_date.
  const { active: activeRaw, postcards: postcardsRaw } = useMemo(() => {
    // Wyjazd GRUPOWY = JEDEN wpis. Wszystkie kopie tej samej sesji (group_session_id) - wlasna
    // (is_own) oraz cudze (przez group_session_members join) - zwijamy do jednego, preferujac
    // WLASNA kopie (zeby notki/edycje usera dzialaly na niej). To dedupuje widok bez kasowania danych.
    const bySession = new Map<string, any>();
    const deduped: any[] = [];
    for (const e of entries) {
      if (e.group_session_id) {
        const prev = bySession.get(e.group_session_id);
        if (!prev) { bySession.set(e.group_session_id, e); deduped.push(e); }
        else if (e.is_own && !prev.is_own) {
          const idx = deduped.indexOf(prev);
          if (idx >= 0) deduped[idx] = e;
          bySession.set(e.group_session_id, e);
        }
      } else {
        deduped.push(e);
      }
    }

    const folderMap = new Map<string, any[]>();
    const collapsed: any[] = [];
    for (const e of deduped) {
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

  // Filtr miasta z naglowka ("all"/brak = wszystkie). Wyjazd bez miasta pokazujemy tylko
  // przy "Wszystkie".
  const cityMatch = (e: any) =>
    !cityFilter || cityFilter === "all" || (e.city ?? "").toLowerCase() === cityFilter.toLowerCase();
  const active = useMemo(() => activeRaw.filter(cityMatch), [activeRaw, cityFilter]);
  const postcards = useMemo(() => postcardsRaw.filter(cityMatch), [postcardsRaw, cityFilter]);

  // Dziennik = tylko wspomnienia (minione podroze). Aktywne trasy/sesje zyja teraz
  // na ekranie glownym (ActiveTripsDashboard), wiec tu pokazujemy wylacznie pocztowki.
  const visibleEntries = postcards;

  // Usuwanie/opuszczanie wyjazdu z potwierdzeniem w modalu (nieodwracalne). Trash otwiera
  // modal (setPendingDelete); potwierdzenie wola doDelete (hard delete + optymistyczny cache).
  const restoreEntries = () => {
    queryClient.invalidateQueries({ queryKey: ["journal-entries", userId] });
    queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
  };
  const handleDelete = (e: React.MouseEvent, entry: any) => {
    e.stopPropagation();
    setPendingDelete(entry);
  };
  const doDelete = async (entry: any) => {
    // Optymistyczne usuniecie z cache (natychmiast znika z listy).
    queryClient.setQueryData(["journal-entries", userId], (old: any) =>
      (old ?? []).filter((x: any) => x.id !== entry.id)
    );
    queryClient.invalidateQueries({ queryKey: ["journal-badge"] });
    try {
      if (entry.is_own) {
        await supabase.from("pins").delete().eq("route_id", entry.id);
        await (supabase as any).from("chat_sessions").delete().eq("route_id", entry.id);
        const { error } = await supabase.from("routes").delete().eq("id", entry.id);
        if (error) throw error;
        toast.success(t("journal.toast_deleted"));
      } else {
        if (!entry.group_session_id) throw new Error("missing group_session_id");
        // count: 'exact' zeby wykryc silent RLS fail (migracja 20260604_gsm_delete_policy.sql).
        const { error, count } = await (supabase as any)
          .from("group_session_members")
          .delete({ count: "exact" })
          .eq("session_id", entry.group_session_id)
          .eq("user_id", userId);
        if (error) throw error;
        if (count === 0) throw new Error(t("journal.leave_no_permission"));
        toast.success(t("journal.toast_left"));
      }
      restoreEntries();
    } catch (err: any) {
      console.error("[JournalTab] delete/leave failed:", err);
      toast.error(t("journal.toast_fail"), { description: err?.message ?? t("journal.unknown_error") });
      restoreEntries(); // fail -> wpis wraca na liste
    }
  };

  // Modal potwierdzenia usuniecia/opuszczenia wyjazdu (nieodwracalne, copy jak systemowy alert).
  const deleteModal = (
    <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
      <AlertDialogContent className="rounded-3xl max-w-[340px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingDelete?.is_own ? "Na pewno chcesz usunąć ten wyjazd?" : "Na pewno chcesz opuścić ten wyjazd?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete?.is_own
              ? "Jeżeli usuniesz ten wyjazd, zniknie on bezpowrotnie z Twojego profilu. Nie można tego cofnąć."
              : "Przestaniesz być uczestnikiem tego wyjazdu i zniknie on z Twojego profilu. Nie można tego cofnąć."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { const e = pendingDelete; setPendingDelete(null); if (e) void doDelete(e); }}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pendingDelete?.is_own ? "Usuń" : "Opuść"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Sheet tworzenia nowego wyjazdu (tryb uproszczony) - wspoldzielony miedzy stanami.

  // Polska liczba mnoga miejsc: 1 miejsce / 2-4 miejsca / 5+ miejsc.
  const placesCountLabel = (n: number): string => {
    if (n === 1) return t("journal.places_one", { num: n });
    const last = n % 10, last2 = n % 100;
    if (last >= 2 && last <= 4 && (last2 < 10 || last2 >= 20)) return t("journal.places_few", { num: n });
    return t("journal.places_many", { num: n });
  };

  // Karta wyjazdu (redesign): uklad poziomy - okladka po lewej (zamek + mini-mapa w rogach),
  // po prawej tytul, miasto + data, liczba miejsc i awatary uczestnikow (dla grup).
  const renderTripCard = (entry: any, onOpen: () => void, inProgress = false) => {
    const validPhotos = (entry.review_photos ?? []).filter((url: any) => !!url && typeof url === "string" && url.trim() !== "");
    const thumb = validPhotos[0] ?? (coverMap as Record<string, string>)[entry.id] ?? getRandomPinPlaceholder(entry.id);
    // Zakres dat od-do dla wyjazdow 2-3 dniowych (start_date != koniec). _lastDate liczy
    // sie z folderu (multi-day) albo end_date (pojedyncza trasa).
    const startISO = entry.start_date;
    const endISO = entry._lastDate ?? entry.end_date ?? entry.start_date;
    const _d = startISO ? parseISO(startISO) : null;
    const _e = endISO ? parseISO(endISO) : null;
    const dateLabel = _d && isValid(_d)
      ? (_e && isValid(_e) && endISO !== startISO
          ? `${format(_d, "d", { locale: dateLocale() })}-${format(_e, "d MMM yyyy", { locale: dateLocale() })}`
          : format(_d, "d MMM yyyy", { locale: dateLocale() }))
      : "";
    const count = countMap[entry.id] ?? 0;
    const miniMap = mapMap[entry.id];
    const isPrivate = entry.is_shared === false;
    const isNew = entry.new_for_users?.includes(userId);
    const canDelete = entry.is_own || entry.group_session_id;
    const title = entry.title || entry.city || t("journal.trip_fallback");
    const avatars = entry.group_session_id
      ? (memberAvatars as Record<string, { avatar_url: string | null; name: string }[]>)[entry.group_session_id] ?? []
      : [];

    return (
      <div
        key={entry.id}
        onClick={onOpen}
        className="relative w-full flex gap-3.5 p-2.5 rounded-3xl bg-card border border-border/50 text-left active:scale-[0.99] transition-transform cursor-pointer"
      >
        {/* Okladka po lewej */}
        <div className="relative w-[118px] shrink-0 aspect-[4/5] rounded-2xl overflow-hidden bg-muted">
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fallback"); }}
          />
          {/* Zamek / globus (widocznosc) */}
          <div className="absolute top-2 left-2 h-7 w-7 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
            {isPrivate ? <Lock className="h-3.5 w-3.5 text-white/90" /> : <Globe className="h-3.5 w-3.5 text-white/90" />}
          </div>
          {/* Mini-mapka trasy */}
          {miniMap && (
            <div className="absolute bottom-2 right-2 h-[46px] w-[46px] rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
              <img src={miniMap} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Tresc po prawej */}
        <div className="flex-1 min-w-0 flex flex-col py-0.5 pr-0.5">
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0 text-lg font-bold leading-tight text-foreground line-clamp-2">{title}</p>
            {canDelete && (
              <button
                onClick={(e) => handleDelete(e, entry)}
                disabled={deletingId === entry.id}
                aria-label={entry.is_own ? t("journal.delete_aria") : t("journal.leave_aria")}
                className="shrink-0 -mr-0.5 -mt-0.5 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive active:scale-90 transition-colors disabled:opacity-50"
              >
                {deletingId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {/* Miasto + data */}
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground min-w-0">
            {entry.city && <span className="truncate">{entry.city}</span>}
            {dateLabel && <span className="text-muted-foreground/70 whitespace-nowrap">{dateLabel}</span>}
          </div>

          {/* Statusy (nowe / w toku / wielodniowe) */}
          {(isNew || inProgress || entry._numDays > 1) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {isNew && <span className="bg-primary text-white rounded-full px-2 py-0.5 text-[10px] font-bold">{t("journal.new_badge")}</span>}
              {inProgress && <span className="bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">W toku</span>}
              {entry._numDays > 1 && (
                <span className="flex items-center gap-1 bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  <CalendarDays className="h-2.5 w-2.5" />{t("journal.days_count", { num: entry._numDays })}
                </span>
              )}
            </div>
          )}

          {/* Liczba miejsc + awatary uczestnikow */}
          <div className="mt-auto flex items-center gap-2.5 pt-2">
            <span className="text-sm font-medium text-muted-foreground">{placesCountLabel(count)}</span>
            {avatars.length > 0 && (
              <div className="flex -space-x-2">
                {avatars.slice(0, 3).map((a, i) => (
                  <div key={i} className="h-6 w-6 rounded-full border-2 border-card overflow-hidden bg-orange-100" style={{ zIndex: 3 - i }}>
                    <img src={avatarSrc(a.avatar_url)} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                ))}
                {avatars.length > 3 && (
                  <div className="h-6 w-6 rounded-full border-2 border-card bg-foreground/85 text-background text-[9px] font-bold flex items-center justify-center" style={{ zIndex: 0 }}>
                    +{avatars.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="h-9 w-9 text-muted-foreground" strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold tracking-tight">{PLANNING_DISABLED ? "Twoje wyjazdy" : t("journal.empty_title")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
              {PLANNING_DISABLED ? "Stwórz wyjazd i dorzuć do niego miejsca, które zapisałeś z eksploracji." : t("journal.empty_desc")}
            </p>
          </div>
          {PLANNING_DISABLED ? (
            <button
              onClick={() => navigate("/plan", { state: { wyjazdMode: true } })}
              className="px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" />
              Stwórz wyjazd
            </button>
          ) : (
            <button
              onClick={() => navigate("/sesja/nowa", { state: { from: "journal" } })}
              className="px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Sparkles className="h-4 w-4" />
              {t("journal.empty_cta")}
            </button>
          )}
        </div>
      </>
    );
  }

  // Otwarcie wpisu = zawsze ReviewSummary (?route=). Nowy/aktywny wyjazd (reviewed=false)
  // laduje w trybie edycji (stepper Trasa/Notki/Zdjecia); zakonczony/miniony = tryb read.
  const openEntry = (entry: any, edit = false) => {
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
    // Aktywne wyjazdy otwieramy w trybie edycji (stepper); wspomnienia - ReviewSummary decyduje.
    navigate(`/review-summary?route=${entry.id}${edit ? "&edit=1" : ""}`);
  };

  // Tryb uproszczony: przycisk "Nowy wyjazd" + toggle Aktywne | Wspomnienia.
  if (PLANNING_DISABLED) {
    const emptyBox = (emoji: string, title: string, desc: string) => (
      <div className="py-14 text-center px-8">
        <div className="text-4xl mb-3">{emoji}</div>
        <p className="text-base font-bold">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">{desc}</p>
      </div>
    );
    return (
      <div className="space-y-3 pb-2">
        {/* Zakładka "Trasy" (2026-07-26): trasy stworzone przez użytkownika - najbliższe/aktywne
            + wspomnienia (minione), w jednej liście. Przycisk "Nowy wyjazd" jest w nagłówku (Journal.tsx). */}
        {active.length === 0 && postcards.length === 0 ? (
          emptyBox("🧳", "Brak tras", "Twoje trasy - najbliższe i minione - pojawią się tutaj.")
        ) : (
          <div className="space-y-3">
            {active.map((entry: any) => renderTripCard(entry, () => openEntry(entry, true), true))}
            {postcards.map((entry: any) => renderTripCard(entry, () => openEntry(entry)))}
          </div>
        )}
        {deleteModal}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-2">
      {deleteModal}
      {/* Dziennik = wspomnienia (minione podroze). Aktywne trasy/sesje sa na ekranie glownym. */}
      {visibleEntries.length === 0 && (
        <div className="py-16 text-center px-8">
          <div className="text-4xl mb-3">📸</div>
          <p className="text-base font-bold">{t("journal.memories_empty_title")}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">
            {t("journal.memories_empty_desc")}
          </p>
        </div>
      )}

      {/* Lista wspomnień - ta sama karta co aktywne wyjazdy */}
      {visibleEntries.map((entry) => renderTripCard(entry, () => openEntry(entry)))}
    </div>
  );
};

export default JournalTab;
