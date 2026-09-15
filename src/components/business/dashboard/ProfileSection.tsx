// Wizytowka: wszystko, co gosc widzi o lokalu w aplikacji.
//
// Uklad z makiety: kolumna formularza + przyklejony podglad karty po prawej („Tak widzą
// Cię goście"). Podglad jest wazniejszy niz wyglada - lokal wypelnia pola w panelu,
// a skutek widzi dopiero w apce; bez podgladu wypelnia je na slepo.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { BizCard, BizCardTitle } from "./BizCard";
import { mainCategoryLabel, subcategoryLabelLocalized, parentMainOfSub, MAX_SUBCATEGORIES } from "@/lib/categories";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

export interface ProfileFormValue {
  businessName: string;
  description: string;
  street: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
}

export interface ProfileSectionProps {
  value: ProfileFormValue;
  onChange: (patch: Partial<ProfileFormValue>) => void;
  mains: string[];
  subs: string[];
  onEditCategories: () => void;
  /** Edytor godzin otwarcia (istniejacy komponent) - sekcja tylko go osadza. */
  hours: ReactNode;
  /** Karta lokalu w postaci, w jakiej widzi ja gosc. */
  preview: ReactNode;
  descriptionMax?: number;
}

export function ProfileSection(props: ProfileSectionProps) {
  const { t } = useTranslation("bizdash");
  const v = props.value;
  const set = (patch: Partial<ProfileFormValue>) => props.onChange(patch);
  const descMax = props.descriptionMax ?? 280;

  const subsLeft = MAX_SUBCATEGORIES - props.subs.length;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
      <div className="flex flex-col gap-4">
        <BizCard>
          <BizCardTitle title={t("profile.basics_title")} hint={t("profile.basics_hint")} />
          <Field label={t("profile.name_label")}>
            <input
              value={v.businessName}
              maxLength={80}
              onChange={(e) => set({ businessName: e.target.value })}
              placeholder={t("profile.name_placeholder")}
              className={INPUT}
            />
          </Field>
          <Field label={t("profile.description_label")} hint={`${v.description.length}/${descMax}`}>
            <textarea
              value={v.description}
              maxLength={descMax}
              rows={3}
              onChange={(e) => set({ description: e.target.value })}
              placeholder={t("profile.description_placeholder")}
              className={`${INPUT} resize-none leading-relaxed`}
            />
          </Field>
        </BizCard>

        <BizCard>
          <BizCardTitle
            title={t("profile.categories_title")}
            hint={t("profile.categories_hint")}
            action={
              <button
                type="button"
                onClick={props.onEditCategories}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("profile.categories_edit")}
              </button>
            }
          />
          {props.mains.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500">{t("profile.categories_empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {props.mains.map((mainId) => {
                const own = props.subs.filter((s) => parentMainOfSub(s)?.id === mainId);
                return (
                  <div key={mainId} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
                    <img src={categoryIconSrc(mainId)} alt="" className="h-4 w-4 shrink-0" />
                    <span className="text-[14px] font-bold text-slate-900">{mainCategoryLabel(mainId)}</span>
                    {own.length ? <span className="text-slate-300">·</span> : null}
                    {own.map((s) => (
                      <span key={s} className="rounded-full bg-[#FDF184] px-2.5 py-1 text-[12px] font-bold text-[#5B2C06]">
                        {subcategoryLabelLocalized(s)}
                      </span>
                    ))}
                    {own.length === 0 ? (
                      <span className="text-[12px] font-semibold text-primary">{t("profile.categories_needs_sub")}</span>
                    ) : null}
                  </div>
                );
              })}
              <p className="text-[12px] text-slate-400">
                {subsLeft > 0
                  ? t("profile.categories_used", { used: props.subs.length, max: MAX_SUBCATEGORIES, left: subsLeft })
                  : t("profile.categories_used_max", { max: MAX_SUBCATEGORIES })}
              </p>
            </div>
          )}
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("profile.contact_title")} hint={t("profile.contact_hint")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("profile.street")}>
              <input value={v.street} maxLength={100} onChange={(e) => set({ street: e.target.value })} className={INPUT} />
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label={t("profile.city")}>
                <input value={v.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t("profile.postal")}>
                <input value={v.postalCode} maxLength={10} onChange={(e) => set({ postalCode: e.target.value })} className={INPUT} />
              </Field>
            </div>
            <Field label={t("profile.phone")}>
              <input value={v.phone} maxLength={20} type="tel" onChange={(e) => set({ phone: e.target.value })} className={INPUT} placeholder="+48 500 000 000" />
            </Field>
            <Field label={t("profile.website")}>
              <input value={v.website} maxLength={200} type="url" onChange={(e) => set({ website: e.target.value })} className={INPUT} placeholder="twojlokal.pl" />
            </Field>
            <Field label={t("profile.email")}>
              <input value={v.email} maxLength={100} type="email" onChange={(e) => set({ email: e.target.value })} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram">
                <input value={v.instagram} maxLength={200} onChange={(e) => set({ instagram: e.target.value })} className={INPUT} placeholder="@twojlokal" />
              </Field>
              <Field label="Facebook">
                <input value={v.facebook} maxLength={200} onChange={(e) => set({ facebook: e.target.value })} className={INPUT} />
              </Field>
            </div>
          </div>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("profile.hours_title")} hint={t("profile.hours_hint")} />
          {props.hours}
        </BizCard>
      </div>

      <div className="lg:sticky lg:top-24">
        <BizCard>
          <BizCardTitle title={t("profile.preview_title")} />
          {props.preview}
          <p className="mt-3 text-center text-[12px] text-slate-400">{t("profile.preview_hint")}</p>
        </BizCard>
      </div>
    </div>
  );
}

// Jedno pole = jedna etykieta i jedno wypelnienie. Szare tlo pola pochodzi z decyzji
// Nat 2026-09-14 („wszystkie inputy przez BizInput") - tutaj ta sama skora, bez shadcn.
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:bg-white";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
