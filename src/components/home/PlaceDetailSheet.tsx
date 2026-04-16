import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Star, MapPin, ExternalLink, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPhotoUrl } from "@/lib/placePhotos";
import BusinessActionButtons from "@/components/business/BusinessActionButtons";

interface Pin {
  id: string;
  place_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  suggested_time?: string | null;
  place_id?: string | null;
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

    // Track view event
    if (pin.place_id) {
      (supabase as any).from("place_events").insert({
        place_id: pin.place_id,
        event_type: "view",
        user_id: user?.id ?? null,
      });

      // Load business profile
      (supabase as any)
        .from("business_profiles")
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
    setCachedPhotoUrl(null);
    supabase.functions.invoke("google-places-proxy", {
      body: { placeName: pin.place_name, latitude: pin.latitude, longitude: pin.longitude },
    }).then(async ({ data, error }) => {
      if (!error && data?.result) {
        setDetails(data.result);
        const ref = data.result.photos?.[0]?.photo_reference;
        if (ref) {
          const url = getPhotoUrl(ref, 600);
          if (url) setCachedPhotoUrl(url);
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

            {/* Rating */}
            {details.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-sm">{details.rating}</span>
                {details.user_ratings_total && (
                  <span className="text-xs text-muted-foreground">
                    ({details.user_ratings_total.toLocaleString()} opinii)
                  </span>
                )}
              </div>
            )}

            {/* Opening hours */}
            {details.opening_hours ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn("text-sm font-semibold", details.opening_hours.open_now ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                    {details.opening_hours.open_now ? "Otwarte teraz" : "Zamknięte"}
                  </span>
                </div>
                {details.opening_hours.weekday_text?.length > 0 && (
                  <div className="bg-muted/40 rounded-2xl p-3 space-y-1">
                    {(details.opening_hours.weekday_text as string[]).map((line, i) => {
                      const [day, ...rest] = line.split(": ");
                      return (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground w-24 flex-shrink-0">{day}</span>
                          <span className="text-foreground/80">{rest.join(": ")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-2xl px-3 py-2.5">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>Brak potwierdzonych godzin otwarcia — sprawdź w Google</span>
              </div>
            )}

            {/* Reviews */}
            {details.reviews?.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Ostatnie opinie
                </p>
                {details.reviews.slice(0, 3).map((review: any, i: number) => (
                  <div key={i} className="bg-muted/40 rounded-2xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{review.author_name}</span>
                      <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: review.rating ?? 0 }).map((_, j) => (
                          <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                      {review.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Map link */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Otwórz w Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        )}

        {/* No coordinates fallback */}
        {!loading && !details && (
          <div className="pb-6 space-y-3">
            {pin.latitude && pin.longitude && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nie udało się pobrać szczegółów.
              </p>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm py-2.5 px-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Szukaj w Google Maps</span>
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
                <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Zweryfikowany</span>
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
                Zarządzaj wizytówką →
              </button>
            ) : (
              !showClaimForm ? (
                <button
                  onClick={() => setShowClaimForm(true)}
                  className="w-full text-xs text-center text-muted-foreground py-2 hover:text-foreground transition-colors"
                >
                  Jesteś właścicielem tego miejsca? Przejmij wizytówkę
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Przejmij wizytówkę</p>
                  <input
                    type="email"
                    placeholder="E-mail kontaktowy *"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="w-full text-sm rounded-2xl border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="tel"
                    placeholder="Telefon (opcjonalnie)"
                    value={claimPhone}
                    onChange={(e) => setClaimPhone(e.target.value)}
                    className="w-full text-sm rounded-2xl border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <textarea
                    placeholder="Wiadomość (opcjonalnie)"
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
                      Anuluj
                    </button>
                    <button
                      onClick={handleSubmitClaim}
                      disabled={submittingClaim || !claimEmail}
                      className="flex-1 text-sm py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors disabled:opacity-50"
                    >
                      {submittingClaim ? "Wysyłam..." : "Wyślij zgłoszenie"}
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
