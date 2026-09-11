import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBlockedIds } from "@/lib/blockedUsers";
import { avatarSrc } from "@/lib/avatar";
import { scopeLabel } from "@/lib/tripScope";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import { resolveStored } from "@/components/PlacePhoto";
import { EMPTY_ARRAY } from "@/lib/emptyRef";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";

// EKSPLORUJ jako SIATKA (IA 2026-09-11, makieta Nat: "double grid, wyjazdy ORAZ listy").
// Tresci od osob z calego swiata w dwoch kolumnach - user skanuje okladki zamiast przewijac
// karta po karcie (to zostalo w Feedzie, dla tresci od obserwowanych).
//
// Mozaika, nie sztywna siatka: zdjecie idzie w naturalnych proporcjach, a uklad robia
// kolumny CSS (ta sama technika co na profilu, TripLayout). Tekst pod zdjeciem, nie na nim -
// w malym kafelku napis na zdjeciu zasłaniałby polowe okladki.
//
// Wyjazd i lista sa w JEDNEJ siatce, wiec kazdy kafelek nosi malą plakietke z typem -
// bez niej user nie wie, w co wchodzi (ten sam problem, ktory Nat zglosila na profilu).

type GridItem = {
  kind: "trip" | "list";
  id: string;
  title: string;
  cover: string | null;
  meta: string;               // kraje/miasto
  authorName: string;
  authorAvatar: string | null;
  authorId: string | null;
  at: number;                 // sort: najnowsze na gorze
};

const ROUTE_SEL = "id, title, city, countries, user_id, published_at, created_at, list_cover_url, cover_url";
const LIST_SEL = "id, title, city, countries, user_id, author_name, author_avatar, updated_at, created_at";

async function fetchGrid(): Promise<GridItem[]> {
  const [routesRes, listsRes] = await Promise.all([
    (supabase as any).from("routes").select(ROUTE_SEL)
      // Ta sama bramka co w feedzie: opublikowany + miniatura + nie schowany przez admina.
      .eq("is_shared", true).eq("status", "published").eq("hidden_by_admin", false)
      .not("title", "is", null).not("list_cover_url", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(40),
    (supabase as any).from("discovery_collections").select(LIST_SEL)
      .eq("is_public", true).eq("kind", "ranking").eq("list_status", "visited")
      .eq("hidden_by_admin", false).neq("moderation_status", "rejected")
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);
  const routes = (routesRes.data ?? []) as any[];
  const lists = (listsRes.data ?? []) as any[];

  // Autorzy wyjazdow (listy maja autora zdenormalizowanego).
  const userIds = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
  const profileMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profs } = await (supabase as any).from("profiles").select("id, username, first_name, avatar_url").in("id", userIds);
    for (const p of profs ?? []) profileMap.set(p.id, p);
  }
  // Okladka listy = pierwsze zdjecie miejsca (okladki list nie ma - decyzja 2026-08-26).
  // Kolumn cover_url/list_cover_url na listach CELOWO nie czytamy: to pozostalosc sprzed
  // decyzji, a czesc z nich wskazuje na proxy zdjec Google (wygasle referencje = ikona "?").
  // Karta w feedzie robi dokladnie to samo, wiec siatka i feed pokazuja te sama okladke.
  const listIds = lists.map((l) => l.id);
  const firstPhoto = new Map<string, string>();
  if (listIds.length) {
    const { data: items } = await (supabase as any).from("discovery_items")
      .select("collection_id, photo_url, order_index, place_name, google_place_id").in("collection_id", listIds)
      .order("order_index", { ascending: true });
    const rows = (items ?? []) as any[];
    for (const it of rows) if (it.photo_url && !firstPhoto.has(it.collection_id)) firstPhoto.set(it.collection_id, it.photo_url);
    // Lista bez wlasnych zdjec przy miejscach: okladka ze zdjec SPOLECZNOSCI tych miejsc
    // (place_photos) - ten sam most, ktorym karty list na profilu dostaja okladki.
    const bare = rows.filter((it) => !firstPhoto.has(it.collection_id));
    if (bare.length) {
      const keys = Array.from(new Set(bare.flatMap((it) => pinCoverKeys(it)))).filter(Boolean);
      const photoMap = keys.length ? await fetchPlacePhotosForKeys(keys) : null;
      for (const it of bare) {
        if (firstPhoto.has(it.collection_id)) continue;
        const c = pickPlaceCover(photoMap, pinCoverKeys(it));
        if (c) firstPhoto.set(it.collection_id, c);
      }
    }
  }

  const tripItems: GridItem[] = routes.map((r) => {
    const p = profileMap.get(r.user_id);
    return {
      kind: "trip", id: r.id, title: r.title,
      cover: resolveStored(r.list_cover_url ?? r.cover_url) ?? null,
      meta: scopeLabel(r),
      authorName: p?.username ? `@${p.username}` : (p?.first_name ?? ""),
      authorAvatar: p?.avatar_url ?? null, authorId: r.user_id ?? null,
      at: new Date(r.published_at ?? r.created_at ?? 0).getTime(),
    };
  });
  const listItems: GridItem[] = lists.map((l) => ({
    kind: "list", id: l.id, title: l.title,
    cover: resolveStored(firstPhoto.get(l.id) ?? null) ?? null,
    meta: scopeLabel(l),
    authorName: l.author_name ?? "", authorAvatar: l.author_avatar ?? null, authorId: l.user_id ?? null,
    at: new Date(l.updated_at ?? l.created_at ?? 0).getTime(),
  }));
  return [...tripItems, ...listItems].sort((a, b) => b.at - a.at);
}

// Okladka kafelka: miniatura (.thumb, ~50 kB) -> oryginal -> placeholder. Ten sam lancuch,
// co w PlacePhoto; bez niego kafelek bral oryginal (1-3 MB) i przy bledzie zostawal z ikona "?".
function GridCover({ url }: { url: string | null }) {
  const { src, failed, onError } = useImageWithFallback(url, 400);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={onError} className="block w-full h-auto" />;
  }
  // Bez zdjecia: kwadrat zamiast 3:4 - w mozaice pusty peachy blok nie powinien dominowac.
  return (
    <span className="relative block w-full aspect-square">
      <span aria-hidden className="absolute inset-0 m-auto h-[42%] w-[42%]" style={{
        backgroundColor: "#EF9D78",
        WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }} />
    </span>
  );
}

export default function ExploreGrid() {
  const { t } = useTranslation("homefeed");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: items = EMPTY_ARRAY as GridItem[], isLoading } = useQuery({
    queryKey: ["explore-grid"],
    queryFn: fetchGrid,
    staleTime: 60_000,
  });
  const { data: blockedIds } = useQuery({
    queryKey: ["blocked-ids", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchBlockedIds(user?.id),
    staleTime: 5 * 60 * 1000,
  });
  const visible = useMemo(
    () => items.filter((it) => !it.authorId || !blockedIds?.has(it.authorId)),
    [items, blockedIds],
  );

  if (isLoading) {
    return (
      <div className="columns-2 gap-2">
        {[3, 4, 3, 5, 4, 3].map((h, i) => (
          <div key={i} className={`mb-2 break-inside-avoid rounded-2xl bg-muted animate-pulse`} style={{ height: `${h * 44}px` }} />
        ))}
      </div>
    );
  }
  if (visible.length === 0) {
    return (
      <div className="py-16 text-center px-8">
        <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-[#fcede3] flex items-center justify-center">
          <img src="/Ikona_Eksploracja.svg" alt="" className="h-8 w-8" draggable={false} />
        </div>
        <p className="text-base font-bold">{t("community_soon")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("community_soon_hint")}</p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-2">
      {visible.map((it) => (
        // Wrapper inline-block: WebKit potrafi PRZELAMAC element miedzy kolumnami mimo
        // break-inside-avoid (widac bylo 2-3 px gorna krawedz kafelka na dole jednej kolumny
        // i reszte na gorze drugiej). Element inline-block nie podlega fragmentacji.
        <div key={`${it.kind}-${it.id}`} className="mb-2 inline-block w-full align-top break-inside-avoid [-webkit-column-break-inside:avoid]">
        <button
          onClick={() => navigate(it.kind === "trip" ? `/route/${it.id}` : `/lista/${it.id}`)}
          className="relative block w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_1px_5px_rgba(0,0,0,0.08)] active:opacity-90 transition-opacity"
        >
          <span className="block w-full bg-[#fcede3]">
            <GridCover url={it.cover} />
          </span>
          {/* Typ kafelka - wyjazd czy lista. */}
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold leading-4 ${
            it.kind === "trip" ? "bg-primary text-white" : "bg-white/90 text-foreground"
          }`}>
            {it.kind === "trip" ? t("grid.trip") : t("grid.list")}
          </span>
          <span className="block px-2.5 pt-2 pb-2.5">
            <span className="block text-[13px] font-bold leading-tight text-foreground line-clamp-2">{it.title}</span>
            {it.meta && <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground line-clamp-1">{it.meta}</span>}
            {(it.authorName || it.authorAvatar) && (
              <span className="mt-1.5 flex items-center gap-1.5 min-w-0">
                <img src={avatarSrc(it.authorAvatar)} alt="" className="h-4 w-4 rounded-full object-cover bg-secondary shrink-0" />
                <span className="truncate text-[11px] text-muted-foreground">{it.authorName}</span>
              </span>
            )}
          </span>
        </button>
        </div>
      ))}
    </div>
  );
}
