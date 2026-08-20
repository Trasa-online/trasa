import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MapPin, ArrowLeft, Bookmark, List, GalleryHorizontalEnd, Building2, Pencil, Trash2, Heart } from "lucide-react";
import { fetchListLike, toggleListLike, type LikeState } from "@/lib/likes";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { placeKeyOf, fetchPlacePhotosForKeys, pickPlaceCover } from "@/lib/placePhotoSocial";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { CategoryIcon } from "@/components/CategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { inferCategoryFromName } from "@/lib/placeCategoryIcon";

// Widok LISTY miejsc (polecajki) - UI/UX 1:1 z widokiem trasy (SharedRoute), ale zasilany z
// discovery_collections/discovery_items. Lista NIE jest trasa (brak kolejnosci-planu), ale
// prezentacyjnie ma wygladac tak samo. RLS: publiczny odczyt wymaga approved; wlasciciel widzi
// swoja tez pending.
export default function SharedList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSaved } = useSavedPlaces();

  // Polubienie listy (heart). Owner powiadamiany przez trigger notify_list_like.
  const { data: likeData } = useQuery({
    queryKey: ["list-like", id, user?.id],
    enabled: !!id,
    queryFn: () => fetchListLike(id!, user?.id),
  });
  const listLike: LikeState = likeData ?? { liked: false, count: 0 };
  const toggleLike = async () => {
    if (!id) return;
    if (!user) { navigate("/auth"); return; }
    const key = ["list-like", id, user.id];
    const cur = (queryClient.getQueryData(key) as LikeState) ?? listLike;
    queryClient.setQueryData(key, { liked: !cur.liked, count: Math.max(0, cur.count + (cur.liked ? -1 : 1)) });
    try { await toggleListLike(id, user.id, cur.liked); }
    finally { queryClient.invalidateQueries({ queryKey: key }); }
  };
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  // Widok listy jak trasa: Miejsca | Galeria (BEZ mapy - decyzja Nat). Galeria = zdjecia miejsc z listy.
  const [planTab, setPlanTab] = useState<"miejsca" | "galeria">("miejsca");
  const [detailPin, setDetailPin] = useState<any | null>(null);
  // Zapis pojedynczego miejsca z listy (bookmark per-miejsce -> SavePlaceSheet). Zapis CAŁEJ listy
  // (przycisk na dole) to osobna akcja (localStorage trasa_saved_collections) - oba zostają.
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const [saved, setSaved] = useState<boolean>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")).has(id ?? ""); } catch { return false; }
  });
  // Usuniecie listy (wlasciciel) - nieodwracalne, walidacja "czy na pewno?".
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user || !id) return;
    setDeleting(true);
    try {
      await (supabase as any).from("discovery_items").delete().eq("collection_id", id);
      const { error } = await (supabase as any).from("discovery_collections").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      toast.success("Usunięto listę.");
      setAskDelete(false);
      if (window.history.length > 1) navigate(-1); else navigate("/moj-profil");
    } catch (e: any) {
      toast.error("Nie udało się usunąć listy.");
      console.error("[SharedList] delete failed:", e?.message ?? e);
      setDeleting(false);
    }
  };

  const { data: col, isLoading } = useQuery({
    queryKey: ["shared-list", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, user_id, author_name, author_avatar, cover_url, tags")
        .eq("id", id as string)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["shared-list-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_items")
        .select("id, place_id, place_name, category, address, latitude, longitude, rating, google_place_id, photo_url, short_desc, tags, order_index")
        .eq("collection_id", id as string)
        .order("order_index", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  // #2/#3: zdjecia userow dodane do miejsc tej listy w wizytowkach (place_photos). Sluza jako
  // okladki miejsc (gdy discovery_items nie ma photo_url) ORAZ zasilaja Galerie listy.
  // Dwa klucze na miejsce (gpid: oraz nc:nazwa|miasto) - wizytowka zapisuje pod jednym z nich.
  const listCity = (col as any)?.city ?? null;
  const itemCoverKeys = (p: any): string[] => {
    const nc = placeKeyOf({ googlePlaceId: null, placeName: p.place_name, city: listCity });
    const gp = p.google_place_id ? placeKeyOf({ googlePlaceId: p.google_place_id, placeName: p.place_name, city: listCity }) : null;
    return gp ? [gp, nc] : [nc];
  };
  const listItemKeys = Array.from(new Set((items as any[]).flatMap(itemCoverKeys))).filter(Boolean);
  const { data: placePhotoMap } = useQuery({
    queryKey: ["shared-list-place-photos", listItemKeys.join("|")],
    enabled: listItemKeys.length > 0,
    queryFn: () => fetchPlacePhotosForKeys(listItemKeys),
  });

  // Autor listy (link do profilu + awatar). author_name/avatar sa denormalizowane na kolekcji,
  // ale username (do /profil/:username) dociagamy z profiles.
  const { data: author } = useQuery({
    queryKey: ["shared-list-author", col?.user_id],
    enabled: !!col?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("username, first_name, avatar_url").eq("id", col!.user_id).maybeSingle();
      return data as any;
    },
  });

  // Licznik wyswietlen (dedup per-urzadzenie, jak SharedRoute).
  useEffect(() => {
    if (!col?.id) return;
    try {
      const key = "trasa_viewed_collections";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(col.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, col.id].slice(-200)));
    } catch { /* brak localStorage */ }
    void (supabase as any).rpc("increment_collection_views", { p_collection_id: col.id });
  }, [col?.id]);

  const categoryLabel = (cat: string | null) => (cat ? subcategoryLabelLocalized(cat) : "Miejsce");
  // Kategoria: zapisana -> wywnioskowana z nazwy (miejsca z Google bywaja bez kategorii,
  // inaczej ikona=Landmark, chip="Miejsce").
  const catOf = (pin: any): string | null => pin.category ?? inferCategoryFromName(pin.place_name);

  const openGoogle = (pin: any) => {
    const q = encodeURIComponent([pin.place_name, pin.address, col?.city].filter(Boolean).join(", "));
    const pid = typeof pin.google_place_id === "string" && pin.google_place_id.trim() ? pin.google_place_id.trim() : "";
    const placeIdParam = pid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (catOf(pin) || "other") as any,
    city: col?.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: pin.rating ?? 0,
    photo_url: resolveStored(pin.photo_url) ?? "",
    description: pin.short_desc || "",
  });

  // Zapisz liste (bookmark) - localStorage, 1:1 z toggleSaveCollection (feed/Zapisane).
  const toggleSave = () => {
    if (!id) return;
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]"));
      const dates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
      if (set.has(id)) { set.delete(id); delete dates[id]; setSaved(false); toast("Usunięto z zapisanych"); }
      else { set.add(id); dates[id] = new Date().toISOString(); setSaved(true); toast.success("Zapisano listę"); void (supabase as any).rpc("increment_collection_saves", { p_collection_id: id }); void (supabase as any).rpc("notify_collection_saved", { p_collection_id: id }); }
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
    } catch { /* localStorage niedostepny */ }
  };

  // Otwórz sheet zapisu pojedynczego miejsca do listy usera (bookmark per-miejsce).
  const openSavePlace = (pin: any) => setSavePlace({
    place_name: pin.place_name,
    category: catOf(pin),
    address: pin.address ?? null,
    description: pin.short_desc ?? null,
    latitude: pin.latitude ?? null,
    longitude: pin.longitude ?? null,
    photo_url: pin.photo_url ?? null,
    place_id: pin.place_id ?? null,
  });

  if (isLoading) {
    return <div className="min-h-[100dvh] bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm animate-pulse">Ładowanie...</div></div>;
  }
  if (!col) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">📋</p>
        <p className="text-lg font-bold">Lista niedostępna</p>
        <p className="text-sm text-muted-foreground">Mogła zostać usunięta lub nie jest jeszcze opublikowana.</p>
        <button onClick={() => navigate("/eksploruj")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">Wróć do eksploracji</button>
      </div>
    );
  }

  // Hero = recznie wybrana okladka listy (cover_url); fallback do zdjecia pierwszego miejsca.
  const cover = resolveStored(col.cover_url) ?? resolveStored(items.find((i: any) => i.photo_url)?.photo_url) ?? null;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(col.id);
  const cityLabel = col.city || "";
  const authorName = author?.first_name || author?.username || col.author_name || "Ktoś";
  const isOwner = !!user && col.user_id === user.id;
  const placesCountLabel = `${items.length} ${items.length === 1 ? "miejsce" : items.length < 5 ? "miejsca" : "miejsc"}`;

  // #2: okladka miejsca = zapisane zdjecie (discovery_items.photo_url) LUB zdjecie usera dodane
  // w wizytowce (place_photos). Gdy pin nie ma photo_url, bierzemy pierwsze place_photo.
  const pinCover = (p: any): string | null => {
    const own = resolveStored(p.photo_url) ?? p.photo_url;
    if (typeof own === "string" && (own.startsWith("http") || own.startsWith("/"))) return own;
    return pickPlaceCover(placePhotoMap, itemCoverKeys(p));
  };

  // #3: Galeria listy = okladki miejsc + WSZYSTKIE zdjecia userow dodane do tych miejsc (place_photos).
  // Kazde zdjecie zmapowane na miejsce (tap -> wizytowka). Dedup po URL.
  const galleryMap = new Map<string, any>();
  for (const pin of items as any[]) {
    const c = pinCover(pin);
    if (c && !galleryMap.has(c)) galleryMap.set(c, pin);
  }
  if (placePhotoMap) {
    for (const pin of items as any[]) {
      const urls = itemCoverKeys(pin).flatMap((k) => placePhotoMap.get(k) ?? []);
      for (const u of urls) if (u && !galleryMap.has(u)) galleryMap.set(u, pin);
    }
  }
  const galleryItems = Array.from(galleryMap.entries()).map(([url, pin]) => ({ url, pin }));

  const renderList = () => (
    <div className="space-y-2.5">
      {items.map((pin: any, i: number) => {
        const noteText = (pin.short_desc ?? "").trim();
        const note = noteText ? (
          <div>
            <p className="text-sm font-semibold text-foreground">Notka autora</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-0.5">{noteText}</p>
          </div>
        ) : undefined;
        return (
          <RoutePlaceRow
            key={pin.id}
            pin={{ ...pin, category: catOf(pin), photo_url: pinCover(pin) }}
            index={i}
            categoryLabel={categoryLabel(catOf(pin))}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGoogle(pin)}
            onSave={() => openSavePlace(pin)}
            saved={isSaved(pin.place_name)}
            note={note}
          />
        );
      })}
    </div>
  );

  const renderCards = () => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {items.map((pin: any, i: number) => (
        <div key={pin.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col">
          <div className="relative w-full aspect-[4/3] bg-muted">
            <button onClick={() => openDetail(pin)} className="block w-full h-full text-left active:opacity-90 transition-opacity">
              <PlacePhoto pin={{ ...pin, category: catOf(pin), photo_url: pinCover(pin) }} className="w-full h-full object-cover" />
            </button>
            <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
            <button
              onClick={(e) => { e.stopPropagation(); openSavePlace(pin); }}
              aria-label={isSaved(pin.place_name) ? "Miejsce zapisane w liście" : "Zapisz miejsce do listy"}
              className={`absolute top-3 right-3 h-9 w-9 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform ${isSaved(pin.place_name) ? "bg-orange-100" : "bg-white/90 backdrop-blur-sm"}`}
            >
              <Bookmark className={`h-[18px] w-[18px] ${isSaved(pin.place_name) ? "text-orange-600 fill-orange-600" : "text-foreground"}`} strokeWidth={2} />
            </button>
          </div>
          <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
            <div className="px-4 pt-4 pb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <CategoryIcon category={catOf(pin)} className="h-3.5 w-3.5 shrink-0" />{categoryLabel(catOf(pin))}
              </span>
              <p className="text-[15px] font-bold leading-snug">{pin.place_name}</p>
              {pin.short_desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{pin.short_desc}</p>}
            </div>
          </button>
        </div>
      ))}
    </div>
  );

  // Galeria zdjec miejsc z listy (grid 3-kol jak instagram). Tap -> wizytowka miejsca.
  const renderGallery = () => (
    galleryItems.length === 0 ? (
      <p className="text-center text-sm text-muted-foreground py-10">{`Brak zdjęć w tej liście.`}</p>
    ) : (
      <div className="grid grid-cols-3 gap-1.5">
        {galleryItems.map((g, i) => (
          <button key={i} onClick={() => openDetail(g.pin)} className="relative aspect-square rounded-xl overflow-hidden bg-muted active:opacity-90 transition-opacity">
            <img src={g.url as string} alt={g.pin.place_name} className="w-full h-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
      {/* Hero */}
      <div className="relative w-full aspect-[16/10] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />
        <div className="absolute left-0 right-0 flex items-center px-4" style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); }} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Content - 1:1 z SharedRoute */}
      <div className="flex-1 overflow-y-auto pb-44">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2.5 flex-wrap text-sm">
            {author?.username ? (
              <button onClick={() => navigate(`/profil/${author.username}`)} className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity">
                <img src={avatarSrc(author?.avatar_url ?? col.author_avatar)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                @{author.username}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <img src={avatarSrc(col.author_avatar ?? null)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                {authorName}
              </span>
            )}
            {cityLabel && <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-4 w-4" />{cityLabel}</span>}
            <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{placesCountLabel}</span>
          </div>
          <div className="flex items-start gap-3 mt-3">
            <h1 className="flex-1 text-2xl font-black text-foreground leading-tight">{col.title || cityLabel}</h1>
            <button onClick={toggleLike} aria-label="Polub listę" className="shrink-0 flex flex-col items-center gap-0.5 active:scale-90 transition-transform">
              <Heart className={cn("h-6 w-6", listLike.liked ? "fill-red-500 text-red-500" : "text-foreground")} />
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{listLike.count}</span>
            </button>
          </div>
          {col.description && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{col.description}</p>}
          {Array.isArray(col.tags) && col.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {col.tags.map((tg: string) => (
                <span key={tg} className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-border/60 text-foreground text-[13px] font-semibold">{tg}</span>
              ))}
            </div>
          )}
          {/* Wlasciciel listy: edycja + usuniecie (jak w widoku trasy). */}
          {isOwner && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-secondary-foreground text-sm font-bold active:scale-[0.98] transition-transform"
              >
                <Pencil className="h-4 w-4" /> {`Edytuj listę`}
              </button>
              <button
                onClick={() => setAskDelete(true)}
                aria-label="Usuń listę"
                className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-secondary text-destructive active:scale-[0.98] transition-transform"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Miejsca | Galeria (BEZ mapy) */}
        <div className="px-5 pt-6">
          <div className="flex rounded-full bg-muted p-0.5 text-sm font-bold">
            <button onClick={() => setPlanTab("miejsca")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "miejsca" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Miejsca</button>
            <button onClick={() => setPlanTab("galeria")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Galeria</button>
          </div>
        </div>

        {planTab === "miejsca" ? (
          <div className="px-5 pt-4">
            {items.length > 0 && (
              <>
                <div className="flex items-center justify-end pb-3">
                  <div className="flex rounded-full bg-muted p-0.5">
                    <button onClick={() => setPlanView("list")} aria-label="Lista" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
                    <button onClick={() => setPlanView("cards")} aria-label="Karty" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><GalleryHorizontalEnd className="h-4 w-4" /></button>
                  </div>
                </div>
                {planView === "list" ? renderList() : renderCards()}
              </>
            )}
          </div>
        ) : (
          <div className="px-5 pt-4">
            {renderGallery()}
          </div>
        )}
      </div>

      <PlaceSwiperDetail open={!!detailPin} onOpenChange={(o) => !o && setDetailPin(null)} place={detailPin} city={col.city} />

      {/* CTA - zapis CAŁEJ listy (driver engagementu). TYLKO cudza lista - nie zapisujesz wlasnej (#4).
          Zapis pojedynczych miejsc = bookmark przy każdym miejscu (SavePlaceSheet). */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-3 bg-background/90 backdrop-blur-md border-t border-border/30" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
          <button onClick={toggleSave} className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />{saved ? "Zapisano listę" : "Zapisz tę listę"}
          </button>
        </div>
      )}

      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => !o && setSavePlace(null)} place={savePlace} city={col.city ?? ""} />

      {/* Potwierdzenie usuniecia listy - nieodwracalne. */}
      <AlertDialog open={askDelete} onOpenChange={(o) => { if (!o && !deleting) setAskDelete(false); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Na pewno chcesz usunąć tę listę?</AlertDialogTitle>
            <AlertDialogDescription>
              {`„${col.title}" zniknie bezpowrotnie z Twojego profilu. Nie można tego cofnąć.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Usuwanie…" : "Usuń"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
