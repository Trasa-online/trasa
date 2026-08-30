import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { avatarSrc } from "@/lib/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { toggleRouteLike, toggleListLike } from "@/lib/likes";
import { saveCollectionDb, unsaveCollectionDb } from "@/lib/savedCollections";
import { parseISO, format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FollowButton from "@/components/social/FollowButton";
import { useFollowCounts, useFollowList } from "@/hooks/useFollow";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import { ProfileFeedCard } from "@/components/profile/ProfileFeedCard";
import { SpontawayTabIcon } from "@/components/profile/SpontawayTabIcon";
import { shortRelativeTime } from "@/lib/relativeTime";
import { countryForCity } from "@/lib/tripCountries";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";

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

export default function PublicProfile() {
  const { t } = useTranslation("profiles");
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Kolejnosc i domyslna zakladka 1:1 z wlasnym profilem: Wyjazdy | Listy (2026-08-30).
  const [tab, setTab] = useState<"listy" | "wyjazdy">("wyjazdy");
  // Gest natywny: swipe w LEWO idzie Wyjazdy -> Listy (zgodnie z kolejnoscia pigulek).
  const swipeTabs = useSwipeNav({
    onLeft: () => setTab("listy"),
    onRight: () => setTab("wyjazdy"),
  });
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url, bio")
        .eq("username", username!)
        .maybeSingle();
      return data as { id: string; username: string; first_name: string | null; avatar_url: string | null; bio: string | null } | null;
    },
    enabled: !!username,
  });

  // Liczniki follow (asymetryczny model, publiczny SELECT).
  const { data: followCounts = { followers: 0, following: 0 } } = useFollowCounts(profile?.id);
  const followList = useFollowList(profile?.id, followSheet === "following" ? "following" : "followers");

  // Feed LIST (zakladka Listy): publiczne + zatwierdzone listy usera + kafelki miejsc + liczniki.
  const { data: listCards = [] } = useQuery({
    queryKey: ["public-list-feed", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, list_status, description, tags, views_count, saves_count, likes_count, updated_at")
        .eq("user_id", profile!.id).eq("kind", "ranking")
        // TYLKO publiczne polecajki (visited). Prywatne wishlisty "Do zobaczenia" (to_visit) NIGDY
        // na cudzym profilu - guard nawet gdyby jakaś została jako public+approved.
        .eq("list_status", "visited")
        // Soft-moderacja: publiczne widoczne od razu (pending + approved), tylko rejected/hidden ukryte.
        .eq("is_public", true).eq("hidden_by_admin", false).neq("moderation_status", "rejected")
        .order("updated_at", { ascending: false });
      const rows = (cols ?? []) as any[];
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
      return rows.map((r) => ({ ...r, tiles: byCol[r.id] ?? [] }));
    },
  });

  // Feed WYJAZDOW (zakladka Wyjazdy): publiczne trasy usera, zwiniete po folderze,
  // kafelki z pinow + liczniki (saved_routes / likes / routes.views).
  const { data: tripCards = [] } = useQuery({
    queryKey: ["public-trip-feed", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: routes } = await (supabase as any)
        .from("routes").select("id, title, city, start_date, day_number, folder_id, views, saves_count, likes_count, created_at, tags, review_narrative, ai_summary")
        .eq("user_id", profile!.id).eq("is_shared", true)
        .order("created_at", { ascending: false });
      const rows = (routes ?? []) as any[];
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
      return grouped.map(({ rep, days }) => ({
        id: rep.id,
        city: rep.city,
        title: rep.title,
        start_date: rep.start_date,
        created_at: rep.created_at,
        description: (rep.review_narrative || rep.ai_summary || "").trim() || null,
        tags: Array.isArray(rep.tags) ? rep.tags : [],
        tiles: days.flatMap((d) => pinsByRoute[d.id] ?? []),
        saves: Number(rep.saves_count ?? 0),
        likes: Number(rep.likes_count ?? 0),
        views: Number(rep.views ?? 0),
      }));
    },
  });

  // ── Interaktywne polubienie/zapis z kart (cudzy profil, wybor Nat 2026-08-23) ──
  // Serce/bookmark na karcie = przycisk. Wlasny publiczny profil -> licznik (nie polubisz swojego).
  const canInteract = !!user && !!profile?.id && user.id !== profile.id;
  const listIds = useMemo(() => (listCards as any[]).map((l) => l.id), [listCards]);
  const tripIds = useMemo(() => (tripCards as any[]).map((tr) => tr.id), [tripCards]);

  const { data: init } = useQuery({
    queryKey: ["pp-interactions", user?.id, listIds.join(","), tripIds.join(",")],
    enabled: canInteract && (listIds.length > 0 || tripIds.length > 0),
    queryFn: async () => {
      const [ll, lt, st] = await Promise.all([
        listIds.length ? (supabase as any).from("collection_likes").select("collection_id").eq("user_id", user!.id).in("collection_id", listIds) : Promise.resolve({ data: [] }),
        tripIds.length ? (supabase as any).from("likes").select("route_id").eq("user_id", user!.id).in("route_id", tripIds) : Promise.resolve({ data: [] }),
        tripIds.length ? (supabase as any).from("saved_routes").select("route_id").eq("user_id", user!.id).in("route_id", tripIds) : Promise.resolve({ data: [] }),
      ]);
      return {
        likedLists: new Set<string>(((ll as any).data ?? []).map((r: any) => r.collection_id)),
        likedTrips: new Set<string>(((lt as any).data ?? []).map((r: any) => r.route_id)),
        savedTrips: new Set<string>(((st as any).data ?? []).map((r: any) => r.route_id)),
      };
    },
  });
  const initLikedLists = init?.likedLists ?? new Set<string>();
  const initLikedTrips = init?.likedTrips ?? new Set<string>();
  const initSavedTrips = init?.savedTrips ?? new Set<string>();
  // Optymistyczne override + snapshot zapisanych list (localStorage, per-urzadzenie) do delty licznika.
  const [likeOverride, setLikeOverride] = useState<Record<string, boolean>>({});
  const [saveOverride, setSaveOverride] = useState<Record<string, boolean>>({});
  const [savedListIds, setSavedListIds] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")); } catch { return new Set(); }
  });
  const [initSavedLists] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")); } catch { return new Set(); }
  });

  const isListLiked = (id: string) => likeOverride["l:" + id] ?? initLikedLists.has(id);
  const isTripLiked = (id: string) => likeOverride["t:" + id] ?? initLikedTrips.has(id);
  const isTripSaved = (id: string) => saveOverride["t:" + id] ?? initSavedTrips.has(id);
  const isListSaved = (id: string) => savedListIds.has(id);
  // Licznik = baza (z DB) skorygowana o roznice miedzy stanem biezacym a poczatkowym.
  const delta = (now: boolean, was: boolean) => (now ? 1 : 0) - (was ? 1 : 0);

  const onTripLike = (tr: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isTripLiked(tr.id);
    setLikeOverride((m) => ({ ...m, ["t:" + tr.id]: !cur }));
    void toggleRouteLike(tr.id, user.id, cur);
  };
  const onListLike = (l: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isListLiked(l.id);
    setLikeOverride((m) => ({ ...m, ["l:" + l.id]: !cur }));
    void toggleListLike(l.id, user.id, cur);
  };
  const onTripSave = async (tr: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isTripSaved(tr.id);
    setSaveOverride((m) => ({ ...m, ["t:" + tr.id]: !cur }));
    if (cur) {
      await (supabase as any).from("saved_routes").delete().eq("user_id", user.id).eq("route_id", tr.id);
      toast("Usunięto z zapisanych");
    } else {
      await (supabase as any).from("saved_routes").upsert({ user_id: user.id, route_id: tr.id }, { onConflict: "user_id,route_id", ignoreDuplicates: true });
      void (supabase as any).rpc("notify_route_used", { p_route_id: tr.id });
      toast.success("Zapisano wyjazd");
    }
    queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
  };
  const onListSave = (l: any) => {
    if (!user) { navigate("/auth"); return; }
    const cur = isListSaved(l.id);
    const next = new Set(savedListIds);
    const dates = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
    if (cur) { next.delete(l.id); delete dates[l.id]; toast("Usunięto z zapisanych"); void unsaveCollectionDb(user.id, l.id); }
    else {
      next.add(l.id); dates[l.id] = new Date().toISOString(); toast.success("Zapisano listę");
      void (supabase as any).rpc("notify_collection_saved", { p_collection_id: l.id });
      void saveCollectionDb(user.id, l.id);
    }
    try {
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...next]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
    } catch { /* localStorage niedostepny */ }
    setSavedListIds(next);
  };

  if (isLoading) return null;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-[100dvh] gap-3">
      <p className="text-muted-foreground">{t("public.not_found")}</p>
      <button onClick={() => goBackOr(navigate, "/eksploruj")} className="text-orange-600 font-semibold text-sm">{t("public.back")}</button>
    </div>
  );

  // Imię (first_name) = nazwa wyświetlana; username = osobny @handle (nie username jako oba).
  const displayName = profile.first_name || profile.username || "";

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header: powrot + @username */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40">
        <button onClick={() => goBackOr(navigate, "/eksploruj")} className="h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold text-center truncate">@{profile.username}</h1>
        <div className="w-9" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="px-4 space-y-5 max-w-lg mx-auto pt-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

        {/* Avatar + nazwa + bio (Figma: nazwa | separator | bio) */}
        <div className="flex items-start gap-4">
          <Avatar className="h-[76px] w-[76px] shrink-0">
            <AvatarImage src={avatarSrc(profile.avatar_url)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-3xl font-black">
              {displayName.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
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

        {/* Statystyki inline: Obserwujacy / Obserwowani (klik -> lista) + akcja Obserwuj */}
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
          <FollowButton targetUserId={profile.id} className="h-9 px-4 text-sm" />
        </div>

        {/* Zakladki: Listy | Wyjazdy (ikona + labelka obok, underline aktywnej) */}
        <div className="flex border-b border-border/40 -mx-1">
          {/* Kolejnosc: Wyjazdy | Listy - ta sama co na wlasnym profilu. */}
          {(["wyjazdy", "listy"] as const).map((tk) => {
            const active = tab === tk;
            const label = tk === "listy" ? t("sections.lists", { defaultValue: "Listy" }) : t("sections.trips", { defaultValue: "Wyjazdy" });
            return (
              <button key={tk} onClick={() => setTab(tk)} className="relative flex-1 flex items-center justify-center gap-2 py-2.5" aria-label={label}>
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
            listCards.length === 0 ? (
              <FeedEmptyRO maskSrc="/Ikona_Trasy.svg" title="Brak list" desc={`Tu pojawią się polecajki tego użytkownika.`} />
            ) : (
              listCards.map((l: any) => (
                <ProfileFeedCard
                  key={l.id}
                  avatarUrl={profile.avatar_url}
                  fallback={displayName}
                  eyebrow=""
                  timestamp={shortRelativeTime(l.updated_at)}
                  title={l.title || t("feed.list_fallback", "Lista miejsc")}
                  description={l.description}
                  tags={Array.isArray(l.tags) ? l.tags : []}
                  tiles={l.tiles}
                  counts={{ saves: Math.max(0, (l.saves_count ?? 0) + delta(isListSaved(l.id), initSavedLists.has(l.id))), likes: Math.max(0, (l.likes_count ?? 0) + delta(isListLiked(l.id), initLikedLists.has(l.id))), views: l.views_count ?? 0 }}
                  onOpen={() => navigate(`/lista/${l.id}`)}
                  onLike={canInteract ? () => onListLike(l) : undefined}
                  liked={isListLiked(l.id)}
                  onSave={canInteract ? () => onListSave(l) : undefined}
                  saved={isListSaved(l.id)}
                />
              ))
            )
          ) : tripCards.length === 0 ? (
            <FeedEmptyRO maskSrc="/Ikona_Trasy.svg" title="Brak wyjazdów" desc={`Tu pojawią się wyjazdy tego użytkownika.`} />
          ) : (
            tripCards.map((tr: any) => {
              const dateLabel = tr.start_date ? format(parseISO(tr.start_date), "d LLLL yyyy", { locale: dateLocale() }) : "";
              const eyebrow = [countryForCity(tr.city), tr.city, dateLabel].filter(Boolean).join(" · ");
              return (
                <ProfileFeedCard
                  key={tr.id}
                  avatarUrl={profile.avatar_url}
                  fallback={displayName}
                  eyebrow={eyebrow}
                  timestamp={shortRelativeTime(tr.created_at)}
                  title={tr.title || (tr.city ? t("feed.trip_fallback", { city: tr.city, defaultValue: `Wyjazd do ${tr.city}` }) : t("feed.trip_fallback_generic", "Wyjazd"))}
                  description={tr.description}
                  tags={tr.tags}
                  tiles={tr.tiles}
                  mapPins={tr.tiles}
                  counts={{ saves: Math.max(0, tr.saves + delta(isTripSaved(tr.id), initSavedTrips.has(tr.id))), likes: Math.max(0, tr.likes + delta(isTripLiked(tr.id), initLikedTrips.has(tr.id))), views: tr.views }}
                  onOpen={() => navigate(`/route/${tr.id}`)}
                  onLike={canInteract ? () => onTripLike(tr) : undefined}
                  liked={isTripLiked(tr.id)}
                  onSave={canInteract ? () => onTripSave(tr) : undefined}
                  saved={isTripSaved(tr.id)}
                />
              );
            })
          )}
        </div>
      </div>
      </div>

      {/* Obserwujacy / Obserwowani - lista (klik -> profil danej osoby) */}
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
              <p className="text-sm text-muted-foreground text-center pt-6">
                {followSheet === "following"
                  ? t("public.no_following", { name: displayName, defaultValue: `${displayName} nikogo jeszcze nie obserwuje.` })
                  : t("public.no_followers", { name: displayName, defaultValue: `Nikt jeszcze nie obserwuje ${displayName}.` })}
              </p>
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
    </div>
  );
}
