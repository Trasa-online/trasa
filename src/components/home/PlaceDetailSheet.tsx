import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPhotoUrl, isCachedPhotoUrl, ensurePhotoCached, getCachedPhotoVariant } from "@/lib/placePhotos";
import { fetchPlaceUserPhotos } from "@/lib/placeUserPhotos";
import { GOOGLE_PLACE_DETAILS_DISABLED } from "@/lib/appMode";
import BusinessActionButtons from "@/components/business/BusinessActionButtons";
import posthog from "posthog-js";

interface Pin {
  id: string;
  place_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  suggested_time?: string | null;
  place_id?: string | null;
  photo_url?: string | null;
}

interface PlaceDetailSheetProps {
  pin: Pin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BusinessProfile {
  id: string;
  place_id: string;
  owner_user_id: string | null;
  business_name: string;
  is_active: boolean;
  logo_url: string | null;
  gallery_urls: string[];
  phone: string | null;
  website: string | null;
  event_title: string | null;
  event_description: string | null;
  event_starts_at: string | null;
  event_ends_at: string | null;
}

const PlaceDetailSheet = ({ pin, open, onOpenChange }: PlaceDetailSheetProps) => {
  const { t } = useTranslation("homeprofile");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [cachedPhotoUrl, setCachedPhotoUrl] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  // Claim form state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    if (!open) return;

    setBusinessProfile(null);
    setShowClaimForm(false);

    // Track view event via PostHog
    if (pin.place_id) {
      posthog.capture("place_viewed", { place_id: pin.place_id });

      // Load business profile
      (supabase as any)
        .from("business_profiles_public")
        .select("id, place_id, owner_user_id, business_name, is_active, logo_url, gallery_urls, phone, website, event_title, event_description, event_starts_at, event_ends_at")
        .eq("place_id", pin.place_id)
        .maybeSingle()
        .then(({ data }: { data: BusinessProfile | null }) => {
          if (data) setBusinessProfile(data);
        });
    }

    if (!pin.latitude || !pin.longitude) return;
    setLoading(true);
    setDetails(null);

    // Happy path: pin.photo_url już scache'owane → użyj 800px wariantu od razu
    const alreadyCached = isCachedPhotoUrl(pin.photo_url);
    if (alreadyCached) {
      setCachedPhotoUrl(getCachedPhotoVariant(pin.photo_url, "large"));
    } else {
      setCachedPhotoUrl(null);
    }

    // ZERO Google (2026-07-30): NIE wolamy Place Details ani cache-place-photo (oba bija
    // Google Places API). Zdjecie wizytowki = TYLKO zdjecie usera z tras (pins.images /
    // user_photo_urls). Brak -> brak zdjecia (fallback ikony obsluguje widok listy). Ignorujemy
    // pin.photo_url gdy to cache Google (alreadyCached) - nie pokazujemy zdjec Google.
    if (GOOGLE_PLACE_DETAILS_DISABLED) {
      setCachedPhotoUrl(null);
      fetchPlaceUserPhotos({
        placeDbId: null,
        googlePlaceId: pin.place_id ?? null,
        placeName: pin.place_name,
        city: (pin as { city?: string }).city ?? null,
      })
        .then((urls) => { if (urls[0]) setCachedPhotoUrl(urls[0]); })
        .catch(() => {});
      setLoading(false);
      return;
    }

    supabase.functions.invoke("google-places-proxy", {
      body: { placeName: pin.place_name, latitude: pin.latitude, longitude: pin.longitude },
    }).then(async ({ data, error }) => {
      if (!error && data?.result) {
        setDetails(data.result);
        // Nie nadpisuj jeśli mamy już cache'owany URL
        if (!alreadyCached) {
          const ref = data.result.photos?.[0]?.photo_reference;
          if (ref) {
            const url = getPhotoUrl(ref, 600);
            if (url) setCachedPhotoUrl(url);
          }
          // Background: trigger cache na przyszłość (pin.id z DB)
          ensurePhotoCached(
            {
              table: "pins",
              id: pin.id,
              place_name: pin.place_name,
              latitude: pin.latitude,
              longitude: pin.longitude,
              place_id: pin.place_id ?? data.result.place_id,
            },
            pin.photo_url ?? null,
          ).catch(() => {});
        }
      }
      setLoading(false);
    });
  }, [open, pin.id]);

  const handleSubmitClaim = async () => {
    if (!pin.place_id || !user || !claimEmail) return;
    setSubmittingClaim(true);
    const { error } = await (supabase as any).from("business_claims").insert({
      place_id: pin.place_id,
      user_id: user.id,
      contact_email: claimEmail,
      contact_phone: claimPhone || null,
      message: claimMessage || null,
    });
    if (error) {
      setSubmittingClaim(false);
      return;
    }
    setShowClaimForm(false);
    setClaimEmail("");
    setClaimPhone("");
    setClaimMessage("");
    setSubmittingClaim(false);
  };

  const mapsUrl = pin.latitude && pin.longitude
    ? `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(pin.place_name)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl overflow-y-auto" style={{ maxHeight: "85vh" }}>
        <SheetHeader className="pb-3">
          <SheetTitle className="text-left">{pin.place_name}</SheetTitle>
          {pin.address && (
            <p className="text-sm text-muted-foreground text-left leading-snug">{pin.address}</p>
          )}
          {pin.suggested_time && (
            <p className="text-xs text-muted-foreground text-left">{pin.suggested_time}</p>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && details && (
          <div className="space-y-5 pb-6">
            {/* Main photo */}
            {cachedPhotoUrl && (
              <div className="-mx-6 px-6 pb-1">
                <img
                  src={cachedPhotoUrl}
                  alt={pin.place_name}
                  className="h-48 w-full object-cover rounded-2xl"
                />
              </div>
            )}

            {/* Godziny otwarcia + recenzje Google USUNIETE (2026-07-29): nie pokazujemy danych
                Place Details od Google w apce. User idzie po godziny/opinie do Google Maps
                (link ponizej). Godziny firm B2B maja wlasna wizytowke (BusinessDashboard). */}

            {/* Map link */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{t("place.open_maps")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}

        {/* Tryb ZERO Google (details = null): zdjecie usera z tras jako cover (bez Google). */}
        {!loading && !details && (
          <div className="pb-6 space-y-3">
            {cachedPhotoUrl && (
              <div className="-mx-6 px-6 pb-1">
                <img src={cachedPhotoUrl} alt={pin.place_name} className="h-48 w-full object-cover rounded-2xl" />
              </div>
            )}
            {pin.latitude && pin.longitude && !cachedPhotoUrl && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("place.details_error")}
              </p>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{t("place.search_maps")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}

        {/* Business owner section */}
        {businessProfile?.is_active && (() => {
          const hasEvent = businessProfile.event_title && businessProfile.event_ends_at
            ? new Date(businessProfile.event_ends_at) >= new Date()
            : !!businessProfile.event_title;
          const hasGallery = (businessProfile.gallery_urls ?? []).length > 0;
          if (!hasEvent && !hasGallery && !businessProfile.logo_url) return null;

          return (
            <div className="mt-4 mb-2 space-y-3">
              {/* Owner header */}
              <div className="flex items-center gap-2.5 px-1">
                {businessProfile.logo_url ? (
                  <img src={businessProfile.logo_url} className="w-7 h-7 rounded-full object-cover border border-border/40" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs">⭐</span>
                  </div>
                )}
                <p className="text-xs font-semibold text-foreground">{businessProfile.business_name}</p>
                <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t("place.verified")}</span>
              </div>

              {/* Current event */}
              {hasEvent && (
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50 p-3 space-y-1">
                  <p className="text-xs font-bold text-amber-800">🎉 {businessProfile.event_title}</p>
                  {businessProfile.event_description && (
                    <p className="text-xs text-amber-700 leading-relaxed">{businessProfile.event_description}</p>
                  )}
                  {businessProfile.event_starts_at && businessProfile.event_ends_at && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      {new Date(businessProfile.event_starts_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(businessProfile.event_ends_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              )}

              {/* Gallery */}
              {hasGallery && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {(businessProfile.gallery_urls ?? []).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="h-24 w-24 flex-shrink-0 rounded-2xl object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Contact buttons */}
              <BusinessActionButtons
                phone={businessProfile.phone}
                website={businessProfile.website}
                placeId={pin.place_id}
                userId={user?.id}
              />
            </div>
          );
        })()}

        {/* Manage / Claim section */}
        {pin.place_id && user && (
          <div className="px-4 pb-4 mt-2">
            {businessProfile?.owner_user_id === user.id ? (
              <button
                onClick={() => navigate(`/biznes/${pin.place_id}`)}
                className="w-full text-sm text-center text-orange-600 font-semibold py-2.5 rounded-2xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                {t("place.manage_listing")}
              </button>
            ) : (
              !showClaimForm ? (
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="w-full text-xs text-center text-muted-foreground py-2 hover:text-foreground transition-colors"
                >
                  {t("place.claim_prompt")}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{t("place.claim_title")}</p>
                  <input
                    type="email"
                    placeholder={t("place.email_placeholder")}
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full text-sm rounded-2xl border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="tel"
                    placeholder={t("place.phone_placeholder")}
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    className="w-full text-sm rounded-2xl border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <textarea
                    placeholder={t("place.message_placeholder")}
                    rows={2}
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    className="w-full text-sm rounded-2xl border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowClaimForm(false)}
                      className="flex-1 text-sm py-2 rounded-2xl border border-border text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {t("place.cancel")}
                    </button>
                    <button
                      onClick={handleSubmitClaim}
                      disabled={submittingClaim || !claimEmail}
                      className="flex-1 text-sm py-2 rounded-2xl bg-primary hover:bg-primary text-white font-semibold transition-colors disabled:opacity-50"
                    >
                      {submittingClaim ? t("place.sending") : t("place.submit_claim")}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default PlaceDetailSheet;
