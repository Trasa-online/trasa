import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { avatarSrc } from "@/lib/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ArrowLeft, LayoutGrid, ListChecks, MapPinned } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FollowButton from "@/components/social/FollowButton";
import { useFollowCounts, useFollowList } from "@/hooks/useFollow";
import { ProfileFeedCard } from "@/components/profile/ProfileFeedCard";
import { SpontawayTabIcon } from "@/components/profile/SpontawayTabIcon";
import { shortRelativeTime } from "@/lib/relativeTime";
import { countryForCity } from "@/lib/tripCountries";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";

// ── Empty state feedu (cudzy profil, read-only - bez CTA tworzenia) ─────────────
function FeedEmptyRO({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-12">
      <div className="h-14 w-14 rounded-2xl bg-[#fcede3] flex items-center justify-center text-orange-500">
        {icon}
      </div>
      <p className="text-base font-black">{title}</p>
    </div>
  );
}

export default function PublicProfile() {
  const { t } = useTranslation("profiles");
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"listy" | "wyjazdy">("listy");
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
        .select("id, title, city, list_status, views_count, saves_count, likes_count, updated_at")
        .eq("user_id", profile!.id).eq("kind", "ranking")
        // TYLKO publiczne polecajki (visited). Prywatne wishlisty "Do zobaczenia" (to_visit) NIGDY
        // na cudzym profilu - guard nawet gdyby jakaś została jako public+approved.
        .eq("list_status", "visited")
        .eq("is_public", true).eq("hidden_by_admin", false).eq("moderation_status", "approved")
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
        .from("routes").select("id, title, city, start_date, day_number, folder_id, views, created_at")
        .eq("user_id", profile!.id).eq("is_shared", true)
        .order("created_at", { ascending: false });
      const rows = (routes ?? []) as any[];
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const [pinsRes, savesRes, likesRes] = await Promise.all([
        (supabase as any).from("pins").select("id, route_id, place_name, category, photo_url, image_url, images, user_photo_urls, pin_order").in("route_id", ids).order("pin_order", { ascending: true }),
        (supabase as any).from("saved_routes").select("route_id").in("route_id", ids),
        (supabase as any).from("likes").select("route_id").in("route_id", ids),
      ]);
      const allPins = (pinsRes.data ?? []) as any[];
      const keys = Array.from(new Set(allPins.flatMap((p) => pinCoverKeys(p)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      const pinsByRoute: Record<string, any[]> = {};
      for (const p of allPins) {
        const _cover = pickPlaceCover(photoMap, pinCoverKeys(p));
        (pinsByRoute[p.route_id] ??= []).push({ ...p, _cover });
      }
      const saveCount: Record<string, number> = {};
      for (const s of savesRes.data ?? []) saveCount[s.route_id] = (saveCount[s.route_id] ?? 0) + 1;
      const likeCount: Record<string, number> = {};
      for (const l of likesRes.data ?? []) likeCount[l.route_id] = (likeCount[l.route_id] ?? 0) + 1;
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
        tiles: days.flatMap((d) => pinsByRoute[d.id] ?? []),
        saves: saveCount[rep.id] ?? 0,
        likes: likeCount[rep.id] ?? 0,
        views: Number(rep.views ?? 0),
      }));
    },
  });

  if (isLoading) return null;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-[100dvh] gap-3">
      <p className="text-muted-foreground">{t("public.not_found")}</p>
      <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="text-orange-600 font-semibold text-sm">{t("public.back")}</button>
    </div>
  );

  const displayName = profile.username || profile.first_name || "";

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header: powrot + @username */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40">
        <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="h-9 w-9 flex items-center justify-center text-foreground active:scale-90 transition-transform">
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
            <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>
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

        {/* Zakladki: Listy | Wyjazdy (ikony, underline aktywnej) */}
        <div className="flex border-b border-border/40 -mx-1">
          {(["listy", "wyjazdy"] as const).map((tk) => {
            const active = tab === tk;
            return (
              <button key={tk} onClick={() => setTab(tk)} className="relative flex-1 flex items-center justify-center py-2.5" aria-label={tk === "listy" ? t("sections.lists", { defaultValue: "Listy" }) : t("sections.trips", { defaultValue: "Wyjazdy" })}>
                {tk === "listy"
                  ? <LayoutGrid className="h-5 w-5" style={{ color: active ? "#0E0E0E" : "#CFCFCF" }} />
                  : <SpontawayTabIcon active={active} />}
                {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground rounded-full" />}
              </button>
            );
          })}
        </div>

        {/* Feed zakladki */}
        <div className="space-y-6 pt-1">
          {tab === "listy" ? (
            listCards.length === 0 ? (
              <FeedEmptyRO icon={<ListChecks className="h-6 w-6" />} title={t("feed.lists_empty_public", { defaultValue: "Brak list" })} />
            ) : (
              listCards.map((l: any) => (
                <ProfileFeedCard
                  key={l.id}
                  avatarUrl={profile.avatar_url}
                  fallback={displayName}
                  eyebrow=""
                  timestamp={shortRelativeTime(l.updated_at)}
                  title={l.title || t("feed.list_fallback", "Lista miejsc")}
                  tiles={l.tiles}
                  counts={{ saves: l.saves_count ?? 0, likes: l.likes_count ?? 0, views: l.views_count ?? 0 }}
                  onOpen={() => navigate(`/lista/${l.id}`)}
                />
              ))
            )
          ) : tripCards.length === 0 ? (
            <FeedEmptyRO icon={<MapPinned className="h-6 w-6" />} title={t("feed.trips_empty_public", { defaultValue: "Brak wyjazdów" })} />
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
                  tiles={tr.tiles}
                  counts={{ saves: tr.saves, likes: tr.likes, views: tr.views }}
                  onOpen={() => navigate(`/route/${tr.id}`)}
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
