// PlaceSwiperDetail: bottom-sheet drawer otwierany po tap karty w PlaceSwiper.
// Renderuje wizytowke biznesowa (Premium content) z full set sekcji.
//
// Po refactor (commit a1494d2 / Phase 4): cala logika UI renderowania sekcji jest
// w `<PremiumBusinessCard mode='detail'/>`. Ten plik trzyma tylko:
// - Sheet wrapper z drag-to-dismiss
// - Data fetching useEffect (Google Places detail + business_posts)
// - Like/Skip CTA fixed bottom (tylko gdy props onLike/onSkip podane)
// - Maps button w header slot

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, Bookmark } from "lucide-react";
import { useDistanceReference } from "@/lib/distanceReference";
import { haversineKm, formatDistance } from "@/lib/distance";
import { Drawer as VaulDrawer } from "vaul";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getPhotoUrl, ensurePhotoCached } from "@/lib/placePhotos";
import { fetchPlaceUserPhotos } from "@/lib/placeUserPhotos";
import { placeKeyOf, pinCoverKeys, fetchPlacePhotosForKeys, uploadPlacePhoto, fetchPhotoLikes, togglePhotoLike, type LikeState } from "@/lib/placePhotoSocial";
import { fetchPlaceNotes, type PlaceUserNote } from "@/lib/placeNotes";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { GOOGLE_PLACE_DETAILS_DISABLED } from "@/lib/appMode";
import { type MockPlace, fetchEnrichedPlace } from "./PlaceSwiper";
import posthog from "posthog-js";
import PremiumBusinessCard from "@/components/business/PremiumBusinessCard";
import { fromMockPlace } from "@/components/business/premiumBusinessAdapters";
import type { BusinessPost, GoogleReview } from "@/components/business/premiumBusiness.types";
import ReportPlaceLink from "@/components/place/ReportPlaceLink";

// Zgłoszenie dozwolone tylko dla realnego miejsca z bazy (uuid), nie dla demo/mocków.
const isRealPlaceId = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface PlaceDetail {
  place_id?: string;
  name: string;
  rating: number;
  user_ratings_total: number;
  price_level?: number;
  types: string[];
  formatted_address: string;
  photos: { photo_reference: string }[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  geometry?: { location?: { lat?: number; lng?: number } };
  reviews: GoogleReview[];
}

interface PlaceSwiperDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: MockPlace | null;
  city?: string;
  onLike?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
  /** Czy miejsce jest juz zapisane - stan zakladki na hero. */
  saved?: boolean;
  skipGoogleFetch?: boolean;
  /** Data wyjazdu (YYYY-MM-DD) - agenda wydarzen pokazuje najblizsze TEJ dacie. Domyslnie dzis. */
  referenceDate?: string;
  /** #3e: fires po dodaniu zdjecia usera do miejsca (place_photos). Rodzic (np. tworzenie trasy)
   *  moze od razu odswiezyc okladke miejsca. (url = nowe zdjecie, placeKey = tozsamosc miejsca). */
  onPhotoAdded?: (url: string, placeKey: string) => void;
}

const validUrl = (url?: string | null) =>
  !!url && (url.startsWith("http") || url.startsWith("/")) &&
  !url.includes("staticmap") && !url.includes("maps/api/staticmap");

const PlaceSwiperDetail = ({
  open,
  onOpenChange,
  place,
  city,
  onLike,
  onSkip,
  saved,
  skipGoogleFetch = false,
  referenceDate,
  onPhotoAdded,
}: PlaceSwiperDetailProps) => {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [businessPosts, setBusinessPosts] = useState<BusinessPost[]>([]);
  // Swiezy profil biznesu doczytany przy otwarciu wizytowki (place ze swipera bywa starym
  // snapshotem - po edycji profilu przez lokal zdjecia/dane byly nieaktualne). ep = "effective place".
  const [freshPlace, setFreshPlace] = useState<MockPlace | null>(null);
  // #3e: zdjecia userow dodane bezposrednio do miejsca (galeria wspoldzielona, place_photos).
  const [userPlacePhotos, setUserPlacePhotos] = useState<string[]>([]);
  const [addingPhoto, setAddingPhoto] = useState(false);
  // Notki userow o miejscu (sekcja "Od użytkowników"). Osobna tresc - NIE opis miejsca.
  const [userNotes, setUserNotes] = useState<PlaceUserNote[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // #6: lajki zdjec w galerii (ref = URL zdjecia -> stabilny dla Storage/B2B/user).
  const [photoLikes, setPhotoLikes] = useState<Map<string, LikeState>>(new Map());
  const distanceRef = useDistanceReference();
  const { user } = useAuth();
  // Stan zakladki "zapisane" na hero. Gdy rodzic nie poda `saved`, czytamy go z globalnego
  // stanu zapisanych miejsc - dzieki temu ikona przelacza sie od razu po zapisie, niezaleznie
  // od tego, z ktorej sciezki wizytowka zostala otwarta (zgloszenie Nat 2026-08-29).
  const { isSaved } = useSavedPlaces();
  const { t } = useTranslation("wizytowka");
  const ep = freshPlace ?? place;
  const placeKey = ep ? placeKeyOf({ googlePlaceId: (ep as any).google_place_id ?? null, placeName: ep.place_name, city: ep.city ?? city ?? null }) : "";

  useEffect(() => {
    if (!open || !place) {
      setDetail(null);
      setPhotos([]);
      setBusinessPosts([]);
      setFreshPlace(null);
      setUserPlacePhotos([]);
      setPhotoLikes(new Map());
      setUserNotes([]);
      return;
    }

    setLoading(true);
    setFreshPlace(null);

    // Track view event for real places (UUID, not mock)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(place.id)) {
      posthog.capture("place_viewed", { place_id: place.id });
    }

    const fetchAll = async () => {
      // 1. Doczytaj SWIEZY profil biznesu (real DB place). place ze swipera to snapshot z chwili
      //    zaladowania kolejki - po edycji profilu (zdjecia, godziny, eventy) bywa nieaktualny.
      //    Dzieki temu wizytowka pokazuje aktualne dane niezaleznie od tego jak stary jest swiper.
      let cur = place;
      if (UUID_RE.test(place.id)) {
        const fresh = await fetchEnrichedPlace(place.id, referenceDate);
        if (fresh) { cur = fresh; setFreshPlace(fresh); }
      }

      // 2. Business with own photos → use their photos (don't override with Google),
      //    ale NADAL fetchujemy Google detail dla reviews, formatted_address, rating.
      const hasBizPhotos = cur.businessHasOwnPhoto || skipGoogleFetch;
      if (hasBizPhotos) {
        setPhotos([cur.photo_url, ...(cur.galleryPhotos ?? [])].filter(Boolean) as string[]);
      }

      // ZERO Google (2026-07-29): NIE wołamy Place Details ani cache-place-photo (oba
      // biją Google). detail zostaje null (recenzje/godziny i tak ukryte). Zdjęcia miejsca
      // biznesu = jego własne; zwykłego miejsca = zdjęcia userów z tras (pins.user_photo_urls).
      // Brak zdjęć -> displayPhotos puste -> hero pokazuje placeholder/ikonę.
      const placesPromise = GOOGLE_PLACE_DETAILS_DISABLED
        ? (hasBizPhotos
            ? Promise.resolve()
            : fetchPlaceUserPhotos({
                placeDbId: cur.id,
                googlePlaceId: (cur as { google_place_id?: string }).google_place_id ?? null,
                placeName: cur.place_name,
                city: city ?? cur.city,
              })
                .then((urls) => { if (urls.length > 0) setPhotos(urls); })
                .catch(() => {}))
        : supabase.functions
        .invoke("google-places-proxy", {
          body: {
            placeName: cur.place_name,
            latitude: cur.latitude,
            longitude: cur.longitude,
            city: city ?? cur.city,
            // Authorytatywny place_id z bazy - inaczej proxy rozwiazuje miejsce przez
            // luzne dopasowanie nazwy (nearbysearch/textsearch) i dla lokalu o popularnej
            // nazwie (np. "Wanderlust coffee place") potrafi trafic w INNY pobliski lokal
            // -> zly adres/mapa/recenzje. Karta swipe juz przekazuje ten id; detal musi tez.
            googlePlaceId: (cur as { google_place_id?: string }).google_place_id ?? null,
            placeDbId: cur.id,
          },
        })
        .then(({ data }) => {
          if (data?.result) {
            setDetail(data.result);
            // Nie nadpisuj photos Google'em gdy biznes ma juz wlasne zdjecia. Dla zwyklych
            // miejsc: pokazujemy MIN. 3 zdjecia - cache'owana okladka (szybki JPEG) jako
            // pierwsze, a Google (do 3 refow) uzupelnia. Wczesniej dla cache'owanego miejsca
            // fetch Google byl pomijany -> wizytowka miala tylko 1 zdjecie.
            if (!hasBizPhotos) {
              const isUsable = (u: string | undefined): u is string =>
                typeof u === "string" && (u.startsWith("http") || u.startsWith("/api/"));
              const googleUrls = (data.result.photos ?? [])
                .slice(0, 3)
                .map((p: { photo_url?: string; photo_reference?: string }) => p.photo_url ?? getPhotoUrl(p.photo_reference ?? "", 800))
                .filter(isUsable);
              // Cover (places.photo_url) to cache'owany JPEG PIERWSZEGO zdjecia Google
              // (klucz gpid_<id>_800.jpg / hash_...). Wizualnie cover == googleUrls[0], ale ma
              // INNY URL (Storage vs /api/place-photo proxy) -> dedup po stringu (Set/indexOf)
              // go NIE lapie i wizytowka pokazywala "pierwsze i drugie zdjecie" identyczne.
              // Gdy mamy cover, pomijamy googleUrls[0] zeby nie dublowac tej samej fotki.
              const coverFirst = isUsable(cur.photo_url) ? [cur.photo_url] : [];
              const googleTail = coverFirst.length ? googleUrls.slice(1) : googleUrls;
              const merged = [...coverFirst, ...googleTail].filter((u, i, arr) => arr.indexOf(u) === i);
              if (merged.length > 0) setPhotos(merged);
              ensurePhotoCached(
                {
                  table: "places",
                  id: cur.id,
                  place_name: cur.place_name,
                  city: city ?? cur.city,
                  latitude: cur.latitude,
                  longitude: cur.longitude,
                  place_id: data.result.place_id,
                },
                cur.photo_url ?? null,
              ).catch(() => {});
            }
          }
        })
        .catch(() => {});

      const postsPromise = cur.businessLogoUrl !== undefined
        ? (supabase as any)
            .from("business_posts")
            .select("id, description, photo_urls, created_at")
            .eq("place_id", cur.id)
            .order("created_at", { ascending: false })
            .limit(10)
            .then(({ data }: { data: BusinessPost[] | null }) => { if (data) setBusinessPosts(data); })
        : Promise.resolve();

      await Promise.allSettled([placesPromise, postsPromise]);
      setLoading(false);
    };

    fetchAll();
  }, [open, place, city, skipGoogleFetch, referenceDate]);

  const handleLike = () => { onLike?.(); onOpenChange(false); };
  const savedEffective = saved ?? (ep?.place_name ? isSaved(ep.place_name) : false);
  const handleSkip = () => { onSkip?.(); onOpenChange(false); };
  // Zapis z zakladki na hero - zapisuje BEZ zamykania wizytowki (stan zakladki sie aktualizuje).
  const handleSaveFromHero = onLike ? () => { onLike(); } : undefined;

  // ZERO Google w wizytowce (2026-07-30): pokazujemy zdjecia userow z tras (photos =
  // fetchPlaceUserPhotos), WLASNE zdjecia lokalu (biznes) ORAZ recznie skurowana okladke
  // (ep.photo_url / galleryPhotos). enrich juz odsial Google-backfill (gpid_) - do ep.photo_url
  // trafia WYLACZNIE nasz content (cover biznesu lub upload /manual/), wiec pokazujemy go
  // bezpiecznie. Brak zdjec -> hero = ikona kategorii na tle peachy (#fcede3).
  // Zwykle miejsce: skurowana okladka jest HERO (na przodzie). Biznes: bez zmian - zdjecia
  // userow (social proof) pierwsze, potem cover/galeria lokalu.
  const isBusiness = ep?.businessLogoUrl !== undefined;
  const ownCover = validUrl(ep?.photo_url) ? [ep!.photo_url!] : [];
  const ownGallery = (ep?.galleryPhotos ?? []).filter(validUrl);
  const userPhotos = photos.filter(validUrl);
  const contributed = userPlacePhotos.filter(validUrl); // #3e - zdjecia userow dodane do miejsca
  // Cap podniesiony 4 -> 10, zeby zdjecia dodane przez userow (#3e) sie zmiescily.
  const displayPhotos = Array.from(new Set(
    isBusiness
      ? [...userPhotos, ...contributed, ...ownCover, ...ownGallery]
      : [...ownCover, ...userPhotos, ...contributed, ...ownGallery],
  )).slice(0, 10);

  // Notki userow o tym miejscu - z OPUBLIKOWANYCH tras i PUBLICZNYCH list (best-effort).
  useEffect(() => {
    if (!open || !ep?.place_name) { return; }
    let alive = true;
    fetchPlaceNotes(ep.place_name).then((rows) => { if (alive) setUserNotes(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [open, ep?.place_name]);

  // #3e: pobierz zdjecia userow przypisane do tego miejsca (galeria wspoldzielona).
  useEffect(() => {
    if (!open || !placeKey) { return; }
    let alive = true;
    // Zdjecia miejsca moga siedziec pod DWOMA kluczami: "gpid:<google_place_id>" (dodane z
    // wizytowki miejsca z bazy) albo "nm:<nazwa>" (dodane przy miejscu w wyjezdzie - piny nie
    // maja google_place_id). Czytamy OBA, inaczej polowa zdjec nie dociagala sie do galerii
    // (zgloszenie Nat 2026-08-30 - "Talerzyki").
    const keys = pinCoverKeys({ google_place_id: (ep as any)?.google_place_id ?? null, place_name: ep?.place_name });
    fetchPlacePhotosForKeys(keys).then((map) => {
      if (!alive) return;
      const urls = keys.flatMap((k) => map.get(k) ?? []);
      setUserPlacePhotos(Array.from(new Set(urls)));
    });
    return () => { alive = false; };
  }, [open, placeKey]);

  // #6: pobierz stan lajkow dla zdjec aktualnie w galerii.
  const photoRefsKey = displayPhotos.join("|");
  useEffect(() => {
    if (!open || displayPhotos.length === 0) { return; }
    let alive = true;
    fetchPhotoLikes(displayPhotos, user?.id ?? null).then((m) => { if (alive) setPhotoLikes(m); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photoRefsKey, user?.id]);

  // #6: przelacz lajk zdjecia (optymistycznie + persist). Wymaga logowania.
  const handleToggleLike = (ref: string) => {
    if (!user) { toast("Zaloguj się, aby polubić zdjęcie"); return; }
    const cur = photoLikes.get(ref) ?? { count: 0, liked: false };
    const nextLiked = !cur.liked;
    setPhotoLikes((prev) => {
      const next = new Map(prev);
      next.set(ref, { liked: nextLiked, count: Math.max(0, cur.count + (nextLiked ? 1 : -1)) });
      return next;
    });
    void togglePhotoLike(ref, user.id, cur.liked).then((confirmed) => {
      // Gdy DB nie potwierdzi zmiany (np. blad), cofnij optymizm.
      if (confirmed !== nextLiked) {
        setPhotoLikes((prev) => { const n = new Map(prev); n.set(ref, cur); return n; });
      }
    });
  };

  // #3e: dodaj wlasne zdjecie do miejsca - wybor pliku -> upload -> odswiez galerie.
  const handleAddPhoto = () => {
    if (!user) { toast("Zaloguj się, aby dodać zdjęcie"); return; }
    fileInputRef.current?.click();
  };
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset, zeby ten sam plik dalo sie wybrac ponownie
    if (!file || !user || !ep || !placeKey) return;
    if (!file.type.startsWith("image/")) { toast.error("Wybierz plik graficzny"); return; }
    setAddingPhoto(true);
    const row = await uploadPlacePhoto(file, { userId: user.id, placeKey, placeName: ep.place_name, city: ep.city ?? city ?? null });
    setAddingPhoto(false);
    if (row) { setUserPlacePhotos((prev) => [row.photo_url, ...prev]); onPhotoAdded?.(row.photo_url, placeKey); toast.success("Dodano Twoje zdjęcie"); }
    else toast.error("Nie udało się dodać zdjęcia");
  };

  // Maps button - renderowany w header slot PremiumBusinessCard (Maps button obok nazwy)
  const mapsUrl = ep
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ep.place_name} ${ep.address ?? ""}`)}`
    : "#";
  // Chip dystansu "X od {label}" - od wspolnego punktu odniesienia (GPS / punkt startowy).
  // Premium biznesy czesto maja NULL places.latitude/longitude - fallback na geometrie z
  // Google detail (proxy zwraca geometry), zeby chip dzialal tez dla wizytowek biznesowych.
  const placeLat = ep?.latitude ?? detail?.geometry?.location?.lat ?? null;
  const placeLng = ep?.longitude ?? detail?.geometry?.location?.lng ?? null;
  const distanceLabel = distanceRef && placeLat != null && placeLng != null
    ? formatDistance(haversineKm(distanceRef.coords, { lat: placeLat, lng: placeLng }))
    : null;

  // Tylko chip dystansu na gorze hero (wg Figmy). "Maps" przeniesiony do sekcji "Na mapie".
  void mapsUrl;
  const headerSlot = distanceLabel ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-semibold">
      <Navigation className="h-3.5 w-3.5" />
      {distanceLabel} {t("distance_from")}&nbsp;{distanceRef!.label}
    </span>
  ) : undefined;

  if (!place || !ep) return null;

  const businessData = fromMockPlace(ep, detail, businessPosts);

  return (
    <VaulDrawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <VaulDrawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-[#FEFEFE] overflow-hidden outline-none focus:outline-none"
          style={{ height: "min(96dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem))" }}
        >
          <VaulDrawer.Title className="sr-only">{place.place_name}</VaulDrawer.Title>
          {/* Uchwyt drag-to-dismiss renderuje HeroPhotoCarousel (jeden, nie dublujemy). */}
          {/* Scroll wrapper - vaul inicjuje drag-to-dismiss tylko gdy scroll jest na gorze,
              wiec native scroll do recenzji/galerii dziala normalnie (bez buga z iOS WebView).
              Wyjscie: drag w dol, tap w tlo (overlay), Esc, albo Hero X. */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
          {/* Hidden input do uploadu wlasnego zdjecia miejsca (#3e). */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <PremiumBusinessCard
            data={businessData}
            mode="detail"
            referenceDate={referenceDate}
            detailPhotos={displayPhotos}
            detailLoading={loading}
            onClose={() => onOpenChange(false)}
            header={headerSlot}
            onSave={handleSaveFromHero}
            saved={savedEffective}
            hideReviews
            photoLikes={photoLikes}
            onToggleLike={handleToggleLike}
            onAddPhoto={undefined /* #3 (Nat): usunięte "Dodaj swoje zdjęcie" z wizytówki */}
            userNotes={userNotes}
            addingPhoto={addingPhoto}
            startingLocation={distanceRef ? { name: distanceRef.label, latitude: distanceRef.coords.lat, longitude: distanceRef.coords.lng } : undefined}
          />
          {/* Zgłoś problem - tylko dla realnych miejsc z bazy (uuid), na dole tresci wizytowki. */}
          {isRealPlaceId(ep.id) && (
            <div className="px-4 pb-6 pt-1">
              <ReportPlaceLink placeId={ep.id} placeName={ep.place_name} />
            </div>
          )}
        </div>

        {/* Zapisz / Odrzuc CTA - fixed bottom. Guzik 44px (h-11), pt 12px, pb 16px do krawedzi. */}
        {(onLike || onSkip) && (
          <div className="shrink-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom,0px))] border-t border-black/5 bg-[#FEFEFE]">
            <div className="flex gap-3">
              {onSkip && (
                <button
                  onClick={handleSkip}
                  className="flex-1 h-11 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center shadow-sm active:scale-[0.97] transition-transform"
                >
                  {t("reject")}
                </button>
              )}
              {onLike && (
                <button
                  onClick={handleLike}
                  className="flex-1 h-11 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-[0.97] transition-transform"
                >
                  {t("save_place", "Zapisz to miejsce")}
                  <Bookmark className="h-4 w-4" strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
        )}
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
};

export default PlaceSwiperDetail;
