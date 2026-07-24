// Wspolny komponent wizytowki biznesowej. Renderuje rozne kombinacje sekcji
// zaleznie od mode:
//
// - mode='detail'  - Pelna premium wizytowka (PlaceSwiperDetail drawer, AppLikePreviewModal.detail).
//                    Wszystkie sekcje: hero galeria, kategorie, opis, hours, event,
//                    tagi, aktualnosci, menu/cennik, opinie, kontakt.
// - mode='card'    - Mini card 9:16 (BusinessCardPreview, AppLikePreviewModal.card).
//                    Cover + logo + nazwa + cat + rating + opis + tagi + event.
// - mode='preview' - Po-trasa drawer (PlaceDetailSheet).
//                    Photo + rating + hours + reviews + biz mini (event, gallery, kontakt).
// - mode='swipe'   - 9:16 swipe card (SwipeCard).
//                    Full bg image + overlay + minimal info (nazwa, cat, opis).
//
// Adaptery (premiumBusinessAdapters.ts) konwertuja kazde zrodlo (MockPlace, Pin,
// dashboard state) do unified PremiumBusinessData zanim trafi tutaj.

import { type ReactNode, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { MAIN_CATEGORIES, mainCategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { Star, Clock, ChevronRight, ChevronLeft, ChevronDown, X, Maximize2, Phone, Globe, FileText, Instagram, Facebook, MapPin } from "lucide-react";
import { parseISO, isValid, formatDistanceToNow, format, startOfMonth, addMonths } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import RouteMap from "@/components/RouteMap";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { instagramUrl, facebookUrl } from "@/lib/social";
import type {
  PremiumBusinessData,
  PremiumBusinessMode,
  OwnerOpeningHours,
  DayHours,
} from "./premiumBusiness.types";

// Social proof na wizytowce: osoby ktore dodaly lokal do swojej trasy (RPC get_place_route_avatars).
export interface RouteAvatars {
  total: number;
  avatars: Array<{ avatar_url: string; username?: string | null; first_name?: string | null }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Stars = ({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={cn(
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          n <= Math.round(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted-foreground/30"
        )}
      />
    ))}
  </div>
);

function getHexContrast(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#fff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000" : "#fff";
}

function dedupSubcategories(subs: string[] | undefined): string[] {
  if (!subs?.length) return [];
  const seen = new Set<string>();
  return subs.filter(s => {
    const k = s.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const validUrl = (url?: string | null): boolean =>
  !!url && (url.startsWith("http") || url.startsWith("/")) &&
  !url.includes("staticmap") && !url.includes("maps/api/staticmap");

// Menu moze byc obrazem albo PDF - PDF otwieramy w nowej karcie (nie da sie go pokazac w <img>).
const isPdfUrl = (u: string): boolean => u.split("?")[0].toLowerCase().endsWith(".pdf");

// ─── Opening hours helpers ────────────────────────────────────────────────────

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const todayKey = (): typeof DAY_ORDER[number] => {
  const idx = new Date().getDay();
  return DAY_ORDER[idx === 0 ? 6 : idx - 1];
};

const isBizOpenNow = (hours: OwnerOpeningHours): boolean => {
  const today = hours[todayKey()];
  if (!today || "closed" in today) return false;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hhmm >= today.open && hhmm <= today.close;
};

// ─── Fullscreen photo viewer ──────────────────────────────────────────────────

interface FullscreenPhotosProps {
  photos: string[];
  startIndex: number;
  onClose: () => void;
}

const MAX_ZOOM = 4;

const FullscreenPhotos = ({ photos, startIndex, onClose }: FullscreenPhotosProps) => {
  const { t } = useTranslation("wizytowka");
  const [idx, setIdx] = useState(Math.max(0, Math.min(startIndex, photos.length - 1)));
  // Zoom (pinch) + pan (przesuwanie gdy przybliżone). scale=1 => normalny widok (swipe nawiguje).
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  const scaleRef = useRef(1);
  scaleRef.current = zoom.scale;
  const [gesturing, setGesturing] = useState(false);
  // Stan gestu: pojedynczy tap/swipe, pinch (2 palce), pan (1 palec gdy scale>1).
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  // Reset zoomu przy zmianie zdjęcia (nowe zdjęcie = normalny widok).
  useEffect(() => { setZoom({ scale: 1, tx: 0, ty: 0 }); }, [idx]);

  if (photos.length === 0) return null;

  const goPrev = () => setIdx((n) => Math.max(0, n - 1));
  const goNext = () => setIdx((n) => Math.min(photos.length - 1, n + 1));

  const dist2 = (t0: React.Touch, t1: React.Touch) =>
    Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

  // Clamp pan tak, żeby przybliżony obraz nie odjechał całkiem poza ekran.
  const clampPan = (scale: number, tx: number, ty: number) => {
    const maxX = (window.innerWidth * (scale - 1)) / 2;
    const maxY = (window.innerHeight * (scale - 1)) / 2;
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: dist2(e.touches[0], e.touches[1]), scale: scaleRef.current };
      startPos.current = null;
      panLast.current = null;
    } else if (e.touches.length === 1) {
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panLast.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pinch: 2 palce -> zmiana skali.
    if (e.touches.length === 2 && pinchStart.current) {
      const d = dist2(e.touches[0], e.touches[1]);
      const next = Math.max(1, Math.min(MAX_ZOOM, pinchStart.current.scale * (d / pinchStart.current.dist)));
      setGesturing(true);
      setZoom((z) => {
        const p = clampPan(next, z.tx, z.ty);
        return { scale: next, ...p };
      });
      return;
    }
    // Pan: 1 palec gdy przybliżone -> przesuwanie obrazu.
    if (e.touches.length === 1 && scaleRef.current > 1 && panLast.current) {
      const dx = e.touches[0].clientX - panLast.current.x;
      const dy = e.touches[0].clientY - panLast.current.y;
      panLast.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setGesturing(true);
      setZoom((z) => {
        const p = clampPan(z.scale, z.tx + dx, z.ty + dy);
        return { ...z, ...p };
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const wasPinch = pinchStart.current !== null;
    pinchStart.current = null;
    panLast.current = null;
    setGesturing(false);

    // Pinch skończony -> gdy zeszliśmy ~do 1, wyzeruj zoom całkiem.
    if (wasPinch) {
      if (scaleRef.current <= 1.02) setZoom({ scale: 1, tx: 0, ty: 0 });
      return;
    }

    const sp = startPos.current;
    startPos.current = null;
    if (!sp) return;
    const dx = e.changedTouches[0].clientX - sp.x;
    const dy = e.changedTouches[0].clientY - sp.y;
    const tap = Math.abs(dx) < 10 && Math.abs(dy) < 10;

    // Gdy przybliżone: tap nie zamyka; double-tap wyzerowuje zoom. Swipe = pan (już obsłużony).
    if (scaleRef.current > 1) {
      if (tap) {
        const now = Date.now();
        if (now - lastTap.current < 300) { setZoom({ scale: 1, tx: 0, ty: 0 }); lastTap.current = 0; }
        else lastTap.current = now;
      }
      return;
    }

    // Normalny widok (scale=1): swipe nawiguje, double-tap przybliża, tap zamyka.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && photos.length > 1) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }
    if (tap) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setZoom({ scale: 2.5, tx: 0, ty: 0 });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
        // Odczekaj na ewentualny drugi tap - inaczej double-tap-zoom zamykałby viewer.
        window.setTimeout(() => {
          if (lastTap.current === now && scaleRef.current <= 1.01) onClose();
        }, 280);
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none touch-none overflow-hidden"
      style={{ pointerEvents: "auto" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => { if (scaleRef.current <= 1.01) onClose(); }}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 z-[210] h-11 w-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center active:bg-black/80 transition-colors shadow-lg cursor-pointer"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        aria-label={t("close")}
      >
        <X className="h-5 w-5 text-white" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={idx === 0}
            className="absolute left-3 z-[210] h-12 w-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center active:bg-black/80 disabled:opacity-30"
            aria-label={t("prev_photo")}
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={idx === photos.length - 1}
            className="absolute right-3 z-[210] h-12 w-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center active:bg-black/80 disabled:opacity-30"
            aria-label={t("next_photo")}
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}
      <img
        src={photos[idx]}
        alt=""
        draggable={false}
        className="max-w-full max-h-full object-contain pointer-events-none"
        style={{
          transform: `translate3d(${zoom.tx}px, ${zoom.ty}px, 0) scale(${zoom.scale})`,
          transition: gesturing ? "none" : "transform 0.2s ease-out",
          willChange: "transform",
        }}
      />
      {photos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40")}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};

// ─── Hero photo carousel (4:3) ────────────────────────────────────────────────

interface HeroPhotoCarouselProps {
  photos: string[];
  placeName: string;
  onExpand: (idx: number) => void;
  onClose?: () => void;
  loading?: boolean;
  topLeftSlot?: ReactNode; // chip dystansu na gorze hero (obok X)
  bottomLeftSlot?: ReactNode; // pill promo na dole hero (wg Figmy)
}

function HeroPhotoCarousel({ photos, placeName, onExpand, onClose, loading, topLeftSlot, bottomLeftSlot }: HeroPhotoCarouselProps) {
  const { t } = useTranslation("wizytowka");
  const [activeIdx, setActiveIdx] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const hasPhoto = photos.length > 0;

  return (
    <div
      className="relative shrink-0 bg-muted overflow-hidden w-full aspect-[4/3] rounded-t-3xl"
      onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (swipeStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - swipeStartX.current;
        swipeStartX.current = null;
        if (Math.abs(dx) > 40 && photos.length > 1) {
          if (dx < 0) setActiveIdx(Math.min(photos.length - 1, activeIdx + 1));
          else setActiveIdx(Math.max(0, activeIdx - 1));
        }
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-center z-30 pointer-events-none">
        <div className="w-10 h-[5px] rounded-full bg-white/60" />
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-40 h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60"
          aria-label={t("close")}
        >
          <X className="h-4 w-4 text-white" />
        </button>
      )}
      {topLeftSlot && (
        <div className="absolute top-3 left-3 z-40 flex items-center gap-2">{topLeftSlot}</div>
      )}
      {bottomLeftSlot && (
        <div className="absolute bottom-3 left-3 z-40 max-w-[72%]">{bottomLeftSlot}</div>
      )}
      {hasPhoto ? (
        <>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute inset-0 w-full h-full"
            aria-label={t("expand_photo")}
          >
            <img
              src={photos[activeIdx]}
              alt={placeName}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // Gdy zdjecie sie nie zdekoduje (np. webp err=-50 na iOS) - fallback zamiast
                // przezroczystego/pustego kadru. Guard przez data-fallback chroni przed petla.
                const el = e.currentTarget;
                if (el.dataset.fallback) return;
                el.dataset.fallback = "1";
                el.src = getRandomPinPlaceholder(placeName + activeIdx);
              }}
            />
          </button>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute bottom-3 right-3 z-30 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60"
            aria-label={t("fullscreen")}
          >
            <Maximize2 className="h-3.5 w-3.5 text-white" />
          </button>
          {photos.length > 1 && (
            <>
              {/* Tap-zona: CALA lewa polowa zdjecia = poprzednie (duzy obszar kliknicia). */}
              {activeIdx > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, activeIdx - 1)); }}
                  className="absolute left-0 top-0 bottom-0 w-1/2 z-20 flex items-center justify-start pl-3"
                  aria-label={t("prev")}
                >
                  <span className="h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow active:scale-90">
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                  </span>
                </button>
              )}
              {/* Tap-zona: CALA prawa polowa zdjecia = nastepne. */}
              {activeIdx < photos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(photos.length - 1, activeIdx + 1)); }}
                  className="absolute right-0 top-0 bottom-0 w-1/2 z-20 flex items-center justify-end pr-3"
                  aria-label={t("next")}
                >
                  <span className="h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow active:scale-90">
                    <ChevronRight className="h-5 w-5 text-foreground" />
                  </span>
                </button>
              )}
            </>
          )}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-none">
              {photos.map((_, i) => (
                <div key={i} className={cn("h-1.5 rounded-full transition-all", i === activeIdx ? "w-4 bg-white" : "w-1.5 bg-white/60")} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-3">
          {loading && (
            <p className="text-xs text-muted-foreground/50">{t("loading_photos")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

interface SectionProps {
  data: PremiumBusinessData;
}

function CategoriesSection({ data }: SectionProps) {
  const mainLabel = data.mainCategoryId
    ? mainCategoryLabel(data.mainCategoryId)
    : null;
  // Kategoria dodatkowa (secondary) - druga top-level, gdy lokal laczy dwa profile.
  const secondaryLabel = data.secondaryCategoryId && data.secondaryCategoryId !== data.mainCategoryId
    ? mainCategoryLabel(data.secondaryCategoryId)
    : null;
  const subs = dedupSubcategories(data.subcategories);
  if (!mainLabel && !secondaryLabel && subs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {mainLabel && (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 border border-orange-100 text-orange-700">
          {mainLabel}
        </span>
      )}
      {secondaryLabel && (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 border border-orange-100 text-orange-700">
          {secondaryLabel}
        </span>
      )}
      {subs.map((sub) => (
        <span key={sub} className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/40">
          {sub}
        </span>
      ))}
    </div>
  );
}

// expandable => ocena klikalna (gwiazdka/liczba) rozwija recenzje Google (progressive
// disclosure - domyslnie schowane, zeby nie bylo stalej sciany tekstu). Afordancja: "Opinie ⌄".
function RatingSection({ data, expandable, expanded, onToggle }: SectionProps & { expandable?: boolean; expanded?: boolean; onToggle?: () => void }) {
  const { t } = useTranslation("wizytowka");
  if (!data.rating) return null;
  const inner = (
    <>
      <Stars rating={data.rating} />
      <span className="text-sm font-bold">{data.rating}</span>
      {data.ratingCount !== undefined && data.ratingCount > 0 && (
        <span className="text-sm text-muted-foreground">({data.ratingCount.toLocaleString("pl")})</span>
      )}
    </>
  );
  if (expandable) {
    return (
      <button onClick={onToggle} className="flex items-center gap-1.5 active:opacity-70 transition-opacity" aria-expanded={expanded}>
        {inner}
        <span className="flex items-center gap-0.5 text-xs font-semibold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full ml-1">
          {t("reviews_toggle")}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </span>
      </button>
    );
  }
  return <div className="flex items-center gap-1.5">{inner}</div>;
}

function AddressSection({ data }: SectionProps) {
  // Chip z miastem usuniety - user wybiera miasto przy planowaniu, wiec wie ktorego dotyczy miejsce.
  const shortAddress = data.address?.split(",").slice(0, 2).join(",").trim();
  if (!shortAddress) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">{shortAddress}</span>
    </div>
  );
}

function DescriptionSection({ data, lineClamp }: SectionProps & { lineClamp?: number }) {
  if (!data.description) return null;
  return (
    <p
      className="text-sm text-foreground/85 leading-relaxed"
      style={lineClamp ? { display: "-webkit-box", WebkitLineClamp: lineClamp, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}
    >
      {data.description}
    </p>
  );
}

function EventBannerSection({ data }: SectionProps) {
  if (!data.eventTitle) return null;
  // Badge promocji ZAWSZE pomaranczowy - nie personalizowany przez biznes.
  return (
    <div className="rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] px-4 py-3 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-orange-500/20 text-center leading-tight">
      {data.eventTitle}
    </div>
  );
}

// Kalendarium zaplanowanych wydarzen (kolejka business_events). Nawigacja miesiacami (chevrony +
// swipe w bok, jak w kalendarzu) - pokazuje WSZYSTKIE wydarzenia danego miesiaca, nie tylko jedno.
// Neutralny "paper" kafelek (bg-secondary). Pomaranczowy zarezerwowany dla pilla promo na gorze
// (EventBannerSection). Na dole raz awatary osob ktore dodaly lokal do trasy (social proof / FOMO).
function EventsSection({ data, referenceDate, routeAvatars }: SectionProps & { referenceDate?: string; routeAvatars?: RouteAvatars | null }) {
  const { t, i18n } = useTranslation("wizytowka");
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  const ref = referenceDate ?? new Date().toISOString().slice(0, 10);
  const events = (data.events ?? []).filter((e) => e && !e.is_draft && e.starts_at);

  // Miesiace z wydarzeniami (YYYY-MM) posortowane - zakres nawigacji [pierwszy .. ostatni].
  const monthKeys = [...new Set(events.map((e) => String(e.starts_at).slice(0, 7)))].sort();
  // Domyslny miesiac = pierwszy z wydarzeniem >= data odniesienia (albo ostatni gdy wszystkie w przeszlosci).
  const defaultKey = monthKeys.find((m) => m >= ref.slice(0, 7)) ?? monthKeys[monthKeys.length - 1] ?? ref.slice(0, 7);
  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(parseISO(`${defaultKey}-01`)));
  // Domyslnie zwiniete - pokazujemy tylko najblizsze wydarzenie; pill "pokaz wszystkie" rozwija.
  const [expanded, setExpanded] = useState(false);
  // Reset na wybrany miesiac gdy dane sie doczytaja (np. enrich profilu biznesu po otwarciu).
  useEffect(() => { setMonthDate(startOfMonth(parseISO(`${defaultKey}-01`))); setExpanded(false); }, [defaultKey]);
  const swipeX = useRef<number | null>(null);

  if (events.length === 0) return null;

  const selKey = format(monthDate, "yyyy-MM");
  const canPrev = selKey > monthKeys[0];
  const canNext = selKey < monthKeys[monthKeys.length - 1];
  const go = (delta: number) => {
    if ((delta < 0 && !canPrev) || (delta > 0 && !canNext)) return;
    setMonthDate((d) => startOfMonth(addMonths(d, delta)));
    setExpanded(false); // nowy miesiac zaczyna zwiniety (najblizsze wydarzenie)
  };

  const monthEvents = events
    .filter((e) => String(e.starts_at).slice(0, 7) === selKey)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  // Zwiniete = tylko najblizsze wydarzenie (pierwsze jeszcze nie zakonczone, albo pierwsze gdy wszystkie przeszle).
  const nearestIdx = Math.max(0, monthEvents.findIndex((e) => String(e.ends_at ?? e.starts_at) >= ref));
  const visibleEvents = expanded ? monthEvents : monthEvents.slice(nearestIdx, nearestIdx + 1);

  const fmtDay = (d: string) => {
    const dt = parseISO(d);
    return isValid(dt) ? format(dt, "d MMM", { locale: dateLocale() }) : d;
  };
  const fmtTime = (v?: string | null) => (v ? String(v).slice(0, 5) : null);

  const shownAvatars = (routeAvatars?.avatars ?? []).slice(0, 4);
  const totalAdded = routeAvatars?.total ?? 0;
  const remainder = totalAdded - shownAvatars.length;

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-black tracking-tight">{t("events_title")}</h3>

      {/* Nawigator miesiaca (‹ LIPIEC 2026 ›) wysrodkowany + pill "pokaz wszystkie" w prawej
          strefie (flex, bez absolute) - zeby nie wchodzil na nazwe miesiaca. */}
      <div className="flex items-center gap-1 select-none">
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          disabled={!canPrev}
          onClick={(ev) => { ev.stopPropagation(); go(-1); }}
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full active:bg-muted disabled:opacity-25"
          aria-label={t("events_prev_month")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="shrink-0 text-center text-sm font-black uppercase tracking-wide whitespace-nowrap">
          {format(monthDate, "LLLL yyyy", { locale: dateLocale() })}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={(ev) => { ev.stopPropagation(); go(1); }}
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full active:bg-muted disabled:opacity-25"
          aria-label={t("events_next_month")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 flex justify-end">
          {monthEvents.length > 1 && (
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); setExpanded((v) => !v); }}
              className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary text-foreground active:scale-95 transition-transform whitespace-nowrap"
            >
              {expanded ? t("events_collapse") : t("events_show_all", { count: monthEvents.length })}
            </button>
          )}
        </div>
      </div>

      {/* Wydarzenia w wybranym miesiacu (swipe w bok = zmiana miesiaca) */}
      <div
        className="space-y-2"
        onTouchStart={(e) => { swipeX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (swipeX.current === null) return;
          const dx = e.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {monthEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 rounded-3xl bg-secondary">{t("events_month_empty")}</p>
        ) : (
          visibleEvents.map((e, i) => {
            const st = fmtTime(e.start_time);
            const et = fmtTime(e.end_time);
            const timeLabel = st ? (et ? `${st} - ${et}` : st) : null;
            const dateRange =
              e.ends_at && e.ends_at !== e.starts_at ? `${fmtDay(e.starts_at)} - ${fmtDay(e.ends_at)}` : fmtDay(e.starts_at);
            return (
              <div key={i} className="rounded-3xl bg-secondary text-secondary-foreground p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0 px-3 py-1 rounded-full bg-background text-foreground text-xs font-bold whitespace-nowrap">{dateRange}</span>
                  {timeLabel && (
                    <span className="flex items-center gap-1 text-sm font-bold whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {timeLabel}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-lg font-black leading-tight break-words">{isEn && e.title_en ? e.title_en : e.title}</p>
                {e.description && <p className="mt-1 text-sm text-muted-foreground leading-snug break-words">{e.description}</p>}
              </div>
            );
          })
        )}
      </div>

      {/* Social proof (place-level): awatary osob z tym lokalem w trasie (max 4 + "+N") */}
      {totalAdded > 0 && (
        <div className="flex items-center gap-2.5 pt-1">
          <div className="flex -space-x-2">
            {shownAvatars.map((a, i) => (
              <img
                key={i}
                src={avatarSrc(a.avatar_url)}
                alt=""
                draggable={false}
                className="h-7 w-7 rounded-full border-2 border-[#FEFEFE] object-cover"
              />
            ))}
            {remainder > 0 && (
              <span className="h-7 w-7 rounded-full border-2 border-[#FEFEFE] bg-secondary text-foreground flex items-center justify-center text-[11px] font-bold">
                +{remainder}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-muted-foreground leading-snug">
            {t("events_added_to_route", { count: totalAdded })}
          </span>
        </div>
      )}
    </div>
  );
}

function TagsSection({ data, max }: SectionProps & { max?: number }) {
  if (!data.tags?.length) return null;
  const visible = max ? data.tags.slice(0, max) : data.tags;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {visible.map((tag) => (
        <span key={tag} className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          {tag}
        </span>
      ))}
    </div>
  );
}

function OpeningHoursSection({ data }: SectionProps) {
  const { t } = useTranslation("wizytowka");
  const [expanded, setExpanded] = useState(false);
  const hasBiz = data.ownerOpeningHours && Object.keys(data.ownerOpeningHours).length > 0;
  const hasGoogle = !hasBiz && data.googleWeekdayText && data.googleWeekdayText.length > 0;
  if (!hasBiz && !hasGoogle) return null;

  const closedLabel = t("closed");
  const openNow = hasBiz ? isBizOpenNow(data.ownerOpeningHours!) : !!data.googleOpenNow;
  const todayK = todayKey();

  let todayLine = "";
  let allLines: { label: string; value: string; isToday: boolean }[] = [];

  if (hasBiz) {
    allLines = DAY_ORDER.map((k) => {
      const h = (data.ownerOpeningHours as OwnerOpeningHours)[k];
      const value = !h ? "-" : "closed" in h ? closedLabel : `${(h as { open: string; close: string }).open} - ${(h as { open: string; close: string }).close}`;
      return { label: t(`days.${k}`), value, isToday: k === todayK };
    });
    const today = allLines.find((l) => l.isToday);
    todayLine = today ? `${today.label.toLowerCase()}: ${today.value}` : "";
  } else if (hasGoogle) {
    allLines = data.googleWeekdayText!.slice(0, 7).map((line, i) => {
      const k = DAY_ORDER[i] ?? DAY_ORDER[0];
      const parts = line.split(":");
      parts.shift();
      const value = parts.join(":").trim() || line;
      return { label: t(`days.${k}`), value, isToday: k === todayK };
    });
    const today = allLines.find((l) => l.isToday);
    todayLine = today ? `${today.label.toLowerCase()}: ${today.value}` : "";
  }

  return (
    <div className="rounded-2xl bg-secondary overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
        className="w-full flex items-center justify-between px-4 py-3 gap-3 active:bg-muted/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0", openNow ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500")}>
            {openNow ? t("open_now") : t("closed")}
          </span>
          {todayLine && <span className="text-xs text-muted-foreground truncate">· {todayLine}</span>}
        </div>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-90")} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-1 border-t border-border/30">
          {allLines.map((line, i) => (
            <div key={i} className={cn("flex justify-between py-1 text-xs", line.isToday && "font-semibold text-foreground")}>
              <span className={line.isToday ? "text-foreground" : "text-muted-foreground"}>
                {line.label}{line.isToday && ` (${t("today")})`}
              </span>
              <span className={line.value === closedLabel || line.value === "-" ? "text-muted-foreground" : "text-foreground"}>
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostsSection({ data, onPhotoExpand }: SectionProps & { onPhotoExpand: (photos: string[], idx: number) => void }) {
  const { t } = useTranslation("wizytowka");
  const posts = data.posts ?? [];
  if (posts.length === 0) return null;
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-black tracking-tight">{t("news_title")}</h3>
      <div className="space-y-3">
        {posts.map((post) => {
          const date = parseISO(post.created_at);
          const dateLabel = isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: dateLocale() }) : "";
          const photos = post.photo_urls.filter(validUrl);
          const gridPhotos = photos.slice(0, 2);
          return (
            <div key={post.id} className="rounded-2xl border border-border/40 bg-card p-3 space-y-2">
              {post.description && (
                <p className="text-sm leading-relaxed text-foreground">{post.description}</p>
              )}
              {gridPhotos.length > 0 && (
                <div className={cn("grid gap-1.5", gridPhotos.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                  {gridPhotos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => onPhotoExpand(photos, idx)}
                      className="block w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted active:opacity-95"
                      aria-label={t("expand_photo")}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              {dateLabel && <p className="text-[11px] text-muted-foreground">{dateLabel}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Kafelek menu-PDF z podgladem pierwszej strony (renderowany client-side przy wyswietlaniu).
// Fallback do ikony+"Otworz PDF" gdy render sie nie powiedzie (np. pdf.js na starszym iOS).
function PdfMenuTile({ url, label, className }: { url: string; label: string; className: string }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/lib/pdfToImages")
      .then(({ renderPdfFirstPage }) => renderPdfFirstPage(url))
      .then((d) => { if (!cancelled) setImg(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn(className, "relative flex flex-col items-center justify-center gap-2")}>
      {img ? (
        <>
          <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
            <FileText className="h-3 w-3" /> PDF
          </span>
        </>
      ) : (
        <>
          <FileText className="h-9 w-9 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground px-2 text-center">{label}</span>
        </>
      )}
    </a>
  );
}

function MenuSection({ data, onPhotoExpand }: SectionProps & { onPhotoExpand: (photos: string[], idx: number) => void }) {
  const { t } = useTranslation("wizytowka");
  const menuImages = data.menuImageUrls ?? [];
  if (menuImages.length === 0) return null;
  const sectionLabel = data.mainCategoryId === "food" ? t("menu") : t("price_list");
  // PDF nie da sie pokazac w fullscreen viewerze (<img>) - do niego trafiaja tylko obrazy.
  const imageOnly = menuImages.filter((u) => !isPdfUrl(u));
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-black tracking-tight">{sectionLabel}</h3>
      <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 pb-1">
        {menuImages.map((url, idx) => {
          if (isPdfUrl(url)) {
            return (
              <PdfMenuTile
                key={idx}
                url={url}
                label={t("open_pdf", { label: sectionLabel })}
                className="shrink-0 w-[78%] aspect-[4/3] rounded-2xl bg-muted snap-center overflow-hidden border border-border/40 active:opacity-95"
              />
            );
          }
          return (
            <button
              key={idx}
              onClick={() => onPhotoExpand(imageOnly, imageOnly.indexOf(url))}
              className="shrink-0 w-[78%] aspect-[4/3] rounded-2xl overflow-hidden bg-muted snap-center active:opacity-95"
              aria-label={t("expand_labeled", { label: sectionLabel.toLowerCase(), index: idx + 1 })}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MapSection({ data, startingLocation }: SectionProps & { startingLocation?: { name: string; latitude: number; longitude: number } }) {
  const { t } = useTranslation("wizytowka");
  if (!data.latitude || !data.longitude) return null;
  return (
    <div className="space-y-3 pt-2">
      {/* Naglowek "Na mapie" + link "Zobacz w Google Maps" (wg Figmy) */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-black tracking-tight">{t("map_title")}</h3>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} ${data.address ?? ""}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-secondary-foreground px-3 py-1.5 text-xs font-semibold active:scale-95 transition-transform shrink-0"
        >
          <MapPin className="h-3.5 w-3.5" /> {t("open_in_google_maps", "Zobacz w Google Maps")}
        </a>
      </div>
      <RouteMap
        pins={[{ latitude: data.latitude, longitude: data.longitude, place_name: data.name, address: data.address }]}
        startingLocation={startingLocation}
        singlePlace
        className="h-44 rounded-2xl border-2 border-primary/25"
      />
    </div>
  );
}

function ReviewsSection({ data }: SectionProps) {
  const { t } = useTranslation("wizytowka");
  const reviews = data.reviews ?? [];
  if (reviews.length === 0) return null;
  return (
    <div className="pt-2">
      {/* Google attribution wymagane przez ToS gdy pokazujemy Google reviews. */}
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-lg font-black tracking-tight">{t("reviews_title")}</h3>
        <span className="text-[11px] text-muted-foreground shrink-0">powered by Google</span>
      </div>
      <div className="space-y-4">
        {reviews.slice(0, 3).map((review, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <img
                src={review.profile_photo_url}
                alt={review.author_name}
                className="h-8 w-8 rounded-full object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{review.author_name}</p>
                <div className="flex items-center gap-1.5">
                  <Stars rating={review.rating} size="sm" />
                  <span className="text-xs text-muted-foreground">· {review.relative_time_description}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 pl-10">{review.text}</p>
          </div>
        ))}
      </div>
      {(() => {
        // URL strategy:
        // - Mamy prawidłowy place_id -> direct link do reviews tab w Google Maps
        // - Brak place_id -> search query z nazwą + adresem (zawsze dziala)
        // Wczesniej uzywany link 'maps/place/?q=place_id:XXX' bral randomowe location
        // gdy place_id byl pusty albo stale - teraz mamy fallback.
        const placeIdValid = data.googlePlaceId && data.googlePlaceId.length > 10;
        const searchQuery = [data.name, data.address, data.city].filter(Boolean).join(" ");
        const url = placeIdValid
          ? `https://search.google.com/local/reviews?placeid=${data.googlePlaceId}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-border text-sm text-foreground"
          >
            <span className="font-black text-[#4285F4]">G</span>
            {t("more_reviews_google")}
          </a>
        );
      })()}
    </div>
  );
}

// Miniaturki social media (Instagram / Facebook) - bezposrednio pod nazwa lokalu na wizytowce.
function SocialLinksRow({ data }: SectionProps) {
  const ig = instagramUrl(data.instagram);
  const fb = facebookUrl(data.facebook);
  if (!ig && !fb) return null;
  const btn = "h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-foreground active:scale-90 transition-transform";
  return (
    <div className="flex items-center gap-2">
      {ig && (
        <a href={ig} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={btn} aria-label="Instagram">
          <Instagram className="h-4 w-4" />
        </a>
      )}
      {fb && (
        <a href={fb} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={btn} aria-label="Facebook">
          <Facebook className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function ContactButtonsSection({ data }: SectionProps) {
  const { t } = useTranslation("wizytowka");
  const ig = instagramUrl(data.instagram);
  const fb = facebookUrl(data.facebook);
  if (!data.phone && !data.website && !ig && !fb) return null;
  const iconBtn = "flex items-center justify-center py-2.5 px-3 rounded-2xl border border-border/60 bg-card text-foreground active:scale-[0.97] transition-transform";
  return (
    <div className="flex gap-2">
      {data.phone && (
        <a
          href={`tel:${data.phone}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-border/60 bg-card text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
        >
          <Phone className="h-4 w-4" />
          {t("call")}
        </a>
      )}
      {data.website && (
        <a
          href={data.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-border/60 bg-card text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
        >
          <Globe className="h-4 w-4" />
          {t("website")}
        </a>
      )}
      {ig && (
        <a href={ig} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Instagram">
          <Instagram className="h-4 w-4" />
        </a>
      )}
      {fb && (
        <a href={fb} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Facebook">
          <Facebook className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

// Hours warning badge (z safeguard plan-route - description '⚠️ Sprawdz godziny otwarcia')
function HoursWarningBadge({ data }: SectionProps) {
  if (!data.description?.startsWith("⚠️")) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
      <span className="text-[11px] text-amber-800 leading-snug">{data.description}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PremiumBusinessCardProps {
  data: PremiumBusinessData;
  mode: PremiumBusinessMode;
  className?: string;
  // Optional override per section (rare - default is mode-based)
  hideEventBanner?: boolean;
  hideMenu?: boolean;
  hideReviews?: boolean;
  hideHours?: boolean;
  hidePosts?: boolean;
  hideContact?: boolean;
  // Slots - call site dodaje custom rendery (header z close button, footer z CTA Like/Skip)
  footer?: ReactNode;
  header?: ReactNode;
  // mode='detail' tylko - photos do hero carousel (z place.photo_url + galleryPhotos + Google fetched)
  detailPhotos?: string[];
  detailLoading?: boolean;
  onClose?: () => void;
  // mode='swipe' tylko - cover image jako tlo
  swipeCoverImage?: string;
  // Punkt startowy (GPS / lokalizacja startu) - marker na mapie "Na mapie" do oszacowania dystansu
  startingLocation?: { name: string; latitude: number; longitude: number };
  // Data wyjazdu (YYYY-MM-DD) - agenda wydarzen (EventsSection) pokazuje najblizsze TEJ dacie. Domyslnie dzis.
  referenceDate?: string;
}

const PremiumBusinessCard = ({
  data,
  mode,
  className,
  hideEventBanner,
  hideMenu,
  hideReviews,
  hideHours,
  hidePosts,
  hideContact,
  footer,
  header,
  detailPhotos = [],
  detailLoading = false,
  onClose,
  swipeCoverImage,
  startingLocation,
  referenceDate,
}: PremiumBusinessCardProps) => {
  const { t } = useTranslation("wizytowka");
  const [fullscreen, setFullscreen] = useState<{ photos: string[]; idx: number } | null>(null);
  // Recenzje za tapnieciem w ocene (progressive disclosure). Gdy hideReviews=true a sa
  // recenzje, ocena staje sie klikalna i rozwija "Opinie".
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const hasReviews = (data.reviews?.length ?? 0) > 0;

  // Awatary osob z tym lokalem w trasie - tylko na pelnej wizytowce (detail). Best-effort:
  // brak danych / blad = po prostu nie pokazujemy social proof. data.id = places.id (UUID).
  const [routeAvatars, setRouteAvatars] = useState<RouteAvatars | null>(null);
  useEffect(() => {
    if (mode !== "detail" || !data.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await (supabase as any).rpc("get_place_route_avatars", { p_place_id: data.id });
        if (!cancelled && res) setRouteAvatars(res as RouteAvatars);
      } catch {
        /* social proof best-effort - brak awatarow nie blokuje wizytowki */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, data.id]);

  const handleExpand = (photos: string[], idx: number) => setFullscreen({ photos, idx });

  // ─── mode='detail' - PlaceSwiperDetail + AppLikePreviewModal.detail ────────────
  if (mode === "detail") {
    return (
      <>
        <div className={cn("flex flex-col bg-[#FEFEFE]", className)}>
          <HeroPhotoCarousel
            photos={detailPhotos}
            placeName={data.name}
            onExpand={(idx) => handleExpand(detailPhotos, idx)}
            onClose={onClose}
            loading={detailLoading}
            topLeftSlot={header}
            // Promo (aktualnosc biznesu) na DOLE hero wg Figmy - kompaktowy pill. Miejsca bez
            // biznesu (stan zero) nie maja eventTitle -> brak pilla (zgodnie z ustaleniem).
            bottomLeftSlot={!hideEventBanner && data.eventTitle ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-xs shadow-md line-clamp-1">
                {data.eventTitle}
              </span>
            ) : undefined}
          />
          {/* space-y-6 = duzy odstep MIEDZY sekcjami (prawo bliskosci / common region). */}
          <div className="flex-1 px-4 pt-4 pb-6 space-y-6">

            {/* Tozsamosc lokalu - nazwa -> adres -> wiersz [kategoria · ocena/Opinie] -> godziny */}
            <div className="space-y-2.5">
              <h2 className="text-2xl font-bold leading-tight">{data.name}</h2>
              <SocialLinksRow data={data} />
              <AddressSection data={data} />
              {/* Kategoria + ocena w JEDNYM wierszu (wg Figmy) */}
              <div className="flex items-center gap-x-2.5 gap-y-1.5 flex-wrap">
                <CategoriesSection data={data} />
                <RatingSection data={data} expandable={!!hideReviews && hasReviews} expanded={reviewsOpen} onToggle={() => setReviewsOpen((o) => !o)} />
              </div>
              {hideReviews && reviewsOpen && <ReviewsSection data={data} />}
              {!hideHours && <OpeningHoursSection data={data} />}
              <HoursWarningBadge data={data} />
            </div>

            {/* Opis miejsca + tagi (promo przeniesione na hero) */}
            {(data.description || (data.tags && data.tags.length > 0)) && (
              <div className="space-y-3">
                {data.description && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-black tracking-tight">{t("description_title", "Opis miejsca")}</h3>
                    <DescriptionSection data={data} />
                  </div>
                )}
                <TagsSection data={data} />
              </div>
            )}

            {/* Sekcje z naglowkami - osobne 'common regions' oddzielone duzym spacingiem */}
            {!hidePosts && <PostsSection data={data} onPhotoExpand={handleExpand} />}
            {!hideMenu && <MenuSection data={data} onPhotoExpand={handleExpand} />}
            <MapSection data={data} startingLocation={startingLocation} />
            {/* Wydarzenia POD mapa (wg Figmy: "Nadchodzace Wydarzenia"). Stan zero = brak eventow. */}
            {!hideEventBanner && <EventsSection data={data} referenceDate={referenceDate} routeAvatars={routeAvatars} />}
            {!hideReviews && <ReviewsSection data={data} />}
            {footer}
          </div>
        </div>
        {fullscreen && (
          <FullscreenPhotos
            photos={fullscreen.photos}
            startIndex={fullscreen.idx}
            onClose={() => setFullscreen(null)}
          />
        )}
      </>
    );
  }

  // ─── mode='card' - mini 9:16 (BusinessCardPreview, AppLikePreviewModal.card) ───
  if (mode === "card") {
    const coverImage = data.heroPhoto || data.gallery?.[0];
    const mainLabel = data.mainCategoryId
      ? mainCategoryLabel(data.mainCategoryId)
      : null;
    return (
      <div
        className={cn("relative w-full aspect-[9/16] rounded-3xl overflow-hidden", className)}
      >
        {/* Cover image lub video */}
        {data.coverVideoUrl ? (
          <video
            src={data.coverVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : coverImage ? (
          <img src={coverImage} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-amber-300" />
        )}
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        {/* Top-left: category badge */}
        {mainLabel && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "#f4a259", color: "#fff" }}
            >
              {mainLabel}
            </span>
          </div>
        )}
        {/* Top-right: logo */}
        {data.logoUrl && (
          <div className="absolute top-3 right-3 z-10 h-12 w-12 rounded-full overflow-hidden border-2 border-white bg-white shadow-md">
            <img src={data.logoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {/* Bottom content */}
        <div className="absolute inset-x-0 bottom-0 p-4 z-10 space-y-2">
          <p className="text-xl font-black text-white leading-tight drop-shadow">{data.name}</p>
          {(data.rating || data.address) && (
            <div className="flex items-center gap-2 text-white/80 text-xs">
              {data.rating && (
                <span className="flex items-center gap-1 font-semibold text-white">
                  ⭐ {data.rating}
                </span>
              )}
              {data.address && (
                <span className="truncate">{data.address.split(",")[0]}</span>
              )}
            </div>
          )}
          {data.description && (
            <p className="text-white/85 text-xs leading-snug line-clamp-2 drop-shadow">
              {data.description}
            </p>
          )}
          {data.eventTitle && (
            <div className="rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] px-3 py-1.5 text-white text-xs font-bold text-center">
              {data.eventTitle}
            </div>
          )}
          {data.tags && data.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {data.tags.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ─── mode='preview' - PlaceDetailSheet (drawer w trasie) ──────────────────────
  if (mode === "preview") {
    return (
      <>
        <div className={cn("flex flex-col gap-3 p-4", className)}>
          {header}
          {/* Main photo */}
          {(data.heroPhoto || data.gallery?.[0]) && (
            <button
              onClick={() => handleExpand([data.heroPhoto, ...(data.gallery ?? [])].filter(Boolean) as string[], 0)}
              className="block w-full aspect-[4/3] rounded-2xl overflow-hidden bg-muted active:opacity-95"
              aria-label={t("expand_photo")}
            >
              <img src={data.heroPhoto ?? data.gallery![0]} alt={data.name} className="w-full h-full object-cover" />
            </button>
          )}
          <h2 className="text-xl font-bold leading-tight">{data.name}</h2>
          <RatingSection data={data} expandable={!!hideReviews && hasReviews} expanded={reviewsOpen} onToggle={() => setReviewsOpen((o) => !o)} />
          {hideReviews && reviewsOpen && <ReviewsSection data={data} />}
          <AddressSection data={data} />
          {!hideHours && <OpeningHoursSection data={data} />}
          <DescriptionSection data={data} />
          {!hideEventBanner && <EventBannerSection data={data} />}
          {!hideReviews && <ReviewsSection data={data} />}
          {/* Business mini-section: gallery + contact */}
          {data.gallery && data.gallery.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("gallery")}</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
                {data.gallery.slice(1).map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExpand(data.gallery!, idx + 1)}
                    className="shrink-0 h-24 w-32 rounded-xl overflow-hidden bg-muted"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {footer}
        </div>
        {fullscreen && (
          <FullscreenPhotos
            photos={fullscreen.photos}
            startIndex={fullscreen.idx}
            onClose={() => setFullscreen(null)}
          />
        )}
      </>
    );
  }

  // ─── mode='swipe' - 9:16 swipe card (SwipeCard w swiperze) ────────────────────
  // Full bg image z gradient overlay, minimal info na dolnym kraju karty.
  const swipeBg = swipeCoverImage || data.heroPhoto || data.gallery?.[0];
  return (
    <div className={cn("relative w-full h-full rounded-2xl overflow-hidden", className)}>
      {swipeBg ? (
        <img src={swipeBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-amber-300" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {header}
      <div className="absolute inset-x-0 bottom-0 p-5 z-10 text-white space-y-2">
        <p className="text-2xl font-black leading-tight drop-shadow">{data.name}</p>
        {data.mainCategoryId && (
          <p className="text-sm opacity-90">
            {mainCategoryLabel(data.mainCategoryId) ?? data.mainCategoryId}
          </p>
        )}
        {data.description && (
          <p className="text-sm leading-snug line-clamp-2 opacity-90">{data.description}</p>
        )}
        {footer}
      </div>
    </div>
  );
};

export default PremiumBusinessCard;
