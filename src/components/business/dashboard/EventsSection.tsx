// Wydarzenia lokalu: co sie dzieje u niego w konkretnym dniu.
//
// Uklad z makiety: nadchodzace jako karty z pigulka daty, historia jako lista, a po prawej
// wyjasnienie „po co to komu" i liczba, ktora mowi, czy wydarzenia w ogole kogos dosiegly.
//
// ⚠️ Panel NIE pokazuje statystyk per wydarzenie („418 wyswietlen" z makiety). Zdarzenie
// `place_event_viewed` niesie place_id, ale nie identyfikator wydarzenia - karta miejsca
// dostaje z bazy sam TYTUL biezacego wydarzenia, nie jego id. Zamiast zmyslac liczbe przy
// kazdym wierszu, pokazujemy uczciwa sume dla calego lokalu.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { BizCard, BizCardTitle } from "./BizCard";

export interface BizEventRow {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_draft?: boolean | null;
}

export interface EventsSectionProps {
  events: BizEventRow[];
  /** Termin w postaci, ktora panel juz umie skladac (daty + godziny). */
  formatRange: (ev: BizEventRow) => string;
  tab: "upcoming" | "past";
  onTab: (tab: "upcoming" | "past") => void;
  addOpen: boolean;
  onToggleAdd: () => void;
  renderAddForm: () => ReactNode;
  editingEventId: string | null;
  renderEditForm: (ev: BizEventRow) => ReactNode;
  onStartEdit: (ev: BizEventRow) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (ev: BizEventRow) => void;
  /** Wyswietlenia wydarzen w wybranym zakresie (PostHog, event place_event_viewed). */
  eventViews: number;
  rangeDays: number;
  isPremium: boolean;
  onUpgrade: () => void;
}

const MONTHS_SHORT = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

// Pigulka daty z makiety: „12-14 WRZ" albo „21 WRZ".
function datePill(ev: BizEventRow): string {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const m = MONTHS_SHORT[start.getMonth()];
  if (end && end.getTime() !== start.getTime()) {
    const sameMonth = end.getMonth() === start.getMonth();
    return sameMonth
      ? `${start.getDate()}-${end.getDate()} ${m}`
      : `${start.getDate()} ${m} - ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
  }
  return `${start.getDate()} ${m}`;
}

const dayOnly = (iso: string) => iso.slice(0, 10);

export function EventsSection(props: EventsSectionProps) {
  const { t } = useTranslation("bizdash");
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = props.events.filter((e) => dayOnly(e.ends_at ?? e.starts_at) >= today);
  const past = props.events.filter((e) => dayOnly(e.ends_at ?? e.starts_at) < today);
  const shown = props.tab === "upcoming" ? upcoming : past;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 self-start">
          {([["upcoming", upcoming.length], ["past", past.length]] as const).map(([id, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => props.onTab(id)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                props.tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t(`posts.tab_${id}`)} {n}
            </button>
          ))}
        </div>

        {props.addOpen ? <BizCard>{props.renderAddForm()}</BizCard> : null}

        {shown.length === 0 ? (
          <BizCard>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="h-7 w-7 text-slate-300" />
              <p className="text-[14px] font-bold text-slate-700">
                {props.tab === "upcoming" ? t("posts.empty_upcoming") : t("posts.empty_past")}
              </p>
              <p className="max-w-sm text-[13px] text-slate-500">
                {props.tab === "upcoming" ? t("posts.empty_upcoming_hint") : t("posts.empty_past_hint")}
              </p>
            </div>
          </BizCard>
        ) : props.tab === "upcoming" ? (
          shown.map((ev) => (
            <BizCard key={ev.id}>
              {props.editingEventId === ev.id ? props.renderEditForm(ev) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#FDF184] px-2.5 py-1 text-[12px] font-black uppercase text-[#5B2C06]">
                      {datePill(ev)}
                    </span>
                    <span className="text-[13px] text-slate-500">{props.formatRange(ev)}</span>
                    {ev.is_draft ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        {t("posts.events_draft_badge")}
                      </span>
                    ) : dayOnly(ev.starts_at) <= today ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t("posts.status_live")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2.5 text-[18px] font-black leading-tight text-slate-900">{ev.title}</p>
                  {ev.description ? (
                    <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{ev.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => props.onStartEdit(ev)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("posts.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onTogglePublish(ev)}
                      className="rounded-full border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {ev.is_draft ? t("posts.events_publish") : t("posts.finish")}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDelete(ev.id)}
                      title={t("posts.delete")}
                      className="ml-auto rounded-full p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </BizCard>
          ))
        ) : (
          <BizCard padded={false}>
            <div className="px-5 pt-5">
              <BizCardTitle title={t("posts.history_title")} />
            </div>
            <ul className="px-5 pb-3">
              {shown.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-800">{ev.title}</p>
                  <p className="shrink-0 text-[13px] text-slate-500">{props.formatRange(ev)}</p>
                </li>
              ))}
            </ul>
          </BizCard>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <BizCard>
          <BizCardTitle title={t("posts.how_title")} />
          <ul className="flex flex-col gap-2.5">
            {["how_1", "how_2", "how_3"].map((k) => (
              <li key={k} className="flex gap-2.5 text-[13px] leading-snug text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t(`posts.${k}`)}
              </li>
            ))}
          </ul>
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("posts.views_title")} />
          <p className="text-[30px] font-black leading-none text-primary">{props.eventViews}</p>
          <p className="mt-1 text-[13px] text-slate-500">{t("posts.views_hint", { days: props.rangeDays })}</p>
        </BizCard>

        {!props.isPremium ? (
          <div className="rounded-2xl bg-[#FDF184] p-5">
            <p className="text-[15px] font-black text-[#5B2C06]">{t("posts.premium_title")}</p>
            <p className="mt-1.5 text-[13px] leading-snug text-[#5B2C06]">{t("posts.premium_copy")}</p>
            <button
              type="button"
              onClick={props.onUpgrade}
              className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {t("shell.premium.cta")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { datePill as eventDatePill };
