import { useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchBlockedIds } from "@/lib/blockedUsers";
import { scopeLabel } from "@/lib/tripScope";
import { pinCoverKeys, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import { resolveStored } from "@/components/PlacePhoto";
import { EMPTY_ARRAY } from "@/lib/emptyRef";
import { useImageWithFallback } from "@/hooks/useImageWithFallback";

// EKSPLORUJ jako SIATKA (IA 2026-09-11, makieta Nat: "double grid, wyjazdy ORAZ listy").
// Tresci od osob z calego swiata w dwoch kolumnach - user skanuje okladki zamiast przewijac
// karta po karcie (to zostalo w Feedzie, dla tresci od obserwowanych).
//
// Mozaika jak na Pintereście (makieta Nat 2026-09-11, druga iteracja tego samego dnia):
// samo zdjecie z zaokraglonymi rogami i SAMA nazwa pod nim - bez karty, cienia, autora
// i awatara. Zdjecie idzie w naturalnych proporcjach, uklad robia kolumny CSS (ta sama
// technika co na profilu, TripLayout).
//
// Wyjazd i lista sa w JEDNEJ siatce, wiec kazdy kafelek nosi w rogu IKONE typu (znak "S"
// dla wyjazdu, kartka dla listy - te same, co w kategoriach wyszukiwarki), nie napis.
//
// Wyjazd z galeria dostaje karuzele: kafelek przewija sie w bok po zdjeciach (okladka
// pierwsza), kropki pod spodem jak na Pintereście. Wysokosc kafelka wyznacza OKLADKA
// (jej naturalne proporcje), reszta zdjec jest kadrowana do tego samego pudelka.

type GridItem = {
  kind: "trip" | "list";
  id: string;
  title: string;
  cover: string | null;
  /** Okladka + zdjecia z galerii wyjazdu (max 6) - gdy > 1, kafelek jest karuzela. */
  photos: string[];
  meta: string;               // kraje/miasto
  authorName: string;
  authorAvatar: string | null;
  authorId: string | null;
  at: number;                 // sort: najnowsze na gorze
};

const ROUTE_SEL = "id, title, city, countries, user_id, published_at, created_at, list_cover_url, cover_url, review_photos";
const MAX_TILE_PHOTOS = 6;
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
    const cover = resolveStored(r.list_cover_url ?? r.cover_url) ?? null;
    // Galeria wyjazdu do karuzeli: okladka pierwsza, bez jej duplikatu, bez pustych wpisow.
    const gallery = (Array.isArray(r.review_photos) ? r.review_photos : [])
      .map((u: unknown) => (typeof u === "string" ? resolveStored(u) : null))
      .filter((u: string | null): u is string => !!u && u !== cover);
    const photos = [cover, ...gallery].filter((u): u is string => !!u).slice(0, MAX_TILE_PHOTOS);
    return {
      kind: "trip", id: r.id, title: r.title,
      cover, photos,
      meta: scopeLabel(r),
      authorName: p?.username ? `@${p.username}` : (p?.first_name ?? ""),
      authorAvatar: p?.avatar_url ?? null, authorId: r.user_id ?? null,
      at: new Date(r.published_at ?? r.created_at ?? 0).getTime(),
    };
  });
  const listItems: GridItem[] = lists.map((l) => ({
    kind: "list", id: l.id, title: l.title,
    cover: resolveStored(firstPhoto.get(l.id) ?? null) ?? null,
    photos: [resolveStored(firstPhoto.get(l.id) ?? null)].filter((u): u is string => !!u),
    meta: scopeLabel(l),
    authorName: l.author_name ?? "", authorAvatar: l.author_avatar ?? null, authorId: l.user_id ?? null,
    at: new Date(l.updated_at ?? l.created_at ?? 0).getTime(),
  }));
  return [...tripItems, ...listItems].sort((a, b) => b.at - a.at);
}

// Okladka kafelka: miniatura (.thumb, ~50 kB) -> oryginal -> placeholder. Ten sam lancuch,
// co w PlacePhoto; bez niego kafelek bral oryginal (1-3 MB) i przy bledzie zostawal z ikona "?".
function GridCover({ url, fill, onRatio }: { url: string | null; fill?: boolean; onRatio?: (r: number) => void }) {
  const { src, failed, onError } = useImageWithFallback(url, 400);
  if (src && !failed) {
    return (
      <img
        src={src} alt="" loading="lazy" onError={onError}
        onLoad={(e) => { const im = e.currentTarget; if (onRatio && im.naturalWidth && im.naturalHeight) onRatio(im.naturalWidth / im.naturalHeight); }}
        className={fill ? "absolute inset-0 h-full w-full object-cover" : "block w-full h-auto"}
      />
    );
  }
  // Bez zdjecia: kwadrat zamiast 3:4 - w mozaice pusty peachy blok nie powinien dominowac.
  return (
    <span className={fill ? "absolute inset-0 block" : "relative block w-full aspect-square"}>
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

// Karuzela zdjec wyjazdu w kafelku. Pudelko ma proporcje OKLADKI (mierzone po jej zaladowaniu;
// do tego czasu 3:4), kolejne zdjecia sa kadrowane do niego (object-cover) - jak na Pintereście.
// data-no-swipe: przewijanie w bok nie moze cofac ekranu ani przelaczac zakladek (CLAUDE.md).
function TileCarousel({ photos }: { photos: string[] }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  // Kolejne zdjecia dociagamy dopiero, gdy user DOTKNIE karuzeli. Osiem kafelkow x szesc
  // zdjec = 48 pobran na wejsciu w Eksploruj - siatka ladowala sie wyraznie dluzej,
  // a wiekszosci tych zdjec nikt by nie przewinal.
  const [engaged, setEngaged] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(Math.max(0, Math.min(photos.length - 1, i)));
  };
  return (
    <div className="relative w-full bg-[#fcede3]" style={{ aspectRatio: ratio ? String(ratio) : "3 / 4" }}>
      <div
        ref={trackRef}
        data-no-swipe
        onScroll={onScroll}
        onPointerDown={() => setEngaged(true)}
        onTouchStart={() => setEngaged(true)}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
      >
        {photos.map((u, i) => (
          <div key={`${u}-${i}`} className="relative h-full w-full shrink-0 snap-center">
            {(i === 0 || engaged) && <GridCover url={u} fill onRatio={i === 0 ? setRatio : undefined} />}
          </div>
        ))}
      </div>
      {/* Kropki: ktore zdjecie z ilu. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {photos.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-3.5 bg-white" : "w-1.5 bg-white/60"}`} />
        ))}
      </div>
    </div>
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
      <div className="grid grid-cols-2 items-start gap-2">
        {[[3, 4, 3], [5, 4, 3]].map((col, ci) => (
          <div key={ci} className="flex flex-col gap-4">
            {col.map((h, i) => <div key={i} className="rounded-2xl bg-muted animate-pulse" style={{ height: `${h * 44}px` }} />)}
          </div>
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

  // Dwie kolumny flex zamiast kolumn CSS (multicol). WebKit nie malowal prawej kolumny multicol,
  // gdy kafelek mial w srodku warstwe kompozytowana (karuzela z przewijaniem / przejscie
  // opacity): layout byl poprawny, obraz zaladowany, a na ekranie zostawal peachy placeholder.
  // Rozdzial naprzemienny (1., 3., 5. w lewej; 2., 4., 6. w prawej) - typy sie mieszaja
  // (wyjazdy 9:16 i listy poziome), wiec kolumny wyrownuja sie same.
  const columns: GridItem[][] = [[], []];
  visible.forEach((it, i) => columns[i % 2].push(it));

  return (
    <div className="grid grid-cols-2 items-start gap-2">
      {columns.map((col, ci) => (
      <div key={ci} className="flex min-w-0 flex-col gap-4">
      {col.map((it) => {
        const open = () => navigate(it.kind === "trip" ? `/route/${it.id}` : `/lista/${it.id}`);
        return (
          <div key={`${it.kind}-${it.id}`} className="w-full">
            {/* div + role, nie <button>: w srodku jest przewijana karuzela, a Safari nie lubi
                przewijania wewnatrz przycisku. Tap (bez przewiniecia) otwiera wyjazd / liste. */}
            <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
              className="group block w-full text-left active:opacity-90 transition-opacity">
              <div className="relative w-full overflow-hidden rounded-2xl bg-[#fcede3]">
                {it.photos.length > 1 ? <TileCarousel photos={it.photos} /> : <GridCover url={it.cover} />}
                {/* Ikona typu w rogu - to samo, co w kategoriach wyszukiwarki (znak "S" = wyjazd,
                    kartka = lista). Bez napisu: ikona wystarczy, a nie zaslania okladki. */}
                <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-sm" aria-label={it.kind === "trip" ? t("grid.trip") : t("grid.list")}>
                  {it.kind === "trip"
                    ? <img src="/spontaway-symbol.png" alt="" className="h-4 w-[18px] object-contain" draggable={false} />
                    : <FileText className="h-4 w-4 text-foreground" strokeWidth={2.2} />}
                </span>
              </div>
              <p className="mt-1.5 px-0.5 text-[13px] font-semibold leading-snug text-foreground line-clamp-2">{it.title}</p>
            </div>
          </div>
        );
      })}
      </div>
      ))}
    </div>
  );
}
