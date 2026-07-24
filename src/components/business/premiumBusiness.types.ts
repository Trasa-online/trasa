// Wspolny interfejs dla wizytowki biznesowej w aplikacji Trasa.
// Refactor: wczesniej 5 miejsc (PlaceSwiperDetail, BusinessCardPreview, AppLikePreviewModal,
// PlaceDetailSheet, SwipeCard) mialo wlasne logiki renderowania z innymi zrodlami danych.
// Teraz: <PremiumBusinessCard data={PremiumBusinessData} mode='detail|card|preview|swipe'/>.
//
// Adaptery w premiumBusinessAdapters.ts konwertuja kazdy source (MockPlace, Pin, dashboard state, etc.)
// do tego interfejsu. Komponent zna tylko PremiumBusinessData - latwiejsze testowanie + spojnosc.

export interface BusinessPost {
  id: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
}

export interface GoogleReview {
  author_name: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
}

// Opening hours owner-defined (z business_profiles.opening_hours).
// Shape: { mon: { open: "09:00", close: "22:00" } | { closed: true }, ... }
export type DayHours = { open: string; close: string } | { closed: true };
export type OwnerOpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>>;

export interface PremiumBusinessData {
  // ── Core (zawsze potrzebne) ────────────────────────────────────────────────
  id: string;
  name: string;

  // ── Photos ─────────────────────────────────────────────────────────────────
  /** Glowne zdjecie cover (4:3 dla detail, 9:16 dla card/swipe). */
  heroPhoto?: string;
  /** Dodatkowe zdjecia galerii. Pierwszy = hero gdy heroPhoto puste. */
  gallery?: string[];
  /** Cover video (premium feature, autoplay loop mute). */
  coverVideoUrl?: string;

  // ── Categorization ─────────────────────────────────────────────────────────
  /** Main category id z MAIN_CATEGORIES (np. 'food', 'culture'). */
  mainCategoryId?: string;
  /** Kategoria miejsca (places.category, np. 'restaurant') - fallback dla miejsc bez profilu biznesowego. */
  placeCategory?: string;
  secondaryCategoryId?: string;
  /** Subcategories z business_profiles.subcategories. */
  subcategories?: string[];
  /** Custom subcategory zatwierdzona przez admina. */
  customSubcategory?: string;
  /** Vibe tags (biz custom > Google fallback). */
  tags?: string[];

  // ── Business identity ──────────────────────────────────────────────────────
  logoUrl?: string;
  description?: string;
  address?: string;
  city?: string;
  isVerified?: boolean;

  // ── Rating ─────────────────────────────────────────────────────────────────
  rating?: number;
  ratingCount?: number;
  priceLevel?: number;

  // ── Opening hours ──────────────────────────────────────────────────────────
  /** Owner-defined hours z dashboardu. Priorytet nad Google. */
  ownerOpeningHours?: OwnerOpeningHours;
  /** Google Places weekday_text (fallback). */
  googleWeekdayText?: string[];
  /** Google Places open_now (z opening_hours). */
  googleOpenNow?: boolean;

  // ── Event / promo banner ───────────────────────────────────────────────────
  eventTitle?: string;
  // Zaplanowane wydarzenia (kolejka business_events) - agenda nadchodzacych na wizytowce.
  events?: Array<{ title: string; title_en?: string | null; starts_at: string; ends_at?: string | null; start_time?: string | null; end_time?: string | null; description?: string | null; is_draft?: boolean }>;
  eventDescription?: string;

  // ── Premium content sections ───────────────────────────────────────────────
  /** Aktualnosci (business_posts). */
  posts?: BusinessPost[];
  /** Menu / Cennik zdjecia (max 6, food=Menu, culture/attractions/nature=Cennik). */
  menuImageUrls?: string[];
  /** Google reviews (top 3-5 jest renderowane). */
  reviews?: GoogleReview[];
  /** Google place_id - dla 'Wiecej opinii na Google' linku. */
  googlePlaceId?: string;

  // ── Contact ────────────────────────────────────────────────────────────────
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;

  // ── Coordinates ────────────────────────────────────────────────────────────
  latitude?: number;
  longitude?: number;

  // ── Color customization (biz premium feature) ──────────────────────────────
  colorBadge?: string;
  colorCardBg?: string;
  colorButton?: string;
  colorPromo?: string;

  // ── Flags ──────────────────────────────────────────────────────────────────
  /** True gdy biz wgral swoje zdjecia (cover/video/galeria). Skip Google Photos. */
  hasOwnPhoto?: boolean;
}

// Mode komponentu - decyduje ktore sekcje sa renderowane i z jakim layoutem.
export type PremiumBusinessMode =
  | "detail"   // Pelna premium wizytowka (drawer w PlaceSwiperDetail, AppLikePreviewModal.detail). Wszystkie sekcje.
  | "card"     // Mini card 9:16 (BusinessCardPreview sticky sidebar, AppLikePreviewModal.card). Photo + nazwa + cat + rating + opis + tags + event.
  | "preview"  // W trasie po-save (PlaceDetailSheet). Photo + rating + hours + reviews + biz mini.
  | "swipe";   // 9:16 swipe card (SwipeCard w swiperze). Full bg image + overlay + minimal info.
