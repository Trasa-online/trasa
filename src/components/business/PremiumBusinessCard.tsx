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

import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Star, MapPin, Clock, ChevronRight, ChevronLeft, X, Maximize2, Phone, Globe } from "lucide-react";
import { parseISO, isValid, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
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

// ─── Opening hours helpers ────────────────────────────────────────────────────

const DAY_LABELS_PL: Record<string, string> = {
  mon: "Poniedziałek", tue: "Wtorek", wed: "Środa", thu: "Czwartek",
  fri: "Piątek", sat: "Sobota", sun: "Niedziela",
};
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
        aria-label="Zamknij"
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
            aria-label="Poprzednie zdjęcie"
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
            aria-label="Następne zdjęcie"
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
}

function HeroPhotoCarousel({ photos, placeName, onExpand, onClose, loading }: HeroPhotoCarouselProps) {
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
          className="absolute top-3 left-3 z-30 h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      )}
      {hasPhoto ? (
        <>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute inset-0 w-full h-full"
            aria-label="Powiększ zdjęcie"
          >
            <img src={photos[activeIdx]} alt={placeName} className="absolute inset-0 w-full h-full object-cover" />
          </button>
          <button
            onClick={() => onExpand(activeIdx)}
            className="absolute bottom-3 right-3 z-20 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60"
            aria-label="Pełny ekran"
          >
            <Maximize2 className="h-3.5 w-3.5 text-white" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.max(0, activeIdx - 1)); }}
                disabled={activeIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center active:scale-90 disabled:opacity-30"
                aria-label="Poprzednie"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIdx(Math.min(photos.length - 1, activeIdx + 1)); }}
                disabled={activeIdx === photos.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center active:scale-90 disabled:opacity-30"
                aria-label="Następne"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
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
            <p className="text-xs text-muted-foreground/50">Wczytywanie zdjęć…</p>
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
    ? MAIN_CATEGORIES.find(c => c.id === data.mainCategoryId)?.label
    : null;
  const subs = dedupSubcategories(data.subcategories);
  if (!mainLabel && subs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {mainLabel && (
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={data.colorBadge
            ? { background: data.colorBadge, color: getHexContrast(data.colorBadge) }
            : { background: "#f4a259", color: "#fff" }}
        >
          {mainLabel}
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

function RatingSection({ data }: SectionProps) {
  if (!data.rating) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Stars rating={data.rating} />
      <span className="text-sm font-bold">{data.rating}</span>
      {data.ratingCount !== undefined && data.ratingCount > 0 && (
        <span className="text-sm text-muted-foreground">({data.ratingCount.toLocaleString("pl")})</span>
      )}
    </div>
  );
}

function AddressSection({ data }: SectionProps) {
  if (!data.address && !data.city) return null;
  const shortAddress = data.address?.split(",").slice(0, 2).join(",").trim();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {data.city && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/60 bg-card text-xs font-semibold text-foreground">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {data.city}
        </span>
      )}
      {shortAddress && (
        <span className="text-xs text-muted-foreground">{shortAddress}</span>
      )}
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
  return (
    <div className="rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] px-4 py-3 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-orange-500/20 text-center leading-tight">
      {data.eventTitle}
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
  const [expanded, setExpanded] = useState(false);
  const hasBiz = data.ownerOpeningHours && Object.keys(data.ownerOpeningHours).length > 0;
  const hasGoogle = !hasBiz && data.googleWeekdayText && data.googleWeekdayText.length > 0;
  if (!hasBiz && !hasGoogle) return null;

  const openNow = hasBiz ? isBizOpenNow(data.ownerOpeningHours!) : !!data.googleOpenNow;
  const todayK = todayKey();

  let todayLine = "";
  let allLines: { label: string; value: string; isToday: boolean }[] = [];

  if (hasBiz) {
    allLines = DAY_ORDER.map((k) => {
      const h = (data.ownerOpeningHours as OwnerOpeningHours)[k];
      const value = !h ? "-" : "closed" in h ? "Zamknięte" : `${(h as { open: string; close: string }).open} - ${(h as { open: string; close: string }).close}`;
      return { label: DAY_LABELS_PL[k], value, isToday: k === todayK };
    });
    const today = allLines.find((l) => l.isToday);
    todayLine = today ? `${today.label.toLowerCase()}: ${today.value}` : "";
  } else if (hasGoogle) {
    allLines = data.googleWeekdayText!.slice(0, 7).map((line, i) => {
      const k = DAY_ORDER[i] ?? DAY_ORDER[0];
      const parts = line.split(":");
      parts.shift();
      const value = parts.join(":").trim() || line;
      return { label: DAY_LABELS_PL[k], value, isToday: k === todayK };
    });
    const today = allLines.find((l) => l.isToday);
    todayLine = today ? `${today.label.toLowerCase()}: ${today.value}` : "";
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
        className="w-full flex items-center justify-between px-4 py-3 gap-3 active:bg-muted/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0", openNow ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500")}>
            {openNow ? "Otwarte" : "Zamknięte"}
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
                {line.label}{line.isToday && " (dziś)"}
              </span>
              <span className={line.value === "Zamknięte" || line.value === "-" ? "text-muted-foreground" : "text-foreground"}>
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
  const posts = data.posts ?? [];
  if (posts.length === 0) return null;
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-black tracking-tight">Aktualności</h3>
      <div className="space-y-3">
        {posts.map((post) => {
          const date = parseISO(post.created_at);
          const dateLabel = isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: pl }) : "";
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
                      aria-label="Powiększ zdjęcie"
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

function MenuSection({ data, onPhotoExpand }: SectionProps & { onPhotoExpand: (photos: string[], idx: number) => void }) {
  const menuImages = data.menuImageUrls ?? [];
  if (menuImages.length === 0) return null;
  const sectionLabel = data.mainCategoryId === "food" ? "Menu" : "Cennik";
  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-lg font-black tracking-tight">{sectionLabel}</h3>
      <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 pb-1">
        {menuImages.map((url, idx) => (
          <button
            key={idx}
            onClick={() => onPhotoExpand(menuImages, idx)}
            className="shrink-0 w-[78%] aspect-[4/3] rounded-2xl overflow-hidden bg-muted snap-center active:opacity-95"
            aria-label={`Powiększ ${sectionLabel.toLowerCase()} ${idx + 1}`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewsSection({ data }: SectionProps) {
  const reviews = data.reviews ?? [];
  if (reviews.length === 0) return null;
  return (
    <div className="pt-2">
      {/* Google attribution wymagane przez ToS gdy pokazujemy Google reviews. */}
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-lg font-black tracking-tight">Opinie</h3>
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
      {data.googlePlaceId && (
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${data.googlePlaceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-border text-sm text-foreground"
        >
          <span className="font-black text-[#4285F4]">G</span>
          Więcej opinii na Google
        </a>
      )}
    </div>
  );
}

function ContactButtonsSection({ data }: SectionProps) {
  if (!data.phone && !data.website) return null;
  return (
    <div className="flex gap-2">
      {data.phone && (
        <a
          href={`tel:${data.phone}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-border/60 bg-card text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
        >
          <Phone className="h-4 w-4" />
          Zadzwoń
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
          Strona
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
}: PremiumBusinessCardProps) => {
  const [fullscreen, setFullscreen] = useState<{ photos: string[]; idx: number } | null>(null);

  const handleExpand = (photos: string[], idx: number) => setFullscreen({ photos, idx });

  // ─── mode='detail' - PlaceSwiperDetail + AppLikePreviewModal.detail ────────────
  if (mode === "detail") {
    return (
      <>
        <div className={cn("flex flex-col", className)}>
          <HeroPhotoCarousel
            photos={detailPhotos}
            placeName={data.name}
            onExpand={(idx) => handleExpand(detailPhotos, idx)}
            onClose={onClose}
            loading={detailLoading}
          />
          <div className="flex-1 px-4 py-4 space-y-3">
            {header}
            <h2 className="text-xl font-black leading-tight">{data.name}</h2>
            <RatingSection data={data} />
            <AddressSection data={data} />
            <CategoriesSection data={data} />
            {!hideHours && <OpeningHoursSection data={data} />}
            <DescriptionSection data={data} />
            <HoursWarningBadge data={data} />
            {!hideEventBanner && <EventBannerSection data={data} />}
            <TagsSection data={data} />
            {!hidePosts && <PostsSection data={data} onPhotoExpand={handleExpand} />}
            {!hideMenu && <MenuSection data={data} onPhotoExpand={handleExpand} />}
            {!hideReviews && <ReviewsSection data={data} />}
            {!hideContact && <ContactButtonsSection data={data} />}
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
      ? MAIN_CATEGORIES.find(c => c.id === data.mainCategoryId)?.label
      : null;
    return (
      <div
        className={cn("relative w-full aspect-[9/16] rounded-3xl overflow-hidden", className)}
        style={data.colorCardBg ? { background: data.colorCardBg } : undefined}
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
              style={data.colorBadge
                ? { background: data.colorBadge, color: getHexContrast(data.colorBadge) }
                : { background: "#f4a259", color: "#fff" }}
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
              aria-label="Powiększ zdjęcie"
            >
              <img src={data.heroPhoto ?? data.gallery![0]} alt={data.name} className="w-full h-full object-cover" />
            </button>
          )}
          <h2 className="text-xl font-black leading-tight">{data.name}</h2>
          <RatingSection data={data} />
          <AddressSection data={data} />
          {!hideHours && <OpeningHoursSection data={data} />}
          <DescriptionSection data={data} />
          {!hideEventBanner && <EventBannerSection data={data} />}
          {!hideReviews && <ReviewsSection data={data} />}
          {/* Business mini-section: gallery + contact */}
          {data.gallery && data.gallery.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Galeria</p>
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
          {!hideContact && <ContactButtonsSection data={data} />}
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
            {MAIN_CATEGORIES.find(c => c.id === data.mainCategoryId)?.label ?? data.mainCategoryId}
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
