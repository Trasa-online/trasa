import { useState, useEffect, useRef } from "react";
import { useTranslation, Trans } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Camera, UserCircle2, ArrowRight, Bell, Share2, Search, LayoutGrid, ChevronLeft } from "lucide-react";
import { SavedPlacesGrid } from "@/components/saved/SavedPlacesGrid";
import TabHeader from "@/components/layout/TabHeader";
import PinnedSearchField from "@/components/layout/PinnedSearchField";
import SearchCategoryRow, { type SearchCat } from "@/components/home/SearchCategoryRow";
import DiscoveryFeed from "@/components/home/DiscoveryFeed";
import ScreenSkeleton from "@/components/layout/ScreenSkeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { deferDelete } from "@/lib/deferDelete";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";
import { isNative } from "@/lib/platform";
import { useFollowCounts, useFollowList } from "@/hooks/useFollow";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import InviteFriendsBanner from "@/components/social/InviteFriendsBanner";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { ProfileFeedCard } from "@/components/profile/ProfileFeedCard";
import { SpontawayTabIcon } from "@/components/profile/SpontawayTabIcon";
import { shortRelativeTime } from "@/lib/relativeTime";
import { unsaveCollectionDb, migrateLocalSavedCollections } from "@/lib/savedCollections";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
// Karta wyjazdu = ta sama co na eksploracji (okladka + zapis), na profilu BEZ mapki.
import TrasaBigCard from "@/components/home/TrasaBigCard";
import { fetchRouteCoversFor } from "@/lib/routeMemberCover";
import { resolveStored } from "@/components/PlacePhoto";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { uploadThumb } from "@/lib/imageThumbs";

// ── Guest empty state (same visual rytm jak Journal dla goscia) ──────────────

function GuestProfile() {
  const { t } = useTranslation("profiles");
  const { open } = useAuthDrawer();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
      <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
        <UserCircle2 className="h-10 w-10 text-orange-600" />
      </div>
      <div className="space-y-2 max-w-[320px]">
        <p className="text-2xl font-black tracking-tight leading-tight">{t("guest.title")}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{t("guest.desc")}</p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
        <button
          onClick={() => open({ mode: "register" })}
          className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {t("guest.register")}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => open({ mode: "login" })}
          className="w-full px-8 py-3.5 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {t("guest.login")}
        </button>
      </div>
    </div>
  );
}

// ── Empty state dla zakladki feedu (Listy / Wyjazdy) ─────────────────────────

function FeedEmpty({ icon, title, desc, ctaLabel, onCta }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center text-orange-500">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-base font-black">{title}</p>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">{desc}</p>
      </div>
      <button
        onClick={onCta}
        className="mt-1 px-5 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold active:scale-[0.98] transition-transform"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ── Podzakładki: pełnoszerokościowy selektor z ikoną listy (styl Pacer) ──────
// Wiersz na całą szerokość: ikona listy w zaokrąglonym kwadracie (lewa) + aktualny wybór +
// chevron rozwijania (prawa). Klik rozwija menu opcji (floating). Wybór Nat 2026-08-23.

function TabSelect({ options, value, onChange, dotLabel }: {
  /** Etykieta kropki "nowa zawartosc" - tlumaczenie przychodzi z rodzica (tu nie ma hooka). */
  dotLabel?: string;
  /** dot: pomaranczowa kropka na chipie - sygnal "jest tu cos nowego" (np. nowe miejsce w zapisanej liscie). */
  options: { id: string; label: string; dot?: boolean }[];
  value: string;
  onChange: (id: string) => void;
}) {
  // Chipy kategorii (styl Spotify/Messenger) zamiast dropdownu (prosba Nat 2026-08-26): poziomy,
  // przewijalny rzad pigulek. Aktywna = pomaranczowa, reszta = szara.
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`relative shrink-0 rounded-full py-2 text-sm font-bold whitespace-nowrap active:scale-95 transition-all ${o.dot ? "pl-4 pr-6" : "px-4"} ${active ? "bg-primary text-white" : "bg-secondary text-foreground"}`}
          >
            {o.label}
            {o.dot && (
              /* Kropka WEWNATRZ chipa: pasek ma overflow-x-auto, wiec cokolwiek wystaje poza
                 obrys (ujemne offsety) zostaje ucinane przy przewijaniu (zgloszenie Nat
                 2026-09-01: "kropka ucina sie w polowie"). */
              <span aria-label={dotLabel} className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${active ? "bg-white" : "bg-primary"}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── TravelerProfile ───────────────────────────────────────────────────────────

const TravelerProfile = () => {
  const { t } = useTranslation("profiles");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  // Wyszukiwarka przypieta w naglowku - dziala W MIEJSCU, dokladnie jak w Eksploracji
  // (prosba Nat 2026-09-06): foldery kategorii chowaja sie po wpisaniu frazy, a wyniki
  // renderuje wspoldzielony DiscoveryFeed w trybie searchOnly (jedna logika wynikow).
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCat, setSearchCat] = useState<SearchCat>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); setSearchCat("all"); searchInputRef.current?.blur(); };
  const foldersVisible = searchOpen && searchQuery.trim().length === 0;
  // Wyniki na pelny ekran - dolny pasek chowamy tak samo jak w Eksploracji.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: searchOpen }));
  }, [searchOpen]);
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("trasa:hide-bottomnav", { detail: false })); }, []);
  const [searchParams] = useSearchParams();
  // ?tab=wyjazdy|listy - wejście z redirectów (dawne /dziennik -> wyjazdy). Zakładka "zapisane"
  // usunięta (2026-08-24): zapisane miejsca żyją w liście ogólnej i pojawiają się przy tworzeniu.
  // Domyślnie PIERWSZA zakładka = Wyjazdy (kolejność zmieniona 2026-08-30) - inaczej wchodząc na
  // profil widać zaznaczoną drugą pigułkę, co wygląda jak błąd.
  const initialTab: "listy" | "wyjazdy" = searchParams.get("tab") === "listy" ? "listy" : "wyjazdy";
  const [tab, setTab] = useState<"listy" | "wyjazdy">(initialTab);
  // Podzakładki (pigułki) w Listy / Wyjazdy. Domyślnie: Listy->Moje, Wyjazdy->Wspomnienia
  // (opublikowane trasy = flagowa treść; robocze to work-in-progress).
  const [listyTab, setListyTab] = useState<"moje" | "ogolne" | "zapisane">("moje");
  const [wyjazdyTab, setWyjazdyTab] = useState<"robocze" | "wspomnienia" | "zapisane">("robocze");
  // Podzakladka wybrana swiadomie (tap w pigulke / ?sub=) - wtedy nie podmieniamy jej automatycznie.
  const subChosen = useRef(false);
  // Synchronizacja zakladek z URL (?tab=&sub=). useState czyta URL tylko przy pierwszym mount, a
  // wejscie z "+" gdy juz jestesmy na /moj-profil to nawigacja na TEN SAM route (bez remountu) - bez
  // tego efektu nowo utworzona robocza trasa lądowała na Wspomnieniach (user jej nie widzial).
  useEffect(() => {
    const tp = searchParams.get("tab");
    if (tp === "wyjazdy") setTab("wyjazdy");
    else if (tp === "listy") setTab("listy");
    const sub = searchParams.get("sub");
    if (sub === "robocze" || sub === "wspomnienia" || sub === "zapisane") { subChosen.current = true; setWyjazdyTab(sub); }
  }, [searchParams]);
  const share = useShare();

  // Pull-to-refresh: odswieza liczniki polubien/zapisow + feedy (aktywne query na tym ekranie).
  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
  };

  // Gest natywny: przeciagniecie w lewo/prawo przelacza zakladke Listy <-> Wyjazdy.
  // Wejscie w "Wyjazdy" resetuje podzakladke tak samo jak tap w pigulke.
  const swipeTabs = useSwipeNav({
    // Kolejnosc pigulek: Wyjazdy | Listy, wiec swipe w LEWO idzie Wyjazdy -> Listy.
    onLeft: () => { if (tab === "wyjazdy") setTab("listy"); },
    onRight: () => { if (tab === "listy") { setTab("wyjazdy"); setWyjazdyTab("robocze"); } },
  });

  const { data: followCounts = { followers: 0, following: 0 } } = useFollowCounts(user?.id);
  const followList = useFollowList(user?.id, followSheet === "following" ? "following" : "followers");

  // Usuwanie z oknem "Cofnij" (deferDelete): element znika od razu z listy (optymistycznie),
  // faktyczny DB delete odroczony o 5s; klik "Cofnij" przywraca (snapshot cache). Zastepuje confirm()
  // - nic nie ginie natychmiast, wiec nie ma dialogu "czy na pewno".
  const handleDeleteTrip = (tr: any) => {
    if (!user) return;
    const ids: string[] = tr.routeIds?.length ? tr.routeIds : [tr.id];
    const key = ["profile-trip-feed", user.id];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old: any) => (old ?? []).filter((r: any) => r.id !== tr.id));
    deferDelete({
      message: t("profile.trip_deleted"),
      onUndo: () => queryClient.setQueryData(key, prev),
      commit: async () => {
        try {
          await supabase.from("pins").delete().in("route_id", ids);
          await (supabase as any).from("chat_sessions").delete().in("route_id", ids);
          const { error } = await supabase.from("routes").delete().in("id", ids).eq("user_id", user.id);
          if (error) throw new Error(error.message);
          queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
        } catch (e: any) {
          toast.error(t("profile.delete_error"));
          console.error("[TravelerProfile] delete trip failed:", e?.message ?? e);
          queryClient.invalidateQueries({ queryKey: ["profile-trip-feed", user.id] });
        }
      },
    });
  };
  const handleDeleteList = (l: any) => {
    if (!user) return;
    const key = ["profile-list-feed", user.id];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old: any) => (old ?? []).filter((x: any) => x.id !== l.id));
    deferDelete({
      message: t("profile.list_deleted"),
      onUndo: () => queryClient.setQueryData(key, prev),
      commit: async () => {
        try {
          await (supabase as any).from("discovery_items").delete().eq("collection_id", l.id);
          const { error } = await (supabase as any).from("discovery_collections").delete().eq("id", l.id).eq("user_id", user.id);
          if (error) throw new Error(error.message);
          // Odswiez listy w drawerze zapisu miejsca (inaczej usunieta lista wisi w cache).
          queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user.id] });
        } catch (e: any) {
          toast.error(t("profile.delete_error"));
          console.error("[TravelerProfile] delete list failed:", e?.message ?? e);
          queryClient.invalidateQueries({ queryKey: ["profile-list-feed", user.id] });
        }
      },
    });
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
    const ext = allowed[file.type as keyof typeof allowed];
    if (!ext) { toast.error(t("profile.avatar_type_error")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("profile.avatar_size_error")); return; }
    const fileName = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
    await uploadThumb("avatars", fileName, file);
    if (uploadError) { toast.error(t("profile.avatar_upload_error")); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: bustedUrl } as any).eq("id", user.id);
    if (updateError) { toast.error(t("profile.avatar_save_error")); return; }
    queryClient.invalidateQueries({ queryKey: ["profile-full", user.id] });
    toast.success(t("profile.avatar_updated"));
  };

  const handleNativePhotoPick = async () => {
    try {
      const photo = await CapCamera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Photos, quality: 90, width: 800, height: 800 });
      if (!photo.base64String) { toast.error(t("profile.photo_read_error")); return; }
      const format2 = photo.format || "jpeg";
      const mime = format2 === "png" ? "image/png" : format2 === "webp" ? "image/webp" : "image/jpeg";
      const binary = atob(photo.base64String);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], `avatar.${format2}`, { type: mime });
      await handleAvatarUpload(file);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) return;
      console.error("[TravelerProfile] native photo pick failed:", msg);
      toast.error(t("profile.photo_pick_error"));
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username, avatar_url, first_name, bio").eq("id", user!.id).single();
      return data as any;
    },
    enabled: !!user,
  });

  // Licznik nieprzeczytanych powiadomien - kropka na dzwonku (profil ma hideTopBar, wiec wlasne
  // zapytanie; odswiezane przez useNotificationsLive (realtime) + refetchInterval jako fallback).
  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    enabled: !!user?.id,
    // BATERIA: realtime + resume wystarcza, poll to tylko rzadki fallback (patrz TopBar).
    refetchInterval: 300_000,
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("read", false).neq("type", "group_match");
      return count ?? 0;
    },
  });

  const handleShareProfile = async () => {
    if (!profile?.username) { toast.error(t("profile.share_no_username")); return; }
    const url = `${SHARE_BASE_URL}/#/profil/${profile.username}`;
    const res = await share({ title: `@${profile.username}`, url });
    if (res.ok && res.method === "clipboard") toast.success(t("invite.link_copied"));
  };

  // Feed LIST (zakladka Listy): wlasne listy + kafelki miejsc + liczniki z kolumn.
  const { data: listCards = [] } = useQuery({
    queryKey: ["profile-list-feed", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, list_status, description, tags, views_count, saves_count, likes_count, updated_at")
        .eq("user_id", user!.id).eq("kind", "ranking")
        // Zakładka Listy = moje CURATED listy (grupy). Publiczne polecajki (visited). Luźno
        // zapisane miejsca (auto-lista "Do zobaczenia", to_visit) to NIE lista - pokazują się
        // jako kafelki w Zapisane→Miejsca, nie tutaj.
        .eq("list_status", "visited")
        .order("updated_at", { ascending: false });
      const rows = (cols ?? []) as any[];
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, place_name, category, google_place_id, photo_url, order_index")
        .in("collection_id", ids).order("order_index", { ascending: true });
      const allItems = (items ?? []) as any[];
      // Okladki miejsc ze zdjec userow (place_photos) - gdy element nie ma wlasnego photo_url.
      const keys = Array.from(new Set(allItems.flatMap((it) => pinCoverKeys(it)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const byCol: Record<string, any[]> = {};
      for (const it of allItems) {
        const _cover = pickPlaceCover(photoMap, pinCoverKeys(it));
        (byCol[it.collection_id] ??= []).push({ ...it, _cover });
      }
      return rows.map((r) => ({ ...r, tiles: byCol[r.id] ?? [] }));
    },
  });

  // Feed WYJAZDOW (zakladka Wyjazdy): wlasne opublikowane trasy, zwiniete po folderze,
  // kafelki z pinow + liczniki (saved_routes / likes / routes.views).
  const { data: tripCards = [] } = useQuery({
    queryKey: ["profile-trip-feed", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // saves_count/likes_count = denormalizowane liczniki na routes (RLS na saved_routes blokuje
      // count po stronie klienta - patrz migracja 20260828). Czytamy kolumny zamiast liczyc wiersze.
      const sel = "id, title, city, start_date, day_number, folder_id, views, saves_count, likes_count, created_at, user_id, is_shared, trip_type, status, tags, review_narrative, ai_summary, cover_url, list_cover_url";
      // Wlasne trasy (TAKZE robocze is_shared=false - badge "Robocze") + trasy grupowe, do ktorych
      // jestem zaproszony (member, is_shared=true). Koniec osobnego widoku /utworz/robocze (IA 2026-08-22).
      const [ownRes, memberRes] = await Promise.all([
        (supabase as any).from("routes").select(sel).eq("user_id", user!.id).order("created_at", { ascending: false }),
        (supabase as any).from("group_session_members").select("session_id").eq("user_id", user!.id),
      ]);
      const sessionIds = (memberRes.data ?? []).map((m: any) => m.session_id);
      let groupRows: any[] = [];
      if (sessionIds.length) {
        const { data } = await (supabase as any).from("routes").select(sel)
          .in("group_session_id", sessionIds).neq("user_id", user!.id).eq("is_shared", true)
          .order("created_at", { ascending: false });
        groupRows = data ?? [];
      }
      const seen = new Set<string>();
      const rows = [
        ...((ownRes.data ?? []) as any[]).map((r) => ({ ...r, is_own: true })),
        ...(groupRows as any[]).map((r) => ({ ...r, is_own: false })),
      ].filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const pinsRes = await (supabase as any).from("pins").select("id, route_id, place_name, category, photo_url, image_url, images, user_photo_urls, pin_order, latitude, longitude").in("route_id", ids).order("pin_order", { ascending: true });
      const allPins = (pinsRes.data ?? []) as any[];
      // MOJA okladka wyjazdu (route_member_covers) - kazdy uczestnik widzi u siebie swoja.
      const myCovers = await fetchRouteCoversFor(user!.id, ids);
      // Okladki miejsc ze zdjec userow (place_photos) - gdy pin nie ma wlasnego zdjecia.
      const keys = Array.from(new Set(allPins.flatMap((p) => pinCoverKeys(p)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const pinsByRoute: Record<string, any[]> = {};
      for (const p of allPins) {
        const _cover = pickPlaceCover(photoMap, pinCoverKeys(p));
        (pinsByRoute[p.route_id] ??= []).push({ ...p, _cover });
      }
      // Zwin wielodniowe po folder_id (rep = najnizszy day_number).
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
      return grouped.map(({ rep, days }) => ({
        id: rep.id,
        is_own: rep.is_own !== false, // trasa grupowa zaproszonego = false (bez edycji/usuwania)
        routeIds: days.map((d) => d.id), // wszystkie dni (folder) - do usuniecia calej podrozy
        city: rep.city,
        title: rep.title,
        start_date: rep.start_date,
        created_at: rep.created_at,
        // status/is_shared decyduja o Robocze vs Wspomnienia + trybie otwarcia (kreator vs widok).
        status: rep.status,
        is_shared: rep.is_shared,
        trip_type: rep.trip_type,
        // Opis + tagi pod nazwa wyjazdu (na karcie profilu, prosba Nat). Opis = review_narrative (user)
        // lub ai_summary (fallback). tags = routes.tags.
        description: (rep.review_narrative || rep.ai_summary || "").trim() || null,
        tags: Array.isArray(rep.tags) ? rep.tags : [],
        // Okladka karty: MOJA okladka (jesli wybralem) > miniatura eksploracji > okladka wyjazdu.
        cover: myCovers.get(rep.id) ?? rep.list_cover_url ?? rep.cover_url ?? null,
        tiles: days.flatMap((d) => pinsByRoute[d.id] ?? []),
        saves: Number(rep.saves_count ?? 0),
        likes: Number(rep.likes_count ?? 0),
        views: Number(rep.views ?? 0),
      }));
    },
  });

  // Feed ZAPISANYCH LIST (od innych) - ten sam UI co wlasne listy (ProfileFeedCard) + chip
  // "Nowe miejsce!" gdy autor dodal miejsca po ostatnim obejrzeniu (seen_item_count). DB source.
  const { data: savedListCards = [] } = useQuery({
    queryKey: ["profile-saved-list-feed", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      await migrateLocalSavedCollections(user!.id); // jednorazowo: stare zapisy z localStorage -> DB
      const { data: saved } = await (supabase as any).from("saved_collections")
        .select("collection_id, created_at, seen_item_count").eq("user_id", user!.id).order("created_at", { ascending: false });
      const rows0 = (saved ?? []) as any[];
      const ids = rows0.map((r) => r.collection_id).filter(Boolean);
      if (!ids.length) return [];
      const { data: cols } = await (supabase as any).from("discovery_collections")
        .select("id, title, city, description, tags, author_name, author_avatar, user_id, saves_count, likes_count, views_count, updated_at").in("id", ids);
      const colRows = (cols ?? []) as any[];
      const { data: items } = await (supabase as any).from("discovery_items")
        .select("id, collection_id, place_name, category, google_place_id, photo_url, order_index").in("collection_id", ids).order("order_index", { ascending: true });
      const allItems = (items ?? []) as any[];
      const keys = Array.from(new Set(allItems.flatMap((it) => pinCoverKeys(it)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const byCol: Record<string, any[]> = {};
      for (const it of allItems) { const _cover = pickPlaceCover(photoMap, pinCoverKeys(it)); (byCol[it.collection_id] ??= []).push({ ...it, _cover }); }
      const seenMap: Record<string, number> = {}; rows0.forEach((r) => { seenMap[r.collection_id] = r.seen_item_count ?? 0; });
      // Zachowaj kolejnosc zapisu (najnowsze u gory).
      return ids.map((cid) => colRows.find((c) => c.id === cid)).filter(Boolean).map((c: any) => {
        const tiles = byCol[c.id] ?? [];
        // Ile miejsc doszlo od mojej ostatniej wizyty. KTORE to sa, poznajemy po order_index:
        // dodawanie dopisuje na koniec listy, wiec nowe to ostatnie `newCount` pozycji.
        // (discovery_items nie ma created_at; gdyby autor przestawil kolejnosc, podswietlimy
        // niewlasciwe kafelki - liczba nadal bedzie poprawna.)
        const newCount = Math.max(0, tiles.length - (seenMap[c.id] ?? 0));
        const newTiles = newCount ? tiles.slice(-newCount) : [];
        // Nowe kafelki na POCZATEK: karta pokazuje tylko 3 pierwsze, wiec inaczej nowosc
        // chowalaby sie pod "+N" i cala plakietka nie mialaby czego udowodnic.
        const ordered = newCount ? [...newTiles, ...tiles.slice(0, tiles.length - newCount)] : tiles;
        return {
          ...c, tiles: ordered, isNew: newCount > 0, newCount,
          newNames: newTiles.map((t: any) => t.place_name).filter(Boolean),
          newIds: newTiles.map((t: any) => t.id).filter(Boolean),
          newCats: newTiles.map((t: any) => (t.category ? subcategoryLabelLocalized(t.category) : null)).filter(Boolean),
        };
      });
    },
  });

  // Feed ZAPISANYCH WYJAZDOW (od innych) - ten sam UI co Wspomnienia (ProfileFeedCard), z autorem trasy.
  // Wyjazdy otwieraja sie na "Robocze", ale uczestnik cudzego wyjazdu ma u siebie TYLKO
  // opublikowane wspomnienie - zakladka wygladala u niego na pusta (zgloszenie Nat 2026-08-30).
  // Gdy nie ma zadnego roboczego, a sa wspomnienia, przelaczamy sie na nie (chyba ze user
  // wybral podzakladke sam).
  useEffect(() => {
    if (subChosen.current) return;
    const rows = tripCards as any[];
    if (!rows.length) return;
    const hasDrafts = rows.some((tr) => tr.status !== "published");
    const hasMemories = rows.some((tr) => tr.status === "published");
    if (!hasDrafts && hasMemories) setWyjazdyTab("wspomnienia");
  }, [tripCards]);

  const { data: savedTripCards = [] } = useQuery({
    queryKey: ["profile-saved-trip-feed", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: saved } = await (supabase as any).from("saved_routes")
        .select("route_id, created_at").eq("user_id", user!.id).order("created_at", { ascending: false });
      const ids = ((saved ?? []) as any[]).map((r) => r.route_id).filter(Boolean);
      if (!ids.length) return [];
      const sel = "id, title, city, start_date, views, saves_count, likes_count, created_at, user_id, is_shared, trip_type, status, tags, review_narrative, ai_summary, cover_url, list_cover_url";
      const { data: rows } = await (supabase as any).from("routes").select(sel).in("id", ids);
      const rowRows = (rows ?? []) as any[];
      if (!rowRows.length) return [];
      const pinsRes = await (supabase as any).from("pins").select("id, route_id, place_name, category, photo_url, image_url, images, user_photo_urls, pin_order, latitude, longitude").in("route_id", ids).order("pin_order", { ascending: true });
      const allPins = (pinsRes.data ?? []) as any[];
      const keys = Array.from(new Set(allPins.flatMap((p) => pinCoverKeys(p)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const pinsByRoute: Record<string, any[]> = {};
      for (const p of allPins) { const _cover = pickPlaceCover(photoMap, pinCoverKeys(p)); (pinsByRoute[p.route_id] ??= []).push({ ...p, _cover }); }
      // Autorzy tras (awatar + imie) - zapisane sa cudze, wiec pokazujemy autora, nie siebie.
      const authorIds = Array.from(new Set(rowRows.map((r) => r.user_id).filter(Boolean)));
      const { data: authors } = authorIds.length
        ? await supabase.from("profiles").select("id, username, first_name, avatar_url").in("id", authorIds)
        : { data: [] as any[] };
      const authorById = new Map((authors ?? []).map((a: any) => [a.id, a]));
      return ids.map((rid) => rowRows.find((r) => r.id === rid)).filter(Boolean).map((rep: any) => {
        const a = authorById.get(rep.user_id);
        return {
          id: rep.id, city: rep.city, title: rep.title, start_date: rep.start_date, created_at: rep.created_at,
          description: (rep.review_narrative || rep.ai_summary || "").trim() || null,
          tags: Array.isArray(rep.tags) ? rep.tags : [],
          cover: rep.list_cover_url ?? rep.cover_url ?? null,
          tiles: pinsByRoute[rep.id] ?? [], saves: Number(rep.saves_count ?? 0), likes: Number(rep.likes_count ?? 0), views: Number(rep.views ?? 0),
          author_avatar: a?.avatar_url ?? null, author_name: a?.first_name || a?.username || t("profile.traveler_fallback"),
        };
      });
    },
  });

  // Odpiecie ZAPISANEJ listy - z oknem "Cofnij" (jak usuwanie wlasnych). Element znika od razu,
  // faktyczny delete jest odroczony o 5 s (prosba Nat 2026-08-30: undo na WSZYSTKICH zakladkach).
  const handleUnsaveList = (colId: string) => {
    if (!user) return;
    const key = ["profile-saved-list-feed", user.id];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old: any) => (old ?? []).filter((x: any) => x.id !== colId));
    const setLocal = (has: boolean) => {
      try {
        const set = new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]"));
        if (has) set.add(colId); else set.delete(colId);
        localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      } catch { /* brak localStorage */ }
    };
    setLocal(false);
    deferDelete({
      message: t("profile.removed_saved"),
      onUndo: () => { setLocal(true); queryClient.setQueryData(key, prev); },
      commit: async () => {
        await unsaveCollectionDb(user.id, colId);
        queryClient.invalidateQueries({ queryKey: key });
      },
    });
  };
  // Odpiecie ZAPISANEGO wyjazdu - to samo okno "Cofnij".
  const handleUnsaveTrip = (routeId: string) => {
    if (!user) return;
    const key = ["profile-saved-trip-feed", user.id];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old: any) => (old ?? []).filter((x: any) => x.id !== routeId));
    deferDelete({
      message: t("profile.removed_saved"),
      onUndo: () => queryClient.setQueryData(key, prev),
      commit: async () => {
        await (supabase as any).from("saved_routes").delete().eq("user_id", user.id).eq("route_id", routeId);
        queryClient.invalidateQueries({ queryKey: key });
      },
    });
  };

  if (loading) return <ScreenSkeleton variant="profile" />;
  if (!user || user.is_anonymous) return <GuestProfile />;

  // Imię (first_name) to nazwa wyświetlana; username to osobny @handle. NIE username jako oba.
  const displayName = profile?.first_name || profile?.username || "";

  // Podział wyjazdów: Robocze (niepublikowane) vs Wspomnienia (status='published').
  const draftTrips = (tripCards as any[]).filter((tr) => tr.status !== "published");
  const memoryTrips = (tripCards as any[]).filter((tr) => tr.status === "published");

  // Okladka karty wyjazdu: wybrana miniatura > pierwsze zdjecie miejsca z wyjazdu.
  const tripCover = (tr: any): string | null => {
    const own = resolveStored(tr.cover);
    if (own) return own;
    for (const tile of (tr.tiles ?? []) as any[]) {
      const first = (v: any) => (Array.isArray(v) ? v.find((x) => typeof x === "string" && x) : null);
      const url = resolveStored(tile.image_url || first(tile.images) || first(tile.user_photo_urls) || tile.photo_url) ?? resolveStored(tile._cover);
      if (url) return url;
    }
    return null;
  };

  const renderTripCard = (tr: any) => {
    // Karta 1:1 z eksploracja (TrasaBigCard): okladka na cala kafle, meta + tytul na dole,
    // prawy stack akcji. Na profilu BEZ mapki (prosba Nat 2026-08-30) i nizsza (3:4).
    const isRoboczy = tr.status !== "published";
    return (
      <TrasaBigCard
        key={tr.id}
        id={tr.id}
        photo={tripCover(tr)}
        city={tr.city}
        placeCount={(tr.tiles ?? []).length}
        title={tr.title || (tr.city ? t("feed.trip_fallback", { city: tr.city }) : t("feed.trip_fallback_generic"))}
        description={tr.description}
        authorName={displayName}
        authorAvatar={profile?.avatar_url}
        isDraft={isRoboczy}
        showMap={false}
        snap={false}
        heightClass="aspect-[3/4]"
        // Widok wyjazdu = SharedRoute (/route/:id) dla WSZYSTKICH etapow (Propozycje/W Trakcie/Wspomnienie).
        onOpen={() => navigate(`/route/${tr.id}`)}
        onEdit={tr.is_own ? () => navigate(`/review-summary?route=${tr.id}&edit=1`) : undefined}
        onDelete={tr.is_own ? () => handleDeleteTrip(tr) : undefined}
      />
    );
  };

  // Zapisany (cudzy) wyjazd - ta sama karta co Wspomnienia, ale autor = tworca trasy, akcja = odpiecie.
  const renderSavedTripCard = (tr: any) => (
    <TrasaBigCard
      key={tr.id}
      id={tr.id}
      photo={tripCover(tr)}
      city={tr.city}
      placeCount={(tr.tiles ?? []).length}
      title={tr.title || (tr.city ? t("feed.trip_fallback", { city: tr.city }) : t("feed.trip_fallback_generic"))}
      description={tr.description}
      tags={tr.tags}
      authorName={tr.author_name}
      authorAvatar={tr.author_avatar}
      showMap={false}
      snap={false}
      heightClass="aspect-[3/4]"
      onOpen={() => navigate(`/route/${tr.id}`)}
      onToggleSave={() => handleUnsaveTrip(tr.id)}
      saved
    />
  );

  // Zapisana (cudza) lista - ten sam UI co wlasne listy, autor = tworca, chip "Nowe miejsce!", odpiecie.
  const renderSavedListCard = (l: any) => (
    <ProfileFeedCard
      key={l.id}
      avatarUrl={l.author_avatar}
      fallback={l.author_name || "?"}
      eyebrow=""
      timestamp={shortRelativeTime(l.updated_at)}
      title={l.title || t("feed.list_fallback", t("profile.list_fallback_title"))}
      description={l.description}
      tiles={l.tiles}
      counts={{ saves: l.saves_count ?? 0, views: l.views_count ?? 0 }}
      // Plakietka mowi KTO, ILE i CO dodal - sama informacja "cos doszlo" nie dawala powodu,
      // zeby wejsc (eksploracja UX w Figmie, sekcja "Zapisana lista: ktos dodal nowe miejsce").
      badge={l.isNew ? (
        <div className="flex items-center gap-2 rounded-2xl bg-[#FCEDE3] px-2.5 py-2">
          <img src={avatarSrc(l.author_avatar ?? null)} alt="" className="h-5 w-5 rounded-full object-cover bg-orange-100 shrink-0" />
          <p className="text-[12.5px] font-semibold text-foreground leading-snug">
            {t("feed.added_place", { count: l.newCount, author: l.author_name || t("feed.author_fallback") })}
            {l.newNames?.length ? <span className="font-normal">{`: ${l.newNames.slice(0, 2).join(", ")}${l.newNames.length > 2 ? ` i ${l.newNames.length - 2} więcej` : ""}`}</span> : null}
            {/* Kategoria dodanego miejsca - mowi CO to jest, zanim user w ogole otworzy liste. */}
            {l.newCount === 1 && l.newCats?.[0] ? <span className="font-normal text-[#8A6A57]">{` · ${l.newCats[0]}`}</span> : null}
          </p>
        </div>
      ) : undefined}
      onOpen={() => navigate(`/lista/${l.id}`)}
      onSave={() => handleUnsaveList(l.id)}
      saved
    />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">

      <TabHeader
        title={t("profile.your_profile")}
        right={
          <>
            <button onClick={handleShareProfile} className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform" aria-label={t("profile.share_profile_aria")}>
              <Share2 className="h-5 w-5" />
            </button>
            <button onClick={() => setNotificationsOpen(true)} className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform" aria-label={t("profile.notifications_aria")}>
              <Bell className="h-5 w-5" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>
              )}
            </button>
            <button onClick={() => navigate("/settings")} className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform" aria-label={t("profile.settings_aria")}>
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
        below={
          <>
            {searchOpen && (
              <button
                onClick={closeSearch}
                aria-label={t("search.close_aria")}
                className="shrink-0 -ml-1 h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
              </button>
            )}
            <PinnedSearchField
              ref={searchInputRef}
              value={searchQuery}
              onChange={setSearchQuery}
              onFocus={() => setSearchOpen(true)}
              placeholder={t("search.pinned_placeholder")}
            />
          </>
        }
      />

      {/* Foldery kategorii - jak w Eksploracji: widoczne dopoki fraza jest pusta. */}
      {searchOpen && (
        <div
          className={cn(
            "shrink-0 overflow-hidden border-b border-border/40 transition-all duration-200 ease-out",
            foldersVisible ? "max-h-[160px] opacity-100" : "max-h-0 opacity-0 border-b-0",
          )}
        >
          <p className="px-4 pt-3 text-sm font-bold text-foreground">{t("search.by_category")}</p>
          <SearchCategoryRow value={searchCat} onChange={setSearchCat} />
          <div className="h-3" />
        </div>
      )}

      {/* Wyniki zamiast tresci profilu - ten sam komponent co w Eksploracji. */}
      {searchOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]" style={{ WebkitOverflowScrolling: "touch" }}>
          <DiscoveryFeed
            searchOnly
            active={false}
            city="all"
            searchOpen
            searchQuery={searchQuery}
            searchCategory={searchCat}
          />
        </div>
      )}

      <PullToRefresh onRefresh={handleRefresh} className={cn("flex-1 overflow-x-hidden", searchOpen && "hidden")}>
      <div className="px-4 space-y-5 max-w-lg mx-auto pt-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">

        {/* Avatar + nazwa + bio (Figma: nazwa | separator | bio) */}
        <div className="flex items-stretch gap-3">
          <div className="relative shrink-0 self-center">
            <Avatar className="h-[76px] w-[76px]">
              <AvatarImage src={avatarSrc(profile?.avatar_url)} className="object-cover bg-orange-100" />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-3xl font-black">
                {displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {isNative ? (
              <button type="button" onClick={handleNativePhotoPick} className="absolute bottom-0 right-0 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md ring-2 ring-background" aria-label={t("profile.change_photo_aria")}>
                <Camera className="h-3.5 w-3.5" />
              </button>
            ) : (
              <label className="absolute bottom-0 right-0 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md ring-2 ring-background">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              </label>
            )}
          </div>
          <div className="min-w-0 max-w-[46%] self-center">
            <h2 className="text-xl font-display font-extrabold leading-tight truncate">
              {profile?.first_name || profile?.username || t("profile.user_fallback")}
            </h2>
            {/* @username osobno TYLKO gdy jest imię (inaczej byłby podwójny username). */}
            {profile?.username && profile?.first_name && <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>}
          </div>
          {profile?.bio ? (
            <>
              <div className="w-px h-9 bg-border/60 self-center" />
              <p className="flex-1 min-w-0 self-center text-[13px] text-muted-foreground leading-snug line-clamp-3">{profile.bio}</p>
            </>
          ) : (
            <button
              onClick={() => navigate("/settings")}
              className="flex-1 min-w-0 self-center text-left text-[13px] text-muted-foreground/60 leading-snug"
            >
              {t("profile.add_bio")}
            </button>
          )}
        </div>

        {/* Statystyki inline: Obserwujacy / Obserwowani / Miasta + szukanie osob */}
        <div className="flex items-end gap-7">
          <button onClick={() => setFollowSheet("followers")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.followers")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.followers}</p>
          </button>
          <button onClick={() => setFollowSheet("following")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.following")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.following}</p>
          </button>
          <div className="flex-1" />
          <button onClick={() => navigate("/search")} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform" aria-label={t("profile.find_users_aria")}>
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Zakladki: Listy | Wyjazdy (ikona + labelka obok, underline aktywnej). Zapisane usunięte 2026-08-24. */}
        {/* Sticky: przy przewijaniu profilu zakladki zostaja na gorze (prosba Nat 2026-09-01).
            -mx-4 px-4 + tlo, zeby przyklejony pasek zakrywal tresc na CALEJ szerokosci - inaczej
            kafelki przejezdzalyby pod nim po bokach. */}
        <div className="sticky top-0 z-30 bg-background -mx-4 px-4 flex border-b border-border/40">
          {/* Kolejnosc: Wyjazdy | Listy (prosba Nat 2026-08-30) - wyjazdy sa flagowa trescia profilu. */}
          {(["wyjazdy", "listy"] as const).map((tk) => {
            const active = tab === tk;
            const label = tk === "listy" ? t("sections.lists") : t("sections.trips");
            return (
              <button key={tk} onClick={() => { setTab(tk); if (tk === "wyjazdy") setWyjazdyTab("robocze"); }} className="relative flex-1 flex items-center justify-center gap-2 py-2.5" aria-label={label}>
                {tk === "listy"
                  ? <LayoutGrid className="h-5 w-5" style={{ color: active ? "#0E0E0E" : "#CFCFCF" }} />
                  : <SpontawayTabIcon active={active} />}
                <span className="text-sm font-semibold" style={{ color: active ? "#0E0E0E" : "#CFCFCF" }}>{label}</span>
                {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground rounded-full" />}
              </button>
            );
          })}
        </div>

        {/* Feed zakladki (gest: swipe w bok = zmiana zakladki) */}
        <div className="space-y-6 pt-1" {...swipeTabs}>
          {tab === "listy" ? (
            <div className="space-y-4">
              {/* Podzakładki (dropdown): Moje listy (curated) | Ogólne (lista ogólna) | Zapisane (od innych). */}
              <TabSelect
                dotLabel={t("profile.new_content_aria")}
                value={listyTab}
                onChange={(v) => setListyTab(v as "moje" | "ogolne" | "zapisane")}
                options={[
                  { id: "moje", label: t("tabs.my_lists") },
                  { id: "ogolne", label: t("tabs.general") },
                  // Kropka = w ktorejs zapisanej liscie autor dodal miejsce, ktorego jeszcze nie
                  // widzialem. Na profilu to jedyny sygnal dla kogos, kto nie scrolluje zapisanych.
                  { id: "zapisane", label: "Zapisane", dot: (savedListCards as any[]).some((l) => l.isNew) },
                ]}
              />
              {listyTab === "moje" ? (
                listCards.length === 0 ? (
              // Pusty stan LIST (Figma "Mój profil - Listy - pusty stan"): peachy znak trasy (S)
              // + instrukcja uzycia "+", bez guzika CTA (tworzenie idzie przez BottomNav "+").
              <div className="pt-16 pb-12 text-center px-8">
                <span aria-hidden className="mx-auto mb-5 block h-24 w-24" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
                <p className="text-lg font-bold text-foreground">{t("empty.no_own_lists")}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[300px] mx-auto">
                  {t("empty.first_list_desc")}
                </p>
              </div>
            ) : (
              listCards.map((l: any) => (
                <ProfileFeedCard
                  key={l.id}
                  avatarUrl={profile?.avatar_url}
                  fallback={displayName}
                  eyebrow=""
                  timestamp={shortRelativeTime(l.updated_at)}
                  title={l.title || t("feed.list_fallback", t("profile.list_fallback_title"))}
                  description={l.description}
                  tiles={l.tiles}
                  counts={{ saves: l.saves_count ?? 0, views: l.views_count ?? 0 }}
                  onOpen={() => navigate(`/lista/${l.id}`)}
                  onEdit={() => navigate(`/zestawienie/${l.id}/edytuj`)}
                  onDelete={() => handleDeleteList(l)}
                />
              ))
                )
              ) : listyTab === "ogolne" ? (
                // t("tabs.general") - lista OGÓLNA usera (wszystkie zapisane miejsca), dostępna z dropdownu list.
                <div className="pt-1"><SavedPlacesGrid /></div>
              ) : (
                // Zapisane listy od innych - ten sam UI co wlasne listy (ProfileFeedCard) + chip "Nowe miejsce!".
                savedListCards.length === 0 ? (
                  <div className="pt-16 pb-12 text-center px-8">
                    <span aria-hidden className="mx-auto mb-5 block h-24 w-24" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
                    <p className="text-lg font-bold text-foreground">{t("empty.saved_lists_title")}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[300px] mx-auto">
                      <Trans i18nKey="empty.saved_lists_desc" ns="profiles" components={{ b: <strong className="font-semibold text-foreground/80" /> }} />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pt-1">{(savedListCards as any[]).map(renderSavedListCard)}</div>
                )
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Podzakładki: Robocze (niepublikowane) | Wspomnienia (opublikowane) | Zapisane (od innych). */}
              <TabSelect
                dotLabel={t("profile.new_content_aria")}
                value={wyjazdyTab}
                onChange={(v) => { subChosen.current = true; setWyjazdyTab(v as "robocze" | "wspomnienia" | "zapisane"); }}
                options={[{ id: "robocze", label: "Robocze" }, { id: "wspomnienia", label: "Wspomnienia" }, { id: "zapisane", label: "Zapisane" }]}
              />
              {wyjazdyTab === "zapisane" ? (
                // Zapisane wyjazdy od innych - ten sam UI co Wspomnienia (ProfileFeedCard).
                savedTripCards.length === 0 ? (
                  <div className="pt-16 pb-12 text-center px-8">
                    <span aria-hidden className="mx-auto mb-5 block h-24 w-24" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Zapisane.svg)", maskImage: "url(/Ikona_Zapisane.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
                    <p className="text-lg font-bold text-foreground">{t("empty.no_saved_trips")}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[300px] mx-auto">
                      <Trans i18nKey="empty.saved_trips_desc" ns="profiles" components={{ b: <strong className="font-semibold text-foreground/80" /> }} />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 pt-1">{(savedTripCards as any[]).map(renderSavedTripCard)}</div>
                )
              ) : wyjazdyTab === "robocze" ? (
                draftTrips.length === 0 ? (
                  /* Pusty stan wg makiety Nat (2026-08-30): brandowa ikona trasy (maska #ef9d78),
                     tytul + dwie linie copy, BEZ guzika CTA - tworzenie jest pod "+" w dolnym pasku. */
                  <div className="pt-16 pb-12 text-center px-8">
                    <span aria-hidden className="mx-auto mb-5 block h-28 w-28" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
                    <p className="text-lg font-bold text-foreground">{t("empty.no_drafts")}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                      {t("empty.drafts_desc")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">{draftTrips.map(renderTripCard)}</div>
                )
              ) : (
                memoryTrips.length === 0 ? (
                  /* Ten sam uklad co "Robocze" i "Zapisane" - brandowa ikona + copy, bez CTA. */
                  <div className="pt-16 pb-12 text-center px-8">
                    <span aria-hidden className="mx-auto mb-5 block h-28 w-28" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
                    <p className="text-lg font-bold text-foreground">{t("empty.no_memories")}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                      {t("empty.memories_desc")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">{memoryTrips.map(renderTripCard)}</div>
                )
              )}
            </div>
          )}
        </div>
      </div>
      </PullToRefresh>

      {/* Obserwujacy / Obserwowani - lista */}
      <Sheet open={followSheet !== null} onOpenChange={(v) => { if (!v) setFollowSheet(null); }}>
        <SheetContent side="bottom" className="h-[72dvh] flex flex-col rounded-t-2xl">
          {/* Uchwyt: sygnal, ze arkusz zamyka sie przeciagnieciem w dol. */}
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25 -mt-2 mb-1 shrink-0" />
          <SheetHeader className="pb-3 border-b border-border/20">
            <SheetTitle>{followSheet === "following" ? t("profile.following") : t("profile.followers")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            {followList.isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">…</p>
            ) : (followList.data ?? []).length === 0 ? (
              <div className="px-1 space-y-4 pt-2">
                <p className="text-sm text-muted-foreground text-center">
                  {followSheet === "following" ? t("profile.no_following", t("profile.no_following")) : t("profile.no_followers")}
                </p>
                <InviteFriendsBanner />
                <button onClick={() => { setFollowSheet(null); navigate("/search"); }} className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.97] transition-transform">
                  {t("profile.find_friends")}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {(followList.data ?? []).map((p) => (
                  <button key={p.id} onClick={() => { setFollowSheet(null); navigate(`/profil/${p.username}`); }} className="w-full flex items-center gap-3 px-1 py-2 active:bg-muted/40 rounded-xl transition-colors text-left">
                    <Avatar className="h-10 w-10"><AvatarImage src={avatarSrc(p.avatar_url)} className="object-cover bg-orange-100" /><AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">{(p.first_name || p.username || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.first_name || p.username}</p>
                      {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {user && <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} userId={user.id} />}

    </div>
  );
};

export default TravelerProfile;
