import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, BarChart2, MapPin, MousePointerClick, Plus, X, LogOut, ImagePlus, Trash2, Send, Users, Phone } from "lucide-react";
import { formatDistanceToNow, subDays, format, addDays, differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface BusinessPost {
  id: string;
  place_id: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
}

const PLACE_CATEGORIES: Record<string, { label: string; icon: string; subcats: string[] }> = {
  restaurant:    { label: 'Restauracja',   icon: '🍽️', subcats: ['Polska kuchnia', 'Włoska', 'Azjatycka', 'Burgery', 'Sushi', 'Vege/Vegan', 'Fine dining', 'Seafood', 'Pizza', 'Fast food'] },
  cafe:          { label: 'Kawiarnia',     icon: '☕',  subcats: ['Specialty coffee', 'Cukiernia & ciasta', 'Śniadania & brunch', 'Lody & desery', 'Herbaciarnia'] },
  bar:           { label: 'Bar',           icon: '🍸',  subcats: ['Koktajle', 'Craft beer', 'Wine bar', 'Pub & piwo', 'Whisky', 'Karaoke & imprezy'] },
  museum:        { label: 'Muzeum',        icon: '🏛️', subcats: ['Historyczne', 'Sztuka nowoczesna', 'Nauka & technika', 'Militarne', 'Etnograficzne', 'Regionalne'] },
  monument:      { label: 'Zabytek',       icon: '🏰',  subcats: ['Kościół / Katedra', 'Zamek / Pałac', 'Kamienica', 'Pomnik', 'Ruiny', 'Kaplica'] },
  park:          { label: 'Park / Natura', icon: '🌿',  subcats: ['Park miejski', 'Ogród botaniczny', 'ZOO', 'Las / Góry', 'Plaża / Jezioro', 'Rezerwat'] },
  experience:    { label: 'Atrakcja',      icon: '✨',  subcats: ['Punkt widokowy', 'Interaktywna', 'Escape room', 'Sporty / Aktywność', 'Spa & wellness', 'Targi / Rynki'] },
  shopping:      { label: 'Sklep',         icon: '🛍️', subcats: ['Antyki', 'Design & rękodzieło', 'Pamiątki', 'Moda lokalna', 'Lokalny targ'] },
  accommodation: { label: 'Nocleg',        icon: '🏨',  subcats: ['Hotel', 'Hostel', 'Apartament', 'Pensjonat / B&B', 'Kemping'] },
};

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
}

interface Stats { views: number; onRoutes: number; websiteClicks: number; phoneClicks: number; uniqueChoices: number; }
type AnalyticsRange = '7d' | '30d' | '90d' | 'custom';
interface ChartDay { date: string; views: number; routes: number; clicks: number; }
interface HourlyBucket { hour: number; label: string; total: number; }

const MAX_GALLERY = 10;

function BusinessCardPreview({ logoUrl, coverImageUrl, businessName, city, street, tags, description, eventTitle, eventDescription, posts }: {
  logoUrl: string; coverImageUrl: string; businessName: string; city: string; street: string;
  tags: string[]; description: string; eventTitle: string; eventDescription: string;
  posts: BusinessPost[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm sticky top-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-4 pt-3 pb-2">Podgląd wizytówki</p>
      {coverImageUrl
        ? <div className="h-28 w-full overflow-hidden bg-slate-100"><img src={coverImageUrl} className="w-full h-full object-cover" /></div>
        : <div className="h-28 w-full bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center text-slate-300 text-xs">brak zdjęcia głównego</div>
      }
      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
        {logoUrl
          ? <img src={logoUrl} className="h-10 w-10 rounded-xl object-cover shrink-0 shadow-sm" />
          : <div className="h-10 w-10 rounded-xl bg-slate-100 shrink-0 flex items-center justify-center text-slate-300 text-lg">🏠</div>
        }
        <div>
          <p className="font-black text-base leading-tight">{businessName || 'Nazwa lokalu'}</p>
          {(city || street) && <p className="text-xs text-muted-foreground mt-0.5">{[street, city].filter(Boolean).join(', ')}</p>}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {tags.slice(0, 3).map(t => <span key={t} className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-semibold">#{t}</span>)}
        </div>
      )}
      {description && <p className="px-4 pb-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>}
      {eventTitle && (
        <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Wydarzenie</p>
          <p className="text-xs font-semibold">{eventTitle}</p>
          {eventDescription && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{eventDescription}</p>}
        </div>
      )}
      {posts.length > 0 && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 pt-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aktualności</p>
          {posts.slice(0, 2).map(p => (
            <div key={p.id} className="border border-border/50 rounded-2xl p-3 space-y-2">
              {p.description && <p className="text-xs leading-relaxed text-foreground/90 line-clamp-3">{p.description}</p>}
              {p.photo_urls.length > 0 && (
                <div className={`grid gap-1 ${p.photo_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {p.photo_urls.map((url, idx) => (
                    <img key={idx} src={url} className="w-full rounded-xl object-cover aspect-square" />
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: pl })}</p>
            </div>
          ))}
        </div>
      )}
      {posts.length === 0 && !eventTitle && !description && (
        <p className="text-xs text-slate-300 text-center pb-4 px-4">Uzupełnij dane lokalu żeby zobaczyć podgląd</p>
      )}
    </div>
  );
}

const BusinessDashboard = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
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
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mainCategory, setMainCategory] = useState("");
  const [bizSubcategories, setBizSubcategories] = useState<string[]>([]);
  const [customVibeTag, setCustomVibeTag] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");

  const [plan, setPlan] = useState<BizPlan>('premium');
  const [previewTab, setPreviewTab] = useState<'basic' | 'premium'>('premium');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [reviewRequestedAt, setReviewRequestedAt] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null); // which slot is uploading
  const [isDirty, setIsDirty] = useState(false);

  const [activeSection, setActiveSection] = useState<'overview' | 'gallery' | 'profile' | 'posts' | 'analytics'>('overview');
  const [recentEvents, setRecentEvents] = useState<Array<{event_type: string, created_at: string}>>([]);

  // Posts state
  const [posts, setPosts] = useState<BusinessPost[]>([]);
  const [postDescription, setPostDescription] = useState("");
  const [postPhotos, setPostPhotos] = useState<string[]>([]);
  const [postPhotoUploading, setPostPhotoUploading] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const postPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !placeId) return;
    loadData();
  }, [user, placeId]);

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

  const loadData = async () => {
    if (!placeId || !user) return;
    setLoading(true);

    // Try to find by place_id first, then fall back to business_profiles.id
    let { data: profileData } = await (supabase as any)
      .from("business_profiles").select("*").eq("place_id", placeId).maybeSingle();
    if (!profileData) {
      const { data: byId } = await (supabase as any)
        .from("business_profiles").select("*").eq("id", placeId).maybeSingle();
      profileData = byId;
    }

    if (!profileData) { setAccessDenied(true); setLoading(false); return; }

    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleData;

    if (profileData.owner_user_id !== user.id && !isAdmin) {
      setAccessDenied(true); setLoading(false); return;
    }

    // Fetch place category
    const { data: placeData } = await supabase.from("places").select("category").eq("id", placeId).maybeSingle();
    setPlaceCategory((placeData as any)?.category ?? null);

    setProfile(profileData as BusinessProfile);
    // All businesses get premium access
    setPlan('premium');
    setBusinessName(profileData.business_name ?? "");
    setPhone(profileData.phone ?? "");
    setEmail(profileData.email ?? "");
    setWebsite(profileData.website ?? "");
    setStreet(profileData.street ?? "");
    setCity(profileData.city ?? "");
    setPostalCode(profileData.postal_code ?? "");
    setTags(profileData.tags ?? []);
    setMainCategory(profileData.main_category ?? "");
    setBizSubcategories(profileData.subcategories ?? []);
    setDescription(profileData.description ?? "");
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setGalleryUrls(profileData.gallery_urls ?? []);
    setEventTitle(profileData.event_title ?? "");
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

    const { data: recentEventsData } = await (supabase as any)
      .from("place_events")
      .select("event_type, created_at")
      .eq("place_id", placeId)
      .order("created_at", { ascending: false })
      .limit(8);
    if (recentEventsData) setRecentEvents(recentEventsData);

    const { from, to } = rangeFromPreset('30d');
    await loadAnalytics(placeId, from, to);

    // Fetch posts
    const { data: postsData } = await (supabase as any)
      .from("business_posts").select("*").eq("place_id", placeId).order("created_at", { ascending: false });
    if (postsData) setPosts(postsData as BusinessPost[]);

    setLoading(false);
  };

  const PRESET_DAYS: Record<Exclude<AnalyticsRange, 'custom'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

  const rangeFromPreset = (range: Exclude<AnalyticsRange, 'custom'>): { from: Date; to: Date } => ({
    from: startOfDay(subDays(new Date(), PRESET_DAYS[range] - 1)),
    to: endOfDay(new Date()),
  });

  const loadAnalytics = useCallback(async (pid: string, from: Date, to: Date) => {
    setAnalyticsLoading(true);
    const { data } = await (supabase as any)
      .from("place_events")
      .select("event_type, user_id, created_at")
      .eq("place_id", pid)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    if (data) {
      const events = data as Array<{ event_type: string; user_id: string | null; created_at: string }>;
      const routeEvents = events.filter(e => e.event_type === "add_to_route");
      setStats({
        views: events.filter(e => e.event_type === "view").length,
        onRoutes: routeEvents.length,
        websiteClicks: events.filter(e => e.event_type === "click_website").length,
        phoneClicks: events.filter(e => e.event_type === "click_phone").length,
        uniqueChoices: new Set(routeEvents.filter(e => e.user_id).map(e => e.user_id)).size,
      });

      const numDays = differenceInCalendarDays(to, from) + 1;
      const dayMap: Record<string, ChartDay> = {};
      for (let i = 0; i < numDays; i++) {
        const d = addDays(from, i);
        const key = format(d, "yyyy-MM-dd");
        dayMap[key] = { date: format(d, numDays <= 14 ? "d MMM" : "d MMM", { locale: pl }), views: 0, routes: 0, clicks: 0 };
      }
      events.forEach(e => {
        const key = e.created_at.slice(0, 10);
        if (!dayMap[key]) return;
        if (e.event_type === "view") dayMap[key].views++;
        else if (e.event_type === "add_to_route") dayMap[key].routes++;
        else if (e.event_type === "click_phone" || e.event_type === "click_website") dayMap[key].clicks++;
      });
      setChartData(Object.values(dayMap));

      // Hourly breakdown (local timezone)
      const hourBuckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${h}:00`,
        total: 0,
      }));
      events.forEach(e => {
        const h = new Date(e.created_at).getHours();
        hourBuckets[h].total++;
      });
      setHourlyData(hourBuckets);
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
    if (analyticsRange === 'custom') {
      if (!customDateRange?.from) return;
      loadAnalytics(placeId, startOfDay(customDateRange.from), endOfDay(customDateRange.to ?? customDateRange.from));
    } else {
      const { from, to } = rangeFromPreset(analyticsRange);
      loadAnalytics(placeId, from, to);
    }
  }, [analyticsRange, customDateRange, placeId, profile, loadAnalytics]);

  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!ALLOWED_MIME.includes(file.type)) throw new Error("Niedozwolony format pliku (dozwolone: JPG, PNG, WEBP)");
    if (file.size > MAX_FILE_SIZE) throw new Error("Plik jest za duży (max 5 MB)");
    const ext = file.name.split(".").pop() ?? "jpg";
    // Use profile.id as the storage folder (stable even when placeId is a UUID fallback)
    const folder_key = profile?.id ?? placeId;
    const path = `${folder_key}/${folder}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("business-photos").upload(path, file, { upsert: true });
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
    } catch (err: any) { toast.error(err.message ?? "Nie udało się przesłać logo"); }
    setUploading(null);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("cover");
    try {
      const url = await uploadFile(file, "cover");
      setCoverImageUrl(url);
      setIsDirty(true);
    } catch (err: any) { toast.error(err.message ?? "Nie udało się przesłać zdjęcia okładkowego"); }
    setUploading(null);
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
    } catch (err: any) { toast.error(err.message ?? "Nie udało się przesłać zdjęć"); }
    setUploading(null);
    e.target.value = "";
  };

  const removeGalleryPhoto = (idx: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handlePostPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPostPhotoUploading(true);
    try {
      const urls = await Promise.all(files.slice(0, 4 - postPhotos.length).map(f => uploadFile(f, "posts")));
      setPostPhotos(prev => [...prev, ...urls]);
    } catch { toast.error("Nie udało się przesłać zdjęcia"); }
    setPostPhotoUploading(false);
    e.target.value = "";
  };

  const handleAddPost = async () => {
    if (!placeId || (!postDescription.trim() && postPhotos.length === 0)) return;
    setSubmittingPost(true);
    const { data, error } = await (supabase as any)
      .from("business_posts")
      .insert({ place_id: placeId, description: postDescription.trim() || null, photo_urls: postPhotos })
      .select()
      .single();
    if (error) { toast.error("Nie udało się dodać posta"); }
    else {
      setPosts(prev => [data as BusinessPost, ...prev]);
      setPostDescription("");
      setPostPhotos([]);
      if (postPhotoInputRef.current) postPhotoInputRef.current.value = "";
      toast.success("Post dodany!");
    }
    setSubmittingPost(false);
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm("Usunąć ten post? Tej operacji nie można cofnąć.")) return;
    // Optimistic remove
    setPosts(prev => prev.filter(p => p.id !== id));
    const { error } = await (supabase as any).from("business_posts").delete().eq("id", id);
    if (error) {
      toast.error("Nie udało się usunąć posta");
      // Rollback — reload posts
      const { data } = await (supabase as any)
        .from("business_posts").select("*").eq("place_id", placeId).order("created_at", { ascending: false });
      if (data) setPosts(data as BusinessPost[]);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (eventStartsAt && eventEndsAt && eventEndsAt < eventStartsAt) {
      toast.error("Data końca wydarzenia nie może być wcześniejsza niż data początku");
      return;
    }
    setSaving(true);

    // Trigger review if profile looks complete and not already requested
    const isComplete = businessName.trim() && street.trim() && city.trim() && phone.trim();
    const nowIso = new Date().toISOString();
    const reviewAt = isComplete && !reviewRequestedAt ? nowIso : reviewRequestedAt;

    const { error } = await (supabase as any)
      .from("business_profiles")
      .update({
        business_name: businessName,
        phone: phone || null,
        email: email || null,
        website: website || null,
        street: street || null,
        city: city || null,
        postal_code: postalCode || null,
        tags: tags.length > 0 ? tags : null,
        main_category: mainCategory || null,
        subcategories: bizSubcategories.length > 0 ? bizSubcategories : null,
        description: description || null,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        gallery_urls: galleryUrls,
        event_title: eventTitle || null,
        event_description: eventDescription || null,
        event_starts_at: eventStartsAt || null,
        event_ends_at: eventEndsAt || null,
        review_requested_at: reviewAt,
        updated_at: nowIso,
      })
      .eq("id", profile.id);
    if (error) {
      toast.error("Nie udało się zapisać zmian");
    } else {
      if (isComplete && !reviewRequestedAt) {
        setReviewRequestedAt(nowIso);
        toast.success("Zmiany zapisane! Wizytówka trafiła do weryfikacji.");
      } else {
        toast.success("Zmiany zapisane!");
      }
      setIsDirty(false);
    }
    setSaving(false);
  };

  const dismissVerifiedBanner = async () => {
    setShowVerifiedBanner(false);
    if (!profile) return;
    await (supabase as any).from("business_profiles")
      .update({ verification_notified_at: new Date().toISOString() })
      .eq("id", profile.id);
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


  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (accessDenied || !profile) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-24 px-6 text-center">
      <p className="text-lg font-semibold mb-2">Brak dostępu</p>
      <p className="text-sm text-muted-foreground">Nie masz uprawnień do zarządzania tą wizytówką.</p>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col fixed h-full bg-white border-r border-slate-100 py-5 px-3 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="h-6 w-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <span className="font-black text-sm">trasa.biznes</span>
        </div>
        {/* Plan badge */}
        <div className="px-2 mb-6">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[plan]}`}>{PLAN_LABELS[plan]}</span>
        </div>
        {/* Nav items */}
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Menu</p>
        {([
          { id: 'overview', label: 'Przegląd' },
          { id: 'gallery', label: 'Galeria zdjęć' },
          { id: 'profile', label: 'Dane lokalu' },
          { id: 'posts', label: 'Aktualności' },
          { id: 'analytics', label: 'Analityka' },
        ] as const).map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mb-0.5 text-left ${activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${activeSection === item.id ? 'bg-blue-500' : 'bg-slate-300'}`} />
            {item.label}
          </button>
        ))}
        {/* Logout at bottom */}
        <div className="mt-auto px-2">
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2">
            <LogOut className="h-3.5 w-3.5" />
            Wyloguj się
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">

        {/* ── Top bar ── */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 md:px-6 h-14 flex items-center gap-3 shrink-0">
          {/* Mobile: orb logo */}
          <div className="md:hidden h-6 w-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <div className="flex-1 hidden md:flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 max-w-xs">
            <span className="text-xs text-slate-400">Szukaj w panelu...</span>
          </div>
          <div className="flex-1 md:flex-none flex items-center gap-2">
            <p className="text-sm font-bold truncate">{profile.business_name}</p>
            <span className={`hidden md:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}>{PLAN_LABELS[plan]}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
              {profile.business_name?.slice(0, 2).toUpperCase() || 'BK'}
            </div>
            <button onClick={handleLogout} className="md:hidden flex items-center gap-1 text-xs text-muted-foreground px-2 py-1.5 rounded-full bg-slate-100">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Mobile horizontal tabs ── */}
        <div className="md:hidden sticky top-14 z-10 bg-white border-b border-slate-100 flex overflow-x-auto shrink-0 px-3 gap-1 py-2">
          {([
            { id: 'overview', label: 'Przegląd' },
            { id: 'gallery', label: 'Galeria' },
            { id: 'profile', label: 'Dane' },
            { id: 'posts', label: 'Aktualności' },
            { id: 'analytics', label: 'Analityka' },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className={`flex-1 p-4 md:p-6 max-w-4xl w-full ${isDirty ? 'pb-28' : 'pb-6'}`}>

          {/* Banners (always visible) */}
          <div className="space-y-3 mb-4">
            {showWelcomeBanner && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-black text-base leading-tight">Witaj w Panelu Biznesowym trasy! 🎁</p>
                    <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">
                      Twoje konto jest aktywne i masz dostęp do pełnego pakietu <strong className="text-white">Premium</strong> — gratis przez pierwsze 3 miesiące. Wypełnij wizytówkę i poczekaj na weryfikację.
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
                    <p className="font-bold text-sm text-amber-800">✓ Wizytówka zweryfikowana!</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">Twoja wizytówka została zatwierdzona przez zespół trasy. Teraz jest w pełni widoczna dla użytkowników aplikacji.</p>
                  </div>
                  <button onClick={dismissVerifiedBanner} className="text-amber-400 active:opacity-60 flex-shrink-0 mt-0.5"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}
            {reviewRequestedAt && !profile.is_verified && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-700">Wizytówka oczekuje na weryfikację</p>
                  <p className="text-[11px] text-blue-500 mt-0.5">Sprawdzimy ją i zatwierdzimy wkrótce.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── PRZEGLĄD ── */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-foreground">Przegląd</h2>
                <p className="text-sm text-slate-400">Oto co dzieje się z Twoim lokalem w ostatnich 30 dniach.</p>
              </div>
              {/* Stats 4 cards */}
              {plan === 'premium' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Wyświetlenia profilu', value: stats.views, icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Dodania do trasy', value: stats.onRoutes, icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Kliknięcia', value: stats.websiteClicks + stats.phoneClicks, icon: MousePointerClick, color: 'text-violet-500', bg: 'bg-violet-50' },
                    { label: 'Łączna aktywność', value: stats.views + stats.onRoutes + stats.websiteClicks + stats.phoneClicks, icon: BarChart2, color: 'text-orange-500', bg: 'bg-orange-50' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <div className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <p className="text-2xl font-black text-foreground leading-none mb-1">{value}</p>
                      <p className="text-xs text-slate-400 leading-snug">{label}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">ostatnie 30 dni</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative rounded-2xl border border-dashed border-border/60 p-4 overflow-hidden">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 opacity-30 pointer-events-none select-none">
                    {['Wyświetlenia', 'Na trasach', 'Kliknięcia', 'Aktywność'].map(l => (
                      <div key={l} className="bg-white border border-slate-100 rounded-2xl p-4"><p className="text-2xl font-black">—</p><p className="text-xs text-slate-400">{l}</p></div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-lg">🔒</span>
                    <p className="text-xs font-semibold">Analityka dostępna w planie Premium</p>
                  </div>
                </div>
              )}
              {/* Activity feed */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ostatnia aktywność</p>
                {recentEvents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Brak aktywności w ostatnim czasie.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-50">
                    {recentEvents.map((ev, i) => {
                      const labels: Record<string, { txt: string; dot: string }> = {
                        view: { txt: 'Ktoś wyświetlił Twój profil', dot: 'bg-blue-400' },
                        add_to_route: { txt: 'Lokal dodany do trasy', dot: 'bg-emerald-400' },
                        click_phone: { txt: 'Kliknięcie w numer telefonu', dot: 'bg-violet-400' },
                        click_website: { txt: 'Kliknięcie w stronę WWW', dot: 'bg-violet-400' },
                        click_booking: { txt: 'Kliknięcie w rezerwację', dot: 'bg-amber-400' },
                      };
                      const info = labels[ev.event_type] ?? { txt: ev.event_type, dot: 'bg-slate-300' };
                      return (
                        <div key={i} className="flex items-center gap-3 py-2.5">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${info.dot}`} />
                          <p className="text-sm text-slate-600 flex-1">{info.txt}</p>
                          <p className="text-[10px] text-slate-400 shrink-0">
                            {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: pl })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Preview card */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Podgląd wizytówki</p>
                <div className="flex rounded-2xl bg-muted p-0.5 gap-0.5">
                  {(['basic', 'premium'] as const).map(tab => (
                    <button key={tab} onClick={() => { if (tab === 'premium' && plan === 'basic') setShowUpgradeBanner(true); setPreviewTab(tab); }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-2xl transition-all ${previewTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {tab === 'basic' ? '✦ Basic' : '★ Premium'}
                      {tab === 'premium' && plan !== 'premium' && <span className="ml-1 text-[9px] font-bold bg-amber-400 text-amber-900 px-1 py-0.5 rounded-full">PRO</span>}
                    </button>
                  ))}
                </div>
                <div className="relative w-full max-w-xs mx-auto" style={{ aspectRatio: '3/4', maxHeight: 300 }}>
                  <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg">
                    {coverImageUrl ? <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-orange-800 to-orange-600" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
                      {previewTab === 'premium' && logoUrl && <img src={logoUrl} className="w-8 h-8 rounded-full object-cover border-2 border-white/30 mb-1" />}
                      <p className="text-white font-black text-xl leading-tight">{businessName || 'Nazwa lokalu'}</p>
                      <p className="text-white/70 text-sm">{[placeCategory, '@trasa'].filter(Boolean).join(' · ')}</p>
                      {previewTab === 'premium' && description && <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{description}</p>}
                      {previewTab === 'premium' && eventTitle && (
                        <div className="inline-flex items-center gap-1 bg-amber-500/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-semibold">🎉 {eventTitle}</div>
                      )}
                    </div>
                    {previewTab === 'basic' && <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✦ Basic</div>}
                    {previewTab === 'premium' && <div className="absolute top-3 left-3 bg-amber-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">★ Premium</div>}
                    {previewTab === 'premium' && plan !== 'premium' && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">🔒</span>
                        <p className="text-white font-bold text-sm text-center px-6">Plan Premium</p>
                        <button onClick={() => setShowUpgradeBanner(true)} className="mt-2 px-4 py-2 rounded-2xl bg-amber-500 text-white text-xs font-bold active:opacity-80">Dowiedz się więcej →</button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">{previewTab === 'basic' ? 'Basic: zdjęcie główne + dane kontaktowe' : 'Premium: logo, galeria, wydarzenia, posty, analityka'}</p>
              </div>
              {showUpgradeBanner && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm">★ Przejdź na Premium</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Odblokuj logo, galerię do 10 zdjęć, wydarzenia, posty i pełną analitykę.</p>
                    </div>
                    <button onClick={() => setShowUpgradeBanner(false)} className="text-muted-foreground mt-0.5 active:opacity-60"><X className="h-4 w-4" /></button>
                  </div>
                  <a href="mailto:kontakt@trasa.app?subject=Upgrade do Premium" className="flex items-center justify-center w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm active:opacity-80">
                    Napisz do nas → kontakt@trasa.app
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── GALERIA ── */}
          {activeSection === 'gallery' && (
            <div className="space-y-5">
              <div><h2 className="text-lg font-black">Galeria zdjęć</h2><p className="text-sm text-slate-400">Logo, zdjęcie główne i galeria widoczne na Twojej wizytówce.</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
                {/* Logo — compact */}
                <div className="flex items-start gap-4">
                  <div>
                    <p className="text-xs font-medium mb-1.5">Logo</p>
                    <button onClick={() => logoInputRef.current?.click()} className="relative h-20 w-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 active:opacity-70">
                      {uploading === 'logo' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : logoUrl ? (<><img src={logoUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><ImagePlus className="h-4 w-4 text-white" /></div></>) : (<div className="flex flex-col items-center gap-1 text-muted-foreground"><Plus className="h-5 w-5" /><span className="text-[10px]">Logo</span></div>)}
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>

                {/* Cover + Gallery — 2-col on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium mb-1.5">Zdjęcie główne</p>
                    <button onClick={() => coverInputRef.current?.click()} className="relative w-full aspect-video rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 active:opacity-70">
                      {uploading === 'cover' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : coverImageUrl ? (<><img src={coverImageUrl} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><ImagePlus className="h-5 w-5 text-white" /></div></>) : (<div className="flex flex-col items-center gap-1 text-muted-foreground"><Plus className="h-6 w-6" /><span className="text-[11px]">Dodaj zdjęcie</span></div>)}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium">Galeria dodatkowa</p>
                      <p className="text-[11px] text-muted-foreground">{galleryUrls.length}/{MAX_GALLERY}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {galleryUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                          <img src={url} className="w-full h-full object-cover" />
                          <button onClick={() => removeGalleryPhoto(idx)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center active:opacity-70"><X className="h-3 w-3 text-white" /></button>
                        </div>
                      ))}
                      {galleryUrls.length < MAX_GALLERY && (
                        <button onClick={() => galleryInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 active:opacity-70">
                          {uploading === 'gallery' ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Plus className="h-6 w-6 text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DANE LOKALU ── */}
          {activeSection === 'profile' && (
            <div className="space-y-5">
              <div><h2 className="text-lg font-black">Dane lokalu</h2><p className="text-sm text-slate-400">Informacje kontaktowe, opis i tagi widoczne w wizytówce.</p></div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="business_name">Nazwa lokalu</Label>
                  <Input id="business_name" value={businessName} readOnly disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                  <p className="text-[11px] text-muted-foreground">Nazwa ustawiana przy rejestracji — skontaktuj się z nami, by ją zmienić.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="street">Ulica i numer <span className="text-red-500">*</span></Label>
                  <Input id="street" value={street} maxLength={100} onChange={e => { setStreet(e.target.value); setIsDirty(true); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="city">Miasto <span className="text-red-500">*</span></Label>
                    <Input id="city" value={city} maxLength={80} onChange={e => { setCity(e.target.value); setIsDirty(true); }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="postal_code">Kod pocztowy <span className="text-red-500">*</span></Label>
                    <Input id="postal_code" value={postalCode} maxLength={10} onChange={e => { setPostalCode(e.target.value); setIsDirty(true); }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">Telefon <span className="text-[11px] font-normal text-muted-foreground">(opcjonalnie)</span></Label>
                  <Input id="phone" value={phone} maxLength={20} onChange={e => { setPhone(e.target.value); setIsDirty(true); }} type="tel" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="flex items-center gap-1.5">Email <span className="text-[11px] font-normal text-muted-foreground">(opcjonalnie)</span></Label>
                  <Input id="email" value={email} maxLength={100} onChange={e => { setEmail(e.target.value); setIsDirty(true); }} type="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="website">Strona WWW</Label>
                  <Input id="website" value={website} maxLength={200} onChange={e => { setWebsite(e.target.value); setIsDirty(true); }} type="url" />
                </div>
                {/* Kategoria główna */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kategoria główna</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLACE_CATEGORIES).map(([key, cat]) => {
                      const active = mainCategory === key;
                      return (
                        <button key={key} type="button"
                          onClick={() => { setMainCategory(active ? "" : key); setBizSubcategories([]); setIsDirty(true); }}
                          className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'}`}>
                          <span className="text-base">{cat.icon}</span>
                          <span className="leading-tight text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Podkategoria */}
                {mainCategory && PLACE_CATEGORIES[mainCategory] && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Podkategoria</p>
                    <div className="flex flex-wrap gap-2">
                      {PLACE_CATEGORIES[mainCategory].subcats.map(sub => {
                        const active = bizSubcategories.includes(sub);
                        return (
                          <button key={sub} type="button"
                            onClick={() => { setBizSubcategories(prev => active ? prev.filter(s => s !== sub) : [...prev, sub]); setIsDirty(true); }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-background border-border text-muted-foreground hover:border-blue-300 hover:text-foreground'}`}>
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tagi wizytówki */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tagi wizytówki <span className="normal-case font-normal">(max 3, widoczne na karcie w aplikacji)</span></p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {VIBE_TAG_SUGGESTIONS.map(tag => {
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
                  </div>
                  {/* Custom tag input */}
                  <div className="flex gap-2">
                    <input
                      value={customVibeTag} maxLength={20}
                      onChange={e => setCustomVibeTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && customVibeTag.trim() && tags.length < 3) { setTags(prev => [...prev, customVibeTag.trim()]); setCustomVibeTag(""); setIsDirty(true); } }}
                      placeholder="Własny tag..."
                      disabled={tags.length >= 3}
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    />
                    <button type="button" disabled={!customVibeTag.trim() || tags.length >= 3}
                      onClick={() => { if (customVibeTag.trim() && tags.length < 3) { setTags(prev => [...prev, customVibeTag.trim()]); setCustomVibeTag(""); setIsDirty(true); } }}
                      className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-40">
                      Dodaj
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Opis</p>
                <div className="space-y-1">
                  <textarea rows={3} value={description} maxLength={500} onChange={e => { setDescription(e.target.value); setIsDirty(true); }} placeholder="Opisz swój lokal..." className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  <p className="text-[11px] text-muted-foreground text-right">{description.length}/500</p>
                </div>
              </div>
            </div>
          )}

          {/* ── AKTUALNOŚCI ── */}
          {activeSection === 'posts' && (
            <div className="space-y-5">
              <div><h2 className="text-lg font-black">Aktualności</h2><p className="text-sm text-slate-400">Wydarzenia i posty widoczne w Twojej wizytówce.</p></div>
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Form */}
                <div className="flex-1 space-y-5">
                  {/* Events */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Obecne wydarzenie</p>
                    <p className="text-xs text-muted-foreground -mt-2">Np. happy hour, promocja 1+1, koncert. Widoczne na wizytówce w aplikacji.</p>
                    <div className="space-y-1">
                      <Label htmlFor="event_title">Tytuł</Label>
                      <Input id="event_title" value={eventTitle} maxLength={80} onChange={e => { setEventTitle(e.target.value); setIsDirty(true); }} placeholder="np. Drinki 1+1 do 20:00" />
                      <p className="text-[11px] text-muted-foreground text-right">{eventTitle.length}/80</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="event_description">Opis</Label>
                      <textarea id="event_description" rows={2} value={eventDescription} maxLength={300} onChange={e => { setEventDescription(e.target.value); setIsDirty(true); }} placeholder="Szczegóły wydarzenia..." className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                      <p className="text-[11px] text-muted-foreground text-right">{eventDescription.length}/300</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label htmlFor="event_starts_at">Od</Label><Input id="event_starts_at" value={eventStartsAt} onChange={e => { setEventStartsAt(e.target.value); setIsDirty(true); }} type="date" /></div>
                      <div className="space-y-1"><Label htmlFor="event_ends_at">Do</Label><Input id="event_ends_at" value={eventEndsAt} onChange={e => { setEventEndsAt(e.target.value); setIsDirty(true); }} type="date" /></div>
                    </div>
                  </div>
                  {/* Posts */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Posty</p>
                    <p className="text-xs text-muted-foreground -mt-2">Aktualizacje, nowości, zdjęcia — widoczne dla odwiedzających w Twojej wizytówce.</p>
                    <div className="space-y-3 border border-border/60 rounded-2xl p-3">
                      <textarea rows={3} value={postDescription} maxLength={600} onChange={e => setPostDescription(e.target.value)} placeholder="Co nowego w Twoim lokalu?" className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                      <p className="text-[11px] text-muted-foreground text-right -mt-2">{postDescription.length}/600</p>
                      {postPhotos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {postPhotos.map((url, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden">
                              <img src={url} className="w-full h-full object-cover" />
                              <button onClick={() => setPostPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center"><X className="h-2.5 w-2.5 text-white" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => postPhotoInputRef.current?.click()} disabled={postPhotos.length >= 4} className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted active:opacity-60 disabled:opacity-40">
                          {postPhotoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                          Zdjęcia
                        </button>
                        <input ref={postPhotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePostPhotoUpload} />
                        <button onClick={handleAddPost} disabled={submittingPost || (!postDescription.trim() && postPhotos.length === 0)} className="ml-auto flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1.5 rounded-full font-semibold active:opacity-70 disabled:opacity-40">
                          {submittingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Opublikuj
                        </button>
                      </div>
                    </div>
                    {posts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Brak postów — dodaj pierwszy!</p>}
                    <div className="space-y-3">
                      {posts.map(post => (
                        <div key={post.id} className="border border-border/50 rounded-2xl p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            {post.description && <p className="text-sm leading-relaxed flex-1">{post.description}</p>}
                            <button onClick={() => handleDeletePost(post.id)} className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center active:opacity-60"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          </div>
                          {post.photo_urls.length > 0 && (
                            <div className={`grid gap-1.5 ${post.photo_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {post.photo_urls.map((url, idx) => <img key={idx} src={url} className="w-full rounded-2xl object-cover aspect-square" />)}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: pl })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Preview panel — right (desktop) / bottom (mobile/tablet) */}
                <div className="w-full lg:w-72 shrink-0">
                  <BusinessCardPreview
                    logoUrl={logoUrl} coverImageUrl={coverImageUrl}
                    businessName={businessName} city={city} street={street}
                    tags={tags} description={description}
                    eventTitle={eventTitle} eventDescription={eventDescription}
                    posts={posts}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── ANALITYKA ── */}
          {activeSection === 'analytics' && (
            <div className="space-y-5">
              {/* Header + range picker */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-black">Analityka</h2>
                  <p className="text-sm text-slate-400">
                    {analyticsRange === 'custom' && customDateRange?.from
                      ? `${format(customDateRange.from, 'd MMM', { locale: pl })}${customDateRange.to && customDateRange.to !== customDateRange.from ? ` — ${format(customDateRange.to, 'd MMM yyyy', { locale: pl })}` : ''}`
                      : 'Statystyki aktywności Twojego lokalu.'}
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
                        {r === '7d' ? '7 dni' : r === '30d' ? '30 dni' : '90 dni'}
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
                      Zakres
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
                          locale={pl}
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
                  <p className="font-bold text-base mt-3">Analityka dostępna w planie Premium</p>
                  <p className="text-sm text-slate-400 mt-1 mb-4">Odblokuj szczegółowe statystyki kliknięć, wyświetleń i aktywności.</p>
                  <button onClick={() => setShowUpgradeBanner(true)} className="px-5 py-2.5 rounded-2xl bg-amber-500 text-white text-sm font-bold">Dowiedz się więcej →</button>
                </div>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Wyświetlenia', value: stats.views, desc: 'otwarć profilu', icon: BarChart2, color: 'text-blue-500', bg: 'bg-blue-50' },
                      { label: 'Unikalni goście', value: stats.uniqueChoices, desc: 'dodało do trasy', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50' },
                      { label: 'Dodania do trasy', value: stats.onRoutes, desc: 'razy w planie', icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                      { label: 'Kliknięcia', value: stats.websiteClicks + stats.phoneClicks, desc: `WWW: ${stats.websiteClicks} · Tel: ${stats.phoneClicks}`, icon: MousePointerClick, color: 'text-violet-500', bg: 'bg-violet-50' },
                    ].map(({ label, value, desc, icon: Icon, color, bg }) => (
                      <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <p className="text-2xl font-black text-foreground leading-none mb-1">{analyticsLoading ? '—' : value}</p>
                        <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-400 leading-snug">{desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Daily activity chart */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aktywność w czasie</p>
                      <div className="flex items-center gap-3">
                        {[
                          { key: 'views', label: 'Wyświetlenia', color: '#3b82f6' },
                          { key: 'routes', label: 'Trasa', color: '#10b981' },
                          { key: 'clicks', label: 'Kliknięcia', color: '#8b5cf6' },
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
                        <p className="text-sm text-slate-400">Brak danych w wybranym okresie</p>
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
                              const map: Record<string, string> = { views: 'Wyświetlenia', routes: 'Dodania do trasy', clicks: 'Kliknięcia' };
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
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ruch według godziny</p>
                          {hasData && !analyticsLoading && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                              Szczyt: {peakHour.hour}:00–{peakHour.hour + 1}:00
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-300 mb-4">Łączna liczba zdarzeń w danej godzinie doby (czas lokalny)</p>
                        {analyticsLoading ? (
                          <div className="flex items-center justify-center h-36">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                          </div>
                        ) : !hasData ? (
                          <div className="flex flex-col items-center justify-center h-36 gap-2">
                            <BarChart2 className="h-8 w-8 text-slate-200" />
                            <p className="text-sm text-slate-400">Brak danych w wybranym okresie</p>
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
                                formatter={(val: number) => [val, 'Zdarzenia']}
                                labelFormatter={(label) => `Godzina ${label}`}
                              />
                              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                {hourlyData.map((entry) => {
                                  const ratio = entry.total / maxVal;
                                  const fill = ratio >= 0.85
                                    ? '#f97316'
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
                              { color: '#f97316', label: 'Szczyt ruchu' },
                              { color: '#93c5fd', label: 'Aktywność' },
                              { color: '#dbeafe', label: 'Niski ruch' },
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
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ostatnia aktywność</p>
                    {recentEvents.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">Brak aktywności w ostatnim czasie.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-slate-50">
                        {recentEvents.map((ev, i) => {
                          const labels: Record<string, { txt: string; dot: string }> = {
                            view: { txt: 'Wyświetlenie profilu', dot: 'bg-blue-400' },
                            add_to_route: { txt: 'Dodanie do planu', dot: 'bg-emerald-400' },
                            click_phone: { txt: 'Kliknięcie — telefon', dot: 'bg-violet-400' },
                            click_website: { txt: 'Kliknięcie — strona WWW', dot: 'bg-violet-400' },
                            click_booking: { txt: 'Kliknięcie — rezerwacja', dot: 'bg-amber-400' },
                          };
                          const info = labels[ev.event_type] ?? { txt: ev.event_type, dot: 'bg-slate-300' };
                          return (
                            <div key={i} className="flex items-center gap-3 py-3">
                              <div className={`h-2 w-2 rounded-full shrink-0 ${info.dot}`} />
                              <p className="text-sm text-slate-600 flex-1">{info.txt}</p>
                              <p className="text-xs text-slate-400 shrink-0">{formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: pl })}</p>
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

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe-6 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
          <button onClick={handleSave} disabled={saving || uploading !== null} className="w-full max-w-2xl mx-auto flex py-3.5 rounded-2xl bg-primary hover:bg-primary text-white font-semibold text-sm transition-colors disabled:opacity-50 items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;
