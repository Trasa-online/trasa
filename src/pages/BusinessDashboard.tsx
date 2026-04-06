import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, BarChart2, MapPin, MousePointerClick } from "lucide-react";

interface BusinessProfile {
  id: string;
  place_id: string;
  owner_user_id: string | null;
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  description: string | null;
  is_verified: boolean;
  is_premium: boolean;
  is_active: boolean;
  promo_title: string | null;
  promo_description: string | null;
  promo_code: string | null;
  promo_expires_at: string | null;
}

interface Stats {
  views: number;
  onRoutes: number;
  clicks: number;
}

const BusinessDashboard = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ views: 0, onRoutes: 0, clicks: 0 });
  const [saving, setSaving] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoExpiresAt, setPromoExpiresAt] = useState("");

  useEffect(() => {
    if (!user || !placeId) return;
    loadData();
  }, [user, placeId]);

  const loadData = async () => {
    if (!placeId || !user) return;
    setLoading(true);

    const { data: profileData } = await (supabase as any)
      .from("business_profiles")
      .select("*")
      .eq("place_id", placeId)
      .maybeSingle();

    if (!profileData) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roleData;

    if (profileData.owner_user_id !== user.id && !isAdmin) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setProfile(profileData as BusinessProfile);
    setBusinessName(profileData.business_name ?? "");
    setPhone(profileData.phone ?? "");
    setEmail(profileData.email ?? "");
    setWebsite(profileData.website ?? "");
    setBookingUrl(profileData.booking_url ?? "");
    setDescription(profileData.description ?? "");
    setLogoUrl(profileData.logo_url ?? "");
    setCoverImageUrl(profileData.cover_image_url ?? "");
    setPromoTitle(profileData.promo_title ?? "");
    setPromoDescription(profileData.promo_description ?? "");
    setPromoCode(profileData.promo_code ?? "");
    setPromoExpiresAt(profileData.promo_expires_at ?? "");

    // Load stats for last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: eventsData } = await (supabase as any)
      .from("place_events")
      .select("event_type")
      .eq("place_id", placeId)
      .gte("created_at", since.toISOString());

    if (eventsData) {
      const events = eventsData as Array<{ event_type: string }>;
      const views = events.filter((e) => e.event_type === "view").length;
      const onRoutes = events.filter((e) => e.event_type === "add_to_route").length;
      const clicks = events.filter((e) =>
        ["click_phone", "click_website", "click_booking"].includes(e.event_type)
      ).length;
      setStats({ views, onRoutes, clicks });
    }

    setLoading(false);
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
        promo_title: promoTitle || null,
        promo_description: promoDescription || null,
        promo_code: promoCode || null,
        promo_expires_at: promoExpiresAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq("place_id", placeId);

    if (error) {
      toast.error("Nie udało się zapisać zmian");
    } else {
      toast.success("Zmiany zapisane!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessDenied || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Panel biznesu" showBack />
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="text-lg font-semibold mb-2">Brak dostępu</p>
          <p className="text-sm text-muted-foreground">
            Nie masz uprawnień do zarządzania tą wizytówką.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
      <PageHeader title="Panel biznesu" showBack />

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border/40 rounded-2xl p-3 text-center">
            <BarChart2 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.views}</p>
            <p className="text-xs font-medium text-foreground">Wyświetlenia</p>
            <p className="text-[10px] text-muted-foreground">ostatnie 30 dni</p>
          </div>
          <div className="bg-card border border-border/40 rounded-2xl p-3 text-center">
            <MapPin className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.onRoutes}</p>
            <p className="text-xs font-medium text-foreground">Na trasach</p>
            <p className="text-[10px] text-muted-foreground">ostatnie 30 dni</p>
          </div>
          <div className="bg-card border border-border/40 rounded-2xl p-3 text-center">
            <MousePointerClick className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.clicks}</p>
            <p className="text-xs font-medium text-foreground">Kliknięcia</p>
            <p className="text-[10px] text-muted-foreground">ostatnie 30 dni</p>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dane kontaktowe
          </p>

          <div className="space-y-1">
            <Label htmlFor="business_name">Nazwa firmy</Label>
            <Input
              id="business_name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="website">Strona WWW</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              type="url"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking_url">URL rezerwacji</Label>
            <Input
              id="booking_url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              type="url"
            />
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
            Treść wizytówki
          </p>

          <div className="space-y-1">
            <Label htmlFor="description">Opis</Label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="logo_url">URL logo</Label>
            <Input
              id="logo_url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              type="url"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cover_image_url">URL zdjęcia okładkowego</Label>
            <Input
              id="cover_image_url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              type="url"
            />
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
            Promocja
          </p>

          <div className="space-y-1">
            <Label htmlFor="promo_title">Tytuł promocji</Label>
            <Input
              id="promo_title"
              value={promoTitle}
              onChange={(e) => setPromoTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="promo_description">Opis promocji</Label>
            <Input
              id="promo_description"
              value={promoDescription}
              onChange={(e) => setPromoDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="promo_code">Kod</Label>
            <Input
              id="promo_code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="promo_expires_at">Data ważności</Label>
            <Input
              id="promo_expires_at"
              value={promoExpiresAt}
              onChange={(e) => setPromoExpiresAt(e.target.value)}
              type="date"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz zmiany
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessDashboard;
