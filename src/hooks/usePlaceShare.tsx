import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShare } from "@/hooks/useShare";
import { haptics } from "@/hooks/useHaptics";
import { resolveStored } from "@/components/PlacePhoto";
import { buildShareUrl } from "@/lib/shareUrl";
import { fetchPlaceUserPhotos } from "@/lib/placeUserPhotos";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";

// Udostepnianie MIEJSCA - jedna logika dla arkusza zapisu (SavePlaceSheet) i wizytowki
// (PlaceSwiperDetail, zolte kolko obok "Zapisz to miejsce" - prosba Nat 2026-09-13).
//
// KAZDE miejsce dostaje wlasny arkusz z karta i link spontaway.com/p/<id> (strona z podgladem
// w komunikatorach). Wizytowka z bazy -> id z `places` i pelne dane (logo, promocja, tagi).
// Miejsce spoza bazy (z listy, wyjazdu, wyniku Google) -> MIGAWKA w `shared_places` (jedna na
// usera i miejsce, wiec ponowne udostepnienie oddaje ten sam link).
//
// ZDJECIA: karta w arkuszu renderuje sie ze `skipGoogleFetch`, wiec sama nic nie dociaga -
// zbieramy je z KAZDEGO zrodla wizytowki (wiersz, wizytowka z bazy, zdjecia userow z wyjazdow
// i galerii miejsca). Pierwsze = okladka; tapniecie w karte PRZELACZA na kolejne (bez osobnego
// arkusza wyboru - prosba Nat 2026-09-13). Wybor jedzie do migawki (shared_places.photo_url),
// zeby strona linku pokazala to samo zdjecie; wizytowka z bazy dostaje wtedy migawke z place_id.

// Arkusz ladowany leniwie: ShareCard importuje SwipeCard z PlaceSwiper, a PlaceSwiper importuje
// SavePlaceSheet (ktory uzywa tego hooka) - statyczny import zamknalby cykl modulow.
const ShareCardPlace = lazy(() => import("@/components/share/ShareCard").then((m) => ({ default: m.ShareCardPlace })));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SharePlaceInput = {
  place_name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  /** UUID z `places` albo id Google (piny trzymaja tam id z Google). */
  place_id?: string | null;
  google_place_id?: string | null;
  image_url?: string | null;
  images?: unknown;
  user_photo_urls?: unknown;
};

type ShareState = { place: MockPlace; url: string; photos: string[]; snapId: string | null; dbId: string | null; gpid: string | null };

const usable = (u: unknown): u is string => typeof u === "string" && /^(https?:|\/api\/)/.test(u) && !u.includes("picsum");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function usePlaceShare(contextCity?: string | null) {
  const { t } = useTranslation("plan");
  const { user } = useAuth();
  const share = useShare();
  const [state, setState] = useState<ShareState | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<SharePlaceInput | null>(null);

  const systemShare = async (place: SharePlaceInput, url: string) => {
    const res = await share({ title: place.place_name, text: place.place_name, url });
    if (res.ok) toast.success(res.method === "clipboard" ? t("save_sheet.link_copied") : t("save_sheet.shared"));
  };

  // Migawka miejsca (shared_places): jedna na usera i miejsce, wiec upsert oddaje ten sam wiersz.
  const upsertSnapshot = async (place: SharePlaceInput, dbId: string | null, gpid: string | null, photoUrl: string | null): Promise<string> => {
    if (!user) throw new Error("no user");
    const { data, error } = await (supabase as any)
      .from("shared_places")
      .upsert({
        shared_by: user.id, place_id: dbId, google_place_id: gpid,
        place_name: place.place_name, address: place.address ?? null, city: place.city ?? contextCity ?? null,
        category: place.category ?? null, latitude: place.latitude ?? null, longitude: place.longitude ?? null,
        photo_url: photoUrl,
      }, { onConflict: "shared_by,place_key" })
      .select("id").single();
    if (error || !data?.id) throw error ?? new Error("no id");
    return data.id as string;
  };

  /** Otwiera arkusz udostepniania dla miejsca. */
  const start = async (place: SharePlaceInput) => {
    if (!user) return;
    setSource(place);
    setLoading(true);
    try {
      const dbId = place.place_id && UUID_RE.test(place.place_id) ? place.place_id : null;
      // Identyfikator Google: jawny (listy niosa google_place_id) albo place_id pinu, ktory nie
      // jest UUID-em naszej bazy (piny trzymaja tam id z Google).
      const gpid: string | null = place.google_place_id ?? (place.place_id && !dbId ? place.place_id : null);
      let enriched: MockPlace | null = null;
      if (dbId) {
        // Import dynamiczny z tego samego powodu, co lazy() wyzej (cykl PlaceSwiper -> SavePlaceSheet).
        const { fetchEnrichedPlace } = await import("@/components/plan-wizard/PlaceSwiper");
        enriched = await fetchEnrichedPlace(dbId);
      }
      const community = await fetchPlaceUserPhotos({ placeDbId: dbId, googlePlaceId: gpid, placeName: place.place_name, city: place.city ?? contextCity ?? null }).catch(() => [] as string[]);
      const photos = Array.from(new Set([
        resolveStored(place.image_url) ?? null,
        ...list(place.images).map((u) => resolveStored(u)),
        ...list(place.user_photo_urls).map((u) => resolveStored(u)),
        resolveStored(place.photo_url),
        enriched?.photo_url ?? null,
        ...(enriched?.galleryPhotos ?? []),
        ...community.map((u) => resolveStored(u)),
      ].filter(usable)));
      const cover = photos[0] ?? "";

      if (enriched) {
        setState({ place: { ...enriched, photo_url: cover, galleryPhotos: photos }, url: buildShareUrl(`/miejsce/${dbId}`), photos, snapId: null, dbId, gpid });
        return;
      }
      const snapId = await upsertSnapshot(place, dbId, gpid, cover || null);
      // Karta w arkuszu = ta sama, co w Miejscach; dane prosto z tego, co user widzi.
      const preview: MockPlace = {
        id: snapId, place_name: place.place_name, category: (place.category ?? "other") as MockPlace["category"],
        city: place.city ?? contextCity ?? "", address: place.address ?? "", latitude: place.latitude ?? 0, longitude: place.longitude ?? 0,
        rating: 0, photo_url: cover, vibe_tags: [], description: "",
        google_place_id: gpid, galleryPhotos: photos,
      };
      setState({ place: preview, url: buildShareUrl(`/miejsce/${snapId}`), photos, snapId, dbId, gpid });
    } catch (e) {
      console.warn("[usePlaceShare] place share failed:", e instanceof Error ? e.message : e);
      // Ostatnia deska: systemowy arkusz z linkiem do Google Maps - lepsze niz nic.
      const url = place.latitude && place.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.place_name, place.address, place.city ?? contextCity].filter(Boolean).join(" "))}`;
      await systemShare(place, url);
    } finally { setLoading(false); }
  };

  // Tapniecie w karte = NASTEPNE zdjecie z puli (w kolko). Wybor jedzie do migawki, zeby strona
  // linku pokazala to samo; wizytowka z bazy dostaje wtedy migawke wskazujaca na siebie
  // (place_id) i link zmienia sie na /p/<migawka>.
  const nextPhoto = async () => {
    if (!state || !source || state.photos.length < 2) return;
    // Delikatne "puknięcie" przy zmianie okladki (prosba Nat 2026-09-13).
    haptics.light();
    const i = state.photos.indexOf(state.place.photo_url);
    const url = state.photos[(i + 1) % state.photos.length];
    setState({ ...state, place: { ...state.place, photo_url: url } });
    try {
      if (state.snapId) {
        await (supabase as any).from("shared_places").update({ photo_url: url }).eq("id", state.snapId);
      } else {
        const snapId = await upsertSnapshot(source, state.dbId, state.gpid, url);
        setState((cur) => cur ? { ...cur, place: { ...cur.place, photo_url: url }, snapId, url: buildShareUrl(`/miejsce/${snapId}`) } : cur);
      }
    } catch (e) {
      console.warn("[usePlaceShare] photo pick failed:", e instanceof Error ? e.message : e);
    }
  };

  const close = () => { setState(null); setSource(null); };

  /** Arkusz udostepniania - renderuj tam, gdzie zyje hook (nad innymi warstwami, z-95). */
  const sheet = state ? (
    <Suspense fallback={null}>
      <ShareCardPlace
        place={state.place}
        city={state.place.city || contextCity || ""}
        shareUrl={state.url}
        photos={state.photos}
        onNextPhoto={() => void nextPhoto()}
        onShare={() => { if (source) void systemShare(source, state.url); }}
        onClose={close}
      />
    </Suspense>
  ) : null;

  return { start, loading, sheet, open: !!state, canShare: !!user };
}
