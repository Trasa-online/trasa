import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { avatarSrc } from "@/lib/avatar";
import AvatarFrame from "@/components/profile/AvatarFrame";
import { isAvatarFrame } from "@/lib/avatarFrames";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { toggleRouteLike } from "@/lib/likes";
import { saveCollectionDb, unsaveCollectionDb } from "@/lib/savedCollections";
import { ArrowLeft } from "lucide-react";
import { BrandIcon, LIST_ICON, STAR_ICON, BrandUserPlus } from "@/components/BrandIcon";
import StarredPlacesSheet, { useStarredPlaces } from "@/components/profile/StarredPlacesSheet";
import { haptics } from "@/hooks/useHaptics";
import { applyTripOrder, fetchTripOrder, tripOrderKey } from "@/lib/tripOrder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FriendButton from "@/components/social/FriendButton";
import ReportContentSheet from "@/components/moderation/ReportContentSheet";
import { blockUser, unblockUser, isUserBlocked } from "@/lib/blockedUsers";
import { MoreVertical, Ban, Flag as FlagIcon } from "lucide-react";
import { useFollowCounts, useIsFollowing, followUser, unfollowUser } from "@/hooks/useFollow";
import PeopleSheet, { type PeopleTab } from "@/components/profile/PeopleSheet";
import { useFriendIds } from "@/lib/friends";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { GridTile, type GridItem } from "@/components/home/FeedTiles";
import { useStickyHeadVar } from "@/hooks/useStickyHeadVar";
import { scrollTopTapProps } from "@/lib/scrollTop";
import { listTheme } from "@/lib/listThemes";
import { fetchListVisitCounts } from "@/lib/placeVisits";
import { fetchCollectionMembersBulk } from "@/lib/collectionInvite";
import { TripLayoutSwitch, TripTile, mosaicColumns, useTripLayout, MOSAIC_OFFSET } from "@/components/profile/TripLayout";
import { scopeLabel } from "@/lib/tripScope";
// Karta wyjazdu 1:1 z eksploracja (na profilu bez mapki) - prosba Nat 2026-08-30.
import TrasaBigCard from "@/components/home/TrasaBigCard";
import ScreenSkeleton from "@/components/layout/ScreenSkeleton";
import { resolveStored } from "@/components/PlacePhoto";
import { SpontawayTabIcon } from "@/components/profile/SpontawayTabIcon";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";

// Stala pusta referencja - inaczej useMemo nizej liczylby sie na nowo w kazdym renderze.
const EMPTY_TRIPS: any[] = [];

// ── Empty state feedu (cudzy profil, read-only - bez CTA tworzenia) ─────────────
// Spojne wizualnie z "mój profil": peachy znak (maska SVG) LUB ikona w peachy kwadracie + opis.
function FeedEmptyRO({ icon, maskSrc, title, desc }: { icon?: React.ReactNode; maskSrc?: string; title: string; desc?: string }) {
  return (
    <div className="pt-14 pb-12 text-center px-8 flex flex-col items-center">
      {maskSrc ? (
        <span aria-hidden className="mb-4 block h-20 w-20" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: `url(${maskSrc})`, maskImage: `url(${maskSrc})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
      ) : (
        <div className="mb-3 h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center text-orange-500">{icon}</div>
      )}
      <p className="text-base font-bold text-foreground">{title}</p>
      {desc && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[280px]">{desc}</p>}
    </div>
  );
}

// Okladka karty wyjazdu: wybrana miniatura eksploracji > okladka wyjazdu > pierwsze zdjecie miejsca.
const tripCover = (tr: any): string | null => {
  const own = resolveStored(tr.cover);
  if (own) return own;
  for (const tile of (tr.tiles ?? []) as any[]) {
    const first = (v: any) => (Array.isArray(v) ? v.find((x: any) => typeof x === "string" && x) : null);
    const url = resolveStored(tile.image_url || first(tile.images) || first(tile.user_photo_urls) || tile.photo_url) ?? resolveStored(tile._cover);
    if (url) return url;
  }
  return null;
};

// "%" i "_" maja w LIKE znaczenie specjalne - w nazwie uzytkownika to zwykle znaki.
const escapeLike = (v: string) => v.replace(/[%_\\]/g, "\\$&");

export default function PublicProfile() {
  const { t } = useTranslation("profiles");
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Kolejnosc i domyslna zakladka 1:1 z wlasnym profilem: Wyjazdy | Listy (2026-08-30).
  // Zakladka w ADRESIE, nie tylko w stanie - inaczej powrot z listy remontuje profil
  // i laduje na domyslnych Wyjazdach (zgloszenie Nat 2026-09-08). `replace`, bo przelaczenie
  // zakladki to nie krok nawigacji.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"listy" | "wyjazdy">(searchParams.get("tab") === "listy" ? "listy" : "wyjazdy");
  // Uklad wyjazdow wspoldzielony z wlasnym profilem (ten sam localStorage) - wybor nalezy
  // do ogladajacego, wiec nie ma powodu, zeby na cudzym profilu resetowal sie do listy.
  const [tripLayout, setTripLayout] = useTripLayout();
  useEffect(() => {
    const tp = searchParams.get("tab");
    if (tp === "listy" || tp === "wyjazdy") setTab(tp);
  }, [searchParams]);
  const goTab = (t: "listy" | "wyjazdy") => {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };
  // Gest natywny: swipe w LEWO idzie Wyjazdy -> Listy (zgodnie z kolejnoscia pigulek).
  const swipeTabs = useSwipeNav({
    onLeft: () => goTab("listy"),
    onRight: () => goTab("wyjazdy"),
  });
  const [followSheet, setFollowSheet] = useState<PeopleTab | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      // ilike zamiast eq: nazwy w bazie potrafia miec inna wielkosc liter albo (historycznie)
      // spacje na brzegach - a link jest jeden. Dokladne dopasowanie zostaje, bo w ilike nie ma
      // znakow wieloznacznych; escapeLike chroni przed "%" i "_" wpisanym w nazwe.
      // Konto LOKALU (`is_business`) nie ma profilu publicznego w apce - dla linku
      // z wyszukiwarki czy powiadomienia wyglada jak nieistniejacy user (2026-09-21).
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, username, first_name, avatar_url, bio, avatar_frame, avatar_frame_color")
        .ilike("username", escapeLike((username ?? "").trim()))
        .eq("is_business", false)
        .maybeSingle();
      // `as unknown`: wygenerowane typy Supabase nie znaja jeszcze avatar_frame (types.ts
      // regenerowany osobno - CLAUDE.md), a kolumna w bazie jest (migracja 20260911f).
      return data as unknown as { id: string; username: string; first_name: string | null; avatar_url: string | null; bio: string | null; avatar_frame: string | null; avatar_frame_color: string | null } | null;
    },
    enabled: !!username,
  });

  // Liczniki follow (asymetryczny model, publiczny SELECT).
  const { data: followCounts = { followers: 0, following: 0 } } = useFollowCounts(profile?.id);
  const { data: starred = [] } = useStarredPlaces(profile?.id);
  // Znajomi tej osoby - baza liczy wzajemne obserwacje. ⛔ Dla CUDZEJ listy nie odejmuje
  // wykluczen: z roznicy dalo by sie odczytac, kogo ta osoba wypisala ze znajomych.
  const friendIds = useFriendIds(profile?.id);
  const [starredOpen, setStarredOpen] = useState(false);

  // Feed LIST (zakladka Listy): publiczne + zatwierdzone listy usera + kafelki miejsc + liczniki.
  const { data: listCards = [] } = useQuery({
    queryKey: ["public-list-feed", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const COLS = "id, user_id, title, city, countries, theme, list_status, description, tags, views_count, saves_count, likes_count, updated_at";
      // Te same bramki dla obu zapytan: TYLKO publiczne polecajki (visited). Prywatne wishlisty
      // "Do zobaczenia" (to_visit) NIGDY na cudzym profilu - guard nawet gdyby ktoras zostala
      // jako public+approved. Soft-moderacja: pending + approved widoczne, rejected/hidden nie.
      const guarded = (q: any) => q.eq("kind", "ranking").eq("list_status", "visited")
        .eq("is_public", true).eq("hidden_by_admin", false).neq("moderation_status", "rejected");
      // WSPOLTWORZONE kolekcje tez naleza do tego profilu (prosba Nat 2026-09-15; na WLASNYM
      // profilu dziala to od tego samego dnia). Bez tego kolekcja, do ktorej ktos zostal
      // zaproszony, nie pokazywala sie u niego nigdzie poza "Zapisane".
      // ⚠️ Odczyt `discovery_collection_members` przez OSOBE TRZECIA dziala od migracji
      // 20260915k - wczesniej polityka wpuszczala tylko wlasciciela i czlonkow, wiec ta lista
      // wracala pusta i wspoltworzone kolekcje po cichu znikaly z cudzego profilu.
      const { data: memberRows } = await (supabase as any)
        .from("discovery_collection_members").select("collection_id").eq("user_id", profile!.id).eq("status", "accepted");
      const memberIds = Array.from(new Set(((memberRows ?? []) as any[]).map((m) => m.collection_id)));
      // ⛔ DWA zapytania zamiast `.or(...)`: lista id w `id.in.(…)` ma przecinki w srodku
      // nawiasu, a PostgREST rozbija `or` po przecinkach i po cichu oddaje pustke.
      const [mineRes, sharedRes] = await Promise.all([
        guarded((supabase as any).from("discovery_collections").select(COLS).eq("user_id", profile!.id)),
        memberIds.length
          ? guarded((supabase as any).from("discovery_collections").select(COLS).in("id", memberIds))
          : Promise.resolve({ data: [] }),
      ]);
      const seen = new Set<string>();
      const rows = [...((mineRes.data ?? []) as any[]), ...((sharedRes.data ?? []) as any[])]
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, place_name, category, google_place_id, photo_url, order_index")
        .in("collection_id", ids).order("order_index", { ascending: true });
      const allItems = (items ?? []) as any[];
      const keys = Array.from(new Set(allItems.flatMap((it) => pinCoverKeys(it)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const byCol: Record<string, any[]> = {};
      for (const it of allItems) {
        const _cover = pickPlaceCover(photoMap, pinCoverKeys(it));
        (byCol[it.collection_id] ??= []).push({ ...it, _cover });
      }
      // "odwiedzone przez autora / wszystkie" - ten sam chip co na kafelku w eksploracji.
      const visits = await fetchListVisitCounts(ids).catch(() => new Map<string, number>());
      // Wspoltworcy - zeby bylo widac, ze kolekcja jest wspolna (prosba Nat 2026-09-15).
      const mem = await fetchCollectionMembersBulk(ids, new Map(rows.map((r) => [r.id, r.user_id]))).catch(() => new Map());
      // Wlasciciele kolekcji, ktorych ten user tylko WSPOLTWORZY - pigulka autora ma pokazac ich,
      // nie wlasciciela profilu.
      const ownerIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x) => x && x !== profile!.id)));
      const owners = new Map<string, any>();
      if (ownerIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, username, first_name, avatar_url, avatar_frame, avatar_frame_color").in("id", ownerIds);
        for (const pr of (profs ?? []) as any[]) owners.set(pr.id, pr);
      }
      return rows.map((r) => ({
        ...r, tiles: byCol[r.id] ?? [], visited_count: visits.get(r.id) ?? 0,
        co_authors: mem.get(r.id) ?? [], _owner: owners.get(r.user_id) ?? null,
      }));
    },
  });

  // Feed WYJAZDOW (zakladka Wyjazdy): publiczne trasy usera, zwiniete po folderze,
  // kafelki z pinow + liczniki (saved_routes / likes / routes.views).
  const { data: tripCardsRaw = EMPTY_TRIPS } = useQuery({
    queryKey: ["public-trip-feed", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const cols = "id, title, city, countries, start_date, day_number, folder_id, views, saves_count, likes_count, created_at, user_id, tags, review_narrative, ai_summary, cover_url, list_cover_url";
      // WLASNE wyjazdy usera...
      // ⛔ `status = 'published'` JEST OBOWIAZKOWY. `is_shared` NIE oznacza "opublikowany"
      // od 2026-08-23 (model roboczy->przeszly): `inviteUsersToRoute` ustawia je KAZDEMU
      // wyjazdowi grupowemu, takze roboczemu, zeby zaproszeni go odczytali. Bez tego warunku
      // profil publiczny pokazywal ROBOCZE wyjazdy grupowe (zgloszenie Nat 2026-09-16).
      // ⚠️ Samo zaostrzenie RLS (migracja 20260916c) tego NIE zalatwia: uczestnik wyjazdu
      // czyta szkic przez polityke po czlonkostwie, wiec wchodzac na profil hosta nadal by go
      // widzial. Widok musi o szkice po prostu nie pytac.
      const { data: routes } = await (supabase as any)
        .from("routes").select(cols)
        .eq("user_id", profile!.id).eq("is_shared", true).eq("status", "published").eq("hidden_by_admin", false)
        .order("created_at", { ascending: false });
      // ...ORAZ wyjazdy GRUPOWE, w ktorych bral udzial (nie jest hostem) - przez RPC.
      //
      // NIE pytaj o to klientem. Poprzednia wersja szukala sesji usera w group_session_members,
      // ale polityka SELECT na tej tabeli przepuszcza tylko sesje, w ktorych TY jestes czlonkiem.
      // Widz spoza grupy dostawal wiec pusta liste - bez bledu, po cichu - i wspolny wyjazd
      // znikal z profilu uczestnika, choc na profilu hosta byl widoczny (zgloszenia Nat
      // 2026-08-31 i 2026-09-05). Funkcja oddaje wylacznie wyjazdy juz publiczne, wiec nic
      // nowego nie ujawnia: migracja 20260905_public_group_routes_for_user.sql.
      const { data: groupData } = await (supabase as any)
        .rpc("public_group_routes_for_user", { p_user: profile!.id });
      const groupRows = (groupData ?? []) as any[];
      const seenRoute = new Set<string>();
      const rows = [...((routes ?? []) as any[]), ...groupRows]
        .filter((r) => { if (seenRoute.has(r.id)) return false; seenRoute.add(r.id); return true; });
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      // saves_count/likes_count = kolumny na routes (denormalizacja - RLS na saved_routes blokuje
      // count po stronie klienta). Patrz migracja 20260828.
      const pinsRes = await (supabase as any).from("pins").select("id, route_id, place_name, category, photo_url, image_url, images, user_photo_urls, pin_order, latitude, longitude").in("route_id", ids).order("pin_order", { ascending: true });
      const allPins = (pinsRes.data ?? []) as any[];
      const keys = Array.from(new Set(allPins.flatMap((p) => pinCoverKeys(p)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const pinsByRoute: Record<string, any[]> = {};
      for (const p of allPins) {
        const _cover = pickPlaceCover(photoMap, pinCoverKeys(p));
        (pinsByRoute[p.route_id] ??= []).push({ ...p, _cover });
      }
      const folderMap = new Map<string, any[]>();
      const grouped: { rep: any; days: any[] }[] = [];
      for (const r of rows) {
        if (r.folder_id) {
          if (!folderMap.has(r.folder_id)) folderMap.set(r.folder_id, []);
          folderMap.get(r.folder_id)!.push(r);
        } else grouped.push({ rep: r, days: [r] });
      }
      for (const days of folderMap.values()) {
        const sorted = [...days].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
        grouped.push({ rep: sorted[0], days: sorted });
      }
      grouped.sort((a, b) => new Date(b.rep.created_at ?? 0).getTime() - new Date(a.rep.created_at ?? 0).getTime());
      // Hostowie wyjazdow grupowych - na karcie ma byc autor wyjazdu, nie wlasciciel profilu.
      const hostIds = [...new Set(grouped.map(({ rep }) => rep.user_id).filter((u) => u && u !== profile!.id))];
      const hostById = new Map<string, { username: string | null; first_name: string | null; avatar_url: string | null }>();
      if (hostIds.length) {
        const { data: hosts } = await (supabase as any).from("profiles").select("id, username, first_name, avatar_url").in("id", hostIds);
        for (const h of hosts ?? []) hostById.set(h.id, h);
      }
      return grouped.map(({ rep, days }) => ({
        id: rep.id,
        city: rep.city,
        title: rep.title,
        start_date: rep.start_date,
        created_at: rep.created_at,
        description: (rep.review_narrative || rep.ai_summary || "").trim() || null,
        tags: Array.isArray(rep.tags) ? rep.tags : [],
        cover: rep.list_cover_url ?? rep.cover_url ?? null,
        is_host: rep.user_id === profile!.id,
        host_id: rep.user_id ?? null,
        host_name: rep.user_id === profile!.id ? null : (hostById.get(rep.user_id)?.first_name || hostById.get(rep.user_id)?.username || null),
        host_avatar: rep.user_id === profile!.id ? null : (hostById.get(rep.user_id)?.avatar_url ?? null),
        tiles: days.flatMap((d) => pinsByRoute[d.id] ?? []),
        saves: Number(rep.saves_count ?? 0),
        likes: Number(rep.likes_count ?? 0),
        views: Number(rep.views ?? 0),
      }));
    },
  });

  // Uklad okladek ustawiony przez wlasciciela profilu (przytrzymaj i przestaw na wlasnym
  // profilu, tabela profile_trip_order) - tu tylko go odtwarzamy, bez edycji.
  const { data: tripOrder } = useQuery({
    queryKey: tripOrderKey(profile?.id),
    enabled: !!profile?.id,
    queryFn: () => fetchTripOrder(profile!.id),
    staleTime: 60_000,
  });
  const tripCards = useMemo(() => applyTripOrder(tripCardsRaw as any[], tripOrder), [tripCardsRaw, tripOrder]);

  // ── Interaktywne polubienie/zapis z kart (cudzy profil, wybor Nat 2026-08-23) ──
  // Serce/bookmark na karcie = przycisk. Wlasny publiczny profil -> licznik (nie polubisz swojego).
  const canInteract = !!user && !!profile?.id && user.id !== profile.id;
  // Moderacja (wymog App Store 1.2): menu "..." z blokowaniem i zgloszeniem profilu.
  const [menuOpen, setMenuOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const { data: isFollowing = false } = useIsFollowing(user?.id, profile?.id);
  const toggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    try {
      haptics.light();
      if (isFollowing) await unfollowUser(profile.id); else await followUser(profile.id);
      queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, profile.id] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["following-ids", user?.id] });
      toast(isFollowing ? t("public.unfollowed") : t("public.followed"));
      setMenuOpen(false);
    } catch {
      toast.error(t("people.follow_failed"));
    } finally { setFollowBusy(false); }
  };
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!user?.id || !profile?.id || user.id === profile.id) return;
    isUserBlocked(user.id, profile.id).then(setBlocked).catch(() => {});
  }, [user?.id, profile?.id]);
  const toggleBlock = async () => {
    if (!user?.id || !profile?.id) return;
    setMenuOpen(false);
    if (blocked) {
      if (await unblockUser(user.id, profile.id)) { setBlocked(false); toast.success("Odblokowano"); }
      return;
    }
    if (await blockUser(user.id, profile.id)) {
      setBlocked(true);
      toast.success(t("public.blocked_toast"));
      queryClient.invalidateQueries();
    }
  };
  const listIds = useMemo(() => (listCards as any[]).map((l) => l.id), [listCards]);
  const tripIds = useMemo(() => (tripCards as any[]).map((tr) => tr.id), [tripCards]);

  const { data: init } = useQuery({
    queryKey: ["pp-interactions", user?.id, listIds.join(","), tripIds.join(",")],
    enabled: canInteract && (listIds.length > 0 || tripIds.length > 0),
    queryFn: async () => {
      // Listy nie maja juz polubien (decyzja Nat 2026-09-01) - pytamy tylko o trasy.
      // Zapis CALEGO wyjazdu wrocil 2026-09-11 (po krotkim zdjeciu 2026-09-10), wiec
      // znow potrzebujemy stanu bookmarka na karcie cudzego profilu.
      const [lt, st] = await Promise.all([
        tripIds.length ? (supabase as any).from("likes").select("route_id").eq("user_id", user!.id).in("route_id", tripIds) : Promise.resolve({ data: [] }),
        tripIds.length ? (supabase as any).from("saved_routes").select("route_id").eq("user_id", user!.id).in("route_id", tripIds) : Promise.resolve({ data: [] }),
      ]);
      return {
        likedTrips: new Set<string>(((lt as any).data ?? []).map((r: any) => r.route_id)),
        savedTrips: new Set<string>(((st as any).data ?? []).map((r: any) => r.route_id)),
      };
    },
  });
  const initLikedTrips = init?.likedTrips ?? new Set<string>();
  const initSavedTrips = init?.savedTrips ?? new Set<string>();
  // Optymistyczne override + snapshot zapisanych list (localStorage, per-urzadzenie) do delty licznika.
  const [likeOverride, setLikeOverride] = useState<Record<string, boolean>>({});
  const [saveOverride, setSaveOverride] = useState<Record<string, boolean>>({});
  const [savedListIds, setSavedListIds] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")); } catch { return new Set(); }
  });

  const isTripLiked = (id: string) => likeOverride["t:" + id] ?? initLikedTrips.has(id);
  const isTripSaved = (id: string) => saveOverride["t:" + id] ?? initSavedTrips.has(id);
  const isListSaved = (id: string) => savedListIds.has(id);

  const onTripLike = (tr: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isTripLiked(tr.id);
    setLikeOverride((m) => ({ ...m, ["t:" + tr.id]: !cur }));
    void toggleRouteLike(tr.id, user.id, cur);
  };
  const onTripSave = async (tr: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isTripSaved(tr.id);
    setSaveOverride((m) => ({ ...m, ["t:" + tr.id]: !cur }));
    if (cur) {
      await (supabase as any).from("saved_routes").delete().eq("user_id", user.id).eq("route_id", tr.id);
      // Cofalne - "Cofnij" po prostu wykonuje te sama akcje jeszcze raz (zapisuje z powrotem).
      toast(t("public.removed_saved"), { action: { label: t("common:buttons.undo"), onClick: () => void onTripSave(tr) } });
    } else {
      await (supabase as any).from("saved_routes").upsert({ user_id: user.id, route_id: tr.id }, { onConflict: "user_id,route_id", ignoreDuplicates: true });
      void (supabase as any).rpc("notify_route_used", { p_route_id: tr.id });
      toast.success(t("public.trip_saved"));
    }
    queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
    queryClient.invalidateQueries({ queryKey: ["profile-saved-trip-feed"] });
  };
  const onListSave = (l: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isListSaved(l.id);
    const next = new Set(savedListIds);
    const dates = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
    if (cur) {
      next.delete(l.id); delete dates[l.id]; void unsaveCollectionDb(user.id, l.id);
      toast(t("public.removed_saved"), { action: { label: t("common:buttons.undo"), onClick: () => onListSave(l) } });
    }
    else {
      next.add(l.id); dates[l.id] = new Date().toISOString(); toast.success(t("public.list_saved"));
      void (supabase as any).rpc("notify_collection_saved", { p_collection_id: l.id });
      void saveCollectionDb(user.id, l.id);
    }
    try {
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...next]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
    } catch { /* localStorage niedostepny */ }
    setSavedListIds(next);
  };

  // ⛔ NAD early-returnami - inaczej przy pierwszym renderze (profil sie laduje) Reactowi
  // ubywa hookow. Ta sama pulapka, ktora wywalila widok kolekcji 2026-09-15; lapie ja
  // `npm run hooks:check`.
  const stickyRef = useStickyHeadVar();

  if (isLoading) return <ScreenSkeleton variant="profile" />;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-[100dvh] gap-3">
      <p className="text-muted-foreground">{t("public.not_found")}</p>
      <button onClick={() => goBackOr(navigate, "/eksploruj")} className="text-primary font-semibold text-sm">{t("public.back")}</button>
    </div>
  );

  // Imię (first_name) = nazwa wyświetlana; username = osobny @handle (nie username jako oba).
  const displayName = profile.first_name || profile.username || "";
  // Snap wlaczamy tylko tam, gdzie scrolluje sie KOLEKCJE (kafelki jednakowej budowy) -
  // ta sama regula, co na wlasnym profilu. Po zablokowaniu osoby tresci nie ma wcale.
  const listSnap = tab === "listy" && !blocked && listCards.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header: powrot + @username */}
      {/* Tapniecie w belke = powrot na gore (odruch z iOS); guziki w srodku dzialaja normalnie. */}
      <div {...scrollTopTapProps()} className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40">
        <button onClick={() => goBackOr(navigate, "/eksploruj")} className="h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold text-center truncate">@{profile.username}</h1>
        {/* Zgloszenie profilu (App Store 1.2) jako sama flaga w belce (prosba Nat 2026-09-13);
            wczesniej w menu "⋮" przy statystykach, gdzie zostaje juz tylko blokada. */}
        {canInteract ? (
          <div className="flex items-center gap-1">
            <ReportContentSheet targetType="user" targetId={profile.id} trigger={(open) => (
              <button onClick={open} aria-label={t("public.report")} className="h-9 w-9 flex items-center justify-center rounded-full text-foreground/60 active:scale-90 transition-transform">
                <FlagIcon className="h-5 w-5" strokeWidth={2} />
              </button>
            )} />
            {/* Blokada pod "⋮" - tez w belce: w rzedzie statystyk (trzy liczniki + obserwacja)
                nie mieścil sie na 393 px i wystawal poza ekran. */}
              {canInteract && (
                <div className="relative">
                  <button onClick={() => setMenuOpen((o) => !o)} aria-label={t("public.more")} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full active:bg-muted transition-colors">
                    <MoreVertical className="h-5 w-5 text-foreground" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl bg-card border border-border/50 shadow-xl overflow-hidden py-1">
                        {/* Obserwowanie jako pozycja menu, nie drugi guzik w naglowku: przy
                            zaproszeniu do znajomych zaczyna sie samo, a recznie rusza je
                            garstka osob. Ten sam uklad, co na Facebooku. */}
                        <button onClick={toggleFollow} disabled={followBusy} className="w-full px-4 py-3 text-left text-sm font-medium text-foreground flex items-center gap-2.5 active:bg-muted disabled:opacity-60">
                          <BrandUserPlus className="h-4 w-4 shrink-0" />
                          {isFollowing ? t("public.unfollow") : t("public.follow")}
                        </button>
                        <button onClick={toggleBlock} className="w-full px-4 py-3 text-left text-sm font-medium text-destructive flex items-center gap-2.5 active:bg-muted">
                          <Ban className="h-4 w-4 shrink-0" /> {blocked ? t("public.unblock") : t("public.block")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
          </div>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* SNAP przy kolekcjach - dokladnie to samo zachowanie, co na wlasnym profilu (prosba
          Nat 2026-09-16). Wlaczony TYLKO na zakladce Kolekcje: Wyjazdy maja karty roznej
          wysokosci (lista / mozaika / siatka) i snap by je szarpal.
          `scroll-pt` = mierzona wysokosc przyklejonej belki zakladek, zeby kafelek stawal POD
          nia, a nie za nia. */}
      <div data-scroll-main className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden${listSnap ? " snap-y snap-mandatory scroll-pt-[var(--profile-sticky,44px)]" : ""}`}>
      <div className="px-4 space-y-5 max-w-lg mx-auto pt-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

        {/* Avatar + nazwa + bio (Figma: nazwa | separator | bio) */}
        {/* `snap-start` = gora profilu jest pelnoprawnym miejscem spoczynku przy wlaczonym
            snapie; bez tego krotkie pociagniecie od gory od razu skakaloby na pierwszy kafelek. */}
        <div className="flex items-start gap-4 snap-start">
          <span className="relative h-[76px] w-[76px] shrink-0">
          <AvatarFrame kind={isAvatarFrame(profile.avatar_frame) ? profile.avatar_frame : null} color={profile.avatar_frame_color} size={76} />
          <Avatar className="h-[76px] w-[76px] shrink-0">
            <AvatarImage src={avatarSrc(profile.avatar_url)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-primary text-3xl font-black">
              {displayName.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          </span>
          <div className="min-w-0 shrink-0 pt-1">
            <h2 className="text-xl font-display font-extrabold leading-tight truncate">{displayName}</h2>
            {/* @username osobno TYLKO gdy jest imię (inaczej byłby podwójny username). */}
            {profile.username && profile.first_name && <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>}
          </div>
          {profile.bio && (
            <>
              <div className="w-px h-9 bg-border/60 self-center" />
              <p className="flex-1 min-w-0 self-center text-[13px] text-muted-foreground leading-snug line-clamp-3">{profile.bio}</p>
            </>
          )}
        </div>

        {/* Statystyki inline: Obserwujacy / Obserwowani / Wyroznione (klik -> lista/arkusz) + akcja
            Obserwuj. gap-5 + shrink-0 na kolkach - patrz TravelerProfile (flex sciskal guziki). */}
        <div className="flex items-end gap-5">
          <button onClick={() => setFollowSheet("followers")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.followers")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.followers}</p>
          </button>
          {/* ZNAJOMI zamiast obserwowanych - ta sama definicja co na wlasnym profilu
              (relacja przyjeta przez obie strony, liczona przez baze). Obserwowani nie
              znikaja: maja zakladke w arkuszu. Rzad miesci TRZY pozycje, czwarta nie. */}
          <button onClick={() => setFollowSheet("friends")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.friends")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{(friendIds.data ?? []).length}</p>
          </button>
          {/* Wyroznione miejsca tej osoby (prosba Nat 2026-09-13) - jak na wlasnym profilu. */}
          <button onClick={() => { haptics.light(); setStarredOpen(true); }} aria-label={t("profile.starred_aria")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.starred")}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xl font-bold text-foreground tabular-nums">
              <BrandIcon src={STAR_ICON} className="h-[18px] w-[18px] text-primary" />{starred.length}
            </p>
          </button>
          <div className="flex-1" />
          {/* ⛔ JEDEN GUZIK RELACJI (decyzja Nat 2026-09-23, model z Facebooka). Przez dobe
              staly tu DWA kolka - "obserwuj" i "dodaj do znajomych" - i to bylo mylace: oba
              o relacji, oba z ludzikiem, roznica niewidoczna. Teraz jedna decyzja: wysylam
              zaproszenie (i przy okazji zaczynam obserwowac), a gdy druga strona nie przyjmie
              - zostaje samo obserwowanie. "Przestan obserwowac" siedzi w menu "⋮" w belce.
              ⚠️ Stoi W RZEDZIE STATYSTYK i ma napis, nie sama ikone (prosba Nat): guzik pelnej
              szerokosci pod rzedem zabieral pasek ekranu, a samo kolko nie mowilo, co robi. */}
          {canInteract && <FriendButton targetUserId={profile.id} />}
        </div>

        {/* Zakladki: Listy | Wyjazdy (ikona + labelka obok, underline aktywnej).
            PRZYKLEJONE u gory, tak jak na wlasnym profilu: przy wlaczonym snapie pierwszy
            kafelek wypycha naglowek poza ekran, wiec bez tego nie bylo juz widac, czyj to
            profil ani ktora zakladke sie oglada. Tlo musi byc kryjace - kafelki przejezdzaja
            pod spodem. */}
        <div ref={stickyRef} className="sticky top-0 z-30 bg-background -mx-4 px-4">
        <div className="flex border-b border-border/40 -mx-1">
          {/* Kolejnosc: Wyjazdy | Listy - ta sama co na wlasnym profilu. */}
          {(["wyjazdy", "listy"] as const).map((tk) => {
            const active = tab === tk;
            const label = tk === "listy" ? t("sections.lists") : t("sections.trips");
            return (
              <button key={tk} onClick={() => goTab(tk)} className="relative flex-1 flex items-center justify-center gap-2 py-2.5" aria-label={label}>
                {tk === "listy"
                  ? <span className="flex h-5 w-5 items-center justify-center" style={{ color: active ? "#0E0E0E" : "#CFCFCF" }}><BrandIcon src={LIST_ICON} className="h-[18px] w-[18px]" /></span>
                  : <SpontawayTabIcon active={active} />}
                <span className="text-sm font-semibold" style={{ color: active ? "#0E0E0E" : "#CFCFCF" }}>{label}</span>
                {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground rounded-full" />}
              </button>
            );
          })}
        </div>
        </div>

        {/* Feed zakladki (gest: swipe w bok = zmiana zakladki) */}
        <div className="space-y-6 pt-1" {...swipeTabs}>
          {/* Po zablokowaniu nie pokazujemy tresci tej osoby (App Store 1.2). */}
          {blocked ? (
            <div className="pt-14 pb-12 text-center px-8 flex flex-col items-center">
              <div className="mb-4 h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center">
                <Ban className="h-6 w-6 text-[#ef9d78]" />
              </div>
              <p className="text-base font-bold text-foreground">{t("public.blocked_title")}</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[280px]">
                {t("public.blocked_desc")}
              </p>
            </div>
          ) : tab === "listy" ? (
            listCards.length === 0 ? (
              <FeedEmptyRO maskSrc="/Ikona_Trasy.svg" title={t("public.no_lists")} desc={t("public.no_lists_desc")} />
            ) : (
              // Kolekcje wygladaja TAK SAMO jak w eksploracji i na wlasnym profilu
              // (prosba Nat 2026-09-15). Wczesniej byl tu `ProfileFeedCard` (rzad miniatur),
              // wiec ta sama kolekcja miala TRZECI wyglad - u siebie kafelek, u kogos innego
              // karta. Licznika zapisow NIE podajemy: to informacja zwrotna dla autora,
              // a nie element kafelka u ogladajacego.
              <div className="space-y-4">
              {listCards.map((l: any) => {
                const places = (l.tiles ?? []).map((it: any) => ({
                  name: it.place_name as string,
                  category: (it.category ?? null) as string | null,
                  photo: resolveStored(it.photo_url ?? null) ?? resolveStored(it._cover ?? null) ?? null,
                }));
                const item: GridItem = {
                  kind: "list", id: l.id, title: l.title || t("feed.list_fallback"),
                  cover: places.find((x: any) => x.photo)?.photo ?? null,
                  where: l.city || scopeLabel(l),
                  // Kolekcja WSPOLTWORZONA pokazuje swojego wlasciciela, nie wlasciciela profilu.
                  authorName: (l._owner ?? profile).first_name || "",
                  authorHandle: (l._owner ?? profile).username ? `@${(l._owner ?? profile).username}` : null,
                  authorAvatar: (l._owner ?? profile).avatar_url, authorId: l.user_id ?? profile.id,
                  authorFrame: (l._owner ?? profile).avatar_frame, authorFrameColor: (l._owner ?? profile).avatar_frame_color,
                  showAuthor: true,
                  coAuthors: (l.co_authors ?? []).map((c: any) => ({ id: c.user_id, username: c.username, avatar_url: c.avatar_url, avatar_frame: c.avatar_frame, avatar_frame_color: c.avatar_frame_color })),
                  at: new Date(l.updated_at ?? 0).getTime(),
                  placesCount: (l.tiles ?? []).length, days: null,
                  theme: listTheme(l.theme, l.id), places,
                  visitedCount: l.visited_count ?? 0,
                };
                return <GridTile key={l.id} it={item} size="feed" people="avatars" className="snap-start snap-always" onOpen={() => navigate(`/lista/${l.id}`)} />;
              })}
              </div>
            )
          ) : tripCards.length === 0 ? (
            <FeedEmptyRO maskSrc="/Ikona_Trasy.svg" title={t("public.no_trips")} desc={t("public.no_trips_desc")} />
          ) : tripLayout === "siatka" ? (
            <>
              <div className="flex justify-end"><TripLayoutSwitch value={tripLayout} onChange={setTripLayout} /></div>
              <div className="grid grid-cols-3 gap-1.5">
                {tripCards.map((tr: any) => (
                  <TripTile key={tr.id} photo={tripCover(tr)} title={tr.title || t("feed.trip_fallback_generic")}
                    meta={scopeLabel(tr) || tr.city} onOpen={() => navigate(`/route/${tr.id}`)} />
                ))}
              </div>
            </>
          ) : tripLayout === "mozaika" ? (
            <>
              <div className="flex justify-end"><TripLayoutSwitch value={tripLayout} onChange={setTripLayout} /></div>
              {/* Dwie kolumny flex (naprzemiennie), NIE CSS multicol - patrz mosaicColumns. */}
              <div className="flex items-start gap-1.5">
                {mosaicColumns(tripCards).map((col, ci) => (
                  <div key={ci} className={`flex min-w-0 flex-1 flex-col gap-1.5 ${ci === 1 ? MOSAIC_OFFSET : ""}`}>
                    {col.map((tr: any) => (
                      <TripTile key={tr.id} natural photo={tripCover(tr)} title={tr.title || t("feed.trip_fallback_generic")}
                        meta={scopeLabel(tr) || tr.city} onOpen={() => navigate(`/route/${tr.id}`)} />
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
            <div className="flex justify-end"><TripLayoutSwitch value={tripLayout} onChange={setTripLayout} /></div>
            {tripCards.map((tr: any) => (
              <TrasaBigCard
                key={tr.id}
                id={tr.id}
                photo={tripCover(tr)}
                city={tr.city}
                placeCount={(tr.tiles ?? []).length}
                title={tr.title || (tr.city ? t("feed.trip_fallback", { city: tr.city }) : t("feed.trip_fallback_generic"))}
                description={tr.description}
                authorName={tr.is_host ? displayName : (tr.host_name ?? displayName)}
                authorAvatar={tr.is_host ? profile.avatar_url : (tr.host_avatar ?? profile.avatar_url)}
                authorId={tr.is_host ? profile.id : (tr.host_id ?? profile.id)}
                showMap={false}
                snap={false}
                heightClass="aspect-[3/4]"
                onOpen={() => navigate(`/route/${tr.id}`)}
                onLike={canInteract ? () => onTripLike(tr) : undefined}
                liked={isTripLiked(tr.id)}
                onToggleSave={canInteract ? () => onTripSave(tr) : undefined}
                saved={isTripSaved(tr.id)}
              />
            ))}
            </>
          )}
        </div>
      </div>
      </div>

      {/* Obserwujacy / Obserwowani - lista (klik -> profil danej osoby) */}
      <StarredPlacesSheet open={starredOpen} onOpenChange={setStarredOpen} userId={profile.id} own={false} />
      {/* Ten sam arkusz, co na wlasnym profilu (kierunek A). Rozne sa tylko REGULY:
          relacje w wierszach licza sie wzgledem MNIE, a nie wlasciciela listy, i nie ma
          akcji wlasciciela (wypisania ze znajomych). */}
      {followSheet && (
        <PeopleSheet
          open
          onClose={() => setFollowSheet(null)}
          tab={followSheet}
          onTab={setFollowSheet}
          ownerId={profile.id}
          myId={user?.id}
          own={false}
          ownerName={displayName}
          ownerUsername={profile.username}
        />
      )}
    </div>
  );
}
