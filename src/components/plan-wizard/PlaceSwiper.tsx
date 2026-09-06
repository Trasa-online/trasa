import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ArrowRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, Navigation, X, CalendarDays, Plus, Check, Bookmark } from "lucide-react";
import AddCustomPlacePanel from "./AddCustomPlacePanel";
import { haversineKm as haversineKmDist, formatDistance } from "@/lib/distance";
import { pinCoverKeys, fetchPlaceKeysWithPhotos } from "@/lib/placePhotoSocial";
import { useDistanceReference, getReference, ensureCityContext, tryResolveOnSite, setGpsReference } from "@/lib/distanceReference";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { format } from "date-fns";
import PlaceSwiperDetail from "./PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "./SavePlaceSheet";
import { useUnsavePlace } from "@/hooks/useUnsavePlace";
import { supabase } from "@/integrations/supabase/client";
import { fetchPlaceUserPhotos, pickRandom } from "@/lib/placeUserPhotos";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useOnboarding } from "@/components/OnboardingGuide";
import { useHaptics } from "@/hooks/useHaptics";
import { useDragToDismiss } from "@/hooks/useDragToDismiss";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { getSubcategoryIds, getMainCategoryFor, getDbCategoriesFor, MAIN_CATEGORIES, mainCategoryLabel } from "@/lib/categories";
import { addLike as saveExploreLike, clearGroup as clearExploreGroup, removeLikeFromCity } from "@/lib/exploreLikes";
import { expandCity } from "@/lib/cities";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockPlace {
  id: string;
  place_name: string;
  category: PlaceCategory;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  price_level?: 1 | 2 | 3 | 4;
  photo_url: string;
  vibe_tags: string[];
  description: string;
  // Godziny otwarcia z bazy (places.opening_hours, backfill z Google). weekday_text = 7 linii PL.
  // Uzywane w wizytowce (bez live-fetchu) i przekazywane do planera (heurystyka H5).
  opening_hours?: { weekday_text?: string[] | null; periods?: unknown[] | null } | null;
  // Business profile fields (optional)
  businessPlan?: 'zero' | 'basic' | 'premium';
  /** business_profiles.is_premium - flaga funkcji premium, WYLICZANA AUTOMATYCZNIE przez
   *  trigger w bazie (migracja 20260831d): zywe konto biznesowe = owner_user_id + is_active
   *  + nie szkic. Zaden przelacznik do klikania. Gdy wejdzie billing, zmienia sie TYLKO
   *  warunek w triggerze ("ma aktywna subskrypcje") - front zostaje bez zmian. */
  businessIsPremium?: boolean;
  businessLogoUrl?: string;
  businessEventTitle?: string;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  businessInstagram?: string | null;
  businessFacebook?: string | null;
  galleryPhotos?: string[]; // extra photos shown in carousel (swipe card + detail)
  businessSubcategories?: string[]; // subcategories from business_profiles (for custom filtering)
  businessTags?: string[]; // custom tags z business_profiles.tags - prio nad vibe_tags w UI
  businessMainCategory?: string; // main_category id (np. "food") z MAIN_CATEGORIES - dla badge na karcie
  businessSecondaryCategory?: string; // opcjonalna druga top-level kategoria (secondary_category)
  businessEvents?: any[]; // zaplanowane wydarzenia (business_events) - agenda na wizytowce
  businessMenuImageUrls?: string[]; // zdjecia menu (food) lub cennika (culture/attractions) - max 6 sztuk
  // Godziny otwarcia ustawione przez wlasciciela lokalu (priorytet nad Google weekday_text)
  // Shape: { mon: { open: "09:00", close: "22:00" } | { closed: true }, ... }
  businessOpeningHours?: Record<string, { open: string; close: string } | { closed: true }>;
  coverVideoUrl?: string; // business cover video (premium)
  businessHasOwnPhoto?: boolean; // true when business uploaded cover image/video or gallery - skip Google photos
  businessHasOwnAddress?: boolean; // true when business set own street/address - use it (NIE adres z Google, ktory moze trafic w zly lokal)
  businessEventDescription?: string;
  businessDescription?: string;
  businessIsVerified?: boolean;
  // Customizacja kolorow z dashboardu lokalu (1:1 z BusinessCardPreview)
  businessColorBadge?: string;     // kolor badge kategorii
  businessColorCardBg?: string;    // kolor gradient overlay
  businessColorButton?: string;    // kolor primary CTA "Dodaj"
  businessColorPromo?: string;     // kolor badge promocji/aktualnosci (puste = gradient pomaranczowy)
}

export type PlaceCategory =
  | "restaurant" | "cafe" | "bar" | "club"
  | "museum" | "monument" | "gallery"
  | "experience" | "market" | "shopping"
  | "park" | "viewpoint";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: "Restauracja",
  cafe:       "Kawiarnia",
  bar:        "Bar",
  club:       "Klub",
  museum:     "Muzeum",
  monument:   "Zabytek",
  gallery:    "Galeria",
  experience: "Doświadczenie",   // i18n-ignore: etykieta kategorii z bazy (categories ns tlumaczy osobno)
  market:     "Targ",
  shopping:   "Sklep",
  park:       "Park",
  viewpoint:  "Widok",
};

// Helper - kontrast czarny/bialy dla custom hex koloru. Skopiowany z BusinessDashboard.tsx
// (ZAMROZONY plik, nie ma shared lib do importu).
export function getHexContrast(hex: string): string {
  if (!hex || hex.length < 7) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}

const MAIN_CATEGORY_COLORS: Record<string, string> = {
  food:        "bg-orange-500/80 text-white",
  culture:     "bg-violet-600/80 text-white",
  attractions: "bg-teal-600/80 text-white",
  nature:      "bg-emerald-600/80 text-white",
};

const getCategoryColor = (cat: PlaceCategory): string => {
  const main = getMainCategoryFor(cat);
  return main ? (MAIN_CATEGORY_COLORS[main.id] ?? "bg-slate-500/80 text-white") : "bg-slate-500/80 text-white";
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_DOTS = (level?: number) =>
  level ? "·".repeat(level) + "·".repeat(4 - level).replace(/·/g, "○") : null;

const BINGO_MIN_CATEGORIES = 4;       // show bingo when liked from ≥4 different categories
const BINGO_REPEAT_CATEGORIES = 6;    // re-show banner after dismissal (≥6 categories)

// ─── Bingo banner ─────────────────────────────────────────────────────────────

const MatchModal = ({ likedPlaces, onConfirm, onDismiss }: {
  likedPlaces: MockPlace[];
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const { t } = useTranslation("plan");
  const orbs = likedPlaces.slice(0, 3);
  const extra = likedPlaces.length - 3;
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const { dragProps } = useDragToDismiss({ onDismiss });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div {...dragProps} className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-safe-6 pb-6 flex flex-col items-center gap-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-center gap-3">
          {orbs.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-400/20 to-amber-400/20 border border-orange-300/30 flex items-center justify-center shadow-sm">
                <CategoryIcon category={p.category} className="w-2/5 max-w-[56px] opacity-90" />
              </div>
            </div>
          ))}
          {extra > 0 && (
            <div className="h-14 w-14 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground">+{extra}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 w-full">
          {orbs.map((p) => (
            <p key={p.id} className="text-sm font-medium text-foreground">{p.place_name}</p>
          ))}
          {extra > 0 && <p className="text-xs text-muted-foreground mt-0.5">{t("match_modal.more", { count: extra })}</p>}
        </div>
        <div className="text-center space-y-1">
          <p className="text-2xl font-black text-foreground">{t("match_modal.title")}</p>
          <p className="text-sm text-muted-foreground">{t("match_modal.subtitle")}</p>
        </div>
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
          >
            {t("match_modal.confirm")}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
          >
            {t("back_to_browsing")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Guest upsell modal ───────────────────────────────────────────────────────

const UPSELL_BENEFITS = [
  { emoji: "🗺️", key: "upsell.benefit_save" },
  { emoji: "👫", key: "upsell.benefit_group" },
  { emoji: "📍", key: "upsell.benefit_custom" },
  { emoji: "📒", key: "upsell.benefit_journal" },
];

const GuestUpsellModal = ({ onSignUp, onDismiss }: { onSignUp: () => void; onDismiss: () => void }) => {
  const { t } = useTranslation("plan");
  // Gest natywny: przeciagniecie panelu w dol zamyka arkusz.
  const { dragProps } = useDragToDismiss({ onDismiss });
  return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div {...dragProps} className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-2xl font-black text-foreground">{t("upsell.title")}</p>
        <p className="text-sm text-muted-foreground">{t("upsell.subtitle")}</p>
      </div>
      <div className="flex flex-col gap-3">
        {UPSELL_BENEFITS.map(b => (
          <div key={b.key} className="flex items-center gap-3">
            <span className="text-xl shrink-0">{b.emoji}</span>
            <p className="text-sm font-medium text-foreground">{t(b.key)}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onSignUp}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
        >
          {t("upsell.cta")}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
        >
          {t("back_to_browsing")}
        </button>
      </div>
    </div>
  </div>
  );
};

// ─── SwipeCard ────────────────────────────────────────────────────────────────

interface SwipeCardProps {
  place: MockPlace;
  city: string;
  onLike: (photoUrl?: string) => void;
  onSkip: () => void;
  onTap: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onPhotoFetched?: (placeId: string, photoUrl: string) => void;
  isTop: boolean;
  offset: number; // 0 = top, 1 = second, 2 = third
  skipGoogleFetch?: boolean;
  onEnableDistance?: () => void; // otwiera wybor punktu odniesienia (Jestes juz w miescie?)
  // Tryb scrollowania (Eksploracja, wg Figmy): karta statyczna (bez gestu drag), pelnoekranowa,
  // akcje (cofnij/zapisz/rozwin) jako pionowa kolumna po prawej (kciuk). scroll = nastepna karta.
  scrollMode?: boolean;
  saved?: boolean; // scrollMode: czy miejsce juz zapisane (+ pokazuje stan zapisane)
}


export const SwipeCard = ({ place, city, onLike, onSkip, onTap, onUndo, canUndo, onPhotoFetched, isTop, offset, skipGoogleFetch = false, onEnableDistance, scrollMode = false, saved = false }: SwipeCardProps) => {
  const { t } = useTranslation("plan");
  const [imgFailed, setImgFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  // Widok glowny (karta swipe) = TYLKO jedno zdjecie (cover). Galeria (extra zdjecia)
  // pokazuje sie dopiero w wizytowce (PlaceSwiperDetail). Bez karuzeli na karcie.
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    [place.photo_url || (place.galleryPhotos ?? [])[0]]
      .filter((u): u is string => !!u && (u.startsWith("http") || u.startsWith("/api/")) && !u.includes("picsum") && !u.includes("lorem"))
  );
  const [photoIdx, setPhotoIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const GRADIENT_BG = ["from-slate-700 to-slate-900", "from-stone-700 to-stone-900", "from-zinc-700 to-zinc-900"];

  // Prefetch Google Places data only for the TOP card and only once per card.
  // Biznes z wlasnymi zdjeciami (businessHasOwnPhoto) -> NIE wolamy Google: inaczej proxy
  // dopasowuje miejsce po nazwie (np. "testowy lokal" trafia w losowy lokal) i NADPISUJE
  // okladke biznesu przypadkowym zdjeciem. Wizytowka juz to respektuje - karta musi tez.
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    // Zdjecie miejsca ZERO Google (2026-07-29): okladki nie pochodza juz z Google Photos.
    // Biznes z wlasnym zdjeciem ma je juz w photoUrls (enrich). Dla zwyklego miejsca
    // dociagamy LOSOWE zdjecie usera przypisane do tego miejsca w trasach
    // (pins.user_photo_urls). Brak zdjecia -> zostaje pusto i renderuje sie ikona
    // kategorii (empty-state). Tylko dla top karty, raz.
    if (offset !== 0 || skipGoogleFetch || place.businessHasOwnPhoto || hasFetchedRef.current) return;
    if (photoUrls.length > 0) return; // okladka juz dostarczona przez enrich (biznes)
    hasFetchedRef.current = true;

    fetchPlaceUserPhotos({
      placeDbId: place.id,
      googlePlaceId: (place as any).google_place_id ?? null,
      placeName: place.place_name,
      city,
    })
      .then((urls) => {
        const url = pickRandom(urls);
        if (url) { setPhotoUrls([url]); setImgFailed(false); onPhotoFetched?.(place.id, url); }
      })
      .catch(() => {});
  }, [offset]);

  // Adres z bazy (ocena-gwiazdki usunieta z aplikacji; Google fallbacky odciete - zero Google).
  const displayAddress = place.address;
  // Chip dystansu "X od {label}" - od wspolnego punktu odniesienia (GPS "od Ciebie" gdy
  // jestes na miejscu, albo punkt startowy "od startu" gdy planujesz). Gdy brak ref a
  // miejsce MA wspolrzedne - maly przycisk "Pokaz dystans" otwiera wybor (Jestes juz w meiscie?).
  const distanceRef = useDistanceReference();
  // Odporne na koordy jako string / 0 / NaN - inaczej chip dystansu znikal "czasami"
  // (np. gdy latitude przyszlo jako "52.2" albo 0,0 -> falsy/NaN i chip sie nie renderowal).
  const placeLat = Number(place.latitude);
  const placeLng = Number(place.longitude);
  const placeHasCoords = Number.isFinite(placeLat) && Number.isFinite(placeLng) && (placeLat !== 0 || placeLng !== 0);
  const distanceLabel = distanceRef && placeHasCoords
    ? formatDistance(haversineKmDist(distanceRef.coords, { lat: placeLat, lng: placeLng }))
    : null;
  const showEnableDistance = !distanceRef && placeHasCoords;
  // Priorytet: tagi z business_profiles.tags (ustawione przez wlasciciela) > vibe_tags z bazy.
  const displayTags = place.businessTags?.length
    ? place.businessTags
    : (place.vibe_tags ?? []);

  // Czy karta ma realne zdjecie/wideo. Gdy nie - empty-state = ikona kategorii na #fcede3.
  const hasMedia = (!!place.coverVideoUrl && !videoFailed) || (photoUrls.length > 0 && !imgFailed);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isTop) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setDragging(true);
    cardRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isTop || !pointerStart.current || !dragging) return;
    const dx = e.clientX - pointerStart.current.x;
    setDragX(dx);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isTop || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const dt = Date.now() - pointerStart.current.t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setDragging(false);
    setDragX(0);
    pointerStart.current = null;

    if (dist < 12 && dt < 350) {
      // Tap w karte = otworz wizytowke (nie zmiana zdjecia). Nawigacja zdjec jest
      // przez wyrazne strzalki (ponizej) - czytelniejsza afordancja niz tap lewo/prawo.
      onTap();
      return;
    }
    if (dragX > 80) {
      onLike(photoUrls[photoIdx] || undefined);
    } else if (dragX < -80) {
      onSkip();
    }
  };

  const rotation = isTop ? dragX * 0.08 : 0;

  const stackScale = 1 - offset * 0.04;
  const stackY = offset * 10;

  return (
    <div
      ref={cardRef}
      onPointerDown={scrollMode ? undefined : handlePointerDown}
      onPointerMove={scrollMode ? undefined : handlePointerMove}
      onPointerUp={scrollMode ? undefined : handlePointerUp}
      onPointerCancel={scrollMode ? undefined : handlePointerUp}
      // scrollMode (Eksploracja pionowa): tap w CALA karte otwiera wizytowke. onClick fire'uje
      // tylko na tap (nie na scroll), a wszystkie interaktywne dzieci (strzalki zdjec, zapisz,
      // rozwin) robia stopPropagation. Bez tego wizytowke otwieral tylko maly guzik ^.
      onClick={scrollMode ? () => onTap() : undefined}
      style={scrollMode ? { zIndex: 1 } : {
        transform: isTop
          ? `translateX(${dragX}px) rotate(${rotation}deg)`
          : `scale(${stackScale}) translateY(${stackY}px)`,
        transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 10 - offset,
        touchAction: "none",
      }}
      className={cn(
        "absolute inset-0 rounded-3xl overflow-hidden shadow-md select-none",
        scrollMode ? "cursor-pointer" : (isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none")
      )}
    >
      {/* Photo / Video / Ikona kategorii (empty-state) */}
      {/* Gdy jest zdjecie/wideo: ciemna baza (widoczna przy ladowaniu) + zdjecie na wierzchu.
          Gdy brak (zero Google, brak zdjecia usera): tlo #fcede3 + wysrodkowana ikona kategorii. */}
      <div className={cn("absolute inset-0", hasMedia ? cn("bg-gradient-to-br", GRADIENT_BG[offset % 3]) : "bg-[#fcede3]")}>
        {place.coverVideoUrl && !videoFailed ? (
          <video
            src={place.coverVideoUrl}
            className="w-full h-full object-cover"
            autoPlay={isTop}
            loop
            muted
            playsInline
            onError={() => setVideoFailed(true)}
            style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
          />
        ) : photoUrls.length > 0 && !imgFailed ? (
          <img
            src={photoUrls[photoIdx]}
            alt={place.place_name}
            className="w-full h-full object-cover"
            onError={() => {
              if (photoIdx < photoUrls.length - 1) setPhotoIdx(n => n + 1);
              else setImgFailed(true);
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={categoryIconSrc(place.category)}
              alt=""
              className="w-1/5 max-w-[80px] opacity-90"
              draggable={false}
            />
          </div>
        )}
        {/* Overlay: pelny ciemny gdy jest zdjecie (legibilnosc bialego tekstu). Przy ikonie tylko
            delikatny dolny gradient - nazwa/meta czytelne na peach, gora zostaje jasna. */}
        <div className={cn("absolute inset-0", hasMedia
          ? "bg-gradient-to-t from-black/90 via-black/40 to-black/10"
          : "bg-gradient-to-t from-black/55 via-transparent to-transparent")} />
        {/* Photo progress bar - przeniesione pod badge kategorii (top-4 zajete przez badge).
            Instagram-style cienki bar pelnej szerokosci na top-14 (pod badge ktore ma top-4 + ~32px). */}
        {isTop && !place.coverVideoUrl && photoUrls.length > 1 && (
          <div className="absolute top-14 left-4 right-4 flex gap-1 z-10">
            {photoUrls.map((_, i) => (
              <div key={i} className={cn("flex-1 h-1 rounded-full transition-all", i === photoIdx ? "bg-white" : "bg-white/35")} />
            ))}
          </div>
        )}

        {/* Wyrazne strzalki nawigacji zdjec (afordancja zamiast tap lewo/prawo).
            stopPropagation, zeby tap w karte = wizytowka, a strzalka = zmiana zdjecia. */}
        {isTop && !place.coverVideoUrl && photoUrls.length > 1 && (
          <>
            {/* Strzalki = duza tap-zona (pelna wysokosc, ~64px szer. przy krawedzi). Tylko
                gorna 60% wysokosci, zeby dolne CTA/swipe nie kolidowaly. disabled = brak
                pointer-events (nie blokuje swipe gdy 1. / ostatnie zdjecie). */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPhotoIdx(n => Math.max(0, n - 1)); }}
              disabled={photoIdx === 0}
              aria-label={t("photo_prev")}
              className="absolute left-0 top-0 h-[60%] w-16 z-20 flex items-center justify-start pl-2.5 active:scale-95 transition-transform disabled:opacity-0 disabled:pointer-events-none"
            >
              <span className="h-9 w-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                <ChevronLeft className="h-5 w-5 text-white" />
              </span>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPhotoIdx(n => Math.min(photoUrls.length - 1, n + 1)); }}
              disabled={photoIdx === photoUrls.length - 1}
              aria-label={t("photo_next")}
              className="absolute right-0 top-0 h-[60%] w-16 z-20 flex items-center justify-end pr-2.5 active:scale-95 transition-transform disabled:opacity-0 disabled:pointer-events-none"
            >
              <span className="h-9 w-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                <ChevronRight className="h-5 w-5 text-white" />
              </span>
            </button>
          </>
        )}
      </div>



      {/* Badge kategorii - lewy gorny rog, na wysokosci chipa dystansu (redesign 2026-08-05:
          przeniesiony z dolu karty z powrotem na gore, w parze z chipem "X km od Ciebie"). */}
      {(() => {
        const bizMainLabel = place.businessMainCategory ? mainCategoryLabel(place.businessMainCategory) : null;
        const subLabel = t(`categories.${place.category}`, { defaultValue: CATEGORY_LABELS[place.category] });
        const label = bizMainLabel ?? subLabel;
        if (!label) return null;
        return (
          <div className="absolute top-4 left-4 z-10">
            <span className={cn("inline-flex px-3 py-1 rounded-full text-xs font-bold shadow-sm", getCategoryColor(place.category))}>
              {label}
            </span>
          </div>
        );
      })()}

      {/* Chip dystansu - prawy gorny rog, nad paginacja */}
      {isTop && distanceLabel && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/45 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
          <Navigation className="h-3 w-3 text-white/90" />
          <span className="text-white text-[11px] font-semibold">{distanceLabel}</span>
        </div>
      )}
      {isTop && !distanceLabel && showEnableDistance && onEnableDistance && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEnableDistance(); }}
          className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/45 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm active:scale-95 transition-transform"
        >
          <Navigation className="h-3 w-3 text-white/90" />
          <span className="text-white text-[11px] font-semibold">{t("show_distance")}</span>
        </button>
      )}

      {/* Content */}
      <div className={cn("absolute bottom-0 left-0 right-0 px-5 pt-5 space-y-2", scrollMode ? "pb-7 pr-[72px]" : "pb-[76px]")}>

        {/* Business logo - 1:1 z BusinessCardPreview (10x10, bez handle, jako osobny element nad nazwa) */}
        {place.businessLogoUrl !== undefined && place.businessLogoUrl && (
          <div className="h-10 w-10 rounded-full overflow-hidden border border-white/30 shadow-md bg-white/10">
            <img src={place.businessLogoUrl} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Name */}
        <h2 className="text-2xl font-black text-white leading-tight">{place.place_name}</h2>

        {/* Meta row */}
        <div className="flex items-center gap-3">
          {place.price_level && (
            <span className="text-white/60 text-sm">{PRICE_DOTS(place.price_level)}</span>
          )}
          {displayAddress && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-white/50" />
              <span className="text-white/60 text-xs truncate">{displayAddress.split(",")[0]}</span>
            </div>
          )}
        </div>

        {/* Opis USUNIETY z karty swipera (zabieral za duzo miejsca) - pelny opis jest w wizytowce. */}

        {/* Business event pill - 1:1 z BusinessCardPreview na dashboardzie */}
        {place.businessEventTitle && (
          <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-2.5 py-0.5 text-white font-semibold text-xs">
            {place.businessEventTitle}
          </div>
        )}

        {/* Vibe tags + info button row */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex gap-1.5 flex-wrap">
            {displayTags.map((tag) => (
              <span key={tag} className="text-[11px] font-medium text-white/80 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
          {isTop && !scrollMode && (
            <div className="flex items-center gap-2 shrink-0">
              {onUndo && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  disabled={!canUndo}
                  className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-md active:scale-90 transition-transform disabled:opacity-30"
                >
                  <RotateCcw className="h-4 w-4 text-black" />
                </button>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onTap(); }}
                aria-label={t("expand_card")}
                className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <ChevronUp className="h-5 w-5 text-black" />
              </button>
            </div>
          )}
        </div>

        {/* Badge kategorii przeniesiony na gore karty (lewy gorny rog) - patrz wyzej. */}
      </div>

      {/* Action buttons inside card - only on top card (klasyczny swipe: skip | add) */}
      {isTop && !scrollMode && (
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex gap-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            className="flex-1 py-3 rounded-full bg-white text-foreground font-bold text-sm shadow-xl active:scale-[0.97] transition-transform"
          >
            {t("reject")}
          </button>
          <button
            data-ob="swipe-save"
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            style={place.businessColorButton
              ? { background: place.businessColorButton, color: getHexContrast(place.businessColorButton) }
              : undefined
            }
            className={cn(
              "flex-1 py-3 rounded-full font-bold text-sm shadow-xl active:scale-[0.97] transition-transform",
              place.businessColorButton ? "" : "bg-primary text-white shadow-primary/30"
            )}
          >
            {t("add")}
          </button>
        </div>
      )}

      {/* Kolumna akcji po prawej (scrollMode, wg Figmy): zapisz (zakladka) / rozwin (^).
          W obszarze kciuka. scroll = nastepna karta (bez skip/add/cofnij - cofasz scrollem w gore). */}
      {scrollMode && (
        // Ujednolicone z karta Tras (TrasaBigCard): biale kolka, ikona foreground, fill przy zapisie.
        <div className="absolute right-3 bottom-4 z-20 flex flex-col gap-3">
          <button
            data-ob="swipe-save"
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            aria-label={t("add")}
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <Bookmark className={cn("h-5 w-5 text-foreground", saved && "fill-current")} strokeWidth={2} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTap(); }}
            aria-label={t("expand_card")}
            className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <ChevronUp className="h-5 w-5 text-foreground" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Done state ───────────────────────────────────────────────────────────────

const PERSONALITY_LABELS: Record<string, { key: string; emoji: string }> = {
  kulturalny:  { key: "personality.kulturalny",  emoji: "🎭" },
  historyczny: { key: "personality.historyczny", emoji: "🏰" },
  kawiarniany: { key: "personality.kawiarniany", emoji: "☕" },
  nocny:       { key: "personality.nocny",       emoji: "🌙" },
  aktywny:     { key: "personality.aktywny",     emoji: "🏃" },
  zakupowy:    { key: "personality.zakupowy",    emoji: "🛍️" },
  mix:         { key: "personality.mix",         emoji: "✨" },
};

interface RouteExamplePin {
  place_name: string;
  category: string;
  suggested_time: string;
  duration_minutes: number;
  walking_time_from_prev: string | null;
  note?: string | null;
}

interface RouteExample {
  id: string;
  title: string;
  personality_type: string;
  description: string | null;
  pins: RouteExamplePin[];
}

interface MatchedRoute extends RouteExample {
  score: number;
  matchedNames: string[];
}

const EmptyState = ({
  likedPlaces,
  matchedRoutes,
  onProceed,
  onPickRoute,
  loadingExamples,
  hasCategoryFilter,
  hasSwipedAny,
  onResetToday,
  resetting,
  onGoToMatches,
  reviewedTitle,
}: {
  likedPlaces: MockPlace[];
  matchedRoutes: MatchedRoute[];
  onProceed: () => void;
  onPickRoute: (route: RouteExample) => void;
  loadingExamples: boolean;
  hasCategoryFilter?: boolean;
  hasSwipedAny?: boolean;
  onResetToday: () => void;
  resetting: boolean;
  onGoToMatches?: () => void;
  reviewedTitle: string;
}) => {
  const { t } = useTranslation("plan");
  if (likedPlaces.length === 0) {
    // Empty from start (filter restrictive, no places match) vs swiped-through-all
    const emptyFromStart = hasCategoryFilter && !hasSwipedAny;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
        <div className="text-5xl">{emptyFromStart ? "🔍" : "🗺️"}</div>
        <div>
          <p className="font-bold text-lg">
            {emptyFromStart ? t("empty.no_places_in_cats") : t("empty.reviewed_all")}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {emptyFromStart
              ? t("empty.try_other_cats")
              : t("empty.none_picked")}
          </p>
        </div>
        <button
          onClick={() => {
            // window.location.reload() w Capacitor WebView nie czyscil user_place_reactions
            // ani exploreLikes - po reloadzie te same miejsca byly excludowane z queue.
            // Reset wykonuje DELETE z DB + clearGroup localStorage + re-fetch swipera.
            if (emptyFromStart) {
              // emptyFromStart = filter restrictive, reload nie pomoze - tu po prostu reload OK
              window.location.reload();
            } else {
              onResetToday();
            }
          }}
          disabled={resetting}
          className="border border-border rounded-full px-6 py-3 text-sm text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
        >
          {resetting ? t("empty.resetting") : emptyFromStart ? t("empty.change_filters") : t("empty.start_over")}
        </button>
      </div>
    );
  }

  // Brak dopasowanych tras wzorcowych - wycentrowany komunikat o przejrzeniu
  // kategorii/wszystkich miejsc + przejscie do zakladki Dopasowania (gdzie user
  // uklada plan). W exploreMode (brak onGoToMatches) fallback do onProceed.
  if (matchedRoutes.length === 0 && !loadingExamples) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
        <div className="h-16 w-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-orange-600" strokeWidth={2.2} />
        </div>
        <div className="space-y-1.5">
          <p className="text-2xl font-black text-foreground leading-tight">{reviewedTitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px]">
            {t("empty.go_saved_desc")}
          </p>
        </div>
        <button
          onClick={() => (onGoToMatches ? onGoToMatches() : onProceed())}
          className="px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
        >
          {onGoToMatches ? t("empty.go_saved_cta") : t("empty.plan_from_places", { count: likedPlaces.length })}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-safe-6 pb-6">
      {/* Header */}
      <div className="pt-6 pb-4 text-center">
        <p className="text-2xl font-black text-foreground">{t("empty.done")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {loadingExamples ? t("empty.searching_routes") : t("empty.found_routes")}
        </p>
      </div>

      {loadingExamples && (
        <div className="flex justify-center py-8">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Matched route cards */}
      {!loadingExamples && matchedRoutes.map((route) => {
        const metaRaw = PERSONALITY_LABELS[route.personality_type];
        const meta = metaRaw ? { label: t(metaRaw.key), emoji: metaRaw.emoji } : { label: route.personality_type, emoji: "📍" };
        return (
          <div key={route.id} className="mb-3 rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full text-foreground">
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {t("empty.common_places", { count: route.score })}
                  </span>
                </div>
                <p className="font-bold text-foreground mt-1.5">{route.title}</p>
              </div>
            </div>

            {/* Matched place pills */}
            <div className="flex flex-wrap gap-1.5">
              {route.matchedNames.map(name => (
                <span key={name} className="text-xs bg-primary/10 text-orange-600 px-2.5 py-1 rounded-full font-medium">
                  {name}
                </span>
              ))}
              {route.pins.length - route.matchedNames.length > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  {t("empty.others", { count: route.pins.length - route.matchedNames.length })}
                </span>
              )}
            </div>

            <button
              onClick={() => onPickRoute(route)}
              className="w-full py-3 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              {t("empty.pick_route")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Fallback: plan from scratch */}
      <button
        onClick={onProceed}
        className={cn(
          "w-full py-3.5 rounded-full text-sm font-semibold active:scale-[0.97] transition-transform",
          matchedRoutes.length > 0
            ? "border border-border text-muted-foreground bg-card mt-1"
            : "bg-primary text-white shadow-lg shadow-primary/25"
        )}
      >
        {matchedRoutes.length > 0
          ? t("empty.plan_from_scratch", { count: likedPlaces.length })
          : t("empty.plan_from_places", { count: likedPlaces.length })}
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaceSwiperProps {
  city: string;
  date: Date;
  numDays?: number;
  // String = legacy (tylko nazwa). Object = nowy format z lat/lng - pin startu na mapie + AI edge function.
  startingLocation?: string | { name: string; latitude: number; longitude: number };
  /** Category to show (batch of 20). Accepts single id or multiple ids (multi-select). When set, onBatchComplete fires when queue is exhausted. */
  categoryFilter?: string | string[];
  // Filtry diety - keys: vegan, vegetarian, gluten_free, lactose_free.
  // Match po vibe_tags (places) i business_profiles.tags - case insensitive, polskie + angielskie synonimy.
  dietFilters?: string[];
  // Sortowanie po dystansie od startingLocation (rosnaco). Bez efektu jesli startingLocation nie ma lat/lng.
  sortByNearest?: boolean;
  initialLikedPlaceNames?: string[];
  initialSkippedPlaceNames?: string[];
  searchQuery?: string;
  showAddPlace?: boolean;
  onAddPlaceClose?: () => void;
  /** Called with accumulated liked place names when the category batch (20 places) runs out. */
  onBatchComplete?: (likedNames: string[]) => void;
  exploreMode?: boolean;
  /** Called when user taps "suggest adding a place" in the empty search state. */
  onSuggestPlace?: () => void;
  /** Called whenever the array of liked places changes - used by parent (PlanWizard)
   *  to render Dopasowania tab with current liked items without lifting all swiper state. */
  onLikedPlacesChange?: (places: MockPlace[]) => void;
  /** Gdy ustawione, bottom CTA "Przejdz do dopasowan" wywoluje to zamiast nawigowac
   *  do /create. PlanWizard przelacza wtedy tabke na "matches" gdzie user wybiera
   *  miejsca do trasy. Bez tej props CTA wciaz wywoluje handleProceed (legacy). */
  onSwitchToMatches?: () => void;
  /** Klik w date "miasto · DD MMM" w naglowku swipera -> edycja daty (PlanWizard otwiera kalendarz). */
  onEditDate?: () => void;
}

// Category groups for diversity balancing
const FOOD_CATEGORIES = new Set<string>(["restaurant", "cafe", "bar"]);
const CULTURE_CATEGORIES = new Set<string>(["museum", "gallery", "monument"]);
const CATEGORY_GROUPS: Set<string>[] = [FOOD_CATEGORIES, CULTURE_CATEGORIES];

function getGroupForCategory(cat: string): Set<string> | null {
  return CATEGORY_GROUPS.find(g => g.has(cat)) ?? null;
}

const DIVERSITY_THRESHOLD = 2; // after 2 consecutive likes from same group, deprioritize

// Maps raw DB row (with nested business_profiles) to MockPlace fields.
// Merges three photo sources into galleryPhotos:
//   1. business_profiles.gallery_urls  (zdjęcia od właściciela lokalu)
//   2. places.gallery_urls             (kurowane / scache'owane z Google przez scripts/backfill-place-galleries.ts)
// Cover photo (place.photo_url) jest osobno - nie powtarzamy go w galerii.
// Haversine - dystans w km miedzy dwoma punktami lat/lng (kopia z StartingLocationPicker).
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Slowa kluczowe dla filtrow diety - sprawdzane w vibe_tags (places) i business_profiles.tags.
// Case-insensitive substring match - lapie '"wegańska kuchnia"', '"vegan"', '"weganskie dania"' itp.
const DIET_KEYWORDS: Record<string, string[]> = {
  vegan: ["vegan", "wegan", "wegań", "wegańsk", "weganski", "weganskie"],   // i18n-ignore: slowa kluczowe dopasowania, nie copy
  vegetarian: ["vegetarian", "wegetar", "weget", "jarski", "jarskie", "jarska", "wegetarianskie", "wegetariańsk"],   // i18n-ignore: slowa kluczowe dopasowania
  // i18n-ignore-start: slowa kluczowe dopasowywane do OPISU miejsca (oba jezyki naraz), nie copy
  gluten_free: ["gluten free", "gluten-free", "bez glutenu", "bezglutenowe", "glutenfree", "gluten_free"],
  lactose_free: ["lactose free", "lactose-free", "bez laktozy", "bezlaktozowe", "laktozy", "lactose_free"],
  // i18n-ignore-end
};

function matchesDiet(place: MockPlace, diets: string[]): boolean {
  if (diets.length === 0) return true;
  const tags = [
    ...(place.vibe_tags ?? []),
    ...((place as any).businessTags ?? []),
    ...((place as any).businessSubcategories ?? []),
    place.description ?? "",
  ].filter(Boolean).map((t) => String(t).toLowerCase());
  // OR logic miedzy wybranymi dietami - place pasuje jesli ma jakikolwiek z keywords.
  return diets.some((d) => {
    const keywords = DIET_KEYWORDS[d] ?? [];
    return keywords.some((kw) => tags.some((t) => t.includes(kw.toLowerCase())));
  });
}

// Score wazony pojedynczego miejsca: rating Google (null/0 -> 3.5 neutralne) +
// lekki jitter dla wariancji miedzy sesjami. Liczony RAZ per miejsce (w interleave),
// zeby sortowanie bylo stabilne.
function placeBaseScore(p: MockPlace): number {
  const rating = typeof p.rating === "number" && p.rating > 0 ? p.rating : 3.5;
  return rating;
}

// Przeplot kategorii (weighted round-robin): zadne dwie sasiednie karty nie sa z tej
// samej kategorii (chyba ze zostala juz tylko jedna kategoria), a w obrebie kategorii
// najlepiej oceniane miejsca pojawiaja sie wczesniej. Rozwiazuje "4-5 restauracji pod rzad".
// `prevCat` pozwala uniknac powtorki kategorii na styku dwoch grup (biznesy -> reszta).
function interleaveByCategory(places: MockPlace[], prevCat: string | null = null): MockPlace[] {
  // Pre-score raz per miejsce (rating + stabilny jitter) -> stabilna kolejnosc w buckecie.
  const scored = places.map((p) => ({
    p,
    cat: p.category || "_",
    score: placeBaseScore(p) + Math.random() * 0.5,
  }));
  const buckets = new Map<string, typeof scored>();
  for (const s of scored) {
    if (!buckets.has(s.cat)) buckets.set(s.cat, []);
    buckets.get(s.cat)!.push(s);
  }
  for (const arr of buckets.values()) arr.sort((a, b) => b.score - a.score);

  const result: MockPlace[] = [];
  let lastCat = prevCat;
  while (true) {
    const nonEmpty = [...buckets.values()].filter((a) => a.length > 0);
    if (nonEmpty.length === 0) break;
    // Najwyzszy score glowy, ale pomijajac ostatnio uzyta kategorie (jesli jest alternatywa).
    nonEmpty.sort((a, b) => b[0].score - a[0].score);
    const pick = nonEmpty.find((a) => a[0].cat !== lastCat) ?? nonEmpty[0];
    const item = pick.shift()!;
    result.push(item.p);
    lastCat = item.cat;
  }
  return result;
}

// Czy karta miejsca ma czym sie pokazac BEZ doczytywania (okladka biznesu / skurowana
// okladka / pierwsze zdjecie galerii / wideo okladkowe). Zdjecia userow (place_photos)
// swiper dociaga dopiero dla wierzchniej karty, wiec tu ich nie widzimy.
function hasOwnCover(p: MockPlace): boolean {
  return !!(p.photo_url || (p.galleryPhotos ?? [])[0] || (p as any).coverVideoUrl);
}

// Kolejnosc kart w swiperze (schemat Nat 2026-09-06):
//   1) WIZYTOWKI BIZNESOWE (w srodku: najpierw te z wlasnym zdjeciem),
//   2) miejsca ZE ZDJECIAMI OD USEROW - wizytowki "zero", czyli bez konta biznesowego,
//   3) miejsca BEZ zadnego zdjecia - karta z ikona kategorii na peachy tle.
// Sedno zmiany: tier 2 rozpoznajemy TAKZE po zdjeciach userow (place_photos), a nie tylko po
// okladce zapisanej w `places`. Miejsce zalozone zdjeciem usera ma `photo_url` NULL, wiec
// wczesniej ladowalo na samym koncu kolejki mimo posiadanego zdjecia.
// W obrebie KAZDEGO tieru przeplot kategorii + ranking wazony zamiast czystego shuffle.
// Biznes rozpoznajemy po `businessPlan`, ktore enrichWithBusinessProfile ustawia tylko gdy
// nested business_profiles istnieje.
function partitionBusinessFirst(places: MockPlace[], keysWithUserPhotos?: Set<string>): MockPlace[] {
  const bizPhoto: MockPlace[] = [];
  const bizNoPhoto: MockPlace[] = [];
  const withPhoto: MockPlace[] = [];
  const noPhoto: MockPlace[] = [];
  const hasUserPhoto = (p: MockPlace) =>
    !!keysWithUserPhotos?.size && pinCoverKeys(p as any).some((k) => keysWithUserPhotos.has(k));
  for (const p of places) {
    if ((p as any).businessPlan) { (hasOwnCover(p) ? bizPhoto : bizNoPhoto).push(p); continue; }
    (hasOwnCover(p) || hasUserPhoto(p) ? withPhoto : noPhoto).push(p);
  }
  const lastCat = (arr: MockPlace[], prev: string | null) => (arr.length ? (arr[arr.length - 1].category || "_") : prev);
  // Przeplot liczymy kaskadowo, zeby kategoria nie powtorzyla sie na styku dwoch tierow.
  const tiers = [bizPhoto, bizNoPhoto, withPhoto, noPhoto];
  const out: MockPlace[] = [];
  let prevCat: string | null = null;
  for (const tier of tiers) {
    const ordered = interleaveByCategory(tier, prevCat);
    prevCat = lastCat(ordered, prevCat);
    out.push(...ordered);
  }
  return out;
}

// Wybor pill wydarzenia dla wizytowki wg priorytetu (wzgledem daty wyjazdu `refDate`,
// domyslnie dzis): aktywny w tym terminie z kolejki (business_events) > staly event_title >
// najblizsze nadchodzace po tej dacie z kolejki. EN-aware.
// `refDate` = data wyjazdu (YYYY-MM-DD) ktora user planuje - dzieki temu przy szukaniu miejsc
// na konkretny termin pokazujemy wydarzenie najblizsze TEJ dacie, nie dzisiejszej.
function pickEventPillTitle(bp: any, refDate?: string): string | undefined {
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  const ref = refDate ?? new Date().toISOString().slice(0, 10);
  const titleOf = (e: any) => ((isEn && e?.title_en ? e.title_en : e?.title) || undefined);

  // Szkice (is_draft) nie trafiaja na wizytowke - tylko opublikowane wydarzenia.
  const events: any[] = (Array.isArray(bp?.business_events) ? bp.business_events : []).filter((e: any) => !e?.is_draft);
  const activeNow = events
    .filter((e) => e.starts_at && e.starts_at <= ref && (e.ends_at ?? e.starts_at) >= ref)
    .sort((a, b) => String(a.ends_at ?? a.starts_at).localeCompare(String(b.ends_at ?? b.starts_at)))[0];
  if (activeNow) return titleOf(activeNow);

  const standing = isEn && bp?.event_title_en ? bp.event_title_en : (bp?.event_title ?? undefined);
  if (standing) return standing;

  const upcoming = events
    .filter((e) => e.starts_at && e.starts_at > ref)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))[0];
  return upcoming ? titleOf(upcoming) : undefined;
}

// Select `places` + zagniezdzony business_profiles (+ business_events) - jedno zrodlo prawdy
// dla wizytowki (swiper i "Zapisane"). Zmiana tu propaguje do wszystkich call sites.
export const PLACE_BUSINESS_SELECT =
  "*, business_profiles(plan, is_premium, logo_url, cover_image_url, cover_video_url, event_title, event_title_en, event_description, gallery_urls, phone, website, social_links, main_category, secondary_category, subcategories, tags, description, is_verified, color_badge, color_card_bg, color_button, color_promo, menu_image_urls, opening_hours, latitude, longitude, street, postal_code, address, business_events(id, title, title_en, starts_at, ends_at, start_time, end_time, description, is_draft))";

// Doczytuje pojedyncze miejsce po places.id (UUID) i wzbogaca profilem biznesowym -
// uzywane przez "Zapisane" zeby tap w kafelek otwieral pelna wizytowke (jak w swiperze).
export async function fetchEnrichedPlace(id: string, refDate?: string): Promise<MockPlace | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("places")
      .select(PLACE_BUSINESS_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return enrichWithBusinessProfile(data, refDate);
  } catch {
    return null;
  }
}

export function enrichWithBusinessProfile(p: any, refDate?: string): MockPlace {
  const placeGallery: string[] = Array.isArray(p.gallery_urls) ? p.gallery_urls.filter(Boolean) : [];

  const bp = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
  if (!bp) {
    // Zwykle miejsce (bez profilu biznesu). ZERO Google (2026-07-29): NIE uzywamy starego Google
    // backfillu (places.photo_url z prefiksem gpid_/cache). Zachowujemy: (a) recznie skurowana
    // okladka (upload /manual/) = NASZ content, (b) proxy Google na zywo (/api/place-photo) - swiadomy
    // backfill zdjec dla ODBLOKOWANYCH miejsc zakladki "Miejsca" (proxy = pobranie live, bez cache
    // bajtow, zgodnie z ToS Google). Brak -> okladka z losowego zdjecia usera (SwipeCard) / ikona.
    const curated = typeof p.photo_url === "string"
      && (p.photo_url.includes("/place-photos-cache/manual/") || p.photo_url.includes("/api/place-photo"))
      ? p.photo_url
      : undefined;
    return { ...p, photo_url: curated, galleryPhotos: curated ? [curated] : [] } as MockPlace;
  }
  // Per decyzja produktowa (CLAUDE.md): WYGLAD wizytowki (logo, eventy, cover, kontakt) jest
  // premium dla kazdego aktywnego biznesu - kolumna `plan` (legacy zero/basic/premium) jest tu
  // ignorowana, bo przy rejestracji zawsze ustawia sie 'zero'.
  // UWAGA: to NIE znaczy "kazdy jest platny". Realny status konta = business_profiles.is_premium
  // (businessIsPremium ponizej) i to o niego pytaja funkcje premium-only.
  const plan: 'zero' | 'basic' | 'premium' = 'premium';
  const bizGallery: string[] = Array.isArray(bp.gallery_urls) ? bp.gallery_urls.filter(Boolean) : [];
  // Logika galerii: jesli biznes wgral wlasne zdjecia (cover_image, cover_video, gallery_urls)
  // -> uzywamy TYLKO biznesowych. Biznes wybral jak chce sie prezentowac, nie nadpisujemy
  // kurowanymi Google Photos z places.gallery_urls (backfill).
  // Jesli biznes NIE ma zadnych wlasnych zdjec -> uzywamy placeGallery (Google backfill)
  // jako fallback zeby wizytowka miala chociaz placeholder.
  const hasBizPhotos = !!(bp.cover_image_url || bp.cover_video_url || bizGallery.length > 0);
  // ZERO Google (2026-07-29): gdy biznes nie ma wlasnych zdjec, NIE fallbackujemy do
  // placeGallery (Google backfill) - zostaje pusto (-> ikona kategorii / zdjecia usera).
  const mergedGallery = hasBizPhotos ? bizGallery : [];
  // Adres z profilu biznesu (street + postal + miasto). Biznes wpisuje wlasny adres w dashboardzie -
  // to autorytatywne zrodlo. Inaczej adres bralby sie z Google (detail.formatted_address), ktory dla
  // lokalu o popularnej nazwie potrafi trafic w zupelnie inny lokal -> losowy adres na wizytowce.
  const bizAddress = bp.street
    ? [bp.street, [bp.postal_code, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : (bp.address || null);
  const hasOwnAddress = !!(bp.street || bp.address);
  return {
    ...p,
    businessPlan: plan,
    // Realny status platnego konta - zrodlo prawdy dla funkcji premium-only (2026-08-31).
    businessIsPremium: bp.is_premium === true,
    // Override pozycji pinu geokodowanym adresem biznesu (gdy ustawiony) - inaczej pin
    // na mapie trasy bralby stare/NULL places.latitude/longitude i ladowal w zlym miejscu.
    latitude: bp.latitude ?? p.latitude,
    longitude: bp.longitude ?? p.longitude,
    // Override adresu adresem biznesu (gdy ustawiony) - zrodlo prawdy zamiast Google.
    address: bizAddress ?? p.address,
    businessHasOwnAddress: hasOwnAddress,
    // Okladka biznesu = cover_image lub pierwsze zdjecie wlasnej galerii. ZERO Google:
    // bez fallbacku do places.photo_url (backfill Google). Brak -> ikona / zdjecie usera.
    photo_url: bp.cover_image_url || bizGallery[0] || undefined,
    // Show business section (logo, events, CTA) dla wszystkich biz
    businessLogoUrl: bp.logo_url ?? '',
    // Pill wydarzenia: aktywny dzis z kolejki > staly event_title > najblizszy nadchodzacy.
    // EN-aware (pokazuje EN tytul dla usera EN). Patrz pickEventPillTitle.
    businessEventTitle: pickEventPillTitle(bp, refDate),
    businessPhone: bp.phone ?? null,
    businessWebsite: bp.website ?? null,
    businessInstagram: (bp.social_links as { instagram?: string } | null)?.instagram ?? null,
    businessFacebook: (bp.social_links as { facebook?: string } | null)?.facebook ?? null,
    galleryPhotos: mergedGallery,
    businessSubcategories: bp.subcategories ?? [],
    businessTags: Array.isArray(bp.tags) ? bp.tags.filter(Boolean) : [],
    businessMainCategory: bp.main_category ?? undefined,
    businessSecondaryCategory: (bp as any).secondary_category ?? undefined,
    businessEvents: Array.isArray((bp as any).business_events) ? (bp as any).business_events : [],
    businessMenuImageUrls: Array.isArray(bp.menu_image_urls) ? bp.menu_image_urls.filter(Boolean) : [],
    businessOpeningHours: bp.opening_hours && typeof bp.opening_hours === "object" && Object.keys(bp.opening_hours).length > 0
      ? bp.opening_hours
      : undefined,
    coverVideoUrl: bp.cover_video_url ?? undefined,
    businessEventDescription: bp.event_description ?? undefined,
    businessDescription: bp.description ?? undefined,
    businessIsVerified: !!bp.is_verified,
    businessColorBadge: bp.color_badge ?? undefined,
    businessColorCardBg: bp.color_card_bg ?? undefined,
    businessColorButton: bp.color_button ?? undefined,
    businessColorPromo: bp.color_promo ?? undefined,
    // Pomijaj Google Photos tylko gdy biznes ma WŁASNE zdjęcia (cover/video/własna galeria).
    // places.gallery_urls (kurowane z Google) NIE liczy się jako "własne zdjęcia biznesu".
    businessHasOwnPhoto: !!(
      bp.cover_image_url || bp.cover_video_url || (bizGallery.length > 0)
    ),
  } as MockPlace;
}

const PlaceSwiper = ({ city, date, numDays = 1, startingLocation = "", categoryFilter, dietFilters, sortByNearest, initialLikedPlaceNames = [], initialSkippedPlaceNames = [], searchQuery = "", showAddPlace: showAddPlaceProp = false, onAddPlaceClose, onBatchComplete, exploreMode = false, onSuggestPlace, onLikedPlacesChange, onSwitchToMatches, onEditDate }: PlaceSwiperProps) => {
  const { t } = useTranslation("plan");
  // Normalize categoryFilter to a stable array (single id, multiple ids, or none).
  const categoryFilters: string[] = Array.isArray(categoryFilter)
    ? categoryFilter.filter(Boolean)
    : (categoryFilter ? [categoryFilter] : []);
  const categoryFilterKey = categoryFilters.join(",");
  const dietFilterKey = (dietFilters ?? []).join(",");
  const hasCategoryFilter = categoryFilters.length > 0;
  // Naglowek empty state po przejrzeniu wszystkich miejsc: "{kategoria} przejrzana!"
  // (1 kategoria) / "Wybrane kategorie przejrzane!" (kilka) / "Wszystkie miejsca
  // przejrzane!" (brak filtra).
  const reviewedTitle = (() => {
    if (categoryFilters.length === 0) return t("reviewed_all_title");
    if (categoryFilters.length > 1) return t("reviewed_selected_title");
    const id = categoryFilters[0];
    const main = MAIN_CATEGORIES.find(c => c.id === id);
    const sub = MAIN_CATEGORIES.flatMap(c => c.subcategories).find(s => s.id === id);
    const label = main?.label ?? sub?.label ?? (CATEGORY_LABELS as Record<string, string>)[id];
    return label ? t("reviewed_category_title", { label }) : t("reviewed_all_title");
  })();
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const { active: onboardingActive } = useOnboarding();
  const haptics = useHaptics();
  // Stan "zapisane" wg czlonkostwa w listach usera (bookmark wypelniony gdy miejsce juz w liscie).
  const { isSaved: isSavedInList } = useSavedPlaces();
  const unsave = useUnsavePlace();

  const [allPlaces, setAllPlaces] = useState<MockPlace[]>([]);
  const [queue, setQueue] = useState<MockPlace[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumping refreshNonce trigeruje re-fetch w useEffect (np. po "Zacznij od nowa")
  // - czyscimy DB reactions z dziennej + localStorage exploreLikes i fetchujemy queue na nowo.
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [resetting, setResetting] = useState(false);
  // Po powrocie appki na wierzch (event z useAppResume) dociagnij swieze miejsca - zeby edycje
  // profilu lokalu byly widoczne bez remountu. Tylko exploreMode (HomeSwipe): tam polubione sa
  // zachowane przy refetchu, a juz przeswipeowane miejsca dnia i tak sa odfiltrowane. Pomijamy
  // solo (return-state moglby zresetowac biezaca liste Dopasowan).
  useEffect(() => {
    if (!exploreMode) return;
    const onResume = () => setRefreshNonce((n) => n + 1);
    window.addEventListener("trasa:app-resume", onResume);
    return () => window.removeEventListener("trasa:app-resume", onResume);
  }, [exploreMode]);
  const [likedPlaces, setLikedPlaces] = useState<MockPlace[]>([]);
  const [skippedPlaces, setSkippedPlaces] = useState<MockPlace[]>([]);
  const [superLikedPlaces, setSuperLikedPlaces] = useState<MockPlace[]>([]);
  // scrollMode (Eksploracja pionowa): zapisane miejsca (bez zdejmowania z kolejki) +
  // id aktualnie widocznej karty (fetch Google/tag odpalamy TYLKO dla niej - koszt).
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // Etap 2: drawer "Miejsce zapisane!" (dodaj do wyjazdu) po zapisaniu z karty w eksploracji.
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [saveSheetPlace, setSaveSheetPlace] = useState<SavePlaceInput | null>(null);
  // id karty swipera dla miejsca w drawerze - do zdjecia stanu "zapisane" po usunieciu z wyjazdu.
  const [saveSheetSwiperId, setSaveSheetSwiperId] = useState<string | null>(null);
  // Hint scrollowania: pierwsza karta nieco nizsza (nastepna wystaje) + puls w dol,
  // dopoki user nie przewinie. Po pierwszym scrollu chowamy podpowiedz.
  const [hasScrolled, setHasScrolled] = useState(false);
  // Feed Miejsc renderuje CALA baze przez infinite-scroll (nie zalewamy DOM od razu).
  // Reset przy zmianie miasta/filtrow/wyszukiwania (nizej, po zdefiniowaniu isSearching).
  const [exploreVisible, setExploreVisible] = useState(24);
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{ place: MockPlace; reaction: "liked" | "skipped" | "super_liked" }[]>([]);
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [matchedRoutes, setMatchedRoutes] = useState<MatchedRoute[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [bannerDismissCount, setBannerDismissCount] = useState(0);
  // Track consecutive likes per category group
  const [recentLikedGroups, setRecentLikedGroups] = useState<(Set<string> | null)[]>([]);
  // Punkt odniesienia dystansu. NIE pytamy o niego zadnym arkuszem (usuniete 2026-08-28,
  // pytanie "Jestes juz w X?" bylo niezrozumiale, a przy city="all" wrecz bledne). Ustawia sie
  // sam z GPS gdy user ma juz zgode, albo recznie chipem "Pokaz dystans" na karcie.
  const distanceRef = useDistanceReference();
  const showAddPlace = showAddPlaceProp;
  const setShowAddPlace = (v: boolean) => { if (!v) onAddPlaceClose?.(); };

  // Inne miasto = inny punkt odniesienia: czysci ref przy zmianie miasta.
  useEffect(() => { ensureCityContext(city); }, [city]);

  // Chip "Pokaz dystans" na karcie: od razu systemowa zgoda na lokalizacje (bez posrednich
  // pytan). Gdy user odmowi - krotki komunikat, chip zostaje na kolejna probe.
  const enableDistance = async () => {
    const ok = await setGpsReference();
    if (!ok) toast(t("distance_denied"));
  };

  // Lokalizacja: CICHY auto-detect przez GPS (tylko gdy user juz dal zgode - tryResolveOnSite
  // nie promptuje). Jestes w miescie -> chip "od Ciebie" pojawia sie sam. Nie ma zadnego
  // pytania do usera; gdy nie wyjdzie, na karcie zostaje chip "Pokaz dystans".
  useEffect(() => {
    if (loading || distanceRef) return;
    let cancelled = false;
    (async () => {
      await tryResolveOnSite(city);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loading, distanceRef, city]);

  useEffect(() => {
    setLoading(true);
    // Safety net: if the fetch hangs for any reason, drop the loader after 12s
    const safetyTimeout = setTimeout(() => {
      console.warn("[PlaceSwiper] fetch safety timeout fired, forcing loading=false", { city, categoryFilter });
      setLoading(false);
    }, 12000);

    const fetchPlaces = async () => {
      try {

      // ── Normal mode ──────────────────────────────────────────────────────
      // city === "all" (opcja "Wszystkie") -> bez filtra miasta (wszystkie miejsca).
      const scoped = !!city && city !== "all";
      let placesQuery = (supabase as any)
        .from("places")
        .select(PLACE_BUSINESS_SELECT)
        .eq("is_active", true);
      if (scoped) placesQuery = placesQuery.in("city", expandCity(city));
      const { data, error: placesError } = await placesQuery;

      if (placesError) console.error("[PlaceSwiper] places fetch error:", placesError);
      console.log("[PlaceSwiper] fetched places:", { count: data?.length ?? 0, city, categoryFilter });
      if (!data?.length) { setLoading(false); return; }

      // Fetch already-rated place IDs for this user+city z DZISIAJ. Reset codzienny
      // = polubienia/odrzuty z wczoraj i wcześniej nie ukrywają miejsc dziś. User
      // każdy nowy dzień zaczyna z czystą talia. Reactions w DB persyst dla taste profile,
      // ale UI filter polega tylko na today (gte start of today UTC).
      let ratedPlaceIds = new Set<string>();
      if (user) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        let reactionsQuery = (supabase as any)
          .from("user_place_reactions")
          .select("place_id")
          .eq("user_id", user.id)
          .gte("created_at", todayStart.toISOString());
        if (scoped) reactionsQuery = reactionsQuery.in("city", expandCity(city));
        const { data: reactions } = await reactionsQuery;
        if (reactions?.length) {
          ratedPlaceIds = new Set(reactions.map((r: { place_id: string }) => r.place_id));
        }
      }

      const enriched = (data as any[]).map((pp: any) => enrichWithBusinessProfile(pp, date.toISOString().slice(0, 10)));
      const likedSet = new Set(initialLikedPlaceNames.map(n => n.toLowerCase()));
      const skippedSet = new Set(initialSkippedPlaceNames.map(n => n.toLowerCase()));
      const liked = enriched.filter((p) => likedSet.has(p.place_name.toLowerCase()));
      const skipped = enriched.filter((p) => skippedSet.has(p.place_name.toLowerCase()));

      const hasReturnState = initialLikedPlaceNames.length > 0 || initialSkippedPlaceNames.length > 0;
      const activeDiets = dietFilters ?? [];
      const remaining = enriched.filter((p) => {
        if (likedSet.has(p.place_name.toLowerCase()) || skippedSet.has(p.place_name.toLowerCase())) return false;
        // Filtr diety - applikowany do wszystkich miejsc (zarowno batch jak normal mode)
        if (!matchesDiet(p, activeDiets)) return false;
        if (!hasReturnState && ratedPlaceIds.has(p.id)) return false;
        return true;
      });

      // Sort "od najblizszego" od wspolnego punktu odniesienia (GPS lub punkt startowy z
      // mapy). Reference ma priorytet; fallback do startingLocation z kroku 3 (legacy).
      const refForSort = getReference();
      const startCoords = refForSort?.coords
        ?? (typeof startingLocation === "object" && startingLocation
          ? { lat: startingLocation.latitude, lng: startingLocation.longitude }
          : null);
      const applyNearestSort = (arr: MockPlace[]) => {
        if (!sortByNearest || !startCoords) return arr;
        return [...arr].sort((a, b) => {
          const da = a.latitude && a.longitude ? haversineKm(startCoords, { lat: a.latitude, lng: a.longitude }) : Infinity;
          const db = b.latitude && b.longitude ? haversineKm(startCoords, { lat: b.latitude, lng: b.longitude }) : Infinity;
          return da - db;
        });
      };

      // Ktore miejsca maja juz zdjecia od userow - decyduje o tierze 2 kolejki (patrz
      // partitionBusinessFirst). Best-effort: blad = kolejka jak dawniej, bez wywalania ekranu.
      const photoKeys = await fetchPlaceKeysWithPhotos(
        remaining.flatMap((p) => pinCoverKeys(p as any)),
      ).catch(() => new Set<string>());

      setAllPlaces(enriched);
      if (liked.length) setLikedPlaces(liked);
      if (skipped.length) setSkippedPlaces(skipped);

      // Batch mode: one or many categories OR'd together, max 20 places
      if (hasCategoryFilter) {
        const standardSubIds = new Set<string>();
        const customSubIds = new Set<string>();
        for (const f of categoryFilters) {
          const subIds = getSubcategoryIds(f);
          const isStandard = subIds.length > 0 || MAIN_CATEGORIES.some(c =>
            c.id === f || c.subcategories.some(s => s.id === f)
          );
          if (isStandard) {
            if (subIds.length > 0) subIds.forEach(id => standardSubIds.add(id));
            else standardSubIds.add(f);
          } else {
            customSubIds.add(f);
          }
        }
        // Expand standardSubIds przez aliasy DB - subcategory "club" pasuje do
        // p.category="club" ORAZ "nightlife" (historyczny mix w bazie).
        const dbCategorySet = new Set<string>();
        standardSubIds.forEach(subId => {
          getDbCategoriesFor(subId).forEach(dbCat => dbCategorySet.add(dbCat));
        });
        const filtered = remaining.filter(p => {
          if (dbCategorySet.has(p.category)) return true;
          const bizSubs = (p as any).businessSubcategories as string[] | undefined;
          if (bizSubs && bizSubs.some(s => customSubIds.has(s))) return true;
          return false;
        });
        // Feed Miejsc = CALA baza (renderowanie ograniczone infinite-scrollem, nie tu).
        const pool = applyNearestSort(partitionBusinessFirst(filtered, photoKeys));
        console.log("[PlaceSwiper] batch pool:", { categoryFilters, standardSubIds: [...standardSubIds], dbCategorySet: [...dbCategorySet], customSubIds: [...customSubIds], poolSize: pool.length, remainingTotal: remaining.length });
        setQueue(pool);
      } else {
        setQueue(applyNearestSort(partitionBusinessFirst(remaining, photoKeys)));
      }
      setLoading(false);
      } catch (err) {
        console.error("[PlaceSwiper] fetchPlaces threw:", err);
        setLoading(false);
      }
    };
    fetchPlaces().finally(() => clearTimeout(safetyTimeout));
    // UWAGA: sortByNearest CELOWO nie jest w deps - zmiana sortu nie przebudowuje queue
    // (inaczej ocenione miejsca wracaly = reset swipe). Sort stosowany reaktywnie nizej.
  }, [city, user, categoryFilterKey, dietFilterKey, refreshNonce]);

  // Reorder queue when a category group has been liked too many times consecutively
  const rebalanceQueue = (newRecentGroups: (Set<string> | null)[]) => {
    // Count consecutive recent likes from the same group (last N)
    const lastN = newRecentGroups.slice(-DIVERSITY_THRESHOLD);
    if (lastN.length < DIVERSITY_THRESHOLD) return;

    const lastGroup = lastN[lastN.length - 1];
    if (!lastGroup) return;

    // Check if all last N are from the same group
    const allSame = lastN.every(g => g === lastGroup);
    if (!allSame) return;

    // Deprioritize: move cards from this group to the back of the queue
    setQueue(prev => {
      const fromGroup: MockPlace[] = [];
      const others: MockPlace[] = [];
      for (const p of prev) {
        if (lastGroup.has(p.category)) {
          fromGroup.push(p);
        } else {
          others.push(p);
        }
      }
      // Only rebalance if there are non-group cards to show
      if (others.length === 0) return prev;
      return [...others, ...fromGroup];
    });
  };

  const isSearching = searchQuery.trim().length >= 2;
  // Reset okna infinite-scrolla przy zmianie miasta / filtrow / wyszukiwania.
  useEffect(() => { setExploreVisible(24); if (scrollWrapRef.current) scrollWrapRef.current.scrollTop = 0; }, [city, categoryFilterKey, dietFilterKey, isSearching]);
  const baseQueue = isSearching
    ? allPlaces.filter(p => p.place_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : queue;
  // Sort "od najblizszego" REAKTYWNIE - re-sortuje POZOSTALE karty bez przebudowy queue
  // (queue nie zawiera juz ocenionych). Wczesniej sortByNearest byl w deps efektu -> toggle
  // resetowal swipe (ocenione wracaly do kolejki).
  const displayQueue = useMemo(() => {
    if (!sortByNearest) return baseQueue;
    const ref = getReference();
    const coords = ref?.coords ?? (typeof startingLocation === "object" && startingLocation
      ? { lat: (startingLocation as any).latitude, lng: (startingLocation as any).longitude } : null);
    if (!coords) return baseQueue;
    return [...baseQueue].sort((a, b) => {
      const da = a.latitude && a.longitude ? haversineKm(coords, { lat: a.latitude, lng: a.longitude }) : Infinity;
      const db = b.latitude && b.longitude ? haversineKm(coords, { lat: b.latitude, lng: b.longitude }) : Infinity;
      return da - db;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQueue, sortByNearest]);

  const photoUrlOverrides = useRef<Record<string, string>>({});

  const saveReaction = (place: MockPlace, reaction: "liked" | "skipped" | "super_liked", overridePhotoUrl?: string) => {
    if (!user) return;
    const photoUrl = overridePhotoUrl ?? photoUrlOverrides.current[place.id] ?? place.photo_url ?? null;
    (supabase as any)
      .from("user_place_reactions")
      .upsert({
        user_id: user.id,
        place_id: place.id,
        place_name: place.place_name,
        city: place.city,
        category: place.category,
        photo_url: photoUrl,
        reaction,
      }, { onConflict: "user_id,place_id" })
      .then(() => {});
  };

  const deleteReaction = (place: MockPlace) => {
    if (!user) return;
    (supabase as any)
      .from("user_place_reactions")
      .delete()
      .match({ user_id: user.id, place_id: place.id })
      .then(() => {});
  };

  const trackAndRebalance = (place: MockPlace) => {
    const group = getGroupForCategory(place.category);
    const updated = [...recentLikedGroups, group];
    setRecentLikedGroups(updated);
    rebalanceQueue(updated);
  };

  const handleLike = (overridePhotoUrl?: string, placeOverride?: MockPlace) => {
    const top = placeOverride ?? displayQueue[0];
    if (!top) return;
    // Anonim moze TYLKO przegladac - zapis miejsca wymaga konta. WYJATEK: podczas onboardingu
    // (fejk-konto) zapis dziala, zeby user przeszedl pelna petle. Po onboardingu blokada wraca.
    if ((!user || isAnonymous) && !onboardingActive) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    haptics.medium();
    setHistory(prev => [...prev, { place: top, reaction: "liked" }]);
    setLikedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "liked", overridePhotoUrl);
    trackAndRebalance(top);
    // Persist do localStorage history zawsze (poza group session i round mode) -
    // uzywane przez Eksploruj 'Polubione' tab i 'Zaplanuj solo' reuse prompt.
    // Wczesniej zapis byl tylko w exploreMode (HomeSwipe), wiec lajki z planu konkretnej
    // trasy (PlanWizard step 4) nie ladowaly w Eksploruj.
    saveExploreLike(city, {
      place_name: top.place_name,
      category: top.category,
      // places.id (UUID) - pozwala wizytowce w "Zapisane" doczytac pelny profil biznesu.
      place_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(top.id) ? top.id : null,
      latitude: top.latitude,
      longitude: top.longitude,
      // Zdjecie: preferuj zafetchowane z Google (photoUrlOverrides) tak jak saveReaction -
      // miasta bez cache (np. Wroclaw) maja places.photo_url NULL, ale karta i tak dociaga
      // zdjecie z Google; bez tego "Zapisane" pokazywalyby placeholder zamiast miniaturki.
      photo_url: overridePhotoUrl ?? photoUrlOverrides.current[top.id] ?? top.photo_url ?? null,
      address: top.address ?? null,
      rating: top.rating ?? null,
      description: top.description ?? null,
    });
    // Track add_to_route for real (non-mock) places
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(top.id)) {
      posthog.capture("place_added_to_route", { place_id: top.id });
    }
    // Onboarding: sygnalizuj realny zapis, zeby coach przeszedl do kolejnego kroku.
    if (onboardingActive) { try { window.dispatchEvent(new CustomEvent("trasa:ob-saved")); } catch { /* noop */ } }
  };

  // scrollMode ("+"): zapisz miejsce (Zapisane/exploreLikes) BEZ zdejmowania z kolejki -
  // scroll zostaje na tej samej karcie, + pokazuje stan zapisane. opts.openSheet -> po
  // zapisaniu z karty pokazujemy Etap 2 (drawer "Miejsce zapisane!" = dodaj do wyjazdu).
  const handleSaveInPlace = (place: MockPlace, opts?: { openSheet?: boolean }) => {
    if ((!user || isAnonymous) && !onboardingActive) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(place.id);
    // Ponowny tap na zapisanym = ODZAPISZ (toast+cofnij), bez otwierania drawera. Poza onboardingiem.
    if (!onboardingActive && (savedIds.has(place.id) || isSavedInList(place.place_name))) {
      haptics.medium();
      setSavedIds((prev) => { const n = new Set(prev); n.delete(place.id); return n; });
      void unsave({
        place_name: place.place_name, category: place.category ?? null, address: place.address ?? null,
        latitude: place.latitude ?? null, longitude: place.longitude ?? null,
        photo_url: photoUrlOverrides.current[place.id] ?? place.photo_url ?? null, place_id: isUuid ? place.id : null,
      });
      return;
    }
    const alreadySaved = savedIds.has(place.id);
    if (!alreadySaved) {
      haptics.medium();
      setSavedIds(prev => new Set(prev).add(place.id));
      saveReaction(place, "liked");
      // NIE zapisujemy juz do starego "zapisane" (exploreLikes) - realny zapis to wybor listy
      // w SavePlaceSheet (odwiedzone / do odwiedzenia). Zostaje tylko reakcja (pamiec kolejki swipera).
      if (isUuid) posthog.capture("place_added_to_route", { place_id: place.id });
      if (onboardingActive) { try { window.dispatchEvent(new CustomEvent("trasa:ob-saved")); } catch { /* noop */ } }
    }
    // Sheet "Gdzie chcesz zapisac to miejsce?" - wybor listy (odwiedzone/do odwiedzenia).
    // Tylko eksploracja z realnym kontem - nie w onboardingu.
    if (opts?.openSheet && exploreMode && !onboardingActive && user && !isAnonymous) {
      setSaveSheetPlace({
        place_name: place.place_name,
        category: place.category ?? null,
        address: place.address ?? null,
        // Miasto SAMEGO miejsca (nie kontekstu przegladania) - inaczej zapis stempluje je
        // miastem, po ktorym akurat sie rozgladasz.
        city: place.city ?? null,
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null,
        photo_url: photoUrlOverrides.current[place.id] ?? place.photo_url ?? null,
        place_id: isUuid ? place.id : null,
      });
      setSaveSheetSwiperId(place.id);
      setSaveSheetOpen(true);
    }
  };

  const handleSkip = () => {
    const top = displayQueue[0];
    if (!top) return;
    haptics.light();
    setHistory(prev => [...prev, { place: top, reaction: "skipped" }]);
    setSkippedPlaces(prev => [...prev, top]);
    setAllPlaces(prev => prev.filter(p => p.id !== top.id));
    setQueue(prev => prev.filter(p => p.id !== top.id));
    saveReaction(top, "skipped");
  };


  const handleUndo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(prev => prev.slice(0, -1));
    setQueue(prev => [last.place, ...prev]);
    setAllPlaces(prev => [last.place, ...prev]);
    if (last.reaction === "liked") {
      setLikedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    } else if (last.reaction === "super_liked") {
      setSuperLikedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    } else if (last.reaction === "skipped") {
      setSkippedPlaces(prev => prev.filter(p => p.id !== last.place.id));
    }
    deleteReaction(last.place);
  };

  const handleTap = (place: MockPlace) => {
    setDetailPlace(place);
    setDetailOpen(true);
  };

  // "Zacznij od nowa" w EmptyState - prawdziwy reset zamiast window.location.reload()
  // (ktore nie czyscilo DB reactions ani localStorage). Czysci CALA historie reactions
  // dla tego miasta (NIE tylko dziennie - app filtruje tylko reactions z dzisiaj,
  // ale jesli user mial wczorajsze reactions na te same miejsca, te tez excludowaly).
  // Plus exploreLikes localStorage + history state + re-fetch queue.
  const handleResetToday = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      if (user) {
        // Usuwamy WSZYSTKIE reactions w tym miescie zeby user dostal pelny pool na nowo.
        // Reactions na taste profile sa tracked osobno (place_features_user, etc).
        const { error: delError } = await (supabase as any)
          .from("user_place_reactions")
          .delete()
          .eq("user_id", user.id)
          .in("city", expandCity(city));
        if (delError) throw delError;
      }
      // Wyczysc explore likes localStorage dla tego miasta + dziennej grupy
      const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      clearExploreGroup(todayStr, city);
      // Reset local state - history, queue, liked itp.
      setHistory([]);
      setLikedPlaces([]);
      setSkippedPlaces([]);
      setSuperLikedPlaces([]);
      setQueue([]);
      // Trigger re-fetch przez bumping nonce - useEffect odpali fetchPlaces od nowa
      setRefreshNonce(n => n + 1);
    } catch (err) {
      console.error("[PlaceSwiper] reset today failed:", err);
      toast.error(t("toast_reset_error"));
    } finally {
      setResetting(false);
    }
  };

  const handleProceed = () => {
    // Zapisywanie trasy wymaga prawdziwego konta - anon user dostaje AuthDrawer.
    // Po linkIdentity / updateUser anon zachowuje user_id, wiec polubione miejsca
    // sa propagowane dalej (CreateRoute czyta state z navigate).
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    const routeState = {
      city,
      date: date.toISOString(),
      numDays,
      startingLocation: startingLocation || undefined,
      likedPlaceNames: allLiked.map((p) => p.place_name),
      skippedPlaceNames: skippedPlaces.map((p) => p.place_name),
      likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude, opening_hours: p.opening_hours?.weekday_text ?? null })),
      superLikedPlaceNames: superLikedPlaces.map((p) => p.place_name),
    };
    if (!user || isAnonymous) {
      // Zachowaj pelny route state zeby po upgrade konta wrocic do /create z preloadem -
      // bez startingLocation/likedPlacesData/numDays CreateRoute padal lub cofal usera
      // do step wyboru startu zamiast od razu generowac trase.
      try {
        localStorage.setItem("trasa_guest_plan", JSON.stringify(routeState));
      } catch { /* unavailable */ }
      openAuthDrawer({ mode: "register", hint: "save_route" });
      return;
    }
    navigate("/create", { state: routeState });
  };

  // Expose liked places to parent (PlanWizard Dopasowania tab) - rerenders na zmianie referencji array.
  // Wstrzykujemy zdjecie zafetchowane z Google (photoUrlOverrides) gdy place.photo_url jest puste -
  // inaczej miniaturki w "Zapisane"/Dopasowania sa puste dla miast bez cache (np. Wroclaw).
  useEffect(() => {
    const merged = [...likedPlaces, ...superLikedPlaces].map((p) =>
      p.photo_url ? p : { ...p, photo_url: photoUrlOverrides.current[p.id] ?? p.photo_url },
    );
    onLikedPlacesChange?.(merged);
  }, [likedPlaces, superLikedPlaces]);

  // Bingo modal DISABLED globally - userka wycofala go z solo parowania (i wczesniej
  // z exploreMode). Hook zostawiony jako stub na wypadek powrotu - po prostu nic nie
  // robi. Zmienne setShowBanner / bannerDismissCount nadal istnieja zeby nie ruszac
  // pozostalej logiki, ale showBanner pozostaje false.
  void BINGO_MIN_CATEGORIES; void BINGO_REPEAT_CATEGORIES; void setShowBanner; void bannerDismissCount;

  const handleBannerDismiss = () => {
    setShowBanner(false);
    setBannerDismissCount(c => c + 1);
  };

  // Fetch + match route_examples when queue runs out
  useEffect(() => {
    if (queue.length > 0 || loading || likedPlaces.length === 0) return;
    setLoadingExamples(true);
    (supabase as any)
      .from("route_examples")
      .select("id, title, personality_type, description, pins")
      .in("city", expandCity(city))
      .eq("is_approved", true)
      .then(({ data }: { data: RouteExample[] | null }) => {
        if (!data?.length) { setLoadingExamples(false); return; }
        const likedNames = likedPlaces.map(p => p.place_name.toLowerCase().trim());
        const scored: MatchedRoute[] = data
          .map(r => {
            const matched = r.pins.filter(p =>
              likedNames.includes(p.place_name.toLowerCase().trim())
            );
            return { ...r, score: matched.length, matchedNames: matched.map(p => p.place_name) };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setMatchedRoutes(scored);
        setLoadingExamples(false);
      });
  }, [queue.length, loading, likedPlaces, city]);

  const buildPlan = (route: RouteExample) => ({
    city,
    days: [{
      day_number: 1,
      pins: route.pins.map(p => ({
        place_name: p.place_name,
        address: "",
        description: p.note ?? "",
        suggested_time: p.suggested_time,
        duration_minutes: p.duration_minutes,
        category: p.category,
        latitude: 0,
        longitude: 0,
        day_number: 1,
        walking_time_from_prev: p.walking_time_from_prev ?? null,
      })),
    }],
  });

  const handlePickRoute = (route: RouteExample) => {
    const selectedIndex = matchedRoutes.findIndex(r => r.id === route.id);
    const allLiked = [...likedPlaces, ...superLikedPlaces];
    navigate("/create", {
      state: {
        city,
        date: date.toISOString(),
        numDays,
        startingLocation: startingLocation || undefined,
        fromTemplate: true,
        initialPlan: buildPlan(route),
        matchedRoutes: matchedRoutes.map(r => ({
          id: r.id,
          title: r.title,
          personality_type: r.personality_type,
          pins: r.pins,
        })),
        selectedRouteIndex: selectedIndex,
        likedPlaceNames: allLiked.map(p => p.place_name),
        skippedPlaceNames: skippedPlaces.map(p => p.place_name),
        likedPlacesData: allLiked.map(p => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude, opening_hours: p.opening_hours?.weekday_text ?? null })),
        superLikedPlaceNames: superLikedPlaces.map(p => p.place_name),
      },
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // All cards swiped
  if (queue.length === 0) {
    // Batch mode: category exhausted → go back to category picker
    if (onBatchComplete) {
      // Distinguish: empty from start (no places in category) vs exhausted after swiping
      const nothingToShow = history.length === 0 && likedPlaces.length === 0;
      return (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
            <div className="text-5xl">{nothingToShow ? "🤔" : "✅"}</div>
            <div>
              <p className="font-bold text-lg">
                {nothingToShow ? t("batch.no_places_title") : t("batch.exhausted_title")}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {nothingToShow
                  ? t("batch.no_places_city", { city })
                  : likedPlaces.length > 0
                  ? t("batch.picked_count", { count: likedPlaces.length })
                  : t("batch.none_picked")}
              </p>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => onBatchComplete([...likedPlaces, ...superLikedPlaces].map(p => p.place_name))}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
              >
                {t("batch.next_category")}
              </button>
              {likedPlaces.length > 0 && (
                <button
                  onClick={handleProceed}
                  className="w-full py-3.5 rounded-full border border-border text-sm font-semibold active:scale-[0.97] transition-transform"
                >
                  {t("batch.plan_route", { count: likedPlaces.length })}
                </button>
              )}
            </div>
          </div>
          {showUpsell && (
            <GuestUpsellModal
              onSignUp={() => {
                const allLiked = [...likedPlaces, ...superLikedPlaces];
                // Pelny route state - bez tego po loginie user ladowal na StartingLocationPicker
                // (step:3) zamiast od razu na widok generowania trasy.
                localStorage.setItem("trasa_guest_plan", JSON.stringify({
                  city,
                  date: date.toISOString(),
                  numDays,
                  startingLocation: startingLocation || undefined,
                  likedPlaceNames: allLiked.map(p => p.place_name),
                  skippedPlaceNames: skippedPlaces.map(p => p.place_name),
                  likedPlacesData: allLiked.map((p) => ({ place_name: p.place_name, category: p.category as string, description: p.description, latitude: p.latitude, longitude: p.longitude, opening_hours: p.opening_hours?.weekday_text ?? null })),
                  superLikedPlaceNames: superLikedPlaces.map(p => p.place_name),
                }));
                navigate("/auth?return=plan");
              }}
              onDismiss={() => setShowUpsell(false)}
            />
          )}
        </>
      );
    }

    return (
      <EmptyState
        likedPlaces={likedPlaces}
        matchedRoutes={matchedRoutes}
        onProceed={handleProceed}
        onPickRoute={handlePickRoute}
        loadingExamples={loadingExamples}
        hasCategoryFilter={hasCategoryFilter}
        hasSwipedAny={history.length > 0}
        onResetToday={handleResetToday}
        resetting={resetting}
        onGoToMatches={onSwitchToMatches}
        reviewedTitle={reviewedTitle}
      />
    );
  }

  return (
    // exploreMode (HomeSwipe) renderuje sie WEWNATRZ AppLayout ktore ma fixed BottomNav.
    // PlanWizard (/plan) ma TopBar + progress row + bottom CTA "Zaplanuj trase".
    // Karta nizej uzywa explicit dvh-based maxHeight (NIE flex-1 + 100% % wrappera),
    // bo iOS WebView w standalone Capacitor czasem reportuje % od parent nieprawidlowo
    // gdy parent ma flex-1 min-h-0 - tu uzywamy dvh jako stabilny base i odejmujemy
    // env(safe-area) + chrome height jawnie.
    <div className="flex flex-col flex-1 min-h-0 relative">

      {/* Bingo banner */}
      {showBanner && (
        <MatchModal
          likedPlaces={likedPlaces}
          onConfirm={handleProceed}
          onDismiss={handleBannerDismiss}
        />
      )}

      {/* Guest upsell */}
      {showUpsell && (
        <GuestUpsellModal
          onSignUp={() => {
            const allLiked = [...likedPlaces, ...superLikedPlaces];
            localStorage.setItem("trasa_guest_plan", JSON.stringify({
              city,
              date: date.toISOString(),
              likedPlaceNames: allLiked.map(p => p.place_name),
            }));
            navigate("/auth?return=plan");
          }}
          onDismiss={() => setShowUpsell(false)}
        />
      )}

      {/* Progress. Hidden in exploreMode (HomeSwipe) - miasto juz jest w chip filter,
          a wybranych count nie ma sensu bez bottom CTA. */}
      <div className={cn("flex items-center justify-between px-5 pt-1 pb-3 shrink-0", exploreMode && "hidden")}>
        {onEditDate ? (
          <button onClick={onEditDate} className="text-xs text-muted-foreground inline-flex items-center gap-1 active:opacity-60" aria-label={t("edit_date_aria")}>
            {city} · {format(date, "d MMM")}
            <CalendarDays className="h-3 w-3 opacity-60" />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">{city} · {format(date, "d MMM")}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {(likedPlaces.length + superLikedPlaces.length) > 0 ? t("selected_count", { count: likedPlaces.length + superLikedPlaces.length }) : ""}
        </span>
      </div>

      {/* Card stack / Add custom place panel. STRICT 9:16 + top-aligned (items-start).
          Karta przylega do gornej krawedzi dostepnej przestrzeni (po malej pt) zamiast
          byc centrowana - dzieki temu nie ma duzego pustego paska nad karta. Empty
          space ladnie chowa sie pod BottomNav / CTA.
          width = min(maxAbsolute, 100vw - margins, calc fromHeight 9:16):
          Chrome subtraction (w dvh calc dla wysokosci, z ktorej liczone jest width):
          - exploreMode: env(top) + 70 (pt-safe+sticky header) + 94 (BottomNav) + 32 gap
            = 100dvh - env(top) - 196
          - solo: env(top) + 64 TopBar + env(bottom) + 72 CTA + 32 gap
            = 100dvh - env(top) - env(bottom) - 168 */}
      {showAddPlace ? (
        // AddCustomPlacePanel renderuje sie OBOK aspect-9:16 (nie wewnatrz) -
        // full width z paddingiem, dla bardziej oczywistego widoku dodawania miejsca.
        <div className="flex-1 min-h-0 w-full">
          <AddCustomPlacePanel
            city={city}
            onCancel={() => setShowAddPlace(false)}
            onAdd={(added) => {
              const customPlace: MockPlace = {
                id: `custom-${Date.now()}`,
                place_name: added.place_name,
                category: added.category,
                city,
                address: added.address,
                latitude: added.latitude,
                longitude: added.longitude,
                rating: 0,
                photo_url: added.photo_url,
                vibe_tags: [],
                description: added.description,
              };
              setLikedPlaces((prev) => [...prev, customPlace]);
              setShowAddPlace(false);
            }}
          />
        </div>
      ) : isSearching ? (
        // Search mode: list view zamiast 9:16 karty. Klawiatura zostaje na ekranie,
        // user widzi liste wynikow i tapuje zeby otworzyc detail (PlaceSwiperDetail).
        // Tam jest standardowy Dodaj/Odrzuc CTA - flow nieprzerwany.
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
          {displayQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">{t("search_no_results", { query: searchQuery.trim() })}</p>
              {onSuggestPlace && (
                <button
                  onClick={onSuggestPlace}
                  className="text-sm font-semibold text-orange-600 underline underline-offset-2"
                >
                  {t("suggest_add_place")}
                </button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {displayQueue.slice(0, 50).map((place) => (
                <li key={place.id}>
                  <button
                    onClick={() => handleTap(place)}
                    className="w-full flex items-center gap-3 p-2 rounded-2xl bg-secondary border border-border/40 shadow-sm active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-[#fcede3] shrink-0 flex items-center justify-center">
                      {place.photo_url ? (
                        <img src={place.photo_url} alt={place.place_name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <CategoryIcon category={place.category} className="w-2/5 max-w-[56px] opacity-90" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground line-clamp-1">{place.place_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {t(`categories.${place.category}`, { defaultValue: CATEGORY_LABELS[place.category] ?? place.category })}{place.address ? ` · ${place.address}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : exploreMode ? (
        // Eksploracja pionowa (wg Figmy): scroll w dol = nastepna karta (snap per karta).
        // Karta wypelnia caly ekran, akcje po prawej (kciuk). "+" zapisuje bez zdejmowania z
        // kolejki. isTop = tylko widoczna karta (fetch Google/tagi + video odpalamy dla niej).
        <>
        <div
          ref={scrollWrapRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const h = el.clientHeight || 1;
            const idx = Math.round(el.scrollTop / h);
            const p = displayQueue[idx];
            if (p && p.id !== activeCardId) setActiveCardId(p.id);
            if (el.scrollTop > 24 && !hasScrolled) setHasScrolled(true);
            // Infinite scroll: dociagaj kolejne karty gdy zblizamy sie do konca (2.5 ekranu).
            if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 2.5) {
              setExploreVisible((v) => (v < displayQueue.length ? Math.min(displayQueue.length, v + 12) : v));
            }
          }}
          className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory scrollbar-none overscroll-contain pt-3 scroll-pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
        >
          {displayQueue.slice(0, exploreVisible).map((place) => {
            // KAZDA karta troche nizsza (nastepna zawsze wystaje) - stala afordancja "scrolluj
            // dalej". BEZ wyszarzania peeka (za agresywne + stan gubil sie przy szybkim scrollu).
            // isActive dalej gatuje fetch Google/tagow tylko do widocznej karty (koszt).
            const isActive = activeCardId ? place.id === activeCardId : place.id === displayQueue[0]?.id;
            return (
            <div key={place.id} className="snap-start snap-always w-full flex flex-col px-4 mb-4 h-[calc(100dvh-150px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))]">
              <div className="relative flex-1 min-h-0 w-full">
                <SwipeCard
                  place={place}
                  city={city}
                  scrollMode
                  saved={savedIds.has(place.id) || isSavedInList(place.place_name)}
                  onLike={() => handleSaveInPlace(place, { openSheet: true })}
                  onSkip={() => {}}
                  onTap={() => handleTap(place)}
                  onUndo={handleUndo}
                  canUndo={history.length > 0}
                  onPhotoFetched={(id, url) => { photoUrlOverrides.current[id] = url; }}
                  isTop={isActive}
                  offset={0}
                  onEnableDistance={enableDistance}
                />
              </div>
            </div>
            );
          })}
        </div>
        {/* Puls "scroll w dol" - afordancja, znika po pierwszym przewinieciu.
            Centrowanie (-translate-x-1/2) MUSI byc na osobnym, zewnetrznym divie - animate-bounce
            nadpisuje transform elementu (translateY), co skasowaloby -translate-x-1/2 i przesunelo
            hint w prawo o pol szerokosci. Zewnetrzny centruje (nad guzikiem "+"), wewnetrzny skacze. */}
        {!hasScrolled && displayQueue.length > 1 && (
          <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="animate-bounce h-9 w-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center shadow-lg">
              <ChevronDown className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
        </>
      ) : (
        <div className={cn("flex-1 min-h-0 flex justify-center w-full", exploreMode ? "items-center" : "items-start pt-2")}>
        <div
          className="relative aspect-[9/16]"
          style={{
            // exploreMode (/plan "Przegladaj") NIE ma BottomNav (poza AppLayout) ani proceed CTA -
            // odejmujemy tylko header (~64px) + env(top)/env(bottom). Wczesniej odejmowalismy
            // tez 94px nieistniejacej nawigacji -> karta byla mala z duzym gapem na dole.
            width: exploreMode
              ? "min(460px, calc(100vw - 32px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 88px) * 9 / 16))"
              : "min(420px, calc(100vw - 48px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 242px) * 9 / 16))",
          }}
        >
          <>
            {(() => {
              const cardSlice = displayQueue.slice(0, 3);
              return cardSlice
                .slice()
                .reverse()
                .map((place, reversedIdx) => {
                  const offset = cardSlice.length - 1 - reversedIdx;
                  return (
                    <SwipeCard
                      key={place.id}
                      place={place}
                      city={city}
                      onLike={(photoUrl) => handleLike(photoUrl)}
                      onSkip={handleSkip}
                      onTap={() => handleTap(place)}
                      onUndo={handleUndo}
                      canUndo={history.length > 0}
                      onPhotoFetched={(id, url) => { photoUrlOverrides.current[id] = url; }}
                      isTop={offset === 0}
                      offset={offset}
                      onEnableDistance={enableDistance}
                    />
                  );
                });
            })()}
          </>
        </div>
        </div>
      )}


      {/* Proceed CTA. Ukryty calkowicie w exploreMode (HomeSwipe = wolna eksploracja).
          Polubione miejsca laduja w exploreLikes localStorage; uzytkownik moze stworzyc
          trase rece przez + -> Zaplanuj solo (dialog "Wykorzystac polubione z dzis?").
          W PlanWizard solo (onSwitchToMatches przekazane) CTA przelacza do tabki
          Dopasowania, NIE nawiguje od razu do /create - user wybiera tam ktore
          miejsca wezmie do trasy. Bez prop'a (legacy fallback) wywoluje handleProceed. */}
      {!exploreMode && (likedPlaces.length + superLikedPlaces.length > 0) && !showAddPlace && (
        <div className="px-4 pb-safe-4 pt-2 shrink-0 flex gap-2">
          <button
            onClick={() => { if (onSwitchToMatches) onSwitchToMatches(); else handleProceed(); }}
            className="flex-1 py-3 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            {onSwitchToMatches ? t("go_to_matches") : t((likedPlaces.length + superLikedPlaces.length) === 1 ? "cta_plan_route_one" : "cta_plan_route_many", { count: likedPlaces.length + superLikedPlaces.length })}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail sheet */}
      <PlaceSwiperDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        place={detailPlace}
        referenceDate={date.toISOString().slice(0, 10)}
        saved={detailPlace ? (savedIds.has(detailPlace.id) || isSavedInList(detailPlace.place_name)) : false}
        onLike={() => {
          // scrollMode (Eksploracja): "+"/Dodaj na wizytowce zapisuje BEZ zdejmowania z
          // kolejki (jak "+" na karcie). Klasyczny swipe: handleLike (dequeue).
          if (exploreMode) { if (detailPlace) handleSaveInPlace(detailPlace, { openSheet: true }); }
          else { handleLike(undefined, detailPlace ?? undefined); }
        }}
        onSkip={exploreMode ? undefined : () => { handleSkip(); }}
      />

      {/* Etap 2: "Miejsce zapisane!" - dodaj zapisane miejsce do wyjazdu (nowego/istniejacego) */}
      <SavePlaceSheet
        open={saveSheetOpen}
        onOpenChange={setSaveSheetOpen}
        place={saveSheetPlace}
        city={city}
        onFullyRemoved={() => {
          // Miejsce usuniete ze WSZYSTKICH wyjazdow -> zdejmij stan "zapisane" z karty
          // (bookmark) + usun z polubionych, zeby wizytowka nie pokazywala falszywego zapisu.
          if (saveSheetSwiperId) setSavedIds((prev) => { const n = new Set(prev); n.delete(saveSheetSwiperId); return n; });
          if (saveSheetPlace?.place_name) removeLikeFromCity(city, saveSheetPlace.place_name);
        }}
      />
    </div>
  );
};

export default PlaceSwiper;
