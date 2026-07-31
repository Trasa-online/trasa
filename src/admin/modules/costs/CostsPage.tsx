import { Loader2, Search, Globe } from "lucide-react";
import { format, parseISO } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import {
  useTextsearchMonthly,
  useDailyGoogleQuota,
  TEXTSEARCH_MONTHLY_LIMIT,
  DAILY_CALL_LIMIT,
  TEXTSEARCH_COST_PER_CALL,
  type MonthUsage,
} from "./useApiCosts";

const usd = (n: number) => `$${n.toFixed(2)}`;

export function CostsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Koszty API</h1>
        <p className="text-sm text-slate-500 mt-1">
          Zużycie płatnych wywołań Google Places. Wyszukiwarka (Text Search) ma twardy limit
          miesięczny - po jego przekroczeniu proxy przestaje wołać Google.
        </p>
      </div>
      <TextsearchSection />
      <DailySection />
    </div>
  );
}

function TextsearchSection() {
  const { data, isLoading, isError } = useTextsearchMonthly();

  // Biezacy miesiac (UTC) = pierwszy wpis (RPC sortuje malejaco) lub 0 gdy brak wpisu.
  const monthStart = format(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)), "yyyy-MM-dd");
  const current: MonthUsage = data?.find((m) => m.month === monthStart) ?? { month: monthStart, textsearch_calls: 0 };
  const calls = current.textsearch_calls;
  const pct = Math.min(100, Math.round((calls / TEXTSEARCH_MONTHLY_LIMIT) * 100));
  const spent = calls * TEXTSEARCH_COST_PER_CALL;
  const budget = TEXTSEARCH_MONTHLY_LIMIT * TEXTSEARCH_COST_PER_CALL;
  const remaining = Math.max(0, TEXTSEARCH_MONTHLY_LIMIT - calls);
  const blocked = calls >= TEXTSEARCH_MONTHLY_LIMIT;
  const near = !blocked && pct >= 80;

  const barColor = blocked ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500";
  const history = (data ?? []).filter((m) => m.month !== monthStart);

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5" /> Wyszukiwarka - bieżący miesiąc
      </h2>

      {isLoading ? <Spin /> : isError ? <Err /> : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-3xl font-black text-slate-900 tabular-nums">{usd(spent)}</p>
                <p className="text-sm text-slate-500 mt-0.5">z limitu {usd(budget)} / mies.</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${blocked ? "bg-red-100 text-red-700" : near ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {blocked ? "LIMIT OSIĄGNIĘTY" : near ? "BLISKO LIMITU" : "OK"}
                </span>
              </div>
            </div>

            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(2, pct)}%` }} />
            </div>

            <div className="flex justify-between text-xs text-slate-500 mt-2 tabular-nums">
              <span>{calls.toLocaleString("pl-PL")} / {TEXTSEARCH_MONTHLY_LIMIT.toLocaleString("pl-PL")} wywołań ({pct}%)</span>
              <span>{remaining.toLocaleString("pl-PL")} pozostało</span>
            </div>

            {blocked && (
              <p className="text-xs text-red-600 mt-3 leading-snug">
                Wyszukiwarka jest zablokowana do końca miesiąca. Użytkownicy widzą propozycje z bazy zamiast
                wyników Google. Limit zresetuje się 1. dnia następnego miesiąca (UTC).
              </p>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Poprzednie miesiące</p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {history.map((m) => (
                  <div key={m.month} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-600 capitalize">{format(parseISO(m.month), "LLLL yyyy", { locale: dateLocale() })}</span>
                    <span className="text-slate-500 tabular-nums">
                      {m.textsearch_calls.toLocaleString("pl-PL")} wyw. · <span className="font-semibold text-slate-700">{usd(m.textsearch_calls * TEXTSEARCH_COST_PER_CALL)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DailySection() {
  const { data, isLoading, isError } = useDailyGoogleQuota();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayRow = data?.find((d) => d.day === today);
  const calls = todayRow?.google_calls ?? 0;
  const pct = Math.min(100, Math.round((calls / DAILY_CALL_LIMIT) * 100));
  const max = Math.max(1, ...(data ?? []).map((d) => d.google_calls));

  return (
    <section>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5" /> Wszystkie wywołania Google - dziś
      </h2>
      <p className="text-xs text-slate-400 -mt-1 mb-3 leading-snug">
        Dzienny bezpiecznik (burst) dla wszystkich płatnych wywołań: wyszukiwarka + szczegóły miejsc + zdjęcia.
      </p>
      {isLoading ? <Spin /> : isError ? <Err /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-end justify-between mb-2">
            <p className="text-2xl font-black text-slate-900 tabular-nums">{calls.toLocaleString("pl-PL")}<span className="text-base font-semibold text-slate-400"> / {DAILY_CALL_LIMIT.toLocaleString("pl-PL")}</span></p>
            <span className="text-xs text-slate-500 tabular-nums">{pct}% dziennego limitu</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-slate-900"}`} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>

          {data && data.length > 1 && (
            <div className="mt-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ostatnie dni</p>
              <div className="space-y-2">
                {data.map((d) => (
                  <div key={d.day}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{format(parseISO(d.day), "d MMM", { locale: dateLocale() })}</span>
                      <span className="text-slate-500 tabular-nums">{d.google_calls.toLocaleString("pl-PL")}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300 rounded-full" style={{ width: `${Math.max(3, Math.round((d.google_calls / max) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const Spin = () => <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
const Err = () => <p className="text-sm text-red-500 py-8 text-center">Nie udało się wczytać danych o zużyciu.</p>;
