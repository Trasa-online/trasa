// Adaptery: konwertuja rozne zrodla danych do wspolnego PremiumBusinessData.
// Komponent <PremiumBusinessCard> czyta tylko ten interfejs - rozne call sites
// (PlaceSwiperDetail, BusinessCardPreview, PlaceDetailSheet itd) wywoluja
// odpowiedni adapter zanim przekaza dane do komponentu.

import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import type { PremiumBusinessData, BusinessPost, GoogleReview } from "./premiumBusiness.types";

// PlaceDetail z Google Places API (response z google-places-proxy edge function)
interface PlaceDetailFromGoogle {
  place_id?: string;
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_address?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  reviews?: GoogleReview[];
}

// ─── Adapter 1: MockPlace + opcjonalny Google detail + business_posts ──────────
// Uzywany w PlaceSwiperDetail i AppLikePreviewModal.detail.
export function fromMockPlace(
  place: MockPlace,
  detail?: PlaceDetailFromGoogle | null,
  posts?: BusinessPost[],
): PremiumBusinessData {
  return {
    id: place.id,
    name: place.place_name,

    heroPhoto: place.photo_url,
    gallery: place.galleryPhotos ?? [],
    coverVideoUrl: place.coverVideoUrl,

    mainCategoryId: place.businessMainCategory,
    secondaryCategoryId: place.businessSecondaryCategory,
    subcategories: place.businessSubcategories ?? [],
    tags: place.businessTags?.length ? place.businessTags : (place.vibe_tags ?? []),

    logoUrl: place.businessLogoUrl,
    // Nie nadpisujemy opisu opisem biznesowym (bp.description) - pokazujemy zwykly, rzeczowy
    // opis miejsca (places.description). Opisy biznesowe (np. Bajka, Wanderlust) bywaly slabe.
    description: place.description,
    // Biznes z wlasnym adresem -> uzyj jego adresu (NIE Google formatted_address, ktory dla lokalu
    // o popularnej nazwie moze trafic w inny lokal). Inaczej fallback do Google -> places.address.
    address: place.businessHasOwnAddress ? (place.address || detail?.formatted_address) : (detail?.formatted_address || place.address),
    city: place.city,
    isVerified: place.businessIsVerified,

    rating: detail?.rating ?? place.rating,
    ratingCount: detail?.user_ratings_total,
    priceLevel: detail?.price_level ?? place.price_level,

    ownerOpeningHours: place.businessOpeningHours,
    // Godziny: najpierw live Google detail, w fallbacku weekday_text z bazy (backfill) -
    // dzieki temu wizytowka pokazuje godziny od razu, bez czekania na fetch Google.
    googleWeekdayText: detail?.opening_hours?.weekday_text ?? place.opening_hours?.weekday_text ?? undefined,
    googleOpenNow: detail?.opening_hours?.open_now,

    eventTitle: place.businessEventTitle,
    eventDescription: place.businessEventDescription,

    posts: posts ?? [],
    menuImageUrls: place.businessMenuImageUrls ?? [],
    reviews: detail?.reviews,
    googlePlaceId: detail?.place_id,

    phone: place.businessPhone,
    website: place.businessWebsite,
    instagram: place.businessInstagram,
    facebook: place.businessFacebook,

    latitude: place.latitude,
    longitude: place.longitude,

    colorBadge: place.businessColorBadge,
    colorCardBg: place.businessColorCardBg,
    colorButton: place.businessColorButton,
    colorPromo: place.businessColorPromo,

    hasOwnPhoto: place.businessHasOwnPhoto,
  };
}

// ─── Adapter 2: BusinessDashboard state ────────────────────────────────────────
// Uzywany w BusinessCardPreview (sticky sidebar) i AppLikePreviewModal (full preview).
export interface DashboardStateForPreview {
  businessName: string;
  mainCategory: string;
  subcategories?: string[];
  tags: string[];
  description: string;
  street?: string;
  city?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  coverVideoUrl?: string;
  galleryUrls?: string[];
  menuImageUrls?: string[];
  posts?: BusinessPost[];
  eventTitle?: string;
  eventDescription?: string;
  openingHours?: Record<string, { open: string; close: string } | { closed: true }>;
  colorBadge?: string;
  colorCardBg?: string;
  colorButton?: string;
}

export function fromDashboardState(state: DashboardStateForPreview): PremiumBusinessData {
  return {
    id: "dashboard-preview",
    name: state.businessName,

    heroPhoto: state.coverImageUrl,
    gallery: state.galleryUrls ?? [],
    coverVideoUrl: state.coverVideoUrl,

    mainCategoryId: state.mainCategory,
    subcategories: state.subcategories ?? [],
    tags: state.tags,

    logoUrl: state.logoUrl,
    description: state.description,
    address: state.street,
    city: state.city,

    ownerOpeningHours: state.openingHours,

    eventTitle: state.eventTitle,
    eventDescription: state.eventDescription,

    posts: state.posts ?? [],
    menuImageUrls: state.menuImageUrls ?? [],

    colorBadge: state.colorBadge,
    colorCardBg: state.colorCardBg,
    colorButton: state.colorButton,

    hasOwnPhoto: !!(state.coverImageUrl || state.coverVideoUrl || (state.galleryUrls?.length ?? 0) > 0),
  };
}

// ─── Adapter 3: Pin (z trasy) + optional Google detail + optional BusinessProfile ──
// Uzywany w PlaceDetailSheet (drawer po tap pinu na mapie/timeline w trasie).
export interface PinForPreview {
  id: string;
  place_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
}

export interface BusinessProfileForPreview {
  logo_url?: string | null;
  cover_image_url?: string | null;
  cover_video_url?: string | null;
  description?: string | null;
  main_category?: string | null;
  subcategories?: string[] | null;
  tags?: string[] | null;
  gallery_urls?: string[] | null;
  menu_image_urls?: string[] | null;
  event_title?: string | null;
  event_description?: string | null;
  opening_hours?: Record<string, { open: string; close: string } | { closed: true }> | null;
  phone?: string | null;
  website?: string | null;
  is_verified?: boolean | null;
  color_badge?: string | null;
  color_card_bg?: string | null;
  color_button?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function fromPin(
  pin: PinForPreview,
  biz?: BusinessProfileForPreview | null,
  detail?: PlaceDetailFromGoogle | null,
  posts?: BusinessPost[],
): PremiumBusinessData {
  return {
    id: pin.id,
    name: pin.place_name,

    heroPhoto: biz?.cover_image_url ?? pin.photo_url ?? undefined,
    gallery: biz?.gallery_urls?.filter(Boolean) ?? [],
    coverVideoUrl: biz?.cover_video_url ?? undefined,

    mainCategoryId: biz?.main_category ?? undefined,
    subcategories: biz?.subcategories ?? [],
    tags: biz?.tags?.filter(Boolean) ?? [],

    logoUrl: biz?.logo_url ?? undefined,
    description: biz?.description ?? undefined,
    address: detail?.formatted_address || pin.address || undefined,
    city: undefined,
    isVerified: biz?.is_verified ?? undefined,

    rating: detail?.rating,
    ratingCount: detail?.user_ratings_total,
    priceLevel: detail?.price_level,

    ownerOpeningHours: biz?.opening_hours ?? undefined,
    googleWeekdayText: detail?.opening_hours?.weekday_text,
    googleOpenNow: detail?.opening_hours?.open_now,

    eventTitle: biz?.event_title ?? undefined,
    eventDescription: biz?.event_description ?? undefined,

    posts: posts ?? [],
    menuImageUrls: biz?.menu_image_urls ?? [],
    reviews: detail?.reviews,
    googlePlaceId: detail?.place_id,

    phone: biz?.phone ?? undefined,
    website: biz?.website ?? undefined,

    // Pozycja pinu: geokodowany adres biznesu ma pierwszenstwo nad coords z pinu/places.
    latitude: biz?.latitude ?? pin.latitude ?? undefined,
    longitude: biz?.longitude ?? pin.longitude ?? undefined,

    colorBadge: biz?.color_badge ?? undefined,
    colorCardBg: biz?.color_card_bg ?? undefined,
    colorButton: biz?.color_button ?? undefined,

    hasOwnPhoto: !!(biz?.cover_image_url || biz?.cover_video_url || (biz?.gallery_urls?.length ?? 0) > 0),
  };
}
