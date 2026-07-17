import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Tiers ────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "basic",
    planLabelKey: "onepager.tiers.basic.plan_label",
    subtitleKey: "onepager.tiers.basic.subtitle",
    price: null,
    priceNoteKey: "onepager.tiers.basic.price_note",
    badge: false,
    blueTitle: false,
    features: [
      { key: "onepager.features.biz_profile" },
      { key: "onepager.features.gallery_photos" },
      { key: "onepager.features.description" },
      { key: "onepager.features.address" },
      { key: "onepager.features.basic_analytics" },
    ],
  },
  {
    id: "pro",
    planLabelKey: "onepager.tiers.pro.plan_label",
    subtitleKey: "onepager.tiers.pro.subtitle",
    price: "89zł",
    priceNoteKey: null,
    badge: true,
    blueTitle: false,
    features: [
      { key: "onepager.features.biz_profile" },
      { key: "onepager.features.gallery_media", bold: true },
      { key: "onepager.features.description" },
      { key: "onepager.features.address" },
      { key: "onepager.features.full_analytics", bold: true },
      { key: "onepager.features.news_promos_a", bold: true },
    ],
  },
  {
    id: "premium",
    planLabelKey: "onepager.tiers.premium.plan_label",
    subtitleKey: "onepager.tiers.premium.subtitle",
    price: "139zł",
    priceNoteKey: null,
    badge: true,
    blueTitle: true,
    features: [
      { key: "onepager.features.biz_profile" },
      { key: "onepager.features.gallery_media", bold: true },
      { key: "onepager.features.description" },
      { key: "onepager.features.address" },
      { key: "onepager.features.full_analytics", bold: true },
      { key: "onepager.features.news_promos_b", bold: true },
      { key: "onepager.features.push", bold: true },
      { key: "onepager.features.custom_look", bold: true },
    ],
  },
];

// ─── Form ─────────────────────────────────────────────────────────────────────

function BizForm({ selectedPlan, onPlanChange }: { selectedPlan: string | null; onPlanChange: (p: string | null) => void }) {
  const { t } = useTranslation("bizlanding");
  const [placeName, setPlaceName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const fullMessage = [
        selectedPlan ? `Plan: ${selectedPlan}` : null,
        message.trim() || null,
      ].filter(Boolean).join("\n") || null;
      const { error } = await (supabase as any).from("business_claims").insert({
        contact_email: email.trim().toLowerCase(),
        contact_phone: phone.trim() || null,
        place_name_text: placeName.trim(),
        message: fullMessage,
        status: "pending",
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || t("onepager.form.error"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-black text-foreground mb-2">{t("onepager.form.done_title")}</h3>
        <p className="text-slate-500 max-w-xs mx-auto">{t("onepager.form.done_desc")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg mx-auto">
      {selectedPlan && (
        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-sm text-blue-700 font-semibold">{t("onepager.form.selected_plan")} <strong>{selectedPlan}</strong></span>
          </div>
          <button type="button" onClick={() => onPlanChange(null)} className="text-blue-400 hover:text-blue-600 text-xs">{t("onepager.form.change")}</button>
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">{t("onepager.form.name_label")}</label>
        <input required value={placeName} onChange={e => setPlaceName(e.target.value)}
          placeholder={t("onepager.form.name_placeholder")}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">{t("onepager.form.email_label")}</label>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t("onepager.form.email_placeholder")}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">{t("onepager.form.phone_label")} <span className="font-normal text-slate-400">{t("onepager.form.optional")}</span></label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder={t("onepager.form.phone_placeholder")}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-1.5">{t("onepager.form.message_label")} <span className="font-normal text-slate-400">{t("onepager.form.optional")}</span></label>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder={t("onepager.form.message_placeholder")}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:opacity-60">
        {loading ? t("onepager.form.submitting") : t("onepager.form.submit")}
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessOnePager() {
  const navigate = useNavigate();
  const { t } = useTranslation("bizlanding");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const scrollToForm = (planSubtitle: string) => {
    setSelectedPlan(planSubtitle);
    setTimeout(() => document.getElementById("formularz")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="min-h-screen bg-[#FEFEFE]">

      {/* Nav */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-5 h-14 flex items-center justify-between gap-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <span className="font-black text-sm text-foreground">trasa</span>
        </button>
        <div className="hidden sm:flex items-center gap-5">
          <button
            onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })}
            className="text-sm font-semibold text-slate-600 hover:text-foreground transition-colors"
          >
            {t("onepager.nav.packages")}
          </button>
          <button
            onClick={() => document.getElementById("formularz")?.scrollIntoView({ behavior: "smooth" })}
            className="text-sm font-semibold text-slate-600 hover:text-foreground transition-colors"
          >
            {t("onepager.nav.form")}
          </button>
        </div>
        <button
          onClick={() => document.getElementById("formularz")?.scrollIntoView({ behavior: "smooth" })}
          className="text-sm font-bold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition-all shrink-0"
        >
          {t("onepager.nav.submit_place")}
        </button>
      </div>

      {/* Pakiety */}
      <section id="pakiety" className="py-8 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">{t("onepager.packages.eyebrow")}</p>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              {t("onepager.packages.title")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {TIERS.map((tier) => (
              <div key={tier.id} className="rounded-3xl p-5 flex flex-col bg-white border border-slate-200 shadow-sm relative">
                {/* Plan label */}
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${tier.id === "basic" ? "text-slate-400" : "text-foreground"}`}>
                  {t(tier.planLabelKey)}
                </p>
                {/* Badge - centered row, desktop only */}
                <div className="hidden md:flex items-center justify-center min-h-[26px] mb-2">
                  {tier.badge && (
                    <span className="bg-blue-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {t("onepager.tiers.badge")}
                    </span>
                  )}
                </div>
                {/* Title + badge inline on mobile */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className={`text-lg font-black ${tier.blueTitle ? "text-blue-600" : "text-foreground"}`}>
                    {t(tier.subtitleKey)}
                  </h3>
                  {tier.badge && (
                    <span className="md:hidden bg-blue-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {t("onepager.tiers.badge")}
                    </span>
                  )}
                </div>
                {/* Price */}
                <div className="mb-3 h-5">
                  {tier.price
                    ? <p className="text-sm text-slate-400 line-through">{tier.price}</p>
                    : <p className="text-sm font-bold text-slate-600">{t(tier.priceNoteKey as string)}</p>
                  }
                </div>
                {/* Features */}
                <ul className="flex flex-col gap-2 flex-1 mb-4">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className={`text-xs leading-snug ${f.bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                        {t(f.key)}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* CTA */}
                <button
                  onClick={() => scrollToForm(t(tier.subtitleKey))}
                  className="mt-auto text-center text-sm font-bold px-4 py-2.5 rounded-2xl bg-foreground text-white hover:bg-slate-700 active:scale-95 transition-all"
                >
                  {t("onepager.packages.cta")}
                </button>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="flex flex-col items-center mt-6 gap-2">
            <p className="text-xs text-slate-400 font-medium tracking-wide">{t("onepager.packages.scroll_hint")}</p>
            <ChevronDown className="h-5 w-5 text-slate-300 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Formularz */}
      <section id="formularz" className="py-16 px-5 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">{t("onepager.form.eyebrow")}</p>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-3">{t("onepager.form.title")}</h2>
            <p className="text-base text-muted-foreground max-w-[44ch] mx-auto">
              {t("onepager.form.subtitle")}
            </p>
          </div>
          <BizForm selectedPlan={selectedPlan} onPlanChange={setSelectedPlan} />
        </div>
      </section>

    </div>
  );
}
