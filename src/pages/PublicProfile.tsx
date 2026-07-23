import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { avatarSrc } from "@/lib/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseISO, isValid, format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { ArrowLeft, Map as MapIcon, Building2, Layers, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { resolveStored } from "@/components/PlacePhoto";
import FriendButton from "@/components/social/FriendButton";
import StatCard from "@/components/profile/StatCard";
import { CollectionDetail, type DiscoveryCollection } from "@/components/home/DiscoveryFeed";
import { themeBadgeLabel } from "@/lib/collectionThemes";

export default function PublicProfile() {
  const { t } = useTranslation("profiles");
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [routesOpen, setRoutesOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .eq("username", username!)
        .maybeSingle();
      return data as { id: string; username: string; first_name: string | null; avatar_url: string | null } | null;
    },
    enabled: !!username,
  });

  const { data: stats } = useQuery({
    queryKey: ["public-profile-stats", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("city")
        .eq("user_id", profile!.id);
      const all = data ?? [];
      const cities = new Set(all.map(r => r.city).filter(Boolean)).size;
      return { trips: all.length, cities };
    },
    enabled: !!profile?.id,
  });

  // Liczby obserwujacych / obserwowanych (jak na wlasnym profilu).
  const { data: followCounts = { followers: 0, following: 0 } } = useQuery({
    queryKey: ["public-profile-follows", profile?.id],
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        (supabase as any).from("followers").select("*", { count: "exact", head: true }).eq("following_id", profile!.id),
        (supabase as any).from("followers").select("*", { count: "exact", head: true }).eq("follower_id", profile!.id),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
    enabled: !!profile?.id,
  });


  // Zestawienia usera (publiczne + zaakceptowane). Count do karty + pelne dane
  // (z itemami + statystyki + home_city autora) do sheeta z podgladem.
  const { data: collections = [] } = useQuery({
    queryKey: ["public-collections", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, category, author_name, author_avatar, user_id, views_count, saves_count, plan_adds_count")
        .eq("user_id", profile!.id)
        .eq("kind", "ranking")
        .eq("is_public", true)
        .eq("hidden_by_admin", false)
        .eq("moderation_status", "approved")
        .order("updated_at", { ascending: false });
      if (!cols?.length) return [] as DiscoveryCollection[];
      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url, latitude, longitude, place_id, category, address, rating")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });
      const { data: prof } = await (supabase as any).from("profiles").select("home_city").eq("id", profile!.id).maybeSingle();
      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        author_home_city: prof?.home_city ?? null,
        items: (items ?? []).filter((i: any) => i.collection_id === col.id),
      }));
    },
  });

  // Dziennik usera (read-only): pocztowki jak we wlasnym Dzienniku. Trasy wielodniowe
  // zwiniete po folderze (dzien 1 = reprezentant), okladka z review_photos lub pierwszego
  // pina ze zdjeciem. RLS zwraca trasy widoczne dla ogladajacego (udostepnione).
  const { data: postcards = [], isLoading: postcardsLoading } = useQuery({
    queryKey: ["public-journal", profile?.id],
    enabled: !!profile?.id && routesOpen,
    queryFn: async () => {
      const { data: routes } = await supabase
        .from("routes")
        .select("id, city, title, day_number, start_date, end_date, folder_id, ai_summary, review_photos")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false });
      const rows = (routes ?? []) as any[];
      // Okladki: pierwszy pin ze zdjeciem (wg pin_order) per trasa.
      const ids = rows.map((r) => r.id);
      const coverMap: Record<string, string> = {};
      if (ids.length) {
        const { data: pins } = await (supabase as any)
          .from("pins").select("route_id, photo_url, image_url, pin_order")
          .in("route_id", ids).order("pin_order", { ascending: true });
        for (const p of pins ?? []) {
          if (coverMap[p.route_id]) continue;
          const u = resolveStored(p.photo_url || p.image_url);
          if (u) coverMap[p.route_id] = u;
        }
      }
      // Zwin trasy wielodniowe (folder_id) w jedna pocztowke.
      const folderMap = new Map<string, any[]>();
      const out: any[] = [];
      for (const e of rows) {
        if (e.folder_id) {
          if (!folderMap.has(e.folder_id)) folderMap.set(e.folder_id, []);
          folderMap.get(e.folder_id)!.push(e);
        } else {
          out.push({ ...e, _numDays: 1, _cover: coverMap[e.id] });
        }
      }
      for (const days of folderMap.values()) {
        const sorted = [...days].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
        const rep = sorted[0];
        out.push({
          ...rep,
          title: sorted.length > 1 ? null : rep.title,
          _numDays: sorted.length,
          review_photos: sorted.flatMap((d) => d.review_photos ?? []),
          _cover: sorted.map((d) => coverMap[d.id]).find(Boolean),
        });
      }
      out.sort((a, b) => {
        const ad = a.start_date ? parseISO(a.start_date).getTime() : 0;
        const bd = b.start_date ? parseISO(b.start_date).getTime() : 0;
        return bd - ad;
      });
      return out;
    },
  });

  if (isLoading) return null;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-muted-foreground">{t("public.not_found")}</p>
      <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="text-orange-600 font-semibold text-sm">{t("public.back")}</button>
    </div>
  );

  const displayName = profile.username || profile.first_name;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40">
        <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="h-9 w-9 flex items-center justify-center text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold text-center">@{profile.username}</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-6 pt-6">
        {/* Avatar + nazwa - wyrownane do lewej (spojne z wlasnym profilem) */}
        <div className="flex items-center gap-4">
          <Avatar className="h-[76px] w-[76px] shrink-0">
            <AvatarImage src={avatarSrc(profile.avatar_url)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-3xl font-black">
              {displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-display font-extrabold leading-tight truncate">{displayName}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>
          </div>
        </div>

        {/* Obserwujacy / Obserwowani + akcja (znajomy/obserwuj) */}
        <div className="flex items-end gap-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("profile.followers")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.followers}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("profile.following")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.following}</p>
          </div>
          <div className="flex-1" />
          <FriendButton targetUserId={profile.id} className="h-9 px-4 text-sm" />
        </div>

        {/* Statystyki - TEN SAM uklad co wlasny profil (Plany+Miasta 2-kol, Zestawienia pelne). */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={stats?.trips ?? 0}
              title={t("sections.routes")}
              subtitle={t("sections.routes_sub")}
              icon={<MapIcon className="h-6 w-6" />}
              className="bg-secondary text-secondary-foreground"
              onClick={() => setRoutesOpen(true)}
            />
            <StatCard
              value={stats?.cities ?? 0}
              title={t("sections.cities")}
              subtitle={t("sections.cities_sub")}
              icon={<Building2 className="h-6 w-6" />}
              className="bg-trasa-cream text-trasa-cream-ink"
            />
          </div>
          <StatCard
            full
            value={collections.length}
            title={t("sections.collections")}
            subtitle={t("sections.collections_sub_public")}
            icon={<Layers className="h-6 w-6" />}
            className="bg-trasa-orange text-trasa-orange-ink"
            onClick={collections.length > 0 ? () => setCollectionsOpen(true) : undefined}
          />
        </div>
      </div>

      {/* Sheet: dziennik usera (pocztowki, read-only). Tap karty -> szczegoly trasy. */}
      <Sheet open={routesOpen} onOpenChange={setRoutesOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0" style={{ maxHeight: "85dvh", height: "85dvh" }}>
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle>{t("public.journal_title", { name: displayName })}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
            {postcardsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t("public.loading")}</p>
            ) : postcards.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">🗺️</div>
                <p className="text-sm font-bold">{t("public.no_routes_title")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto leading-relaxed">
                  {t("public.no_routes_desc")}
                </p>
              </div>
            ) : (
              postcards.map((e: any) => {
                const validPhotos = (e.review_photos ?? []).filter((u: any) => !!u && typeof u === "string" && u.trim() !== "");
                const thumb = validPhotos[0] ?? e._cover ?? getRandomPinPlaceholder(e.id);
                const d = e.start_date ? parseISO(e.start_date) : null;
                const dateLabel = d && isValid(d) ? format(d, "d MMMM yyyy", { locale: dateLocale() }) : "";
                return (
                  <button
                    key={e.id}
                    onClick={() => { setRoutesOpen(false); navigate(`/route/${e.id}`); }}
                    className="w-full rounded-3xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(ev) => { (ev.target as HTMLImageElement).src = getRandomPinPlaceholder(e.id + "_fb"); }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                        <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">{e.title || e.city || t("public.trip_fallback")}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {dateLabel && <p className="text-white/70 text-xs">{dateLabel}</p>}
                          {e._numDays > 1 && (
                            <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              <CalendarDays className="h-2.5 w-2.5" />{t("public.days_count", { n: e._numDays })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {e.ai_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed px-4 py-3">{e.ai_summary}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: zestawienia usera (lista) -> tap otwiera podglad (CollectionDetail) */}
      <Sheet open={collectionsOpen} onOpenChange={setCollectionsOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0" style={{ maxHeight: "85dvh", height: "85dvh" }}>
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle>{t("public.collections_title", { name: displayName })}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-3">
            {collections.map((col) => {
              const cover = resolveStored(col.items.find((i) => i.photo_url)?.photo_url) ?? getRandomPinPlaceholder(col.id);
              const badge = themeBadgeLabel(col.category);
              return (
                <button
                  key={col.id}
                  onClick={() => { setCollectionsOpen(false); setActiveCol(col); }}
                  className="w-full flex items-center gap-3 rounded-3xl bg-card border border-border/50 p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <img src={cover} alt="" className="h-16 w-16 rounded-2xl object-cover shrink-0" loading="lazy"
                    onError={(ev) => { (ev.target as HTMLImageElement).src = getRandomPinPlaceholder(col.id + "_fb"); }} />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {badge && <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700">{badge}</span>}
                    <p className="font-bold text-sm leading-tight truncate">{col.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[col.city, t("public.places_count", { count: col.items.length })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: podglad zestawienia (reuzyty komponent z DiscoveryFeed) */}
      <Sheet open={!!activeCol} onOpenChange={(o) => { if (!o) setActiveCol(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 [&>button:last-child]:hidden" style={{ maxHeight: "92vh", height: "92vh" }}>
          {activeCol && <CollectionDetail col={activeCol} onClose={() => setActiveCol(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
