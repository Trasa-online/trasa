import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { X, UserCheck, Route, Bookmark, CheckCircle2, XCircle, Heart, EyeOff, Users } from "lucide-react";
import { BrandChat, BrandBell, BrandUserPlus, BrandPin, BrandCamera, BrandIcon, STAR_ICON } from "@/components/BrandIcon";

const BrandStarIcon = ({ className }: { className?: string }) => <BrandIcon src={STAR_ICON} className={className} />;
import { formatDistanceToNow } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { avatarSrc } from "@/lib/avatar";
import { listTheme } from "@/lib/listThemes";
import SheetSkeleton from "@/components/layout/SheetSkeleton";
import { track } from "@/lib/analytics";
import { deferDelete } from "@/lib/deferDelete";
import { PushNudgeCard } from "@/components/permissions/PermissionPrimerSheet";
import { toast } from "sonner";
import { respondToCollectionInvite } from "@/lib/collectionInvite";
import { invalidateContentLists } from "@/lib/trash";

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

// ARKUSZ POWIADOMIEN - kierunek A "Skrzynka z sekcjami" (wybor Nat 2026-09-16, makiety
// w Figmie: [NEW] Ekrany > "Powiadomienia - eksploracja kierunkow").
//
// Trzy rzeczy, ktore zmienil ten kierunek wzgledem plaskiej listy:
//  1. SEKCJE. Zaproszenie wymaga decyzji, polubienie jest tylko mile - do 16.09 wygladaly
//     identycznie i stalu obok siebie w jednym strumieniu chronologicznym. Teraz na gorze
//     stoi "Wymaga odpowiedzi", pod nim "Nowe" (nieprzeczytane) i "Wczesniej".
//  2. STAN "NOWE" NIE GASNIE OD OTWARCIA. Wczesniej otwarcie arkusza oznaczalo WSZYSTKO
//     jako przeczytane, wiec sygnal zyl ulamek sekundy. Teraz przeczytane robi sie z akcji:
//     tapniecie wiersza albo jawne "oznacz wszystkie" w naglowku.
//  3. WIERSZ NIESIE KONTEKST. Typ zdarzenia = mala plakietka NA awatarze (a nie osobne
//     kolorowe kolko obok), a po prawej stoi miniatura tresci: okladka wyjazdu, kolor
//     kolekcji, logo lokalu. Bez niej zdanie "ktos dodal miejsce do kolekcji" nie mowilo,
//     do ktorej.
//
// ⛔ Kolory TYLKO z marki. Do 16.09 ikony typow chodzily w dziewieciu rodzinach kolorow
// (emerald, violet, sky, red, teal, amber...), z ktorych polowa nie wystepuje nigdzie indziej
// w aplikacji. Zostaly trzy tony marki: pomarancz (zaproszenia i reakcje), zloto (zmiany
// w tresci), braz (zapisy, czat, moderacja).
//
// ⚠️ Zaproszenie NIE ma dzis stanu "oczekujace": `add_member_to_collection` i
// `inviteUsersToRoute` dopisuja osobe OD RAZU. Dlatego guziki na karcie brzmia "Otworz"
// i "Nie teraz" (schowaj), a nie "Dolacz / Odrzuc" - inaczej obiecywalyby decyzje, ktorej
// baza nie zna. Wariant z prawdziwa akceptacja = kolumna `status` w czlonkostwach + RPC.
// AKTUALIZACJA 2026-09-21: zaproszenia do PLANU (`group_session_members.status`) i do
// KOLEKCJI (`discovery_collection_members.status`, migracja 20260921e) maja juz stan
// „oczekujace" - karta `route_invite` / `list_invite` ma dlatego guziki „Dolaczam" (RPC
// `respond_to_route_invite` / `respond_to_collection_invite`) i „Nie teraz" (= odmowa,
// wiersz zaproszenia znika); tapniecie w tresc karty otwiera plan/kolekcje do podgladu.

type NotifT = (key: string, opts?: Record<string, unknown>) => string;
type Tone = "orange" | "gold" | "brown";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; tone: Tone; label: (t: NotifT, username: string, metadata?: Record<string, string> | null) => string }> = {
  follower:       { icon: BrandUserPlus,      tone: "orange", label: (t, u) => t("notif.follower", { user: u }) },
  new_route:      { icon: Route,         tone: "gold",   label: (t, u) => t("notif.new_route", { user: u }) },
  route_updated:  { icon: Route,         tone: "gold",   label: (t, u) => t("notif.route_updated", { user: u }) },
  route_used:     { icon: Bookmark,      tone: "brown",  label: (t, u, m) => t(m?.city ? "notif.route_used_city" : "notif.route_used", { user: u, city: m?.city }) },
  pin_visit:      { icon: BrandPin,        tone: "gold",   label: (t, u) => t("notif.pin_visit", { user: u }) },
  friend_request: { icon: BrandUserPlus,      tone: "orange", label: (t, u) => t("notif.friend_request", { user: u }) },
  friend_accept:  { icon: UserCheck,     tone: "orange", label: (t, u) => t("notif.friend_accept", { user: u }) },
  visit_comment:  { icon: BrandChat, tone: "brown",  label: (t, u, m) => t(m?.place_name ? "notif.visit_comment_place" : "notif.visit_comment", { user: u, place: m?.place_name }) },
  photo_like:     { icon: Heart,         tone: "orange", label: (t, u, m) => t(m?.place_name ? "notif.photo_like_place" : "notif.photo_like", { user: u, place: m?.place_name }) },
  discovery_used: { icon: Bookmark,      tone: "brown",  label: (t, u, m) => t(m?.city ? "notif.discovery_used_city" : "notif.discovery_used", { user: u, city: m?.city }) },
  group_invite:       { icon: Users, tone: "orange", label: (t, u, m) => t(m?.city ? "notif.group_invite_city" : "notif.group_invite", { user: u, city: m?.city }) },
  route_invite:       { icon: Users, tone: "orange", label: (t, u, m) => t(m?.city ? "notif.route_invite_city" : "notif.route_invite", { user: u, city: m?.city }) },
  trip_places_reminder: { icon: BrandPin, tone: "gold", label: (t, u, m) => t(m?.city ? "notif.trip_places_reminder_city" : "notif.trip_places_reminder", { user: u, city: m?.city }) },
  trip_message:       { icon: BrandChat, tone: "brown", label: (t, u, m) => t(m?.title ? "notif.trip_message_title" : m?.city ? "notif.trip_message_city" : "notif.trip_message", { user: u, title: m?.title, city: m?.city }) },
  group_route_ready:  { icon: Route, tone: "gold", label: (t, u, m) => t(m?.city ? "notif.group_route_ready_city" : "notif.group_route_ready", { user: u, city: m?.city }) },
  collection_approved: { icon: CheckCircle2, tone: "gold",  label: (t, _u, m) => t("notif.collection_approved", { title: m?.title ?? t("notif.list_fallback") }) },
  collection_rejected: { icon: XCircle,      tone: "brown", label: (t, _u, m) => t(m?.moderation_note ? "notif.collection_rejected_reason" : "notif.collection_rejected", { title: m?.title ?? t("notif.list_fallback"), reason: m?.moderation_note }) },
  // Opublikowany wyjazd bez okladki nie przechodzi bramki eksploracji. Ikona przekreslonego
  // oka, bo problem brzmi "nikt tego nie widzi", a nie "cos poszlo nie tak".
  route_hidden:   { icon: EyeOff,   tone: "gold",  label: (t, _u, m) => t("notif.route_hidden", { count: Number(m?.count ?? 1) }) },
  route_liked:    { icon: Heart,    tone: "orange", label: (t, u, m) => t(m?.city ? "notif.route_liked_city" : "notif.route_liked", { user: u, city: m?.city }) },
  list_liked:     { icon: Heart,    tone: "orange", label: (t, u, m) => t(m?.title ? "notif.list_liked_title" : "notif.list_liked", { user: u, title: m?.title }) },
  list_saved:     { icon: Bookmark, tone: "brown",  label: (t, u, m) => t(m?.title ? "notif.list_saved_title" : "notif.list_saved", { user: u, title: m?.title }) },
  list_updated:   { icon: BrandPin,   tone: "gold",   label: (t, u, m) => t(m?.title ? "notif.list_updated_title" : "notif.list_updated", { user: u, title: m?.title }) },
  list_invite:    { icon: Users,    tone: "orange", label: (t, u, m) => t(m?.title ? "notif.list_invite_title" : "notif.list_invite", { user: u, title: m?.title }) },
  // Gwiazdka od wspoltworcy w mojej kolekcji (2026-09-20) - reakcja, wiec pomarancz.
  list_starred:   { icon: BrandStarIcon, tone: "orange", label: (t, u, m) => t(m?.place_name ? "notif.list_starred_place" : "notif.list_starred", { user: u, place: m?.place_name, title: m?.title }) },
  business_thanks: { icon: Heart, tone: "orange", label: (t, _u, m) =>
    t(m?.kind === "photo" ? "notif.business_thanks_photo" : "notif.business_thanks", { business: m?.business_name ?? t("notif.business_fallback") }) },
  // Tresc liczona z metadanych kompletnosci (enqueue_trip_reminders): ZDJECIA maja priorytet,
  // potem notki, a na koncu zacheta do publikacji.
  trip_reminder:  { icon: BrandCamera,   tone: "gold",   label: (t, _u, m) => {
    const city = m?.city ? t("notif.city_suffix", { city: m.city }) : "";
    const photos = Number(m?.missing_photos ?? 0);
    const notes = Number(m?.missing_notes ?? 0);
    if (photos > 0) return t("notif.reminder_photos", { count: photos, city });
    if (notes > 0) return t("notif.reminder_notes", { count: notes, city });
    return t("notif.reminder_publish", { city });
  } },
};

const TONE_CLASS: Record<Tone, string> = {
  orange: "bg-primary text-white",
  gold: "bg-[#FDCD84] text-[#5B2C06]",
  brown: "bg-[#5B2C06] text-white",
};

// Typy, ktore CZEGOS OD CIEBIE CHCA. Tylko one trafiaja do sekcji "Wymaga odpowiedzi"
// i dostaja szersza karte z guzikami - reszta jest informacja, nie zadaniem.
const ACTION_TYPES = new Set(["route_invite", "group_invite", "list_invite", "friend_request"]);

/** Dokad prowadzi tapniecie w wiersz. `null` = powiadomienie bez celu (nie jest klikalne). */
function targetOf(n: Notification): { to: string; state?: unknown } | null {
  const rid = n.route_id ?? n.metadata?.route_id ?? null;
  const cid = n.metadata?.collection_id ?? null;
  const actorUsername = n.actor?.username ?? null;
  switch (n.type) {
    case "trip_message":
      return rid ? { to: `/route/${rid}`, state: { openChat: true } } : null;
    case "route_invite":
    case "group_invite":
    case "group_route_ready":
    case "trip_places_reminder":
    case "trip_reminder":
    case "route_liked":
    case "route_used":
    case "route_updated":
    case "route_hidden":
    case "new_route":
      return rid ? { to: `/route/${rid}` } : { to: "/moj-profil?tab=wyjazdy" };
    case "list_invite":
    case "list_starred":
    case "list_updated":
    case "list_liked":
    case "list_saved":
    case "discovery_used":
      return cid ? { to: `/lista/${cid}` } : { to: "/moj-profil?tab=listy" };
    case "collection_approved":
    case "collection_rejected":
      return cid ? { to: `/lista/${cid}` } : { to: "/moj-profil?tab=listy" };
    case "friend_request":
    case "friend_accept":
    case "follower":
      // "X zaczal Cie obserwowac" - najbardziej naturalny cel to profil TEJ osoby, nie wlasny.
      return actorUsername ? { to: `/profil/${actorUsername}` } : { to: "/moj-profil" };
    default:
      return null;
  }
}

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

  // MINIATURY TRESCI. Jedno zapytanie na wyjazdy i jedno na kolekcje - nie po jednym na wiersz.
  // Kolekcja nie ma okladki (kafelek w Eksploracji to kolor + siatka miejsc), wiec jej
  // miniatura to KOLOR PRZEWODNI z palety: ta sama tozsamosc, ktora user widzi w siatce.
  const routeIds = useMemo(
    () => [...new Set(notifications.map(n => n.route_id ?? n.metadata?.route_id).filter(Boolean) as string[])],
    [notifications],
  );
  const collectionIds = useMemo(
    () => [...new Set(notifications.map(n => n.metadata?.collection_id).filter(Boolean) as string[])],
    [notifications],
  );
  const hasThumbSources = routeIds.length + collectionIds.length > 0;
  const { data: thumbs = {} } = useQuery({
    queryKey: ["notif-thumbs", userId, routeIds.join(","), collectionIds.join(",")],
    enabled: open && hasThumbSources,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, { photo?: string; color?: string }> = {};
      if (routeIds.length > 0) {
        const { data } = await (supabase as any)
          .from("routes").select("id, list_cover_url, cover_url").in("id", routeIds);
        for (const r of (data ?? []) as any[]) {
          const photo = r.list_cover_url ?? r.cover_url ?? undefined;
          if (photo) map[`r:${r.id}`] = { photo };
        }
      }
      if (collectionIds.length > 0) {
        const { data } = await (supabase as any)
          .from("discovery_collections").select("id, theme").in("id", collectionIds);
        for (const c of (data ?? []) as any[]) map[`c:${c.id}`] = { color: listTheme(c.theme, c.id).bg };
      }
      return map;
    },
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

  const refreshNotifs = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
  };

  // Kasowanie powiadomien szlo BEZ SLOWA i bez odwrotu - a "wyczysc wszystkie" to operacja
  // masowa. Commit jest ODROCZONY o okno "Cofnij": wiersze powiadomien wstawia SECURITY DEFINER
  // (user nie ma polityki INSERT), wiec przywrocenie po fakcie bylo by niemozliwe - jedyna
  // uczciwa droga to nie wykonac usuniecia (zgloszenie Nat 2026-09-09).
  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      queryClient.setQueryData(["notifications", userId], (prev: any) =>
        Array.isArray(prev) ? prev.filter((n: any) => n.id !== id) : prev);
      deferDelete({
        message: t("notifications.deleted"),
        commit: async () => { await supabase.from("notifications").delete().eq("id", id); refreshNotifs(); },
        onUndo: refreshNotifs,
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      queryClient.setQueryData(["notifications", userId], []);
      deferDelete({
        message: t("notifications.cleared"),
        commit: async () => { await supabase.from("notifications").delete().eq("user_id", userId); refreshNotifs(); },
        onUndo: refreshNotifs,
      });
    },
  });

  // Oznaczanie przeczytanych jest teraz AKCJA, nie efektem ubocznym otwarcia arkusza:
  // pojedynczy wiersz gasnie, gdy w niego wejdziesz albo go schowasz, a "oznacz wszystkie"
  // w naglowku gasi cala liste. Optymistycznie, zeby kropka znikala pod palcem.
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      queryClient.setQueryData(["notifications", userId], (prev: any) =>
        Array.isArray(prev) ? prev.map((n: any) => (ids.includes(n.id) ? { ...n, read: true } : n)) : prev);
      await supabase.from("notifications").update({ read: true }).in("id", ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });

  // Przejscie z powiadomienia: NAJPIERW nawigacja, zamkniecie arkusza dopiero w nastepnym
  // tiku (zgloszenie Nat 2026-09-15: "klikam Zobacz i laduje na zupelnie innym wyjezdzie,
  // a cofniecie wraca na wlasciwy" - czyli w historii ladowaly DWA wpisy).
  // ⚠️ `onClose()` wolane synchronicznie PRZED `navigate` zdejmuje nakladke arkusza jeszcze
  // w trakcie obslugi tapniecia, wiec dogenerowany `click` trafia w to, co bylo POD spodem -
  // a pod spodem jest feed Eksploracji, czyli kafelki innych wyjazdow. Stad druga nawigacja.
  // Trzymanie nakladki do konca zdarzenia i zamykanie jej po nawigacji usuwa ten przeskok.
  const go = (to: string, opts?: { state?: unknown }) => {
    navigate(to, opts as any);
    setTimeout(onClose, 0);
  };

  const openNotif = (n: Notification) => {
    const target = targetOf(n);
    track("notification_opened", { type: n.type });
    if (!n.read) markRead.mutate([n.id]);
    if (target) go(target.to, target.state ? { state: target.state } : undefined);
  };

  const unread = notifications.filter(n => !n.read);
  const unreadCount = unread.length;
  const hasUnread = unreadCount > 0;
  const hasAny = notifications.length > 0;

  // Sekcje kierunku A. Naglowek pojawia sie WYLACZNIE dla niepustej sekcji - przy koncie
  // bez zaproszen arkusz wyglada jak zwykla lista, bez pustych szufladek.
  const sections = useMemo(() => {
    const action: Notification[] = [];
    const fresh: Notification[] = [];
    const earlier: Notification[] = [];
    for (const n of notifications) {
      if (ACTION_TYPES.has(n.type) && !n.read) action.push(n);
      else if (!n.read) fresh.push(n);
      else earlier.push(n);
    }
    return { action, fresh, earlier };
  }, [notifications]);

  const thumbFor = (n: Notification) => {
    const rid = n.route_id ?? n.metadata?.route_id;
    const cid = n.metadata?.collection_id;
    if (n.type === "business_thanks" && n.metadata?.logo_url) return { photo: n.metadata.logo_url };
    if (rid && thumbs[`r:${rid}`]) return thumbs[`r:${rid}`];
    if (cid && thumbs[`c:${cid}`]) return thumbs[`c:${cid}`];
    return null;
  };

  const renderRow = (n: Notification) => {
    const cfg = TYPE_CONFIG[n.type] ?? {
      icon: BrandBell,
      tone: "brown" as Tone,
      label: (tt: NotifT, u: string) => tt("notif.fallback", { user: u }),
    };
    const Icon = cfg.icon;
    const username = n.actor?.username ?? t("notif.someone");
    const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale() });
    const thumb = thumbFor(n);
    // CALY wiersz - awatar, zdanie i miniatura - prowadzi do JEDNEGO celu (2026-09-18).
    // Do tego dnia awatar mial WLASNY cel (profil autora), a zdanie obok - tresc. PostHog
    // pokazal, ze userzy tapaja w awatar z plakietka typu (najbardziej "klikalny" element
    // wiersza) i laduja na profilu autora zamiast w wyjezdzie czy kolekcji, a przy
    // przypomnieniu o wyjezdzie (bez autora) tapniecie w awatar nie robilo NIC - stad
    // zgloszenie Nat "nie dziala przekierowanie z powiadomien do wyjazdu". Profil autora
    // jest o jedno tapniecie dalej - z pigulki autora w samym wyjezdzie/kolekcji.
    const tappable = !!targetOf(n);
    const open = tappable ? () => openNotif(n) : undefined;

    return (
      <div key={n.id} className="relative flex items-start gap-3 py-3 pl-5 pr-4">
        {/* Kropka nieprzeczytanego: sygnal nosi KROPKA, nie tlo calego wiersza - tlo
            bg-primary/5 ginelo pod peachy karta zaproszenia i pod kolorem kolekcji. */}
        {!n.read && <span className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" aria-hidden />}
        <div
          className={`relative flex-shrink-0 ${open ? "active:opacity-70 transition-opacity" : ""}`}
          onClick={open}
        >
          <img
            src={n.type === "business_thanks" && n.metadata?.logo_url
              ? n.metadata.logo_url
              : avatarSrc(n.actor?.avatar_url)}
            alt={n.type === "business_thanks" ? String(n.metadata?.business_name ?? "") : username}
            className="h-10 w-10 rounded-full object-cover bg-orange-100"
            loading="lazy"
          />
          {/* Plakietka TYPU na awatarze zamiast osobnego kolorowego kolka obok tekstu. */}
          <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-background ${TONE_CLASS[cfg.tone]}`}>
            <Icon className="h-3 w-3" />
          </div>
        </div>
        <div
          className={`flex-1 min-w-0 ${tappable ? "active:opacity-70 transition-opacity" : ""}`}
          onClick={open}
          role={tappable ? "button" : undefined}
        >
          <p className="text-sm leading-snug text-foreground/85">{cfg.label(t, username, n.metadata)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
        </div>
        {thumb?.photo && (
          <img src={thumb.photo} alt="" loading="lazy"
            className="h-11 w-11 flex-shrink-0 rounded-xl object-cover bg-muted"
            onClick={open} />
        )}
        {!thumb?.photo && thumb?.color && (
          <span className="h-11 w-11 flex-shrink-0 rounded-xl" style={{ background: thumb.color }}
            onClick={open} aria-hidden />
        )}
        <button
          onClick={() => deleteOneMutation.mutate(n.id)}
          aria-label={t("notif.remove")}
          className="h-6 w-6 flex-shrink-0 self-center rounded-full bg-muted flex items-center justify-center active:bg-muted/80"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  // Karta zaproszenia: jedyne wypelnione tlo w arkuszu (peachy), zeby rzecz wymagajaca
  // decyzji nie wygladala jak kolejny wiersz. Pomarancz zostaje na guziku.
  // Zaproszenie do planu / kolekcji: prawdziwa decyzja, nie tylko schowanie karty.
  const isMembershipInvite = (n: Notification) => n.type === "route_invite" || n.type === "group_invite" || n.type === "list_invite";
  const respondInvite = async (n: Notification, accept: boolean) => {
    const rid = n.route_id ?? n.metadata?.route_id ?? null;
    const cid = n.metadata?.collection_id ?? null;
    let ok = false;
    if (n.type === "list_invite" && cid) {
      ok = await respondToCollectionInvite(cid, accept);
    } else if (rid) {
      let sid = n.metadata?.session_id ?? null;
      if (!sid) {
        const { data } = await (supabase as any).from("routes").select("group_session_id").eq("id", rid).maybeSingle();
        sid = data?.group_session_id ?? null;
      }
      if (sid) {
        const { data, error } = await (supabase as any).rpc("respond_to_route_invite", { p_session_id: sid, p_accept: accept });
        ok = !error && data?.ok !== false;
      }
    }
    // Zaproszenie moglo juz wygasnac (host je cofnal, user odpowiedzial z widoku) - wtedy
    // karta i tak ma zniknac, bez straszenia bledem.
    markRead.mutate([n.id]);
    invalidateContentLists();
    queryClient.invalidateQueries({ queryKey: ["collection-members"] });
    queryClient.invalidateQueries({ queryKey: ["shared-route-invite"] });
    queryClient.invalidateQueries({ queryKey: ["shared-route-membership"] });
    if (!ok) { toast(t("notif.invite_gone")); return; }
    if (accept) {
      toast.success(t("notif.invite_joined"));
      const target = targetOf(n);
      if (target) go(target.to);
    } else {
      toast(t("notif.invite_declined"));
    }
  };

  const renderInvite = (n: Notification) => {
    const cfg = TYPE_CONFIG[n.type];
    const membership = isMembershipInvite(n);
    const username = n.actor?.username ?? t("notif.someone");
    const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale() });
    const Icon = cfg?.icon ?? Users;
    return (
      <div key={n.id} className="mx-4 mb-3 rounded-3xl bg-[#FCEDE3] p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={avatarSrc(n.actor?.avatar_url)}
              alt={username}
              className="h-10 w-10 rounded-full object-cover bg-orange-100"
              loading="lazy"
            />
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-[#FCEDE3] bg-primary text-white">
              <Icon className="h-3 w-3" />
            </div>
          </div>
          {/* Tresc karty = podglad (otwiera plan / kolekcje BEZ decyzji), guziki = decyzja. */}
          <button onClick={() => { track("notification_opened", { type: n.type }); const tg = targetOf(n); if (tg) go(tg.to, tg.state ? { state: tg.state } : undefined); }} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold leading-snug text-[#5B2C06]">
              {cfg ? cfg.label(t, username, n.metadata) : t("notif.fallback", { user: username })}
            </p>
            <p className="text-[11px] text-[#9A7B63] mt-0.5">{timeAgo}</p>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => (membership ? void respondInvite(n, true) : openNotif(n))}
            className="flex-1 h-10 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.98] transition-transform"
          >
            {membership ? t("notif.invite_accept") : t("notif.open_invite")}
          </button>
          <button
            onClick={() => (membership ? void respondInvite(n, false) : markRead.mutate([n.id]))}
            className="flex-1 h-10 rounded-full bg-white border border-[#E6D6C8] text-[#5B2C06] text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            {t("notif.dismiss")}
          </button>
        </div>
      </div>
    );
  };

  const sectionHeader = (label: string, count?: number) => (
    <div className="flex items-center gap-2 px-5 pb-2 pt-4">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#5B2C06]">{label}</span>
      {count !== undefined && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </div>
  );

  // Arkusz zamiast recznego overlaya: dostaje animacje wysuniecia z dolu (Radix data-state)
  // oraz wspolny gest "przeciagnij w dol, zeby zamknac" z <SheetContent side="bottom">.
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl border-0 bg-background flex flex-col overflow-hidden [&>button:last-child]:hidden"
        style={{ height: "85dvh" }}
      >
        <SheetTitle className="sr-only">{t("notif.title")}</SheetTitle>
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex items-center px-5 pb-4 pt-1">
          <h2 className="text-lg font-bold flex-1">
            {t("notif.title")}
            {hasUnread && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </h2>
          {/* Jeden guzik tekstowy, ktory zmienia role: dopoki cos jest nowe, najpilniejsza
              akcja to zgaszenie sygnalu; gdy juz nic nie swieci - sprzatniecie listy. */}
          {hasAny && (
            <button
              onClick={() => (hasUnread ? markRead.mutate(unread.map(n => n.id)) : clearAllMutation.mutate())}
              disabled={clearAllMutation.isPending}
              className="text-xs text-muted-foreground font-medium mr-2 active:opacity-60"
            >
              {hasUnread ? t("notif.mark_all") : t("notif.clear")}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* Zgoda na push w kontekscie dzwonka: user sam tu zajrzal, wiec powiadomienia go
              interesuja. Karta znika, gdy zgoda jest; przy odmowie prowadzi do Ustawien. */}
          <PushNudgeCard open={open} className="mx-4 mb-3" />
          {isLoading ? (
            <SheetSkeleton variant="notifications" rows={5} className="px-4 pt-2" />
          ) : !hasAny ? (
            <div className="flex flex-col items-center px-8 pt-10 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FCEDE3]">
                <BrandBell className="h-10 w-10 text-primary" fill="currentColor" />
              </div>
              <p className="mt-6 text-lg font-bold leading-snug text-foreground">{t("notif.empty_title")}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("notif.empty_desc")}</p>
              <button
                onClick={() => go("/moj-profil?tab=listy")}
                className="mt-6 text-sm font-bold text-primary active:opacity-70"
              >
                {t("notif.empty_cta")}
              </button>
            </div>
          ) : (
            <div>
              {sections.action.length > 0 && (
                <>
                  {sectionHeader(t("notif.section_action"), sections.action.length)}
                  {sections.action.map(renderInvite)}
                </>
              )}
              {sections.fresh.length > 0 && (
                <>
                  {sectionHeader(t("notif.section_new"))}
                  {sections.fresh.map(renderRow)}
                </>
              )}
              {sections.earlier.length > 0 && (
                <>
                  {sectionHeader(t("notif.section_earlier"))}
                  {sections.earlier.map(renderRow)}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
