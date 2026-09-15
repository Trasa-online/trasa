// Wybor kategorii lokalu w DWOCH KROKACH (decyzja Nat 2026-09-14, makieta „Kategorie / krok 1-2").
//
// Model: maksymalnie DWIE rownorzedne kategorie glowne i LACZNIE do trzech podkategorii,
// przy czym kazda wybrana glowna musi miec co najmniej jedna podkategorie. Nie ma juz
// „kategorii dodatkowej" - kawiarnia z vintage storem nie musi decydowac, ktora jest wazniejsza.
//
// Dlaczego dwa kroki, a nie jedna dluga lista: lokal najpierw mowi CZYM JEST (dwie decyzje),
// a dopiero potem doprecyzowuje. Jedna lista 30 pozycji zmuszala do czytania wszystkiego.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import {
  MAIN_CATEGORIES, MAX_MAIN_CATEGORIES, MAX_SUBCATEGORIES,
  mainCategoryLabel, subcategoryLabelLocalized, validateCategorySelection, parentMainOfSub,
} from "@/lib/categories";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";

export interface CategoryPickerModalProps {
  open: boolean;
  initialMains: string[];
  initialSubs: string[];
  onCancel: () => void;
  onSave: (selection: { mains: string[]; subs: string[] }) => void;
}

export function CategoryPickerModal({ open, initialMains, initialSubs, onCancel, onSave }: CategoryPickerModalProps) {
  const { t } = useTranslation("bizdash");
  const [step, setStep] = useState<1 | 2>(1);
  const [mains, setMains] = useState<string[]>(initialMains);
  const [subs, setSubs] = useState<string[]>(initialSubs);

  // Podpowiedz do kategorii glownej budujemy z JEJ podkategorii, a nie z zaszytego
  // polskiego tekstu - dzieki temu jest zawsze aktualna i dziala w obu jezykach.
  const hintFor = (id: string) => {
    const main = MAIN_CATEGORIES.find((m) => m.id === id);
    return (main?.subcategories ?? []).slice(0, 3).map((s) => subcategoryLabelLocalized(s.id)).join(" · ");
  };

  const toggleMain = (id: string) => {
    setMains((prev) => {
      if (prev.includes(id)) {
        // Zdjecie kategorii glownej zabiera ze soba jej podkategorie - inaczej zostalyby
        // sieroty, ktorych lokal juz nigdzie nie widzi, a ktore dalej filtruja wyniki.
        setSubs((s) => s.filter((sub) => parentMainOfSub(sub)?.id !== id));
        return prev.filter((m) => m !== id);
      }
      if (prev.length >= MAX_MAIN_CATEGORIES) return prev;
      return [...prev, id];
    });
  };

  const toggleSub = (id: string) => {
    setSubs((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= MAX_SUBCATEGORIES) return prev;
      return [...prev, id];
    });
  };

  const errors = useMemo(() => validateCategorySelection({ mains, subs }), [mains, subs]);
  const canSave = errors.length === 0;

  if (!open) return null;

  const subsLeft = MAX_SUBCATEGORIES - subs.length;
  // Jedno zdanie na dole mowi, co MOZNA zrobic dalej albo co blokuje zapis.
  const footerHint = step === 1
    ? (mains.length >= MAX_MAIN_CATEGORIES ? t("category.hint_max_mains") : t("category.hint_pick_main"))
    : errors.includes("main_without_sub") ? t("category.hint_each_main")
    : errors.includes("no_sub") ? t("category.hint_pick_sub")
    : subsLeft > 0 ? t("category.hint_left", { count: subsLeft })
    : t("category.hint_max_subs");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-[680px] sm:rounded-3xl">
        <div className="border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black text-slate-900">{t("category.modal_title")}</h2>
            <button type="button" onClick={onCancel} aria-label={t("shell.close")} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StepChip n={1} label={t("category.step_main")} state={step === 1 ? "active" : "done"} onClick={() => setStep(1)} />
            <span className="h-px w-5 bg-slate-200" />
            <StepChip n={2} label={t("category.step_sub")} state={step === 2 ? "active" : mains.length ? "todo" : "disabled"} onClick={() => mains.length && setStep(2)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {step === 1 ? (
            <>
              <p className="text-[13px] leading-5 text-slate-500">{t("category.step1_lead")}</p>
              <SectionLabel label={t("category.mains_label")} counter={`${mains.length} z ${MAX_MAIN_CATEGORIES}`} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {MAIN_CATEGORIES.map((m) => {
                  const on = mains.includes(m.id);
                  const blocked = !on && mains.length >= MAX_MAIN_CATEGORIES;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMain(m.id)}
                      disabled={blocked}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        on ? "border-primary bg-[#FDF0E9]" : blocked ? "border-transparent bg-slate-50 opacity-50" : "border-transparent bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <img src={categoryIconSrc(m.id)} alt="" className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-slate-900">{mainCategoryLabel(m.id)}</span>
                        <span className="block truncate text-[12px] text-slate-500">{hintFor(m.id)}</span>
                      </span>
                      {on ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-slate-500">{t("category.step2_lead")}</p>
              <SectionLabel label={t("category.subs_label")} counter={`${subs.length} z ${MAX_SUBCATEGORIES}`} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {mains.map((mainId) => {
                  const main = MAIN_CATEGORIES.find((m) => m.id === mainId);
                  if (!main) return null;
                  const chosen = subs.filter((s) => parentMainOfSub(s)?.id === mainId).length;
                  return (
                    <div key={mainId} className={`rounded-2xl border p-3.5 ${chosen ? "border-slate-200" : "border-primary/40 bg-[#FDF0E9]/40"}`}>
                      <div className="mb-2.5 flex items-center gap-2">
                        <img src={categoryIconSrc(mainId)} alt="" className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">{mainCategoryLabel(mainId)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chosen ? "bg-emerald-50 text-emerald-600" : "bg-white text-primary"}`}>
                          {chosen}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {main.subcategories.map((sub) => {
                          const on = subs.includes(sub.id);
                          const blocked = !on && subs.length >= MAX_SUBCATEGORIES;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleSub(sub.id)}
                              disabled={blocked}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors ${
                                on ? "border-primary bg-primary text-white"
                                  : blocked ? "border-slate-200 text-slate-300"
                                  : "border-slate-200 text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                              {subcategoryLabelLocalized(sub.id)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          <p className="text-[12px] text-slate-500">{footerHint}</p>
          <div className="ml-auto flex items-center gap-2">
            {step === 1 ? (
              <>
                <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("category.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={mains.length === 0}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t("category.next")}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {t("category.back")}
                </button>
                <button
                  type="button"
                  onClick={() => canSave && onSave({ mains, subs })}
                  disabled={!canSave}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t("category.save")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label, counter }: { label: string; counter: string }) {
  return (
    <div className="mb-2.5 mt-4 flex items-center justify-between">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[12px] text-slate-400">{counter}</p>
    </div>
  );
}

function StepChip({ n, label, state, onClick }: {
  n: number; label: string; state: "active" | "done" | "todo" | "disabled"; onClick: () => void;
}) {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-bold transition-colors";
  const skin = state === "active" ? "bg-slate-900 text-white"
    : state === "done" ? "bg-emerald-50 text-emerald-600"
    : state === "todo" ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
    : "bg-slate-100 text-slate-300 cursor-not-allowed";
  return (
    <button type="button" onClick={onClick} disabled={state === "disabled"} className={`${base} ${skin}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
        state === "active" ? "bg-primary text-white" : state === "done" ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
      }`}>
        {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
      </span>
      {label}
    </button>
  );
}
