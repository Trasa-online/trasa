import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Place {
  id: string;
  place_name: string;
  city: string;
  address: string | null;
  description: string | null;
  photo_url: string | null;
  category: string;
}

interface BusinessProfileLite {
  id: string;
  business_name: string;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  owner_user_id: string | null;
}

const ClaimPlace = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("sharing");

  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<Place | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileLite | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  // Form state
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Load place ──
  useEffect(() => {
    if (!placeId) return;
    (async () => {
      try {
        const { data: placeData, error: placeErr } = await supabase
          .from("places")
          .select("id, place_name, city, address, description, photo_url, category")
          .eq("id", placeId)
          .maybeSingle();
        if (placeErr) throw placeErr;
        setPlace(placeData as Place | null);

        if (!placeData) return;

        const { data: bpData } = await (supabase as any)
          .from("business_profiles")
          .select("id, business_name, cover_image_url, gallery_urls, owner_user_id")
          .eq("place_id", placeId)
          .maybeSingle();

        if (bpData) {
          setBusinessProfile(bpData);
          if (bpData.owner_user_id) setAlreadyClaimed(true);
        }
      } catch (err) {
        console.error("[ClaimPlace] load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place || !contactEmail.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("business_claims").insert({
        place_id: place.id,
        place_name_text: place.place_name,
        business_name: place.place_name,
        contact_email: contactEmail.trim().toLowerCase(),
        contact_phone: contactPhone.trim() || null,
        message: message.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("[ClaimPlace] submit failed:", err);
      toast.error(err?.message || t("claim.error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFEFE] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="min-h-screen bg-[#FEFEFE] flex flex-col items-center justify-center px-6 gap-5">
        <div className="h-14 w-14 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-black text-[#0E0E0E] mb-2">{t("claim.not_found_title")}</h1>
          <p className="text-sm text-[#979797]">{t("claim.not_found_desc")}</p>
        </div>
        <Link to="/dla-firm/landing" className="text-sm text-orange-600 font-semibold hover:underline">
          {t("claim.back_business_page")}
        </Link>
      </div>
    );
  }

  if (alreadyClaimed) {
    return (
      <div className="min-h-screen bg-[#FEFEFE] flex flex-col items-center justify-center px-6 gap-5">
        <div className="h-14 w-14 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-black text-[#0E0E0E] mb-2">{t("claim.claimed_title", { name: place.place_name })}</h1>
          <p className="text-sm text-[#979797]">{t("claim.claimed_desc")}</p>
        </div>
        <Link to="/auth?business=true" className="text-sm text-orange-600 font-semibold hover:underline">
          {t("claim.login_to_panel")}
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FEFEFE] flex flex-col items-center justify-center px-6 gap-5">
        <div className="h-14 w-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <Check className="h-7 w-7 text-green-600" strokeWidth={3} />
        </div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-black text-[#0E0E0E] mb-2">{t("claim.thanks_title")}</h1>
          <p className="text-sm text-[#979797] leading-relaxed">
            {t("claim.submitted_desc_before")}{" "}
            <span className="font-semibold text-[#0E0E0E]">{place.place_name}</span>{" "}
            {t("claim.submitted_desc_middle")}{" "}
            <span className="font-semibold text-[#0E0E0E]">{contactEmail}</span>{" "}
            {t("claim.submitted_desc_after")}
          </p>
        </div>
      </div>
    );
  }

  // ── Main form ──
  const heroPhoto = businessProfile?.cover_image_url || place.photo_url;

  return (
    <div className="min-h-screen bg-[#FEFEFE]">
      {/* TopBar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 h-14 lg:h-16">
        <div className="h-full flex items-center justify-between px-5 lg:px-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-base lg:text-lg text-[#0E0E0E] tracking-tight">trasa</span>
          </div>
          <button
            onClick={() => navigate("/dla-firm/landing")}
            className="text-sm text-slate-500 hover:text-[#0E0E0E] font-medium flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("claim.business_page")}</span>
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 lg:px-8 py-8 lg:py-12">

        {/* Intro */}
        <div className="mb-7 text-center">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">{t("claim.intro_eyebrow")}</p>
          <h1 className="text-3xl lg:text-4xl font-black text-[#0E0E0E] leading-tight">{place.place_name}</h1>
          <p className="text-sm text-[#979797] flex items-center justify-center gap-1.5 mt-2">
            <MapPin className="h-3.5 w-3.5" />
            {place.address || place.city}
          </p>
        </div>

        {/* Place preview */}
        <div className="mb-8 rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-white">
          {heroPhoto ? (
            <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
              <img src={heroPhoto} alt={place.place_name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-gradient-to-br from-orange-300 to-orange-500" />
          )}
          {place.description && (
            <div className="px-5 py-4">
              <p className="text-sm text-[#0E0E0E]/80 leading-relaxed">{place.description}</p>
            </div>
          )}
          {businessProfile?.gallery_urls && businessProfile.gallery_urls.length > 0 && (
            <div className="px-5 pb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("claim.gallery_label", { count: businessProfile.gallery_urls.length })}</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
                {businessProfile.gallery_urls.slice(0, 6).map((url, i) => (
                  <img key={i} src={url} className="h-20 w-20 lg:h-24 lg:w-24 rounded-xl object-cover shrink-0" alt="" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-black text-[#0E0E0E] mb-1">{t("claim.claim_heading")}</h2>
            <p className="text-sm text-[#979797] leading-relaxed">
              {t("claim.claim_subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0E0E0E]">{t("claim.email_label")}</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder={t("claim.email_placeholder")}
                maxLength={254}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0E0E0E]">{t("claim.phone_label")} <span className="text-[10px] font-normal text-slate-400">{t("claim.optional")}</span></label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder={t("claim.phone_placeholder")}
                maxLength={20}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#0E0E0E]">{t("claim.message_label")} <span className="text-[10px] font-normal text-slate-400">{t("claim.optional")}</span></label>
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={500}
                placeholder={t("claim.message_placeholder")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !contactEmail.trim()}
              className="w-full rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #F4A259, #F9662B)", boxShadow: "0 8px 24px -6px rgba(249, 102, 43, 0.4)" }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t("claim.submitting") : t("claim.submit")}
            </button>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-1">
              {t("claim.form_disclaimer")}{" "}
              <Link to="/terms" className="text-slate-500 underline hover:text-slate-700">{t("claim.privacy_policy")}</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClaimPlace;
