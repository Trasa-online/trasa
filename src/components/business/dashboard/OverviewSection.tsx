// Przeglad: pierwsza rzecz, ktora lokal widzi po zalogowaniu.
//
// Zasada z makiety „Spokojny panel": JEDNA duza liczba (wyswietlenia) z kierunkiem,
// pod nia cztery liczby pomocnicze, a nizej to, co sie ostatnio wydarzylo. Zadnych
// kolorowych kafli i zadnej metryki, ktorej nie umiemy policzyc uczciwie.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { BizCard, BizCardTitle } from "./BizCard";
import { TrendChart, type TrendPoint } from "./TrendChart";
import type { BizSection } from "./BizShell";

export interface OverviewStats {
  views: number;
  onRoutes: number;
  websiteClicks: number;
  phoneClicks: number;
  saves: number;
  previous?: { views: number; onRoutes: number; clicks: number; saves: number };
}

export interface CompletenessStep { id: string; label: string; done: boolean; section: BizSection }

export interface OverviewSectionProps {
  range: "7d" | "30d" | "90d";
  onRange: (r: "7d" | "30d" | "90d") => void;
  /** Dluzsze okno historii jest czescia premium - w podstawowym planie 90 dni ma klodke. */
  isPremium: boolean;
  loading: boolean;
  stats: OverviewStats;
  chart: TrendPoint[];
  recentEvents: { event_type: string; created_at: string }[];
  steps: CompletenessStep[];
  onGoTo: (section: BizSection) => void;
  onUpgrade: () => void;
}

// Grupowanie tysiecy TWARDA spacja, niezaleznie od danych lokalizacyjnych przegladarki.
// `toLocaleString("pl-PL")` w niektorych srodowiskach oddaje "1247" zamiast "1 247",
// a liczba bez grupowania w duzym kroju czyta sie jak numer, nie jak wynik.
const count = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const RANGES: { id: "7d" | "30d" | "90d"; days: number; premium?: boolean }[] = [
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
  { id: "90d", days: 90, premium: true },
];

export function OverviewSection(props: OverviewSectionProps) {
  const { t } = useTranslation("bizdash");
  const days = RANGES.find((r) => r.id === props.range)?.days ?? 30;

  const clicks = props.stats.websiteClicks + props.stats.phoneClicks;
  const prev = props.stats.previous;

  const done = props.steps.filter((s) => s.done).length;
  const pct = props.steps.length ? Math.round((done / props.steps.length) * 100) : 100;
  const todo = props.steps.filter((s) => !s.done).slice(0, 3);

  const chartRange = useMemo(() => {
    if (props.chart.length === 0) return null;
    return { from: props.chart[0].date, to: props.chart[props.chart.length - 1].date };
  }, [props.chart]);

  const fmtDay = (iso: string) => {
    try { return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(new Date(iso)); }
    catch { return iso; }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {RANGES.map((r) => {
            const locked = r.premium && !props.isPremium;
            const on = props.range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => (locked ? props.onUpgrade() : props.onRange(r.id))}
                className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  on ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t("overview.range_days", { count: r.days })}
                {locked ? <Lock className="h-3 w-3" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bohater: wyswietlenia wizytowki + kierunek. */}
      <BizCard>
        <p className="text-[13px] text-slate-500">{t("overview.hero_label")}</p>
        <div className="mt-1 flex items-center gap-2.5">
          <p className="text-[40px] font-black leading-none tracking-tight text-slate-900">
            {props.loading ? "…" : count(props.stats.views)}
          </p>
          <DeltaBadge now={props.stats.views} before={prev?.views} />
        </div>
        <div className="mt-4">
          {props.chart.length === 0 ? (
            <EmptyChart text={t("overview.chart_empty")} />
          ) : (
            <TrendChart points={props.chart} />
          )}
        </div>
        {chartRange ? (
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{fmtDay(chartRange.from)}</span>
            <span>{fmtDay(chartRange.to)}</span>
          </div>
        ) : null}
      </BizCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t("overview.stat_views")} value={props.stats.views} before={prev?.views} days={days} />
        <Metric label={t("overview.stat_contact")} value={clicks} before={prev?.clicks} days={days} />
        <Metric label={t("overview.stat_trips")} value={props.stats.onRoutes} before={prev?.onRoutes} days={days} />
        <Metric label={t("overview.stat_saves")} value={props.stats.saves} before={prev?.saves} days={days} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <BizCard padded={false}>
          <div className="px-5 pt-5">
            <BizCardTitle title={t("overview.activity_title")} />
          </div>
          {props.recentEvents.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-slate-500">{t("overview.activity_empty")}</p>
          ) : (
            <ul className="px-5 pb-2">
              {props.recentEvents.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <p className="min-w-0 flex-1 truncate text-[14px] text-slate-700">{ev.event_type}</p>
                  <p className="shrink-0 text-[12px] text-slate-400">
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: dateLocale() })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </BizCard>

        <BizCard>
          <BizCardTitle title={t("overview.completeness_title")} />
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-black leading-none text-primary">{pct}%</span>
            <span className="text-[13px] text-slate-500">{t("overview.completeness_done")}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
          {todo.length === 0 ? (
            <p className="mt-4 text-[13px] text-slate-500">{t("overview.completeness_all")}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-1">
              {todo.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => props.onGoTo(s.section)}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-slate-300" />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BizCard>
      </div>
    </div>
  );
}

function Metric({ label, value, before, days }: { label: string; value: number; before?: number; days: number }) {
  const { t } = useTranslation("bizdash");
  const delta = deltaPct(value, before);
  return (
    <BizCard className="p-4">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-[28px] font-black leading-none text-slate-900">{count(value)}</p>
      {delta === null ? (
        <p className="mt-2 text-[12px] text-slate-400">{t("overview.delta_none")}</p>
      ) : (
        <p className={`mt-2 flex items-center gap-1 text-[12px] ${delta >= 0 ? "text-emerald-600" : "text-slate-500"}`}>
          {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {t("overview.delta", { pct: Math.abs(delta), days })}
        </p>
      )}
    </BizCard>
  );
}

function DeltaBadge({ now, before }: { now: number; before?: number }) {
  const delta = deltaPct(now, before);
  if (delta === null) return null;
  return (
    <span className="rounded-full bg-[#FDF184] px-2.5 py-1 text-[12px] font-bold text-[#5B2C06]">
      {delta >= 0 ? "+" : "-"}{Math.abs(delta)}%
    </span>
  );
}

// Zmiana wobec poprzedniego okresu. Gdy poprzednio bylo ZERO, procent nie istnieje
// (dzielenie przez zero), a "+100%" z jednego wyswietlenia to klamstwo - wtedy null.
function deltaPct(now: number, before?: number): number | null {
  if (before == null || before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-xl bg-slate-50 md:h-[220px]">
      <p className="px-6 text-center text-[13px] text-slate-400">{text}</p>
    </div>
  );
}
