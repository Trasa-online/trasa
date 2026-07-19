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
import { Star, Clock, ChevronRight, ChevronLeft, ChevronDown, X, Maximize2, Phone, Globe, FileText, Instagram, Facebook } from "lucide-react";
import { parseISO, isValid, formatDistanceToNow, format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import RouteMap from "@/components/RouteMap";
import type {
  PremiumBusinessData,
  PremiumBusinessMode,
  OwnerOpeningHours,
  DayHours,
} from "./premiumBusiness.types";

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

const FullscreenPhotos = ({ photos, startIndex, onClose }: FullscreenPhotosProps) => {
  const { t } = useTranslation("wizytowka");
  const [idx, setIdx] = useState(Math.max(0, Math.min(startIndex, photos.length - 1)));
  const startPos = useRef<{ x: number; y: number } | null>(null);

  if (photos.length === 0) return null;

  const goPrev = () => setIdx((n) => Math.max(0, n - 1));
  const goNext = () => setIdx((n) => Math.min(photos.length - 1, n + 1));

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none"
      style={{ pointerEvents: "auto" }}
      onTouchStart={(e) => { startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        if (startPos.current === null) return;
        const dx = e.changedTouches[0].clientX - startPos.current.x;
        const dy = e.changedTouches[0].clientY - startPos.current.y;
        startPos.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && photos.length > 1) {
          if (dx < 0) goNext();
          else goPrev();
          return;
        }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) onClose();
      }}
      onClick={() => onClose()}
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
      <img src={photos[idx]} alt="" draggable={false} className="max-w-full max-h-full object-contain pointer-events-none" />
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
  topLeftSlot?: ReactNode; // chipy dystansu + Maps na gorze hero (obok X)
}

function HeroPhotoCarousel({ photos, placeName, onExpand, onClose, loading, topLeftSlot }: HeroPhotoCarouselProps) {
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
      {hasPhoto ? (
        <>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute inset-0 w-full h-full"
            aria-label={t("expand_photo")}
          >
            <img src={photos[activeIdx]} alt={placeName} className="absolute inset-0 w-full h-full object-cover" />
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

// Agenda zaplanowanych wydarzen (kolejka business_events) - lista nadchodzacych/aktywnych
// (bez szkicow i przeszlych). Tytul EN-aware, data (zakres) + opcjonalny opis.
function EventsSection({ data, referenceDate }: SectionProps & { referenceDate?: string }) {
  const { t, i18n } = useTranslation("wizytowka");
  // Odniesienie = data wyjazdu (gdy user planuje termin) albo dzis. Pokazujemy wydarzenie
  // najblizsze TEJ dacie - aktywne w terminie albo pierwsze nadchodzace po nim.
  const ref = referenceDate ?? new Date().toISOString().slice(0, 10);
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  // Tylko JEDNO najblizsze wydarzenie (aktywne w terminie albo nadchodzace), nawet gdy lokal
  // dodal kilka. Gdy mija - automatycznie wskakuje nastepne.
  const upcoming = (data.events ?? [])
    .filter((e) => e && !e.is_draft && String(e.ends_at ?? e.starts_at) >= ref)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
    .slice(0, 1);
  if (upcoming.length === 0) return null;
  const fmtDate = (d: string) => {
    const dt = parseISO(d);
    return isValid(dt) ? format(dt, "d MMM", { locale: dateLocale() }) : d;
  };
  const range = (e: { starts_at: string; ends_at?: string | null }) =>
    (e.ends_at && e.ends_at !== e.starts_at) ? `${fmtDate(e.starts_at)} - ${fmtDate(e.ends_at)}` : fmtDate(e.starts_at);
  return (
    <div className="space-y-2 pt-2">
      <h3 className="text-lg font-black tracking-tight">{t("events_title")}</h3>
      <div className="space-y-1.5">
        {upcoming.map((e, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30">
            <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-700 text-[11px] font-bold whitespace-nowrap">{range(e)}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug break-words">{isEn && e.title_en ? e.title_en : e.title}</p>
              {e.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">{e.description}</p>}
            </div>
          </div>
        ))}
      </div>
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
      <h3 className="text-lg font-black tracking-tight">{t("map_title")}</h3>
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

function ContactButtonsSection({ data }: SectionProps) {
  const { t } = useTranslation("wizytowka");
  if (!data.phone && !data.website && !data.instagram && !data.facebook) return null;
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
      {data.instagram && (
        <a href={data.instagram} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Instagram">
          <Instagram className="h-4 w-4" />
        </a>
      )}
      {data.facebook && (
        <a href={data.facebook} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Facebook">
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
          />
          {/* space-y-6 = duzy odstep MIEDZY sekcjami (prawo bliskosci / common region).
              Wewnatrz kazdej grupy ciasny spacing - powiazane elementy trzymaja sie razem. */}
          <div className="flex-1 px-4 pt-4 pb-6 space-y-6">

            {/* Tozsamosc lokalu - jedna zwarta grupa */}
            <div className="space-y-2.5">
              {/* Nazwa = pelna szerokosc, moze sie zawinac (bez truncate) - nazwa jest wazna.
                  Chipy dystansu + Maps przeniesione na gore hero (obok X), zeby nie skracac nazwy. */}
              <h2 className="text-2xl font-bold leading-tight">{data.name}</h2>
              <RatingSection data={data} expandable={!!hideReviews && hasReviews} expanded={reviewsOpen} onToggle={() => setReviewsOpen((o) => !o)} />
              {hideReviews && reviewsOpen && <ReviewsSection data={data} />}
              <AddressSection data={data} />
              <CategoriesSection data={data} />
            </div>

            {/* Opis + promo + tagi - zwarta grupa */}
            {(data.description || data.eventTitle || (data.tags && data.tags.length > 0)) && (
              <div className="space-y-3">
                <DescriptionSection data={data} />
                <HoursWarningBadge data={data} />
                {!hideEventBanner && <EventBannerSection data={data} />}
                {!hideEventBanner && <EventsSection data={data} referenceDate={referenceDate} />}
                <TagsSection data={data} />
              </div>
            )}

            {/* Sekcje z naglowkami - osobne 'common regions' oddzielone duzym spacingiem */}
            {!hidePosts && <PostsSection data={data} onPhotoExpand={handleExpand} />}
            {!hideMenu && <MenuSection data={data} onPhotoExpand={handleExpand} />}
            <MapSection data={data} startingLocation={startingLocation} />
            {/* Godziny otwarcia POD mapa (przeniesione z grupy tozsamosci nad opisem). */}
            {!hideHours && <OpeningHoursSection data={data} />}
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
