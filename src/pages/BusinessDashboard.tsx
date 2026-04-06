import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, BarChart2, MapPin, MousePointerClick, Plus, X, LogOut, ImagePlus } from "lucide-react";

interface BusinessProfile {
  id: string;
  place_id: string;
  owner_user_id: string | null;
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  description: string | null;
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
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");

  const [uploading, setUploading] = useState<string | null>(null); // which slot is uploading

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !placeId) return;
    loadData();
  }, [user, placeId]);

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
    setBusinessName(profileData.business_name ?? "");
    setPhone(profileData.phone ?? "");
    setEmail(profileData.email ?? "");
    setWebsite(profileData.website ?? "");
    setBookingUrl(profileData.booking_url ?? "");
    setDescription(profileData.description ?? "");
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setGalleryUrls(profileData.gallery_urls ?? []);
    setEventTitle(profileData.event_title ?? "");
    setEventDescription(profileData.event_description ?? "");
    setEventStartsAt(profileData.event_starts_at ?? "");
    setEventEndsAt(profileData.event_ends_at ?? "");

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
    setLoading(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
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
    } catch { toast.error("Nie udało się przesłać zdjęć"); }
    setUploading(null);
    e.target.value = "";
  };

  const removeGalleryPhoto = (idx: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!placeId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("business_profiles")
      .update({
        business_name: businessName,
        phone: phone || null,
        email: email || null,
        website: website || null,
        booking_url: bookingUrl || null,
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
    else toast.success("Zmiany zapisane!");
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
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
        {profile.is_verified && (
          <span className="mr-3 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Zweryfikowany
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

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Stats */}
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

        {/* Swipe card preview */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Podgląd wizytówki</p>
            <button
              onClick={() => setShowPreview(v => !v)}
              className="text-xs text-orange-600 font-semibold active:opacity-60"
            >
              {showPreview ? "Ukryj" : "Pokaż"}
            </button>
          </div>
          {showPreview && (
            <div className="relative w-full" style={{ aspectRatio: "3/4", maxHeight: 360 }}>
              <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg">
                {/* Background */}
                {coverImageUrl ? (
                  <img src={coverImageUrl} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-800 to-orange-600" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Business badge */}
                {(eventTitle || logoUrl) && (
                  <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ✦ Wizytówka
                  </div>
                )}

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
                  {logoUrl && (
                    <img src={logoUrl} className="w-8 h-8 rounded-full object-cover border-2 border-white/30 mb-1" />
                  )}
                  <p className="text-white font-black text-xl leading-tight">{businessName || "Nazwa lokalu"}</p>
                  <p className="text-white/70 text-sm">
                    {[placeCategory, "@trasa"].filter(Boolean).join(" · ")}
                  </p>
                  {description && (
                    <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{description}</p>
                  )}
                  {eventTitle && (
                    <div className="inline-flex items-center gap-1 bg-amber-500/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-semibold">
                      🎉 {eventTitle}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {!showPreview && (
            <p className="text-xs text-muted-foreground">Kliknij "Pokaż" aby zobaczyć jak wygląda Twoja wizytówka w swiperze.</p>
          )}
        </div>

        {/* Photos */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zdjęcia</p>

          {/* Logo + Cover row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Logo */}
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

            {/* Cover */}
            <div>
              <p className="text-xs font-medium mb-1.5">Okładka</p>
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
                    <span className="text-[11px]">Dodaj okładkę</span>
                  </div>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>
          </div>

          {/* Gallery */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium">Galeria</p>
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
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
            />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dane kontaktowe</p>
          <div className="space-y-1">
            <Label htmlFor="business_name">Nazwa firmy</Label>
            <Input id="business_name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="website">Strona WWW</Label>
            <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} type="url" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking_url">URL rezerwacji</Label>
            <Input id="booking_url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} type="url" />
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Opis</p>
          <div className="space-y-1">
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opisz swój lokal..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Events */}
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
              onChange={e => setEventTitle(e.target.value)}
              placeholder="np. Drinki 1+1 do 20:00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event_description">Opis</Label>
            <textarea
              id="event_description"
              rows={2}
              value={eventDescription}
              onChange={e => setEventDescription(e.target.value)}
              placeholder="Szczegóły wydarzenia..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="event_starts_at">Od</Label>
              <Input id="event_starts_at" value={eventStartsAt} onChange={e => setEventStartsAt(e.target.value)} type="date" className="w-full" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_ends_at">Do</Label>
              <Input id="event_ends_at" value={eventEndsAt} onChange={e => setEventEndsAt(e.target.value)} type="date" className="w-full" />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading !== null}
          className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Zapisz zmiany
        </button>
      </div>
    </div>
  );
};

export default BusinessDashboard;
