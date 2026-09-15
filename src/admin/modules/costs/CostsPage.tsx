// Koszty Google Places. Dwa bezpieczniki: miesieczny na wyszukiwarke i dzienny na wszystko.
import { format, parseISO } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { AppShell, PageHeader, Section, Metric, Bar, Loading, EmptyState, DataTable, type Column } from "../../ui";
import {
  useTextsearchMonthly,
  useDailyGoogleQuota,
  TEXTSEARCH_MONTHLY_LIMIT,
  DAILY_CALL_LIMIT,
  TEXTSEARCH_COST_PER_CALL,
  type MonthUsage,
  type DayUsage,
} from "./useApiCosts";

const usd = (n: number) => `$${n.toFixed(2)}`;
const pl = (n: number) => n.toLocaleString("pl-PL");

export function CostsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Koszty API"
        subtitle="Zużycie płatnych wywołań Google Places. Po przekroczeniu limitu proxy przestaje wołać Google."
      />
      <Monthly />
      <Daily />
    </AppShell>
  );
}

function Monthly() {
  const { data, isLoading, isError } = useTextsearchMonthly();

  const now = new Date();
  const monthStart = format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), "yyyy-MM-dd");
  const current: MonthUsage = data?.find((m) => m.month === monthStart) ?? { month: monthStart, textsearch_calls: 0 };
  const calls = current.textsearch_calls;
  const pct = Math.min(100, Math.round((calls / TEXTSEARCH_MONTHLY_LIMIT) * 100));
  const blocked = calls >= TEXTSEARCH_MONTHLY_LIMIT;
  const near = !blocked && pct >= 80;
  const tone = blocked ? "bad" : near ? "warn" : "ok";
  const history = (data ?? []).filter((m) => m.month !== monthStart);

  const columns: Column<MonthUsage>[] = [
    {
      key: "month", label: "Miesiąc", primary: true,
      render: (m) => <span className="capitalize">{format(parseISO(m.month), "LLLL yyyy", { locale: dateLocale() })}</span>,
    },
    { key: "calls", label: "Wywołania", width: 160, align: "right", render: (m) => <span className="data">{pl(m.textsearch_calls)}</span> },
    {
      key: "cost", label: "Koszt", width: 140, align: "right",
      render: (m) => <span className="data text-[var(--ink)]">{usd(m.textsearch_calls * TEXTSEARCH_COST_PER_CALL)}</span>,
    },
  ];

  return (
    <>
      <Section title="Wyszukiwarka · bieżący miesiąc">
        {isLoading ? <Loading /> : isError ? (
          <EmptyState fact="Dane o zużyciu nie przyszły." next="Odśwież stronę - licznik żyje w bazie, nie w przeglądarce." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Metric
                label="Wydane w tym miesiącu"
                value={usd(calls * TEXTSEARCH_COST_PER_CALL)}
                hint={`z limitu ${usd(TEXTSEARCH_MONTHLY_LIMIT * TEXTSEARCH_COST_PER_CALL)}`}
                tone={tone}
              />
              <Metric label="Wywołania" value={pl(calls)} hint={`z ${pl(TEXTSEARCH_MONTHLY_LIMIT)}`} />
              <Metric label="Zostało" value={pl(Math.max(0, TEXTSEARCH_MONTHLY_LIMIT - calls))} />
              <Metric label="Wykorzystanie" value={`${pct}%`} tone={tone} />
            </div>
            <Bar pct={pct} tone={tone} className="mt-1" />
            {blocked ? (
              <p className="text-[12px] leading-5 text-[var(--bad)]">
                Wyszukiwarka jest zablokowana do końca miesiąca. Użytkownicy widzą propozycje z bazy zamiast wyników
                Google. Limit zeruje się pierwszego dnia następnego miesiąca (UTC).
              </p>
            ) : null}
          </>
        )}
      </Section>

      {history.length ? (
        <Section title="Poprzednie miesiące">
          <DataTable columns={columns} rows={history} keyOf={(m) => m.month} />
        </Section>
      ) : null}
    </>
  );
}

function Daily() {
  const { data, isLoading, isError } = useDailyGoogleQuota();
  const today = format(new Date(), "yyyy-MM-dd");
  const calls = data?.find((d) => d.day === today)?.google_calls ?? 0;
  const pct = Math.min(100, Math.round((calls / DAILY_CALL_LIMIT) * 100));
  const tone = pct >= 100 ? "bad" : pct >= 80 ? "warn" : "ok";
  const max = Math.max(1, ...(data ?? []).map((d) => d.google_calls));

  const columns: Column<DayUsage>[] = [
    {
      key: "day", label: "Dzień", primary: true,
      render: (d) => <span>{format(parseISO(d.day), "d MMMM", { locale: dateLocale() })}</span>,
    },
    {
      key: "calls", label: "Wywołania", align: "right",
      render: (d) => (
        <div className="flex items-center justify-end gap-2">
          <Bar pct={Math.round((d.google_calls / max) * 100)} className="hidden w-24 md:block" />
          <span className="data">{pl(d.google_calls)}</span>
        </div>
      ),
    },
  ];

  return (
    <Section title="Wszystkie wywołania Google · dziś">
      {isLoading ? <Loading /> : isError ? (
        <EmptyState fact="Dzienny licznik nie przyszedł." next="Odśwież stronę - to ta sama tabela, co miesięczna." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metric label="Dziś" value={pl(calls)} hint={`z ${pl(DAILY_CALL_LIMIT)} dziennego bezpiecznika`} tone={tone} />
            <Metric label="Wykorzystanie" value={`${pct}%`} tone={tone} />
            <Metric label="Zostało" value={pl(Math.max(0, DAILY_CALL_LIMIT - calls))} />
          </div>
          <Bar pct={pct} tone={tone} className="mt-1" />
          <p className="text-[12px] leading-5 text-[var(--stone)]">
            Bezpiecznik obejmuje wszystkie płatne wywołania razem: wyszukiwarkę, szczegóły miejsc i zdjęcia.
          </p>
          {data && data.length > 1 ? (
            <DataTable columns={columns} rows={data} keyOf={(d) => d.day} />
          ) : null}
        </>
      )}
    </Section>
  );
}
