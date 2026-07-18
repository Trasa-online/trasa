import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import posthog from "posthog-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, BarChart2, MapPin, MousePointerClick, Plus, X, LogOut, ImagePlus, Trash2, Users, LayoutDashboard, Images, Store, Megaphone, TrendingUp, MessageCircle, Expand, ZoomIn, Video, Play, Camera, Star, Heart, ChevronUp, ChevronDown, ChevronLeft, GripVertical, HelpCircle, Eye, KeyRound, Clock, Settings, FileText, BookOpen, Pencil, Check } from "lucide-react";

// Menu moze byc obrazem (JPG/PNG/WEBP) albo PDF - rozpoznajemy po rozszerzeniu URL.
const isPdfUrl = (u: string): boolean => u.split("?")[0].toLowerCase().endsWith(".pdf");
import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';
import { MAIN_CATEGORIES } from "@/lib/categories";
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
import { TrasaLogo } from "@/components/TrasaLogo";

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
  basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
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

interface Stats { views: number; onRoutes: number; websiteClicks: number; phoneClicks: number; uniqueChoices: number; }
type AnalyticsRange = '7d' | '30d' | '90d' | 'custom';
interface ChartDay { date: string; views: number; routes: number; clicks: number; }
interface HourlyBucket { hour: number; label: string; total: number; }

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
      <div className="h-16 w-16 rounded-full shadow-lg" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
      <p className="font-black text-xl tracking-tight text-foreground">trasa</p>
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

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? '#000000' : '#ffffff';
}

function AppLikePreviewModal({
  onClose, onConvert, isDraft, convertingDraft,
  businessName, mainCategory, subcategories, tags, description, street, city, logoUrl, coverImageUrl, coverVideoUrl, galleryUrls, menuImageUrls, posts, eventTitle, eventDescription, openingHours,
  colorBadge, colorCardBg, colorButton, colorPromo,
}: {
  onClose: () => void; onConvert: () => void; isDraft: boolean; convertingDraft: boolean;
  businessName: string; mainCategory: string; subcategories: string[]; tags: string[]; description: string;
  street: string; city: string; logoUrl: string; coverImageUrl: string; coverVideoUrl: string; galleryUrls: string[]; menuImageUrls: string[];
  posts: BusinessPost[]; eventTitle: string; eventDescription: string; openingHours: OpeningHours;
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
          background: linear-gradient(90deg, #3b82f6, #6366f1, #3b82f6);
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
              <div className="absolute left-0 right-0 px-4 space-y-1.5" style={{ bottom: '5rem' }}>
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
                    style={{ background: "linear-gradient(to right,#F4A259,#F9662B)", color: "#ffffff" }}>
                    {eventTitle}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5 pr-14">
                    {tags.slice(0, 4).map(t => (
                      <span key={t} className="px-2.5 py-0.5 bg-white/15 rounded-full text-xs text-white/80 font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Expand to detail — bottom-right, above action buttons */}
              <button
                onClick={() => setView('detail')}
                className="absolute right-4 h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"
                style={{ bottom: '5rem' }}
              >
                <ChevronUp className="h-5 w-5 text-slate-700" />
              </button>
              {/* Action buttons on the card */}
              <div className="absolute bottom-4 left-3 right-3 flex gap-2.5">
                <button onClick={onClose} className="flex-1 py-3.5 rounded-full bg-white text-slate-900 font-bold text-sm active:scale-95 transition-transform">
                  {t("card.reject")}
                </button>
                <button className="flex-1 py-3.5 rounded-full font-bold text-sm active:scale-95 transition-transform shadow-lg" style={{ background: colorButton, color: getContrastColor(colorButton) }}>
                  {t("card.add")}
                </button>
              </div>
            </div>
          ) : (
            /* Detail view — identyczna wizytowka jak w apce (PlaceSwiperDetail przez PremiumBusinessCard) */
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: "touch" }}>
                <PremiumBusinessCard
                  data={fromDashboardState({
                    businessName, mainCategory, subcategories, tags, description, street, city,
                    logoUrl, coverImageUrl, coverVideoUrl, galleryUrls, menuImageUrls, posts,
                    eventTitle, eventDescription, openingHours,
                    colorBadge, colorCardBg, colorButton,
                  })}
                  mode="detail"
                  detailPhotos={allPhotos}
                  onClose={() => setView('card')}
                  hideReviews
                />
              </div>
              {/* Odrzuc / Dodaj CTA - poza PremiumBusinessCard, 1:1 z apka */}
              <div className="shrink-0 flex gap-3 px-4 pb-5 pt-3 border-t border-slate-100 bg-[#FEFEFE]">
                <button onClick={() => setView('card')} className="flex-1 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm shadow-sm active:scale-[0.97] transition-transform">
                  {t("card.reject")}
                </button>
                <button className="flex-1 py-3 rounded-full font-bold text-sm shadow-xl active:scale-[0.97] transition-transform" style={{ background: colorButton, color: getContrastColor(colorButton) }}>
                  {t("card.add")}
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
  const btn     = colorButton ?? "#D45113";
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
        <div className="absolute left-0 right-0 px-3 space-y-1" style={{ bottom: '3.5rem' }}>
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
              style={{ background: "linear-gradient(to right,#F4A259,#F9662B)", color: "#ffffff" }}>
              {eventTitle}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5 pr-10">
              {tags.slice(0, 3).map(t => (
                <span key={t} className="px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-medium text-white/80">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="absolute right-3 h-8 w-8 bg-white rounded-full flex items-center justify-center shadow-md" style={{ bottom: '3.5rem' }}>
          <ChevronUp className="h-4 w-4 text-slate-700" />
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex gap-2">
          <div className="flex-1 py-2 rounded-full bg-white text-slate-900 font-bold text-[10px] text-center">{t("card.reject")}</div>
          <div className="flex-1 py-2 rounded-full font-bold text-[10px] text-center" style={{ background: btn, color: getContrastColor(btn) }}>{t("card.add")}</div>
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

const BusinessDashboard = () => {
  const { t } = useTranslation("bizdash");
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
  const [stats, setStats] = useState<Stats>({ views: 0, onRoutes: 0, websiteClicks: 0, phoneClicks: 0, uniqueChoices: 0 });
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
  // Card color personalization
  const [colorBadge, setColorBadge]   = useState<string>("#D45113"); // orange-500 default
  const [colorCardBg, setColorCardBg] = useState<string>("#000000"); // black default (card overlay)
  const [colorButton, setColorButton] = useState<string>("#D45113"); // orange default
  const [colorPromo, setColorPromo]   = useState<string>(""); // badge promocji/aktualnosci; puste = domyslny gradient pomaranczowy
  const [plan, setPlan] = useState<BizPlan>('premium');
  const [previewTab, setPreviewTab] = useState<'basic' | 'premium'>('premium');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [reviewRequestedAt, setReviewRequestedAt] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null); // which slot is uploading
  const [isDirty, setIsDirty] = useState(false);

  const [activeSection, setActiveSection] = useState<'overview' | 'gallery' | 'profile' | 'menu' | 'posts' | 'analytics' | 'settings'>('profile');
  const [recentEvents, setRecentEvents] = useState<Array<{event_type: string, created_at: string}>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; label: string } | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [showAppPreview, setShowAppPreview] = useState(false);
  const [convertingDraft, setConvertingDraft] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<BusinessPost[]>([]);
  const [postDescription, setPostDescription] = useState("");
  const [postPhotos, setPostPhotos] = useState<string[]>([]);
  const [postPhotoUploading, setPostPhotoUploading] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  // Wydarzenia (kolejka + historia) - tabela business_events, brak w types.ts -> (supabase as any)
  const [events, setEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartsAt, setNewEventStartsAt] = useState("");
  const [newEventEndsAt, setNewEventEndsAt] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventDraft, setNewEventDraft] = useState(false);
  const [showEventHistory, setShowEventHistory] = useState(false);
  // Edycja inline istniejacego wydarzenia (tylko nadchodzace/aktywne).
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState("");
  const [editEventStartsAt, setEditEventStartsAt] = useState("");
  const [editEventEndsAt, setEditEventEndsAt] = useState("");
  const [savingEditEvent, setSavingEditEvent] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
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

    // Try to find by place_id first, then fall back to business_profiles.id
    let { data: profileData } = await (supabase as any)
      .from("business_profiles").select("*").eq("place_id", placeId).maybeSingle();
    if (!profileData) {
      const { data: byId } = await (supabase as any)
        .from("business_profiles").select("*").eq("id", placeId).maybeSingle();
      profileData = byId;
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
    setBizSubcategories(profileData.subcategories ?? []);
    setCustomSubcategory((profileData as any).custom_subcategory ?? "");
    setCustomSubcategoryStatus((profileData as any).custom_subcategory_status ?? null);
    setDescription(profileData.description ?? "");
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setCoverVideoUrl((profileData as any).cover_video_url ?? "");
    setGalleryUrls(profileData.gallery_urls ?? []);
    setMenuImageUrls(profileData.menu_image_urls ?? []);
    setColorBadge((profileData as any).color_badge ?? "#D45113");
    setColorCardBg((profileData as any).color_card_bg ?? "#000000");
    setColorButton((profileData as any).color_button ?? "#D45113");
    setColorPromo((profileData as any).color_promo ?? "");
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
    return supabase.storage.from("business-photos").getPublicUrl(data.path).data.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("logo");
    try {
      const url = await uploadFile(file, "logo");
      setLogoUrl(url);
      setIsDirty(true);
      if (isDraft) await autoSaveDraft({ logoUrl: url });
    } catch (err: any) { toast.error(err.message ?? t("upload.logo_error")); }
    setUploading(null);
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

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_GALLERY - galleryUrls.length;
    const toUpload = files.slice(0, remaining);
    setUploading("gallery");
    try {
      const urls = await Promise.all(toUpload.map(f => uploadFile(f, "gallery")));
      setGalleryUrls(prev => [...prev, ...urls]);
      setIsDirty(true);
    } catch (err: any) { toast.error(err.message ?? t("upload.photos_error")); }
    setUploading(null);
    e.target.value = "";
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
    if (ev.ends_at && ev.ends_at !== ev.starts_at) {
      return `${start} - ${format(parseISO(ev.ends_at), "d MMM", { locale: dateLocale() })}`;
    }
    return start;
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
        is_draft: newEventDraft,
      })
      .select()
      .single();
    if (error || !data) { toast.error(t("posts.events_add_error")); setAddingEvent(false); return; }
    // Auto-tlumaczenie tytulu na EN (best-effort) - wzor jak handleTranslateEvent.
    let inserted = data;
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
    setNewEventStartsAt("");
    setNewEventEndsAt("");
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
    setEditEventStartsAt(ev.starts_at ?? "");
    setEditEventEndsAt(ev.ends_at ?? "");
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
      .update({ title, starts_at: editEventStartsAt, ends_at: editEventEndsAt || null })
      .eq("id", id);
    if (error) { toast.error(t("posts.events_update_error")); setSavingEditEvent(false); return; }
    let updated = { ...current, title, starts_at: editEventStartsAt, ends_at: editEventEndsAt || null };
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

  const handleSave = async () => {
    if (!profile) return;
    if (eventStartsAt && eventEndsAt && eventEndsAt < eventStartsAt) {
      toast.error(t("save.event_date_error"));
      return;
    }
    setSaving(true);

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
    const prevAddr = `${(profile as any).street ?? ""}|${(profile as any).city ?? ""}|${(profile as any).postal_code ?? ""}`;
    const curAddr = `${street}|${city}|${postalCode}`;
    let geoCoords: { latitude: number; longitude: number } | null = null;
    if (street.trim() && (curAddr !== prevAddr || (profile as any).latitude == null)) {
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
        main_category: mainCategory || null,
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
      console.error("[BusinessDashboard] handleSave failed:", {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        profile_id: profile.id,
        user_id: user?.id,
        owner_user_id: (profile as any).owner_user_id,
      });
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("row-level security") || msg.includes("rls") || msg.includes("policy")) {
        toast.error(t("save.rls_error"));
      } else {
        toast.error(t("save.error", { msg: error.message ?? t("save.unknown") }));
      }
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
      // secondary_category OSOBNYM update'em (best-effort) - kolumna moze nie istniec przed
      // uruchomieniem migracji; blad nie wywala glownego zapisu.
      {
        const { error: secErr } = await (supabase as any)
          .from("business_profiles")
          .update({ secondary_category: secondaryCategory || null })
          .eq("id", profile.id);
        if (secErr) console.warn("[BusinessDashboard] zapis secondary_category nie powiodl sie (uruchom migracje?):", secErr.message);
      }
      if (isComplete && !reviewRequestedAt) {
        setReviewRequestedAt(nowIso);
        toast.success(t("save.saved_review"));
      } else {
        toast.success(t("save.saved"));
      }
      setIsDirty(false);
    }
    setSaving(false);
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
  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error(t("password.no_email"));
      return;
    }
    if (resetPasswordLoading) return;
    if (!window.confirm(t("password.confirm", { email: user.email }))) return;
    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/?bizreset=1#/set-password-biznes`,
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
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t("access.open")}
          </button>
        </div>
      </div>
    </div>
  );

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
    <div className="min-h-screen flex bg-slate-50 overflow-x-hidden">

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
            className="shrink-0 bg-white text-orange-600 font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap active:scale-95 transition-transform"
          >
            {t("preview_mode.claim")}
          </button>
        </div>
      )}

      {/* ── Sidebar (desktop only) ── */}
      <aside className={`hidden md:flex shrink-0 flex-col fixed h-full bg-white border-r border-slate-100 py-5 z-20 transition-all duration-200 ${sidebarOpen ? 'w-56 px-3' : 'w-14 px-2'}`}>
        {/* Logo + collapse toggle */}
        <div className="mb-6">
          <div className={`flex items-center gap-2 px-2 mb-2 ${!sidebarOpen && 'justify-center'}`}>
            <TrasaLogo size={28} />
            {sidebarOpen && <span className="font-black text-sm">trasa.biznes</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? undefined : t('sidebar.expand')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors text-xs ${!sidebarOpen && 'justify-center w-full'}`}
          >
            <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            {sidebarOpen && <span>{t('sidebar.collapse')}</span>}
          </button>
        </div>
        {/* Nav items */}
        {([
          { id: 'overview',   label: t('nav.overview'),  icon: LayoutDashboard, disabled: true,  hidden: true },
          { id: 'profile',    label: t('nav.profile'),   icon: Store,          disabled: false, hidden: false },
          { id: 'gallery',    label: t('nav.appearance'), icon: Images,        disabled: false, hidden: false },
          { id: 'menu',       label: t('nav.menu'),      icon: BookOpen,       disabled: false, hidden: false },
          { id: 'posts',      label: t('nav.posts'),     icon: Megaphone,      disabled: false, hidden: false },
          { id: 'analytics',  label: t('nav.analytics'), icon: TrendingUp,     disabled: true,  hidden: false },
          { id: 'settings',   label: t('nav.settings'),  icon: Settings,       disabled: false, hidden: false },
        ] as const).filter(item => !item.hidden).map(item => (
          <button
            key={item.id}
            id={`tour-${item.id}`}
            onClick={async () => { if (item.disabled) return; if (isDirty) await autoSaveDraft(); setActiveSection(item.id); }}
            disabled={item.disabled}
            title={item.disabled ? t('nav.disabled_soon') : (!sidebarOpen ? item.label : undefined)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-0.5 ${sidebarOpen ? 'text-left' : 'justify-center'} ${item.disabled ? 'text-slate-300 cursor-not-allowed' : activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {sidebarOpen && (
              <span className="flex items-center gap-1.5">
                {item.label}
                {item.disabled && <span className="text-[9px] font-bold text-slate-300 bg-slate-100 rounded-full px-1.5 py-0.5">{t('nav.soon')}</span>}
              </span>
            )}
          </button>
        ))}
        {/* Logout + support at bottom */}
        <div className={`mt-auto px-1 space-y-1 ${!sidebarOpen && 'flex flex-col items-center'}`}>
          <button onClick={() => setShowSupportModal(true)} title={t('sidebar.support')} className={`flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 ${sidebarOpen ? 'px-2' : 'justify-center'}`}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && t('sidebar.support')}
          </button>
          {!isDraft && (
            <>
              <button
                onClick={handlePasswordReset}
                disabled={resetPasswordLoading}
                title={t('sidebar.change_password')}
                className={`flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 disabled:opacity-50 ${sidebarOpen ? 'px-2' : 'justify-center'}`}
              >
                {resetPasswordLoading
                  ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  : <KeyRound className="h-3.5 w-3.5 shrink-0" />
                }
                {sidebarOpen && (resetPasswordLoading ? t('sidebar.sending') : t('sidebar.change_password'))}
              </button>
              <button onClick={handleLogout} title={t('sidebar.logout')} className={`flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 ${sidebarOpen ? 'px-2' : 'justify-center'}`}>
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                {sidebarOpen && t('sidebar.logout')}
              </button>
            </>
          )}
          <button onClick={startTour} title={t('sidebar.repeat_tour')} className={`flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 ${sidebarOpen ? 'px-2' : 'justify-center'}`}>
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && t('sidebar.repeat_tour')}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-200 ${sidebarOpen ? 'md:ml-56' : 'md:ml-14'} ${(previewMode || isDraft) ? 'pt-12 sm:pt-9' : ''}`}>

        {/* ── Top bar ── */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 md:px-6 h-14 flex items-center gap-3 shrink-0">
          {/* Mobile: logo */}
          <TrasaLogo size={28} className="md:hidden" />
          <div id="tour-business-name" className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate">{businessName || t("business_name_fallback")}</h1>
            <span className={`hidden md:inline text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${PLAN_COLORS[plan]}`}>{PLAN_LABELS[plan]}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* "Przetestuj w aplikacji" — temporarily disabled on frontend */}
            {isAdminUser && (profile as any).preview_token && (
              <button
                onClick={async () => {
                  const url = `${SHARE_BASE_URL}/#/biznes/${placeId}?t=${(profile as any).preview_token}`;
                  const result = await share({ title: t("topbar.preview_title"), url });
                  if (!result.ok) return;
                  toast.success(result.method === "clipboard" ? t("topbar.link_copied") : t("topbar.shared"));
                }}
                className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-blue-600 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {t("topbar.copy_link")}
              </button>
            )}
            {!isDraft && (
              <button onClick={handleLogout} className="md:hidden flex items-center gap-1 text-xs text-muted-foreground px-2 py-1.5 rounded-full bg-slate-100">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile horizontal tabs ── */}
        <div className="md:hidden sticky top-14 z-10 bg-white border-b border-slate-100 flex overflow-x-auto shrink-0 px-3 gap-1 py-2">
          {([
            { id: 'overview', label: t('tabs.overview'), disabled: true,  hidden: true },
            { id: 'profile', label: t('tabs.profile'), disabled: false, hidden: false },
            { id: 'gallery', label: t('tabs.appearance'), disabled: false, hidden: false },
            { id: 'menu', label: t('tabs.menu'), disabled: false, hidden: false },
            { id: 'posts', label: t('tabs.posts'), disabled: false, hidden: false },
            { id: 'analytics', label: t('tabs.analytics'), disabled: true,  hidden: false },
            { id: 'settings', label: t('tabs.settings'), disabled: false, hidden: false },
          ] as const).filter(item => !item.hidden).map(item => (
            <button
              key={item.id}
              id={`tour-mobile-${item.id}`}
              onClick={async () => { if (item.disabled) return; if (isDirty) await autoSaveDraft(); setActiveSection(item.id); }}
              disabled={item.disabled}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${item.disabled ? 'text-slate-300 cursor-not-allowed' : activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
            >
              {item.label}{item.disabled && ` · ${t('nav.soon')}`}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {/* pb-40 gdy isDirty: sticky save bar (button h-12 + pt-3 + pb-6 + pb-safe-6) zajmuje
            ~110-130 px zaleznie od safe-area. pb-40 (160px) daje margines bez ucinania ostatniej sekcji. */}
        <div className={`flex-1 p-4 md:p-6 max-w-4xl w-full ${isDirty ? 'pb-[calc(env(safe-area-inset-bottom,0px)+9rem)] md:pb-40' : 'pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] md:pb-10'}`}>

          {/* Banners (always visible) */}
          <div className="space-y-3 mb-4">
            {showWelcomeBanner && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-black text-base leading-tight">{t("welcome.title")}</p>
                    <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">
                      {t("welcome.thanks_prefix")}{businessName?.trim() ? <> <strong className="text-white">{businessName.trim()}</strong></> : null}{t("welcome.body_mid")}<strong className="text-white">{t("welcome.support_quote")}</strong>.
                    </p>
                  </div>
                  <button onClick={() => { setShowWelcomeBanner(false); localStorage.setItem(`welcome_seen_${profile!.id}`, "1"); }} className="mt-0.5 text-blue-200 active:opacity-60 flex-shrink-0">
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
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-700">{t("review.pending_title")}</p>
                  <p className="text-[11px] text-blue-500 mt-0.5">{t("review.pending_desc")}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── PRZEGLĄD ── */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-black text-foreground">{t("overview.title")}</h2>
                  <p className="text-sm text-slate-400">{t("overview.subtitle")}</p>
                </div>
                <div className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5 shrink-0">
                  {(['7d', '30d', '90d'] as Exclude<AnalyticsRange, 'custom'>[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setAnalyticsRange(r)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${analyticsRange === r ? 'bg-white text-foreground shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {r === '7d' ? t("range.7d") : r === '30d' ? t("range.30d") : t("range.months3")}
                    </button>
                  ))}
                </div>
              </div>
              {/* Stats 4 cards */}
              {plan === 'premium' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t('overview.stat_views'), value: stats.views, icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: t('overview.stat_addplan'), value: stats.onRoutes, icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: t('overview.stat_clicks'), value: stats.websiteClicks + stats.phoneClicks, icon: MousePointerClick, color: 'text-violet-500', bg: 'bg-violet-50' },
                    { label: t('overview.stat_total'), value: stats.views + stats.onRoutes + stats.websiteClicks + stats.phoneClicks, icon: BarChart2, color: 'text-orange-500', bg: 'bg-orange-50' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <div className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <p className="text-2xl font-black text-foreground leading-none mb-1">{analyticsLoading ? '-' : value}</p>
                      <p className="text-xs text-slate-400 leading-snug">{label}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{t("overview.last_prefix")} {analyticsRange === '7d' ? t("range.7d") : analyticsRange === '30d' ? t("range.30d") : t("range.months3")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative rounded-2xl border border-dashed border-border/60 p-4 overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-30 pointer-events-none select-none">
                    {[t('locked.views'), t('locked.routes'), t('locked.clicks'), t('locked.activity')].map(l => (
                      <div key={l} className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-2xl font-black">-</p><p className="text-xs text-slate-400">{l}</p></div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-lg">🔒</span>
                    <p className="text-xs font-semibold">{t("analytics.locked_title")}</p>
                  </div>
                </div>
              )}
              {/* Activity feed */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t("activity.title")}</p>
                {recentEvents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">{t("activity.empty")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-50">
                    {recentEvents.map((ev, i) => {
                      const labels: Record<string, { txt: string; dot: string }> = {
                        view: { txt: t('activity.view'), dot: 'bg-blue-400' },
                        add_to_route: { txt: t('activity.add_route'), dot: 'bg-emerald-400' },
                        click_phone: { txt: t('activity.click_phone'), dot: 'bg-violet-400' },
                        click_website: { txt: t('activity.click_website'), dot: 'bg-violet-400' },
                        click_booking: { txt: t('activity.click_booking'), dot: 'bg-amber-400' },
                      };
                      const info = labels[ev.event_type] ?? { txt: ev.event_type, dot: 'bg-slate-300' };
                      return (
                        <div key={i} className="flex items-center gap-3 py-2.5">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${info.dot}`} />
                          <p className="text-sm text-slate-600 flex-1">{info.txt}</p>
                          <p className="text-[10px] text-slate-400 shrink-0">
                            {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: dateLocale() })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GALERIA ── */}
          {activeSection === 'gallery' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black">{t("gallery.title")}</h2>
                <p className="text-sm text-slate-400">{t("gallery.subtitle")}</p>
              </div>

              <div className="flex flex-col lg:flex-row gap-5 items-start">
              <div className="flex-1 min-w-0 space-y-4">
              {/* ── SEKCJA 1: Okładka wizytówki (zdjęcie lub filmik) + Podgląd ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
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
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
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

              {/* ── Personalizacja kolorow ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{t("personalization.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("personalization.desc")}</p>
                </div>
                {/* Live preview strip NAD pickerem - zeby guzik "Dodaj" byl widoczny podczas
                    zmiany koloru (sticky bar "Zapisz zmiany" zaslanial go, gdy byl na dole karty).
                    Badge kategorii i promocji ZAWSZE pomaranczowe (jednolite w aplikacji). */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("personalization.preview")}</p>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold shrink-0 text-white" style={{ background: "#D45113" }}>{MAIN_CATEGORIES.find(c => c.id === mainCategory)?.label || t("personalization.category_fallback")}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold shrink-0 text-white" style={{ background: "#D45113" }}>{t("personalization.promo")}</span>
                    <button className="flex-1 py-2 rounded-full text-xs font-bold" style={{ background: colorButton, color: getContrastColor(colorButton) }}>{t("card.add")}</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* Personalizacja ograniczona do koloru guzika akcji - kategorie/tlo sa jednolite
                      w calej aplikacji (badge kategorii i overlay nie sa juz personalizowane). */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t("personalization.button_color")}</p>
                      <p className="text-xs text-muted-foreground">{t("personalization.button_color_desc")}</p>
                    </div>
                    <input type="color" value={colorButton} onChange={e => { setColorButton(e.target.value); setIsDirty(true); }}
                      className="h-9 w-14 rounded-lg cursor-pointer border border-slate-200 p-0.5" />
                  </div>
                </div>
              </div>

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
            <div className="space-y-5">
              <div><h2 className="text-lg font-black">{t("profile.title")}</h2><p className="text-sm text-slate-400">{t("profile.subtitle")}</p></div>

              <div className="flex flex-col lg:flex-row gap-5 items-start">
              <div className="flex-1 min-w-0 space-y-5">
              {/* ── Nazwa lokalu ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <Label htmlFor="business_name" className="text-sm font-bold text-foreground">{t("profile.name_label")}</Label>
                <Input
                  id="business_name"
                  value={businessName}
                  onChange={e => { setBusinessName(e.target.value); setIsDirty(true); }}
                  placeholder={t("profile.name_placeholder")}
                  maxLength={80}
                  className="mt-2"
                />
              </div>
              {/* ── Logo - avatar style ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-bold text-foreground mb-4">{t("profile.logo_title")}</p>
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-[3px] border-[#D45113] bg-muted">
                      {uploading === 'logo'
                        ? <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        : logoUrl
                          ? <img src={logoUrl} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 text-muted-foreground/40" /></div>
                      }
                    </div>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
                    >
                      <Camera className="h-3.5 w-3.5 text-background" />
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleLogoUpload} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{businessName || t("business_name_fallback")}</p>
                    <button onClick={() => logoInputRef.current?.click()} className="mt-1 text-xs text-orange-600 font-medium active:opacity-70">
                      {logoUrl ? t('profile.change_logo') : t('profile.add_logo')}
                    </button>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("profile.logo_hint")}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="street" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.street")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                  <Input id="street" value={street} maxLength={100} onChange={e => { setStreet(e.target.value); setIsDirty(true); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.city")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                    <Input id="city" value={city} maxLength={80} onChange={e => { setCity(e.target.value); setIsDirty(true); }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="postal_code" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.postal")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                    <Input id="postal_code" value={postalCode} maxLength={10} onChange={e => { setPostalCode(e.target.value); setIsDirty(true); }} />
                  </div>
                </div>
                {!isDraft && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.phone")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                      <Input id="phone" value={phone} maxLength={20} onChange={e => { setPhone(e.target.value); setIsDirty(true); }} type="tel" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.email")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                      <Input id="email" value={email} maxLength={100} onChange={e => { setEmail(e.target.value); setIsDirty(true); }} type="email" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="website" className="text-xs flex items-center gap-1.5 flex-wrap">{t("profile.website")} <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                      <Input id="website" value={website} maxLength={200} onChange={e => { setWebsite(e.target.value); setIsDirty(true); }} type="url" placeholder="https://twojlokal.pl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="instagram" className="text-xs flex items-center gap-1.5 flex-wrap">Instagram <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                      <Input id="instagram" value={instagram} maxLength={200} onChange={e => { setInstagram(e.target.value); setIsDirty(true); }} type="url" placeholder="https://instagram.com/twojlokal" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="facebook" className="text-xs flex items-center gap-1.5 flex-wrap">Facebook <span className="text-[10px] font-normal text-muted-foreground">{t("profile.optional")}</span></Label>
                      <Input id="facebook" value={facebook} maxLength={200} onChange={e => { setFacebook(e.target.value); setIsDirty(true); }} type="url" placeholder="https://facebook.com/twojlokal" />
                    </div>
                  </>
                )}
              </div>

              {/* ── Godziny otwarcia (osobna sekcja) ── */}
              {!isDraft && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <BusinessHoursEditor
                    value={openingHours}
                    onChange={(next) => { setOpeningHours(next); setIsDirty(true); }}
                  />
                </div>
              )}

              {/* ── Kategoria główna + podkategorie (osobna sekcja) ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                {/* Kategoria główna */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("profile.main_category")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MAIN_CATEGORIES.map(cat => {
                      const active = mainCategory === cat.id;
                      return (
                        <button key={cat.id} type="button"
                          onClick={() => { const newMain = active ? "" : cat.id; setMainCategory(newMain); setBizSubcategories([]); if (secondaryCategory === newMain) setSecondaryCategory(""); setIsDirty(true); }}
                          className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left transition-all ${active ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'}`}>
                          <span className="text-xl shrink-0">{cat.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight">{cat.label}</p>
                            <p className="hidden md:block text-[10px] text-muted-foreground mt-0.5 truncate">{cat.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Podkategoria */}
                {mainCategory && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("profile.subcategory")}</p>
                      <span className={`text-[11px] font-bold ${bizSubcategories.length >= 3 ? 'text-slate-700' : 'text-muted-foreground'}`}>{bizSubcategories.length}/3</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(MAIN_CATEGORIES.find(c => c.id === mainCategory)?.subcategories ?? []).map(sub => {
                        const active = bizSubcategories.includes(sub.label);
                        const limitReached = bizSubcategories.length >= 3;
                        const disabled = !active && limitReached;
                        return (
                          <button key={sub.id} type="button"
                            disabled={disabled}
                            onClick={() => { setBizSubcategories(prev => active ? prev.filter(s => s !== sub.label) : (prev.length >= 3 ? prev : [...prev, sub.label])); setIsDirty(true); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-slate-700 border-slate-700 text-white' : disabled ? 'bg-background border-border text-muted-foreground/40 cursor-not-allowed' : 'bg-background border-border text-muted-foreground hover:border-slate-300 hover:text-foreground'}`}>
                            <span>{sub.emoji}</span>{sub.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Własna podkategoria */}
                    <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div>
                        <p className="text-xs font-bold text-foreground leading-tight">{t("profile.custom_cat_title")}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{t("profile.custom_cat_desc")}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          value={customSubcategory}
                          onChange={e => { setCustomSubcategory(e.target.value); setCustomSubcategoryStatus(null); setIsDirty(true); }}
                          maxLength={40}
                          placeholder={t("profile.custom_cat_placeholder")}
                          className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-foreground placeholder:text-slate-400 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200/60 transition-colors"
                        />
                        <button
                          type="button"
                          disabled={!customSubcategory.trim() || customSubcategoryStatus === 'pending' || customSubcategoryStatus === 'approved'}
                          onClick={() => { if (customSubcategory.trim()) { setCustomSubcategoryStatus('pending'); setIsDirty(true); } }}
                          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-[#D45113] hover:bg-[#D45113] text-white disabled:opacity-40 disabled:hover:bg-[#D45113] transition-colors"
                        >
                          {t("profile.propose")}
                        </button>
                      </div>
                      {customSubcategory.trim() && customSubcategoryStatus && (
                        <p className={`text-[11px] font-medium ${
                          customSubcategoryStatus === 'approved' ? 'text-green-600' :
                          customSubcategoryStatus === 'rejected' ? 'text-red-500' :
                          'text-amber-600'
                        }`}>
                          {customSubcategoryStatus === 'approved' ? t('profile.cat_approved') :
                           customSubcategoryStatus === 'rejected' ? t('profile.cat_rejected') :
                           t('profile.cat_pending')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Kategoria dodatkowa (opcjonalnie) */}
                {mainCategory && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {t("category.secondary_label")} <span className="normal-case font-normal">{t("profile.optional")}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mb-2">{t("category.secondary_hint")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MAIN_CATEGORIES.filter(cat => cat.id !== mainCategory).map(cat => {
                        const active = secondaryCategory === cat.id;
                        return (
                          <button key={cat.id} type="button"
                            onClick={() => { setSecondaryCategory(active ? "" : cat.id); setIsDirty(true); }}
                            className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left transition-all ${active ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'}`}>
                            <span className="text-xl shrink-0">{cat.emoji}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-tight">{cat.label}</p>
                              <p className="hidden md:block text-[10px] text-muted-foreground mt-0.5 truncate">{cat.hint}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tagi wizytówki (osobna sekcja) ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("profile.tags_label")} <span className="normal-case font-normal">{t("profile.tags_hint")}</span></p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(tagsExpanded ? VIBE_TAG_SUGGESTIONS : VIBE_TAG_SUGGESTIONS.slice(0, 4)).map(tag => {
                      const active = tags.includes(tag);
                      const disabled = !active && tags.length >= 3;
                      return (
                        <button key={tag} type="button" disabled={disabled}
                          onClick={() => { setTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag]); setIsDirty(true); }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 ${active ? 'bg-primary border-orange-600 text-white' : 'bg-background border-border text-muted-foreground hover:border-orange-400 hover:text-foreground'}`}>
                          #{tag}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setTagsExpanded(v => !v)}
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-dashed border-border text-muted-foreground hover:border-slate-400 transition-colors"
                    >
                      {tagsExpanded ? t('profile.collapse') : t('profile.more', { count: VIBE_TAG_SUGGESTIONS.length - 4 })}
                      <svg className={`h-3 w-3 transition-transform ${tagsExpanded ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l4 4 4-4"/></svg>
                    </button>
                  </div>
                  {/* Custom tag input - hashtag (#) widoczny by default; strip wiodacych # zeby nie bylo ## */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                      <span className="text-xs font-semibold text-muted-foreground select-none">#</span>
                      <input
                        value={customVibeTag} maxLength={20}
                        onChange={e => setCustomVibeTag(e.target.value.replace(/^#+/, ""))}
                        onKeyDown={e => { const v = customVibeTag.trim().replace(/^#+/, ""); if (e.key === 'Enter' && v && tags.length < 3) { setTags(prev => [...prev, v]); setCustomVibeTag(""); setIsDirty(true); } }}
                        placeholder={t("profile.custom_tag_placeholder")}
                        disabled={tags.length >= 3}
                        className="flex-1 bg-transparent px-1.5 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-40"
                      />
                    </div>
                    <button type="button" disabled={!customVibeTag.trim() || tags.length >= 3}
                      onClick={() => { const v = customVibeTag.trim().replace(/^#+/, ""); if (v && tags.length < 3) { setTags(prev => [...prev, v]); setCustomVibeTag(""); setIsDirty(true); } }}
                      className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-40">
                      {t("card.add")}
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map(t => (
                        <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-full text-xs font-semibold text-orange-700">
                          #{t}
                          <button type="button" onClick={() => { setTags(prev => prev.filter(x => x !== t)); setIsDirty(true); }} className="text-orange-400 hover:text-orange-700 ml-0.5">×</button>
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-400 self-center">{tags.length}/3</span>
                    </div>
                  )}
                </div>
              {/* ── Opis (osobna sekcja) ── */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("profile.description_label")}</p>
                <div className="space-y-1">
                  <textarea rows={3} value={description} maxLength={500} onChange={e => { setDescription(e.target.value); setIsDirty(true); }} placeholder={t("profile.description_placeholder")} className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  <p className="text-[11px] text-muted-foreground text-right">{description.length}/500</p>
                </div>
              </div>
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

          {/* ── MENU / CENNIK ── */}
          {activeSection === 'menu' && (() => {
            const menuLabel = mainCategory === 'food' ? t('menu.menu') : t('menu.pricelist');
            const hint = mainCategory === 'food'
              ? t('menu.hint_menu')
              : t('menu.hint_pricelist');
            return (
            <div className="space-y-5">
              <div><h2 className="text-lg font-black">{menuLabel}</h2><p className="text-sm text-slate-400">{hint}</p></div>
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-foreground">{menuLabel} <span className="font-normal text-muted-foreground text-xs">{t("menu.max", { max: MAX_MENU_IMAGES })}</span></p>
                      <p className="text-xs text-muted-foreground shrink-0">{menuImageUrls.length}/{MAX_MENU_IMAGES}</p>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {menuImageUrls.map((url, idx) => {
                        const pdf = isPdfUrl(url);
                        return (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted group cursor-pointer"
                          onClick={() => pdf ? window.open(url, "_blank", "noopener,noreferrer") : setPhotoPreview({ url, label: t("menu.photo_label", { label: menuLabel, n: idx + 1 }) })}>
                          {pdf ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50 pointer-events-none">
                              <FileText className="h-7 w-7 text-red-400" />
                              <span className="text-[10px] font-bold text-red-500">PDF</span>
                            </div>
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
                        <button onClick={() => menuInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 active:opacity-70">
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
              <div><h2 className="text-lg font-black">{t("posts.title")}</h2><p className="text-sm text-slate-400">{t("posts.subtitle")}</p></div>
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Form */}
                <div className="flex-1 space-y-5">
                  {/* Events */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("posts.current_event")}</p>
                    <p className="text-xs text-muted-foreground -mt-2">{t("posts.event_desc")}</p>
                    <div className="space-y-1">
                      <Label htmlFor="event_title">{t("posts.event_title_label")}</Label>
                      <Input id="event_title" value={eventTitle} maxLength={40} onChange={e => { setEventTitle(e.target.value); setIsDirty(true); }} placeholder={t("posts.event_title_placeholder")} />
                      <p className="text-[11px] text-muted-foreground text-right">{eventTitle.length}/40</p>
                    </div>
                    {/* Wersja angielska (auto-tlumaczenie z mozliwoscia nadpisania) - widoczna dla zagranicznych podroznikow */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="event_title_en" className="text-xs flex items-center gap-1.5 flex-wrap">
                          🌐 {t("posts.event_en_label")}
                          <span className="text-[10px] font-normal text-muted-foreground">{eventTitleEnOverridden ? t("posts.event_en_edited") : t("posts.event_en_auto")}</span>
                        </Label>
                        <button type="button" onClick={handleTranslateEvent} disabled={!eventTitle.trim() || translatingEvent}
                          className="text-[11px] font-semibold text-blue-600 disabled:opacity-40 active:opacity-70 shrink-0">
                          {translatingEvent ? t("posts.event_en_translating") : t("posts.event_en_translate")}
                        </button>
                      </div>
                      <Input id="event_title_en" value={eventTitleEn} maxLength={60}
                        onChange={e => { setEventTitleEn(e.target.value); setEventTitleEnOverridden(true); setIsDirty(true); }}
                        placeholder={t("posts.event_en_placeholder")} />
                      <p className="text-[11px] text-muted-foreground">{t("posts.event_en_hint")}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 min-w-0"><Label htmlFor="event_starts_at" className="text-xs">{t("posts.from")}</Label><Input id="event_starts_at" value={eventStartsAt} onChange={e => { setEventStartsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" /></div>
                      <div className="space-y-1 min-w-0"><Label htmlFor="event_ends_at" className="text-xs">{t("posts.to")}</Label><Input id="event_ends_at" value={eventEndsAt} onChange={e => { setEventEndsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" /></div>
                    </div>
                  </div>
                  {/* Zaplanowane wydarzenia (kolejka + historia) */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("posts.events_label")}</p>
                    <p className="text-xs text-muted-foreground -mt-2">{t("posts.events_desc")}</p>
                    {/* Formularz dodania */}
                    <div className="space-y-3 border border-border/60 rounded-2xl p-3">
                      <div className="space-y-1">
                        <Label htmlFor="new_event_title" className="text-xs">{t("posts.events_title_label")}</Label>
                        <Input id="new_event_title" value={newEventTitle} maxLength={40} onChange={e => setNewEventTitle(e.target.value)} placeholder={t("posts.events_title_placeholder")} />
                        <p className="text-[11px] text-muted-foreground text-right">{newEventTitle.length}/40</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_start" className="text-xs">{t("posts.from")}</Label><Input id="new_event_start" type="date" value={newEventStartsAt} onChange={e => setNewEventStartsAt(e.target.value)} className="w-full" /></div>
                        <div className="space-y-1 min-w-0"><Label htmlFor="new_event_end" className="text-xs">{t("posts.events_to_optional")}</Label><Input id="new_event_end" type="date" value={newEventEndsAt} onChange={e => setNewEventEndsAt(e.target.value)} className="w-full" /></div>
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
                                      <Input id={`edit_event_title_${ev.id}`} value={editEventTitle} maxLength={40} onChange={e => setEditEventTitle(e.target.value)} placeholder={t("posts.events_title_placeholder")} />
                                      <p className="text-[11px] text-muted-foreground text-right">{editEventTitle.length}/40</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_start_${ev.id}`} className="text-xs">{t("posts.from")}</Label><Input id={`edit_event_start_${ev.id}`} type="date" value={editEventStartsAt} onChange={e => setEditEventStartsAt(e.target.value)} className="w-full" /></div>
                                      <div className="space-y-1 min-w-0"><Label htmlFor={`edit_event_end_${ev.id}`} className="text-xs">{t("posts.events_to_optional")}</Label><Input id={`edit_event_end_${ev.id}`} type="date" value={editEventEndsAt} onChange={e => setEditEventEndsAt(e.target.value)} className="w-full" /></div>
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

          {/* ── ANALITYKA ── */}
          {activeSection === 'settings' && (
            <div className="space-y-5 max-w-lg">
              <div>
                <h2 className="text-lg font-black">{t("settings.title")}</h2>
                <p className="text-sm text-slate-400">{t("settings.subtitle")}</p>
              </div>
              {(!previewMode && !isDraft && user && (profile as any)?.owner_user_id === user.id) ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-700">{t("settings.logged_as")}</p>
                    <p className="text-xs text-slate-400 mt-0.5 break-all">{user.email}</p>
                  </div>
                  <div>
                    <BusinessDeleteAccount />
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{t("settings.delete_hint")}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <p className="text-sm text-slate-500">{t("settings.login_prompt")}</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'analytics' && (
            <div className="space-y-5">
              {/* Header + range picker */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-black">{t("analytics.title")}</h2>
                  <p className="text-sm text-slate-400">
                    {analyticsRange === 'custom' && customDateRange?.from
                      ? `${format(customDateRange.from, 'd MMM', { locale: dateLocale() })}${customDateRange.to && customDateRange.to !== customDateRange.from ? ` - ${format(customDateRange.to, 'd MMM yyyy', { locale: dateLocale() })}` : ''}`
                      : t('analytics.subtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5">
                    {(['7d', '30d', '90d'] as Exclude<AnalyticsRange, 'custom'>[]).map(r => (
                      <button
                        key={r}
                        onClick={() => setAnalyticsRange(r)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${analyticsRange === r ? 'bg-white text-foreground shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {r === '7d' ? t("range.7d") : r === '30d' ? t("range.30d") : t("range.90d")}
                      </button>
                    ))}
                  </div>
                  {/* Custom date range picker */}
                  <div className="relative" ref={calendarRef}>
                    <button
                      onClick={() => setShowCalendar(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${analyticsRange === 'custom' ? 'bg-foreground text-background border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="12" height="11" rx="2"/>
                        <path d="M5 1v2M11 1v2M2 7h12"/>
                      </svg>
                      {t("analytics.range")}
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                        <Calendar
                          mode="range"
                          selected={customDateRange}
                          onSelect={(range) => {
                            setCustomDateRange(range);
                            if (range?.from) {
                              setAnalyticsRange('custom');
                              if (range.to) setShowCalendar(false);
                            }
                          }}
                          disabled={(d) => d > new Date()}
                          locale={dateLocale()}
                          className="p-3"
                          classNames={{
                            months: "flex flex-col",
                            caption: "flex justify-center pt-1 relative items-center mb-3",
                            caption_label: "text-sm font-bold",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            table: "w-full border-collapse",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
                            row: "flex w-full mt-1",
                            cell: "w-9 text-center p-0 relative",
                            day: "h-9 w-9 rounded-full text-sm hover:bg-muted transition-colors",
                            day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background",
                            day_range_start: "rounded-l-full rounded-r-none bg-foreground text-background",
                            day_range_end: "rounded-r-full rounded-l-none bg-foreground text-background",
                            day_range_middle: "rounded-none bg-slate-100 text-foreground",
                            day_today: "font-bold text-orange-600",
                            day_outside: "opacity-30",
                            day_disabled: "opacity-20 cursor-not-allowed",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {plan !== 'premium' ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                  <span className="text-3xl">🔒</span>
                  <p className="font-bold text-base mt-3">{t("analytics.locked_title")}</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">{t("analytics.locked_desc")}</p>
                  <button onClick={() => setShowUpgradeBanner(true)} className="px-5 py-2.5 rounded-2xl bg-amber-500 text-white text-sm font-bold">{t("analytics.learn_more")}</button>
                </div>
              ) : (
                <>
                  {/* Draft: mock data banner */}
                  {isDraft && (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl px-5 py-4">
                      <p className="text-sm font-bold text-orange-900">{t("analytics.draft_title")}</p>
                      <p className="text-xs text-orange-600 mt-0.5">{t("analytics.draft_desc")}</p>
                    </div>
                  )}
                  {/* Stat cards */}
                  {(() => {
                    const s = isDraft
                      ? { views: 1247, uniqueChoices: 156, onRoutes: 89, websiteClicks: 34, phoneClicks: 21 }
                      : stats;
                    return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: t('analytics.stat_views'), value: s.views, desc: t('analytics.views_desc'), icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50' },
                      { label: t('analytics.stat_unique'), value: s.uniqueChoices, desc: t('analytics.unique_desc'), icon: Users, color: 'text-rose-500', bg: 'bg-rose-50' },
                      { label: t('analytics.stat_addplan'), value: s.onRoutes, desc: t('analytics.addplan_desc'), icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                      { label: t('analytics.stat_clicks'), value: s.websiteClicks + s.phoneClicks, desc: t('analytics.clicks_desc', { www: s.websiteClicks, tel: s.phoneClicks }), icon: MousePointerClick, color: 'text-violet-500', bg: 'bg-violet-50' },
                    ].map(({ label, value, desc, icon: Icon, color, bg }) => (
                      <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <p className="text-2xl font-black text-foreground leading-none mb-1">{analyticsLoading ? '-' : value}</p>
                        <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-400 leading-snug">{desc}</p>
                      </div>
                    ))}
                  </div>
                    );
                  })()}

                  {/* Daily activity chart */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("analytics.activity_over_time")}</p>
                      <div className="flex items-center gap-3">
                        {[
                          { key: 'views', label: t('analytics.legend_views'), color: '#3b82f6' },
                          { key: 'routes', label: t('analytics.legend_route'), color: '#10b981' },
                          { key: 'clicks', label: t('analytics.legend_clicks'), color: '#8b5cf6' },
                        ].map(({ key, label, color }) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[10px] text-slate-400">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {analyticsLoading ? (
                      <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                      </div>
                    ) : chartData.every(d => d.views === 0 && d.routes === 0 && d.clicks === 0) ? (
                      <div className="flex flex-col items-center justify-center h-48 gap-2">
                        <BarChart2 className="h-8 w-8 text-slate-200" />
                        <p className="text-sm text-slate-400">{t("analytics.no_data")}</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={chartData}
                          barSize={chartData.length <= 10 ? 18 : chartData.length <= 35 ? 8 : 4}
                          barCategoryGap="30%"
                          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={false}
                            interval={chartData.length <= 10 ? 0 : chartData.length <= 35 ? 4 : 13}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#cbd5e1' }}
                            tickLine={false}
                            axisLine={false}
                            width={24}
                          />
                          <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                            labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 6, fontSize: 12 }}
                            formatter={(val: number, name: string) => {
                              const map: Record<string, string> = { views: t('analytics.tt_views'), routes: t('analytics.tt_routes'), clicks: t('analytics.tt_clicks') };
                              return [val, map[name] ?? name];
                            }}
                          />
                          <Bar dataKey="views" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                          <Bar dataKey="routes" fill="#10b981" radius={[0, 0, 0, 0]} stackId="a" />
                          <Bar dataKey="clicks" fill="#8b5cf6" radius={[3, 3, 0, 0]} stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Hourly traffic chart */}
                  {(() => {
                    const maxVal = Math.max(...hourlyData.map(h => h.total), 1);
                    const peakHour = hourlyData.reduce((best, h) => h.total > best.total ? h : best, hourlyData[0] ?? { hour: -1, total: 0 });
                    const hasData = hourlyData.some(h => h.total > 0);
                    return (
                      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("analytics.hourly_title")}</p>
                          {hasData && !analyticsLoading && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                              {t("analytics.peak", { from: `${peakHour.hour}:00`, to: `${peakHour.hour + 1}:00` })}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-300 mb-4">{t("analytics.hourly_desc")}</p>
                        {analyticsLoading ? (
                          <div className="flex items-center justify-center h-36">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                          </div>
                        ) : !hasData ? (
                          <div className="flex flex-col items-center justify-center h-36 gap-2">
                            <BarChart2 className="h-8 w-8 text-slate-200" />
                            <p className="text-sm text-slate-400">{t("analytics.no_data")}</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={160}>
                            <BarChart
                              data={hourlyData}
                              barSize={10}
                              barCategoryGap="15%"
                              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                            >
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                interval={2}
                              />
                              <YAxis allowDecimals={false} hide />
                              <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                                labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 4, fontSize: 12 }}
                                formatter={(val: number) => [val, t('analytics.events')]}
                                labelFormatter={(label) => t('analytics.hour', { label })}
                              />
                              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                {hourlyData.map((entry) => {
                                  const ratio = entry.total / maxVal;
                                  const fill = ratio >= 0.85
                                    ? '#D45113'
                                    : ratio >= 0.5
                                    ? '#fb923c'
                                    : ratio >= 0.2
                                    ? '#93c5fd'
                                    : '#dbeafe';
                                  return <Cell key={entry.hour} fill={fill} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        {hasData && !analyticsLoading && (
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
                            {[
                              { color: '#D45113', label: t('analytics.peak_traffic') },
                              { color: '#93c5fd', label: t('analytics.activity') },
                              { color: '#dbeafe', label: t('analytics.low_traffic') },
                            ].map(({ color, label }) => (
                              <div key={label} className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
                                <span className="text-[10px] text-slate-400">{label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Activity feed */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t("activity.title")}</p>
                    {recentEvents.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">{t("activity.empty")}</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-slate-50">
                        {recentEvents.map((ev, i) => {
                          const labels: Record<string, { txt: string; dot: string }> = {
                            view: { txt: t('analytics.act_view'), dot: 'bg-blue-400' },
                            add_to_route: { txt: t('analytics.act_add'), dot: 'bg-emerald-400' },
                            click_phone: { txt: t('analytics.act_phone'), dot: 'bg-violet-400' },
                            click_website: { txt: t('analytics.act_website'), dot: 'bg-violet-400' },
                            click_booking: { txt: t('analytics.act_booking'), dot: 'bg-amber-400' },
                          };
                          const info = labels[ev.event_type] ?? { txt: ev.event_type, dot: 'bg-slate-300' };
                          return (
                            <div key={i} className="flex items-center gap-3 py-3">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${info.dot}`} />
                              <p className="text-sm text-slate-600 flex-1">{info.txt}</p>
                              <p className="text-xs text-slate-400 shrink-0">{formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: dateLocale() })}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Mobile FAB — temporarily disabled on frontend */}

      {/* Sticky save bar */}
      {isDirty && !previewMode && !isDraft && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe-6 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
          <button onClick={handleSave} disabled={saving || uploading !== null} className="w-full max-w-2xl mx-auto flex py-3.5 rounded-2xl bg-primary hover:bg-primary text-white font-semibold text-sm transition-colors disabled:opacity-50 items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("save.button")}
          </button>
        </div>
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

      {/* ── Mobile/Tablet FAB: Podglad wizytowki - tylko desktop (lg+) ma sticky sidebar preview ── */}
      <button
        onClick={() => previewReady && setShowAppPreview(true)}
        disabled={!previewReady}
        title={!previewReady ? t("fab.incomplete") : t("fab.preview_title")}
        aria-label={t("fab.preview_aria")}
        className="lg:hidden fixed z-[55] flex items-center gap-2 px-5 py-3 rounded-full bg-[#D45113] text-white font-bold text-sm shadow-lg shadow-orange-600/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", right: "1rem" }}
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
          logoUrl={logoUrl}
          coverImageUrl={coverImageUrl}
          coverVideoUrl={coverVideoUrl}
          galleryUrls={galleryUrls}
          menuImageUrls={menuImageUrls}
          eventTitle={eventTitle}
          eventDescription={eventDescription}
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
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <button
              onClick={handleSupportSubmit}
              disabled={supportSubmitting || !supportMessage.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {supportSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t("support.sending")}</> : t("support.submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;
