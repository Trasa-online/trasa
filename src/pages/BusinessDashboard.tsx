import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, BarChart2, MapPin, MousePointerClick, Plus, X, LogOut, ImagePlus, Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface BusinessPost {
  id: string;
  place_id: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
}

const PLACE_TAGS = [
  "Restauracja", "Kawiarnia", "Bar", "Klub nocny", "Muzeum", "Galeria",
  "Hotel", "Sklep", "Park", "Kościół", "Punkt widokowy", "Atrakcja turystyczna", "Inne",
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
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  description: string | null;
  address: string | null;
  tags: string[] | null;
  is_verified: boolean;
  event_title: string | null;
  event_description: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
}

interface Stats { views: number; onRoutes: number; clicks: number; }

const MAX_GALLERY = 10;

const BusinessDashboard = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [placeCategory, setPlaceCategory] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ views: 0, onRoutes: 0, clicks: 0 });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [address, setAddress] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");

  const [plan, setPlan] = useState<BizPlan>('zero');
  const [previewTab, setPreviewTab] = useState<'basic' | 'premium'>('basic');
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const [uploading, setUploading] = useState<string | null>(null); // which slot is uploading
  const [isDirty, setIsDirty] = useState(false);

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

    const { data: profileData } = await (supabase as any)
      .from("business_profiles").select("*").eq("place_id", placeId).maybeSingle();

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
    setPlan((profileData.plan ?? 'zero') as BizPlan);
    setBusinessName(profileData.business_name ?? "");
    setPhone(profileData.phone ?? "");
    setEmail(profileData.email ?? "");
    setWebsite(profileData.website ?? "");
    setBookingUrl(profileData.booking_url ?? "");
    setAddress(profileData.address ?? "");
    setTags(profileData.tags ?? []);
    setDescription(profileData.description ?? "");
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setGalleryUrls(profileData.gallery_urls ?? []);
    setEventTitle(profileData.event_title ?? "");
    setEventDescription(profileData.event_description ?? "");
    setEventStartsAt(profileData.event_starts_at ?? "");
    setEventEndsAt(profileData.event_ends_at ?? "");
    setIsDirty(false);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: eventsData } = await (supabase as any)
      .from("place_events").select("event_type").eq("place_id", placeId).gte("created_at", since.toISOString());
    if (eventsData) {
      const events = eventsData as Array<{ event_type: string }>;
      setStats({
        views: events.filter(e => e.event_type === "view").length,
        onRoutes: events.filter(e => e.event_type === "add_to_route").length,
        clicks: events.filter(e => ["click_phone", "click_website", "click_booking"].includes(e.event_type)).length,
      });
    }

    // Fetch posts
    const { data: postsData } = await (supabase as any)
      .from("business_posts").select("*").eq("place_id", placeId).order("created_at", { ascending: false });
    if (postsData) setPosts(postsData as BusinessPost[]);

    setLoading(false);
  };

  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!ALLOWED_MIME.includes(file.type)) throw new Error("Niedozwolony format pliku (dozwolone: JPG, PNG, WEBP)");
    if (file.size > MAX_FILE_SIZE) throw new Error("Plik jest za duży (max 5 MB)");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${placeId}/${folder}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("business-photos").upload(path, file, { upsert: true });
    if (error) throw error;
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
    } catch { toast.error("Nie udało się przesłać logo"); }
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
    } catch { toast.error("Nie udało się przesłać zdjęcia okładkowego"); }
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
    } catch { toast.error("Nie udało się przesłać zdjęć"); }
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
    if (!placeId) return;
    if (eventStartsAt && eventEndsAt && eventEndsAt < eventStartsAt) {
      toast.error("Data końca wydarzenia nie może być wcześniejsza niż data początku");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("business_profiles")
      .update({
        business_name: businessName,
        phone: phone || null,
        email: email || null,
        website: website || null,
        booking_url: bookingUrl || null,
        address: address || null,
        tags: tags.length > 0 ? tags : null,
        description: description || null,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        gallery_urls: galleryUrls,
        event_title: eventTitle || null,
        event_description: eventDescription || null,
        event_starts_at: eventStartsAt || null,
        event_ends_at: eventEndsAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq("place_id", placeId);
    if (error) toast.error("Nie udało się zapisać zmian");
    else { toast.success("Zmiany zapisane!"); setIsDirty(false); }
    setSaving(false);
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
    window.location.replace("/auth");
  };

  const sendTestEvent = async () => {
    if (!placeId) return;
    const { error } = await (supabase as any).from("place_events").insert({
      place_id: placeId,
      event_type: "view",
      user_id: user?.id ?? null,
    });
    if (error) toast.error("Błąd: " + error.message);
    else { toast.success("Testowe zdarzenie wysłane!"); await loadData(); }
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
    <div className="min-h-screen bg-background pb-12">
      {/* Header — no back button, just title + logout */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center">
        <div
          className="w-7 h-7 rounded-full mr-3 flex-shrink-0"
          style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight truncate">{profile.business_name}</p>
          <p className="text-[11px] text-muted-foreground">Panel biznesowy</p>
        </div>
        <span className={`mr-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}>
          {PLAN_LABELS[plan]}
        </span>
        {profile.is_verified && (
          <span className="mr-3 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            ✓ Zweryfikowany
          </span>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted active:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          Wyloguj
        </button>
      </div>

      <div className={`p-4 space-y-4 max-w-2xl mx-auto ${isDirty ? "pb-28" : "pb-4"}`}>
        {/* Stats — premium only */}
        {plan === 'premium' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: BarChart2, value: stats.views, label: "Wyświetlenia" },
                { icon: MapPin, value: stats.onRoutes, label: "Na trasach" },
                { icon: MousePointerClick, value: stats.clicks, label: "Kliknięcia" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="bg-card border border-border/40 rounded-2xl p-3 text-center">
                  <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">ostatnie 30 dni</p>
                </div>
              ))}
            </div>
            <button onClick={sendTestEvent} className="text-[11px] text-muted-foreground underline underline-offset-2 text-center w-full">
              Wyślij testowe zdarzenie
            </button>
          </>
        ) : (
          <div className="relative rounded-2xl border border-dashed border-border/60 p-4 overflow-hidden">
            <div className="grid grid-cols-3 gap-3 opacity-30 pointer-events-none select-none">
              {[
                { icon: BarChart2, label: "Wyświetlenia" },
                { icon: MapPin, label: "Na trasach" },
                { icon: MousePointerClick, label: "Kliknięcia" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-card border border-border/40 rounded-2xl p-3 text-center">
                  <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xl font-bold">—</p>
                  <p className="text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <span className="text-lg">🔒</span>
              <p className="text-xs font-semibold">Analityka dostępna w planie Premium</p>
            </div>
          </div>
        )}

        {/* Swipe card preview — tabs Basic / Premium */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Podgląd wizytówki</p>

          {/* Tabs */}
          <div className="flex rounded-xl bg-muted p-0.5 gap-0.5">
            {(['basic', 'premium'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'premium' && plan === 'basic') {
                    setShowUpgradeBanner(true);
                  }
                  setPreviewTab(tab);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  previewTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === 'basic' ? '✦ Basic' : '★ Premium'}
                {tab === 'premium' && plan !== 'premium' && (
                  <span className="ml-1 text-[9px] font-bold bg-amber-400 text-amber-900 px-1 py-0.5 rounded-full">PRO</span>
                )}
              </button>
            ))}
          </div>

          {/* Card preview */}
          <div className="relative w-full" style={{ aspectRatio: "3/4", maxHeight: 340 }}>
            <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg">
              {/* Background */}
              {coverImageUrl ? (
                <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-800 to-orange-600" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
                {previewTab === 'premium' && logoUrl && (
                  <img src={logoUrl} className="w-8 h-8 rounded-full object-cover border-2 border-white/30 mb-1" />
                )}
                <p className="text-white font-black text-xl leading-tight">{businessName || "Nazwa lokalu"}</p>
                <p className="text-white/70 text-sm">{[placeCategory, "@trasa"].filter(Boolean).join(" · ")}</p>
                {previewTab === 'premium' && description && (
                  <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{description}</p>
                )}
                {previewTab === 'premium' && eventTitle && (
                  <div className="inline-flex items-center gap-1 bg-amber-500/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-semibold">
                    🎉 {eventTitle}
                  </div>
                )}
              </div>

              {/* Basic label */}
              {previewTab === 'basic' && (
                <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ✦ Basic
                </div>
              )}
              {previewTab === 'premium' && (
                <div className="absolute top-3 left-3 bg-amber-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ★ Premium
                </div>
              )}

              {/* Premium locked overlay */}
              {previewTab === 'premium' && plan !== 'premium' && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">🔒</span>
                  <p className="text-white font-bold text-sm text-center px-6">Plan Premium</p>
                  <p className="text-white/70 text-xs text-center px-8 leading-relaxed">Logo, galeria, opisy, wydarzenia i analityka</p>
                  <button
                    onClick={() => setShowUpgradeBanner(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold active:opacity-80"
                  >
                    Dowiedz się więcej →
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            {previewTab === 'basic'
              ? "Basic: zdjęcie główne + dane kontaktowe"
              : "Premium: logo, galeria, wydarzenia, posty, analityka"}
          </p>
        </div>

        {/* Upgrade banner */}
        {showUpgradeBanner && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm">★ Przejdź na Premium</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Odblokuj logo, galerię do 10 zdjęć, wydarzenia, posty i pełną analitykę.
                </p>
              </div>
              <button onClick={() => setShowUpgradeBanner(false)} className="text-muted-foreground mt-0.5 active:opacity-60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <a
              href="mailto:kontakt@trasa.app?subject=Upgrade do Premium"
              className="flex items-center justify-center w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm active:opacity-80"
            >
              Napisz do nas → kontakt@trasa.app
            </a>
          </div>
        )}

        {/* Photos — gated by plan */}
        {plan === 'zero' ? null : (
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zdjęcia</p>

          {/* Cover (basic + premium) */}
          <div className={plan === 'premium' ? "grid grid-cols-2 gap-3" : ""}>
            {/* Logo — premium only */}
            {plan === 'premium' && (
              <div>
                <p className="text-xs font-medium mb-1.5">Logo</p>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="relative w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 active:opacity-70"
                >
                  {uploading === "logo" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : logoUrl ? (
                    <>
                      <img src={logoUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <ImagePlus className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Plus className="h-6 w-6" />
                      <span className="text-[11px]">Dodaj logo</span>
                    </div>
                  )}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            )}

            {/* Cover */}
            <div>
              <p className="text-xs font-medium mb-1.5">Zdjęcie główne</p>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="relative w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 active:opacity-70"
              >
                {uploading === "cover" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : coverImageUrl ? (
                  <>
                    <img src={coverImageUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <ImagePlus className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Plus className="h-6 w-6" />
                    <span className="text-[11px]">Dodaj zdjęcie</span>
                  </div>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>
          </div>

          {/* Gallery — premium only */}
          {plan === 'premium' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium">Galeria dodatkowa</p>
                <p className="text-[11px] text-muted-foreground">{galleryUrls.length}/{MAX_GALLERY}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {galleryUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={url} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeGalleryPhoto(idx)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center active:opacity-70"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                {galleryUrls.length < MAX_GALLERY && (
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 active:opacity-70"
                  >
                    {uploading === "gallery" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
            </div>
          )}
        </div>
        )}

        {/* Contact */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dane lokalu</p>
          <div className="space-y-1">
            <Label htmlFor="business_name">Nazwa</Label>
            <Input id="business_name" value={businessName} maxLength={80} onChange={e => { setBusinessName(e.target.value); setIsDirty(true); }} />
            <p className="text-[11px] text-muted-foreground text-right">{businessName.length}/80</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Adres</Label>
            <Input id="address" value={address} maxLength={150} placeholder="np. ul. Floriańska 12, Kraków" onChange={e => { setAddress(e.target.value); setIsDirty(true); }} />
          </div>

          {/* Below fields: basic + premium only */}
          {plan !== 'zero' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={phone} maxLength={20} onChange={e => { setPhone(e.target.value); setIsDirty(true); }} type="tel" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} maxLength={100} onChange={e => { setEmail(e.target.value); setIsDirty(true); }} type="email" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">Strona WWW</Label>
                <Input id="website" value={website} maxLength={200} onChange={e => { setWebsite(e.target.value); setIsDirty(true); }} type="url" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="booking_url">URL rezerwacji</Label>
                <Input id="booking_url" value={bookingUrl} maxLength={200} onChange={e => { setBookingUrl(e.target.value); setIsDirty(true); }} type="url" />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Typ miejsca</p>
              <div className="flex flex-wrap gap-2">
                {PLACE_TAGS.map(tag => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { setTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag]); setIsDirty(true); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? "bg-orange-600 border-orange-600 text-white"
                          : "bg-background border-border text-muted-foreground hover:border-orange-400 hover:text-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {plan === 'premium' && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Opis</p>
                  <div className="space-y-1">
                    <textarea
                      rows={3}
                      value={description}
                      maxLength={500}
                      onChange={e => { setDescription(e.target.value); setIsDirty(true); }}
                      placeholder="Opisz swój lokal..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground text-right">{description.length}/500</p>
                  </div>
                </>
              )}
            </>
          )}

          {plan === 'zero' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
              Przejdź na plan Basic, aby dodać dane kontaktowe i typ miejsca.
            </p>
          )}
        </div>

        {/* Events — premium only */}
        {plan !== 'premium' ? (
          <div className="relative rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-1.5">
            <span className="text-xl">🎉</span>
            <p className="text-xs font-semibold">Wydarzenia i promocje — plan Premium</p>
            <p className="text-[11px] text-muted-foreground">Happy hour, koncerty, oferty specjalne widoczne w swiperze.</p>
          </div>
        ) : (
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obecne wydarzenia</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Np. happy hour, promocja 1+1, koncert. Widoczne na wizytówce w aplikacji.
          </p>
          <div className="space-y-1">
            <Label htmlFor="event_title">Tytuł</Label>
            <Input
              id="event_title"
              value={eventTitle}
              maxLength={80}
              onChange={e => { setEventTitle(e.target.value); setIsDirty(true); }}
              placeholder="np. Drinki 1+1 do 20:00"
            />
            <p className="text-[11px] text-muted-foreground text-right">{eventTitle.length}/80</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="event_description">Opis</Label>
            <textarea
              id="event_description"
              rows={2}
              value={eventDescription}
              maxLength={300}
              onChange={e => { setEventDescription(e.target.value); setIsDirty(true); }}
              placeholder="Szczegóły wydarzenia..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">{eventDescription.length}/300</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="event_starts_at">Od</Label>
              <Input id="event_starts_at" value={eventStartsAt} onChange={e => { setEventStartsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_ends_at">Do</Label>
              <Input id="event_ends_at" value={eventEndsAt} onChange={e => { setEventEndsAt(e.target.value); setIsDirty(true); }} type="date" className="w-full" />
            </div>
          </div>
        </div>
        )}

        {/* Posts / Feed — premium only */}
        {plan !== 'premium' ? (
          <div className="relative rounded-2xl border border-dashed border-border/60 p-4 text-center space-y-1.5">
            <span className="text-xl">📸</span>
            <p className="text-xs font-semibold">Posty i feed — plan Premium</p>
            <p className="text-[11px] text-muted-foreground">Publikuj aktualizacje, nowości i zdjęcia widoczne w Twojej wizytówce.</p>
          </div>
        ) : (
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Posty</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Aktualizacje, nowości, zdjęcia — widoczne dla odwiedzających w Twojej wizytówce.
          </p>

          {/* New post form */}
          <div className="space-y-3 border border-border/60 rounded-xl p-3">
            <textarea
              rows={3}
              value={postDescription}
              maxLength={600}
              onChange={e => setPostDescription(e.target.value)}
              placeholder="Co nowego w Twoim lokalu?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right -mt-2">{postDescription.length}/600</p>

            {/* Post photo previews */}
            {postPhotos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {postPhotos.map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden">
                    <img src={url} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPostPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => postPhotoInputRef.current?.click()}
                disabled={postPhotos.length >= 4}
                className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted active:opacity-60 disabled:opacity-40"
              >
                {postPhotoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Zdjęcia
              </button>
              <input
                ref={postPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePostPhotoUpload}
              />
              <button
                onClick={handleAddPost}
                disabled={submittingPost || (!postDescription.trim() && postPhotos.length === 0)}
                className="ml-auto flex items-center gap-1.5 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold active:opacity-70 disabled:opacity-40"
              >
                {submittingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Opublikuj
              </button>
            </div>
          </div>

          {/* Posts feed */}
          {posts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Brak postów — dodaj pierwszy!</p>
          )}
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="border border-border/50 rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  {post.description && (
                    <p className="text-sm leading-relaxed flex-1">{post.description}</p>
                  )}
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center active:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                {post.photo_urls.length > 0 && (
                  <div className={`grid gap-1.5 ${post.photo_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {post.photo_urls.map((url, idx) => (
                      <img key={idx} src={url} className="w-full rounded-lg object-cover aspect-square" />
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: pl })}
                </p>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Sticky save bar — only when dirty */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-safe-6 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
          <button
            onClick={handleSave}
            disabled={saving || uploading !== null}
            className="w-full max-w-2xl mx-auto flex py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;
