import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { X, Bell, UserPlus, UserCheck, MapPin, Route, Bookmark, CheckCircle2, XCircle, MessageCircle, Heart, Camera } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { avatarSrc } from "@/lib/avatar";
import SheetSkeleton from "@/components/layout/SheetSkeleton";
import { track } from "@/lib/analytics";

interface Notification {
  id: string;
  type: string;
  actor_id: string;
  route_id: string | null;
  created_at: string;
  read: boolean;
  metadata?: Record<string, string> | null;
  actor?: { username: string | null; avatar_url: string | null };
}

// Tylko typy AKTUALNIE uzywane w aplikacji. Like/comment/mention usuniete (tych funkcji juz
// nie ma). Zapytanie ponizej dodatkowo odfiltrowuje je z feedu na wypadek starych rekordow.
// Etykiety powiadomien jako KLUCZE (2026-09-06). Mapa zyje poza komponentem, wiec `label`
// dostaje `t` jako pierwszy argument zamiast sklejac zdanie po polsku. Warianty "z miastem" /
// "z tytulem" sa OSOBNYMI kluczami, nie doklejanym ogonkiem - po angielsku dopisek stoi
// w innym miejscu zdania, wiec sklejanie dawaloby belkot.
type NotifT = (key: string, opts?: Record<string, unknown>) => string;
const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: (t: NotifT, username: string, metadata?: Record<string, string> | null) => string }> = {
  follower:       { icon: UserPlus,      color: "text-violet-500 bg-violet-100",  label: (t, u) => t("notif.follower", { user: u }) },
  new_route:      { icon: Route,         color: "text-emerald-500 bg-emerald-100",label: (t, u) => t("notif.new_route", { user: u }) },
  route_updated:  { icon: Route,         color: "text-amber-500 bg-amber-100",    label: (t, u) => t("notif.route_updated", { user: u }) },
  route_used:     { icon: Bookmark,      color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.city ? "notif.route_used_city" : "notif.route_used", { user: u, city: m?.city }) },
  pin_visit:      { icon: MapPin,        color: "text-teal-500 bg-teal-100",      label: (t, u) => t("notif.pin_visit", { user: u }) },
  friend_request: { icon: UserPlus,      color: "text-violet-500 bg-violet-100",  label: (t, u) => t("notif.friend_request", { user: u }) },
  friend_accept:  { icon: UserCheck,     color: "text-emerald-500 bg-emerald-100",label: (t, u) => t("notif.friend_accept", { user: u }) },
  visit_comment:  { icon: MessageCircle, color: "text-sky-500 bg-sky-100",        label: (t, u, m) => t(m?.place_name ? "notif.visit_comment_place" : "notif.visit_comment", { user: u, place: m?.place_name }) },
  photo_like:     { icon: Heart,         color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.place_name ? "notif.photo_like_place" : "notif.photo_like", { user: u, place: m?.place_name }) },
  discovery_used: { icon: Bookmark,      color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.city ? "notif.discovery_used_city" : "notif.discovery_used", { user: u, city: m?.city }) },
  group_invite:       { icon: Route,  color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.city ? "notif.group_invite_city" : "notif.group_invite", { user: u, city: m?.city }) },
  route_invite:       { icon: Route,  color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.city ? "notif.route_invite_city" : "notif.route_invite", { user: u, city: m?.city }) },
  trip_places_reminder: { icon: MapPin, color: "text-orange-600 bg-orange-100", label: (t, u, m) => t(m?.city ? "notif.trip_places_reminder_city" : "notif.trip_places_reminder", { user: u, city: m?.city }) },
  trip_message:       { icon: MessageCircle, color: "text-sky-500 bg-sky-100", label: (t, u, m) => t(m?.title ? "notif.trip_message_title" : m?.city ? "notif.trip_message_city" : "notif.trip_message", { user: u, title: m?.title, city: m?.city }) },
  group_route_ready:  { icon: Route, color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.city ? "notif.group_route_ready_city" : "notif.group_route_ready", { user: u, city: m?.city }) },
  collection_approved: { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100", label: (t, _u, m) => t("notif.collection_approved", { title: m?.title ?? t("notif.list_fallback") }) },
  collection_rejected: { icon: XCircle,      color: "text-destructive bg-destructive/10", label: (t, _u, m) => t(m?.moderation_note ? "notif.collection_rejected_reason" : "notif.collection_rejected", { title: m?.title ?? t("notif.list_fallback"), reason: m?.moderation_note }) },
  route_liked:    { icon: Heart,    color: "text-red-500 bg-red-100",        label: (t, u, m) => t(m?.city ? "notif.route_liked_city" : "notif.route_liked", { user: u, city: m?.city }) },
  list_liked:     { icon: Heart,    color: "text-red-500 bg-red-100",        label: (t, u, m) => t(m?.title ? "notif.list_liked_title" : "notif.list_liked", { user: u, title: m?.title }) },
  list_saved:     { icon: Bookmark, color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.title ? "notif.list_saved_title" : "notif.list_saved", { user: u, title: m?.title }) },
  list_updated:   { icon: MapPin,   color: "text-orange-600 bg-orange-100",  label: (t, u, m) => t(m?.title ? "notif.list_updated_title" : "notif.list_updated", { user: u, title: m?.title }) },
  // Tresc liczona z metadanych kompletnosci (enqueue_trip_reminders): ZDJECIA maja priorytet,
  // potem notki, a na koncu zacheta do publikacji.
  trip_reminder:  { icon: Camera,   color: "text-orange-600 bg-orange-100",  label: (t, _u, m) => {
    const city = m?.city ? t("notif.city_suffix", { city: m.city }) : "";
    const photos = Number(m?.missing_photos ?? 0);
    const notes = Number(m?.missing_notes ?? 0);
    if (photos > 0) return t("notif.reminder_photos", { count: photos, city });
    if (notes > 0) return t("notif.reminder_notes", { count: notes, city });
    return t("notif.reminder_publish", { city });
  } },
};

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function NotificationsDrawer({ open, onClose, userId }: Props) {
  const { t } = useTranslation("social");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, actor_id, route_id, created_at, read, metadata")
        .eq("user_id", userId)
        // Pokazujemy WSZYSTKIE aktualne powiadomienia (grupowe, obserwacje, push...). Odfiltrowujemy
        // tylko martwe funkcje (like/comment/mention - juz nie istnieja). Nieznane typy -> fallback.
        .not("type", "in", "(like,comment,mention)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return [];

      // Fetch actor profiles
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", actorIds);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

      return data.map(n => ({
        ...n,
        actor: profileMap[n.actor_id] ?? null,
      })) as Notification[];
    },
    // BATERIA: drawer jest zamontowany na wiekszosci ekranow (TopBar/HomeHeaderActions/profil),
    // a zapytanie pobiera 50 powiadomien + profile autorow. Wczesniej chodzilo co 30s NAWET gdy
    // arkusz byl zamkniety (nikt tego nie widzial) - kilkaset zbednych zapytan na godzine.
    // Teraz: dane tylko gdy arkusz otwarty; licznik na dzwonku ma wlasne (tanie) zapytanie.
    enabled: !!userId && open,
  });

  // Realtime: refetch instantly when new notification arrives. Tylko przy otwartym arkuszu -
  // licznik nieprzeczytanych ma wlasna subskrypcje (TopBar / HomeHeaderActions).
  useEffect(() => {
    if (!userId || !open) return;
    const channel = supabase
      .channel(`notif-drawer-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, open]);

  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").delete().eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });

  // Mark all as read when opened
  useEffect(() => {
    if (open && notifications.length > 0) {
      markReadMutation.mutate();
    }
  }, [open, notifications.length]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Arkusz zamiast recznego overlaya: dostaje animacje wysuniecia z dolu (Radix data-state)
  // oraz wspolny gest "przeciagnij w dol, zeby zamknac" z <SheetContent side="bottom">.
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl border-0 bg-background flex flex-col overflow-hidden [&>button:last-child]:hidden"
        style={{ height: "85dvh" }}
      >
        <SheetTitle className="sr-only">Powiadomienia</SheetTitle>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center px-5 pb-4 pt-1">
          <h2 className="text-lg font-bold flex-1">
            Powiadomienia
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </h2>
          {notifications.length > 0 && (
            <button
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="text-xs text-muted-foreground font-medium mr-2 active:opacity-60"
            >
              {t("notif.clear")}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {isLoading ? (
            <SheetSkeleton variant="notifications" rows={5} className="px-4 pt-2" />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground/70">{t("notif.empty_title")}</p>
              <p className="text-xs text-muted-foreground">{t("notif.empty_desc")}</p>
            </div>
          ) : (
            <div className="mx-4 rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/20">
              {notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? {
                  icon: Bell,
                  color: "text-muted-foreground bg-muted",
                  label: (tt: NotifT, u: string) => tt("notif.fallback", { user: u }),
                };
                const Icon = cfg.icon;
                const username = n.actor?.username ?? t("notif.someone");
                // Tap w awatar / tresc -> profil publiczny osoby, ktora wywolala powiadomienie.
                // Systemowe (bez autora, np. przypomnienie o wyjezdzie) zostaja nieklikalne.
                const actorUsername = n.actor?.username ?? null;
                // Powrot do apki z powiadomienia - domykamy petle spoleczna w analityce.
                // Typ mowi, ktore powiadomienia realnie sprowadzaja ludzi z powrotem.
                const openActor = actorUsername
                  ? () => { track("notification_opened", { type: n.type }); onClose(); navigate(`/profil/${actorUsername}`); }
                  : undefined;
                const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale() });
                const labelText = cfg.label(t, username, n.metadata);

                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    {/* Awatar usera + maly badge typu powiadomienia w rogu. Tap -> profil. */}
                    <div
                      className={`relative flex-shrink-0 ${openActor ? "active:opacity-70 transition-opacity" : ""}`}
                      onClick={openActor}
                      role={openActor ? "button" : undefined}
                      aria-label={openActor ? t("notif.profile_of", { username }) : undefined}
                    >
                      <img
                        src={avatarSrc(n.actor?.avatar_url)}
                        alt={username}
                        className="h-10 w-10 rounded-full object-cover bg-orange-100"
                        loading="lazy"
                      />
                      <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-card ${cfg.color}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug text-foreground/80 ${openActor ? "active:opacity-70 transition-opacity" : ""}`}
                        onClick={openActor}
                        role={openActor ? "button" : undefined}
                      >
                        {labelText}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
                      {(n.type === "group_invite" || n.type === "group_route_ready" || n.type === "route_invite" || n.type === "trip_places_reminder" || n.type === "trip_message") && (
                        <button
                          onClick={() => {
                            onClose();
                            // Deep-link do konkretnej trasy gdy znamy route_id (kolumna lub metadata), inaczej do zakladki Wyjazdy.
                            const rid = n.route_id ?? n.metadata?.route_id;
                            // Widok wyjazdu = SharedRoute (/route/:id) - etap propozycji/w trakcie/wspomnienie (tam dymek czatu).
                            navigate(rid ? `/route/${rid}` : "/moj-profil?tab=wyjazdy");
                          }}
                          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                        >
                          {n.type === "trip_message" ? t("notif.open_chat") : t("notif.see_route")}
                        </button>
                      )}
                      {n.type === "trip_reminder" && (
                        <button
                          onClick={() => {
                            onClose();
                            // Zawsze widok wyjazdu: tam dodaje sie zdjecia, notki, opis i tagi,
                            // i stamtad publikuje sie wyjazd (stepper zniknal z flow 2026-08-30).
                            const rid = n.route_id ?? n.metadata?.route_id;
                            navigate(rid ? `/route/${rid}` : "/moj-profil?tab=wyjazdy");
                          }}
                          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                        >
                          {n.metadata?.missing_photos && Number(n.metadata.missing_photos) > 0 ? t("notif.add_photos") : t("notif.finish_trip")}
                        </button>
                      )}
                      {(n.type === "friend_request" || n.type === "friend_accept") && (
                        <button
                          onClick={() => { track("notification_opened", { type: n.type }); onClose(); navigate("/moj-profil"); }}
                          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                        >
                          {n.type === "friend_request" ? "Zobacz zaproszenie →" : "Zobacz znajomych →"}
                        </button>
                      )}
                      {n.type === "list_updated" && (
                        <button
                          onClick={() => { track("notification_opened", { type: n.type }); onClose(); navigate(`/lista/${n.metadata?.collection_id ?? ""}`); }}
                          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                        >
                          {t("notif.see_list")}
                        </button>
                      )}
                      {(n.type === "collection_approved" || n.type === "collection_rejected") && (
                        <button
                          onClick={() => { track("notification_opened", { type: n.type }); onClose(); navigate("/moj-profil"); }}
                          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold active:scale-95 transition-transform"
                        >
                          {n.type === "collection_rejected" ? t("notif.see_details") : t("notif.see_lists")}
                        </button>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-center gap-1.5 ml-1">
                      {!n.read && (
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                      )}
                      <button
                        onClick={() => deleteOneMutation.mutate(n.id)}
                        className="h-6 w-6 rounded-full bg-muted flex items-center justify-center active:bg-muted/80"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
