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
// Implementacja zaczyna sie od skeleton (mode-based jsx z section render functions).
// Sukcesywnie podmieniany w 5 miejscach na <PremiumBusinessCard data={...} mode={...}/>.

import { type ReactNode } from "react";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Star, MapPin } from "lucide-react";
import type { PremiumBusinessData, PremiumBusinessMode } from "./premiumBusiness.types";

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
  // Wybiera tekst (biel/czarny) z dobrym kontrastem do podanego tla.
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#fff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000" : "#fff";
}

// Dedup case-insensitive subcategories (z 'Bar mleczny' x2 robi sie 1).
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
      {data.ratingCount && (
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

function DescriptionSection({ data }: SectionProps) {
  if (!data.description) return null;
  return (
    <p className="text-sm text-foreground/85 leading-relaxed">{data.description}</p>
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

function TagsSection({ data }: SectionProps) {
  if (!data.tags?.length) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {data.tags.map((tag) => (
        <span key={tag} className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          {tag}
        </span>
      ))}
    </div>
  );
}

function MenuSection({ data, onPhotoClick }: SectionProps & { onPhotoClick?: (photos: string[], idx: number) => void }) {
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
            onClick={() => onPhotoClick?.(menuImages, idx)}
            className="shrink-0 w-[78%] aspect-[4/3] rounded-2xl overflow-hidden bg-muted snap-center active:opacity-95 transition-opacity"
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
      <h3 className="text-lg font-black tracking-tight mb-3">Opinie</h3>
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

// ─── Main component ──────────────────────────────────────────────────────────

export interface PremiumBusinessCardProps {
  data: PremiumBusinessData;
  mode: PremiumBusinessMode;
  className?: string;
  onPhotoClick?: (photos: string[], idx: number) => void;
  // Optional override per section (rare - default is mode-based)
  hideEventBanner?: boolean;
  hideMenu?: boolean;
  hideReviews?: boolean;
  // Footer slot - call site dodaje CTA (Like/Skip, Edit, Maps button)
  footer?: ReactNode;
  // Header slot dla wlasnego renderu (close button, custom title)
  header?: ReactNode;
}

const PremiumBusinessCard = ({
  data,
  mode,
  className,
  onPhotoClick,
  hideEventBanner,
  hideMenu,
  hideReviews,
  footer,
  header,
}: PremiumBusinessCardProps) => {
  // Mode 'detail' = pelna premium wizytowka.
  if (mode === "detail") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {header}
        <CategoriesSection data={data} />
        <RatingSection data={data} />
        <AddressSection data={data} />
        <DescriptionSection data={data} />
        {!hideEventBanner && <EventBannerSection data={data} />}
        <TagsSection data={data} />
        {!hideMenu && <MenuSection data={data} onPhotoClick={onPhotoClick} />}
        {!hideReviews && <ReviewsSection data={data} />}
        {footer}
      </div>
    );
  }

  // TODO: pozostale tryby (card, preview, swipe) - implementacja w Phase 4 + 5.
  // Na razie skeleton renderuje minimalna wersje zeby placeholder dzialal.
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {header}
      <CategoriesSection data={data} />
      <RatingSection data={data} />
      <DescriptionSection data={data} />
      {!hideEventBanner && <EventBannerSection data={data} />}
      <TagsSection data={data} />
      {footer}
    </div>
  );
};

export default PremiumBusinessCard;
