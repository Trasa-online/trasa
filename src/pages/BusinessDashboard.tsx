import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BrandIcon, SAVE_ICON } from "@/components/BrandIcon";
import { applyBusinessDefaultLanguage, markBusinessLangChoice } from "@/lib/businessLanguage";
import { Loader2, BarChart2, MapPin, MousePointerClick, Plus, X, LogOut, ImagePlus, Trash2, Users, LayoutDashboard, Images, Store, Megaphone, TrendingUp, MessageCircle, Expand, ZoomIn, Video, Play, Camera, Star, Heart, ChevronUp, ChevronDown, ChevronLeft, GripVertical, HelpCircle, Eye, KeyRound, Clock, Settings, FileText, BookOpen, Pencil, Check, MessageSquareQuote, Flag, Bookmark, Share2, Globe } from "lucide-react";

// Pola formularza panelu = szare wypełnienie + pomarańczowy focus (prośba Nat 2026-09-14:
// jednolitość i "zasada przynależności" - wszystkie inputy wyglądają tak samo, spokojnie).
// BizInput owija shadcn <Input>, żeby nie trzeba było dopisywać klasy przy każdym polu.
const BIZ_FIELD = "bg-slate-50 border-slate-200/80 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 focus-visible:border-primary/40";
function BizInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn(BIZ_FIELD, className)} {...props} />;
}

// Menu moze byc obrazem (JPG/PNG/WEBP) albo PDF - rozpoznajemy po rozszerzeniu URL.
const isPdfUrl = (u: string): boolean => u.split("?")[0].toLowerCase().endsWith(".pdf");
import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';
import type { TFunction } from "i18next";
import { MAIN_CATEGORIES, readMainCategories, normalizeSubcategoryId, mainsFromSubs } from "@/lib/categories";
import { resizeImage } from "@/lib/imageResize";
import { isHeic, convertHeicToJpeg } from "@/lib/heicConvert";
import { forwardGeocode } from "@/lib/googleMaps";
import { formatDistanceToNow, subDays, format, addDays, differenceInCalendarDays, endOfDay, startOfDay, parseISO } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";
import BusinessHoursEditor, { type OpeningHours } from "@/components/business/BusinessHoursEditor";
import PremiumBusinessCard from "@/components/business/PremiumBusinessCard";
import { fromDashboardState } from "@/components/business/premiumBusinessAdapters";
import { ImageCropModal } from "@/components/business/ImageCropModal";
import { TrasaLogo } from "@/components/TrasaLogo";
import { BizShell, type BizSection } from "@/components/business/dashboard/BizShell";
import { OverviewSection, type CompletenessStep } from "@/components/business/dashboard/OverviewSection";
import { ProfileSection } from "@/components/business/dashboard/ProfileSection";
import { CategoryPickerModal } from "@/components/business/dashboard/CategoryPickerModal";
import { SettingsSection } from "@/components/business/dashboard/SettingsSection";
import { GuestInsights } from "@/components/business/dashboard/GuestInsights";
import { uploadThumb } from "@/lib/imageThumbs";
import { fetchPlaceNotes, type PlaceUserNote } from "@/lib/placeNotes";
import { avatarSrc } from "@/lib/avatar";

interface BusinessPost {
  id: string;
  place_id: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
}


const VIBE_TAG_SUGGESTIONS = [
  'must-see', 'romantycznie', 'historyczne', 'widok', 'instagramowe',
  'family friendly', 'dog friendly', 'klimatycznie', 'nocne życie',
  'lokalne smaki', 'ukryta perełka', 'vege-friendly', 'live music', 'na powietrzu',
  'śniadania', 'slow food', 'tanie & dobre', 'luksusowo',
];

type BizPlan = 'zero' | 'basic' | 'premium';

const PLAN_LABELS: Record<BizPlan, string> = {
  zero: 'Zero',
  basic: 'Basic',
  premium: 'Premium',
};
const PLAN_COLORS: Record<BizPlan, string> = {
  zero: 'bg-muted text-muted-foreground',
  basic: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

interface BusinessProfile {
  id: string;
  place_id: string;
  owner_user_id: string | null;
  business_name: string;
  plan: BizPlan;
  is_premium: boolean;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  menu_image_urls: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  description: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  tags: string[] | null;
  main_category: string | null;
  subcategories: string[] | null;
  is_verified: boolean;
  review_requested_at: string | null;
  verification_notified_at: string | null;
  activated_at: string | null;
  event_title: string | null;
  event_description: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
  is_draft?: boolean;
}

interface Stats {
  views: number; onRoutes: number; websiteClicks: number; phoneClicks: number; uniqueChoices: number;
  /** Zapisy miejsca do kolekcji (event place_saved). */
  saves: number;
  /** Ten sam zakres cofniety o jego dlugosc - sluzy do "+18% wobec poprzednich 30 dni". */
  previous?: { views: number; onRoutes: number; clicks: number; saves: number };
}
type AnalyticsRange = '7d' | '30d' | '90d' | 'custom';
interface ChartDay { date: string; views: number; routes: number; clicks: number; }
interface HourlyBucket { hour: number; label: string; total: number; }

// Naglowki sekcji panelu. Copy z makiety „Spokojny panel" - jedno zrodlo, bo te same
// zdania pojawialy sie wczesniej w sekcji i w pigulce nawigacji, i rozjezdzaly sie.
const SECTION_META: Record<BizSection, { title: (t: TFunction) => string; subtitle: (t: TFunction) => string }> = {
  overview:  { title: (t) => t("shell.nav.overview"),  subtitle: (t) => t("overview.subtitle") },
  profile:   { title: (t) => t("shell.nav.profile"),   subtitle: (t) => t("profile.subtitle") },
  menu:      { title: (t) => t("shell.nav.menu"),      subtitle: (t) => t("menu.subtitle") },
  posts:     { title: (t) => t("shell.nav.posts"),     subtitle: (t) => t("posts.subtitle") },
  community: { title: (t) => t("shell.nav.community"), subtitle: (t) => t("community.subtitle") },
  gallery:   { title: (t) => t("shell.nav.gallery"),   subtitle: (t) => t("gallery.subtitle") },
  settings:  { title: (t) => t("shell.nav.settings"),  subtitle: (t) => t("settings.subtitle") },
};

const MAX_GALLERY = 10;
const MAX_MENU_IMAGES = 6;

// iOS Safari: imperative play() required for dynamically-inserted muted videos
function AutoVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
    />
  );
}

function DashboardLoadingScreen() {
  const [progress, setProgress] = useState(5);
  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => {
        const next = p + Math.random() * 10 + 3;
        if (next >= 90) { clearInterval(id); return 90; }
        return next;
      });
    }, 150);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5">
      <TrasaLogo size={64} className="shadow-lg" />
      <p className="font-black text-xl tracking-tight text-foreground">spontaway</p>
      <div className="flex flex-col items-center gap-1.5 w-44">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%`, transition: "width 0.3s ease-out" }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

function StarRow({ count = 5, size = "sm" }: { count?: number; size?: "xs" | "sm" }) {
  const cls = size === "xs" ? "h-3 w-3" : "h-4 w-4";
  return (
    <>{Array.from({ length: count }).map((_, i) => (
      <svg key={i} className={`${cls} fill-yellow-400`} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>
    ))}</>
  );
}


function AppLikePreviewModal({
  onClose, onConvert, isDraft, convertingDraft,
  businessName, mainCategory, subcategories, tags, description, street, city, latitude, longitude, logoUrl, coverImageUrl, coverVideoUrl, galleryUrls, menuImageUrls, posts, eventTitle, eventDescription, events, openingHours,
  colorBadge, colorCardBg, colorButton, colorPromo,
}: {
  onClose: () => void; onConvert: () => void; isDraft: boolean; convertingDraft: boolean;
  businessName: string; mainCategory: string; subcategories: string[]; tags: string[]; description: string;
  street: string; city: string; latitude?: number | null; longitude?: number | null; logoUrl: string; coverImageUrl: string; coverVideoUrl: string; galleryUrls: string[]; menuImageUrls: string[];
  posts: BusinessPost[]; eventTitle: string; eventDescription: string; events?: any[]; openingHours: OpeningHours;
  colorBadge: string; colorCardBg: string; colorButton: string; colorPromo?: string;
}) {
  const { t } = useTranslation("bizdash");
  const [view, setView] = useState<'card' | 'detail'>('card');
  const catLabel = mainCategory ? MAIN_CATEGORIES.find(c => c.id === mainCategory)?.label : null;
  const allPhotos = [coverImageUrl, ...galleryUrls].filter(Boolean);

  const CoverMedia = ({ className }: { className: string }) => (
    coverVideoUrl
      ? <AutoVideo src={coverVideoUrl} className={className} />
      : coverImageUrl
        ? <img src={coverImageUrl} alt="" className={className} />
        : <div className={`${className} bg-gradient-to-br from-orange-400 to-orange-700`} />
  );

  return (
    <>
      <style>{`
        @keyframes gradientPulse {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient-btn {
          background: linear-gradient(90deg, #F9662B, #EE5307, #F9662B);
          background-size: 200% 100%;
          animation: gradientPulse 2s ease-in-out infinite;
        }
      `}</style>
      <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
        {/* Close button — fixed top-right above the phone */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={t("preview.close_aria")}
          className="fixed top-4 right-4 h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-white shadow-lg active:scale-90 transition-all z-[100]"
          style={{ top: "max(env(safe-area-inset-top, 0px), 16px)" }}
        >
          <X className="h-5 w-5" />
        </button>
        {/* Phone container */}
        <div
          className="relative w-full bg-background flex flex-col overflow-hidden shadow-2xl"
          style={{ maxWidth: 390, height: "min(812px, calc(100dvh - 1.5rem))", borderRadius: 32 }}
          onClick={e => e.stopPropagation()}
        >
          {view === 'card' ? (
            /* Swipe card fills the whole phone */
            <div className="flex-1 relative overflow-hidden min-h-0">
              <CoverMedia className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${colorCardBg}ee, ${colorCardBg}40, transparent)` }} />
              {catLabel && (
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm" style={{ background: colorBadge, color: "#fff" }}>
                  {catLabel}
                </div>
              )}
              {/* Info overlay */}
              <div className="absolute left-0 right-0 px-4 pr-[72px] space-y-1.5" style={{ bottom: '1.25rem' }}>
                {logoUrl && (
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-white/30 shadow-md bg-white/10">
                    <img src={logoUrl} className="w-full h-full object-cover" />
                  </div>
                )}
                <h3 className="text-xl font-black text-white leading-tight">{businessName || t("business_name_fallback")}</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-white/70 text-xs">4.6</span>
                  {street && <><span className="text-white/40 text-xs">·</span><span className="text-white/70 text-xs truncate max-w-[160px]">{street}</span></>}
                </div>
                {description && <p className="text-white/70 text-sm line-clamp-2 leading-snug">{description}</p>}
                {eventTitle && (
                  <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-xs"
                    style={{ background: "#EE5307", color: "#ffffff" }}>
                    {eventTitle}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tags.slice(0, 4).map(t => (
                      <span key={t} className="px-2.5 py-0.5 bg-white/15 rounded-full text-xs text-white/80 font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Kolumna akcji 1:1 z aplikacją (SwipeCard scrollMode): zapisz + rozwiń.
                  Rząd „Odrzuć / Dodaj" usunięty - w zakładce Miejsca go nie ma. */}
              <div className="absolute right-3 bottom-4 z-20 flex flex-col gap-3">
                <button
                  aria-label={t("card.save")}
                  className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <Bookmark className="h-5 w-5 text-foreground" strokeWidth={2} />
                </button>
                <button
                  onClick={() => setView('detail')}
                  aria-label={t("card_preview.open_full")}
                  className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                >
                  <ChevronUp className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ) : (
            /* Detail view — identyczna wizytowka jak w apce (PlaceSwiperDetail przez PremiumBusinessCard) */
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" }}>
                <PremiumBusinessCard
                  data={fromDashboardState({
                    businessName, mainCategory, subcategories, tags, description, street, city, latitude, longitude,
                    logoUrl, coverImageUrl, coverVideoUrl, galleryUrls, menuImageUrls, posts,
                    eventTitle, eventDescription, events, openingHours,
                    colorBadge, colorCardBg, colorButton,
                  })}
                  mode="detail"
                  detailPhotos={allPhotos}
                  onClose={() => setView('card')}
                  hideReviews
                />
              </div>
              {/* CTA wizytówki 1:1 z aplikacją (PlaceSwiperDetail, tryb przeglądania):
                  „Zapisz to miejsce" z brandową zakładką + ŻÓŁTE kółko udostępniania z brązową
                  ikoną. Wcześniej był tu „Odrzuć / Dodaj" (tryb dodawania do wyjazdu), przez co
                  lokal nie widział guzika zapisu ani udostępniania (zgłoszenie Nat 2026-09-14). */}
              <div className="shrink-0 flex items-center gap-3 px-4 pb-5 pt-3 border-t border-slate-100 bg-[#FEFEFE]">
                <button className="flex-1 h-11 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
                  {t("card.save_place")}
                  <BrandIcon src={SAVE_ICON} className="h-[18px] w-[18px]" />
                </button>
                <button aria-label={t("card.share_place")}
                  className="h-11 w-11 shrink-0 rounded-full bg-[#FDF184] flex items-center justify-center active:scale-90 transition-transform">
                  <Share2 className="h-5 w-5 text-[#5B2C06]" strokeWidth={2.2} />
                </button>
              </div>
            </>
          )}

          {/* Draft CTA */}
          {isDraft && (
            <div className="shrink-0 px-4 pb-4 pt-2.5 border-t border-slate-100 bg-white">
              <p className="text-xs text-foreground font-medium text-center mb-2">{t("preview.draft_cta_text")}</p>
              <button
                onClick={onConvert}
                disabled={convertingDraft}
                className="animated-gradient-btn w-full py-3 rounded-2xl text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {convertingDraft ? t("preview.wait") : t("preview.draft_convert_btn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function BusinessCardPreview({ logoUrl, coverImageUrl, coverVideoUrl, businessName, mainCategory, subcategories, tags, eventTitle, street, description, onPreviewClick, previewReady, colorBadge, colorCardBg, colorButton, colorPromo }: {
  logoUrl: string; coverImageUrl: string; coverVideoUrl: string; businessName: string; mainCategory: string;
  subcategories: string[]; tags: string[]; eventTitle: string; street?: string; description?: string;
  onPreviewClick?: () => void; previewReady?: boolean;
  colorBadge?: string; colorCardBg?: string; colorButton?: string; colorPromo?: string;
}) {
  const { t } = useTranslation("bizdash");
  const catLabel = mainCategory ? MAIN_CATEGORIES.find(c => c.id === mainCategory)?.label : null;
  const badge   = colorBadge  ?? "#D45113";
  const overlay = colorCardBg ?? "#000000";
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t("card_preview.label")}</p>
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-slate-900" style={{ aspectRatio: '9/16' }}>
        {coverVideoUrl
          ? <AutoVideo src={coverVideoUrl} className="absolute inset-0 w-full h-full object-cover" />
          : coverImageUrl
            ? <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-700" />
        }
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${overlay}ee, ${overlay}40, transparent)` }} />
        {catLabel && (
          <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm" style={{ background: badge, color: "#fff" }}>
            {catLabel}
          </div>
        )}
        <div className="absolute left-0 right-0 px-3 pr-14 space-y-1" style={{ bottom: '0.85rem' }}>
          {logoUrl && (
            <div className="h-8 w-8 rounded-full overflow-hidden border border-white/30 shadow-md bg-white/10">
              <img src={logoUrl} className="w-full h-full object-cover" />
            </div>
          )}
          <h3 className="text-base font-black text-white leading-tight">{businessName || t("business_name_fallback")}</h3>
          <div className="flex items-center gap-1 flex-wrap">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white/70 text-[10px]">4.6</span>
            {street && <><span className="text-white/40 text-[10px]">·</span><span className="text-white/70 text-[10px] truncate max-w-[120px]">{street}</span></>}
          </div>
          {description && <p className="text-white/70 text-[10px] line-clamp-2 leading-snug">{description}</p>}
          {eventTitle && (
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[9px]"
              style={{ background: "#EE5307", color: "#ffffff" }}>
              {eventTitle}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {tags.slice(0, 3).map(t => (
                <span key={t} className="px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-medium text-white/80">{t}</span>
              ))}
            </div>
          )}
        </div>
        {/* Kolumna akcji 1:1 z kartą w aplikacji (SwipeCard scrollMode, zakładka Miejsca):
            zapisz (zakładka) + rozwiń (^) w białych kółkach. Rząd „Odrzuć / Dodaj" USUNIĘTY
            (2026-09-14) - to był wygląd z dodawania miejsca do wyjazdu, a nie to, co widzi
            podróżny przeglądający Miejsca. */}
        <div className="absolute right-2.5 bottom-3 z-20 flex flex-col gap-2">
          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-lg">
            <Bookmark className="h-4 w-4 text-foreground" strokeWidth={2} />
          </div>
          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-lg">
            <ChevronUp className="h-4 w-4 text-foreground" strokeWidth={2.5} />
          </div>
        </div>
      </div>
      {onPreviewClick && (
        <button
          onClick={() => previewReady && onPreviewClick()}
          disabled={!previewReady}
          title={!previewReady ? t("card_preview.incomplete_title") : undefined}
          className="mt-3 w-full py-2.5 rounded-full text-xs font-bold border-2 border-[#D45113] text-[#D45113] hover:bg-[#D45113] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          {t("card_preview.open_full")}
        </button>
      )}
    </div>
  );
}

// Usuwanie konta biznesowego (Apple 5.1.1v). RPC delete_current_user_account kasuje
// auth.uid() + kaskadowo profil/wizytowke. Renderowane TYLKO realnemu wlascicielowi.
function BusinessDeleteAccount() {
  const { t } = useTranslation("bizdash");
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_current_user_account" as any);
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast.error(t("delete_account.error"));
      setDeleting(false);
      setConfirm(false);
    }
  };
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-red-200 hover:bg-red-50 transition-colors text-left">
        <Trash2 className="h-4 w-4 text-red-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-red-600 flex-1">{t("delete_account.button")}</span>
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4 space-y-3">
      <p className="text-sm font-bold text-red-700">{t("delete_account.confirm_title")}</p>
      <p className="text-xs text-slate-600 leading-relaxed">{t("delete_account.confirm_desc")}</p>
      <div className="flex gap-2">
        <button onClick={() => setConfirm(false)} disabled={deleting} className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-sm font-medium text-slate-700">{t("delete_account.cancel")}</button>
        <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-2xl bg-red-600 text-white text-sm font-bold disabled:opacity-60">{deleting ? t("delete_account.deleting") : t("delete_account.confirm_button")}</button>
      </div>
    </div>
  );
}

// Miniaturka menu-PDF w panelu: renderuje pierwsza strone PDF (jak w wizytowce),
// zamiast samej ikonki - zeby lokal widzial realny podglad tez przy malej rozdzielczosci.
function MenuPdfThumb({ url }: { url: string }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/lib/pdfToImages")
      .then(({ renderPdfFirstPage }) => renderPdfFirstPage(url))
      .then((d) => { if (!cancelled) setImg(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  if (img) return <img src={img} className="w-full h-full object-cover pointer-events-none" />;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50 pointer-events-none">
      <FileText className="h-6 w-6 text-red-400" />
      <span className="text-[9px] font-bold text-red-500">PDF</span>
    </div>
  );
}

const BusinessDashboard = () => {
  const { t, i18n } = useTranslation("bizdash");
  const { placeId } = useParams<{ placeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("t");

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const share = useShare();
  const [previewMode, setPreviewMode] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const analyticsRequestId = useRef(0);
  const [placeCategory, setPlaceCategory] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ views: 0, onRoutes: 0, websiteClicks: 0, phoneClicks: 0, uniqueChoices: 0, saves: 0 });
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30d');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyBucket[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mainCategory, setMainCategory] = useState("");
  // Dwie ROWNORZEDNE kategorie glowne (model z 14.09.2026). `mainCategory` zostaje jako
  // pierwsza z listy - czyta ja jeszcze apka i panel ops, wiec nie znika w jednym kroku.
  const [mainCategories, setMainCategories] = useState<string[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [secondaryCategory, setSecondaryCategory] = useState("");
  const [bizSubcategories, setBizSubcategories] = useState<string[]>([]);
  const [customVibeTag, setCustomVibeTag] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverVideoUrl, setCoverVideoUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [menuImageUrls, setMenuImageUrls] = useState<string[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  // Auto-tlumaczenie EN tytulu wydarzenia (widoczne dla zagranicznych podroznikow) +
  // flaga recznego nadpisania (wtedy nie nadpisujemy auto przy zapisie).
  const [eventTitleEn, setEventTitleEn] = useState("");
  const [eventTitleEnOverridden, setEventTitleEnOverridden] = useState(false);
  const [translatingEvent, setTranslatingEvent] = useState(false);
  // Zrodlo ostatniego auto-tlumaczenia - zeby na zapisie nie tlumaczyc w kolko tego samego tytulu.
  const lastTranslatedEventTitleRef = useRef<string>("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const [openingHours, setOpeningHours] = useState<OpeningHours>({});

  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [customSubcategory, setCustomSubcategory] = useState("");
  const [customSubcategoryStatus, setCustomSubcategoryStatus] = useState<string | null>(null);
  // Kolory wizytowki - JUZ NIE personalizowane (decyzja Nat 2026-09-14). Stale marki, zeby
  // podglad w panelu byl 1:1 z tym, co widzi uzytkownik w aplikacji. Kolumny color_* zostaja
  // w bazie i w zapisie (nie kasujemy historii), ale nic ich nie zmienia i nic ich nie czyta.
  const [colorBadge] = useState<string>("#EE5307");   // pomarancz marki (badge kategorii)
  const [colorCardBg] = useState<string>("#000000");  // overlay karty
  const [colorButton] = useState<string>("#EE5307");  // CTA "Dodaj" - jak bg-primary w apce
  const [colorPromo, setColorPromo]   = useState<string>(""); // puste = domyslny pomaranczowy
  const [plan, setPlan] = useState<BizPlan>('premium');
  const [previewTab, setPreviewTab] = useState<'basic' | 'premium'>('premium');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [reviewRequestedAt, setReviewRequestedAt] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null); // which slot is uploading
  const [isDirty, setIsDirty] = useState(false);
  // Miekki zapis (prosba Nat 2026-09-14): lokal NIE klika "Zapisz zmiany" - zmiany lecą same
  // po ~1,4 s bezczynności. Status w belce: "Zapisywanie..." / "Zapisano". idle = brak zmian.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastGeoAddrRef = useRef<string | null>(null); // ostatnio geokodowany adres - bez powtórnych płatnych zapytań

  const [activeSection, setActiveSection] = useState<BizSection>('overview');
  // Sekcja "Od użytkowników" (Nat 2026-09-14): notki i zdjęcia userów o TYM miejscu (te same,
  // które widać na wizytówce). Read + zgłoszenie do moderacji (biznes nie kasuje UGC sam).
  type CommunityPhoto = { id: string; photo_url: string; user_id: string | null; created_at: string; username: string | null; avatar_url: string | null };
  const [communityNotes, setCommunityNotes] = useState<PlaceUserNote[]>([]);
  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhoto[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [reportedKeys, setReportedKeys] = useState<Set<string>>(new Set());
  const [recentEvents, setRecentEvents] = useState<Array<{event_type: string, created_at: string}>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; label: string } | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [showAppPreview, setShowAppPreview] = useState(false);
  const [convertingDraft, setConvertingDraft] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  // Zgody mailowe lokalu (kolumny notify_* - migracja 20260915e). Zapis od razu przy
  // przelaczeniu: to zgoda, a nie pole formularza, wiec nie moze czekac na miekki zapis.
  const [notifyPrefs, setNotifyPrefs] = useState({ newNote: true, weeklyDigest: true, news: false });

  // Posts state
  const [posts, setPosts] = useState<BusinessPost[]>([]);
  const [postDescription, setPostDescription] = useState("");
  const [postPhotos, setPostPhotos] = useState<string[]>([]);
  const [postPhotoUploading, setPostPhotoUploading] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  // Wydarzenia (kolejka + historia) - tabela business_events, brak w types.ts -> (supabase as any)
  const [events, setEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventStartsAt, setNewEventStartsAt] = useState("");
  const [newEventEndsAt, setNewEventEndsAt] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventDraft, setNewEventDraft] = useState(false);
  const [showEventHistory, setShowEventHistory] = useState(false);
  // Edycja inline istniejacego wydarzenia (tylko nadchodzace/aktywne).
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState("");
  const [editEventDescription, setEditEventDescription] = useState("");
  const [editEventStartsAt, setEditEventStartsAt] = useState("");
  const [editEventEndsAt, setEditEventEndsAt] = useState("");
  const [editEventStartTime, setEditEventStartTime] = useState("");
  const [editEventEndTime, setEditEventEndTime] = useState("");
  const [savingEditEvent, setSavingEditEvent] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  // Kadrowanie: kolejka plikow do skadrowania (logo 1:1 kolo, galeria 4:3).
  const [cropJob, setCropJob] = useState<{ files: File[]; index: number; target: "logo" | "gallery"; aspect: number; shape: "rect" | "round" } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverVideoInputRef = useRef<HTMLInputElement>(null);
  // PointerEvent-based DnD dla galerii - HTML5 drag nie dziala na touch screens.
  // Drag rozpoczyna sie tylko od explicit handle (GripVertical), nie od calej karty.
  const [galleryDragIdx, setGalleryDragIdx] = useState<number | null>(null);
  const [galleryTargetIdx, setGalleryTargetIdx] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const menuInputRef = useRef<HTMLInputElement>(null);
  const postPhotoInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  // Panel startuje PO POLSKU (prosba Nat 2026-09-14) - chyba ze lokal sam przelaczyl PL/EN.
  useEffect(() => { applyBusinessDefaultLanguage(); }, []);

  useEffect(() => {
    if (!placeId) return;
    if (authLoading) return; // wait for Supabase session to resolve before deciding what to show
    if (!user && !previewToken) {
      // Redirect unauthenticated visitors to business login (preserves return path)
      navigate(`/auth?business=true&return=${encodeURIComponent(`/biznes/${placeId}`)}`, { replace: true });
      return;
    }
    // Powrot do karty (focus) odswieza token -> nowy obiekt `user` (ten sam id) -> efekt
    // re-odpalal loadData i migal loaderem. Laduj tylko raz na (user.id + placeId).
    const loadKey = `${user?.id ?? previewToken ?? "anon"}:${placeId}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;
    loadData();
  }, [user, placeId, previewToken, authLoading]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Debounced auto-save for draft text fields (1.5s after last keystroke)
  useEffect(() => {
    if (!isDraft || !isDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { autoSaveDraft(); }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [businessName, description, street, city, phone, email, website, tags, mainCategory]);

  const loadData = async (bypass = false) => {
    if (!placeId) return;
    if (!user && !previewToken && !bypass) return;
    setLoading(true);
    try {

    // Pelny wiersz (z email / preview_token) przez RPC: od audytu 2026-09-14 tabela ma kolumnowe
    // granty SELECT (anon widzi tylko to, co widok business_profiles_public), wiec select("*")
    // konczylby sie "permission denied". RPC szuka po place_id, potem po id, i oddaje wiersz
    // wlascicielowi, adminowi albo podgladowi z poprawnym ?t=<preview_token>.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let profileData: any = null;
    if (UUID_RE.test(placeId)) {
      const { data, error: rpcErr } = await (supabase as any)
        .rpc("business_profile_for_dashboard", { p_key: placeId, p_token: previewToken ?? null })
        .maybeSingle();
      if (rpcErr) console.warn("[BusinessDashboard] business_profile_for_dashboard:", rpcErr.message);
      profileData = data ?? null;
    }

    if (!profileData) {
      setAccessDenied(true);
      setLoading(false);
      if (bypass) toast.error(t("toast.profile_not_found"));
      return;
    }

    const HARDCODED_ADMINS = new Set(["nat.maz98@gmail.com", "tomalab97@gmail.com"]);
    const isHardcodedAdmin = !!(user?.email && HARDCODED_ADMINS.has(user.email));

    if (isHardcodedAdmin) {
      setIsAdminUser(true);
    } else if (bypass) {
      setPreviewMode(true);
    } else if (user) {
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      const isAdmin = !!roleData;
      setIsAdminUser(isAdmin);

      if (profileData.owner_user_id !== user.id && !isAdmin) {
        setAccessDenied(true); setLoading(false); return;
      }
    } else if (previewToken) {
      if ((profileData as any).preview_token !== previewToken) {
        setAccessDenied(true); setLoading(false); return;
      }
      setPreviewMode(true);
    }

    // Fetch place category
    const { data: placeData } = await supabase.from("places").select("category").eq("id", placeId).maybeSingle();
    setPlaceCategory((placeData as any)?.category ?? null);

    setProfile(profileData as BusinessProfile);
    setIsDraft(!!(profileData as any).is_draft);
    // All businesses get premium access
    setPlan('premium');
    setBusinessName(profileData.business_name ?? "");

    // Identify user and group by business in PostHog
    if (user) {
      posthog.identify(user.id, { email: user.email });
      posthog.group("business", profileData.id, { name: profileData.business_name ?? "Bez nazwy", place_id: placeId });
    }
    setPhone(profileData.phone ?? "");
    setEmail(profileData.email ?? "");
    setWebsite(profileData.website ?? "");
    const socialLinks = ((profileData as any).social_links ?? {}) as { instagram?: string; facebook?: string };
    setInstagram(socialLinks.instagram ?? "");
    setFacebook(socialLinks.facebook ?? "");
    setStreet(profileData.street ?? "");
    setCity(profileData.city ?? "");
    setPostalCode(profileData.postal_code ?? "");
    setTags(profileData.tags ?? []);
    setMainCategory(profileData.main_category ?? "");
    setSecondaryCategory((profileData as any).secondary_category ?? "");
    {
      // Zrodlem prawdy jest `main_categories[]`; helper ogarnia tez stare wiersze
      // (main_category + secondary_category), zeby nikt nie stracil wyboru przy wejsciu.
      const mains = readMainCategories(profileData as any);
      setMainCategories(mains);
      // Podkategorie potrafia byc zapisane jako polskie etykiety - panel pracuje na id.
      const stored = (profileData.subcategories ?? []) as string[];
      setBizSubcategories(stored.map(v => normalizeSubcategoryId(v) ?? v));
    }
    setCustomSubcategory((profileData as any).custom_subcategory ?? "");
    setCustomSubcategoryStatus((profileData as any).custom_subcategory_status ?? null);
    setDescription(profileData.description ?? "");
    setNotifyPrefs({
      newNote: (profileData as any).notify_new_note ?? true,
      weeklyDigest: (profileData as any).notify_weekly_digest ?? true,
      news: (profileData as any).notify_news ?? false,
    });
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setCoverVideoUrl((profileData as any).cover_video_url ?? "");
    setGalleryUrls(profileData.gallery_urls ?? []);
    setMenuImageUrls(profileData.menu_image_urls ?? []);
    // color_* NIE sa juz wczytywane z bazy - podglad zawsze w kolorach marki (patrz wyzej).
    setColorPromo("");
    setOpeningHours(((profileData as any).opening_hours ?? {}) as OpeningHours);
    setEventTitle(profileData.event_title ?? "");
    setEventTitleEn((profileData as any).event_title_en ?? "");
    setEventTitleEnOverridden((profileData as any).event_title_en_overridden ?? false);
    lastTranslatedEventTitleRef.current = profileData.event_title ?? "";
    setEventDescription(profileData.event_description ?? "");
    setEventStartsAt(profileData.event_starts_at ?? "");
    setEventEndsAt(profileData.event_ends_at ?? "");
    setReviewRequestedAt(profileData.review_requested_at ?? null);
    setIsDirty(false);

    // Welcome banner: show if activated within last 7 days and not dismissed
    const welcomeKey = `welcome_seen_${profileData.id}`;
    if (profileData.activated_at && !localStorage.getItem(welcomeKey)) {
      const activatedMs = Date.now() - new Date(profileData.activated_at).getTime();
      if (activatedMs < 7 * 24 * 60 * 60 * 1000) setShowWelcomeBanner(true);
    }

    // Verified notification: show if verified but user hasn't seen notification yet
    if (profileData.is_verified && !profileData.verification_notified_at) {
      setShowVerifiedBanner(true);
    }

    // Use places.id for PostHog queries - events are tracked with places.id, not business_profiles.id
    const analyticsPlaceId = profileData.place_id ?? placeId;

    // Fetch recent events from PostHog (skip in preview/bypass — anon may not have access)
    if (user) {
      const { data: phRecent } = await supabase.functions.invoke("posthog-analytics", {
        body: { place_id: analyticsPlaceId, range_days: 90, include_recent: true },
      });
      if (phRecent?.recentEvents) setRecentEvents(phRecent.recentEvents);
    }

    // loadAnalytics is triggered by useEffect when profile state updates

    // Fetch posts — tylko gdy wizytowka ma realny place_id (podlinkowane miejsce).
    // Bez tego (self-service, place_id NULL) posty sa lokalne/preview, brak w DB.
    const postsPlaceId = profileData.place_id ?? null;
    if (postsPlaceId) {
      const { data: postsData } = await (supabase as any)
        .from("business_posts").select("*").eq("place_id", postsPlaceId).order("created_at", { ascending: false });
      if (postsData) setPosts(postsData as BusinessPost[]);
    }

    // Fetch zaplanowane wydarzenia (kolejka + historia) - powiazane z business_profiles.id
    const { data: eventsData } = await (supabase as any)
      .from("business_events").select("*").eq("business_profile_id", profileData.id).order("starts_at", { ascending: true });
    if (eventsData) setEvents(eventsData);
    } finally {
      setLoading(false);
    }
  };

  // ── Driver.js onboarding tour ──
  const startTour = useCallback(() => {
    if (!profile) return;
    const isMobile = window.innerWidth < 768;
    const driverObj = driver({
      showProgress: true,
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      steps: [
        {
          element: isMobile ? '#tour-mobile-profile' : '#tour-profile',
          popover: { title: t('tour.profile_title'), description: t('tour.profile_desc'), side: isMobile ? 'bottom' : 'right' },
          onHighlightStarted: () => setActiveSection('profile'),
        },
        {
          element: isMobile ? '#tour-mobile-gallery' : '#tour-gallery',
          popover: { title: t('tour.gallery_title'), description: t('tour.gallery_desc'), side: isMobile ? 'bottom' : 'right' },
          onHighlightStarted: () => setActiveSection('gallery'),
        },
        {
          element: isMobile ? '#tour-mobile-menu' : '#tour-menu',
          popover: { title: t('tour.menu_title'), description: t('tour.menu_desc'), side: isMobile ? 'bottom' : 'right' },
          onHighlightStarted: () => setActiveSection('menu'),
        },
        {
          element: isMobile ? '#tour-mobile-posts' : '#tour-posts',
          popover: { title: t('tour.posts_title'), description: t('tour.posts_desc'), side: isMobile ? 'bottom' : 'right' },
          onHighlightStarted: () => setActiveSection('posts'),
        },
      ],
      onDestroyed: () => {
        if (profile?.id) localStorage.setItem(`tour_seen_v2_${profile.id}`, '1');
      },
    });
    driverObj.drive();
  }, [profile]);

  // Auto-start tour on first visit — only after loading finishes AND user is on overview.
  // Skip in draft (demo) mode — tour is for owners learning their real panel, not demo.
  //
  // Tour pokazuje sie TYLKO swiezo zarejestrowanym firmom (activated_at < 7 dni). Legacy
  // profile (activated_at = null) oraz stare konta - brak auto-tour. Manualny "Powtorz
  // tour" w sidebarze dziala niezaleznie od tych warunkow.
  useEffect(() => {
    if (!profile || loading || activeSection !== 'profile' || isDraft) return;
    const activatedAt = (profile as any).activated_at as string | null | undefined;
    if (!activatedAt) return;
    const FRESH_ACTIVATION_MS = 7 * 24 * 60 * 60 * 1000;
    const ageMs = Date.now() - new Date(activatedAt).getTime();
    if (ageMs >= FRESH_ACTIVATION_MS) return;
    const seen = localStorage.getItem(`tour_seen_v2_${profile.id}`);
    if (!seen) {
      const t = setTimeout(() => startTour(), 600);
      return () => clearTimeout(t);
    }
  }, [profile?.id, (profile as any)?.activated_at, loading, activeSection, isDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const PRESET_DAYS: Record<Exclude<AnalyticsRange, 'custom'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

  const rangeFromPreset = (range: Exclude<AnalyticsRange, 'custom'>): { from: Date; to: Date } => ({
    from: startOfDay(subDays(new Date(), PRESET_DAYS[range] - 1)),
    to: endOfDay(new Date()),
  });

  const loadAnalytics = useCallback(async (pid: string, from: Date, to: Date) => {
    const reqId = ++analyticsRequestId.current;
    setAnalyticsLoading(true);
    const rangeDays = differenceInCalendarDays(to, from) + 1;

    // Query PostHog via Edge Function (primary source)
    const { data: phData, error: phError } = await supabase.functions.invoke("posthog-analytics", {
      body: { place_id: pid, range_days: rangeDays },
    });

    // Ignore stale responses (user switched range while request was in flight)
    if (reqId !== analyticsRequestId.current) return;

    if (phData && !phError) {
      setStats({
        views: phData.views ?? 0,
        onRoutes: phData.onRoutes ?? 0,
        websiteClicks: phData.websiteClicks ?? 0,
        phoneClicks: phData.phoneClicks ?? 0,
        uniqueChoices: 0,
        saves: phData.saves ?? 0,
        previous: phData.previous,
      });

      const numDays = rangeDays;
      const dayMap: Record<string, ChartDay> = {};
      for (let i = 0; i < numDays; i++) {
        const d = addDays(from, i);
        const key = format(d, "yyyy-MM-dd");
        dayMap[key] = { date: format(d, numDays <= 14 ? "d MMM" : "d MMM", { locale: dateLocale() }), views: 0, routes: 0, clicks: 0 };
      }
      (phData.chartData ?? []).forEach((row: { date: string; views: number; routes: number; clicks: number }) => {
        if (dayMap[row.date]) {
          dayMap[row.date].views = row.views;
          dayMap[row.date].routes = row.routes;
          dayMap[row.date].clicks = row.clicks;
        }
      });
      setChartData(Object.values(dayMap));
      setHourlyData(Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}:00`, total: 0 })));
    }
    setAnalyticsLoading(false);
  }, []);

  // Close calendar on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCalendar]);

  useEffect(() => {
    if (!placeId || !profile) return;
    const analyticsPlaceId = profile.place_id ?? placeId;
    if (analyticsRange === 'custom') {
      if (!customDateRange?.from) return;
      loadAnalytics(analyticsPlaceId, startOfDay(customDateRange.from), endOfDay(customDateRange.to ?? customDateRange.from));
    } else {
      const { from, to } = rangeFromPreset(analyticsRange);
      loadAnalytics(analyticsPlaceId, from, to);
    }
  }, [analyticsRange, customDateRange, placeId, profile, loadAnalytics]);

  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB - menu PDF moze byc wieksze niz zdjecie

  const uploadFile = async (file: File, folder: string, opts?: { allowPdf?: boolean }): Promise<string> => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf && !opts?.allowPdf) throw new Error(t("upload.invalid_format"));
    // HEIC/HEIF (domyslny format iPhone'a) -> konwersja do JPEG PRZED walidacja formatu.
    // Bez tego iPhone'owe zdjecia byly odrzucane na ALLOWED_MIME i nie renderowaly sie
    // na nie-Apple urzadzeniach.
    if (!isPdf && isHeic(file)) file = await convertHeicToJpeg(file);
    if (!isPdf && !ALLOWED_MIME.includes(file.type)) {
      throw new Error(opts?.allowPdf ? t("upload.invalid_format_pdf") : t("upload.invalid_format"));
    }
    if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE)) throw new Error(t("upload.too_large", { max: isPdf ? 10 : 5 }));
    // PDF wgrywamy bez przetwarzania (resizeImage to canvas - zniszczyloby PDF).
    // Obrazy: resize + recompress zeby byly male i szybko sie ladowaly (src/lib/imageResize.ts).
    const body = isPdf ? file : await resizeImage(file);
    const ext = isPdf ? "pdf" : (body.name.split(".").pop() ?? "jpg");
    // Use profile.id as the storage folder (stable even when placeId is a UUID fallback)
    const folder_key = profile?.id ?? placeId;
    const path = `${folder_key}/${folder}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("business-photos").upload(path, body, { upsert: true, contentType: isPdf ? "application/pdf" : undefined });
    if (error) throw new Error(error.message);
    // Miniatura obok pliku - kafelki w apce ciagnely wczesniej oryginal (w tym buckecie
    // srednio 3 MB). PDF-y menu pomijamy, nie ma z czego zrobic podgladu.
    if (!isPdf) await uploadThumb("business-photos", path, body);
    return supabase.storage.from("business-photos").getPublicUrl(data.path).data.publicUrl;
  };

  // Logo: najpierw kadrowanie (kolo 1:1 - lokal skaluje/pozycjonuje znak), potem upload.
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropJob({ files: [file], index: 0, target: "logo", aspect: 1, shape: "round" });
  };

  // Upload skadrowanego pliku (z modala) + kolejka (galeria = wiele plikow po kolei).
  const handleCropped = async (croppedFile: File) => {
    if (!cropJob) return;
    const { target, files, index } = cropJob;
    setUploading(target);
    try {
      const url = await uploadFile(croppedFile, target);
      if (target === "logo") {
        setLogoUrl(url);
        setIsDirty(true);
        if (isDraft) await autoSaveDraft({ logoUrl: url });
      } else {
        setGalleryUrls(prev => [...prev, url]);
        setIsDirty(true);
      }
    } catch (err: any) {
      toast.error(err?.message ?? t(target === "logo" ? "upload.logo_error" : "upload.photos_error"));
    }
    setUploading(null);
    if (index + 1 < files.length) setCropJob({ ...cropJob, index: index + 1 });
    else setCropJob(null);
  };

  const handleCropCancel = () => {
    if (!cropJob) return;
    if (cropJob.index + 1 < cropJob.files.length) setCropJob({ ...cropJob, index: cropJob.index + 1 });
    else setCropJob(null);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("cover");
    try {
      const url = await uploadFile(file, "cover");
      setCoverImageUrl(url);
      // Okladka = tylko zdjecia (opcja filmiku wycofana na start). Nowe zdjecie zastepuje
      // ewentualny starszy filmik (wyswietlanie priorytetuje video), zeby zmiana byla widoczna.
      setCoverVideoUrl("");
      setIsDirty(true);
      if (isDraft) await autoSaveDraft({ coverImageUrl: url, coverVideoUrl: "" });
    } catch (err: any) { toast.error(err.message ?? t("upload.cover_error")); }
    setUploading(null);
  };

  const handleCoverVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // validate duration
    const duration = await new Promise<number>((resolve, reject) => {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => { URL.revokeObjectURL(vid.src); resolve(vid.duration); };
      vid.onerror = reject;
      vid.src = URL.createObjectURL(file);
    }).catch(() => Infinity);
    if (duration > 7.5) {
      toast.error(t("upload.video_too_long"));
      e.target.value = "";
      return;
    }
    setUploading("cover_video");
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const folder_key = profile?.id ?? placeId;
      const path = `${folder_key}/cover_video/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("business-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const url = supabase.storage.from("business-photos").getPublicUrl(data.path).data.publicUrl;
      setCoverVideoUrl(url);
      setIsDirty(true);
      if (isDraft) await autoSaveDraft({ coverVideoUrl: url });
    } catch (err: any) { toast.error(err.message ?? t("upload.video_error")); }
    setUploading(null);
    e.target.value = "";
  };

  const handleCoverMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (isVideo) {
      const duration = await new Promise<number>((resolve) => {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => { URL.revokeObjectURL(vid.src); resolve(vid.duration); };
        vid.onerror = () => resolve(Infinity);
        vid.src = URL.createObjectURL(file);
      });
      if (duration > 7.5) {
        toast.error(t("upload.video_too_long"));
        e.target.value = "";
        return;
      }
      setUploading("cover_video");
      try {
        const ext = file.name.split(".").pop() ?? "mp4";
        const folder_key = profile?.id ?? placeId;
        const path = `${folder_key}/cover_video/${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage
          .from("business-photos")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(error.message);
        const url = supabase.storage.from("business-photos").getPublicUrl(data.path).data.publicUrl;
        setCoverVideoUrl(url);
        setCoverImageUrl("");
        setIsDirty(true);
        if (isDraft) await autoSaveDraft({ coverVideoUrl: url, coverImageUrl: "" });
      } catch (err: any) { toast.error(err.message ?? t("upload.video_error")); }
    } else {
      setUploading("cover");
      try {
        const url = await uploadFile(file, "cover");
        setCoverImageUrl(url);
        setCoverVideoUrl("");
        setIsDirty(true);
        if (isDraft) await autoSaveDraft({ coverImageUrl: url, coverVideoUrl: "" });
      } catch (err: any) { toast.error(err.message ?? t("upload.cover_error_short")); }
    }
    setUploading(null);
    e.target.value = "";
  };

  // Galeria: kadrowanie kazdego zdjecia do 4:3 (proporcja wizytowki) po kolei, potem upload.
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const remaining = MAX_GALLERY - galleryUrls.length;
    const toCrop = files.slice(0, remaining);
    if (!toCrop.length) return;
    setCropJob({ files: toCrop, index: 0, target: "gallery", aspect: 4 / 3, shape: "rect" });
  };

  const removeGalleryPhoto = (idx: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading("menu");
    try {
      const additions: string[] = [];
      for (const f of files) {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (isPdf) {
          // PDF menu/cennika: rasteryzujemy strony na obrazy (podglad INLINE w wizytowce,
          // proporcja 4:3). Graceful fallback: gdy pdf.js zawiedzie, zostaje sam plik PDF
          // (kafelek "Otworz PDF") - dotychczasowe zachowanie, zero regresji.
          let pageImages: string[] = [];
          try {
            const { pdfToJpegFiles } = await import("@/lib/pdfToImages");
            const pages = await pdfToJpegFiles(f);
            pageImages = await Promise.all(pages.map(p => uploadFile(p, "menu")));
          } catch (err) {
            console.warn("[menu] rasteryzacja PDF nie powiodla sie, zapisuje sam PDF:", err);
          }
          const pdfUrl = await uploadFile(f, "menu", { allowPdf: true });
          // Obrazy stron najpierw (podglad), pelny PDF na koncu (kafelek "otworz").
          additions.push(...pageImages, pdfUrl);
        } else {
          additions.push(await uploadFile(f, "menu", { allowPdf: true }));
        }
      }
      setMenuImageUrls(prev => [...prev, ...additions].slice(0, MAX_MENU_IMAGES));
      setIsDirty(true);
    } catch (err: any) { toast.error(err.message ?? t("upload.photos_error")); }
    setUploading(null);
    e.target.value = "";
  };

  const removeMenuImage = (idx: number) => {
    setMenuImageUrls(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handlePostPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPostPhotoUploading(true);
    try {
      const urls = await Promise.all(files.slice(0, 4 - postPhotos.length).map(f => uploadFile(f, "posts")));
      setPostPhotos(prev => [...prev, ...urls]);
    } catch { toast.error(t("upload.photo_error")); }
    setPostPhotoUploading(false);
    e.target.value = "";
  };

  const handleAddPost = async () => {
    if (!postDescription.trim() && postPhotos.length === 0) return;
    // TYLKO realny place_id z profilu. Dla wizytowki bez podlinkowanego miejsca
    // (self-service, place_id NULL) placeId z URL = business_profile.id, NIE miejsce
    // -> insert do business_posts by padl na RLS/FK. Brak place_id => post lokalny
    // (podglad); persystuje dopiero gdy wizytowka zostanie zaakceptowana (dostaje place_id).
    const effectivePlaceId = profile?.place_id ?? null;
    setSubmittingPost(true);
    if (!effectivePlaceId) {
      // Draft without a real place — add locally so user can preview
      const localPost: BusinessPost = {
        id: `local-${Date.now()}`,
        place_id: "",
        description: postDescription.trim() || null,
        photo_urls: postPhotos,
        created_at: new Date().toISOString(),
      };
      setPosts(prev => [localPost, ...prev]);
      setPostDescription("");
      setPostPhotos([]);
      if (postPhotoInputRef.current) postPhotoInputRef.current.value = "";
      toast.success(t("posts.local_added"));
      setSubmittingPost(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("business_posts")
      .insert({ place_id: effectivePlaceId, description: postDescription.trim() || null, photo_urls: postPhotos })
      .select()
      .single();
    if (error) { toast.error(t("posts.add_error")); }
    else {
      setPosts(prev => [data as BusinessPost, ...prev]);
      setPostDescription("");
      setPostPhotos([]);
      if (postPhotoInputRef.current) postPhotoInputRef.current.value = "";
      toast.success(t("posts.added"));
    }
    setSubmittingPost(false);
  };

  const handleDeletePost = (id: string) => {
    // Soft-delete z oknem cofniecia (5s): usuwamy z UI od razu, realny DELETE z bazy
    // odpala sie dopiero po uplywie okna - w miedzyczasie "Cofnij" przywraca post bez
    // odpytywania bazy. Zastepuje twarde window.confirm("...nie mozna cofnac").
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return;
    const snapshot = posts[index];
    setPosts(prev => prev.filter(p => p.id !== id));

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const { error } = await (supabase as any).from("business_posts").delete().eq("id", id);
      if (error) {
        toast.error(t("posts.delete_error"));
        setPosts(prev => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, snapshot);
          return next;
        });
      }
    }, 5000);

    toast(t("posts.deleted"), {
      duration: 5000,
      action: {
        label: t("posts.undo"),
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setPosts(prev => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, snapshot);
            return next;
          });
        },
      },
    });
  };

  // Reczne tlumaczenie tytulu wydarzenia (przycisk). Ustawia auto (nie override).
  const handleTranslateEvent = async () => {
    if (!eventTitle.trim() || translatingEvent) return;
    setTranslatingEvent(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: { text: eventTitle.trim(), target_lang: "en", context: "event_title" },
      });
      if (error) throw error;
      const translation = (data as any)?.translation;
      if (translation) {
        setEventTitleEn(translation);
        setEventTitleEnOverridden(false);
        lastTranslatedEventTitleRef.current = eventTitle.trim();
        setIsDirty(true);
      }
    } catch {
      toast.error(t("posts.event_translate_error"));
    } finally {
      setTranslatingEvent(false);
    }
  };

  // Sort rosnaco po starts_at (string "YYYY-MM-DD" porownuje sie leksykalnie).
  const sortEventsAsc = (list: any[]) =>
    [...list].sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0));

  // Format zakresu dat wydarzenia na ekranie.
  const fmtEventRange = (ev: any) => {
    const start = format(parseISO(ev.starts_at), "d MMM", { locale: dateLocale() });
    let dateStr = start;
    if (ev.ends_at && ev.ends_at !== ev.starts_at) {
      dateStr = `${start} - ${format(parseISO(ev.ends_at), "d MMM", { locale: dateLocale() })}`;
    }
    // Godzina (opcjonalna) dopisana po dacie: "20 lip · 18:00 - 22:00".
    const st = ev.start_time ? String(ev.start_time).slice(0, 5) : null;
    const et = ev.end_time ? String(ev.end_time).slice(0, 5) : null;
    if (st) dateStr += ` · ${et ? `${st} - ${et}` : st}`;
    return dateStr;
  };

  const handleAddEvent = async () => {
    if (!profile) return;
    const title = newEventTitle.trim();
    if (!title) { toast.error(t("posts.events_title_required")); return; }
    if (!newEventStartsAt) { toast.error(t("posts.events_start_required")); return; }
    if (newEventEndsAt && newEventEndsAt < newEventStartsAt) { toast.error(t("posts.events_date_error")); return; }
    setAddingEvent(true);
    const { data, error } = await (supabase as any)
      .from("business_events")
      .insert({
        business_profile_id: profile.id,
        place_id: profile.place_id ?? null,
        title,
        starts_at: newEventStartsAt,
        ends_at: newEventEndsAt || null,
        start_time: newEventStartTime || null,
        end_time: newEventEndTime || null,
        is_draft: newEventDraft,
      })
      .select()
      .single();
    if (error || !data) { toast.error(t("posts.events_add_error")); setAddingEvent(false); return; }
    let inserted = data;
    // Opis OSOBNYM best-effort update (kolumna description moze nie istniec przed migracja).
    const desc = newEventDescription.trim() || null;
    if (desc) {
      try {
        await (supabase as any).from("business_events").update({ description: desc }).eq("id", data.id);
        inserted = { ...inserted, description: desc };
      } catch { /* dodaj wydarzenie nawet gdy opis padnie (brak kolumny) */ }
    }
    // Auto-tlumaczenie tytulu na EN (best-effort) - wzor jak handleTranslateEvent.
    try {
      const { data: tr } = await supabase.functions.invoke("translate-content", {
        body: { text: title, target_lang: "en", context: "event_title" },
      });
      const translation = (tr as any)?.translation;
      if (translation) {
        await (supabase as any).from("business_events").update({ title_en: translation }).eq("id", data.id);
        inserted = { ...data, title_en: translation };
      }
    } catch { /* dodaj wydarzenie nawet gdy tlumaczenie padnie */ }
    setEvents(prev => sortEventsAsc([...prev, inserted]));
    setNewEventTitle("");
    setNewEventDescription("");
    setNewEventStartsAt("");
    setNewEventEndsAt("");
    setNewEventStartTime("");
    setNewEventEndTime("");
    setNewEventDraft(false);
    toast.success(t("posts.events_added"));
    setAddingEvent(false);
  };

  const handleDeleteEvent = (id: string) => {
    // Soft-delete z oknem cofniecia (5s) - wzor jak handleDeletePost.
    const index = events.findIndex(e => e.id === id);
    if (index === -1) return;
    const snapshot = events[index];
    setEvents(prev => prev.filter(e => e.id !== id));

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      const { error } = await (supabase as any).from("business_events").delete().eq("id", id);
      if (error) {
        toast.error(t("posts.events_delete_error"));
        setEvents(prev => sortEventsAsc([...prev, snapshot]));
      }
    }, 5000);

    toast(t("posts.events_deleted"), {
      duration: 5000,
      action: {
        label: t("posts.undo"),
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setEvents(prev => sortEventsAsc([...prev, snapshot]));
        },
      },
    });
  };

  // Publikacja / cofniecie do szkicu (optimistic + rollback).
  const handleTogglePublish = async (ev: any) => {
    const next = !ev.is_draft;
    setEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, is_draft: next } : e)));
    const { error } = await (supabase as any)
      .from("business_events")
      .update({ is_draft: next })
      .eq("id", ev.id);
    if (error) {
      setEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, is_draft: ev.is_draft } : e)));
      toast.error(t("posts.events_update_error"));
    }
  };

  // Wejscie w tryb edycji inline wydarzenia.
  const handleStartEditEvent = (ev: any) => {
    setEditingEventId(ev.id);
    setEditEventTitle(ev.title ?? "");
    setEditEventDescription(ev.description ?? "");
    setEditEventStartsAt(ev.starts_at ?? "");
    setEditEventEndsAt(ev.ends_at ?? "");
    // DB zwraca "18:00:00" - input type="time" oczekuje "HH:MM".
    setEditEventStartTime(ev.start_time ? String(ev.start_time).slice(0, 5) : "");
    setEditEventEndTime(ev.end_time ? String(ev.end_time).slice(0, 5) : "");
  };

  const handleUpdateEvent = async (id: string) => {
    const title = editEventTitle.trim();
    if (!title) { toast.error(t("posts.events_title_required")); return; }
    if (!editEventStartsAt) { toast.error(t("posts.events_start_required")); return; }
    if (editEventEndsAt && editEventEndsAt < editEventStartsAt) { toast.error(t("posts.events_date_error")); return; }
    const current = events.find(e => e.id === id);
    if (!current) return;
    setSavingEditEvent(true);
    const { error } = await (supabase as any)
      .from("business_events")
      .update({ title, starts_at: editEventStartsAt, ends_at: editEventEndsAt || null, start_time: editEventStartTime || null, end_time: editEventEndTime || null })
      .eq("id", id);
    if (error) { toast.error(t("posts.events_update_error")); setSavingEditEvent(false); return; }
    const desc = editEventDescription.trim() || null;
    let updated = { ...current, title, description: desc, starts_at: editEventStartsAt, ends_at: editEventEndsAt || null, start_time: editEventStartTime || null, end_time: editEventEndTime || null };
    // Opis OSOBNYM best-effort update (kolumna description moze nie istniec przed migracja).
    try { await (supabase as any).from("business_events").update({ description: desc }).eq("id", id); }
    catch { /* zapisz zmiane nawet gdy opis padnie */ }
    // Re-tlumaczenie EN gdy tytul sie zmienil i lokal go nie nadpisal recznie (best-effort).
    if (title !== current.title && !current.title_en_overridden) {
      try {
        const { data: tr } = await supabase.functions.invoke("translate-content", {
          body: { text: title, target_lang: "en", context: "event_title" },
        });
        const translation = (tr as any)?.translation;
        if (translation) {
          await (supabase as any).from("business_events").update({ title_en: translation }).eq("id", id);
          updated = { ...updated, title_en: translation };
        }
      } catch { /* zapisz zmiane nawet gdy tlumaczenie padnie */ }
    }
    setEvents(prev => sortEventsAsc(prev.map(e => (e.id === id ? updated : e))));
    setEditingEventId(null);
    setSavingEditEvent(false);
    toast.success(t("posts.events_updated"));
  };

  // Explicit "Zapisz" (fallback) i miekki auto-zapis dziela jeden zapis do bazy. silent=true:
  // bez toastów i bez spinnera guzika - tylko status "Zapisywanie/Zapisano" w belce.
  const persistProfile = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!profile) return;
    if (eventStartsAt && eventEndsAt && eventEndsAt < eventStartsAt) {
      if (!silent) toast.error(t("save.event_date_error"));
      return;
    }
    if (silent) setSaveStatus('saving'); else setSaving(true);

    // Auto-tlumaczenie EN tytulu wydarzenia gdy lokal go nie nadpisal recznie i tytul
    // sie zmienil od ostatniego tlumaczenia. Pusty tytul -> pusty EN.
    let eventTitleEnToSave = eventTitleEn;
    if (!eventTitle.trim()) {
      eventTitleEnToSave = "";
    } else if (!eventTitleEnOverridden && eventTitle.trim() !== lastTranslatedEventTitleRef.current) {
      try {
        const { data } = await supabase.functions.invoke("translate-content", {
          body: { text: eventTitle.trim(), target_lang: "en", context: "event_title" },
        });
        if ((data as any)?.translation) {
          eventTitleEnToSave = (data as any).translation;
          lastTranslatedEventTitleRef.current = eventTitle.trim();
        }
      } catch { /* zapisz profil nawet gdy tlumaczenie padnie */ }
    }
    setEventTitleEn(eventTitleEnToSave);

    // Trigger review if profile looks complete and not already requested
    const isComplete = businessName.trim() && phone.trim();
    const nowIso = new Date().toISOString();
    const reviewAt = isComplete && !reviewRequestedAt ? nowIso : reviewRequestedAt;

    // Geokoduj adres -> business_profiles.latitude/longitude. Tym nadpisujemy pozycje pinu
    // na mapie (enrichWithBusinessProfile), bo places nie ma innego zrodla wspolrzednych
    // i biznes nie ma RLS do edycji places. Geokodujemy tylko gdy adres sie zmienil albo
    // brak wspolrzednych - zeby nie wolac Google przy kazdym zapisie.
    const prevAddr = lastGeoAddrRef.current ?? `${(profile as any).street ?? ""}|${(profile as any).city ?? ""}|${(profile as any).postal_code ?? ""}`;
    const curAddr = `${street}|${city}|${postalCode}`;
    let geoCoords: { latitude: number; longitude: number } | null = null;
    if (street.trim() && (curAddr !== prevAddr || (profile as any).latitude == null)) {
      lastGeoAddrRef.current = curAddr; // zapamiętaj, żeby miękki auto-zapis nie geokodował w kółko
      try {
        const r = await forwardGeocode(`${street}, ${city || "Polska"}`);
        if (r[0]?.coordinates) geoCoords = r[0].coordinates;
      } catch { /* zapisz profil nawet gdy geocoding padnie */ }
    }

    const { error } = await (supabase as any)
      .from("business_profiles")
      .update({
        business_name: businessName,
        phone: phone || null,
        email: email || null,
        website: website || null,
        social_links: (instagram.trim() || facebook.trim())
          ? {
              ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
              ...(facebook.trim() ? { facebook: facebook.trim() } : {}),
            }
          : null,
        street: street || null,
        city: city || null,
        postal_code: postalCode || null,
        tags: tags.length > 0 ? tags : null,
        main_category: (mainCategories[0] ?? mainCategory) || null,
        main_categories: mainCategories,
        subcategories: bizSubcategories.length > 0 ? bizSubcategories : null,
        custom_subcategory: customSubcategory.trim() || null,
        custom_subcategory_status: customSubcategoryStatus,
        description: description || null,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        cover_video_url: coverVideoUrl || null,
        gallery_urls: galleryUrls,
        menu_image_urls: menuImageUrls,
        color_badge: colorBadge,
        color_card_bg: colorCardBg,
        color_button: colorButton,
        color_promo: colorPromo || null,
        event_title: eventTitle || null,
        event_description: null,
        event_starts_at: eventStartsAt || null,
        event_ends_at: eventEndsAt || null,
        opening_hours: Object.keys(openingHours).length > 0 ? openingHours : null,
        review_requested_at: reviewAt,
        updated_at: nowIso,
      })
      .eq("id", profile.id);
    if (error) {
      console.error("[BusinessDashboard] persistProfile failed:", {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        profile_id: profile.id,
        user_id: user?.id,
        owner_user_id: (profile as any).owner_user_id,
      });
      const msg = error.message?.toLowerCase() ?? "";
      // Błąd zapisu pokazujemy ZAWSZE (też przy miękkim zapisie) - inaczej lokal myśli, że
      // zapisał, a zmiany przepadły. isDirty zostaje, więc kolejna zmiana ponawia próbę.
      if (msg.includes("row-level security") || msg.includes("rls") || msg.includes("policy")) {
        toast.error(t("save.rls_error"));
      } else {
        toast.error(t("save.error", { msg: error.message ?? t("save.unknown") }));
      }
      if (silent) setSaveStatus('idle');
    } else {
      // Zapisz geokodowane wspolrzedne OSOBNYM update'em (best-effort). Gdyby kolumn
      // latitude/longitude jeszcze nie bylo (przed uruchomieniem migracji), blad NIE
      // wywala glownego zapisu - tylko logujemy.
      if (geoCoords) {
        const { error: geoErr } = await (supabase as any)
          .from("business_profiles")
          .update({ latitude: geoCoords.latitude, longitude: geoCoords.longitude })
          .eq("id", profile.id);
        if (geoErr) console.warn("[BusinessDashboard] zapis wspolrzednych nie powiodl sie (uruchom migracje?):", geoErr.message);
      }
      // event_title_en OSOBNYM update'em (best-effort) - kolumny moga nie istniec przed
      // uruchomieniem migracji; blad nie wywala glownego zapisu.
      {
        const { error: enErr } = await (supabase as any)
          .from("business_profiles")
          .update({ event_title_en: eventTitleEnToSave || null, event_title_en_overridden: eventTitleEnOverridden })
          .eq("id", profile.id);
        if (enErr) console.warn("[BusinessDashboard] zapis event_title_en nie powiodl sie (uruchom migracje?):", enErr.message);
      }
      // ⛔ `secondary_category` NIE jest juz zapisywana (migracja 20260915_business_main_categories):
      // dwie rownorzedne kategorie glowne mieszkaja w `main_categories[]`. Kolumna zostaje
      // w bazie z komentarzem DEPRECATED, dopoki wszystkie odczyty nie przejda na tablice.
      if (isComplete && !reviewRequestedAt) {
        setReviewRequestedAt(nowIso);
        if (!silent) toast.success(t("save.saved_review"));
      } else if (!silent) {
        toast.success(t("save.saved"));
      }
      setIsDirty(false);
      if (silent) { setSaveStatus('saved'); }
    }
    if (silent) setSaving(false); else setSaving(false);
  };

  // Sygnatura wszystkich zapisywanych pól - zmiana KTÓREGOKOLWIEK resetuje debounce, więc
  // miękki zapis leci 1,4 s po OSTATNIM naciśnięciu (a nie po pierwszym w serii).
  const fieldSig = JSON.stringify([
    businessName, phone, email, website, instagram, facebook, street, city, postalCode,
    tags, mainCategory, bizSubcategories, customSubcategory, secondaryCategory, description,
    colorBadge, colorCardBg, colorButton, colorPromo, eventTitle, eventTitleEn, eventStartsAt,
    eventEndsAt, openingHours, galleryUrls, menuImageUrls, logoUrl, coverImageUrl, coverVideoUrl,
  ]);
  // Miękki auto-zapis dla LIVE (nie szkic, nie podgląd): po 1,4 s od ostatniej zmiany leci
  // cichy persistProfile. "Zapisano" gaśnie po 2 s. Szkice mają lżejszy autoSaveDraft niżej.
  useEffect(() => {
    if (isDraft || previewMode || !isDirty || !profile || saving) return;
    const id = setTimeout(() => { void persistProfile({ silent: true }); }, 1400);
    return () => clearTimeout(id);
    // fieldSig w deps: każda edycja resetuje timer. persistProfile czyta świeży stan z domknięcia.
  }, [fieldSig, isDirty, isDraft, previewMode, profile, saving]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const id = setTimeout(() => setSaveStatus('idle'), 2000);
    return () => clearTimeout(id);
  }, [saveStatus]);

  // "Od użytkowników": notki (fetchPlaceNotes po nazwie) + zdjęcia (place_photos po kluczu nazwy)
  // dla tego miejsca. Ładujemy dopiero po wejściu w zakładkę (nie obciąża startu panelu).
  useEffect(() => {
    if (activeSection !== 'community' || !profile || !businessName.trim()) return;
    let cancelled = false;
    setCommunityLoading(true);
    (async () => {
      const nameKey = `nm:${businessName.trim().toLowerCase()}`;
      const [notes, photoRes] = await Promise.all([
        fetchPlaceNotes(businessName.trim()).catch(() => [] as PlaceUserNote[]),
        (supabase as any).from("place_photos")
          .select("id, photo_url, user_id, created_at")
          .eq("place_key", nameKey)
          .order("created_at", { ascending: false })
          .limit(60)
          .then(({ data }: any) => (data ?? []) as any[])
          .catch(() => [] as any[]),
      ]);
      if (cancelled) return;
      // Profil (nazwa/awatar) autorów zdjęć jednym zapytaniem.
      const uids = Array.from(new Set(photoRes.map((p) => p.user_id).filter(Boolean)));
      const byId = new Map<string, { username: string | null; avatar_url: string | null }>();
      if (uids.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", uids);
        for (const pr of (profs ?? []) as any[]) byId.set(pr.id, { username: pr.username, avatar_url: pr.avatar_url });
      }
      if (cancelled) return;
      setCommunityNotes(notes);
      setCommunityPhotos(photoRes.map((p) => ({
        id: p.id, photo_url: p.photo_url, user_id: p.user_id, created_at: p.created_at,
        username: byId.get(p.user_id)?.username ?? null, avatar_url: byId.get(p.user_id)?.avatar_url ?? null,
      })));
      setCommunityLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeSection, profile, businessName]);

  // Zgłoszenie treści użytkownika do moderacji (biznes nie kasuje UGC sam - to robi zespół).
  const reportCommunity = async (targetType: 'place_photo' | 'place_note', targetId: string, key: string, note: string) => {
    if (reportedKeys.has(key)) return;
    setReportedKeys((prev) => new Set(prev).add(key));
    const { error } = await (supabase as any).from("content_reports").insert({
      target_type: targetType, target_id: targetId, reporter_id: user?.id ?? null,
      reason: "business_flag", note: `[${businessName}] ${note}`.slice(0, 500), status: "open",
    });
    if (error) {
      setReportedKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
      toast.error(t("community.report_error"));
    } else {
      toast.success(t("community.report_done"));
    }
  };

  // Silent auto-save for draft mode — called on tab switch and after media uploads
  const autoSaveDraft = useCallback(async (overrides?: Partial<{
    businessName: string; description: string; street: string; city: string; phone: string; email: string;
    website: string; tags: string[]; mainCategory: string; logoUrl: string; coverImageUrl: string; coverVideoUrl: string; galleryUrls: string[]; menuImageUrls: string[];
  }>) => {
    if (!profile || !isDraft) return;
    const payload = {
      business_name: overrides?.businessName ?? businessName,
      description: (overrides?.description ?? description) || null,
      street: (overrides?.street ?? street) || null,
      city: (overrides?.city ?? city) || null,
      phone: (overrides?.phone ?? phone) || null,
      email: (overrides?.email ?? email) || null,
      website: (overrides?.website ?? website) || null,
      tags: (overrides?.tags ?? tags).length > 0 ? (overrides?.tags ?? tags) : null,
      main_category: (overrides?.mainCategory ?? mainCategory) || null,
      logo_url: (overrides?.logoUrl ?? logoUrl) || null,
      cover_image_url: (overrides?.coverImageUrl ?? coverImageUrl) || null,
      cover_video_url: (overrides?.coverVideoUrl ?? coverVideoUrl) || null,
      gallery_urls: overrides?.galleryUrls ?? galleryUrls,
      menu_image_urls: overrides?.menuImageUrls ?? menuImageUrls,
      updated_at: new Date().toISOString(),
    };
    await (supabase as any).from("business_profiles").update(payload).eq("id", profile.id);
    setIsDirty(false);
  }, [profile, isDraft, businessName, description, street, city, phone, email, website, tags, mainCategory, logoUrl, coverImageUrl, coverVideoUrl, galleryUrls, menuImageUrls]);

  const dismissVerifiedBanner = async () => {
    setShowVerifiedBanner(false);
    if (!profile) return;
    await (supabase as any).from("business_profiles")
      .update({ verification_notified_at: new Date().toISOString() })
      .eq("id", profile.id);
  };

  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) return;
    setSupportSubmitting(true);
    const { error } = await (supabase as any).from("bug_reports").insert({
      user_id: user?.id ?? null,
      description: `[Panel biznesowy - ${profile?.business_name ?? ""}]\n\n${supportMessage.trim()}`,
      status: "new",
      source: "business",
    });
    setSupportSubmitting(false);
    if (error) {
      toast.error(t("support.error"));
    } else {
      toast.success(t("support.sent"));
      setSupportMessage("");
      setShowSupportModal(false);
    }
  };

  const handleDraftConvert = async () => {
    if (!profile) return;
    setConvertingDraft(true);
    try {
      // Persist current business name before leaving
      if (businessName.trim()) {
        await (supabase as any)
          .from("business_profiles")
          .update({ business_name: businessName })
          .eq("id", profile.id);
      }
      // Record conversion intent
      await (supabase as any)
        .from("draft_conversions")
        .insert({ profile_id: profile.id, business_name: businessName || null });
      // Notify via email (fire and forget)
      supabase.functions.invoke("notify-draft-conversion", {
        body: { profile_id: profile.id, business_name: businessName || null },
      }).catch(() => {});
      navigate(`/auth?draft=${profile.id}`);
    } catch {
      toast.error(t("draft.convert_error"));
    } finally {
      setConvertingDraft(false);
    }
  };

  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  // Zmiana hasla BEZ maila z linkiem: najpierw potwierdzamy obecne haslo (Supabase nie ma
  // osobnego "verify password", wiec logujemy sie nim jeszcze raz), potem ustawiamy nowe.
  // Bez tego kroku kazdy, kto usiadzie przy otwartym panelu, zmienia lokalowi haslo.
  const changePassword = async (currentPw: string, nextPw: string): Promise<string | null> => {
    const mail = user?.email ?? profile?.email ?? "";
    if (!mail) return t("settings.pw_wrong");
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: mail, password: currentPw });
    if (reauthErr) return t("settings.pw_wrong");
    const { error: updErr } = await supabase.auth.updateUser({ password: nextPw });
    if (updErr) return updErr.message;
    return null;
  };

  const saveNotifyPrefs = async (patch: Partial<typeof notifyPrefs>) => {
    const next = { ...notifyPrefs, ...patch };
    setNotifyPrefs(next);
    if (!profile?.id) return;
    const { error } = await (supabase as any).from("business_profiles").update({
      notify_new_note: next.newNote,
      notify_weekly_digest: next.weeklyDigest,
      notify_news: next.news,
    }).eq("id", profile.id);
    if (error) {
      setNotifyPrefs(notifyPrefs); // zgoda nie zapisana = przelacznik wraca, zeby nie klamal
      toast.error(t("save.error", { msg: error.message }));
    }
  };

  const submitReport = async (topic: string, body: string): Promise<boolean> => {
    const { error } = await (supabase as any).from("bug_reports").insert({
      user_id: user?.id ?? null,
      description: `[Panel biznesowy - ${profile?.business_name ?? ""}] ${topic}\n\n${body}`,
      status: "new",
      source: "business",
    });
    if (error) { toast.error(t("support.error")); return false; }
    toast.success(t("support.sent"));
    return true;
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error(t("password.no_email"));
      return;
    }
    if (resetPasswordLoading) return;
    if (!window.confirm(t("password.confirm", { email: user.email }))) return;
    setResetPasswordLoading(true);
    try {
      // Wlasny mail resetu B2B (token-hash, niebieski) - patrz Auth.handleForgotPassword.
      const { error } = await supabase.functions.invoke("send-business-password-reset", {
        body: { email: user.email },
      });
      if (error) throw error;
      toast.success(t("password.sent", { email: user.email }));
    } catch (err: any) {
      console.error("[BusinessDashboard] password reset failed:", err);
      toast.error(err.message || t("password.error"));
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    // Clear Supabase session from all storage
    const clearStorage = () => {
      [localStorage, sessionStorage].forEach(store => {
        Object.keys(store)
          .filter(k => k.startsWith("sb-"))
          .forEach(k => store.removeItem(k));
      });
    };

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(res => setTimeout(res, 3000)), // timeout fallback
      ]);
    } catch {}

    clearStorage();
    window.location.replace("/auth?business=true");
  };


  if (loading) return <DashboardLoadingScreen />;

  if (accessDenied || !profile) return (
    <div className="min-h-screen bg-[#FEFEFE] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs flex flex-col items-center gap-5">
        <div className="h-14 w-14 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <div className="text-center">
          <h1 className="text-xl font-black text-foreground">{t("access.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("access.subtitle")}</p>
        </div>
        <div className="w-full space-y-3">
          <input
            type="password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
            onKeyDown={e => {
              if (e.key === "Enter" && passwordInput === "trasa2026") {
                setAccessDenied(false);
                setLoading(true);
                loadData(true);
              } else if (e.key === "Enter") {
                setPasswordError(true);
              }
            }}
            placeholder={t("access.placeholder")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-center placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {passwordError && (
            <p className="text-xs text-center text-red-500">{t("access.wrong")}</p>
          )}
          <button
            onClick={() => {
              if (passwordInput === "trasa2026") {
                setAccessDenied(false);
                setLoading(true);
                loadData(true);
              } else {
                setPasswordError(true);
              }
            }}
            className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t("access.open")}
          </button>
        </div>
      </div>
    </div>
  );

  const completenessSteps: CompletenessStep[] = [
    { id: "name", label: t("overview.step_name"), done: businessName.trim().length > 0, section: "profile" },
    { id: "description", label: t("overview.step_description"), done: description.trim().length >= 20, section: "profile" },
    { id: "category", label: t("overview.step_category"), done: !!mainCategory, section: "profile" },
    { id: "address", label: t("overview.step_address"), done: !!(street.trim() && city.trim()), section: "profile" },
    { id: "contact", label: t("overview.step_contact"), done: !!(phone.trim() || website.trim()), section: "profile" },
    { id: "hours", label: t("overview.step_hours"), done: Object.keys(openingHours ?? {}).length > 0, section: "profile" },
    { id: "cover", label: t("overview.step_cover"), done: !!(coverImageUrl || coverVideoUrl), section: "gallery" },
    { id: "gallery", label: t("overview.step_gallery"), done: galleryUrls.length >= 3, section: "gallery" },
    { id: "menu", label: t("overview.step_menu"), done: menuImageUrls.length > 0, section: "menu" },
  ];

  const previewReady = businessName.trim().length > 0 && !!(coverImageUrl || coverVideoUrl || galleryUrls.length > 0);

  const previewMissingFields = (() => {
    const missing: string[] = [];
    if (!businessName.trim()) missing.push(t("missing.business_name"));
    if (!coverImageUrl && !coverVideoUrl && galleryUrls.length === 0) missing.push(t("missing.cover"));
    return missing;
  })();
  const previewMissingMsg = previewMissingFields.length > 0
    ? t("missing.msg", { fields: previewMissingFields.join(t("missing.joiner")) })
    : "";

  return (
    <>

      {/* ── Draft mode banner ── */}
      {isDraft && (() => {
        const ready = previewReady;
        return (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-orange-50 border-b border-orange-100 px-4 py-1.5 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-orange-700 leading-snug">
              {ready ? t("draft.banner_ready") : t("draft.banner_incomplete")}
            </p>
            {ready && (
              <button
                onClick={handleDraftConvert}
                disabled={convertingDraft}
                className="shrink-0 bg-white text-slate-900 font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap border border-orange-200 active:scale-95 transition-transform disabled:opacity-60"
              >
                {convertingDraft ? t("draft.wait") : t("draft.banner_convert")}
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Preview mode banner ── */}
      {previewMode && !isDraft && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold leading-snug">{t("preview_mode.banner")}</p>
          <button
            onClick={() => navigate("/set-password-biznes")}
            className="shrink-0 bg-white text-primary font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform"
          >
            {t("preview_mode.claim")}
          </button>
        </div>
      )}

      <BizShell
        title={SECTION_META[activeSection].title(t)}
        subtitle={SECTION_META[activeSection].subtitle(t)}
        active={activeSection}
        onSelect={async (section) => {
          // Przejscie miedzy sekcjami dopina miekki zapis - inaczej lokal traci to,
          // co wpisal sekunde wczesniej (debounce nie zdazyl).
          if (isDirty) { if (isDraft) await autoSaveDraft(); else await persistProfile({ silent: true }); }
          setActiveSection(section);
        }}
        businessName={businessName}
        city={city}
        avatarUrl={logoUrl || coverImageUrl || null}
        planLabel={PLAN_LABELS[plan]}
        isPremium={plan !== 'basic'}
        saveStatus={!isDraft && !previewMode ? saveStatus : 'idle'}
        onLogout={handleLogout}
        onSupport={() => setShowSupportModal(true)}
        onUpgrade={() => setShowSupportModal(true)}
      >

          {/* Banners (always visible) */}
          <div className="space-y-3 mb-4">
            {showWelcomeBanner && (
              <div className="bg-gradient-to-br from-[#FDF184] to-[#FDCD84] rounded-2xl p-4 text-[#5B2C06] shadow-lg shadow-[#FDCD84]/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-black text-base leading-tight">{t("welcome.title")}</p>
                    <p className="text-sm text-[#5B2C06]/85 mt-1.5 leading-relaxed">
                      {t("welcome.thanks_prefix")}{businessName?.trim() ? <> <strong className="text-[#5B2C06]">{businessName.trim()}</strong></> : null}{t("welcome.body_mid")}<strong className="text-[#5B2C06]">{t("welcome.support_quote")}</strong>.
                    </p>
                  </div>
                  <button onClick={() => { setShowWelcomeBanner(false); localStorage.setItem(`welcome_seen_${profile!.id}`, "1"); }} className="mt-0.5 text-[#5B2C06]/60 active:opacity-60 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {showVerifiedBanner && (
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-amber-800">{t("verified.title")}</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{t("verified.desc")}</p>
                  </div>
                  <button onClick={dismissVerifiedBanner} className="text-amber-400 active:opacity-60 flex-shrink-0 mt-0.5"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}
            {reviewRequestedAt && !profile.is_verified && (
              <div className="bg-[#FDF184]/25 border border-[#FDCD84]/60 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#5B2C06]">{t("review.pending_title")}</p>
                  <p className="text-[11px] text-[#5B2C06]/70 mt-0.5">{t("review.pending_desc")}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── PRZEGLĄD ── */}
          {activeSection === 'overview' && (
            <OverviewSection
              range={analyticsRange === 'custom' ? '30d' : analyticsRange}
              onRange={setAnalyticsRange}
              isPremium={plan !== 'basic'}
              loading={analyticsLoading}
              stats={stats}
              chart={chartData.map(d => ({ date: d.date, value: d.views }))}
              recentEvents={recentEvents}
              steps={completenessSteps}
              onGoTo={setActiveSection}
              onUpgrade={() => setShowSupportModal(true)}
            />
          )}

          {activeSection === 'gallery' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-5 items-start">
              <div className="flex-1 min-w-0 space-y-4">
              {/* ── SEKCJA 1: Okładka wizytówki (zdjęcie lub filmik) + Podgląd ── */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("gallery.cover_title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("gallery.cover_desc")}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">JPG, PNG, HEIC</span>
                </div>

                {/* Upload area */}
                <div className="w-36 space-y-2">
                    <div
                      className="relative w-full h-60 rounded-2xl border-2 border-dashed border-border overflow-hidden bg-muted/30 group cursor-pointer"
                      onClick={() => coverVideoInputRef.current?.click()}
                    >
                      {(uploading === "cover_video" || uploading === "cover") ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-xs">{t("gallery.uploading")}</span>
                        </div>
                      ) : coverVideoUrl ? (
                        <>
                          <AutoVideo src={coverVideoUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                            <div className="flex flex-col items-center gap-2 text-white">
                              <Camera className="h-5 w-5" />
                              <span className="text-sm font-semibold">{t("gallery.change_cover")}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCoverVideoUrl(""); setIsDirty(true); }}
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center z-10"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </>
                      ) : coverImageUrl ? (
                        <>
                          <img src={coverImageUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                            <div className="flex flex-col items-center gap-2 text-white">
                              <Camera className="h-5 w-5" />
                              <span className="text-sm font-semibold">{t("gallery.change_cover")}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCoverImageUrl(""); setIsDirty(true); }}
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center z-10"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <ImagePlus className="h-6 w-6" />
                          </div>
                          <div className="text-center px-2">
                            <p className="text-sm font-semibold">{t("gallery.add_cover")}</p>
                            <p className="text-xs mt-0.5 text-muted-foreground/70">{t("gallery.cover_format")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={coverVideoInputRef}
                      type="file"
                      accept="image/*,.heic,.heif"
                      className="hidden"
                      onChange={handleCoverUpload}
                    />
                  </div>
              </div>{/* end outer section card */}

              {/* ── SEKCJA 3: Galeria dodatkowa ── */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("gallery.extra_title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("gallery.extra_desc")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{galleryUrls.length}/{MAX_GALLERY}</p>
                </div>
                <div
                  className="grid grid-cols-3 md:grid-cols-5 gap-2"
                  onPointerMove={(e) => {
                    if (galleryDragIdx === null) return;
                    const el = document.elementFromPoint(e.clientX, e.clientY);
                    const card = el?.closest<HTMLElement>("[data-gallery-idx]");
                    if (card) {
                      const newIdx = parseInt(card.dataset.galleryIdx!, 10);
                      if (!Number.isNaN(newIdx)) setGalleryTargetIdx(newIdx);
                    }
                  }}
                >
                  {galleryUrls.map((url, idx) => {
                    const isDragging = galleryDragIdx === idx;
                    const isTarget = galleryDragIdx !== null && galleryTargetIdx === idx && galleryTargetIdx !== galleryDragIdx;
                    return (
                      <div
                        key={idx}
                        data-gallery-idx={idx}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-muted group transition-all ${isDragging ? "opacity-40 scale-95" : ""} ${isTarget ? "ring-2 ring-orange-500 ring-offset-1" : ""}`}
                        onClick={() => { if (galleryDragIdx === null) setPhotoPreview({ url, label: t("gallery.photo_label", { n: idx + 1 }) }); }}
                      >
                        <img src={url} className="w-full h-full object-cover pointer-events-none" />
                        <button onClick={(e) => { e.stopPropagation(); removeGalleryPhoto(idx); }} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center active:opacity-70 z-10"><X className="h-3 w-3 text-white" /></button>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between px-1.5 pb-1.5 pointer-events-none">
                          <ZoomIn className="h-3 w-3 text-white/80" />
                        </div>
                        {/* Drag handle - jedyny element ktorym mozna reorderowac.
                            touch-action:none zapobiega scroll'owi podczas drag na mobile. */}
                        <button
                          type="button"
                          aria-label={t("gallery.move_photo")}
                          className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center cursor-grab active:cursor-grabbing active:bg-black/80 z-10"
                          style={{ touchAction: "none" }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            setGalleryDragIdx(idx);
                            setGalleryTargetIdx(idx);
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            if (galleryDragIdx !== null && galleryTargetIdx !== null && galleryDragIdx !== galleryTargetIdx) {
                              const next = [...galleryUrls];
                              const [moved] = next.splice(galleryDragIdx, 1);
                              next.splice(galleryTargetIdx, 0, moved);
                              setGalleryUrls(next);
                              autoSaveDraft({ galleryUrls: next });
                              setIsDirty(true);
                            }
                            setGalleryDragIdx(null);
                            setGalleryTargetIdx(null);
                          }}
                          onPointerCancel={() => { setGalleryDragIdx(null); setGalleryTargetIdx(null); }}
                        >
                          <GripVertical className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    );
                  })}
                  {galleryUrls.length < MAX_GALLERY && (
                    <button onClick={() => galleryInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 active:opacity-70">
                      {uploading === 'gallery' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  )}
                </div>
                <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleGalleryUpload} />
              </div>

              {/* Personalizacja kolorów wizytówki WYCOFANA (decyzja Nat 2026-09-14): wizytówka ma
                  wyglądać identycznie jak w aplikacji, więc kolory są jednolite (pomarańcz marki).
                  Kolumny color_* zostają w bazie i w zapisie (stare wartości nie znikają), ale nic
                  ich już nie zmienia i podgląd ich nie używa. Nie przywracaj bez prośby Nat. */}

              </div> {/* end flex-1 min-w-0 */}

              {/* Desktop sticky card preview */}
              <div className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-20 lg:self-start">
                <BusinessCardPreview
                  logoUrl={logoUrl} coverImageUrl={coverImageUrl} coverVideoUrl={coverVideoUrl}
                  businessName={businessName} mainCategory={mainCategory} subcategories={bizSubcategories} tags={tags} eventTitle={eventTitle}
                  street={street} description={description}
                  onPreviewClick={() => setShowAppPreview(true)} previewReady={previewReady}
                  colorBadge={colorBadge} colorCardBg={colorCardBg} colorButton={colorButton} colorPromo={colorPromo}
                />
              </div>
              </div> {/* end flex flex-col lg:flex-row */}
            </div>
          )}

          {/* ── DANE LOKALU ── */}
          {activeSection === 'profile' && (
            <ProfileSection
              value={{ businessName, description, street, city, postalCode, phone, email, website, instagram, facebook }}
              onChange={(patch) => {
                if (patch.businessName !== undefined) setBusinessName(patch.businessName);
                if (patch.description !== undefined) setDescription(patch.description);
                if (patch.street !== undefined) setStreet(patch.street);
                if (patch.city !== undefined) setCity(patch.city);
                if (patch.postalCode !== undefined) setPostalCode(patch.postalCode);
                if (patch.phone !== undefined) setPhone(patch.phone);
                if (patch.email !== undefined) setEmail(patch.email);
                if (patch.website !== undefined) setWebsite(patch.website);
                if (patch.instagram !== undefined) setInstagram(patch.instagram);
                if (patch.facebook !== undefined) setFacebook(patch.facebook);
                setIsDirty(true);
              }}
              mains={mainCategories}
              subs={bizSubcategories}
              onEditCategories={() => setCategoryPickerOpen(true)}
              hours={
                <BusinessHoursEditor
                  value={openingHours}
                  onChange={(h) => { setOpeningHours(h); setIsDirty(true); }}
                />
              }
              preview={
                <BusinessCardPreview
                  logoUrl={logoUrl} coverImageUrl={coverImageUrl} coverVideoUrl={coverVideoUrl}
                  businessName={businessName} mainCategory={mainCategories[0] ?? mainCategory}
                  subcategories={bizSubcategories} tags={tags} eventTitle={eventTitle}
                  street={street} description={description}
                  onPreviewClick={() => setShowAppPreview(true)} previewReady={previewReady}
                  colorBadge={colorBadge} colorCardBg={colorCardBg} colorButton={colorButton} colorPromo={colorPromo}
                />
              }
            />
          )}

          {activeSection === 'menu' && (() => {
            const menuLabel = mainCategory === 'food' ? t('menu.menu') : t('menu.pricelist');
            const hint = mainCategory === 'food'
              ? t('menu.hint_menu')
              : t('menu.hint_pricelist');
            return (
            <div className="space-y-5">
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-foreground">{menuLabel} <span className="font-normal text-muted-foreground text-xs">{t("menu.max", { max: MAX_MENU_IMAGES })}</span></p>
                      <p className="text-xs text-muted-foreground shrink-0">{menuImageUrls.length}/{MAX_MENU_IMAGES}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {menuImageUrls.map((url, idx) => {
                        const pdf = isPdfUrl(url);
                        return (
                        <div key={idx} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-muted group cursor-pointer"
                          onClick={() => pdf ? window.open(url, "_blank", "noopener,noreferrer") : setPhotoPreview({ url, label: t("menu.photo_label", { label: menuLabel, n: idx + 1 }) })}>
                          {pdf ? (
                            <MenuPdfThumb url={url} />
                          ) : (
                            <img src={url} className="w-full h-full object-cover pointer-events-none" />
                          )}
                          <button onClick={(e) => { e.stopPropagation(); removeMenuImage(idx); }}
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center active:opacity-70 z-10">
                            <X className="h-3 w-3 text-white" />
                          </button>
                          {!pdf && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between px-1.5 pb-1.5 pointer-events-none">
                              <ZoomIn className="h-3 w-3 text-white/80" />
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {menuImageUrls.length < MAX_MENU_IMAGES && (
                        <button onClick={() => menuInputRef.current?.click()} className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 active:opacity-70">
                          {uploading === 'menu' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                    <input ref={menuInputRef} type="file" accept="image/*,.heic,.heif,application/pdf,.pdf" multiple className="hidden" onChange={handleMenuUpload} />
                  </div>
                </div>
                <div className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-20 lg:self-start">
                  <BusinessCardPreview
                    logoUrl={logoUrl} coverImageUrl={coverImageUrl} coverVideoUrl={coverVideoUrl}
                    businessName={businessName} mainCategory={mainCategory} subcategories={bizSubcategories} tags={tags} eventTitle={eventTitle}
                    street={street} description={description}
                    onPreviewClick={() => setShowAppPreview(true)} previewReady={previewReady}
                    colorBadge={colorBadge} colorCardBg={colorCardBg} colorButton={colorButton} colorPromo={colorPromo}
                  />
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── AKTUALNOŚCI ── */}
          {activeSection === 'posts' && (
            <div className="space-y-5">
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Form */}
                <div className="flex-1 space-y-5">
                  {/* Events */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("posts.current_event")}</p>
                    <p className="text-xs text-muted-foreground -mt-2">{t("posts.event_desc")}</p>
                    <div className="space-y-1">
                      <Label htmlFor="event_title">{t("posts.event_title_label")}</Label>
                      <BizInput id="event_title" value={eventTitle} maxLength={40} onChange={e => { setEventTitle(e.target.value); setIsDirty(true); }} placeholder={t("posts.event_title_placeholder")} />
                      <p className="text-[11px] text-muted-foreground text-right">{eventTitle.length}/40</p>
                    </div>
                    {/* Wersja angielska (auto-tlumaczenie z mozliwoscia nadpisania) - widoczna dla zagranicznych podroznikow */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="event_title_en" className="text-xs flex items-center gap-1.5 flex-wrap">
                          <Globe className="h-3.5 w-3.5 text-slate-400" />{t("posts.event_en_label")}
                          <span className="text-[10px] font-normal text-muted-foreground">{eventTitleEnOverridden ? t("posts.event_en_edited") : t("posts.event_en_auto")}</span>
                        </Label>
                        <button type="button" onClick={handleTranslateEvent} disabled={!eventTitle.trim() || translatingEvent}
                          className="text-[11px] font-semibold text-primary disabled:opacity-40 active:opacity-70 shrink-0">
                          {translatingEvent ? t("posts.event_en_translating") : t("posts.event_en_translate")}
                        </button>
                      </div>
                      <BizInput id="event_title_en" value={eventTitleEn} maxLength={60}
                        onChange={e => { setEventTitleEn(e.target.value); setEventTitleEnOverridden(true); setIsDirty(true); }}
                        placeholder={t("posts.event_en_placeholder")} />
                      <p className="text-[11px] text-muted-foreground">{t("posts.event_en_hint")}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 min-w-0"><Label htmlFor="event_starts_at" className="text-xs">{t("posts.from")}</Label><BizInput id="event_starts_at" value={eventStartsAt} onChange={e => { setEventStartsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" /></div>
                      <div className="space-y-1 min-w-0"><Label htmlFor="event_ends_at" className="text-xs">{t("posts.to")}</Label><BizInput id="event_ends_at" value={eventEndsAt} onChange={e => { setEventEndsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" /></div>
                    </div>
                  </div>
                  {/* Zaplanowane wydarzenia (kolejka + historia) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("posts.events_label")}</p>
                    <p className="text-xs text-muted-foreground -mt-2">{t("posts.events_desc")}</p>
                    {/* Formularz dodania */}
                    <div className="space-y-3 border border-border/60 rounded-2xl p-3">
                      <div className="space-y-1">
                        <Label htmlFor="new_event_title" className="text-xs">{t("posts.events_title_label")}</Label>
                        <BizInput id="new_event_title" value={newEventTitle} maxLength={40} onChange={e => setNewEventTitle(e.target.value)} placeholder={t("posts.events_title_placeholder")} />
                        <p className="text-[11px] text-muted-foreground text-right">{newEventTitle.length}/40</p>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new_event_description" className="text-xs">{t("posts.events_desc_label")}</Label>
                        <textarea id="new_event_description" rows={2} value={newEventDescription} maxLength={300} onChange={e => setNewEventDescription(e.target.value)} placeholder={t("posts.events_desc_placeholder")} className="w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 resize-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_start" className="text-xs">{t("posts.from")}</Label><BizInput id="new_event_start" type="date" value={newEventStartsAt} onChange={e => setNewEventStartsAt(e.target.value)} className="w-full" /></div>
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_end" className="text-xs">{t("posts.events_to_optional")}</Label><BizInput id="new_event_end" type="date" value={newEventEndsAt} onChange={e => setNewEventEndsAt(e.target.value)} className="w-full" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_start_time" className="text-xs">{t("posts.events_start_time_optional")}</Label><BizInput id="new_event_start_time" type="time" value={newEventStartTime} onChange={e => setNewEventStartTime(e.target.value)} className="w-full" /></div>
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_end_time" className="text-xs">{t("posts.events_end_time_optional")}</Label><BizInput id="new_event_end_time" type="time" value={newEventEndTime} onChange={e => setNewEventEndTime(e.target.value)} className="w-full" /></div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={newEventDraft}
                        onClick={() => setNewEventDraft(v => !v)}
                        className="flex items-center gap-2.5 w-full active:opacity-70"
                      >
                        <span className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${newEventDraft ? "bg-amber-500" : "bg-muted"}`}>
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${newEventDraft ? "translate-x-4" : "translate-x-0.5"}`} />
                        </span>
                        <span className="text-xs text-muted-foreground">{t("posts.events_save_as_draft")}</span>
                      </button>
                      <button
                        onClick={handleAddEvent}
                        disabled={addingEvent || !newEventTitle.trim() || !newEventStartsAt}
                        className="w-full py-2.5 rounded-full bg-[#D45113] text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
                      >
                        {addingEvent ? t("posts.events_adding") : t("posts.events_add")}
                      </button>
                    </div>
                    {/* Lista: nadchodzace/aktywne + historia */}
                    {(() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const upcoming = sortEventsAsc(events.filter(e => (e.ends_at ?? e.starts_at) >= todayStr));
                      const past = [...events.filter(e => (e.ends_at ?? e.starts_at) < todayStr)]
                        .sort((a, b) => (a.starts_at > b.starts_at ? -1 : a.starts_at < b.starts_at ? 1 : 0));
                      if (events.length === 0) {
                        return <p className="text-xs text-muted-foreground text-center py-4">{t("posts.events_empty")}</p>;
                      }
                      return (
                        <div className="space-y-4">
                          {upcoming.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("posts.events_upcoming")}</p>
                              {upcoming.map(ev => (
                                editingEventId === ev.id ? (
                                  <div key={ev.id} className="border border-border/60 rounded-2xl p-3 space-y-3">
                                    <div className="space-y-1">
                                      <Label htmlFor={`edit_event_title_${ev.id}`} className="text-xs">{t("posts.events_title_label")}</Label>
                                      <BizInput id={`edit_event_title_${ev.id}`} value={editEventTitle} maxLength={40} onChange={e => setEditEventTitle(e.target.value)} placeholder={t("posts.events_title_placeholder")} />
                                      <p className="text-[11px] text-muted-foreground text-right">{editEventTitle.length}/40</p>
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`edit_event_description_${ev.id}`} className="text-xs">{t("posts.events_desc_label")}</Label>
                                      <textarea id={`edit_event_description_${ev.id}`} rows={2} value={editEventDescription} maxLength={300} onChange={e => setEditEventDescription(e.target.value)} placeholder={t("posts.events_desc_placeholder")} className="w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 resize-none" />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_start_${ev.id}`} className="text-xs">{t("posts.from")}</Label><BizInput id={`edit_event_start_${ev.id}`} type="date" value={editEventStartsAt} onChange={e => setEditEventStartsAt(e.target.value)} className="w-full" /></div>
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_end_${ev.id}`} className="text-xs">{t("posts.events_to_optional")}</Label><BizInput id={`edit_event_end_${ev.id}`} type="date" value={editEventEndsAt} onChange={e => setEditEventEndsAt(e.target.value)} className="w-full" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_start_time_${ev.id}`} className="text-xs">{t("posts.events_start_time_optional")}</Label><BizInput id={`edit_event_start_time_${ev.id}`} type="time" value={editEventStartTime} onChange={e => setEditEventStartTime(e.target.value)} className="w-full" /></div>
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_end_time_${ev.id}`} className="text-xs">{t("posts.events_end_time_optional")}</Label><BizInput id={`edit_event_end_time_${ev.id}`} type="time" value={editEventEndTime} onChange={e => setEditEventEndTime(e.target.value)} className="w-full" /></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => handleUpdateEvent(ev.id)} disabled={savingEditEvent || !editEventTitle.trim() || !editEventStartsAt} className="flex-1 py-2 rounded-full bg-[#D45113] text-white font-bold text-xs active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"><Check className="h-3.5 w-3.5" />{t("posts.events_save")}</button>
                                      <button onClick={() => setEditingEventId(null)} className="flex-1 py-2 rounded-full bg-secondary text-secondary-foreground font-bold text-xs active:scale-[0.98] transition-transform">{t("posts.events_cancel")}</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div key={ev.id} className="border border-border/50 rounded-2xl p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm font-semibold leading-snug break-words">{ev.title}</p>
                                          {ev.is_draft && <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t("posts.events_draft_badge")}</span>}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{fmtEventRange(ev)}</p>
                                        {ev.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug break-words">{ev.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button onClick={() => handleStartEditEvent(ev)} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center active:opacity-60"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                        <button onClick={() => handleDeleteEvent(ev.id)} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center active:opacity-60"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                      </div>
                                    </div>
                                    {ev.is_draft ? (
                                      <button onClick={() => handleTogglePublish(ev)} className="w-full py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs active:scale-[0.98] transition-transform">{t("posts.events_publish")}</button>
                                    ) : (
                                      <button onClick={() => handleTogglePublish(ev)} className="w-full py-1.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs active:scale-[0.98] transition-transform">{t("posts.events_unpublish")}</button>
                                    )}
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                          {past.length > 0 && (
                            <div className="space-y-2">
                              <button type="button" onClick={() => setShowEventHistory(v => !v)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest active:opacity-60">
                                {t("posts.events_history")} ({past.length})
                                {showEventHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>
                              {showEventHistory && past.map(ev => (
                                <div key={ev.id} className="border border-border/40 rounded-2xl p-3 opacity-60">
                                  <p className="text-sm font-semibold leading-snug break-words">{ev.title}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmtEventRange(ev)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* Preview panel - right (desktop) / bottom (mobile/tablet) */}
                <div className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-20 lg:self-start">
                  <BusinessCardPreview
                    logoUrl={logoUrl}
                    coverImageUrl={coverImageUrl}
                    coverVideoUrl={coverVideoUrl}
                    businessName={businessName}
                    mainCategory={mainCategory}
                    subcategories={bizSubcategories}
                    tags={tags}
                    eventTitle={eventTitle}
                    street={street}
                    description={description}
                    onPreviewClick={() => setShowAppPreview(true)}
                    previewReady={previewReady}
                    colorBadge={colorBadge} colorCardBg={colorCardBg} colorButton={colorButton} colorPromo={colorPromo}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── OD UŻYTKOWNIKÓW (notki + zdjęcia userów o tym miejscu) ── */}
          {activeSection === 'community' && (
            <div className="space-y-5">

              {communityLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : (communityNotes.length === 0 && communityPhotos.length === 0) ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm flex flex-col items-center text-center gap-2">
                  <MessageSquareQuote className="h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">{t("community.empty_title")}</p>
                  <p className="text-xs text-slate-400 max-w-sm">{t("community.empty_desc")}</p>
                </div>
              ) : (
                <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
                  {/* Notki */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t("community.notes_label", { count: communityNotes.length })}</p>
                    {communityNotes.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">{t("community.no_notes")}</p>
                    ) : (
                      <div className="space-y-3">
                        {communityNotes.map((n) => {
                          const key = `note-${n.key}`;
                          const reported = reportedKeys.has(key);
                          return (
                            <div key={n.key} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                              <img src={avatarSrc(n.avatar_url)} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 bg-slate-100" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700">{n.username || t("community.anon_user")}</p>
                                <p className="text-sm text-slate-600 leading-relaxed mt-0.5 break-words">{n.note}</p>
                              </div>
                              <button
                                onClick={() => reportCommunity('place_note', n.key, key, n.note)}
                                disabled={reported}
                                title={t("community.report")}
                                className="shrink-0 text-slate-300 hover:text-primary disabled:text-emerald-500 disabled:hover:text-emerald-500 transition-colors p-1"
                              >
                                {reported ? <Check className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Zdjęcia */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t("community.photos_label", { count: communityPhotos.length })}</p>
                    {communityPhotos.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">{t("community.no_photos")}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {communityPhotos.map((ph) => {
                          const key = `photo-${ph.id}`;
                          const reported = reportedKeys.has(key);
                          return (
                            <div key={ph.id} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
                              <img src={ph.photo_url} alt="" loading="lazy" className="w-full h-full object-cover cursor-pointer" onClick={() => setPhotoPreview({ url: ph.photo_url, label: ph.username || t("community.anon_user") })} />
                              {ph.username && (
                                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                                  <p className="text-[10px] font-semibold text-white truncate">@{ph.username}</p>
                                </div>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); reportCommunity('place_photo', ph.id, key, ph.photo_url); }}
                                disabled={reported}
                                title={t("community.report")}
                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white/90 hover:bg-black/65 disabled:bg-emerald-500/80 transition-colors"
                              >
                                {reported ? <Check className="h-3 w-3" /> : <Flag className="h-3 w-3" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <GuestInsights
                    noteCount={communityNotes.length}
                    photoCount={communityPhotos.length}
                    notes={communityNotes.map((n) => n.note ?? "")}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">{t("community.moderation_hint")}</p>
            </div>
          )}

          {activeSection === 'settings' && (
            (!previewMode && !isDraft && user && (profile as any)?.owner_user_id === user.id) ? (
              <SettingsSection
                email={user.email ?? profile?.email ?? ""}
                planLabel={PLAN_LABELS[plan]}
                planHint={plan === 'basic' ? t("settings.plan_basic_hint") : t("settings.plan_premium_hint")}
                isPremium={plan !== 'basic'}
                prefs={notifyPrefs}
                onPrefsChange={saveNotifyPrefs}
                onChangePassword={changePassword}
                onForgotPassword={handlePasswordReset}
                forgotPending={resetPasswordLoading}
                onSubmitReport={submitReport}
                onUpgrade={() => setShowSupportModal(true)}
                onSupport={() => setShowSupportModal(true)}
                deleteAccount={<BusinessDeleteAccount />}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">{t("settings.login_prompt")}</p>
              </div>
            )
          )}


      </BizShell>

      {/* Mobile FAB — temporarily disabled on frontend */}

      {/* Miękki zapis (Nat 2026-09-14): zmiany lecą same (debounce 1,4 s), więc nie ma już
          paska "Zapisz zmiany". Feedback = status "Zapisywanie/Zapisano" w górnej belce. Na
          mobile, w trakcie zapisu, pokazujemy delikatny pasek na dole (belka bywa przewinięta). */}
      {!previewMode && !isDraft && saveStatus !== 'idle' && (
        <div
          className="md:hidden fixed left-0 right-0 z-30 px-4 pt-2 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)" }}
        >
          <div className="mx-auto w-fit flex items-center gap-1.5 rounded-full bg-white/95 border border-slate-200 shadow-sm px-3.5 py-1.5 text-[11px] font-semibold text-slate-500">
            {saveStatus === 'saving'
              ? <><Loader2 className="h-3 w-3 animate-spin" />{t("save.autosaving")}</>
              : <><Check className="h-3 w-3 text-emerald-500" />{t("save.autosaved")}</>}
          </div>
        </div>
      )}
      {/* ── Kategorie w dwoch krokach (model: 2 glowne + 3 podkategorie) ── */}
      <CategoryPickerModal
        open={categoryPickerOpen}
        initialMains={mainCategories}
        initialSubs={bizSubcategories}
        onCancel={() => setCategoryPickerOpen(false)}
        onSave={({ mains, subs }) => {
          setMainCategories(mains);
          // `mainCategory` (pojedyncza) zostaje zgodna z pierwsza z listy - czytaja ja
          // jeszcze apka, panel ops i podglad karty.
          setMainCategory(mains[0] ?? "");
          setSecondaryCategory("");
          setBizSubcategories(subs);
          setIsDirty(true);
          setCategoryPickerOpen(false);
        }}
      />

      {/* ── Kadrowanie zdjecia (logo 1:1 kolo / galeria 4:3) ── */}
      {cropJob && cropJob.files[cropJob.index] && (
        <ImageCropModal
          file={cropJob.files[cropJob.index]}
          aspect={cropJob.aspect}
          cropShape={cropJob.shape}
          allowAspectChange={cropJob.target === "gallery"}
          title={cropJob.target === "logo"
            ? t("crop.logo_title")
            : t("crop.photo_title", { n: cropJob.index + 1, total: cropJob.files.length })}
          confirmLabel={t("crop.confirm")}
          cancelLabel={t("crop.cancel")}
          onCropped={handleCropped}
          onCancel={handleCropCancel}
        />
      )}
      {/* ── Photo lightbox ── */}
      {photoPreview && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setPhotoPreview(null)}>
          <div className="max-w-2xl w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-1">
              <p className="text-white/70 text-sm font-medium">{photoPreview.label}</p>
              <button onClick={() => setPhotoPreview(null)} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/20 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={photoPreview.url} className="w-full rounded-2xl object-contain max-h-[75vh]" />
          </div>
        </div>
      )}

      {/* ── Mobile/Tablet FAB: Podglad wizytowki - tylko desktop (lg+) ma sticky sidebar preview ──
          Dolny pasek nawigacji (BizShell, ~60 px + safe-area) zajmuje dol ekranu, wiec FAB
          i pasek zapisu siadaja NAD nim - inaczej zaslaniaja nawigacje. */}
      <button
        onClick={() => previewReady && setShowAppPreview(true)}
        disabled={!previewReady}
        title={!previewReady ? t("fab.incomplete") : t("fab.preview_title")}
        aria-label={t("fab.preview_aria")}
        className="lg:hidden fixed z-[55] flex items-center gap-2 px-5 py-3 rounded-full bg-[#D45113] text-white font-bold text-sm shadow-lg shadow-orange-600/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)", right: "1rem" }}
      >
        <Eye className="h-4 w-4" />
        {t("fab.preview")}
      </button>

      {/* ── App-like preview modal (card + detail view) ── */}
      {showAppPreview && (
        <AppLikePreviewModal
          onClose={() => setShowAppPreview(false)}
          onConvert={handleDraftConvert}
          isDraft={isDraft}
          convertingDraft={convertingDraft}
          businessName={businessName}
          mainCategory={mainCategory}
          subcategories={bizSubcategories}
          tags={tags}
          description={description}
          street={street}
          city={city}
          latitude={(profile as any)?.latitude ?? null}
          longitude={(profile as any)?.longitude ?? null}
          logoUrl={logoUrl}
          coverImageUrl={coverImageUrl}
          coverVideoUrl={coverVideoUrl}
          galleryUrls={galleryUrls}
          menuImageUrls={menuImageUrls}
          eventTitle={eventTitle}
          eventDescription={eventDescription}
          events={events}
          openingHours={openingHours}
          colorBadge={colorBadge}
          colorCardBg={colorCardBg}
          colorButton={colorButton}
          colorPromo={colorPromo}
          posts={[
            ...(postDescription.trim() || postPhotos.length > 0 ? [{
              id: 'draft-preview',
              place_id: '',
              description: postDescription.trim() || null,
              photo_urls: postPhotos,
              created_at: new Date().toISOString(),
            }] : []),
            ...posts,
          ]}
        />
      )}

      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setShowSupportModal(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{t("support.title")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("support.desc")}</p>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={supportMessage}
              onChange={e => setSupportMessage(e.target.value)}
              placeholder={t("support.placeholder")}
              rows={5}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 resize-none"
            />
            <button
              onClick={handleSupportSubmit}
              disabled={supportSubmitting || !supportMessage.trim()}
              className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {supportSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t("support.sending")}</> : t("support.submit")}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BusinessDashboard;
